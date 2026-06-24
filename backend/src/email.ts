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
