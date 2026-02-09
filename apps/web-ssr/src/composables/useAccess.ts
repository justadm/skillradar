import { computed } from 'vue';
import { useUser } from './useUser';

const roleRank: Record<string, number> = {
  viewer: 0,
  analyst: 1,
  admin: 2,
  owner: 3
};

export function useAccess() {
  const { profile } = useUser();

  const role = computed(() => profile.value?.role || 'viewer');
  const rank = computed(() => roleRank[role.value] ?? 0);

  const canView = computed(() => rank.value >= 0);
  const canCreateReports = computed(() => rank.value >= 1);
  const canExportReports = computed(() => rank.value >= 1);
  const canManageTeam = computed(() => rank.value >= 2);
  const canManageBilling = computed(() => rank.value >= 3);
  const canManageSettings = computed(() => rank.value >= 2);
  const canDeleteReports = computed(() => rank.value >= 2);
  const canDeleteRoles = computed(() => rank.value >= 2);
  const canViewLeads = computed(() => rank.value >= 2);
  const canViewAudit = computed(() => rank.value >= 2);

  return {
    role,
    canView,
    canCreateReports,
    canExportReports,
    canManageTeam,
    canManageBilling,
    canManageSettings,
    canDeleteReports,
    canDeleteRoles,
    canViewLeads,
    canViewAudit
  };
}
