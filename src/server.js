import express from 'express';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { gateways } from './services/payments.js';
import { bookShipment, supportedCouriers } from './services/courier.js';
import { sendMail } from './services/mailer.js';
import { recognize } from './services/vision.js';
import { autoPost } from './services/social.js';
import { themes, DEFAULT_THEME } from './themes.js';

// Cancels an unpaid order and returns its items to stock. Returns false if not cancellable.
export function cancelUnpaidOrder(db, id, reason = 'cancelled') {
  const o = db.prepare('SELECT status FROM orders WHERE id=?').get(id);
  if (!o || o.status !== 'awaiting_payment') return false;
  for (const it of db.prepare('SELECT * FROM order_items WHERE order_id=?').all(id))
    db.prepare('UPDATE products SET stock=stock+? WHERE id=?').run(it.qty, it.product_id);
  db.prepare('UPDATE orders SET status=? WHERE id=?').run(reason, id);
  return true;
}

// Expires unpaid orders older than `hours`. Returns the ids expired.
export function expireUnpaidOrders(db, hours = Number(process.env.PAYMENT_HOLD_HOURS) || 48) {
  const rows = db.prepare("SELECT id FROM orders WHERE status='awaiting_payment' AND created_at IS NOT NULL AND datetime(created_at) <= datetime('now', ?)").all(`-${hours} hours`);
  return rows.map(r => r.id).filter(id => cancelUnpaidOrder(db, id, 'expired'));
}

export function requireAdmin(req, res, next) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return res.status(503).json({ error: 'ADMIN_TOKEN not configured' });
  if (req.get('authorization') !== `Bearer ${token}`) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

export function createApp(db = openDb()) {
  const app = express();
  app.use(express.json());
  app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));

  app.get('/api/products', (req, res) => res.json(db.prepare('SELECT * FROM products').all()));
  app.get('/api/banners', (req, res) => res.json(db.prepare('SELECT * FROM banners WHERE active=1').all()));
  app.get('/api/couriers', (req, res) => res.json(supportedCouriers));

  // Themes: list is fixed, the store default is stored in settings.
  const defaultTheme = () => db.prepare("SELECT value FROM settings WHERE key='theme'").get()?.value || DEFAULT_THEME;
  app.get('/api/themes', (req, res) => res.json({ default: defaultTheme(), themes }));
  app.put('/api/themes/default', requireAdmin, (req, res) => {
    const id = req.body.id;
    if (!themes.some(t => t.id === id)) return res.status(400).json({ error: 'Unknown theme' });
    db.prepare("INSERT INTO settings(key,value) VALUES('theme',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(id);
    res.json({ default: id });
  });

  // Inventory: barcode scan adds stock; image recognition suggests a category.
  app.get('/api/barcode/:code', (req, res) => {
    const p = db.prepare('SELECT * FROM products WHERE barcode=?').get(req.params.code);
    p ? res.json(p) : res.status(404).json({ error: 'Not found' });
  });
  app.post('/api/inventory/scan', requireAdmin, (req, res) => {
    const { barcode, qty = 1 } = req.body;
    const r = db.prepare('UPDATE products SET stock=stock+? WHERE barcode=?').run(qty, barcode);
    if (!r.changes) return res.status(404).json({ error: 'Unknown barcode' });
    res.json(db.prepare('SELECT * FROM products WHERE barcode=?').get(barcode));
  });
  app.post('/api/inventory/recognize', requireAdmin, (req, res) => res.json(recognize(req.body.hint)));
  app.post('/api/products', requireAdmin, (req, res) => {
    const { name, price, barcode, category, stock = 0 } = req.body;
    const r = db.prepare('INSERT INTO products(name,price,barcode,category,image,stock) VALUES(?,?,?,?,?,?)').run(name, price, barcode, category || recognize(name).category, '', stock);
    const p = db.prepare('SELECT * FROM products WHERE id=?').get(r.lastInsertRowid);
    autoPost(db, p);
    res.status(201).json(p);
  });

  // Payment config: merchant IDs and mode (manual = customer pays your wallet, admin confirms).
  const cfg = m => db.prepare('SELECT * FROM payment_config WHERE method=?').get(m);
  app.get('/api/payments/methods', (req, res) => res.json([
    { method: 'cod', mode: 'cod' },
    ...db.prepare('SELECT * FROM payment_config').all().map(c => ({ method: c.method, mode: c.mode, account: c.merchant_id, account_title: c.account_title }))
  ]));
  app.put('/api/payments/config/:method', requireAdmin, (req, res) => {
    if (!cfg(req.params.method)) return res.status(404).json({ error: 'Unknown method' });
    const { merchant_id, account_title, mode } = req.body;
    if (mode !== undefined && !['manual', 'api'].includes(mode)) return res.status(400).json({ error: 'mode must be manual or api' });
    const c = cfg(req.params.method);
    db.prepare('UPDATE payment_config SET merchant_id=?, account_title=?, mode=? WHERE method=?').run(merchant_id ?? c.merchant_id, account_title ?? c.account_title, mode ?? c.mode, req.params.method);
    res.json(cfg(req.params.method));
  });
  app.post('/api/orders/:id/confirm-payment', requireAdmin, async (req, res) => {
    const o = db.prepare('SELECT * FROM orders WHERE id=?').get(Number(req.params.id));
    if (!o) return res.status(404).json({ error: 'Order not found' });
    if (o.status !== 'awaiting_payment') return res.status(409).json({ error: 'Order is not awaiting payment' });
    const ship = bookShipment({ orderId: o.id, city: o.city, courier: o.courier || undefined });
    db.prepare('UPDATE orders SET status=?, tracking=?, courier=? WHERE id=?').run('confirmed', ship.tracking, ship.courier, o.id);
    await sendMail(db, o.email, `Payment received for order #${o.id}`, `Thank you. Tracking ${ship.tracking} (${ship.courier}).${req.body.txn_ref ? ` Transaction ${req.body.txn_ref}.` : ''}`);
    res.json({ id: o.id, status: 'confirmed', shipment: ship });
  });

  app.post('/api/orders/:id/cancel', requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const o = db.prepare('SELECT * FROM orders WHERE id=?').get(id);
    if (!o) return res.status(404).json({ error: 'Order not found' });
    if (!cancelUnpaidOrder(db, id)) return res.status(409).json({ error: 'Only orders awaiting payment can be cancelled' });
    await sendMail(db, o.email, `Order #${id} cancelled`, 'Your order was cancelled because payment was not received.');
    res.json({ id, status: 'cancelled' });
  });

  // Wishlist
  app.get('/api/wishlist/:client', (req, res) => res.json(db.prepare('SELECT p.* FROM wishlist w JOIN products p ON p.id=w.product_id WHERE w.client=?').all(req.params.client)));
  app.post('/api/wishlist/:client/:pid', (req, res) => { db.prepare('INSERT OR IGNORE INTO wishlist VALUES(?,?)').run(req.params.client, Number(req.params.pid)); res.sendStatus(204); });
  app.delete('/api/wishlist/:client/:pid', (req, res) => { db.prepare('DELETE FROM wishlist WHERE client=? AND product_id=?').run(req.params.client, Number(req.params.pid)); res.sendStatus(204); });

  // Checkout
  app.post('/api/orders', async (req, res) => {
    try {
      const { email, address, city, items, method = 'cod', phone, courier } = req.body;
      const gw = gateways[method];
      if (!gw) return res.status(400).json({ error: 'Unsupported payment method' });
      if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Empty cart' });
      let total = 0;
      for (const it of items) {
        const p = db.prepare('SELECT * FROM products WHERE id=?').get(it.id);
        if (!p || p.stock < it.qty) return res.status(400).json({ error: `Insufficient stock for item ${it.id}` });
        total += p.price * it.qty;
      }
      const conf = cfg(method);
      const manual = conf && conf.mode === 'manual';
      const o = db.prepare('INSERT INTO orders(email,address,city,total,method,status,courier) VALUES(?,?,?,?,?,?,?)').run(email, address, city, total, method, 'pending', courier || null);
      const id = Number(o.lastInsertRowid);
      for (const it of items) {
        db.prepare('UPDATE products SET stock=stock-? WHERE id=?').run(it.qty, it.id);
        db.prepare('INSERT INTO order_items VALUES(?,?,?)').run(id, it.id, it.qty);
      }
      if (manual) {
        db.prepare('UPDATE orders SET status=? WHERE id=?').run('awaiting_payment', id);
        const instructions = `Please send Rs ${total} to ${method} account ${conf.merchant_id || '(not set)'}${conf.account_title ? ` (${conf.account_title})` : ''} and quote order #${id}. We ship once payment is confirmed.`;
        await sendMail(db, email, `Order #${id} awaiting payment`, instructions);
        return res.status(201).json({ id, total, status: 'awaiting_payment', instructions });
      }
      const pay = await gw.charge({ orderId: id, amount: total, phone, merchantId: conf?.merchant_id });
      const ship = bookShipment({ orderId: id, city, courier });
      db.prepare('UPDATE orders SET status=?, tracking=?, courier=? WHERE id=?').run('confirmed', ship.tracking, ship.courier, id);
      await sendMail(db, email, `Order #${id} confirmed`, `Total Rs ${total}. Payment ref ${pay.ref}. Tracking ${ship.tracking} (${ship.courier}).`);
      res.status(201).json({ id, total, payment: pay, shipment: ship });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // SEO
  app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n'));
  app.get('/sitemap.xml', (req, res) => {
    const urls = db.prepare('SELECT id FROM products').all().map(p => `<url><loc>/?product=${p.id}</loc></url>`).join('');
    res.type('application/xml').send(`<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>/</loc></url>${urls}</urlset>`);
  });
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = openDb();
  setInterval(() => expireUnpaidOrders(db), 60 * 60 * 1000).unref();
  createApp(db).listen(process.env.PORT || 3000, () => console.log('My Design running'));
}
