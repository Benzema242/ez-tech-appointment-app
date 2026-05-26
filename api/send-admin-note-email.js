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
const ADMIN_EMAIL = 'info@ez-techgroup.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { client, phone, email, services, date, time, duration, status, note } = req.body;

  if (!note) return res.status(400).json({ error: 'note is required' });

  const serviceList = Array.isArray(services) ? services.join(', ') : (services || '—');
  const durationLabel = `${duration || 1} hour${(duration || 1) > 1 ? 's' : ''}`;

  try {
    await transporter.sendMail({
      from: FROM,
      to: ADMIN_EMAIL,
      subject: `Admin Note — ${client} · ${date}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#050d1a;color:#e8e0cc;padding:32px;border-radius:8px;">
          <div style="display:inline-block;padding:4px 10px;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.35);border-radius:4px;font-size:11px;letter-spacing:1.5px;color:#f87171;margin-bottom:16px;">🔒 ADMIN ONLY</div>
          <h2 style="color:#f0c040;margin:0 0 6px;">Booking Note — ${client}</h2>
          <p style="color:#7788aa;margin:0 0 24px;font-size:14px;">An internal note has been saved for this booking.</p>

          <div style="padding:16px;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.3);border-radius:6px;margin-bottom:24px;">
            <div style="font-size:11px;letter-spacing:1.5px;color:#f87171;margin-bottom:8px;">ADMIN NOTE</div>
            <div style="font-size:15px;color:#e8e0cc;line-height:1.6;white-space:pre-wrap;">${note}</div>
          </div>

          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#7788aa;width:120px;">Client</td><td style="padding:8px 0;font-weight:600;">${client}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Phone</td><td style="padding:8px 0;">${phone || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Email</td><td style="padding:8px 0;">${email || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Services</td><td style="padding:8px 0;">${serviceList}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Date</td><td style="padding:8px 0;">${date}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Time</td><td style="padding:8px 0;">${time} (Nassau time)</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Duration</td><td style="padding:8px 0;">${durationLabel}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Status</td><td style="padding:8px 0;text-transform:capitalize;">${status || '—'}</td></tr>
          </table>

          <p style="margin-top:24px;font-size:11px;color:#445566;">— EZ Tech Solutions Admin · This email was generated from the booking dashboard</p>
        </div>
      `,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-admin-note-email error:', err);
    res.status(500).json({ error: err.message });
  }
}
