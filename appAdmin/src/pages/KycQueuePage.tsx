import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, X } from 'lucide-react';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { DocumentViewer } from '../components/DocumentViewer';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import {
  approveKyc,
  fetchAdminUser,
  fetchAdminUsers,
  rejectKyc,
  type AdminUser,
  type AdminUserSummary,
} from '../lib/api';
import { getAdminToken } from '../lib/auth-storage';
import { formatDate, formatName } from '../lib/format';

function kycChecklist(user: AdminUser) {
  return [
    { label: 'Identity document uploaded', done: Boolean(user.documentFrontUrl) },
    { label: 'Selfie uploaded', done: Boolean(user.selfieUrl) },
    { label: 'Personal details complete', done: Boolean(user.firstName && user.lastName && user.phone) },
    { label: 'Address on file', done: Boolean(user.address && user.city && user.country) },
    { label: 'Card terms accepted', done: Boolean(user.cardTermsAcceptedAt) },
  ];
}

export function KycQueuePage() {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const loadQueue = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    setLoading(true);
    try {
      const { users: data } = await fetchAdminUsers(token, { kycStatus: 'pending', limit: 50 });
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const openReview = async (userId: string) => {
    const token = getAdminToken();
    if (!token) return;
    setError('');
    try {
      const { user } = await fetchAdminUser(token, userId);
      setSelected(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submission');
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    const token = getAdminToken();
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      await approveKyc(token, selected.id);
      setApproveOpen(false);
      setSelected(null);
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!selected || !rejectReason.trim()) return;
    const token = getAdminToken();
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      await rejectKyc(token, selected.id, rejectReason.trim());
      setRejectOpen(false);
      setRejectReason('');
      setSelected(null);
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setBusy(false);
    }
  };

  const checklist = selected ? kycChecklist(selected) : [];
  const allChecksPass = checklist.every((c) => c.done);

  return (
    <>
      <PageHeader
        title="KYC reviews"
        description="Verify customer identity before approving cards and directPay provisioning."
        actions={
          <span className="rounded-full bg-[#fef6e8] px-3 py-1 text-xs font-medium text-[#9a6700]">
            {users.length} pending
          </span>
        }
      />

      <div className="p-8">
        {error ? (
          <div className="mb-4 rounded-md border border-[#fcd5df] bg-[#fff5f7] px-4 py-3 text-sm text-[#df1b41]">
            {error}
          </div>
        ) : null}

        <section className="panel overflow-hidden">
          {loading ? (
            <p className="p-8 text-sm text-[var(--color-text-muted)]">Loading submissions…</p>
          ) : users.length === 0 ? (
            <EmptyState
              title="No pending reviews"
              description="New KYC submissions from the mobile app will appear here for your review."
            />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Submitted</th>
                  <th>Document</th>
                  <th>Country</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="clickable" onClick={() => void openReview(user.id)}>
                    <td>
                      <p className="font-medium text-[var(--color-heading)]">
                        {formatName(user.firstName, user.lastName, user.email)}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">{user.email}</p>
                    </td>
                    <td className="text-[var(--color-text-muted)]">{formatDate(user.kycSubmittedAt)}</td>
                    <td className="capitalize text-[var(--color-text)]">
                      {user.documentType?.replace(/_/g, ' ') ?? '—'}
                    </td>
                    <td className="text-[var(--color-text-muted)]">{user.country ?? '—'}</td>
                    <td><Badge status={user.kycStatus} dot /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {selected ? (
        <>
          <div className="slide-over-backdrop" onClick={() => setSelected(null)} />
          <div className="slide-over">
            <div className="slide-over-header flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                  KYC review
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--color-heading)]">
                  {formatName(selected.firstName, selected.lastName, selected.email)}
                </h2>
                <p className="text-sm text-[var(--color-text-muted)]">{selected.email}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-heading)]">
                <X size={20} />
              </button>
            </div>

            <div className="slide-over-body space-y-6">
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Review checklist
                </h3>
                <ul className="space-y-2">
                  {checklist.map((item) => (
                    <li key={item.label} className="flex items-center gap-2 text-sm">
                      {item.done ? (
                        <CheckCircle2 size={16} className="text-[var(--color-accent)]" />
                      ) : (
                        <Circle size={16} className="text-[var(--color-border-strong)]" />
                      )}
                      <span className={item.done ? 'text-[var(--color-heading)]' : 'text-[var(--color-text-muted)]'}>
                        {item.label}
                      </span>
                    </li>
                  ))}
                </ul>
                {!allChecksPass ? (
                  <p className="mt-3 text-xs text-[#9a6700]">
                    Some items are incomplete. You may still reject; approve only if documents are sufficient.
                  </p>
                ) : null}
              </section>

              <section className="rounded-md border border-[var(--color-border)] p-4 text-sm">
                <dl className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-[var(--color-text-muted)]">Phone</dt>
                    <dd className="font-medium text-[var(--color-heading)]">{selected.phone ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-text-muted)]">DOB</dt>
                    <dd className="font-medium text-[var(--color-heading)]">{selected.dateOfBirth ?? '—'}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-[var(--color-text-muted)]">Address</dt>
                    <dd className="font-medium text-[var(--color-heading)]">
                      {[selected.address, selected.city, selected.country, selected.postalCode]
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </dd>
                  </div>
                </dl>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Identity verification
                </h3>
                <p className="mb-3 text-sm text-[var(--color-text-muted)]">
                  Compare the face on the ID front with the customer selfie before approving.
                </p>
                <DocumentViewer
                  frontUrl={selected.documentFrontUrl}
                  backUrl={selected.documentBackUrl}
                  selfieUrl={selected.selfieUrl}
                />
              </section>

              <Link
                to={`/users/${selected.id}`}
                className="text-sm font-medium text-[var(--color-accent)] hover:underline">
                Open full customer profile →
              </Link>
            </div>

            <div className="slide-over-footer">
              <button type="button" className="btn-secondary btn-danger" disabled={busy} onClick={() => setRejectOpen(true)}>
                Reject
              </button>
              <button type="button" className="btn-primary" disabled={busy} onClick={() => setApproveOpen(true)}>
                Approve KYC
              </button>
            </div>
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={approveOpen}
        title="Approve KYC"
        description={
          selected
            ? `Approve identity verification for ${selected.email}? The customer will be able to receive a virtual card.`
            : 'Approve this KYC submission?'
        }
        confirmLabel="Approve"
        loading={busy}
        onConfirm={() => void handleApprove()}
        onCancel={() => setApproveOpen(false)}
      />

      <ConfirmDialog
        open={rejectOpen}
        title="Reject KYC submission"
        description="The customer will see this reason in the app and can resubmit."
        confirmLabel="Reject submission"
        destructive
        loading={busy}
        onConfirm={() => void handleReject()}
        onCancel={() => {
          setRejectOpen(false);
          setRejectReason('');
        }}>
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={3}
          placeholder="e.g. Document image is unclear or expired"
          className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
      </ConfirmDialog>
    </>
  );
}
