import { KeyRound, Mail, ScrollText, Shield } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { OtpInput, type OtpInputRef } from '../components/OtpInput';
import { VPayWordmark } from '../components/VPayWordmark';
import { useAdminAuth } from '../contexts/AdminAuthContext';

type Step = 'email' | 'otp' | 'totp';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SECURITY_FEATURES = [
  {
    icon: Mail,
    title: 'Email verification',
    description: 'A one-time code sent to your authorized inbox.',
  },
  {
    icon: KeyRound,
    title: 'Authenticator app',
    description: 'TOTP required on every sign-in.',
  },
  {
    icon: ScrollText,
    title: 'Audit trail',
    description: 'Administrative actions are logged for compliance.',
  },
] as const;

export function LoginPage() {
  const navigate = useNavigate();
  const { loading, isAuthenticated, sendOtp, verifyOtp, verifyTotp } = useAdminAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [totp, setTotp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRef = useRef<OtpInputRef>(null);
  const totpRef = useRef<OtpInputRef>(null);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const trimmedEmail = email.trim().toLowerCase();

  const handleSendOtp = useCallback(async () => {
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError('Enter a valid email address');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await sendOtp(trimmedEmail);
      setEmail(trimmedEmail);
      setStep('otp');
      setOtp('');
      setResendCooldown(60);
      window.setTimeout(() => otpRef.current?.focus(), 400);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setBusy(false);
    }
  }, [sendOtp, trimmedEmail]);

  const handleVerifyOtp = useCallback(
    async (code?: string) => {
      const value = code ?? otp;
      if (value.length !== 6) return;
      setError('');
      setBusy(true);
      try {
        const { totpEnrolled } = await verifyOtp(email, value);
        if (!totpEnrolled) {
          navigate('/setup-totp', { replace: true });
          return;
        }
        setStep('totp');
        setTotp('');
        window.setTimeout(() => totpRef.current?.focus(), 400);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Verification failed');
        setOtp('');
        otpRef.current?.focus();
      } finally {
        setBusy(false);
      }
    },
    [email, navigate, otp, verifyOtp],
  );

  const handleVerifyTotp = useCallback(
    async (code?: string) => {
      const value = code ?? totp;
      if (value.length !== 6) return;
      setError('');
      setBusy(true);
      try {
        await verifyTotp(value);
        navigate('/', { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid authenticator code');
        setTotp('');
        totpRef.current?.focus();
      } finally {
        setBusy(false);
      }
    },
    [navigate, totp, verifyTotp],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 p-12 lg:flex">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-16 left-8 h-56 w-56 rounded-full bg-teal-300/10 blur-3xl"
          aria-hidden="true"
        />

        <VPayWordmark variant="dark" />

        <div className="relative max-w-lg">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-100/90">
            <Shield size={13} strokeWidth={2.25} />
            Operations console
          </div>

          <h1 className="mt-6 text-[2.5rem] font-semibold leading-[1.1] tracking-[-0.03em] text-white">
            Secure admin access
          </h1>

          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-emerald-100/85">
            Review KYC submissions, issue virtual cards, and manage directPay merchant
            provisioning for the vPay platform.
          </p>

          <ul className="mt-10 space-y-3">
            {SECURITY_FEATURES.map((feature) => (
              <li
                key={feature.title}
                className="flex gap-3.5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 backdrop-blur-sm"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-100">
                  <feature.icon size={17} strokeWidth={2} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-snug text-white">
                    {feature.title}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-emerald-100/70">
                    {feature.description}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs font-medium tracking-wide text-emerald-200/55">
          Authorized personnel only
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <VPayWordmark width={180} height={56} variant="light" />
          </div>

          <h2 className="text-2xl font-semibold text-gray-900">
            {step === 'email' && 'Sign in'}
            {step === 'otp' && 'Check your email'}
            {step === 'totp' && 'Authenticator code'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {step === 'email' && 'Enter your authorized admin email to receive a verification code.'}
            {step === 'otp' && `We sent a 6-digit code to ${email}`}
            {step === 'totp' && 'Enter the 6-digit code from your authenticator app.'}
          </p>

          <div className="mt-8 space-y-4">
            {step === 'email' ? (
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                placeholder="admin@company.com"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            ) : null}

            {step === 'otp' ? (
              <OtpInput
                ref={otpRef}
                value={otp}
                onChange={(value) => {
                  setOtp(value);
                  if (error) setError('');
                }}
                onComplete={handleVerifyOtp}
                disabled={busy}
                error={Boolean(error)}
                autoFocus
              />
            ) : null}

            {step === 'totp' ? (
              <OtpInput
                ref={totpRef}
                value={totp}
                onChange={(value) => {
                  setTotp(value);
                  if (error) setError('');
                }}
                onComplete={handleVerifyTotp}
                disabled={busy}
                error={Boolean(error)}
                autoFocus
              />
            ) : null}

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            {step === 'email' ? (
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={busy}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                {busy ? 'Sending…' : 'Continue'}
              </button>
            ) : null}

            {step === 'otp' ? (
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setOtp('');
                    setError('');
                  }}
                  className="font-medium text-gray-600 hover:text-gray-900">
                  Change email
                </button>
                <button
                  type="button"
                  disabled={resendCooldown > 0 || busy}
                  onClick={handleSendOtp}
                  className="font-medium text-emerald-700 hover:text-emerald-800 disabled:text-gray-400">
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                </button>
              </div>
            ) : null}

            {step === 'otp' && otp.length === 6 ? (
              <button
                type="button"
                onClick={() => handleVerifyOtp()}
                disabled={busy}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                {busy ? 'Verifying…' : 'Verify email code'}
              </button>
            ) : null}

            {step === 'totp' && totp.length === 6 ? (
              <button
                type="button"
                onClick={() => handleVerifyTotp()}
                disabled={busy}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                {busy ? 'Verifying…' : 'Verify and sign in'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
