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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { name, email, referred_name, credit_earned, credit_balance } = req.body;

  if (!email) return res.status(400).json({ error: 'No email address provided' });

  try {
    await transporter.sendMail({
      from: FROM,
      to: email,
      subject: `You earned $${credit_earned} referral credit! 🎉`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#050d1a;color:#e8e0cc;padding:32px;border-radius:8px;">

          <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
            <div style="background:linear-gradient(135deg,#1e3a5f,#0a1628);border:2px solid #c9a227;border-radius:50%;width:44px;height:44px;text-align:center;line-height:44px;font-weight:900;font-size:15px;color:#fff;">EZ</div>
            <div>
              <div style="font-size:16px;font-weight:900;color:#fff;letter-spacing:1px;">EZ TECH <span style="color:#c9a227;">SOLUTIONS</span></div>
              <div style="font-size:11px;color:#7788aa;letter-spacing:1px;">REFERRAL REWARD</div>
            </div>
          </div>

          <div style="background:rgba(34,197,94,.08);border-left:4px solid #22c55e;padding:16px 20px;border-radius:4px;margin-bottom:24px;">
            <p style="margin:0 0 6px;font-size:17px;font-weight:700;color:#f0c040;">Great news, ${name}! 🎉</p>
            <p style="margin:0;font-size:14px;color:#c8bfa8;line-height:1.6;">
              <strong style="color:#e8e0cc;">${referred_name}</strong> just signed up using your referral code.
              You've earned <strong style="color:#22c55e;">$${credit_earned} credit</strong> toward your subscription!
            </p>
          </div>

          <div style="background:rgba(10,22,40,.8);border:1px solid rgba(34,197,94,.25);border-radius:6px;padding:24px;margin-bottom:24px;text-align:center;">
            <div style="font-size:11px;color:#34d399;letter-spacing:2px;margin-bottom:8px;">YOUR REFERRAL CREDIT BALANCE</div>
            <div style="font-size:48px;font-weight:900;color:#22c55e;letter-spacing:2px;">$${credit_balance}</div>
            <div style="font-size:13px;color:#7788aa;margin-top:8px;">Applied to your next renewal by our team</div>
          </div>

          <div style="background:rgba(201,162,39,.06);border:1px solid rgba(201,162,39,.15);border-radius:6px;padding:16px 20px;margin-bottom:24px;">
            <div style="font-size:11px;color:#c9a227;letter-spacing:1.5px;margin-bottom:10px;">KEEP REFERRING &amp; KEEP EARNING</div>
            <p style="margin:0;font-size:13px;color:#c8bfa8;line-height:1.7;">
              Every friend or family member who signs up with your referral code earns you another
              <strong style="color:#f0c040;"> $${credit_earned} credit</strong>. Share your code and watch your balance grow!
            </p>
          </div>

          <div style="background:rgba(10,22,40,.8);border:1px solid rgba(201,162,39,.15);border-radius:6px;padding:16px 20px;margin-bottom:24px;">
            <div style="font-size:11px;color:#c9a227;letter-spacing:1.5px;margin-bottom:10px;">NEED HELP?</div>
            <p style="margin:0 0 6px;font-size:14px;"><a href="https://wa.me/12428050777" style="color:#25d366;text-decoration:none;font-weight:600;">💬 WhatsApp: (242) 805-0777</a></p>
            <p style="margin:0 0 6px;font-size:14px;"><a href="tel:+12428050777" style="color:#c9a227;text-decoration:none;">📞 Call: (242) 805-0777</a></p>
            <p style="margin:0;font-size:14px;"><a href="mailto:info@ez-techgroup.com" style="color:#c9a227;text-decoration:none;">✉️ info@ez-techgroup.com</a></p>
          </div>

          <p style="margin:0;font-size:11px;color:#445566;text-align:center;line-height:1.6;">
            Thank you for spreading the word!<br>— EZ Tech Solutions
          </p>
        </div>
      `,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-referral-credit-email error:', err);
    res.status(500).json({ error: err.message });
  }
}
