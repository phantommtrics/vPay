const ACTION_LABELS: Record<string, string> = {
  view: 'View',
  edit: 'Edit',
  delete: 'Delete',
};

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  kyc: 'KYC Reviews',
  customers: 'Customers',
  'device-info': 'Device Info',
  reports: 'Reports',
  workflow: 'Workflow',
  'system-config-roles': 'System Config — Roles',
  'system-config-groups': 'System Config — User Groups',
  'system-config-operators': 'System Config — Operators',
  'system-config-services': 'System Config — Services',
  'system-config-products': 'System Config — Products',
  'system-config-ucps': 'System Config — UCP',
  'system-config-settlements': 'System Config — Settlement Requests',
  'system-config-business-entities': 'System Config — Business Entities',
  'system-config-exchange-rates': 'System Config — Exchange Rates',
};

function formatModule(key: string) {
  if (MODULE_LABELS[key]) return MODULE_LABELS[key];
  return key
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export type Permission = {
  id: string;
  moduleKey: string;
  actionKey: string;
  name: string;
  description: string | null;
};

type PermissionMatrixProps = {
  modules: string[];
  actions: string[];
  moduleActions?: Record<string, string[]>;
  permissions: Permission[];
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
};

export function PermissionMatrix({
  modules,
  actions,
  moduleActions,
  permissions,
  selectedIds,
  onChange,
}: PermissionMatrixProps) {
  const safeActions = actions ?? [];

  const permissionMap = new Map<string, string>();
  for (const p of permissions) {
    permissionMap.set(`${p.moduleKey}:${p.actionKey}`, p.id);
  }

  function toggleCell(moduleKey: string, actionKey: string) {
    const id = permissionMap.get(`${moduleKey}:${actionKey}`);
    if (!id) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table min-w-[520px]">
        <thead>
          <tr>
            <th>Module</th>
            {safeActions.map((action) => (
              <th key={action} className="text-center">
                {ACTION_LABELS[action] ?? action}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modules.map((moduleKey) => (
            <tr key={moduleKey}>
              <td className="font-medium">{formatModule(moduleKey)}</td>
              {safeActions.map((actionKey) => {
                const allowed =
                  moduleActions?.[moduleKey]?.includes(actionKey) ?? true;
                const id = allowed ? permissionMap.get(`${moduleKey}:${actionKey}`) : undefined;
                const selected = id ? selectedIds.has(id) : false;
                return (
                  <td key={actionKey} className="p-0 text-center">
                    {id ? (
                      <button
                        type="button"
                        onClick={() => toggleCell(moduleKey, actionKey)}
                        className={`flex h-9 w-full items-center justify-center transition ${
                          selected
                            ? 'bg-[var(--color-accent)] text-white'
                            : 'hover:bg-[var(--color-accent-soft)]'
                        }`}>
                        {selected ? '✓' : ''}
                      </button>
                    ) : (
                      <div className="h-9 bg-[var(--color-canvas-subtle)]" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
