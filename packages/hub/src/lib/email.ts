import nodemailer from 'nodemailer';

function createTransport() {
  const host = process.env['SMTP_HOST'];
  const port = parseInt(process.env['SMTP_PORT'] ?? '587', 10);
  const user = process.env['SMTP_USER'];
  const pass = process.env['SMTP_PASS'];

  if (!host) {
    // No SMTP configured — log emails to console for local development
    return nodemailer.createTransport({ jsonTransport: true });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const baseUrl = process.env['NEXTAUTH_URL'] ?? 'http://localhost:3000';
  const verifyUrl = `${baseUrl}/auth/verify-email?token=${token}`;
  const from = process.env['SMTP_FROM'] ?? 'noreply@my-hub.local';

  const transport = createTransport();

  const info = await transport.sendMail({
    from,
    to,
    subject: 'Verify your email address',
    text: `Please verify your email address by clicking the link below:\n\n${verifyUrl}\n\nThis link expires in 24 hours.`,
    html: `
      <p>Please verify your email address by clicking the button below:</p>
      <p><a href="${verifyUrl}" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Verify email</a></p>
      <p>Or copy this link: <a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>This link expires in 24 hours.</p>
    `,
  });

  if (!process.env['SMTP_HOST']) {
    console.log('[email] No SMTP configured. Verification email content:');
    console.log('[email] To:', to);
    console.log('[email] Verify URL:', verifyUrl);
    console.log('[email] Raw:', JSON.stringify(info));
  }
}
