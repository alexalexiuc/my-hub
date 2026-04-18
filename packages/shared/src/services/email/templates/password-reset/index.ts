export interface PasswordResetEmailData {
  resetUrl: string;
  expiryMinutes: number;
}

export function buildPasswordResetEmail({ resetUrl, expiryMinutes }: PasswordResetEmailData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password</title>
  <style>
    body { margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e4e4e7; }
    .container { max-width: 520px; margin: 40px auto; padding: 32px; background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; }
    h1 { margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #fafafa; }
    p { margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #a1a1aa; }
    .btn { display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; }
    .note { font-size: 13px; color: #71717a; margin-top: 24px; }
    .url { word-break: break-all; font-size: 13px; color: #6366f1; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Reset your password</h1>
    <p>We received a request to reset the password for your My HUB account. Click the button below to choose a new password.</p>
    <p><a href="${resetUrl}" class="btn">Reset password</a></p>
    <p>This link will expire in <strong>${expiryMinutes} minutes</strong>. If you didn't request a password reset, you can safely ignore this email.</p>
    <p class="note">If the button doesn't work, copy and paste this URL into your browser:</p>
    <p class="url">${resetUrl}</p>
  </div>
</body>
</html>`;
}

export async function sendPasswordResetEmail(to: string, data: PasswordResetEmailData): Promise<void> {
  const { sendEmail } = await import('../../send-email');
  await sendEmail({
    to,
    subject: 'Reset your My HUB password',
    html: buildPasswordResetEmail(data),
  });
}
