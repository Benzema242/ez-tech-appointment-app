import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'info@ez-techgroup.com',
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const FROM = 'EZ Tech Solutions <info@ez-techgroup.com>';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { name, email, phone, message } = req.body;

  try {
    await transporter.sendMail({
      from: FROM,
      to: 'info@ez-techgroup.com',
      subject: `New Contact Message — ${name}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#050d1a;color:#e8e0cc;padding:32px;border-radius:8px;">
          <h2 style="color:#c9a227;margin:0 0 20px;">New Contact Form Message</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#7788aa;width:120px;">Name</td><td style="padding:8px 0;font-weight:600;">${name}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Email</td><td style="padding:8px 0;">${email || 'Not provided'}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Phone</td><td style="padding:8px 0;">${phone || 'Not provided'}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;vertical-align:top;">Message</td><td style="padding:8px 0;">${message}</td></tr>
          </table>
        </div>
      `,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Contact email error:', err);
    res.status(500).json({ error: err.message });
  }
}
