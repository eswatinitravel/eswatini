export function autoPost(db, product) {
  const text = `New at My Design: ${product.name} for Rs ${product.price}! #MyDesign #Pakistan`;
  for (const platform of ['facebook', 'instagram']) db.prepare('INSERT INTO social_posts(platform,text) VALUES(?,?)').run(platform, text);
  return text;
}
