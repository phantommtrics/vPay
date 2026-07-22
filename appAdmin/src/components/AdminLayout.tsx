import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  GitBranch,
  LayoutDashboard,
  Link2,
  LineChart,
  LogOut,
  List,
  Mail,
  Package,
  Percent,
  Settings,
  Shield,
  Smartphone,
  UserCog,
  Users,
  UsersRound,
  Wallet,
  Wrench,
} from 'lucide-react';

import { useAdminAuth } from '../contexts/AdminAuthContext';
import { ensureAdminPushSubscription } from '../lib/push-notifications';
import { VPayWordmark } from './VPayWordmark';

const mainNav = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true, moduleKey: 'dashboard' },
  { to: '/kyc', label: 'KYC reviews', icon: ClipboardCheck, moduleKey: 'kyc' },
  { to: '/users', label: 'Customers', icon: Users, moduleKey: 'customers' },
] as const;

const reportsNav = [
  { to: '/reports/transactions', label: 'Transactions', icon: Wallet, moduleKey: 'reports' },
  { to: '/reports/journal', label: 'Journal', icon: BarChart3, moduleKey: 'reports' },
  { to: '/reports/notifications', label: 'Email notifications', icon: Mail, moduleKey: 'reports' },
] as const;

const workflowNav = [
  { to: '/workflow/summary', label: 'Summary', icon: GitBranch, moduleKey: 'workflow' },
  { to: '/workflow/detail', label: 'Detail', icon: List, moduleKey: 'workflow' },
] as const;

const deviceInfoNav = [
  { to: '/device-info/customer-devices', label: 'Customer devices', icon: Smartphone, moduleKey: 'device-info' },
] as const;

const systemNav = [
  { to: '/system/roles', label: 'Roles', icon: Shield, moduleKey: 'system-config-roles' },
  { to: '/system/groups', label: 'User groups', icon: UsersRound, moduleKey: 'system-config-groups' },
  { to: '/system/operators', label: 'Operators', icon: UserCog, moduleKey: 'system-config-operators' },
  { to: '/system/services', label: 'Services', icon: Wrench, moduleKey: 'system-config-services' },
  { to: '/system/products', label: 'Products', icon: Package, moduleKey: 'system-config-products' },
  { to: '/system/ucp', label: 'UCP', icon: Percent, moduleKey: 'system-config-ucps' },
  {
    to: '/system/settlement-requests',
    label: 'Settlement requests',
    icon: Link2,
    moduleKey: 'system-config-settlements',
  },
  {
    to: '/system/business-entities',
    label: 'Business entities',
    icon: Building2,
    moduleKey: 'system-config-business-entities',
  },
  {
    to: '/system/exchange-rates',
    label: 'Exchange rates',
    icon: LineChart,
    moduleKey: 'system-config-exchange-rates',
  },
] as const;

export function AdminLayout() {
  const navigate = useNavigate();
  const { admin, signOut, isAuthenticated, hasPermission } = useAdminAuth();
  const [workflowOpen, setWorkflowOpen] = useState(() =>
    window.location.pathname.startsWith('/workflow'),
  );
  const [reportsOpen, setReportsOpen] = useState(() =>
    window.location.pathname.startsWith('/reports'),
  );
  const [deviceInfoOpen, setDeviceInfoOpen] = useState(() =>
    window.location.pathname.startsWith('/device-info'),
  );
  const [systemOpen, setSystemOpen] = useState(() =>
    window.location.pathname.startsWith('/system'),
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    void ensureAdminPushSubscription();
  }, [isAuthenticated]);

  const handleSignOut = () => {
    signOut();
    navigate('/login', { replace: true });
  };

  const visibleMainNav = mainNav.filter((item) => hasPermission(item.moduleKey, 'view'));
  const visibleReportsNav = reportsNav.filter((item) => hasPermission(item.moduleKey, 'view'));
  const visibleWorkflowNav = workflowNav.filter((item) => hasPermission(item.moduleKey, 'view'));
  const visibleDeviceInfoNav = deviceInfoNav.filter((item) => hasPermission(item.moduleKey, 'view'));
  const visibleSystemNav = systemNav.filter((item) => hasPermission(item.moduleKey, 'view'));
  const roleLabel =
    admin?.adminUserType === 'OWNER'
      ? 'Owner'
      : admin?.adminUserType === 'OPERATOR'
        ? 'Operator'
        : 'Administrator';

  return (
    <div className="flex min-h-screen bg-[var(--color-canvas)]">
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="border-b border-[var(--color-border)] px-5 py-4">
          <VPayWordmark width={140} height={46} variant="light" />
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {visibleMainNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : undefined}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition ${
                  isActive
                    ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                    : 'text-[var(--color-text)] hover:bg-[var(--color-canvas-subtle)] hover:text-[var(--color-heading)]'
                }`
              }>
              <item.icon size={16} strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}

          {visibleReportsNav.length > 0 ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setReportsOpen((open) => !open)}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium text-[var(--color-text)] hover:bg-[var(--color-canvas-subtle)] hover:text-[var(--color-heading)]">
                <BarChart3 size={16} strokeWidth={2} />
                <span className="flex-1 text-left">Reports</span>
                {reportsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {reportsOpen ? (
                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-[var(--color-border)] pl-2">
                  {visibleReportsNav.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
                          isActive
                            ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-canvas-subtle)] hover:text-[var(--color-heading)]'
                        }`
                      }>
                      <item.icon size={14} strokeWidth={2} />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {visibleWorkflowNav.length > 0 ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setWorkflowOpen((open) => !open)}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium text-[var(--color-text)] hover:bg-[var(--color-canvas-subtle)] hover:text-[var(--color-heading)]">
                <GitBranch size={16} strokeWidth={2} />
                <span className="flex-1 text-left">Workflow</span>
                {workflowOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {workflowOpen ? (
                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-[var(--color-border)] pl-2">
                  {visibleWorkflowNav.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
                          isActive
                            ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-canvas-subtle)] hover:text-[var(--color-heading)]'
                        }`
                      }>
                      <item.icon size={14} strokeWidth={2} />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {visibleDeviceInfoNav.length > 0 ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setDeviceInfoOpen((open) => !open)}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium text-[var(--color-text)] hover:bg-[var(--color-canvas-subtle)] hover:text-[var(--color-heading)]">
                <Smartphone size={16} strokeWidth={2} />
                <span className="flex-1 text-left">Device info</span>
                {deviceInfoOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {deviceInfoOpen ? (
                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-[var(--color-border)] pl-2">
                  {visibleDeviceInfoNav.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
                          isActive
                            ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-canvas-subtle)] hover:text-[var(--color-heading)]'
                        }`
                      }>
                      <item.icon size={14} strokeWidth={2} />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {visibleSystemNav.length > 0 ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSystemOpen((open) => !open)}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium text-[var(--color-text)] hover:bg-[var(--color-canvas-subtle)] hover:text-[var(--color-heading)]">
                <Settings size={16} strokeWidth={2} />
                <span className="flex-1 text-left">System config</span>
                {systemOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {systemOpen ? (
                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-[var(--color-border)] pl-2">
                  {visibleSystemNav.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
                          isActive
                            ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-canvas-subtle)] hover:text-[var(--color-heading)]'
                        }`
                      }>
                      <item.icon size={14} strokeWidth={2} />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </nav>
        <div className="border-t border-[var(--color-border)] p-3">
          <div className="rounded-md px-3 py-2">
            <p className="truncate text-xs font-medium text-[var(--color-heading)]">{admin?.email}</p>
            <p className="text-[11px] text-[var(--color-text-muted)]">{roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] text-[var(--color-text-muted)] hover:bg-[var(--color-canvas-subtle)] hover:text-[var(--color-heading)]">
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
