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

const fmtDate = isoStr => {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const daysUntil = isoStr => {
  const exp = new Date(isoStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((exp - now) / 86400000);
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { name, email, phone, plan, expiration, manual } = req.body;

  if (!email) return res.status(400).json({ error: 'No email address provided' });

  const days = daysUntil(expiration);
  const expDate = fmtDate(expiration);

  let subject, urgency, message;
  if (days <= 0) {
    subject = `Your ${plan} subscription has expired — EZ Tech Solutions`;
    urgency = '#ef4444';
    message = `Your <strong>${plan}</strong> subscription expired on <strong>${expDate}</strong>. Contact us to renew and restore your access.`;
  } else if (days <= 2) {
    subject = `⚠️ Your ${plan} subscription expires in ${days} day${days !== 1 ? 's' : ''} — EZ Tech Solutions`;
    urgency = '#f59e0b';
    message = `Your <strong>${plan}</strong> subscription expires in <strong>${days} day${days !== 1 ? 's' : ''}</strong> on <strong>${expDate}</strong>. Renew now to avoid any interruption to your service.`;
  } else {
    subject = `Your ${plan} subscription expires on ${expDate} — EZ Tech Solutions`;
    urgency = '#c9a227';
    message = `Your <strong>${plan}</strong> subscription expires on <strong>${expDate}</strong> (${days} days from now). Renew early to keep your service running without interruption.`;
  }

  try {
    await transporter.sendMail({
      from: FROM,
      to: email,
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#050d1a;color:#e8e0cc;padding:32px;border-radius:8px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
            <div style="background:linear-gradient(135deg,#1e3a5f,#0a1628);border:2px solid #c9a227;border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:15px;color:#fff;text-align:center;line-height:44px;">EZ</div>
            <div>
              <div style="font-size:16px;font-weight:900;color:#fff;letter-spacing:1px;">EZ TECH <span style="color:#c9a227;">SOLUTIONS</span></div>
              <div style="font-size:11px;color:#7788aa;letter-spacing:1px;">SUBSCRIPTION NOTICE</div>
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
            <p style="margin:0;font-size:13px;color:#c8bfa8;">Reach out and we'll get you renewed quickly:</p>
            <p style="margin:10px 0 0;font-size:14px;">
              <a href="https://wa.me/12428050777" style="color:#25d366;text-decoration:none;font-weight:600;">💬 WhatsApp: (242) 805-0777</a>
            </p>
            <p style="margin:6px 0 0;font-size:14px;">
              <a href="tel:+12428050777" style="color:#c9a227;text-decoration:none;">📞 Call: (242) 805-0777</a>
            </p>
            <p style="margin:6px 0 0;font-size:14px;">
              <a href="mailto:info@ez-techgroup.com" style="color:#c9a227;text-decoration:none;">✉️ info@ez-techgroup.com</a>
            </p>
          </div>

          <p style="margin:0;font-size:11px;color:#445566;text-align:center;">— EZ Tech Solutions · Your Ultimate Streaming Platform</p>
        </div>
      `,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-subscription-reminder error:', err);
    res.status(500).json({ error: err.message });
  }
}
