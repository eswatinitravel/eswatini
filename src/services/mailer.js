// Stores outgoing mail in the emails table; replace send() with SMTP/SendGrid in production.
export function sendMail(db, to, subject, body) {
  db.prepare('INSERT INTO emails(to_addr,subject,body) VALUES(?,?,?)').run(to, subject, body);
}
