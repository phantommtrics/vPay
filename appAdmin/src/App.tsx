import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AdminLayout } from './components/AdminLayout';
import { RequirePermission } from './components/RequirePermission';
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext';
import { DashboardPage } from './pages/DashboardPage';
import { KycQueuePage } from './pages/KycQueuePage';
import { LoginPage } from './pages/LoginPage';
import { ReportsPage } from './pages/ReportsPage';
import { OperatorsPage } from './pages/system/OperatorsPage';
import { ProductsPage } from './pages/system/ProductsPage';
import { RolesPage } from './pages/system/RolesPage';
import { ServicesPage } from './pages/system/ServicesPage';
import { SettlementRequestsPage } from './pages/system/SettlementRequestsPage';
import { ExchangeRatesPage } from './pages/system/ExchangeRatesPage';
import { UcpsPage } from './pages/system/UcpsPage';
import { UserGroupsPage } from './pages/system/UserGroupsPage';
import { WorkflowDetailPage } from './pages/workflow/WorkflowDetailPage';
import { WorkflowSummaryPage } from './pages/workflow/WorkflowSummaryPage';
import { CustomerDeviceDetailPage } from './pages/devices/CustomerDeviceDetailPage';
import { CustomerDevicesPage } from './pages/devices/CustomerDevicesPage';
import { TotpSetupPage } from './pages/TotpSetupPage';
import { UserDetailPage } from './pages/UserDetailPage';
import { UsersPage } from './pages/UsersPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { admin, loading, isAuthenticated } = useAdminAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!admin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Restoring session…</p>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AdminAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup-totp" element={<TotpSetupPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }>
            <Route
              index
              element={
                <RequirePermission moduleKey="dashboard">
                  <DashboardPage />
                </RequirePermission>
              }
            />
            <Route
              path="kyc"
              element={
                <RequirePermission moduleKey="kyc">
                  <KycQueuePage />
                </RequirePermission>
              }
            />
            <Route
              path="users"
              element={
                <RequirePermission moduleKey="customers">
                  <UsersPage />
                </RequirePermission>
              }
            />
            <Route
              path="users/:userId"
              element={
                <RequirePermission moduleKey="customers">
                  <UserDetailPage />
                </RequirePermission>
              }
            />
            <Route
              path="device-info/customer-devices"
              element={
                <RequirePermission moduleKey="device-info">
                  <CustomerDevicesPage />
                </RequirePermission>
              }
            />
            <Route
              path="device-info/customer-devices/:groupType/:groupKey"
              element={
                <RequirePermission moduleKey="device-info">
                  <CustomerDeviceDetailPage />
                </RequirePermission>
              }
            />
            <Route
              path="reports"
              element={
                <RequirePermission moduleKey="reports">
                  <ReportsPage />
                </RequirePermission>
              }
            />
            <Route
              path="workflow/summary"
              element={
                <RequirePermission moduleKey="workflow">
                  <WorkflowSummaryPage />
                </RequirePermission>
              }
            />
            <Route
              path="workflow/detail"
              element={
                <RequirePermission moduleKey="workflow">
                  <WorkflowDetailPage />
                </RequirePermission>
              }
            />
            <Route
              path="system/roles"
              element={
                <RequirePermission moduleKey="system-config-roles">
                  <RolesPage />
                </RequirePermission>
              }
            />
            <Route
              path="system/groups"
              element={
                <RequirePermission moduleKey="system-config-groups">
                  <UserGroupsPage />
                </RequirePermission>
              }
            />
            <Route
              path="system/operators"
              element={
                <RequirePermission moduleKey="system-config-operators">
                  <OperatorsPage />
                </RequirePermission>
              }
            />
            <Route
              path="system/services"
              element={
                <RequirePermission moduleKey="system-config-services">
                  <ServicesPage />
                </RequirePermission>
              }
            />
            <Route
              path="system/products"
              element={
                <RequirePermission moduleKey="system-config-products">
                  <ProductsPage />
                </RequirePermission>
              }
            />
            <Route
              path="system/ucp"
              element={
                <RequirePermission moduleKey="system-config-ucps">
                  <UcpsPage />
                </RequirePermission>
              }
            />
            <Route
              path="system/settlement-requests"
              element={
                <RequirePermission moduleKey="system-config-settlements">
                  <SettlementRequestsPage />
                </RequirePermission>
              }
            />
            <Route
              path="system/exchange-rates"
              element={
                <RequirePermission moduleKey="system-config-exchange-rates">
                  <ExchangeRatesPage />
                </RequirePermission>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AdminAuthProvider>
  );
}
