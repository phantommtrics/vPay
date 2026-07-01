import { AdminUserType } from '@prisma/client';

export const MODULES = [
  'dashboard',
  'kyc',
  'customers',
  'device-info',
  'reports',
  'workflow',
  'system-config-roles',
  'system-config-groups',
  'system-config-operators',
  'system-config-services',
  'system-config-products',
  'system-config-ucps',
  'system-config-settlements',
  'system-config-exchange-rates',
] as const;

export const SYSTEM_CONFIG_MODULES = [
  'system-config-roles',
  'system-config-groups',
  'system-config-operators',
  'system-config-services',
  'system-config-products',
  'system-config-ucps',
  'system-config-settlements',
  'system-config-exchange-rates',
] as const;

export const ACTIONS = ['view', 'edit', 'delete'] as const;

export type ModuleKey = (typeof MODULES)[number];
export type ActionKey = (typeof ACTIONS)[number];

const SYSTEM_CONFIG_ACTIONS: readonly ActionKey[] = ['view', 'edit', 'delete'];
const KYC_ACTIONS: readonly ActionKey[] = ['view', 'edit'];
const CUSTOMERS_ACTIONS: readonly ActionKey[] = ['view', 'edit'];
const DEVICE_INFO_ACTIONS: readonly ActionKey[] = ['view'];
const DASHBOARD_ACTIONS: readonly ActionKey[] = ['view'];
const REPORTS_ACTIONS: readonly ActionKey[] = ['view'];
const WORKFLOW_ACTIONS: readonly ActionKey[] = ['view'];
const EXCHANGE_RATES_ACTIONS: readonly ActionKey[] = ['view'];

const MODULE_ACTION_OVERRIDES: Partial<Record<ModuleKey, readonly ActionKey[]>> = {
  dashboard: DASHBOARD_ACTIONS,
  kyc: KYC_ACTIONS,
  customers: CUSTOMERS_ACTIONS,
  'device-info': DEVICE_INFO_ACTIONS,
  reports: REPORTS_ACTIONS,
  workflow: WORKFLOW_ACTIONS,
  'system-config-roles': SYSTEM_CONFIG_ACTIONS,
  'system-config-groups': SYSTEM_CONFIG_ACTIONS,
  'system-config-operators': SYSTEM_CONFIG_ACTIONS,
  'system-config-services': SYSTEM_CONFIG_ACTIONS,
  'system-config-products': SYSTEM_CONFIG_ACTIONS,
  'system-config-ucps': SYSTEM_CONFIG_ACTIONS,
  'system-config-settlements': SYSTEM_CONFIG_ACTIONS,
  'system-config-exchange-rates': EXCHANGE_RATES_ACTIONS,
};

export function actionsForModule(moduleKey: string): readonly ActionKey[] {
  const override = MODULE_ACTION_OVERRIDES[moduleKey as ModuleKey];
  if (override) return override;
  return ACTIONS;
}

export function getModuleActionsMap(): Record<ModuleKey, ActionKey[]> {
  return Object.fromEntries(
    MODULES.map((moduleKey) => [moduleKey, [...actionsForModule(moduleKey)]]),
  ) as Record<ModuleKey, ActionKey[]>;
}

type PermissionRow = {
  moduleKey: string;
  actionKey: string;
};

type RoleWithPermissions = {
  permissions: Array<{
    permission: PermissionRow;
  }>;
};

type GroupWithRole = {
  group: {
    role: RoleWithPermissions;
  };
};

export type UserWithPermissionGraph = {
  adminUserType: AdminUserType | null;
  adminRoles: Array<{
    role: RoleWithPermissions;
  }>;
  adminGroups: GroupWithRole[];
};

export const adminPermissionInclude = {
  adminRoles: {
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  },
  adminGroups: {
    include: {
      group: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  },
} as const;

function permissionsFromRole(role: RoleWithPermissions): string[] {
  return role.permissions.map(
    (rp) => `${rp.permission.moduleKey}:${rp.permission.actionKey}`,
  );
}

export function resolvePermissions(user: UserWithPermissionGraph): string[] {
  if (user.adminUserType === AdminUserType.OWNER) {
    return ['*'];
  }

  const directRoles = user.adminRoles.map((ur) => ur.role);
  const groupRoles = user.adminGroups.map((ug) => ug.group.role);
  const all = [
    ...directRoles.flatMap(permissionsFromRole),
    ...groupRoles.flatMap(permissionsFromRole),
  ];
  return [...new Set(all)];
}

export function hasPermission(
  permissions: string[],
  moduleKey: string,
  actionKey: string,
): boolean {
  return (
    permissions.includes('*') ||
    permissions.includes(`${moduleKey}:${actionKey}`)
  );
}
