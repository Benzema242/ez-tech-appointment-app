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

const pad = n => String(n).padStart(2, '0');
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const fmtDate = isoStr => {
  if (!isoStr) return '—';
  const d = new Date(isoStr + (isoStr.length === 10 ? 'T12:00:00' : ''));
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const nassauNow = () => {
  const now = new Date();
  return new Date(now.getTime() - 5 * 60 * 60 * 1000);
};

const dateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).end('Unauthorized');
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );

  const now    = nassauNow();
  const today  = dateStr(now);
  const plus7  = new Date(now); plus7.setDate(plus7.getDate() + 7);
  const plus7s = dateStr(plus7);
  const minus7 = new Date(now); minus7.setDate(minus7.getDate() - 7);
  const minus7s = new Date(minus7).toISOString();

  // ── Fetch data ────────────────────────────────────────────────────────────
  const [
    { data: upcomingBookings },
    { data: newBookings },
    { data: paidBookings },
    { data: expiringSubs },
    { data: newSubs },
    { data: allActiveSubs },
  ] = await Promise.all([
    // Approved/pending bookings in the next 7 days
    supabase.from('bookings')
      .select('client, date, time, service, status, phone')
      .in('status', ['approved', 'pending', 'scheduled_call'])
      .gte('date', today)
      .lte('date', plus7s)
      .order('date', { ascending: true }),

    // New bookings created in the last 7 days
    supabase.from('bookings')
      .select('id, client, status, created_at')
      .gte('created_at', minus7s),

    // Paid bookings with price this week (revenue)
    supabase.from('bookings')
      .select('price, date')
      .eq('paid', true)
      .gte('date', dateStr(minus7))
      .lte('date', today),

    // Active subscriptions expiring in next 7 days
    supabase.from('subscriptions')
      .select('name, plan, expiration, phone, price')
      .eq('status', 'active')
      .gte('expiration', new Date(today + 'T00:00:00').toISOString())
      .lte('expiration', new Date(plus7s + 'T23:59:59').toISOString())
      .order('expiration', { ascending: true }),

    // New subscriptions added in last 7 days
    supabase.from('subscriptions')
      .select('id, name, plan, price')
      .gte('created_at', minus7s),

    // All active subs for total count
    supabase.from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
  ]);

  const upcoming   = upcomingBookings   || [];
  const newBks     = newBookings        || [];
  const paid       = paidBookings       || [];
  const expiring   = expiringSubs       || [];
  const newSubsArr = newSubs            || [];

  const bookingRevenue = paid.reduce((s, b) => s + (b.price || 0), 0);
  const subRevenue     = newSubsArr.reduce((s, b) => s + (b.price || 0), 0);
  const activeCount    = allActiveSubs?.length ?? 0;

  const STATUS_COLOR = { approved:'#22c55e', pending:'#f59e0b', scheduled_call:'#3b82f6' };
  const STATUS_LABEL = { approved:'Approved', pending:'Pending', scheduled_call:'Call Scheduled' };

  const svcStr = svc => Array.isArray(svc) ? svc.join(', ') : (svc || '—');

  const weekLabel = `${fmtDate(today)} — ${fmtDate(plus7s)}`;

  // ── Build email ───────────────────────────────────────────────────────────
  const bookingRows = upcoming.length > 0
    ? upcoming.map(b => {
        const color = STATUS_COLOR[b.status] || '#7788aa';
        const label = STATUS_LABEL[b.status] || b.status;
        return `<tr>
          <td style="padding:8px 10px;font-size:13px;border-bottom:1px solid rgba(201,162,39,.07);color:#e8e0cc;font-weight:600;">${b.client}</td>
          <td style="padding:8px 10px;font-size:13px;border-bottom:1px solid rgba(201,162,39,.07);color:#c9a227;">${fmtDate(b.date)}</td>
          <td style="padding:8px 10px;font-size:13px;border-bottom:1px solid rgba(201,162,39,.07);color:#7788aa;">${b.time}</td>
          <td style="padding:8px 10px;font-size:13px;border-bottom:1px solid rgba(201,162,39,.07);color:#7788aa;">${svcStr(b.service)}</td>
          <td style="padding:8px 10px;font-size:13px;border-bottom:1px solid rgba(201,162,39,.07);color:${color};font-weight:700;">${label}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="5" style="padding:16px;text-align:center;color:#445566;font-style:italic;">No upcoming bookings this week</td></tr>`;

  const expiringRows = expiring.length > 0
    ? expiring.map(s => {
        const days = Math.ceil((new Date(s.expiration) - new Date()) / 86400000);
        const color = days <= 2 ? '#ef4444' : days <= 4 ? '#f59e0b' : '#22c55e';
        return `<tr>
          <td style="padding:8px 10px;font-size:13px;border-bottom:1px solid rgba(201,162,39,.07);color:#e8e0cc;font-weight:600;">${s.name}</td>
          <td style="padding:8px 10px;font-size:13px;border-bottom:1px solid rgba(201,162,39,.07);color:#60a5fa;">${s.plan}</td>
          <td style="padding:8px 10px;font-size:13px;border-bottom:1px solid rgba(201,162,39,.07);color:#c9a227;">$${s.price}</td>
          <td style="padding:8px 10px;font-size:13px;border-bottom:1px solid rgba(201,162,39,.07);color:${color};font-weight:700;">${days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="4" style="padding:16px;text-align:center;color:#445566;font-style:italic;">No subscriptions expiring this week</td></tr>`;

  const html = `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto;background:#050d1a;color:#e8e0cc;padding:32px;border-radius:8px;">

      <!-- Header -->
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid rgba(201,162,39,.2);">
        <div>
          <div style="font-size:22px;font-weight:900;color:#f0c040;letter-spacing:2px;">EZ TECH <span style="color:#c9a227;">WEEKLY</span></div>
          <div style="font-size:12px;color:#7788aa;letter-spacing:1px;margin-top:3px;">${weekLabel}</div>
        </div>
      </div>

      <!-- Summary stat cards -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px;">
        <div style="background:rgba(10,22,40,.8);border:1px solid rgba(34,197,94,.2);border-radius:6px;padding:14px 16px;">
          <div style="font-size:10px;color:#7788aa;letter-spacing:2px;margin-bottom:6px;">UPCOMING BOOKINGS</div>
          <div style="font-size:28px;font-weight:900;color:#22c55e;">${upcoming.length}</div>
        </div>
        <div style="background:rgba(10,22,40,.8);border:1px solid rgba(201,162,39,.2);border-radius:6px;padding:14px 16px;">
          <div style="font-size:10px;color:#7788aa;letter-spacing:2px;margin-bottom:6px;">BOOKING REVENUE</div>
          <div style="font-size:28px;font-weight:900;color:#c9a227;">$${bookingRevenue}</div>
          <div style="font-size:11px;color:#556677;margin-top:3px;">${paid.length} paid booking${paid.length !== 1 ? 's' : ''}</div>
        </div>
        <div style="background:rgba(10,22,40,.8);border:1px solid rgba(167,139,250,.2);border-radius:6px;padding:14px 16px;">
          <div style="font-size:10px;color:#7788aa;letter-spacing:2px;margin-bottom:6px;">ACTIVE SUBS</div>
          <div style="font-size:28px;font-weight:900;color:#a78bfa;">${activeCount}</div>
          ${newSubsArr.length > 0 ? `<div style="font-size:11px;color:#556677;margin-top:3px;">+${newSubsArr.length} new this week</div>` : ''}
        </div>
      </div>

      ${newBks.length > 0 ? `
      <div style="background:rgba(201,162,39,.06);border:1px solid rgba(201,162,39,.15);border-radius:4px;padding:10px 14px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:13px;color:#c8bfa8;">📋 <strong style="color:#f0c040;">${newBks.length}</strong> new booking${newBks.length !== 1 ? 's' : ''} received this week</span>
        <span style="font-size:13px;color:#22c55e;font-weight:700;">$${subRevenue > 0 ? `${subRevenue} sub revenue` : ''}</span>
      </div>` : ''}

      <!-- Upcoming bookings -->
      <div style="margin-bottom:28px;">
        <div style="font-size:12px;color:#c9a227;letter-spacing:1.5px;font-weight:700;margin-bottom:10px;">📅 UPCOMING BOOKINGS — NEXT 7 DAYS</div>
        <div style="background:rgba(10,22,40,.6);border-radius:4px;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;">
            <tr style="background:rgba(201,162,39,.08);">
              <th style="padding:8px 10px;text-align:left;font-size:11px;color:#7788aa;font-weight:600;">Client</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;color:#7788aa;font-weight:600;">Date</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;color:#7788aa;font-weight:600;">Time</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;color:#7788aa;font-weight:600;">Service</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;color:#7788aa;font-weight:600;">Status</th>
            </tr>
            ${bookingRows}
          </table>
        </div>
      </div>

      <!-- Expiring subscriptions -->
      <div style="margin-bottom:28px;">
        <div style="font-size:12px;color:#c9a227;letter-spacing:1.5px;font-weight:700;margin-bottom:10px;">⚠️ SUBSCRIPTIONS EXPIRING THIS WEEK</div>
        <div style="background:rgba(10,22,40,.6);border-radius:4px;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;">
            <tr style="background:rgba(201,162,39,.08);">
              <th style="padding:8px 10px;text-align:left;font-size:11px;color:#7788aa;font-weight:600;">Client</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;color:#7788aa;font-weight:600;">Plan</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;color:#7788aa;font-weight:600;">Value</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;color:#7788aa;font-weight:600;">Expires</th>
            </tr>
            ${expiringRows}
          </table>
        </div>
        ${expiring.length > 0 ? `<div style="margin-top:8px;font-size:12px;color:#f59e0b;">💬 Send renewal reminders via WhatsApp or from the subscription dashboard.</div>` : ''}
      </div>

      <p style="margin:0;font-size:11px;color:#445566;border-top:1px solid rgba(255,255,255,.05);padding-top:16px;">
        Automated weekly digest — EZ Tech Solutions Booking &amp; Subscription Manager · Every Monday 8am Nassau
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: FROM,
      to: ADMIN,
      subject: `📅 Weekly Digest — ${fmtDate(today)}`,
      html,
    });
    res.status(200).json({ ok: true, bookings: upcoming.length, expiring: expiring.length });
  } catch (err) {
    console.error('weekly-digest error:', err);
    res.status(500).json({ error: err.message });
  }
}
