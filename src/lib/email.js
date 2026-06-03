import nodemailer from 'nodemailer'

// Wysylka maili przez firmowy serwer SMTP.
// Dane konfiguracji w zmiennych srodowiskowych SMTP_*.
export async function sendEmail(to, subject, html) {
  const port = Number(process.env.SMTP_PORT) || 587

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  })
}
