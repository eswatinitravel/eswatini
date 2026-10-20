import test from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/server.js';
import { openDb } from '../src/db.js';

process.env.ADMIN_TOKEN = 'secret';
test('catalog, wishlist, scan, checkout', async () => {
  const db = openDb(':memory:');
  const srv = createApp(db).listen(0);
  const base = `http://localhost:${srv.address().port}`;
  const j = (u, o) => fetch(base + u, o).then(async r => ({ s: r.status, b: r.status === 204 ? null : await r.json() }));
  const post = (u, b, auth = true) => j(u, { method: 'POST', headers: { 'content-type': 'application/json', ...(auth && { authorization: 'Bearer secret' }) }, body: JSON.stringify(b) });
  try {
    const prods = (await j('/api/products')).b;
    assert.ok(prods.length >= 8);
    await j('/api/wishlist/c1/1', { method: 'POST' });
    assert.equal((await j('/api/wishlist/c1')).b.length, 1);
    assert.equal((await post('/api/inventory/scan', { barcode: prods[0].barcode, qty: 5 })).b.stock, 15);
    assert.equal((await post('/api/inventory/recognize', { hint: 'blue vase' })).b.category, 'decor');
    assert.equal((await post('/api/inventory/scan', { barcode: 'x' }, false)).s, 401);
    const th = (await j('/api/themes')).b;
    assert.equal(th.themes.length, 10);
    assert.equal(th.default, 'dark-midnight');
    assert.equal((await j('/api/themes/default', { method: 'PUT', headers: { 'content-type': 'application/json', authorization: 'Bearer secret' }, body: JSON.stringify({ id: 'light-sky' }) })).s, 200);
    assert.equal((await j('/api/themes')).b.default, 'light-sky');
    assert.equal((await j('/api/themes/default', { method: 'PUT', headers: { 'content-type': 'application/json', authorization: 'Bearer secret' }, body: JSON.stringify({ id: 'nope' }) })).s, 400);
    const o = await post('/api/orders', { email: 'a@b.pk', address: 'x', city: 'Lahore', method: 'easypaisa', courier: 'leopards', items: [{ id: 1, qty: 2 }] });
    assert.equal(o.s, 201);
    assert.equal(o.b.total, 9000);
    assert.equal(db.prepare('SELECT COUNT(*) c FROM emails').get().c, 1);
    // Payment config: manual mode (default) holds the order until an admin confirms payment.
    const put = (u, b, auth = true) => j(u, { method: 'PUT', headers: { 'content-type': 'application/json', ...(auth && { authorization: 'Bearer secret' }) }, body: JSON.stringify(b) });
    assert.equal((await put('/api/payments/config/jazzcash', { merchant_id: '0300' }, false)).s, 401);
    assert.equal((await put('/api/payments/config/jazzcash', { mode: 'bad' })).s, 400);
    assert.equal((await put('/api/payments/config/nope', {})).s, 404);
    await put('/api/payments/config/jazzcash', { merchant_id: '03001234567', account_title: 'My Design' });
    const methods = (await j('/api/payments/methods')).b;
    assert.equal(methods.find(m => m.method === 'jazzcash').account, '03001234567');
    const mo = await post('/api/orders', { email: 'm@b.pk', address: 'x', city: 'Karachi', method: 'jazzcash', items: [{ id: 2, qty: 1 }] });
    assert.equal(mo.b.status, 'awaiting_payment');
    assert.match(mo.b.instructions, /03001234567/);
    assert.equal((await post(`/api/orders/${mo.b.id}/confirm-payment`, {}, false)).s, 401);
    const cp = await post(`/api/orders/${mo.b.id}/confirm-payment`, { txn_ref: 'T1' });
    assert.equal(cp.b.status, 'confirmed');
    assert.equal((await post(`/api/orders/${mo.b.id}/confirm-payment`, {})).s, 409);
    // api mode charges immediately (sandbox)
    await put('/api/payments/config/jazzcash', { mode: 'api' });
    const ao = await post('/api/orders', { email: 'm@b.pk', address: 'x', city: 'Karachi', method: 'jazzcash', items: [{ id: 2, qty: 1 }] });
    assert.equal(ao.b.shipment.courier, 'tcs');
    assert.match(ao.b.payment.ref, /^JC-/);
    assert.equal((await post('/api/orders', { email: 'a', items: [{ id: 1, qty: 999 }] })).s, 400);
    assert.equal((await post('/api/products', { name: 'Test Lamp', price: 1, barcode: 'zz' })).b.category, 'lighting');
    assert.equal(db.prepare('SELECT COUNT(*) c FROM social_posts').get().c, 2);
  } finally { srv.close(); }
});
