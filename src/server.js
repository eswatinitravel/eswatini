import express from 'express';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { gateways } from './services/payments.js';
import { bookShipment, supportedCouriers } from './services/courier.js';
import { sendMail } from './services/mailer.js';
import { recognize } from './services/vision.js';
import { autoPost } from './services/social.js';

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
      const o = db.prepare('INSERT INTO orders(email,address,city,total,method,status) VALUES(?,?,?,?,?,?)').run(email, address, city, total, method, 'pending');
      const id = Number(o.lastInsertRowid);
      const pay = await gw.charge({ orderId: id, amount: total, phone });
      const ship = bookShipment({ orderId: id, city, courier });
      for (const it of items) db.prepare('UPDATE products SET stock=stock-? WHERE id=?').run(it.qty, it.id);
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
  createApp().listen(process.env.PORT || 3000, () => console.log('My Design running'));
}
