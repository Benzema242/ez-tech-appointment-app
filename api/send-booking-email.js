import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = 'EZ Tech Solutions <noreply@ez-techgroup.com>';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { name, email, phone, services, date, time, notes } = req.body;

  const serviceList = Array.isArray(services) ? services.join(', ') : services;

  try {
    // Admin notification
    await resend.emails.send({
      from: FROM,
      to: 'info@ez-techgroup.com',
      subject: `New Booking — ${name}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#050d1a;color:#e8e0cc;padding:32px;border-radius:8px;">
          <h2 style="color:#c9a227;margin:0 0 20px;">New Booking Request</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#7788aa;width:120px;">Client</td><td style="padding:8px 0;font-weight:600;">${name}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Phone</td><td style="padding:8px 0;">${phone}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Email</td><td style="padding:8px 0;">${email || 'Not provided'}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Services</td><td style="padding:8px 0;">${serviceList}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Date</td><td style="padding:8px 0;">${date}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Time</td><td style="padding:8px 0;">${time}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Notes</td><td style="padding:8px 0;">${notes || 'None'}</td></tr>
          </table>
          <p style="margin-top:24px;font-size:12px;color:#556677;">Login to your admin dashboard to approve or manage this booking.</p>
        </div>
      `,
    });

    // Client confirmation (only if email provided)
    if (email) {
      await resend.emails.send({
        from: FROM,
        to: email,
        subject: 'Booking Confirmation — EZ Tech Solutions',
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#050d1a;color:#e8e0cc;padding:32px;border-radius:8px;">
            <h2 style="color:#c9a227;margin:0 0 8px;">Booking Received!</h2>
            <p style="color:#8899aa;margin:0 0 24px;">Hi ${name}, we've received your request.</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:8px 0;color:#7788aa;width:120px;">Services</td><td style="padding:8px 0;font-weight:600;">${serviceList}</td></tr>
              <tr><td style="padding:8px 0;color:#7788aa;">Date</td><td style="padding:8px 0;">${date}</td></tr>
              <tr><td style="padding:8px 0;color:#7788aa;">Time</td><td style="padding:8px 0;">${time}</td></tr>
            </table>
            <div style="margin-top:24px;padding:16px;background:rgba(201,162,39,.08);border:1px solid rgba(201,162,39,.2);border-radius:6px;">
              <p style="margin:0;font-size:13px;color:#c8bfa8;">Our team will review your request and contact you at <strong>${phone}</strong> to confirm. Questions? Reach us at:</p>
              <p style="margin:10px 0 0;font-size:13px;color:#c9a227;">📞 (242) 805-0777 &nbsp;·&nbsp; ✉️ info@ez-techgroup.com</p>
            </div>
            <p style="margin-top:24px;font-size:11px;color:#445566;">— EZ Tech Solutions · Providing Fast and Quality Services</p>
          </div>
        `,
      });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-booking-email error:', err);
    res.status(500).json({ error: err.message });
  }
}
