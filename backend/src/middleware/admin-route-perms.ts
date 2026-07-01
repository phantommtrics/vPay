import { authorize } from './admin-authorize.js';

export const perm = {
  dashboardView: authorize('dashboard', 'view'),
  kycView: authorize('kyc', 'view'),
  kycEdit: authorize('kyc', 'edit'),
  customersView: authorize('customers', 'view'),
  customersEdit: authorize('customers', 'edit'),
  deviceInfoView: authorize('device-info', 'view'),
  reportsView: authorize('reports', 'view'),
  workflowView: authorize('workflow', 'view'),
};
