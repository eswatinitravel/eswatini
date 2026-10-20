import test from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/server.js';
import { openDb } from '../src/db.js';

test('catalog, wishlist, scan, checkout', async () => {
  const db = openDb(':memory:');
  const srv = createApp(db).listen(0);
  const base = `http://localhost:${srv.address().port}`;
  const j = (u, o) => fetch(base + u, o).then(async r => ({ s: r.status, b: r.status === 204 ? null : await r.json() }));
  const post = (u, b) => j(u, { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(b) });
  try {
    const prods = (await j('/api/products')).b;
    assert.ok(prods.length >= 8);
    await j('/api/wishlist/c1/1', { method: 'POST' });
    assert.equal((await j('/api/wishlist/c1')).b.length, 1);
    assert.equal((await post('/api/inventory/scan', { barcode: prods[0].barcode, qty: 5 })).b.stock, 15);
    assert.equal((await post('/api/inventory/recognize', { hint: 'blue vase' })).b.category, 'decor');
    const o = await post('/api/orders', { email: 'a@b.pk', address: 'x', city: 'Lahore', method: 'easypaisa', courier: 'leopards', items: [{ id: 1, qty: 2 }] });
    assert.equal(o.s, 201);
    assert.equal(o.b.total, 9000);
    assert.equal(db.prepare('SELECT COUNT(*) c FROM emails').get().c, 1);
    assert.equal((await post('/api/orders', { email: 'a', items: [{ id: 1, qty: 999 }] })).s, 400);
    assert.equal((await post('/api/products', { name: 'Test Lamp', price: 1, barcode: 'zz' })).b.category, 'lighting');
    assert.equal(db.prepare('SELECT COUNT(*) c FROM social_posts').get().c, 2);
  } finally { srv.close(); }
});
