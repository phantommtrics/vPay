import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { fetchAdminUsers, lookupAdminUser, type AdminUserSummary } from '../lib/api';
import { getAdminToken } from '../lib/auth-storage';
import { formatName } from '../lib/format';

export function UsersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getAdminToken();
    if (!token) return;
    fetchAdminUsers(token, { limit: 25 })
      .then(({ users: data }) => setUsers(data))
      .catch(() => {});
  }, []);

  const runSearch = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    const q = search.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    try {
      if (q.includes('@')) {
        const { user } = await lookupAdminUser(token, q.toLowerCase());
        navigate(`/users/${user.id}`);
        return;
      }
      const { users: data } = await fetchAdminUsers(token, { search: q, limit: 25 });
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [navigate, search]);

  return (
    <>
      <PageHeader
        title="Customers"
        description="Search and manage customer accounts, wallets, and provisioning."
      />
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-4">
        <div className="flex max-w-xl gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
              placeholder="Search by email or name"
              className="w-full rounded-md border border-[var(--color-border)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent-soft)]"
            />
          </div>
          <button type="button" className="btn-primary" disabled={loading} onClick={() => void runSearch()}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-[#df1b41]">{error}</p> : null}
      </div>

      <div className="p-8">
        <section className="panel overflow-hidden">
          {users.length === 0 ? (
            <EmptyState title="No customers found" description="Try searching by email address." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>KYC</th>
                  <th>Card</th>
                  <th>directPay</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="clickable" onClick={() => navigate(`/users/${user.id}`)}>
                    <td className="font-medium text-[var(--color-heading)]">
                      {formatName(user.firstName, user.lastName, user.email)}
                    </td>
                    <td className="text-[var(--color-text-muted)]">{user.email}</td>
                    <td><Badge status={user.kycStatus} dot /></td>
                    <td><Badge status={user.stripeProvisioningStatus} /></td>
                    <td><Badge status={user.directPayProvisioningStatus} /></td>
                    <td className="text-[var(--color-text-muted)]">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
