import nodemailer from 'nodemailer';

let transporter;
function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export async function sendEmail({ to, subject, text }) {
  const mailer = getTransporter();
  if (!mailer || !to) return false;
  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || 'MentorHub <no-reply@example.com>',
      to,
      subject,
      text,
    });
    return true;
  } catch (error) {
    console.error('No se pudo enviar el correo:', error.message);
    return false;
  }
}
