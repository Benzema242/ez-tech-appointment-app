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

const FROM        = 'EZ Tech Solutions <info@ez-techgroup.com>';
const ADMIN_EMAIL = 'info@ez-techgroup.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { booking, changes } = req.body;
  if (!booking || !changes?.length) return res.status(200).json({ ok: true, skipped: 'no changes' });

  const serviceList = Array.isArray(booking.service) ? booking.service.join(', ') : (booking.service || '—');
  const summary     = changes.map(c => c.field).join(', ');

  const changeRows = changes.map(c => `
    <tr>
      <td style="padding:8px 10px;color:#7788aa;font-size:13px;border-bottom:1px solid rgba(255,255,255,.05);white-space:nowrap;">${c.field}</td>
      <td style="padding:8px 10px;font-size:13px;color:#f87171;border-bottom:1px solid rgba(255,255,255,.05);">${c.from ?? '—'}</td>
      <td style="padding:8px 10px;font-size:13px;color:#34d399;border-bottom:1px solid rgba(255,255,255,.05);">${c.to ?? '—'}</td>
    </tr>`).join('');

  try {
    await transporter.sendMail({
      from: FROM,
      to: ADMIN_EMAIL,
      subject: `🔔 Booking Updated: ${booking.client} — ${summary}`,
      html: `
        <div style="font-family:sans-serif;max-width:580px;margin:0 auto;background:#050d1a;color:#e8e0cc;padding:32px;border-radius:8px;">
          <div style="display:inline-block;padding:4px 10px;background:rgba(201,162,39,.12);border:1px solid rgba(201,162,39,.35);border-radius:4px;font-size:11px;letter-spacing:1.5px;color:#c9a227;margin-bottom:16px;">🔔 BOOKING UPDATED</div>
          <h2 style="color:#f0c040;margin:0 0 4px;">${booking.client}</h2>
          <p style="color:#7788aa;margin:0 0 24px;font-size:13px;">${serviceList} · ${booking.date} at ${booking.time}</p>

          <div style="background:rgba(10,22,40,.8);border:1px solid rgba(201,162,39,.2);border-radius:6px;overflow:hidden;margin-bottom:24px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr style="background:rgba(201,162,39,.08);">
                <th style="padding:8px 10px;text-align:left;font-size:11px;color:#7788aa;letter-spacing:1px;">FIELD</th>
                <th style="padding:8px 10px;text-align:left;font-size:11px;color:#f87171;letter-spacing:1px;">FROM</th>
                <th style="padding:8px 10px;text-align:left;font-size:11px;color:#34d399;letter-spacing:1px;">TO</th>
              </tr>
              ${changeRows}
            </table>
          </div>

          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:7px 0;color:#7788aa;font-size:13px;width:110px;">Phone</td><td style="padding:7px 0;font-size:13px;">${booking.phone || '—'}</td></tr>
            <tr><td style="padding:7px 0;color:#7788aa;font-size:13px;">Email</td><td style="padding:7px 0;font-size:13px;">${booking.email || '—'}</td></tr>
            <tr><td style="padding:7px 0;color:#7788aa;font-size:13px;">Status</td><td style="padding:7px 0;font-size:13px;text-transform:capitalize;">${booking.status || '—'}</td></tr>
          </table>

          <p style="margin-top:24px;font-size:11px;color:#445566;">— EZ Tech Solutions Admin · Automated change notification from the booking dashboard</p>
        </div>
      `,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-admin-change-email error:', err);
    res.status(500).json({ error: err.message });
  }
}
