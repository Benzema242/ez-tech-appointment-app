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

const FROM  = 'EZ Tech Solutions <info@ez-techgroup.com>';
const ADMIN = 'info@ez-techgroup.com';

const fmtDate = isoStr => {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { name, email, phone, plan, duration_months, price, devices, expiration, payment_method, referral_code } = req.body;

  if (!email) return res.status(400).json({ error: 'No email address provided' });

  const planColor    = plan === 'IPTV' ? '#3b82f6' : '#a78bfa';
  const extraDevices = Math.max(0, (devices || 2) - 2);
  const expDate      = fmtDate(expiration);

  try {
    // Client renewal confirmation
    await transporter.sendMail({
      from: FROM,
      to: email,
      subject: `✅ Subscription Renewed — ${plan} active until ${expDate}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#050d1a;color:#e8e0cc;padding:32px;border-radius:8px;">

          <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
            <div style="background:linear-gradient(135deg,#1e3a5f,#0a1628);border:2px solid #c9a227;border-radius:50%;width:44px;height:44px;text-align:center;line-height:44px;font-weight:900;font-size:15px;color:#fff;">EZ</div>
            <div>
              <div style="font-size:16px;font-weight:900;color:#fff;letter-spacing:1px;">EZ TECH <span style="color:#c9a227;">SOLUTIONS</span></div>
              <div style="font-size:11px;color:#7788aa;letter-spacing:1px;">RENEWAL CONFIRMATION</div>
            </div>
          </div>

          <div style="background:rgba(34,197,94,.08);border-left:4px solid #22c55e;padding:16px 20px;border-radius:4px;margin-bottom:24px;">
            <p style="margin:0 0 6px;font-size:17px;font-weight:700;color:#f0c040;">You're all set, ${name}! 🎉</p>
            <p style="margin:0;font-size:14px;color:#c8bfa8;line-height:1.6;">
              Your <strong style="color:${planColor};">${plan}</strong> subscription has been <strong style="color:#22c55e;">renewed</strong> and is active through <strong style="color:#f0c040;">${expDate}</strong>.
            </p>
          </div>

          <div style="background:rgba(10,22,40,.8);border:1px solid rgba(201,162,39,.2);border-radius:6px;padding:20px;margin-bottom:20px;">
            <div style="font-size:11px;color:#c9a227;letter-spacing:1.5px;margin-bottom:14px;">RENEWAL DETAILS</div>
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);color:#7788aa;font-size:13px;width:140px;">Plan</td>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);font-weight:700;font-size:13px;color:${planColor};">${plan}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);color:#7788aa;font-size:13px;">Duration</td>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);font-size:13px;">${duration_months} month${duration_months !== 1 ? 's' : ''}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);color:#7788aa;font-size:13px;">Devices</td>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);font-size:13px;">${devices || 2}${extraDevices > 0 ? ` (${extraDevices} extra)` : ''}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);color:#7788aa;font-size:13px;">Amount Paid</td>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);font-weight:700;font-size:13px;color:#22c55e;">$${price}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);color:#7788aa;font-size:13px;">Payment</td>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);font-size:13px;">${payment_method}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#7788aa;font-size:13px;">New Expiry</td>
                <td style="padding:8px 0;font-weight:700;font-size:13px;color:#f0c040;">${expDate}</td>
              </tr>
            </table>
          </div>

          ${referral_code ? `
          <div style="background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.2);border-radius:6px;padding:16px 20px;margin-bottom:20px;">
            <div style="font-size:11px;color:#34d399;letter-spacing:2px;margin-bottom:8px;">EARN CREDIT — REFER A FRIEND</div>
            <p style="margin:0 0 10px;font-size:13px;color:#c8bfa8;line-height:1.6;">
              Know someone who'd love ${plan}? Share your personal referral code and earn credit every time they sign up!
            </p>
            <div style="text-align:center;padding:10px;background:rgba(34,197,94,.08);border-radius:4px;">
              <div style="font-size:11px;color:#7788aa;letter-spacing:1px;margin-bottom:4px;">YOUR CODE</div>
              <div style="font-size:22px;font-weight:900;color:#22c55e;letter-spacing:4px;font-family:monospace;">${referral_code}</div>
            </div>
          </div>
          ` : ''}

          <div style="background:rgba(201,162,39,.06);border:1px solid rgba(201,162,39,.15);border-radius:6px;padding:16px 20px;margin-bottom:24px;">
            <div style="font-size:11px;color:#c9a227;letter-spacing:1.5px;margin-bottom:8px;">NEED HELP?</div>
            <p style="margin:0 0 8px;font-size:13px;color:#c8bfa8;">We're here for you 24/7:</p>
            <p style="margin:0 0 6px;font-size:14px;"><a href="https://wa.me/12428050777" style="color:#25d366;text-decoration:none;font-weight:600;">💬 WhatsApp: (242) 805-0777</a></p>
            <p style="margin:0 0 6px;font-size:14px;"><a href="tel:+12428050777" style="color:#c9a227;text-decoration:none;">📞 Call: (242) 805-0777</a></p>
            <p style="margin:0;font-size:14px;"><a href="mailto:info@ez-techgroup.com" style="color:#c9a227;text-decoration:none;">✉️ info@ez-techgroup.com</a></p>
          </div>

          <p style="margin:0;font-size:13px;color:#8899aa;text-align:center;line-height:1.6;">
            Thank you for staying with us, ${name}!<br>
            <span style="font-size:11px;color:#445566;">— EZ Tech Solutions · Your Ultimate Streaming Platform</span>
          </p>
        </div>
      `,
    });

    // Admin notification
    await transporter.sendMail({
      from: FROM,
      to: ADMIN,
      subject: `🔄 Renewal — ${name} · ${plan} · $${price}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#050d1a;color:#e8e0cc;padding:32px;border-radius:8px;">
          <h2 style="color:#22c55e;margin:0 0 20px;">🔄 Subscription Renewed</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#7788aa;width:140px;">Client</td><td style="padding:8px 0;font-weight:600;">${name}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Phone</td><td style="padding:8px 0;">${phone || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Email</td><td style="padding:8px 0;">${email}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Plan</td><td style="padding:8px 0;color:${planColor};font-weight:700;">${plan}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Duration</td><td style="padding:8px 0;">${duration_months} month${duration_months !== 1 ? 's' : ''}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Devices</td><td style="padding:8px 0;">${devices || 2}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Amount</td><td style="padding:8px 0;color:#22c55e;font-weight:700;">$${price}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">Payment</td><td style="padding:8px 0;">${payment_method}</td></tr>
            <tr><td style="padding:8px 0;color:#7788aa;">New Expiry</td><td style="padding:8px 0;color:#f0c040;font-weight:700;">${expDate}</td></tr>
          </table>
        </div>
      `,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-subscription-renewal error:', err);
    res.status(500).json({ error: err.message });
  }
}
