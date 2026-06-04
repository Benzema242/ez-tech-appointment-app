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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { id, date, time } = req.body;
  if (!id || !date || !time) return res.status(400).json({ error: 'Missing fields' });

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );

  // Fetch existing booking
  const { data: booking, error: fetchErr } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !booking) return res.status(404).json({ error: 'Booking not found' });

  // Deny rescheduling for cancelled/denied bookings
  if (booking.status === 'cancelled' || booking.status === 'denied') {
    return res.status(400).json({ error: 'This booking cannot be rescheduled' });
  }

  const oldDate = booking.date;
  const oldTime = booking.time;
  const rescheduleNote = `Rescheduled from ${oldDate} at ${oldTime}`;
  const updatedNotes = booking.notes
    ? `${booking.notes}\n${rescheduleNote}`
    : rescheduleNote;

  // Update booking — back to pending with new date/time, reset reminder
  const { error: updateErr } = await supabase
    .from('bookings')
    .update({ status: 'pending', date, time, notes: updatedNotes, reminder_sent: false })
    .eq('id', id);

  if (updateErr) {
    console.error('reschedule update error:', updateErr);
    return res.status(500).json({ error: 'Failed to reschedule' });
  }

  const serviceList = Array.isArray(booking.service) ? booking.service.join(', ') : (booking.service || '—');

  // Notify admin
  transporter.sendMail({
    from: FROM,
    to: ADMIN,
    subject: `🔄 Reschedule Request — ${booking.client}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#050d1a;color:#e8e0cc;padding:32px;border-radius:8px;">
        <h2 style="color:#f59e0b;margin:0 0 8px;">🔄 Reschedule Request</h2>
        <p style="color:#8899aa;margin:0 0 24px;">${booking.client} has requested to reschedule their appointment. It is now marked <strong style="color:#f59e0b;">pending</strong> — approve the new time when ready.</p>

        <div style="background:rgba(10,22,40,.8);border:1px solid rgba(201,162,39,.2);border-radius:6px;padding:20px;margin-bottom:20px;">
          <div style="font-size:11px;color:#c9a227;letter-spacing:1.5px;margin-bottom:12px;">NEW REQUEST</div>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:7px 0;color:#7788aa;font-size:13px;width:110px;">Client</td><td style="padding:7px 0;font-weight:600;font-size:13px;">${booking.client}</td></tr>
            <tr><td style="padding:7px 0;color:#7788aa;font-size:13px;">Phone</td><td style="padding:7px 0;font-size:13px;">${booking.phone || '—'}</td></tr>
            <tr><td style="padding:7px 0;color:#7788aa;font-size:13px;">Service</td><td style="padding:7px 0;font-size:13px;">${serviceList}</td></tr>
            <tr><td style="padding:7px 0;color:#7788aa;font-size:13px;">New Date</td><td style="padding:7px 0;font-weight:600;font-size:13px;color:#22c55e;">${fmtDate(date)}</td></tr>
            <tr><td style="padding:7px 0;color:#7788aa;font-size:13px;">New Time</td><td style="padding:7px 0;font-weight:600;font-size:13px;color:#22c55e;">${time}</td></tr>
            <tr><td style="padding:7px 0;color:#7788aa;font-size:13px;">Previously</td><td style="padding:7px 0;font-size:13px;color:#556677;">${fmtDate(oldDate)} at ${oldTime}</td></tr>
          </table>
        </div>

        <p style="margin:0;font-size:12px;color:#445566;">Log in to your admin dashboard to approve or adjust the new time.</p>
      </div>
    `,
  }).catch(err => console.error('Admin reschedule email failed:', err.message));

  res.status(200).json({ ok: true });
}
