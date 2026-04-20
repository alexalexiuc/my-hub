import { sendEmail } from '../../send-email';

export interface EmailVerificationEmailData {
  verifyUrl: string;
  expiryHours: number;
}

export function buildEmailVerificationEmail({ verifyUrl, expiryHours }: EmailVerificationEmailData): string {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email</title>
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
    <h1>Verify your email address</h1>
    <p>Thanks for signing up for My HUB! Click the button below to verify your email address and activate your account.</p>
    <p><a href="${verifyUrl}" class="btn">Verify email</a></p>
    <p>This link will expire in <strong>${expiryHours} hour${expiryHours !== 1 ? 's' : ''}</strong>. If you didn't create an account, you can safely ignore this email.</p>
    <p class="note">If the button doesn't work, copy and paste this URL into your browser:</p>
    <p class="url">${verifyUrl}</p>
  </div>
</body>
</html>`;
  return html;
}

export async function sendEmailVerificationEmail(to: string, data: EmailVerificationEmailData): Promise<void> {
  await sendEmail({
    to,
    subject: 'Verify your My HUB email address',
    html: buildEmailVerificationEmail(data),
  });
}
