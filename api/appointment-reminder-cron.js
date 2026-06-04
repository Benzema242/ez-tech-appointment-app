import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'info@ez-techgroup.com',
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const FROM  = 'EZ Tech Solutions <info@ez-techgroup.com>';
const ADMIN = 'info@ez-techgroup.com';

const fmtDate = isoStr => {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
};

function reminderEmail(booking) {
  const serviceList = Array.isArray(booking.service) ? booking.service.join(', ') : (booking.service || '—');
  const durationLabel = booking.duration ? `${booking.duration} hour${booking.duration > 1 ? 's' : ''}` : '—';

  return {
    from: FROM,
    to: booking.email,
    subject: `🔔 Reminder: Your appointment is tomorrow — EZ Tech Solutions`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#050d1a;color:#e8e0cc;padding:32px;border-radius:8px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
          <div style="background:linear-gradient(135deg,#1e3a5f,#0a1628);border:2px solid #c9a227;border-radius:50%;width:44px;height:44px;text-align:center;line-height:44px;font-weight:900;font-size:15px;color:#fff;flex-shrink:0;">EZ</div>
          <div>
            <div style="font-size:16px;font-weight:900;color:#fff;letter-spacing:1px;">EZ TECH <span style="color:#c9a227;">SOLUTIONS</span></div>
            <div style="font-size:11px;color:#7788aa;letter-spacing:1px;">APPOINTMENT REMINDER</div>
          </div>
        </div>

        <div style="background:rgba(201,162,39,.08);border-left:4px solid #c9a227;padding:16px 20px;border-radius:4px;margin-bottom:24px;">
          <p style="margin:0;font-size:15px;color:#e8e0cc;">Hi <strong style="color:#f0c040;">${booking.client}</strong>,</p>
          <p style="margin:12px 0 0;font-size:14px;color:#c8bfa8;line-height:1.6;">
            This is a friendly reminder that your appointment with EZ Tech Solutions is <strong style="color:#f0c040;">tomorrow</strong>. We look forward to seeing you!
          </p>
        </div>

        <div style="background:rgba(10,22,40,.8);border:1px solid rgba(201,162,39,.2);border-radius:6px;padding:20px;margin-bottom:24px;">
          <div style="font-size:11px;color:#c9a227;letter-spacing:1.5px;margin-bottom:12px;">APPOINTMENT DETAILS</div>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:7px 0;color:#7788aa;font-size:13px;width:110px;">Service</td><td style="padding:7px 0;font-weight:600;font-size:13px;">${serviceList}</td></tr>
            <tr><td style="padding:7px 0;color:#7788aa;font-size:13px;">Date</td><td style="padding:7px 0;font-weight:600;font-size:13px;color:#f0c040;">${fmtDate(booking.date)}</td></tr>
            <tr><td style="padding:7px 0;color:#7788aa;font-size:13px;">Time</td><td style="padding:7px 0;font-weight:600;font-size:13px;">${booking.time} <span style="color:#556677;font-size:12px;">(Nassau time)</span></td></tr>
            <tr><td style="padding:7px 0;color:#7788aa;font-size:13px;">Duration</td><td style="padding:7px 0;font-size:13px;">${durationLabel}</td></tr>
            ${booking.notes ? `<tr><td style="padding:7px 0;color:#7788aa;font-size:13px;vertical-align:top;">Notes</td><td style="padding:7px 0;font-size:13px;">${booking.notes}</td></tr>` : ''}
          </table>
        </div>

        <div style="padding:16px 20px;background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.2);border-radius:6px;margin-bottom:24px;">
          <div style="font-size:11px;color:#f59e0b;letter-spacing:1.5px;margin-bottom:8px;">NEED TO RESCHEDULE?</div>
          <p style="margin:0 0 14px;font-size:13px;color:#c8bfa8;">Pick a new date and time and we'll review your request:</p>
          <a href="https://booking.eztechbahamas.com/?reschedule=${booking.id}" target="_blank"
            style="display:inline-block;padding:11px 24px;background:#f59e0b;color:#050d1a;text-decoration:none;border-radius:4px;font-size:13px;font-weight:700;letter-spacing:.5px;">
            🔄 Request a New Time
          </a>
        </div>

        <p style="margin:0;font-size:11px;color:#445566;text-align:center;">— EZ Tech Solutions · Providing Fast and Quality Services · Nassau, Bahamas</p>
      </div>
    `,
  };
}

export default async function handler(req, res) {
  // Verify cron secret
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).end('Unauthorized');
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );

  // Compute tomorrow in Nassau time (UTC-5)
  const now = new Date();
  const nassauNow = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const tomorrow = new Date(nassauNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  // Fetch approved bookings for tomorrow that haven't been reminded yet
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('date', tomorrowStr)
    .eq('status', 'approved')
    .not('email', 'is', null)
    .neq('email', '')
    .not('reminder_sent', 'eq', true);

  if (error) {
    console.error('appointment-reminder-cron fetch error:', error);
    return res.status(500).json({ error: error.message });
  }

  const sent   = [];
  const errors = [];

  for (const booking of bookings) {
    try {
      await transporter.sendMail(reminderEmail(booking));
      await supabase.from('bookings').update({ reminder_sent: true }).eq('id', booking.id);
      sent.push(booking);
    } catch (err) {
      console.error(`Reminder failed for ${booking.client}:`, err.message);
      errors.push({ name: booking.client, error: err.message });
    }
  }

  // Admin digest
  if (sent.length > 0 || errors.length > 0) {
    const rowStyle = 'padding:8px 10px;border-bottom:1px solid rgba(201,162,39,.1);font-size:13px;';
    const rows = sent.map(b => {
      const serviceList = Array.isArray(b.service) ? b.service.join(', ') : (b.service || '—');
      return `<tr>
        <td style="${rowStyle}">${b.client}</td>
        <td style="${rowStyle}">${serviceList}</td>
        <td style="${rowStyle}color:#f0c040;">${b.time}</td>
        <td style="${rowStyle}">${b.phone || '—'}</td>
      </tr>`;
    }).join('');

    await transporter.sendMail({
      from: FROM,
      to: ADMIN,
      subject: `📅 Appointment Reminders Sent — ${tomorrowStr}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#050d1a;color:#e8e0cc;padding:32px;border-radius:8px;">
          <div style="margin-bottom:24px;">
            <div style="font-size:18px;font-weight:900;color:#f0c040;letter-spacing:1px;">📅 Appointment Reminders</div>
            <div style="font-size:12px;color:#7788aa;margin-top:4px;">Sent for tomorrow — ${tomorrowStr}</div>
          </div>

          <div style="display:flex;gap:12px;margin-bottom:24px;">
            <div style="flex:1;background:rgba(10,22,40,.8);border:1px solid rgba(201,162,39,.2);border-radius:6px;padding:14px 16px;">
              <div style="font-size:9px;color:#7788aa;letter-spacing:2px;margin-bottom:4px;">REMINDERS SENT</div>
              <div style="font-size:28px;font-weight:900;color:#22c55e;">${sent.length}</div>
            </div>
            <div style="flex:1;background:rgba(10,22,40,.8);border:1px solid rgba(201,162,39,.2);border-radius:6px;padding:14px 16px;">
              <div style="font-size:9px;color:#7788aa;letter-spacing:2px;margin-bottom:4px;">ERRORS</div>
              <div style="font-size:28px;font-weight:900;color:${errors.length > 0 ? '#ef4444' : '#556677'};">${errors.length}</div>
            </div>
          </div>

          ${sent.length > 0 ? `
            <table style="width:100%;border-collapse:collapse;background:rgba(10,22,40,.6);border-radius:4px;overflow:hidden;margin-bottom:16px;">
              <tr style="background:rgba(201,162,39,.08);">
                <th style="padding:8px 10px;text-align:left;font-size:11px;color:#7788aa;font-weight:600;">Client</th>
                <th style="padding:8px 10px;text-align:left;font-size:11px;color:#7788aa;font-weight:600;">Service</th>
                <th style="padding:8px 10px;text-align:left;font-size:11px;color:#7788aa;font-weight:600;">Time</th>
                <th style="padding:8px 10px;text-align:left;font-size:11px;color:#7788aa;font-weight:600;">Phone</th>
              </tr>
              ${rows}
            </table>
          ` : ''}

          ${errors.length > 0 ? `
            <div style="padding:12px 16px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:4px;">
              <div style="font-size:11px;color:#f87171;letter-spacing:1px;margin-bottom:6px;">⚠️ SEND ERRORS</div>
              ${errors.map(e => `<div style="font-size:12px;color:#fca5a5;">${e.name}: ${e.error}</div>`).join('')}
            </div>
          ` : ''}

          <p style="margin-top:24px;font-size:11px;color:#445566;">Automated report from EZ Tech Solutions Booking Manager.</p>
        </div>
      `,
    }).catch(err => console.error('Admin digest failed:', err.message));
  }

  res.status(200).json({ sent: sent.length, errors: errors.length, date: tomorrowStr });
}
