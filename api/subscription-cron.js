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

const FROM    = 'EZ Tech Solutions <info@ez-techgroup.com>';
const ADMIN   = 'info@ez-techgroup.com';

const fmtDate = isoStr => {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const daysUntil = isoStr => {
  const exp = new Date(isoStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((exp - now) / 86400000);
};

const clientEmail = ({ to, name, plan, expiration, days }) => {
  const expDate = fmtDate(expiration);
  let subject, urgency, headline, message;

  if (days <= 0) {
    subject  = `Your ${plan} subscription has expired — EZ Tech Solutions`;
    urgency  = '#ef4444';
    headline = 'Subscription Expired';
    message  = `Your <strong>${plan}</strong> subscription expired on <strong>${expDate}</strong>. Contact us to renew and restore your access immediately.`;
  } else if (days <= 2) {
    subject  = `⚠️ ${days} day${days !== 1 ? 's' : ''} left — Renew your ${plan} subscription`;
    urgency  = '#f59e0b';
    headline = `Only ${days} Day${days !== 1 ? 's' : ''} Left!`;
    message  = `Your <strong>${plan}</strong> subscription expires in <strong>${days} day${days !== 1 ? 's' : ''}</strong> on <strong>${expDate}</strong>. Renew now to avoid any interruption to your service.`;
  } else {
    subject  = `Your ${plan} subscription expires in ${days} days — EZ Tech Solutions`;
    urgency  = '#c9a227';
    headline = 'Subscription Expiring Soon';
    message  = `Your <strong>${plan}</strong> subscription expires on <strong>${expDate}</strong> (${days} days from now). Renew early to keep your service running without interruption.`;
  }

  return {
    from: FROM,
    to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#050d1a;color:#e8e0cc;padding:32px;border-radius:8px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
          <div style="background:linear-gradient(135deg,#1e3a5f,#0a1628);border:2px solid #c9a227;border-radius:50%;width:44px;height:44px;text-align:center;line-height:44px;font-weight:900;font-size:15px;color:#fff;">EZ</div>
          <div>
            <div style="font-size:16px;font-weight:900;color:#fff;letter-spacing:1px;">EZ TECH <span style="color:#c9a227;">SOLUTIONS</span></div>
            <div style="font-size:11px;color:#7788aa;letter-spacing:1px;">${headline.toUpperCase()}</div>
          </div>
        </div>

        <div style="background:rgba(201,162,39,.08);border-left:4px solid ${urgency};padding:16px 20px;border-radius:4px;margin-bottom:24px;">
          <p style="margin:0;font-size:15px;color:#e8e0cc;">Hi <strong style="color:#f0c040;">${name}</strong>,</p>
          <p style="margin:12px 0 0;font-size:14px;color:#c8bfa8;line-height:1.6;">${message}</p>
        </div>

        <div style="background:rgba(10,22,40,.8);border:1px solid rgba(201,162,39,.2);border-radius:6px;padding:20px;margin-bottom:24px;">
          <div style="font-size:11px;color:#c9a227;letter-spacing:1.5px;margin-bottom:12px;">SUBSCRIPTION DETAILS</div>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:6px 0;color:#7788aa;font-size:13px;width:100px;">Plan</td>
              <td style="padding:6px 0;font-weight:600;font-size:13px;">${plan}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#7788aa;font-size:13px;">Expires</td>
              <td style="padding:6px 0;font-weight:600;font-size:13px;color:${urgency};">${expDate}</td>
            </tr>
          </table>
        </div>

        <div style="background:rgba(37,211,102,.06);border:1px solid rgba(37,211,102,.2);border-radius:6px;padding:16px 20px;margin-bottom:24px;">
          <div style="font-size:11px;color:#25d366;letter-spacing:1.5px;margin-bottom:8px;">CONTACT US TO RENEW</div>
          <p style="margin:0 0 8px;font-size:13px;color:#c8bfa8;">Reach out and we'll get you renewed quickly:</p>
          <p style="margin:0 0 6px;font-size:14px;"><a href="https://wa.me/12428050777" style="color:#25d366;text-decoration:none;font-weight:600;">💬 WhatsApp: (242) 805-0777</a></p>
          <p style="margin:0 0 6px;font-size:14px;"><a href="tel:+12428050777" style="color:#c9a227;text-decoration:none;">📞 Call: (242) 805-0777</a></p>
          <p style="margin:0;font-size:14px;"><a href="mailto:info@ez-techgroup.com" style="color:#c9a227;text-decoration:none;">✉️ info@ez-techgroup.com</a></p>
        </div>

        <p style="margin:0;font-size:11px;color:#445566;text-align:center;">— EZ Tech Solutions · Your Ultimate Streaming Platform</p>
      </div>
    `,
  };
};

export default async function handler(req, res) {
  // Verify cron secret
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).end('Unauthorized');
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );

  // Fetch all active subscriptions
  const { data: subs, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('status', 'active');

  if (error) {
    console.error('subscription-cron fetch error:', error);
    return res.status(500).json({ error: error.message });
  }

  const sent7d      = [];
  const sent2d      = [];
  const sentExpired = [];
  const errors      = [];

  for (const sub of subs) {
    if (!sub.email) continue;

    const days = daysUntil(sub.expiration);

    try {
      // Expired
      if (days <= 0 && !sub.reminded_expired) {
        await transporter.sendMail(clientEmail({ to: sub.email, name: sub.name, plan: sub.plan, expiration: sub.expiration, days }));
        await supabase.from('subscriptions').update({ reminded_expired: true, status: 'expired' }).eq('id', sub.id);
        sentExpired.push(sub);
      }
      // 2-day warning
      else if (days > 0 && days <= 2 && !sub.reminded_2d) {
        await transporter.sendMail(clientEmail({ to: sub.email, name: sub.name, plan: sub.plan, expiration: sub.expiration, days }));
        await supabase.from('subscriptions').update({ reminded_2d: true }).eq('id', sub.id);
        sent2d.push(sub);
      }
      // 7-day warning
      else if (days > 2 && days <= 7 && !sub.reminded_7d) {
        await transporter.sendMail(clientEmail({ to: sub.email, name: sub.name, plan: sub.plan, expiration: sub.expiration, days }));
        await supabase.from('subscriptions').update({ reminded_7d: true }).eq('id', sub.id);
        sent7d.push(sub);
      }
    } catch (err) {
      console.error(`Failed reminder for ${sub.name}:`, err.message);
      errors.push({ name: sub.name, error: err.message });
    }
  }

  // Admin digest — send if anything happened today
  const totalSent = sent7d.length + sent2d.length + sentExpired.length;
  const upcomingAll = subs.filter(s => { const d = daysUntil(s.expiration); return d > 0 && d <= 14; })
    .sort((a, b) => new Date(a.expiration) - new Date(b.expiration));

  if (totalSent > 0 || upcomingAll.length > 0) {
    const rowStyle = 'padding:8px 10px;border-bottom:1px solid rgba(201,162,39,.1);font-size:13px;';

    const buildTable = (list, label, color) => {
      if (!list.length) return '';
      const rows = list.map(s => `
        <tr>
          <td style="${rowStyle}">${s.name}</td>
          <td style="${rowStyle}">${s.plan}</td>
          <td style="${rowStyle}color:${color};">${fmtDate(s.expiration)}</td>
          <td style="${rowStyle}">${s.phone || '—'}</td>
        </tr>
      `).join('');
      return `
        <div style="font-size:11px;color:${color};letter-spacing:1.5px;margin:20px 0 8px;">${label} (${list.length})</div>
        <table style="width:100%;border-collapse:collapse;background:rgba(10,22,40,.6);border-radius:4px;overflow:hidden;">
          <tr style="background:rgba(201,162,39,.08);">
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:#7788aa;font-weight:600;">Name</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:#7788aa;font-weight:600;">Plan</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:#7788aa;font-weight:600;">Expires</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:#7788aa;font-weight:600;">Phone</th>
          </tr>
          ${rows}
        </table>
      `;
    };

    await transporter.sendMail({
      from: FROM,
      to: ADMIN,
      subject: `📊 Subscription Reminders — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      html: `
        <div style="font-family:sans-serif;max-width:640px;margin:0 auto;background:#050d1a;color:#e8e0cc;padding:32px;border-radius:8px;">
          <div style="margin-bottom:24px;">
            <div style="font-size:18px;font-weight:900;color:#f0c040;letter-spacing:1px;">📊 Daily Subscription Report</div>
            <div style="font-size:12px;color:#7788aa;margin-top:4px;">${new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}</div>
          </div>

          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px;">
            ${[
              { l:'7-DAY REMINDERS', v:sent7d.length, c:'#c9a227' },
              { l:'2-DAY REMINDERS', v:sent2d.length, c:'#f59e0b' },
              { l:'EXPIRED TODAY',   v:sentExpired.length, c:'#ef4444' },
              { l:'UPCOMING (14D)',  v:upcomingAll.length, c:'#3b82f6' },
            ].map(s => `
              <div style="flex:1;min-width:110px;background:rgba(10,22,40,.8);border:1px solid rgba(201,162,39,.2);border-radius:6px;padding:14px 16px;">
                <div style="font-size:9px;color:#7788aa;letter-spacing:2px;margin-bottom:4px;">${s.l}</div>
                <div style="font-size:24px;font-weight:900;color:${s.c};">${s.v}</div>
              </div>
            `).join('')}
          </div>

          ${buildTable(sentExpired, 'EXPIRED TODAY', '#ef4444')}
          ${buildTable(sent2d,      '2-DAY REMINDERS SENT', '#f59e0b')}
          ${buildTable(sent7d,      '7-DAY REMINDERS SENT', '#c9a227')}
          ${buildTable(upcomingAll.filter(s => !sentExpired.includes(s) && !sent2d.includes(s) && !sent7d.includes(s)), 'UPCOMING EXPIRATIONS (NO EMAIL TODAY)', '#3b82f6')}

          ${errors.length > 0 ? `
            <div style="margin-top:20px;padding:12px 16px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:4px;">
              <div style="font-size:11px;color:#f87171;letter-spacing:1px;margin-bottom:6px;">⚠️ SEND ERRORS (${errors.length})</div>
              ${errors.map(e => `<div style="font-size:12px;color:#fca5a5;">${e.name}: ${e.error}</div>`).join('')}
            </div>
          ` : ''}

          <p style="margin-top:24px;font-size:11px;color:#445566;">Automated report from EZ Tech Solutions Subscription Manager.</p>
        </div>
      `,
    });
  }

  res.status(200).json({
    sent7d:      sent7d.length,
    sent2d:      sent2d.length,
    sentExpired: sentExpired.length,
    errors:      errors.length,
  });
}
