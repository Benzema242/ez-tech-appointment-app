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

const STATUS_CONFIG = {
  approved: {
    subject: 'Your Booking is Confirmed — EZ Tech Solutions',
    headline: '✅ Booking Approved!',
    headlineColor: '#22c55e',
    message: 'Great news! Your booking has been approved. See your confirmed details below.',
  },
  scheduled_call: {
    subject: 'We\'d Like to Schedule a Call — EZ Tech Solutions',
    headline: '📞 Call Scheduled',
    headlineColor: '#3b82f6',
    message: 'We\'d like to discuss your booking before confirming. We\'ll be reaching out to you at the number on file.',
  },
  denied: {
    subject: 'Update on Your Booking — EZ Tech Solutions',
    headline: '❌ Booking Update',
    headlineColor: '#ef4444',
    message: 'Unfortunately we\'re unable to accommodate your request at this time. Please contact us to discuss alternatives or rebook.',
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { status, name, email, phone, services, date, time, duration, notes } = req.body;

  if (!email) return res.status(200).json({ ok: true, skipped: 'no email' });

  const config = STATUS_CONFIG[status];
  if (!config) return res.status(200).json({ ok: true, skipped: 'no email for this status' });

  const serviceList = Array.isArray(services) ? services.join(', ') : services;
  const durationLabel = duration ? `${duration} hour${duration > 1 ? 's' : ''}` : '—';

  try {
    await transporter.sendMail({
      from: FROM,
      to: email,
      subject: config.subject,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#050d1a;color:#e8e0cc;padding:32px;border-radius:8px;">
          <h2 style="color:${config.headlineColor};margin:0 0 8px;">${config.headline}</h2>
          <p style="color:#8899aa;margin:0 0 24px;">Hi ${name}, ${config.message}</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#7788aa;width:120px;">Services</td><td style="padding:8px 0;font-weight:600;">${serviceList}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Date</td><td style="padding:8px 0;">${date}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Start Time</td><td style="padding:8px 0;">${time} (Nassau time)</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Duration</td><td style="padding:8px 0;">${durationLabel}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Phone</td><td style="padding:8px 0;">${phone}</td></tr>
            ${notes ? `<tr><td style="padding:8px 0;color:#7788aa;vertical-align:top;">Notes</td><td style="padding:8px 0;">${notes}</td></tr>` : ''}
          </table>
          <div style="margin-top:24px;padding:16px;background:rgba(201,162,39,.08);border:1px solid rgba(201,162,39,.2);border-radius:6px;">
            <p style="margin:0;font-size:13px;color:#c8bfa8;">Questions? Get in touch with us directly:</p>
            <p style="margin:10px 0 0;font-size:13px;color:#c9a227;">📞 (242) 805-0777 &nbsp;·&nbsp; ✉️ info@ez-techgroup.com</p>
          </div>
          <p style="margin-top:24px;font-size:11px;color:#445566;">— EZ Tech Solutions · Providing Fast and Quality Services</p>
        </div>
      `,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-status-email error:', err);
    res.status(500).json({ error: err.message });
  }
}
