import { useState, useEffect, useMemo, useCallback, type DragEvent, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, Shield, Play, X } from 'lucide-react';
import { fetchWithAuth } from '@/stores/auth';
import type { FilterConditionGroup } from '@breeze/shared';
import { FilterBuilder, DEFAULT_FILTER_FIELDS } from '../filters/FilterBuilder';
import { FilterPreview } from '../filters/FilterPreview';
import { useFilterPreview } from '../../hooks/useFilterPreview';
import { legacyRulesToFilterConditions } from './filterMigration';
import { formatNumber } from '@/i18n/formatters';
import { useI18n } from '@/i18n/react';

type OSType = 'windows' | 'macos' | 'linux';

type Device = {
  id: string;
  hostname: string;
  os: OSType;
  siteId?: string;
  siteName?: string;
  tags?: string[];
};

type GroupType = 'static' | 'dynamic';
type RuleField = 'os' | 'site' | 'tag' | 'hostname';
type RuleOperator = 'is' | 'is_not' | 'contains' | 'not_contains' | 'matches' | 'not_matches';

type DeviceGroupRule = {
  id: string;
  field: RuleField;
  operator: RuleOperator;
  value: string;
};

type DeviceGroup = {
  id: string;
  name: string;
  description?: string;
  type: GroupType;
  deviceCount?: number;
  deviceIds?: string[];
  devices?: Device[];
  rules?: DeviceGroupRule[];
  policyId?: string;
  policyName?: string;
  policy?: { id: string; name: string };
};

type Site = {
  id: string;
  name: string;
};

type Policy = {
  id: string;
  name: string;
};

type Script = {
  id: string;
  name: string;
};

type ModalMode = 'closed' | 'create' | 'edit' | 'delete' | 'bulk-script' | 'bulk-policy';

type GroupFormState = {
  name: string;
  description: string;
  type: GroupType;
  policyId: string;
  rules: DeviceGroupRule[];
  deviceIds: string[];
  filterConditions: FilterConditionGroup;
};

type DragPayload = {
  deviceId: string;
  fromGroupId: string;
};

type TFunction = (
  key: string,
  params?: Record<string, string | number | boolean | null | undefined>,
  fallback?: string,
) => string;

const osLabels: Record<OSType, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux'
};

const ruleOperatorOptions: Record<RuleField, Array<{ value: RuleOperator; label: string }>> = {
  os: [
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' }
  ],
  site: [
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' }
  ],
  tag: [
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' }
  ],
  hostname: [
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
    { value: 'matches', label: 'matches regex' },
    { value: 'not_matches', label: 'does not match regex' }
  ]
};

let idCounter = 0;
const createId = (prefix: string = 'id') => {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
};

const normalizeGroup = (group: DeviceGroup): DeviceGroup => {
  const inferredType: GroupType = group.type ?? (group.rules && group.rules.length > 0 ? 'dynamic' : 'static');
  const policyId = group.policyId ?? group.policy?.id ?? '';
  const policyName = group.policyName ?? group.policy?.name ?? '';
  const deviceIds = group.deviceIds ?? group.devices?.map(device => device.id) ?? [];

  return {
    ...group,
    type: inferredType,
    policyId,
    policyName,
    deviceIds
  };
};

const buildRuleLabel = (
  rule: DeviceGroupRule,
  siteNameById: Map<string, string>,
  t: TFunction,
): string => {
  const fieldLabel = t(`deviceGroups.ruleFields.${rule.field}`);
  const operatorLabel = t(`deviceGroups.ruleOperators.${rule.operator}`);

  const value =
    rule.field === 'site'
      ? siteNameById.get(rule.value) ?? rule.value
      : rule.field === 'os'
        ? t(`devices.osNames.${rule.value}`, undefined, rule.value)
      : rule.value;

  return t('deviceGroups.ruleLabel', {
    field: fieldLabel,
    operator: operatorLabel,
    value: value || t('deviceGroups.emptyRuleValue'),
  });
};

const parseDragPayload = (event: DragEvent): DragPayload | null => {
  const data = event.dataTransfer.getData('text/plain');
  if (!data) return null;
  try {
    const parsed = JSON.parse(data) as DragPayload;
    if (parsed?.deviceId && parsed?.fromGroupId) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
};

export default function DeviceGroupsPage() {
  const { locale, t } = useI18n();
  const [groups, setGroups] = useState<DeviceGroup[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [modalMode, setModalMode] = useState<ModalMode>('closed');
  const [selectedGroup, setSelectedGroup] = useState<DeviceGroup | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string>();
  const EMPTY_FILTER: FilterConditionGroup = {
    operator: 'AND',
    conditions: [{ field: 'hostname', operator: 'contains', value: '' }]
  };

  const [groupForm, setGroupForm] = useState<GroupFormState>({
    name: '',
    description: '',
    type: 'static',
    policyId: '',
    rules: [],
    deviceIds: [],
    filterConditions: EMPTY_FILTER
  });
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [assignmentQuery, setAssignmentQuery] = useState('');
  const [bulkScriptId, setBulkScriptId] = useState('');
  const [bulkPolicyId, setBulkPolicyId] = useState('');
  const [deleteReassignGroupId, setDeleteReassignGroupId] = useState('');
  const [draggingDevice, setDraggingDevice] = useState<DragPayload | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);

  const { preview: formPreview, loading: formPreviewLoading, error: formPreviewError, refresh: formPreviewRefresh } = useFilterPreview(
    groupForm.type === 'dynamic' && (modalMode === 'create' || modalMode === 'edit')
      ? groupForm.filterConditions
      : null,
    { enabled: true }
  );

  const deviceById = useMemo(() => {
    return new Map(devices.map(device => [device.id, device]));
  }, [devices]);

  const siteOptions = useMemo(() => {
    if (sites.length > 0) {
      return sites;
    }
    const seen = new Map<string, string>();
    devices.forEach(device => {
      if (device.siteId && device.siteName) {
        seen.set(device.siteId, device.siteName);
      }
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [devices, sites]);

  const siteNameById = useMemo(() => {
    return new Map(siteOptions.map(site => [site.id, site.name]));
  }, [siteOptions]);

  const tagOptions = useMemo(() => {
    const tags = new Set<string>();
    devices.forEach(device => {
      device.tags?.forEach((tag: string) => tags.add(tag));
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [devices]);

  const filteredAssignmentDevices = useMemo(() => {
    const query = assignmentQuery.trim().toLowerCase();
    if (!query) return devices;
    return devices.filter(device => {
      const matchesHostname = device.hostname.toLowerCase().includes(query);
      const matchesTag = device.tags?.some((tag: string) => tag.toLowerCase().includes(query));
      return matchesHostname || matchesTag;
    });
  }, [assignmentQuery, devices]);

  const pluralSuffix = (value: number): 'One' | 'Few' | 'Many' => {
    const mod10 = Math.abs(value) % 10;
    const mod100 = Math.abs(value) % 100;
    if (mod10 === 1 && mod100 !== 11) return 'One';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'Few';
    return 'Many';
  };

  const countText = (baseKey: string, count: number) =>
    t(`${baseKey}${pluralSuffix(count)}`, { count: formatNumber(count, locale) });

  const deviceCountText = (count: number) => countText('deviceGroups.counts.devices', count);
  const selectedGroupCountText = (count: number) => countText('deviceGroups.counts.groupsSelected', count);
  const selectedDeviceCountText = (count: number) => countText('deviceGroups.counts.devicesSelected', count);
  const osLabel = (os: OSType) => t(`devices.osNames.${os}`, undefined, osLabels[os]);
  const groupTypeLabel = (type: GroupType) => t(`devices.groupTypes.${type}`, undefined, type);

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      setError(undefined);
      const response = await fetchWithAuth('/device-groups');
      if (!response.ok) {
        throw new Error(t('deviceGroups.errors.fetchGroups'));
      }
      const data = await response.json();
      const nextGroups = (data.groups ?? data ?? []).map(normalizeGroup);
      setGroups(nextGroups);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('deviceGroups.errors.fetchGroups'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchDevices = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/devices');
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices ?? data ?? []);
      }
    } catch {
      // Devices are optional for the page to render.
    }
  }, []);

  const fetchSites = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/sites');
      if (response.ok) {
        const data = await response.json();
        setSites(data.sites ?? data ?? []);
      }
    } catch {
      // Sites are optional and can be derived from device data.
    }
  }, []);

  const fetchPolicies = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/policies');
      if (response.ok) {
        const data = await response.json();
        setPolicies(data.policies ?? data ?? []);
      }
    } catch {
      // Policies are optional for this page.
    }
  }, []);

  const fetchScripts = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/scripts');
      if (response.ok) {
        const data = await response.json();
        setScripts(data.scripts ?? data ?? []);
      }
    } catch {
      // Scripts are optional for this page.
    }
  }, []);

  useEffect(() => {
    fetchGroups();
    fetchDevices();
    fetchSites();
    fetchPolicies();
    fetchScripts();
  }, [fetchGroups, fetchDevices, fetchPolicies, fetchScripts, fetchSites]);

  useEffect(() => {
    setSelectedGroupIds(prev => {
      const next = new Set<string>();
      groups.forEach(group => {
        if (prev.has(group.id)) {
          next.add(group.id);
        }
      });
      return next;
    });
  }, [groups]);

  const buildRule = (field: RuleField = 'os'): DeviceGroupRule => {
    const defaultOperator = ruleOperatorOptions[field][0]?.value ?? 'is';
    const defaultValue =
      field === 'os'
        ? 'windows'
        : field === 'site'
          ? siteOptions[0]?.id ?? ''
          : field === 'tag'
            ? tagOptions[0] ?? ''
            : '';
    return {
      id: createId(),
      field,
      operator: defaultOperator,
      value: defaultValue
    };
  };

  const resetForm = (group?: DeviceGroup) => {
    if (group) {
      // Migrate legacy rules to filter conditions if needed
      const filterConditions = group.rules && group.rules.length > 0
        ? legacyRulesToFilterConditions(group.rules)
        : EMPTY_FILTER;

      setGroupForm({
        name: group.name ?? '',
        description: group.description ?? '',
        type: group.type ?? 'static',
        policyId: group.policyId ?? '',
        rules: group.rules ? [...group.rules] : [],
        deviceIds: group.deviceIds ? [...group.deviceIds] : group.devices?.map(device => device.id) ?? [],
        filterConditions
      });
    } else {
      setGroupForm({
        name: '',
        description: '',
        type: 'static',
        policyId: '',
        rules: [],
        deviceIds: [],
        filterConditions: EMPTY_FILTER
      });
    }
    setAssignmentQuery('');
    setFormError(undefined);
  };

  const handleOpenCreate = () => {
    setSelectedGroup(null);
    resetForm();
    setModalMode('create');
  };

  const handleOpenEdit = (group: DeviceGroup) => {
    setSelectedGroup(group);
    resetForm(group);
    setModalMode('edit');
  };

  const handleOpenDelete = (group: DeviceGroup) => {
    setSelectedGroup(group);
    setDeleteReassignGroupId('');
    setModalMode('delete');
  };

  const handleCloseModal = () => {
    setModalMode('closed');
    setSelectedGroup(null);
    setFormError(undefined);
    setBulkScriptId('');
    setBulkPolicyId('');
    setDeleteReassignGroupId('');
  };

  const matchesRule = (device: Device, rule: DeviceGroupRule): boolean => {
    const normalizedValue = rule.value.trim().toLowerCase();
    if (!normalizedValue) return false;

    if (rule.field === 'os') {
      const match = device.os.toLowerCase() === normalizedValue;
      return rule.operator === 'is' ? match : !match;
    }

    if (rule.field === 'site') {
      const siteIdMatch = device.siteId?.toLowerCase() === normalizedValue;
      const siteNameMatch = device.siteName?.toLowerCase() === normalizedValue;
      const match = siteIdMatch || siteNameMatch;
      return rule.operator === 'is' ? match : !match;
    }

    if (rule.field === 'tag') {
      const hasTag = device.tags?.some((tag: string) => tag.toLowerCase() === normalizedValue) ?? false;
      return rule.operator === 'contains' ? hasTag : !hasTag;
    }

    const hostname = device.hostname.toLowerCase();
    if (rule.operator === 'contains' || rule.operator === 'not_contains') {
      const match = hostname.includes(normalizedValue);
      return rule.operator === 'contains' ? match : !match;
    }

    const regexMatch = (() => {
      try {
        return new RegExp(rule.value, 'i').test(device.hostname);
      } catch {
        return hostname.includes(normalizedValue);
      }
    })();
    return rule.operator === 'matches' ? regexMatch : !regexMatch;
  };

  const getDynamicDeviceIds = (rules: DeviceGroupRule[] = []): string[] => {
    if (rules.length === 0) return [];
    return devices
      .filter(device => rules.every(rule => matchesRule(device, rule)))
      .map(device => device.id);
  };

  const getGroupDeviceIds = (group: DeviceGroup): string[] => {
    if (group.type === 'dynamic') {
      if (group.deviceIds && group.deviceIds.length > 0) {
        return group.deviceIds;
      }
      return getDynamicDeviceIds(group.rules ?? []);
    }
    return group.deviceIds ?? group.devices?.map(device => device.id) ?? [];
  };

  const getGroupDeviceCount = (group: DeviceGroup): number => {
    if (typeof group.deviceCount === 'number') {
      return group.deviceCount;
    }
    return getGroupDeviceIds(group).length;
  };

  const updateGroup = async (group: DeviceGroup, overrides: Partial<DeviceGroup> = {}) => {
    const nextGroup = { ...group, ...overrides };
    const payload = {
      name: nextGroup.name,
      description: nextGroup.description ?? '',
      type: nextGroup.type,
      rules: nextGroup.type === 'dynamic' ? nextGroup.rules ?? [] : [],
      deviceIds: nextGroup.type === 'static' ? nextGroup.deviceIds ?? [] : [],
      policyId: nextGroup.policyId || null
    };

    const response = await fetchWithAuth(`/device-groups/${nextGroup.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(t('deviceGroups.errors.updateGroup'));
    }
  };

  const handleSubmitGroup = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = groupForm.name.trim();
    if (!trimmedName) {
      setFormError(t('deviceGroups.errors.nameRequired'));
      return;
    }
    if (groupForm.type === 'dynamic') {
      const hasValidCondition = groupForm.filterConditions.conditions.some(c => {
        if ('conditions' in c) return true;
        return c.value !== '' && c.value !== null && c.value !== undefined;
      });
      if (!hasValidCondition) {
        setFormError(t('deviceGroups.errors.dynamicConditionRequired'));
        return;
      }
    }

    setSubmitting(true);
    setFormError(undefined);

    try {
      const payload = {
        name: trimmedName,
        description: groupForm.description.trim(),
        type: groupForm.type,
        rules: groupForm.type === 'dynamic' ? groupForm.rules : [],
        filterConditions: groupForm.type === 'dynamic' ? groupForm.filterConditions : null,
        deviceIds: groupForm.type === 'static' ? groupForm.deviceIds : [],
        policyId: groupForm.policyId || null
      };

      const url = modalMode === 'edit' && selectedGroup
        ? `/device-groups/${selectedGroup.id}`
        : '/device-groups';
      const method = modalMode === 'edit' ? 'PUT' : 'POST';

      const response = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(t('deviceGroups.errors.saveGroup'));
      }

      await fetchGroups();
      handleCloseModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('deviceGroups.errors.saveGroup'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedGroup) return;
    setSubmitting(true);
    setFormError(undefined);
    try {
      const response = await fetchWithAuth(`/device-groups/${selectedGroup.id}`, {
        method: 'DELETE',
        body: JSON.stringify({
          reassignGroupId: deleteReassignGroupId || null
        })
      });

      if (!response.ok) {
        throw new Error(t('deviceGroups.errors.deleteGroup'));
      }

      await fetchGroups();
      handleCloseModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('deviceGroups.errors.deleteGroup'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkScript = async () => {
    if (!bulkScriptId || selectedGroupIds.size === 0) return;
    setSubmitting(true);
    try {
      const response = await fetchWithAuth('/device-groups/bulk', {
        method: 'POST',
        body: JSON.stringify({
          action: 'run-script',
          scriptId: bulkScriptId,
          groupIds: Array.from(selectedGroupIds)
        })
      });

      if (!response.ok) {
        throw new Error(t('deviceGroups.errors.runScript'));
      }

      await fetchGroups();
      setSelectedGroupIds(new Set());
      handleCloseModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('deviceGroups.errors.runScript'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkPolicy = async () => {
    if (!bulkPolicyId || selectedGroupIds.size === 0) return;
    setSubmitting(true);
    try {
      const response = await fetchWithAuth('/device-groups/bulk', {
        method: 'POST',
        body: JSON.stringify({
          action: 'apply-policy',
          policyId: bulkPolicyId,
          groupIds: Array.from(selectedGroupIds)
        })
      });

      if (!response.ok) {
        throw new Error(t('deviceGroups.errors.applyPolicy'));
      }

      await fetchGroups();
      setSelectedGroupIds(new Set());
      handleCloseModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('deviceGroups.errors.applyPolicy'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDropDevice = async (targetGroupId: string, payload: DragPayload | null) => {
    const dragPayload = payload ?? draggingDevice;
    if (!dragPayload) return;
    if (dragPayload.fromGroupId === targetGroupId) return;

    const sourceGroup = groups.find(group => group.id === dragPayload.fromGroupId);
    const targetGroup = groups.find(group => group.id === targetGroupId);
    if (!sourceGroup || !targetGroup) return;
    if (sourceGroup.type !== 'static' || targetGroup.type !== 'static') return;

    const sourceIds = sourceGroup.deviceIds ?? [];
    const targetIds = targetGroup.deviceIds ?? [];
    if (!sourceIds.includes(dragPayload.deviceId)) return;

    const nextSourceIds = sourceIds.filter(id => id !== dragPayload.deviceId);
    const nextTargetIds = Array.from(new Set([...targetIds, dragPayload.deviceId]));

    setGroups(prev =>
      prev.map(group => {
        if (group.id === sourceGroup.id) {
          return { ...group, deviceIds: nextSourceIds };
        }
        if (group.id === targetGroup.id) {
          return { ...group, deviceIds: nextTargetIds };
        }
        return group;
      })
    );

    setDraggingDevice(null);
    setDragOverGroupId(null);

    try {
      await Promise.all([
        updateGroup(sourceGroup, { deviceIds: nextSourceIds }),
        updateGroup(targetGroup, { deviceIds: nextTargetIds })
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('deviceGroups.errors.moveDevice'));
      await fetchGroups();
    }
  };

  const toggleGroupSelection = (groupId: string, checked: boolean) => {
    setSelectedGroupIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(groupId);
      } else {
        next.delete(groupId);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedGroupIds(new Set());
      return;
    }
    setSelectedGroupIds(new Set(groups.map(group => group.id)));
  };

  const allSelected = groups.length > 0 && groups.every(group => selectedGroupIds.has(group.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">{t('deviceGroups.loading')}</p>
        </div>
      </div>
    );
  }

  if (error && groups.length === 0) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <button
          type="button"
          onClick={fetchGroups}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {t('devices.page.tryAgain')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('deviceGroups.title')}</h1>
          <p className="text-muted-foreground">
            {t('deviceGroups.description')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          {t('deviceGroups.createGroup')}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {selectedGroupIds.size > 0 && (
        <div className="flex flex-col gap-3 rounded-md border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-medium">
            {selectedGroupCountText(selectedGroupIds.size)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setModalMode('bulk-script')}
              className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition hover:bg-muted"
            >
              <Play className="h-4 w-4" />
              {t('deviceGroups.runScript')}
            </button>
            <button
              type="button"
              onClick={() => setModalMode('bulk-policy')}
              className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition hover:bg-muted"
            >
              <Shield className="h-4 w-4" />
              {t('deviceGroups.applyPolicy')}
            </button>
            <button
              type="button"
              onClick={() => setSelectedGroupIds(new Set())}
              className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted"
            >
              {t('deviceGroups.clearSelection')}
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t('deviceGroups.empty')}
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            {t('deviceGroups.createFirst')}
          </button>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={event => handleSelectAll(event.target.checked)}
              className="h-4 w-4 rounded border-muted text-primary focus:ring-primary"
            />
            {t('deviceGroups.selectAll')}
          </div>
          <div className="space-y-4">
            {groups.map(group => {
              const deviceIds = getGroupDeviceIds(group);
              const groupDevices = deviceIds
                .map(id => deviceById.get(id))
                .filter((device): device is Device => Boolean(device));
              const deviceCount = getGroupDeviceCount(group);
              const isSelected = selectedGroupIds.has(group.id);
              const isDragOver = dragOverGroupId === group.id;

              return (
                <div key={group.id} className="rounded-lg border bg-background p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={event => toggleGroupSelection(group.id, event.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-muted text-primary focus:ring-primary"
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold">{group.name}</h2>
                          <span className="rounded-full border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {groupTypeLabel(group.type)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {group.description?.trim().length ? group.description : t('deviceGroups.noDescription')}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="rounded-full border bg-muted px-2 py-0.5">
                            {deviceCountText(deviceCount)}
                          </span>
                          <span className="rounded-full border bg-muted px-2 py-0.5">
                            {t('deviceGroups.policyChip', {
                              policy: group.policyName || t('deviceGroups.notAssigned'),
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(group)}
                        className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition hover:bg-muted"
                      >
                        <Pencil className="h-4 w-4" />
                        {t('deviceGroups.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDelete(group)}
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-destructive/40 px-3 text-sm font-medium text-destructive transition hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                        {t('deviceGroups.delete')}
                      </button>
                    </div>
                  </div>

                  {group.type === 'dynamic' ? (
                    <div className="mt-4 rounded-md border bg-muted/20 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{t('deviceGroups.autoRules')}</p>
                        <span className="text-xs text-muted-foreground">
                          {countText('deviceGroups.counts.matchesDevices', deviceCount)}
                        </span>
                      </div>
                      {group.rules && group.rules.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {group.rules.map(rule => (
                            <span
                              key={rule.id}
                              className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground"
                            >
                              {buildRuleLabel(rule, siteNameById, t)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">{t('deviceGroups.noRules')}</p>
                      )}
                    </div>
                  ) : (
                    <div
                      className={`mt-4 rounded-md border border-dashed p-4 transition ${
                        isDragOver ? 'border-primary/60 bg-primary/5' : 'border-muted-foreground/30 bg-muted/20'
                      }`}
                      onDragOver={event => {
                        if (draggingDevice?.fromGroupId === group.id) return;
                        event.preventDefault();
                        setDragOverGroupId(group.id);
                      }}
                      onDragLeave={() => setDragOverGroupId(null)}
                      onDrop={event => {
                        event.preventDefault();
                        const payload = draggingDevice ?? parseDragPayload(event);
                        handleDropDevice(group.id, payload);
                      }}
                    >
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{t('deviceGroups.devices')}</span>
                        <span>{t('deviceGroups.dragHint')}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {groupDevices.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            {t('deviceGroups.dropHint')}
                          </span>
                        ) : (
                          groupDevices.map(device => (
                            <div
                              key={device.id}
                              draggable
                              onDragStart={event => {
                                const payload = {
                                  deviceId: device.id,
                                  fromGroupId: group.id
                                };
                                setDraggingDevice(payload);
                                event.dataTransfer.setData('text/plain', JSON.stringify(payload));
                              }}
                              onDragEnd={() => setDraggingDevice(null)}
                              className="flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/40 cursor-grab"
                            >
                              <span className="font-medium text-foreground">{device.hostname}</span>
                              <span>{osLabel(device.os)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(modalMode === 'create' || modalMode === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-8 overflow-y-auto">
          <div className="w-full max-w-3xl my-8 rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {modalMode === 'create' ? t('deviceGroups.createModalTitle') : t('deviceGroups.editModalTitle')}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {modalMode === 'create'
                    ? t('deviceGroups.createModalDescription')
                    : t('deviceGroups.editModalDescription')}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                title={t('common.cancel')}
                className="rounded-md p-2 text-muted-foreground transition hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="mt-6 space-y-6" onSubmit={handleSubmitGroup}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">{t('deviceGroups.groupName')}</label>
                  <input
                    type="text"
                    value={groupForm.name}
                    onChange={event => setGroupForm(prev => ({ ...prev, name: event.target.value }))}
                    className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder={t('deviceGroups.groupNamePlaceholder')}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('deviceGroups.policyAssignment')}</label>
                  <select
                    value={groupForm.policyId}
                    onChange={event => setGroupForm(prev => ({ ...prev, policyId: event.target.value }))}
                    className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">{t('deviceGroups.noPolicyAssigned')}</option>
                    {policies.map(policy => (
                      <option key={policy.id} value={policy.id}>
                        {policy.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">{t('deviceGroups.formDescription')}</label>
                <textarea
                  value={groupForm.description}
                  onChange={event => setGroupForm(prev => ({ ...prev, description: event.target.value }))}
                  className="mt-2 min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={t('deviceGroups.descriptionPlaceholder')}
                />
              </div>

              <div>
                <label className="text-sm font-medium">{t('deviceGroups.groupType')}</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setGroupForm(prev => ({
                        ...prev,
                        type: 'static'
                      }))
                    }
                    className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition ${
                      groupForm.type === 'static'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'hover:bg-muted'
                    }`}
                  >
                    {groupTypeLabel('static')}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setGroupForm(prev => ({
                        ...prev,
                        type: 'dynamic',
                        rules: prev.rules.length > 0 ? prev.rules : [buildRule()],
                        filterConditions: prev.filterConditions.conditions.length > 0
                          ? prev.filterConditions
                          : EMPTY_FILTER
                      }))
                    }
                    className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition ${
                      groupForm.type === 'dynamic'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'hover:bg-muted'
                    }`}
                  >
                    {groupTypeLabel('dynamic')}
                  </button>
                </div>
              </div>

              {groupForm.type === 'dynamic' ? (
                <div className="rounded-md border bg-muted/20 p-4 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold">{t('deviceGroups.autoFilter')}</h3>
                    <p className="text-xs text-muted-foreground">
                      {t('deviceGroups.autoFilterDescription')}
                    </p>
                  </div>
                  <FilterBuilder
                    value={groupForm.filterConditions}
                    onChange={(conditions) => setGroupForm(prev => ({ ...prev, filterConditions: conditions }))}
                    filterFields={DEFAULT_FILTER_FIELDS}
                    showPreview={false}
                  />
                  <FilterPreview
                    preview={formPreview}
                    loading={formPreviewLoading}
                    error={formPreviewError}
                    onRefresh={formPreviewRefresh}
                  />
                </div>
              ) : (
                <div className="rounded-md border bg-muted/20 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">{t('deviceGroups.manualAssignment')}</h3>
                      <p className="text-xs text-muted-foreground">
                        {t('deviceGroups.manualAssignmentDescription')}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {selectedDeviceCountText(groupForm.deviceIds.length)}
                    </span>
                  </div>
                  <div className="mt-3">
                    <input
                      type="search"
                      value={assignmentQuery}
                      onChange={event => setAssignmentQuery(event.target.value)}
                      placeholder={t('deviceGroups.searchDevices')}
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="mt-3 max-h-56 overflow-y-auto space-y-2">
                    {filteredAssignmentDevices.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t('deviceGroups.noDevicesMatch')}</p>
                    ) : (
                      filteredAssignmentDevices.map(device => {
                        const checked = groupForm.deviceIds.includes(device.id);
                        return (
                          <label
                            key={device.id}
                            className="flex items-center gap-3 rounded-md border bg-background px-3 py-2 text-xs transition hover:bg-muted/40"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={event => {
                                const isChecked = event.target.checked;
                                setGroupForm(prev => {
                                  const nextIds = new Set(prev.deviceIds);
                                  if (isChecked) {
                                    nextIds.add(device.id);
                                  } else {
                                    nextIds.delete(device.id);
                                  }
                                  return { ...prev, deviceIds: Array.from(nextIds) };
                                });
                              }}
                              className="h-4 w-4 rounded border-muted text-primary focus:ring-primary"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">{device.hostname}</p>
                              <p className="text-xs text-muted-foreground">
                                {osLabel(device.os)} · {device.siteName}
                              </p>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {formError && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {formError}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="h-10 rounded-md border px-4 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? modalMode === 'create'
                      ? t('deviceGroups.creating')
                      : t('common.saving')
                    : modalMode === 'create'
                      ? t('deviceGroups.createGroupLower')
                      : t('common.saveChanges')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalMode === 'delete' && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-8">
          <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">{t('deviceGroups.deleteModalTitle')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('deviceGroups.deleteConfirmPrefix')}{' '}
              <span className="font-medium">{selectedGroup.name}</span>?
              {' '}
              {countText('deviceGroups.counts.deleteRemovesDevices', getGroupDeviceCount(selectedGroup))}
            </p>
            <div className="mt-4">
              <label className="text-sm font-medium">{t('deviceGroups.reassignDevices')}</label>
              <select
                value={deleteReassignGroupId}
                onChange={event => setDeleteReassignGroupId(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{t('deviceGroups.leaveUnassigned')}</option>
                {groups
                  .filter(group => group.id !== selectedGroup.id && group.type === 'static')
                  .map(group => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
              </select>
            </div>
            {formError && (
              <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="h-10 rounded-md border px-4 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                >
                  {t('common.cancel')}
                </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={submitting}
                className="inline-flex h-10 items-center justify-center rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? t('deviceGroups.deleting') : t('deviceGroups.deleteGroupLower')}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalMode === 'bulk-script' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-8">
          <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">{t('deviceGroups.runScriptModalTitle')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {countText('deviceGroups.counts.runScriptSelection', selectedGroupIds.size)}
            </p>
            <div className="mt-4">
              <label className="text-sm font-medium">{t('deviceGroups.script')}</label>
              <select
                value={bulkScriptId}
                onChange={event => setBulkScriptId(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{t('deviceGroups.selectScript')}</option>
                {scripts.map(script => (
                  <option key={script.id} value={script.id}>
                    {script.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="h-10 rounded-md border px-4 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                >
                  {t('common.cancel')}
                </button>
              <button
                type="button"
                onClick={handleBulkScript}
                disabled={submitting || !bulkScriptId}
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? t('deviceGroups.running') : t('deviceGroups.runScript')}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalMode === 'bulk-policy' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-8">
          <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">{t('deviceGroups.applyPolicyModalTitle')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {countText('deviceGroups.counts.applyPolicySelection', selectedGroupIds.size)}
            </p>
            <div className="mt-4">
              <label className="text-sm font-medium">{t('deviceGroups.policy')}</label>
              <select
                value={bulkPolicyId}
                onChange={event => setBulkPolicyId(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{t('deviceGroups.selectPolicy')}</option>
                {policies.map(policy => (
                  <option key={policy.id} value={policy.id}>
                    {policy.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="h-10 rounded-md border px-4 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                >
                  {t('common.cancel')}
                </button>
              <button
                type="button"
                onClick={handleBulkPolicy}
                disabled={submitting || !bulkPolicyId}
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? t('deviceGroups.applying') : t('deviceGroups.applyPolicy')}
              </button>
            </div>
          </div>
        </div>
      )}

      {tagOptions.length > 0 && (
        <datalist id="tag-options">
          {tagOptions.map(tag => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
      )}
    </div>
  );
}
