import nodemailer from 'nodemailer';

let transport;
function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  transport ||= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });
  return transport;
}

// Always records the email; sends it over SMTP when SMTP_HOST is set. Never throws.
export async function sendMail(db, to, subject, body) {
  const r = db.prepare('INSERT INTO emails(to_addr,subject,body) VALUES(?,?,?)').run(to, subject, body);
  const t = getTransport();
  if (!t) return { sent: false, reason: 'SMTP not configured' };
  try {
    await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text: body });
    return { sent: true, id: Number(r.lastInsertRowid) };
  } catch (e) {
    console.error('Email send failed:', e.message);
    return { sent: false, reason: e.message };
  }
}
