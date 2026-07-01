import { Resend } from 'resend';

import type { OtpEmailDeviceSummary } from './device/format.js';

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';
const appName = process.env.APP_NAME ?? 'vPay';

const resend = resendApiKey ? new Resend(resendApiKey) : null;

function formatFromAddress(): string {
  if (fromEmail.includes('<') && fromEmail.includes('>')) {
    return fromEmail;
  }
  return `${appName} <${fromEmail}>`;
}

export async function sendOtpEmail(
  email: string,
  code: string,
  options: {
    device?: OtpEmailDeviceSummary;
    accountDeviceLocked?: boolean;
  } = {},
): Promise<void> {
  const app = appName;

  const introParagraph = options.device
    ? `You asked to sign in from <strong>${options.device.deviceLabel}</strong> (${options.device.systemLabel}). Type the code below in the ${app} app.`
    : `You asked to sign in. Type the code below in the ${app} app.`;

  const lockNote = options.accountDeviceLocked
    ? `
        <p style="color: #92400e; font-size: 15px; line-height: 1.5; margin: 0 0 24px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 16px;">
          <strong>Your account is locked to one device.</strong>
          Only sign in on the phone or tablet you chose in Profile.
        </p>
      `
    : '';

  if (!resend) {
    console.log(`[dev] OTP for ${email}: ${code}`);
    if (options.device) {
      console.log(`[dev] Sign-in device: ${options.device.plainLines.join(' | ')}`);
    }
    return;
  }

  const { error } = await resend.emails.send({
    from: formatFromAddress(),
    to: email,
    subject: `Your ${app} sign-in code`,
    html: `
      <div style="font-family: Inter, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h1 style="color: #111827; font-size: 24px; margin-bottom: 8px;">Sign in to ${app}</h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
          ${introParagraph}
        </p>
        ${lockNote}
        <p style="color: #6b7280; font-size: 15px; line-height: 1.5; margin-bottom: 12px;">
          Your code:
        </p>
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 36px; font-weight: 700; letter-spacing: 12px; color: #047857; font-family: monospace;">
            ${code}
          </span>
        </div>
        <p style="color: #6b7280; font-size: 15px; line-height: 1.5; margin-bottom: 24px;">
          This code works for <strong>10 minutes</strong>.
        </p>
        <p style="color: #9ca3af; font-size: 14px; line-height: 1.5;">
          Did you <strong>not</strong> try to sign in? Ignore this email. Your account stays safe.
        </p>
      </div>
    `,
  });

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[dev] OTP for ${email}: ${code} (Resend: ${error.message})`);
      return;
    }
    throw new Error(error.message);
  }
}

export async function sendWelcomeEmail(email: string): Promise<void> {
  if (!resend) {
    console.log(`[dev] Welcome email for ${email}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: formatFromAddress(),
    to: email,
    subject: `Welcome to ${appName} — get your virtual card ready`,
    html: `
      <div style="font-family: Inter, -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #111827;">
        <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #047857; text-transform: uppercase; letter-spacing: 0.04em;">
          Welcome to ${appName}
        </p>
        <h1 style="font-size: 26px; line-height: 1.3; margin: 0 0 16px;">
          Your virtual card is a few steps away
        </h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 28px;">
          ${appName} gives you a virtual card you can fund from local wallets like Wave and APS,
          then use for online purchases and international payments — right from your phone.
        </p>

        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; margin-bottom: 28px;">
          <p style="margin: 0 0 20px; font-size: 15px; font-weight: 600; color: #111827;">
            Complete these three steps to start spending:
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="vertical-align: top; width: 36px; padding-bottom: 18px;">
                <span style="display: inline-block; width: 28px; height: 28px; line-height: 28px; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 14px; font-weight: 700; text-align: center;">1</span>
              </td>
              <td style="vertical-align: top; padding-bottom: 18px;">
                <p style="margin: 0 0 4px; font-size: 15px; font-weight: 600;">Verify your identity</p>
                <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #6b7280;">
                  Submit your details in Profile to complete KYC and unlock card features.
                </p>
              </td>
            </tr>
            <tr>
              <td style="vertical-align: top; width: 36px; padding-bottom: 18px;">
                <span style="display: inline-block; width: 28px; height: 28px; line-height: 28px; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 14px; font-weight: 700; text-align: center;">2</span>
              </td>
              <td style="vertical-align: top; padding-bottom: 18px;">
                <p style="margin: 0 0 4px; font-size: 15px; font-weight: 600;">Fund your ${appName} wallet</p>
                <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #6b7280;">
                  Top up from Wave or APS Wallet on the Fund tab — your balance stays ready when you need it.
                </p>
              </td>
            </tr>
            <tr>
              <td style="vertical-align: top; width: 36px;">
                <span style="display: inline-block; width: 28px; height: 28px; line-height: 28px; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 14px; font-weight: 700; text-align: center;">3</span>
              </td>
              <td style="vertical-align: top;">
                <p style="margin: 0 0 4px; font-size: 15px; font-weight: 600;">Load your virtual card</p>
                <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #6b7280;">
                  Move funds from your wallet to your card and start paying online securely.
                </p>
              </td>
            </tr>
          </table>
        </div>

        <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #4b5563;">
          Open the ${appName} app, enter the verification code we just sent, and finish setup in minutes.
        </p>

        <p style="margin: 0 0 32px;">
          <span style="display: inline-block; background: #047857; color: #ffffff; font-size: 15px; font-weight: 600; padding: 14px 24px; border-radius: 12px;">
            Open ${appName} and get started
          </span>
        </p>

        <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 0;">
          You received this because you started signing up for ${appName}.
          If this wasn't you, you can ignore this email.
        </p>
      </div>
    `,
  });

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[dev] Welcome email for ${email} (Resend: ${error.message})`);
      return;
    }
    throw new Error(error.message);
  }
}

type CardReadyEmailOptions = {
  firstName?: string | null;
  last4?: string;
};

export async function sendCardReadyEmail(
  email: string,
  options: CardReadyEmailOptions = {},
): Promise<void> {
  const greeting = options.firstName?.trim() ? options.firstName.trim() : 'there';
  const cardHint = options.last4
    ? ` ending in <strong>${options.last4}</strong>`
    : '';

  if (!resend) {
    console.log(`[dev] Card ready email for ${email}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: formatFromAddress(),
    to: email,
    subject: `Your ${appName} virtual card is ready`,
    html: `
      <div style="font-family: Inter, -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #111827;">
        <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #047857; text-transform: uppercase; letter-spacing: 0.04em;">
          You're all set
        </p>
        <h1 style="font-size: 26px; line-height: 1.3; margin: 0 0 16px;">
          Congratulations, ${greeting} — your virtual card is ready
        </h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 28px;">
          Your ${appName} virtual card${cardHint} has been approved and is ready to use.
          You can fund it from local wallets and pay online anywhere cards are accepted.
        </p>

        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 16px; padding: 24px; margin-bottom: 28px;">
          <p style="margin: 0 0 20px; font-size: 15px; font-weight: 600; color: #047857;">
            How to start spending
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="vertical-align: top; width: 36px; padding-bottom: 18px;">
                <span style="display: inline-block; width: 28px; height: 28px; line-height: 28px; border-radius: 999px; background: #ffffff; color: #047857; font-size: 14px; font-weight: 700; text-align: center;">1</span>
              </td>
              <td style="vertical-align: top; padding-bottom: 18px;">
                <p style="margin: 0 0 4px; font-size: 15px; font-weight: 600;">Top up your wallet</p>
                <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #065f46;">
                  Open the <strong>Fund</strong> tab and add money from Wave or APS Wallet.
                </p>
              </td>
            </tr>
            <tr>
              <td style="vertical-align: top; width: 36px; padding-bottom: 18px;">
                <span style="display: inline-block; width: 28px; height: 28px; line-height: 28px; border-radius: 999px; background: #ffffff; color: #047857; font-size: 14px; font-weight: 700; text-align: center;">2</span>
              </td>
              <td style="vertical-align: top; padding-bottom: 18px;">
                <p style="margin: 0 0 4px; font-size: 15px; font-weight: 600;">Load your card</p>
                <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #065f46;">
                  Go to the <strong>Cards</strong> tab and move funds from your wallet onto your virtual card.
                </p>
              </td>
            </tr>
            <tr>
              <td style="vertical-align: top; width: 36px; padding-bottom: 18px;">
                <span style="display: inline-block; width: 28px; height: 28px; line-height: 28px; border-radius: 999px; background: #ffffff; color: #047857; font-size: 14px; font-weight: 700; text-align: center;">3</span>
              </td>
              <td style="vertical-align: top; padding-bottom: 18px;">
                <p style="margin: 0 0 4px; font-size: 15px; font-weight: 600;">Pay online</p>
                <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #065f46;">
                  Use your card details for online purchases and international payments. View card number, expiry, and CVV in the app.
                </p>
              </td>
            </tr>
            <tr>
              <td style="vertical-align: top; width: 36px;">
                <span style="display: inline-block; width: 28px; height: 28px; line-height: 28px; border-radius: 999px; background: #ffffff; color: #047857; font-size: 14px; font-weight: 700; text-align: center;">4</span>
              </td>
              <td style="vertical-align: top;">
                <p style="margin: 0 0 4px; font-size: 15px; font-weight: 600;">Track and protect</p>
                <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #065f46;">
                  Check spending on the <strong>History</strong> tab. Freeze your card anytime from the <strong>Cards</strong> tab if you need extra security.
                </p>
              </td>
            </tr>
          </table>
        </div>

        <p style="margin: 0 0 32px;">
          <span style="display: inline-block; background: #047857; color: #ffffff; font-size: 15px; font-weight: 600; padding: 14px 24px; border-radius: 12px;">
            Open ${appName} and load your card
          </span>
        </p>

        <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 0;">
          You received this because your ${appName} virtual card was approved.
          If you have questions, reply to this email or contact support through the app.
        </p>
      </div>
    `,
  });

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[dev] Card ready email for ${email} (Resend: ${error.message})`);
      return;
    }
    throw new Error(error.message);
  }
}
