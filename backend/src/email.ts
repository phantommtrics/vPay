import { Resend } from 'resend';

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

export async function sendOtpEmail(email: string, code: string): Promise<void> {
  if (!resend) {
    console.log(`[dev] OTP for ${email}: ${code}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: formatFromAddress(),
    to: email,
    subject: `Your ${appName} verification code`,
    html: `
      <div style="font-family: Inter, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h1 style="color: #111827; font-size: 24px; margin-bottom: 8px;">Verify your email</h1>
        <p style="color: #6b7280; font-size: 16px; line-height: 1.5; margin-bottom: 32px;">
          Enter this code in the ${appName} app to sign in. It expires in 10 minutes.
        </p>
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 32px;">
          <span style="font-size: 36px; font-weight: 700; letter-spacing: 12px; color: #047857; font-family: monospace;">
            ${code}
          </span>
        </div>
        <p style="color: #9ca3af; font-size: 14px;">
          If you didn't request this code, you can safely ignore this email.
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
