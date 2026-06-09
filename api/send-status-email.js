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
  reminder: {
    subject: 'Appointment Reminder — EZ Tech Solutions',
    headline: '🔔 Appointment Reminder',
    headlineColor: '#c9a227',
    message: 'This is a friendly reminder about your upcoming appointment with EZ Tech Solutions. See the details below.',
  },
  payment_due: {
    subject: 'Payment Due — Action Required | EZ Tech Solutions',
    headline: '💳 Payment Required',
    headlineColor: '#f59e0b',
    message: 'Your appointment is coming up and we have not yet received payment. Please make payment as soon as possible to secure your booking. Failure to pay may result in your appointment being cancelled.',
  },
};

function parseTimeToHM(timeStr) {
  const match = (timeStr || '').match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return { h: 0, m: 0 };
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  if (match[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return { h, m };
}

function buildGoogleCalUrl({ services, date, time, duration, notes }) {
  const serviceList = Array.isArray(services) ? services.join(', ') : services;
  const { h, m } = parseTimeToHM(time);
  const pad = n => String(n).padStart(2, '0');
  const [y, mo, d] = (date || '').split('-');
  const startStr = `${y}${mo}${d}T${pad(h)}${pad(m)}00`;
  const endDate = new Date(`${date}T${pad(h)}:${pad(m)}:00`);
  endDate.setHours(endDate.getHours() + (duration || 1));
  const endStr = `${endDate.getFullYear()}${pad(endDate.getMonth()+1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;
  const details = [`Services: ${serviceList}`, notes ? `Notes: ${notes}` : null, 'EZ Tech Solutions — (242) 805-0777'].filter(Boolean).join('\n');
  const params = new URLSearchParams({ action:'TEMPLATE', text:`EZ Tech Solutions — ${serviceList}`, dates:`${startStr}/${endStr}`, ctz:'America/Nassau', details, location:'Nassau, Bahamas' });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

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
          ${(status === 'approved' || status === 'reminder') ? `
          <div style="margin-top:24px;">
            <p style="margin:0 0 10px;font-size:12px;color:#7788aa;">Add this appointment to your calendar:</p>
            <a href="${buildGoogleCalUrl({ services, date, time, duration, notes })}" target="_blank"
              style="display:inline-block;padding:10px 20px;background:#c9a227;color:#050d1a;text-decoration:none;border-radius:4px;font-size:12px;font-weight:700;margin-right:8px;">
              📅 Google Calendar
            </a>
          </div>` : ''}
          ${status === 'payment_due' ? `
          <div style="margin-top:24px;padding:20px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.4);border-radius:6px;text-align:center;">
            <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#f59e0b;">⚠️ Payment Required to Secure Your Appointment</p>
            <p style="margin:0 0 16px;font-size:13px;color:#c8bfa8;">Please contact us immediately to complete your payment and avoid cancellation.</p>
            <a href="tel:+12428050777" style="display:inline-block;padding:12px 28px;background:#f59e0b;color:#050d1a;text-decoration:none;border-radius:4px;font-size:14px;font-weight:800;letter-spacing:1px;">
              📞 PAY NOW — CALL US
            </a>
            <p style="margin:12px 0 0;font-size:12px;color:#7788aa;">Or reply to this email to arrange payment</p>
          </div>` : ''}
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
