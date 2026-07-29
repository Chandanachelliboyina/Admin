import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ detail: 'Method Not Allowed' });
  }

  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        console.error('Body parse error:', e);
      }
    }

    const { email, admin_email, otp } = body;
    const targetEmail = (email || admin_email || '').trim().toLowerCase();

    const ALLOWED_ADMIN_EMAILS = [
      'chanduchelliboyina3@gmail.com',
      'bbmmwdo.org@gmail.com',
      'bbmmwdo.bmm@gmail.com'
    ];

    if (!targetEmail || !ALLOWED_ADMIN_EMAILS.includes(targetEmail)) {
      return res.status(403).json({
        detail: 'Unauthorized: Only authorized admin email addresses can request an Admin password reset.'
      });
    }

    const otpCode = otp || `${Math.floor(100000 + Math.random() * 900000)}`;

    const smtpAccounts = [
      { user: 'bbmmwdo.bmm@gmail.com', pass: 'kegctljmzbutxupt' },
      { user: 'chanduchelliboyina3@gmail.com', pass: 'kzvdhxwdcoaqyruc' }
    ];

    let emailSent = false;
    let lastError = null;

    for (const acc of smtpAccounts) {
      if (emailSent) break;
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: acc.user,
            pass: acc.pass,
          },
        });

        const mailOptions = {
          from: `"BMM Admin Portal" <${acc.user}>`,
          to: targetEmail,
          subject: 'BMM Admin - Password Reset Verification OTP',
          text: `Hello Admin,\n\nWe received a request to reset your password for account (${targetEmail}).\n\nYour 6-digit OTP verification code is: ${otpCode}\n\nThis code will expire in 10 minutes. Please enter this code on the Admin Reset page to set your new password.\n\nIf you did not request this password reset, please ignore this email.\n\nBest regards,\nBMM System Administrator`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
              <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #2563eb; margin: 0; font-size: 22px;">BMM Admin Portal</h2>
                <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Password Reset Verification OTP</p>
              </div>
              <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
                Hello Admin,<br/><br/>
                We received a request to reset your password for account: <strong>${targetEmail}</strong>.
              </p>
              <div style="background: linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%); border: 1px solid #c7d2fe; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
                <span style="font-size: 11px; font-weight: bold; color: #4338ca; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 8px;">Your 6-Digit Verification OTP</span>
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #1e1b4b;">${otpCode}</span>
              </div>
              <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
                This code will expire in 10 minutes. Enter this 6-digit code on the password reset page to activate your new password.
              </p>
              <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0 16px 0;" />
              <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
                BMM System Administrator &copy; ${new Date().getFullYear()}
              </p>
            </div>
          `,
        };

        await transporter.sendMail(mailOptions);
        emailSent = true;
        console.log(`SUCCESS: OTP email sent to ${targetEmail} via ${acc.user} with code ${otpCode}`);
      } catch (err) {
        lastError = err;
        console.error(`SMTP attempt failed for ${acc.user}:`, err);
      }
    }

    if (!emailSent) {
      return res.status(500).json({
        detail: `Failed to send email: ${lastError?.message || 'SMTP error'}`
      });
    }

    return res.status(200).json({
      success: true,
      message: `Verification OTP code sent to ${targetEmail}. Please check your Gmail inbox.`,
      otp: otpCode
    });
  } catch (error) {
    console.error('Vercel Serverless Mail Error:', error);
    return res.status(500).json({
      detail: `Failed to send email: ${error.message}`
    });
  }
}
