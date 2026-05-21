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
  return new Date(isoStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { name, email, phone, plan, duration_months, price, devices, username, password, start_date, expiration, payment_method } = req.body;

  if (!email) return res.status(400).json({ error: 'No email address provided' });

  const planColor = plan === 'IPTV' ? '#3b82f6' : '#a78bfa';
  const extraDevices = Math.max(0, (devices || 2) - 2);

  try {
    await transporter.sendMail({
      from: FROM,
      to: email,
      subject: `Welcome to ${plan} — Your Subscription is Active! 🎉`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#050d1a;color:#e8e0cc;padding:32px;border-radius:8px;">

          <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
            <div style="background:linear-gradient(135deg,#1e3a5f,#0a1628);border:2px solid #c9a227;border-radius:50%;width:44px;height:44px;text-align:center;line-height:44px;font-weight:900;font-size:15px;color:#fff;">EZ</div>
            <div>
              <div style="font-size:16px;font-weight:900;color:#fff;letter-spacing:1px;">EZ TECH <span style="color:#c9a227;">SOLUTIONS</span></div>
              <div style="font-size:11px;color:#7788aa;letter-spacing:1px;">SUBSCRIPTION CONFIRMATION</div>
            </div>
          </div>

          <div style="background:rgba(34,197,94,.08);border-left:4px solid #22c55e;padding:16px 20px;border-radius:4px;margin-bottom:24px;">
            <p style="margin:0 0 6px;font-size:17px;font-weight:700;color:#f0c040;">Thank you, ${name}! 🎉</p>
            <p style="margin:0;font-size:14px;color:#c8bfa8;line-height:1.6;">Your <strong style="color:${planColor};">${plan}</strong> subscription is now <strong style="color:#22c55e;">active</strong>. Enjoy your entertainment!</p>
          </div>

          <div style="background:rgba(10,22,40,.8);border:1px solid rgba(201,162,39,.2);border-radius:6px;padding:20px;margin-bottom:20px;">
            <div style="font-size:11px;color:#c9a227;letter-spacing:1.5px;margin-bottom:14px;">SUBSCRIPTION DETAILS</div>
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);color:#7788aa;font-size:13px;width:130px;">Plan</td>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);font-weight:700;font-size:13px;color:${planColor};">${plan}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);color:#7788aa;font-size:13px;">Duration</td>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);font-size:13px;">${duration_months} month${duration_months !== 1 ? 's' : ''}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);color:#7788aa;font-size:13px;">Devices</td>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);font-size:13px;">${devices || 2}${extraDevices > 0 ? ` <span style="color:#7788aa;font-size:11px;">(includes ${extraDevices} extra)</span>` : ''}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);color:#7788aa;font-size:13px;">Amount Paid</td>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);font-weight:700;font-size:13px;color:#22c55e;">$${price}</td>
              </tr>
              ${payment_method ? `
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);color:#7788aa;font-size:13px;">Payment Via</td>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);font-size:13px;">${payment_method}</td>
              </tr>` : ''}
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);color:#7788aa;font-size:13px;">Start Date</td>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);font-size:13px;">${fmtDate(start_date)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#7788aa;font-size:13px;">Expires</td>
                <td style="padding:8px 0;font-weight:700;font-size:13px;color:#f0c040;">${fmtDate(expiration)}</td>
              </tr>
            </table>
          </div>

          ${username || password ? `
          <div style="background:rgba(10,22,40,.8);border:1px solid rgba(201,162,39,.2);border-radius:6px;padding:20px;margin-bottom:20px;">
            <div style="font-size:11px;color:#c9a227;letter-spacing:1.5px;margin-bottom:14px;">YOUR LOGIN CREDENTIALS</div>
            <table style="width:100%;border-collapse:collapse;">
              ${username ? `
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);color:#7788aa;font-size:13px;width:130px;">Username</td>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);font-family:monospace;font-size:14px;color:#e8e0cc;letter-spacing:0.5px;">${username}</td>
              </tr>` : ''}
              ${password ? `
              <tr>
                <td style="padding:8px 0;color:#7788aa;font-size:13px;">Password</td>
                <td style="padding:8px 0;font-family:monospace;font-size:14px;color:#e8e0cc;letter-spacing:0.5px;">${password}</td>
              </tr>` : ''}
            </table>
            <p style="margin:12px 0 0;font-size:11px;color:#556677;">Keep these credentials safe — do not share them with others.</p>
          </div>
          ` : ''}

          <div style="background:rgba(201,162,39,.06);border:1px solid rgba(201,162,39,.15);border-radius:6px;padding:16px 20px;margin-bottom:24px;">
            <div style="font-size:11px;color:#c9a227;letter-spacing:1.5px;margin-bottom:8px;">NEED HELP?</div>
            <p style="margin:0 0 8px;font-size:13px;color:#c8bfa8;">We're here for you 24/7. Reach us anytime:</p>
            <p style="margin:0 0 6px;font-size:14px;"><a href="https://wa.me/12428050777" style="color:#25d366;text-decoration:none;font-weight:600;">💬 WhatsApp: (242) 805-0777</a></p>
            <p style="margin:0 0 6px;font-size:14px;"><a href="tel:+12428050777" style="color:#c9a227;text-decoration:none;">📞 Call: (242) 805-0777</a></p>
            <p style="margin:0;font-size:14px;"><a href="mailto:info@ez-techgroup.com" style="color:#c9a227;text-decoration:none;">✉️ info@ez-techgroup.com</a></p>
          </div>

          <p style="margin:0;font-size:13px;color:#8899aa;text-align:center;line-height:1.6;">Enjoy your <strong style="color:${planColor};">${plan}</strong> subscription!<br>
          <span style="font-size:11px;color:#445566;">— EZ Tech Solutions · Your Ultimate Streaming Platform</span></p>
        </div>
      `,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-subscription-welcome error:', err);
    res.status(500).json({ error: err.message });
  }
}
