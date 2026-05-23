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

  const { name, email, plan, amount, payment_method, note, paid_at } = req.body;

  if (!email) return res.status(400).json({ error: 'No email address provided' });

  const planColor = plan === 'IPTV' ? '#3b82f6' : '#a78bfa';

  try {
    await transporter.sendMail({
      from: FROM,
      to: email,
      subject: `Payment Receipt — EZ Tech Solutions`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#050d1a;color:#e8e0cc;padding:32px;border-radius:8px;">

          <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
            <div style="background:linear-gradient(135deg,#1e3a5f,#0a1628);border:2px solid #c9a227;border-radius:50%;width:44px;height:44px;text-align:center;line-height:44px;font-weight:900;font-size:15px;color:#fff;">EZ</div>
            <div>
              <div style="font-size:16px;font-weight:900;color:#fff;letter-spacing:1px;">EZ TECH <span style="color:#c9a227;">SOLUTIONS</span></div>
              <div style="font-size:11px;color:#7788aa;letter-spacing:1px;">PAYMENT RECEIPT</div>
            </div>
          </div>

          <div style="background:rgba(34,197,94,.08);border-left:4px solid #22c55e;padding:16px 20px;border-radius:4px;margin-bottom:24px;">
            <p style="margin:0 0 6px;font-size:17px;font-weight:700;color:#f0c040;">Hi ${name}!</p>
            <p style="margin:0;font-size:14px;color:#c8bfa8;line-height:1.6;">We've received your payment for your <strong style="color:${planColor};">${plan}</strong> subscription. Thank you!</p>
          </div>

          <div style="background:rgba(10,22,40,.8);border:1px solid rgba(201,162,39,.2);border-radius:6px;padding:20px;margin-bottom:20px;">
            <div style="font-size:11px;color:#c9a227;letter-spacing:1.5px;margin-bottom:14px;">PAYMENT DETAILS</div>
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);color:#7788aa;font-size:13px;width:130px;">Plan</td>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);font-weight:700;font-size:13px;color:${planColor};">${plan}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);color:#7788aa;font-size:13px;">Amount Paid</td>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);font-weight:700;font-size:13px;color:#22c55e;">$${amount}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);color:#7788aa;font-size:13px;">Payment Via</td>
                <td style="padding:8px 0;border-bottom:1px solid rgba(201,162,39,.08);font-size:13px;">${payment_method}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;${note ? 'border-bottom:1px solid rgba(201,162,39,.08);' : ''}color:#7788aa;font-size:13px;">Date</td>
                <td style="padding:8px 0;${note ? 'border-bottom:1px solid rgba(201,162,39,.08);' : ''}font-size:13px;">${fmtDate(paid_at)}</td>
              </tr>
              ${note ? `
              <tr>
                <td style="padding:8px 0;color:#7788aa;font-size:13px;">Note</td>
                <td style="padding:8px 0;font-size:13px;color:#c8bfa8;">${note}</td>
              </tr>` : ''}
            </table>
          </div>

          <div style="background:rgba(201,162,39,.06);border:1px solid rgba(201,162,39,.15);border-radius:6px;padding:16px 20px;margin-bottom:24px;">
            <div style="font-size:11px;color:#c9a227;letter-spacing:1.5px;margin-bottom:8px;">NEED HELP?</div>
            <p style="margin:0 0 6px;font-size:14px;"><a href="https://wa.me/12428050777" style="color:#25d366;text-decoration:none;font-weight:600;">💬 WhatsApp: (242) 805-0777</a></p>
            <p style="margin:0 0 6px;font-size:14px;"><a href="tel:+12428050777" style="color:#c9a227;text-decoration:none;">📞 Call: (242) 805-0777</a></p>
            <p style="margin:0;font-size:14px;"><a href="mailto:info@ez-techgroup.com" style="color:#c9a227;text-decoration:none;">✉️ info@ez-techgroup.com</a></p>
          </div>

          <p style="margin:0;font-size:13px;color:#8899aa;text-align:center;">
            <span style="font-size:11px;color:#445566;">— EZ Tech Solutions · Your Ultimate Streaming Platform</span>
          </p>
        </div>
      `,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-payment-receipt error:', err);
    res.status(500).json({ error: err.message });
  }
}
