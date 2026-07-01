import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { OtpInput } from '../components/OtpInput';
import { VPayWordmark } from '../components/VPayWordmark';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { setupAdminTotp } from '../lib/api';
import { getPreAuthToken } from '../lib/auth-storage';

export function TotpSetupPage() {
  const navigate = useNavigate();
  const { confirmTotpSetup, isAuthenticated, preAuthToken } = useAdminAuth();
  const preAuth = preAuthToken ?? getPreAuthToken();

  const [secret, setSecret] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingSetup, setLoadingSetup] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
      return;
    }
    if (!preAuth) {
      navigate('/login', { replace: true });
      return;
    }

    setupAdminTotp(preAuth)
      .then((data) => {
        setSecret(data.secret);
        setQrDataUrl(data.qrDataUrl);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Setup failed'))
      .finally(() => setLoadingSetup(false));
  }, [isAuthenticated, navigate, preAuth]);

  const handleConfirm = useCallback(
    async (value?: string) => {
      const otp = value ?? code;
      if (otp.length !== 6 || !secret) return;
      setError('');
      setBusy(true);
      try {
        await confirmTotpSetup(secret, otp);
        navigate('/', { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid code');
      } finally {
        setBusy(false);
      }
    },
    [code, confirmTotpSetup, navigate, secret],
  );

  if (!preAuth && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <VPayWordmark width={160} height={52} variant="light" />
        <h1 className="mt-6 text-2xl font-semibold text-gray-900">Set up authenticator</h1>
        <p className="mt-2 text-sm text-gray-600">
          Scan the QR code with Google Authenticator, 1Password, or another TOTP app. You will need
          this for every admin sign-in.
        </p>

        {loadingSetup ? (
          <p className="mt-8 text-sm text-gray-500">Preparing setup…</p>
        ) : (
          <div className="mt-8 space-y-6">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="TOTP QR code"
                className="mx-auto h-48 w-48 rounded-xl border border-gray-200"
              />
            ) : null}
            {secret ? (
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Manual entry key
                </p>
                <p className="mt-1 break-all font-mono text-sm text-gray-800">{secret}</p>
              </div>
            ) : null}
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">Enter code to confirm</p>
              <OtpInput
                value={code}
                onChange={(value) => {
                  setCode(value);
                  if (error) setError('');
                }}
                onComplete={handleConfirm}
                disabled={busy}
                error={Boolean(error)}
                autoFocus
              />
            </div>
          </div>
        )}

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        {code.length === 6 ? (
          <button
            type="button"
            onClick={() => handleConfirm()}
            disabled={busy}
            className="mt-6 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
            {busy ? 'Confirming…' : 'Complete setup'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
