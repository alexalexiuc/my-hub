import { SendEmailCommand } from '@aws-sdk/client-ses';
import juice from 'juice';
import { getSesClient } from './ses-client';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  const fromEmail = process.env['SES_FROM_EMAIL'];
  if (!fromEmail) throw new Error('SES_FROM_EMAIL environment variable is required');

  const inlinedHtml = juice(html);

  await getSesClient().send(
    new SendEmailCommand({
      Source: fromEmail,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Html: { Data: inlinedHtml, Charset: 'UTF-8' } },
      },
    }),
  );
}
