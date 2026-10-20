import { DatabaseSync } from 'node:sqlite';

export function openDb(file = process.env.DB_FILE || 'mydesign.db') {
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY, name TEXT, price INTEGER, barcode TEXT UNIQUE, category TEXT, image TEXT, stock INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY, email TEXT, address TEXT, city TEXT, total INTEGER, method TEXT, status TEXT, tracking TEXT, courier TEXT);
    CREATE TABLE IF NOT EXISTS wishlist(client TEXT, product_id INTEGER, PRIMARY KEY(client, product_id));
    CREATE TABLE IF NOT EXISTS emails(id INTEGER PRIMARY KEY, to_addr TEXT, subject TEXT, body TEXT);
    CREATE TABLE IF NOT EXISTS banners(id INTEGER PRIMARY KEY, text TEXT, active INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS social_posts(id INTEGER PRIMARY KEY, platform TEXT, text TEXT);
  `);
  if (db.prepare('SELECT COUNT(*) c FROM products').get().c === 0) {
    const ins = db.prepare('INSERT INTO products(name,price,barcode,category,image,stock) VALUES(?,?,?,?,?,?)');
    const seed = [['Aura Lamp', 4500, '1000000000011', 'lighting'], ['Linen Cushion', 1800, '1000000000028', 'decor'], ['Brass Vase', 3200, '1000000000035', 'decor'], ['Wall Art Print', 2500, '1000000000042', 'art'], ['Ceramic Mug Set', 2100, '1000000000059', 'kitchen'], ['Woven Rug', 9800, '1000000000066', 'decor'], ['Oak Shelf', 7400, '1000000000073', 'furniture'], ['Glass Candle', 1500, '1000000000080', 'lighting']];
    for (const [n, p, b, c] of seed) ins.run(n, p, b, c, '', 10);
    db.prepare('INSERT INTO banners(text) VALUES(?)').run('Eid Sale: 20% off all decor!');
  }
  return db;
}
