import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseTime(timeStr) {
  const match = (timeStr || '').match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return { h: 0, m: 0 };
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  if (match[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return { h, m };
}

function icalDateTime(dateStr, timeStr) {
  const [y, mo, d] = (dateStr || '').split('-');
  const { h, m } = parseTime(timeStr);
  return `${y}${mo}${d}T${String(h).padStart(2,'0')}${String(m).padStart(2,'0')}00`;
}

function icalEndDateTime(dateStr, timeStr, duration) {
  const { h, m } = parseTime(timeStr);
  const start = new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);
  start.setHours(start.getHours() + (duration || 1));
  const y = start.getFullYear();
  const mo = String(start.getMonth() + 1).padStart(2, '0');
  const d = String(start.getDate()).padStart(2, '0');
  const eh = String(start.getHours()).padStart(2, '0');
  const emn = String(start.getMinutes()).padStart(2, '0');
  return `${y}${mo}${d}T${eh}${emn}00`;
}

function escapeIcal(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export default async function handler(req, res) {
  if (req.query.token !== process.env.CAL_SECRET) {
    return res.status(401).end('Unauthorized');
  }

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*')
    .in('status', ['approved', 'scheduled_call'])
    .order('date', { ascending: true });

  if (error) return res.status(500).end('Error fetching bookings');

  const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';

  const events = (bookings || []).map(b => {
    const services = Array.isArray(b.service) ? b.service.join(', ') : (b.service || 'Service');
    const summary = `${services} — ${b.client}`;
    const dtstart = icalDateTime(b.date, b.time);
    const dtend = icalEndDateTime(b.date, b.time, b.duration || 1);
    const descParts = [
      b.phone ? `Phone: ${b.phone}` : null,
      b.email ? `Email: ${b.email}` : null,
      b.status === 'scheduled_call' ? 'Status: Call Scheduled' : 'Status: Approved',
      b.paid ? 'Payment: Paid' : 'Payment: Unpaid',
      b.notes ? `Notes: ${b.notes}` : null,
    ].filter(Boolean);

    const phoneDigits = (b.phone || '').replace(/\D/g, '');
    const telUrl = phoneDigits.length === 7
      ? `tel:+1242${phoneDigits}`
      : phoneDigits.length === 10
        ? `tel:+1${phoneDigits}`
        : phoneDigits ? `tel:+${phoneDigits}` : null;

    const vevent = [
      'BEGIN:VEVENT',
      `UID:booking-${b.id}@ez-techgroup.com`,
      `DTSTAMP:${now}`,
      `DTSTART;TZID=America/Nassau:${dtstart}`,
      `DTEND;TZID=America/Nassau:${dtend}`,
      `SUMMARY:${escapeIcal(summary)}`,
      `DESCRIPTION:${escapeIcal(descParts.join('\\n'))}`,
      'LOCATION:Nassau\\, Bahamas',
      b.status === 'scheduled_call' ? 'STATUS:TENTATIVE' : 'STATUS:CONFIRMED',
    ];
    if (telUrl) vevent.push(`URL:${telUrl}`);
    vevent.push('END:VEVENT');
    return vevent.join('\r\n');
  });

  const ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EZ Tech Solutions//Booking Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:EZ Tech Bookings',
    'X-WR-CALDESC:EZ Tech Solutions Appointments',
    'X-WR-TIMEZONE:America/Nassau',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="ez-tech-bookings.ics"');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.status(200).end(ical);
}
