import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchWithAuth } from '@/stores/auth';
import {
  AlertTriangle,
  BarChart3,
  Grip,
  LayoutDashboard,
  Monitor,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Share2
} from 'lucide-react';
import { cn, gridColSpanClass, gridColStartClass, gridRowSpanClass, gridRowStartClass } from '@/lib/utils';
import { formatNumber } from '@/i18n/formatters';
import { useI18n } from '@/i18n/react';

const GRID_COLUMNS = 12;
const ROW_HEIGHT = 120;
const DRAG_TYPE = 'application/x-dashboard-widget';

type WidgetType = 'device-count' | 'alert-summary' | 'chart';

type WidgetSettings = {
  refreshInterval: number;
  showTrend?: boolean;
  severityFilter?: 'all' | 'critical' | 'high' | 'medium' | 'low';
  chartType?: 'line' | 'bar' | 'area';
  timeRange?: '24h' | '7d' | '30d';
  showLegend?: boolean;
};

type DashboardWidget = {
  id: string;
  type: WidgetType;
  title: string;
  titleKey?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  settings: WidgetSettings;
};

type Dashboard = {
  id: string;
  name: string;
  nameKey?: string;
  widgets: DashboardWidget[];
  sharedWith: string[];
};

type ResizeState = {
  widgetId: string;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
};

const widgetCatalog = [
  {
    type: 'device-count',
    title: 'Device Count',
    titleKey: 'dashboard.customizer.catalog.deviceCount.title',
    description: 'Track online and offline devices',
    descriptionKey: 'dashboard.customizer.catalog.deviceCount.description',
    icon: Monitor,
    defaultSize: { w: 4, h: 2 },
    minSize: { w: 3, h: 2 },
    defaultSettings: { refreshInterval: 5, showTrend: true }
  },
  {
    type: 'alert-summary',
    title: 'Alert Summary',
    titleKey: 'dashboard.customizer.catalog.alertSummary.title',
    description: 'Active alerts by severity',
    descriptionKey: 'dashboard.customizer.catalog.alertSummary.description',
    icon: AlertTriangle,
    defaultSize: { w: 4, h: 2 },
    minSize: { w: 3, h: 2 },
    defaultSettings: { refreshInterval: 3, severityFilter: 'all' }
  },
  {
    type: 'chart',
    title: 'Charts',
    titleKey: 'dashboard.customizer.catalog.charts.title',
    description: 'Performance and trend charts',
    descriptionKey: 'dashboard.customizer.catalog.charts.description',
    icon: BarChart3,
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 4, h: 2 },
    defaultSettings: {
      refreshInterval: 10,
      chartType: 'line',
      timeRange: '24h',
      showLegend: true
    }
  }
] as const;

const DEFAULT_DASHBOARDS: Dashboard[] = [
  {
    id: 'ops',
    name: 'Operations Overview',
    nameKey: 'dashboard.customizer.defaults.ops',
    sharedWith: ['ops-team@breeze.dev'],
    widgets: [
      {
        id: 'ops-devices',
        type: 'device-count',
        title: 'Device Count',
        titleKey: 'dashboard.customizer.catalog.deviceCount.title',
        x: 0,
        y: 0,
        w: 4,
        h: 2,
        settings: { refreshInterval: 5, showTrend: true }
      },
      {
        id: 'ops-alerts',
        type: 'alert-summary',
        title: 'Alert Summary',
        titleKey: 'dashboard.customizer.catalog.alertSummary.title',
        x: 4,
        y: 0,
        w: 4,
        h: 2,
        settings: { refreshInterval: 3, severityFilter: 'high' }
      },
      {
        id: 'ops-chart',
        type: 'chart',
        title: 'Fleet Trends',
        titleKey: 'dashboard.customizer.defaults.fleetTrends',
        x: 0,
        y: 2,
        w: 8,
        h: 3,
        settings: {
          refreshInterval: 10,
          chartType: 'line',
          timeRange: '7d',
          showLegend: true
        }
      }
    ]
  },
  {
    id: 'security',
    name: 'Security Focus',
    nameKey: 'dashboard.customizer.defaults.security',
    sharedWith: [],
    widgets: [
      {
        id: 'security-alerts',
        type: 'alert-summary',
        title: 'Critical Alerts',
        titleKey: 'dashboard.customizer.defaults.criticalAlerts',
        x: 0,
        y: 0,
        w: 5,
        h: 2,
        settings: { refreshInterval: 2, severityFilter: 'critical' }
      },
      {
        id: 'security-chart',
        type: 'chart',
        title: 'Risk Trend',
        titleKey: 'dashboard.customizer.defaults.riskTrend',
        x: 5,
        y: 0,
        w: 7,
        h: 3,
        settings: {
          refreshInterval: 15,
          chartType: 'area',
          timeRange: '30d',
          showLegend: false
        }
      }
    ]
  }
];

const DEFAULT_ROLE_MAP: Record<string, string> = {
  Admin: 'ops',
  Technician: 'ops',
  Viewer: 'security'
};

const ROLE_OPTIONS = ['Admin', 'Technician', 'Viewer'];

const cloneWidgets = (widgets: DashboardWidget[]) =>
  widgets.map((widget) => ({
    ...widget,
    settings: { ...widget.settings }
  }));

const cloneDashboards = (dashboards: Dashboard[]) =>
  dashboards.map((dashboard) => ({
    ...dashboard,
    widgets: cloneWidgets(dashboard.widgets),
    sharedWith: [...dashboard.sharedWith]
  }));

let idCounter = 0;
const createId = (prefix: string = 'id') => {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const isOverlap = (a: DashboardWidget, b: DashboardWidget) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const findOpenPosition = (w: number, h: number, widgets: DashboardWidget[]) => {
  const maxRows = 20;
  for (let y = 0; y < maxRows; y += 1) {
    for (let x = 0; x <= GRID_COLUMNS - w; x += 1) {
      const candidate: DashboardWidget = {
        id: 'candidate',
        type: 'device-count',
        title: '',
        x,
        y,
        w,
        h,
        settings: { refreshInterval: 5 }
      };
      if (!widgets.some((widget) => isOverlap(candidate, widget))) {
        return { x, y };
      }
    }
  }
  const maxY = widgets.reduce((acc, widget) => Math.max(acc, widget.y + widget.h), 0);
  return { x: 0, y: maxY + 1 };
};

export default function DashboardCustomizer() {
  const { locale, t } = useI18n();
  const [dashboards, setDashboards] = useState<Dashboard[]>(() => cloneDashboards(DEFAULT_DASHBOARDS));
  const [activeDashboardId, setActiveDashboardId] = useState<string>(
    () => DEFAULT_DASHBOARDS[0]?.id ?? ''
  );
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [newDashboardName, setNewDashboardName] = useState('');
  const [shareInput, setShareInput] = useState('');
  const [defaultByRole, setDefaultByRole] = useState<Record<string, string>>(() => ({
    ...DEFAULT_ROLE_MAP
  }));
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [draggingWidgetId, setDraggingWidgetId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  const activeDashboard = useMemo(
    () => dashboards.find((dashboard) => dashboard.id === activeDashboardId) ?? dashboards[0],
    [dashboards, activeDashboardId]
  );

  const activeWidgets = activeDashboard?.widgets ?? [];
  const selectedWidget = activeWidgets.find((widget) => widget.id === selectedWidgetId) ?? null;

  useEffect(() => {
    if (!dashboards.length) return;
    const exists = dashboards.some((dashboard) => dashboard.id === activeDashboardId);
    if (!exists) {
      setActiveDashboardId(dashboards[0].id);
    }
  }, [dashboards, activeDashboardId]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const updateActiveDashboard = useCallback(
    (updater: (dashboard: Dashboard) => Dashboard) => {
      if (!activeDashboardId) return;
      setDashboards((prev) =>
        prev.map((dashboard) =>
          dashboard.id === activeDashboardId ? updater(dashboard) : dashboard
        )
      );
    },
    [activeDashboardId]
  );

  const updateWidget = useCallback(
    (widgetId: string, updater: (widget: DashboardWidget) => DashboardWidget) => {
      updateActiveDashboard((dashboard) => ({
        ...dashboard,
        widgets: dashboard.widgets.map((widget) =>
          widget.id === widgetId ? updater(widget) : widget
        )
      }));
    },
    [updateActiveDashboard]
  );

  const handleAddWidget = useCallback(
    (type: WidgetType, position?: { x: number; y: number }) => {
      if (!activeDashboard) return;
      const catalog = widgetCatalog.find((entry) => entry.type === type);
      if (!catalog) return;

      const { w, h } = catalog.defaultSize;
      const proposed = position
        ? {
            x: clamp(position.x, 0, GRID_COLUMNS - w),
            y: Math.max(0, position.y)
          }
        : findOpenPosition(w, h, activeDashboard.widgets);
      const candidate: DashboardWidget = {
        id: createId('widget'),
        type,
        title: catalog.title,
        titleKey: catalog.titleKey,
        x: proposed.x,
        y: proposed.y,
        w,
        h,
        settings: { ...catalog.defaultSettings }
      };

      const hasCollision = activeDashboard.widgets.some((widget) => isOverlap(candidate, widget));
      const finalPosition = hasCollision ? findOpenPosition(w, h, activeDashboard.widgets) : proposed;

      updateActiveDashboard((dashboard) => ({
        ...dashboard,
        widgets: [
          ...dashboard.widgets,
          {
            ...candidate,
            x: finalPosition.x,
            y: finalPosition.y
          }
        ]
      }));
      setSelectedWidgetId(candidate.id);
    },
    [activeDashboard, updateActiveDashboard]
  );

  const handleMoveWidget = useCallback(
    (widgetId: string, position: { x: number; y: number }) => {
      const widget = activeWidgets.find((item) => item.id === widgetId);
      if (!widget) return;
      const otherWidgets = activeWidgets.filter((item) => item.id !== widgetId);
      const proposed = {
        x: clamp(position.x, 0, GRID_COLUMNS - widget.w),
        y: Math.max(0, position.y)
      };
      const candidate = { ...widget, ...proposed };
      const finalPosition = otherWidgets.some((item) => isOverlap(candidate, item))
        ? findOpenPosition(widget.w, widget.h, otherWidgets)
        : proposed;

      updateWidget(widgetId, (prevWidget) => ({
        ...prevWidget,
        x: finalPosition.x,
        y: finalPosition.y
      }));
    },
    [activeWidgets, updateWidget]
  );

  const handleRemoveWidget = useCallback(
    (widgetId: string) => {
      updateActiveDashboard((dashboard) => ({
        ...dashboard,
        widgets: dashboard.widgets.filter((widget) => widget.id !== widgetId)
      }));
      setSelectedWidgetId((current) => (current === widgetId ? null : current));
    },
    [updateActiveDashboard]
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragOver(false);
      if (!gridRef.current) return;

      const payload = event.dataTransfer.getData(DRAG_TYPE);
      if (!payload) return;
      let data: { source: 'library' | 'canvas'; widgetType?: WidgetType; widgetId?: string };
      try {
        data = JSON.parse(payload);
      } catch {
        return;
      }

      const rect = gridRef.current.getBoundingClientRect();
      const colWidth = rect.width / GRID_COLUMNS;
      const x = Math.floor((event.clientX - rect.left) / colWidth);
      const y = Math.floor((event.clientY - rect.top) / ROW_HEIGHT);
      const position = { x, y };

      if (data.source === 'library' && data.widgetType) {
        handleAddWidget(data.widgetType, position);
      }
      if (data.source === 'canvas' && data.widgetId) {
        handleMoveWidget(data.widgetId, position);
      }
    },
    [handleAddWidget, handleMoveWidget]
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleRevertLayout = useCallback(() => {
    const defaultDashboard = DEFAULT_DASHBOARDS.find(
      (dashboard) => dashboard.id === activeDashboardId
    );
    updateActiveDashboard((dashboard) => ({
      ...dashboard,
      widgets: defaultDashboard ? cloneWidgets(defaultDashboard.widgets) : []
    }));
    setSelectedWidgetId(null);
  }, [activeDashboardId, updateActiveDashboard]);

  const handleCreateDashboard = useCallback(() => {
    const name = newDashboardName.trim();
    if (!name) return;
    const dashboard: Dashboard = {
      id: createId('dashboard'),
      name,
      widgets: [],
      sharedWith: []
    };
    setDashboards((prev) => [...prev, dashboard]);
    setActiveDashboardId(dashboard.id);
    setNewDashboardName('');
    setSelectedWidgetId(null);
  }, [newDashboardName]);

  const handleShareAdd = useCallback(() => {
    const value = shareInput.trim();
    if (!value) return;
    updateActiveDashboard((dashboard) => ({
      ...dashboard,
      sharedWith: dashboard.sharedWith.includes(value)
        ? dashboard.sharedWith
        : [...dashboard.sharedWith, value]
    }));
    setShareInput('');
  }, [shareInput, updateActiveDashboard]);

  const handleShareRemove = useCallback(
    (email: string) => {
      updateActiveDashboard((dashboard) => ({
        ...dashboard,
        sharedWith: dashboard.sharedWith.filter((entry) => entry !== email)
      }));
    },
    [updateActiveDashboard]
  );

  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    try {
      const response = await fetchWithAuth('/dashboards', {
        method: 'POST',
        body: JSON.stringify({
          dashboards,
          defaultDashboardByRole: defaultByRole
        })
      });
      if (!response.ok) {
        throw new Error(t('dashboard.customizer.errors.saveFailed'));
      }
      setSaveStatus('saved');
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = window.setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Failed to save dashboards:', error);
      setSaveStatus('error');
    }
  }, [dashboards, defaultByRole, t]);

  const handleResizeStart = useCallback(
    (event: React.MouseEvent, widget: DashboardWidget) => {
      event.stopPropagation();
      setResizeState({
        widgetId: widget.id,
        startX: event.clientX,
        startY: event.clientY,
        startW: widget.w,
        startH: widget.h
      });
    },
    []
  );

  useEffect(() => {
    if (!resizeState || !gridRef.current) return;

    const handleMouseMove = (event: MouseEvent) => {
      const widget = activeWidgets.find((item) => item.id === resizeState.widgetId);
      if (!widget) return;
      const rect = gridRef.current?.getBoundingClientRect();
      if (!rect) return;
      const colWidth = rect.width / GRID_COLUMNS;
      const deltaX = event.clientX - resizeState.startX;
      const deltaY = event.clientY - resizeState.startY;
      const deltaCols = Math.round(deltaX / colWidth);
      const deltaRows = Math.round(deltaY / ROW_HEIGHT);

      const config = widgetCatalog.find((entry) => entry.type === widget.type);
      const minW = config?.minSize.w ?? 3;
      const minH = config?.minSize.h ?? 2;

      const nextW = clamp(resizeState.startW + deltaCols, minW, GRID_COLUMNS - widget.x);
      const nextH = Math.max(minH, resizeState.startH + deltaRows);

      updateWidget(widget.id, (prevWidget) => ({
        ...prevWidget,
        w: nextW,
        h: nextH
      }));
    };

    const handleMouseUp = () => {
      setResizeState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizeState, activeWidgets, updateWidget]);

  const handleWidgetDragStart = useCallback((event: DragEvent, widgetId: string) => {
    event.dataTransfer.setData(
      DRAG_TYPE,
      JSON.stringify({
        source: 'canvas',
        widgetId
      })
    );
    event.dataTransfer.effectAllowed = 'move';
    setDraggingWidgetId(widgetId);
  }, []);

  const handleWidgetDragEnd = useCallback(() => {
    setDraggingWidgetId(null);
  }, []);

  const handleLibraryDragStart = useCallback(
    (event: DragEvent, widgetType: WidgetType) => {
      event.dataTransfer.setData(
        DRAG_TYPE,
        JSON.stringify({
          source: 'library',
          widgetType
        })
      );
      event.dataTransfer.effectAllowed = 'copy';
    },
    []
  );

  const handleDashboardNameChange = useCallback(
    (value: string) => {
      updateActiveDashboard((dashboard) => ({
        ...dashboard,
        name: value,
        nameKey: undefined
      }));
    },
    [updateActiveDashboard]
  );

  const updateWidgetSettings = useCallback(
    (key: keyof WidgetSettings, value: WidgetSettings[keyof WidgetSettings]) => {
      if (!selectedWidget) return;
      updateWidget(selectedWidget.id, (widget) => ({
        ...widget,
        settings: {
          ...widget.settings,
          [key]: value
        }
      }));
    },
    [selectedWidget, updateWidget]
  );

  const dashboardName = useCallback(
    (dashboard: Dashboard) => dashboard.nameKey ? t(dashboard.nameKey) : dashboard.name,
    [t]
  );

  const widgetTitle = useCallback(
    (widget: DashboardWidget) => widget.titleKey ? t(widget.titleKey) : widget.title,
    [t]
  );

  const catalogTitle = useCallback((widget: (typeof widgetCatalog)[number]) => t(widget.titleKey), [t]);
  const catalogDescription = useCallback(
    (widget: (typeof widgetCatalog)[number]) => t(widget.descriptionKey),
    [t]
  );

  const widgetTypeLabel = useCallback(
    (type: WidgetType) => {
      const entry = widgetCatalog.find((widget) => widget.type === type);
      return entry ? t(entry.titleKey) : type;
    },
    [t]
  );

  const severityLabel = useCallback(
    (value: NonNullable<WidgetSettings['severityFilter']>) =>
      t(`dashboard.customizer.severity.${value}`),
    [t]
  );

  const chartTypeLabel = useCallback(
    (value: NonNullable<WidgetSettings['chartType']>) =>
      t(`dashboard.customizer.chartTypes.${value}`),
    [t]
  );

  const timeRangeLabel = useCallback(
    (value: NonNullable<WidgetSettings['timeRange']>) =>
      t(`dashboard.customizer.timeRanges.${value}`),
    [t]
  );

  const minutesLabel = useCallback(
    (value: number) => t('dashboard.customizer.minutesShort', { count: formatNumber(value, locale) }),
    [locale, t]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LayoutDashboard className="h-4 w-4" />
            <span>{t('dashboard.customizer.title')}</span>
          </div>
          <select
            value={activeDashboard?.id ?? ''}
            onChange={(event) => {
              setActiveDashboardId(event.target.value);
              setSelectedWidgetId(null);
            }}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            {dashboards.map((dashboard) => (
              <option key={dashboard.id} value={dashboard.id}>
                {dashboardName(dashboard)}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input
              value={newDashboardName}
              onChange={(event) => setNewDashboardName(event.target.value)}
              placeholder={t('dashboard.customizer.newDashboardName')}
              className="h-9 w-48 rounded-md border bg-background px-3 text-sm"
            />
            <button
              type="button"
              onClick={handleCreateDashboard}
              className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              {t('dashboard.customizer.create')}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRevertLayout}
            className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <RotateCcw className="h-4 w-4" />
            {t('dashboard.customizer.revertLayout')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            <Save className="h-4 w-4" />
            {t('dashboard.customizer.saveDashboards')}
          </button>
          {saveStatus !== 'idle' && (
            <span
              className={cn(
                'text-xs font-medium',
                saveStatus === 'saving' && 'text-muted-foreground',
                saveStatus === 'saved' && 'text-success',
                saveStatus === 'error' && 'text-destructive'
              )}
            >
              {saveStatus === 'saving' && t('dashboard.customizer.status.saving')}
              {saveStatus === 'saved' && t('dashboard.customizer.status.saved')}
              {saveStatus === 'error' && t('dashboard.customizer.status.error')}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[260px,1fr,320px]">
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">{t('dashboard.customizer.widgetLibrary')}</h3>
              <p className="text-xs text-muted-foreground">
                {t('dashboard.customizer.widgetLibraryDescription')}
              </p>
            </div>
            <div className="space-y-3">
              {widgetCatalog.map((widget) => {
                const Icon = widget.icon;
                return (
                  <div
                    key={widget.type}
                    draggable
                    onDragStart={(event) => handleLibraryDragStart(event, widget.type)}
                    className="flex items-center gap-3 rounded-md border bg-background p-3 shadow-sm"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{catalogTitle(widget)}</div>
                      <div className="text-xs text-muted-foreground">{catalogDescription(widget)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddWidget(widget.type)}
                      aria-label={t('dashboard.customizer.addWidget', { widget: catalogTitle(widget) })}
                      title={t('dashboard.customizer.addWidget', { widget: catalogTitle(widget) })}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground transition hover:text-foreground"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Share2 className="h-4 w-4 text-muted-foreground" />
              {t('dashboard.customizer.shareDashboard')}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={shareInput}
                onChange={(event) => setShareInput(event.target.value)}
                placeholder={t('dashboard.customizer.sharePlaceholder')}
                className="h-9 flex-1 rounded-md border bg-background px-3 text-sm"
              />
              <button
                type="button"
                onClick={handleShareAdd}
                className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium text-muted-foreground transition hover:text-foreground"
              >
                {t('dashboard.customizer.add')}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {activeDashboard?.sharedWith.length ? (
                activeDashboard.sharedWith.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-xs"
                  >
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => handleShareRemove(email)}
                      className="text-muted-foreground transition hover:text-foreground"
                    >
                      {t('dashboard.customizer.remove')}
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">{t('dashboard.customizer.noSharedUsers')}</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">{t('dashboard.customizer.gridTitle')}</h3>
              <p className="text-xs text-muted-foreground">
                {t('dashboard.customizer.widgetsPlaced', { count: formatNumber(activeWidgets.length, locale) })}
              </p>
            </div>
            <div className="text-xs text-muted-foreground">
              {t('dashboard.customizer.gridHint')}
            </div>
          </div>
          <div
            ref={gridRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={() => setIsDragOver(true)}
            onDragLeave={() => setIsDragOver(false)}
            className={cn(
              'grid min-h-[520px] grid-cols-12 auto-rows-[120px] gap-4 rounded-lg border border-dashed bg-muted/30 p-4 transition',
              isDragOver && 'border-primary/60 ring-2 ring-primary/20'
            )}
          >
            {activeWidgets.map((widget) => {
              const isSelected = widget.id === selectedWidgetId;
              const isDragging = widget.id === draggingWidgetId;
              return (
                <div
                  key={widget.id}
                  draggable
                  onDragStart={(event) => handleWidgetDragStart(event, widget.id)}
                  onDragEnd={handleWidgetDragEnd}
                  onClick={() => setSelectedWidgetId(widget.id)}
                  className={cn(
                    'group relative flex h-full flex-col rounded-md border bg-background p-3 shadow-sm transition',
                    gridColStartClass(widget.x + 1),
                    gridColSpanClass(widget.w),
                    gridRowStartClass(widget.y + 1),
                    gridRowSpanClass(widget.h),
                    isSelected && 'ring-2 ring-primary/60',
                    isDragging && 'opacity-60'
                  )}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Grip className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{widgetTitle(widget)}</span>
                    </div>
                    <button
                      type="button"
                      aria-label={t('dashboard.customizer.configureWidget', { widget: widgetTitle(widget) })}
                      title={t('dashboard.customizer.configureWidget', { widget: widgetTitle(widget) })}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedWidgetId(widget.id);
                      }}
                      className="rounded-md p-1 text-muted-foreground transition hover:text-foreground"
                    >
                      <Settings2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex-1 rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 p-3 text-xs text-muted-foreground">
                    {widget.type === 'device-count' && (
                      <div className="space-y-1">
                        <div className="font-medium text-foreground">
                          {t('dashboard.customizer.preview.devices', { count: formatNumber(1247, locale) })}
                        </div>
                        <div>{t('dashboard.customizer.preview.onlinePercent', { value: formatNumber(95, locale) })}</div>
                        <div>{t('dashboard.customizer.preview.lastRefresh', { value: minutesLabel(widget.settings.refreshInterval) })}</div>
                      </div>
                    )}
                    {widget.type === 'alert-summary' && (
                      <div className="space-y-1">
                        <div className="font-medium text-foreground">
                          {t('dashboard.customizer.preview.activeAlerts', { count: formatNumber(23, locale) })}
                        </div>
                        <div>{t('dashboard.customizer.preview.filter', { value: severityLabel(widget.settings.severityFilter ?? 'all') })}</div>
                        <div>{t('dashboard.customizer.preview.lastRefresh', { value: minutesLabel(widget.settings.refreshInterval) })}</div>
                      </div>
                    )}
                    {widget.type === 'chart' && (
                      <div className="space-y-1">
                        <div className="font-medium text-foreground">{t('dashboard.customizer.preview.trendChart')}</div>
                        <div>
                          {chartTypeLabel(widget.settings.chartType ?? 'line')} · {timeRangeLabel(widget.settings.timeRange ?? '24h')}
                        </div>
                        <div>{t('dashboard.customizer.preview.lastRefresh', { value: minutesLabel(widget.settings.refreshInterval) })}</div>
                      </div>
                    )}
                  </div>
                  <div
                    onMouseDown={(event) => handleResizeStart(event, widget)}
                    className="absolute bottom-2 right-2 h-4 w-4 cursor-nwse-resize rounded-sm border-b-2 border-r-2 border-muted-foreground/60"
                  />
                </div>
              );
            })}
            {!activeWidgets.length && (
              <div className="col-span-12 flex h-full items-center justify-center text-sm text-muted-foreground">
                {t('dashboard.customizer.emptyGrid')}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t('dashboard.customizer.dashboardSettings')}</h3>
              <span className="text-xs text-muted-foreground">{t('dashboard.customizer.layout')}</span>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">{t('dashboard.customizer.dashboardName')}</label>
                <input
                  value={activeDashboard ? dashboardName(activeDashboard) : ''}
                  onChange={(event) => handleDashboardNameChange(event.target.value)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                />
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                {t('dashboard.customizer.dashboardSummary', {
                  widgets: formatNumber(activeWidgets.length, locale),
                  shared: formatNumber(activeDashboard?.sharedWith.length ?? 0, locale)
                })}
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t('dashboard.customizer.widgetSettings')}</h3>
              {selectedWidget && (
                <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {widgetTypeLabel(selectedWidget.type)}
                </span>
              )}
            </div>
            {selectedWidget ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">{t('dashboard.customizer.widgetTitle')}</label>
                  <input
                    value={widgetTitle(selectedWidget)}
                    onChange={(event) =>
                      updateWidget(selectedWidget.id, (widget) => ({
                        ...widget,
                        title: event.target.value,
                        titleKey: undefined
                      }))
                    }
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">{t('dashboard.customizer.refreshInterval')}</label>
                  <input
                    type="number"
                    min={1}
                    value={selectedWidget.settings.refreshInterval}
                    onChange={(event) =>
                      updateWidgetSettings('refreshInterval', Number(event.target.value))
                    }
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  />
                </div>
                {selectedWidget.type === 'device-count' && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={selectedWidget.settings.showTrend ?? false}
                      onChange={(event) =>
                        updateWidgetSettings('showTrend', event.target.checked)
                      }
                      className="h-4 w-4 rounded border"
                    />
                    {t('dashboard.customizer.showDeviceTrend')}
                  </label>
                )}
                {selectedWidget.type === 'alert-summary' && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium">{t('dashboard.customizer.severityFilter')}</label>
                    <select
                      value={selectedWidget.settings.severityFilter ?? 'all'}
                      onChange={(event) =>
                        updateWidgetSettings(
                          'severityFilter',
                          event.target.value as WidgetSettings['severityFilter']
                        )
                      }
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="all">{t('dashboard.customizer.severity.all')}</option>
                      <option value="critical">{t('dashboard.customizer.severity.critical')}</option>
                      <option value="high">{t('dashboard.customizer.severity.high')}</option>
                      <option value="medium">{t('dashboard.customizer.severity.medium')}</option>
                      <option value="low">{t('dashboard.customizer.severity.low')}</option>
                    </select>
                  </div>
                )}
                {selectedWidget.type === 'chart' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">{t('dashboard.customizer.chartType')}</label>
                      <select
                        value={selectedWidget.settings.chartType ?? 'line'}
                        onChange={(event) =>
                          updateWidgetSettings(
                            'chartType',
                            event.target.value as WidgetSettings['chartType']
                          )
                        }
                        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      >
                        <option value="line">{t('dashboard.customizer.chartTypes.line')}</option>
                        <option value="bar">{t('dashboard.customizer.chartTypes.bar')}</option>
                        <option value="area">{t('dashboard.customizer.chartTypes.area')}</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">{t('dashboard.customizer.timeRange')}</label>
                      <select
                        value={selectedWidget.settings.timeRange ?? '24h'}
                        onChange={(event) =>
                          updateWidgetSettings(
                            'timeRange',
                            event.target.value as WidgetSettings['timeRange']
                          )
                        }
                        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      >
                        <option value="24h">{t('dashboard.customizer.timeRanges.24h')}</option>
                        <option value="7d">{t('dashboard.customizer.timeRanges.7d')}</option>
                        <option value="30d">{t('dashboard.customizer.timeRanges.30d')}</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={selectedWidget.settings.showLegend ?? false}
                        onChange={(event) =>
                          updateWidgetSettings('showLegend', event.target.checked)
                        }
                        className="h-4 w-4 rounded border"
                      />
                      {t('dashboard.customizer.showLegend')}
                    </label>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveWidget(selectedWidget.id)}
                  className="inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium text-destructive transition hover:bg-destructive/10"
                >
                  {t('dashboard.customizer.removeWidget')}
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('dashboard.customizer.selectWidget')}
              </p>
            )}
          </div>

          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">{t('dashboard.customizer.defaultByRole')}</h3>
            </div>
            <div className="space-y-3">
              {ROLE_OPTIONS.map((role) => (
                <div key={role} className="space-y-1">
                  <label className="text-xs font-medium">{role}</label>
                  <select
                    value={defaultByRole[role] ?? dashboards[0]?.id ?? ''}
                    onChange={(event) =>
                      setDefaultByRole((prev) => ({
                        ...prev,
                        [role]: event.target.value
                      }))
                    }
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    {dashboards.map((dashboard) => (
                      <option key={dashboard.id} value={dashboard.id}>
                        {dashboardName(dashboard)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
