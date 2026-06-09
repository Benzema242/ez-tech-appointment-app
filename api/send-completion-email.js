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

// Replace with your actual Google Business review link
const GOOGLE_REVIEW_URL = 'https://g.page/r/CboWueqT5Zl0EBM/review';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { name, email, phone, services, date, time, duration, price, notes } = req.body;

  if (!email) return res.status(200).json({ ok: true, skipped: 'no email' });

  const serviceList = Array.isArray(services) ? services.join(', ') : (services || '—');
  const durationLabel = duration ? `${duration} hour${duration > 1 ? 's' : ''}` : '—';
  const priceLabel = price != null && price !== '' ? `$${price}` : null;

  try {
    await transporter.sendMail({
      from: FROM,
      to: email,
      subject: 'Thank You — Service Complete · EZ Tech Solutions',
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#050d1a;color:#e8e0cc;padding:32px;border-radius:8px;">

          <!-- Header -->
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:28px;">
            <div style="background:linear-gradient(135deg,#1e3a5f,#0a1628);border:2px solid #c9a227;border-radius:50%;width:44px;height:44px;text-align:center;line-height:44px;font-weight:900;font-size:15px;color:#fff;flex-shrink:0;">EZ</div>
            <div>
              <div style="font-size:16px;font-weight:900;color:#fff;letter-spacing:1px;">EZ TECH <span style="color:#c9a227;">SOLUTIONS</span></div>
              <div style="font-size:11px;color:#7788aa;letter-spacing:1px;">SERVICE COMPLETE</div>
            </div>
          </div>

          <!-- Thank you banner -->
          <div style="background:rgba(6,182,212,.08);border-left:4px solid #06b6d4;padding:18px 20px;border-radius:4px;margin-bottom:24px;">
            <p style="margin:0 0 8px;font-size:19px;font-weight:700;color:#f0c040;">Thank you, ${name}! 🎉</p>
            <p style="margin:0;font-size:14px;color:#c8bfa8;line-height:1.6;">
              Your service is complete and your payment has been received. We appreciate your trust in EZ Tech Solutions and hope everything is working perfectly for you.
            </p>
          </div>

          <!-- Service summary -->
          <div style="background:rgba(10,22,40,.8);border:1px solid rgba(201,162,39,.2);border-radius:6px;padding:20px;margin-bottom:24px;">
            <div style="font-size:11px;color:#c9a227;letter-spacing:1.5px;margin-bottom:14px;">SERVICE SUMMARY</div>
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);color:#7788aa;font-size:13px;width:110px;">Service</td>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);font-size:13px;font-weight:600;">${serviceList}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);color:#7788aa;font-size:13px;">Date</td>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);font-size:13px;">${date}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);color:#7788aa;font-size:13px;">Time</td>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);font-size:13px;">${time}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;${priceLabel ? 'border-bottom:1px solid rgba(201,162,39,.08);' : ''}color:#7788aa;font-size:13px;">Duration</td>
                <td style="padding:8px 0;${priceLabel ? 'border-bottom:1px solid rgba(201,162,39,.08);' : ''}font-size:13px;">${durationLabel}</td>
              </tr>
              ${priceLabel ? `
              <tr>
                <td style="padding:8px 0;color:#7788aa;font-size:13px;">Total Paid</td>
                <td style="padding:8px 0;font-weight:700;font-size:14px;color:#22c55e;">${priceLabel} ✓ PAID</td>
              </tr>` : ''}
            </table>
          </div>

          <!-- Review CTA -->
          <div style="background:rgba(201,162,39,.06);border:1px solid rgba(201,162,39,.2);border-radius:6px;padding:20px;margin-bottom:24px;text-align:center;">
            <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#f0c040;">Were you happy with our work?</p>
            <p style="margin:0 0 16px;font-size:13px;color:#c8bfa8;line-height:1.6;">
              If you were pleased with our service, a quick review would mean the world to us — it only takes 30 seconds and helps other customers find us.
            </p>
            <a href="${GOOGLE_REVIEW_URL}" target="_blank"
              style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#c9a227,#f0c040);color:#050d1a;text-decoration:none;border-radius:5px;font-size:14px;font-weight:900;letter-spacing:1px;">
              ⭐ LEAVE A REVIEW
            </a>
          </div>

          <!-- Contact -->
          <div style="background:rgba(201,162,39,.04);border:1px solid rgba(201,162,39,.12);border-radius:6px;padding:16px 20px;margin-bottom:24px;">
            <p style="margin:0 0 6px;font-size:13px;color:#c8bfa8;">Need anything else? We're always here to help.</p>
            <p style="margin:6px 0 0;font-size:13px;color:#c9a227;">📞 (242) 805-0777 &nbsp;·&nbsp; ✉️ info@ez-techgroup.com</p>
          </div>

          <p style="margin:0;font-size:11px;color:#445566;text-align:center;">— EZ Tech Solutions · Providing Fast and Quality Services</p>
        </div>
      `,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-completion-email error:', err);
    res.status(500).json({ error: err.message });
  }
}
