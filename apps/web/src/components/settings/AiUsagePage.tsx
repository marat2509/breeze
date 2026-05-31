import { useState, useEffect, useCallback } from 'react';
import { Bot, DollarSign, Flag, MessageSquare, Zap, Save, Loader2, Lock } from 'lucide-react';
import { fetchWithAuth } from '../../stores/auth';
import { useOrgStore } from '../../stores/orgStore';
import type { Locale } from '@/i18n/locales';
import { useI18n } from '@/i18n/react';

interface UsageData {
  daily: { inputTokens: number; outputTokens: number; totalCostCents: number; messageCount: number };
  monthly: { inputTokens: number; outputTokens: number; totalCostCents: number; messageCount: number };
  budget: {
    enabled: boolean;
    monthlyBudgetCents: number | null;
    dailyBudgetCents: number | null;
    monthlyUsedCents: number;
    dailyUsedCents: number;
    approvalMode: string;
  } | null;
}

interface SessionRow {
  id: string;
  userId: string;
  title: string | null;
  model: string;
  turnCount: number;
  totalCostCents: number;
  status: string;
  flaggedAt: string | null;
  flaggedBy: string | null;
  flagReason: string | null;
  createdAt: string;
}

type ApprovalMode = 'per_step' | 'action_plan' | 'auto_approve' | 'hybrid_plan';

interface BudgetForm {
  enabled: boolean;
  monthlyBudgetDollars: string;
  dailyBudgetDollars: string;
  maxTurnsPerSession: string;
  messagesPerMinutePerUser: string;
  messagesPerHourPerOrg: string;
  approvalMode: ApprovalMode;
}

type AiUsagePageProps = {
  locale?: Locale;
};

export default function AiUsagePage({ locale: initialLocale = 'en' }: AiUsagePageProps) {
  const { locale, t } = useI18n(initialLocale);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [locked, setLocked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const { currentOrgId } = useOrgStore();
  const [budget, setBudget] = useState<BudgetForm>({
    enabled: true,
    monthlyBudgetDollars: '',
    dailyBudgetDollars: '',
    maxTurnsPerSession: '50',
    messagesPerMinutePerUser: '20',
    messagesPerHourPerOrg: '200',
    approvalMode: 'per_step',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const sessionsUrl = showFlaggedOnly
        ? '/ai/admin/sessions?limit=50&flagged=true'
        : '/ai/admin/sessions?limit=50';
      const [usageRes, sessionsRes] = await Promise.all([
        fetchWithAuth('/ai/usage'),
        fetchWithAuth(sessionsUrl)
      ]);

      if (usageRes.ok) {
        const data = await usageRes.json();
        setUsage(data);
        if (data.budget) {
          setBudget({
            enabled: data.budget.enabled,
            monthlyBudgetDollars: data.budget.monthlyBudgetCents ? (data.budget.monthlyBudgetCents / 100).toFixed(2) : '',
            dailyBudgetDollars: data.budget.dailyBudgetCents ? (data.budget.dailyBudgetCents / 100).toFixed(2) : '',
            maxTurnsPerSession: '50',
            messagesPerMinutePerUser: '20',
            messagesPerHourPerOrg: '200',
            approvalMode: data.budget.approvalMode || 'per_step',
          });
        }
      }

      if (sessionsRes.ok) {
        const data = await sessionsRes.json();
        setSessions(data.data || []);
      }

      // Fetch locked fields from partner
      if (currentOrgId) {
        try {
          const effRes = await fetchWithAuth(`/orgs/organizations/${currentOrgId}/effective-settings`);
          if (effRes.ok) {
            const effData = await effRes.json();
            setLocked(effData.locked || []);
          }
        } catch (err) {
          console.warn('[AiUsagePage] Error fetching effective settings:', err);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.aiUsage.errors.load'));
    } finally {
      setLoading(false);
    }
  }, [showFlaggedOnly, currentOrgId, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isLocked = (field: string) => locked.includes(`aiBudgets.${field}`);

  const budgetFields = [
    'enabled', 'monthlyBudgetCents', 'dailyBudgetCents',
    'maxTurnsPerSession', 'messagesPerMinutePerUser', 'messagesPerHourPerOrg',
    'approvalMode',
  ];
  const allFieldsLocked = budgetFields.every((f) => isLocked(f));

  const handleSaveBudget = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      // Filter out partner-locked fields to prevent 403 errors
      const payload: Record<string, unknown> = {};
      if (!isLocked('enabled')) payload.enabled = budget.enabled;
      if (!isLocked('monthlyBudgetCents')) payload.monthlyBudgetCents = budget.monthlyBudgetDollars ? Math.round(parseFloat(budget.monthlyBudgetDollars) * 100) : null;
      if (!isLocked('dailyBudgetCents')) payload.dailyBudgetCents = budget.dailyBudgetDollars ? Math.round(parseFloat(budget.dailyBudgetDollars) * 100) : null;
      if (!isLocked('maxTurnsPerSession')) payload.maxTurnsPerSession = parseInt(budget.maxTurnsPerSession) || 50;
      if (!isLocked('messagesPerMinutePerUser')) payload.messagesPerMinutePerUser = parseInt(budget.messagesPerMinutePerUser) || 20;
      if (!isLocked('messagesPerHourPerOrg')) payload.messagesPerHourPerOrg = parseInt(budget.messagesPerHourPerOrg) || 200;
      if (!isLocked('approvalMode')) payload.approvalMode = budget.approvalMode;

      const res = await fetchWithAuth('/ai/budget', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || body.message || t('settings.aiUsage.errors.saveBudget'));
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.aiUsage.errors.save'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const formatCost = (cents: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(cents / 100);
  const formatTokens = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);
  const formatCreatedAt = (value: string) => new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
  const lockedHint = (
    <span className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 italic">
      <Lock className="h-3 w-3" /> {t('settings.aiUsage.managedByPartner')}
    </span>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('settings.aiUsage.title')}</h1>
        <p className="text-muted-foreground">{t('settings.aiUsage.description')}</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={DollarSign}
          label={t('settings.aiUsage.todayCost')}
          value={formatCost(usage?.daily.totalCostCents ?? 0)}
          sub={usage?.budget?.dailyBudgetCents ? t('settings.aiUsage.ofLimit', { amount: formatCost(usage.budget.dailyBudgetCents) }) : undefined}
        />
        <StatCard
          icon={DollarSign}
          label={t('settings.aiUsage.monthlyCost')}
          value={formatCost(usage?.monthly.totalCostCents ?? 0)}
          sub={usage?.budget?.monthlyBudgetCents ? t('settings.aiUsage.ofLimit', { amount: formatCost(usage.budget.monthlyBudgetCents) }) : undefined}
        />
        <StatCard
          icon={MessageSquare}
          label={t('settings.aiUsage.messagesToday')}
          value={String(usage?.daily.messageCount ?? 0)}
        />
        <StatCard
          icon={Zap}
          label={t('settings.aiUsage.tokensThisMonth')}
          value={formatTokens((usage?.monthly.inputTokens ?? 0) + (usage?.monthly.outputTokens ?? 0))}
          sub={t('settings.aiUsage.tokenBreakdown', {
            input: formatTokens(usage?.monthly.inputTokens ?? 0),
            output: formatTokens(usage?.monthly.outputTokens ?? 0),
          })}
        />
      </div>

      {/* Budget configuration */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">{t('settings.aiUsage.budgetConfiguration')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="text-sm text-muted-foreground">{t('settings.aiUsage.aiEnabled')}</span>
            <select
              value={budget.enabled ? 'true' : 'false'}
              onChange={(e) => setBudget({ ...budget, enabled: e.target.value === 'true' })}
              disabled={isLocked('enabled')}
              className={`mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm ${isLocked('enabled') ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <option value="true">{t('settings.aiUsage.enabled')}</option>
              <option value="false">{t('settings.aiUsage.disabled')}</option>
            </select>
            {isLocked('enabled') && (
              lockedHint
            )}
          </label>
          <label className="block">
            <span className="text-sm text-muted-foreground">{t('settings.aiUsage.approvalMode')}</span>
            <select
              value={budget.approvalMode}
              onChange={(e) => setBudget({ ...budget, approvalMode: e.target.value as ApprovalMode })}
              disabled={isLocked('approvalMode')}
              className={`mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm ${isLocked('approvalMode') ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <option value="per_step">{t('settings.aiUsage.approvalModes.per_step')}</option>
              <option value="action_plan">{t('settings.aiUsage.approvalModes.action_plan')}</option>
              <option value="auto_approve">{t('settings.aiUsage.approvalModes.auto_approve')}</option>
              <option value="hybrid_plan">{t('settings.aiUsage.approvalModes.hybrid_plan')}</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(`settings.aiUsage.approvalModeDescriptions.${budget.approvalMode}`)}
            </p>
            {isLocked('approvalMode') && (
              lockedHint
            )}
          </label>
          <label className="block">
            <span className="text-sm text-muted-foreground">{t('settings.aiUsage.monthlyBudget')}</span>
            <input
              type="number"
              step="0.01"
              value={budget.monthlyBudgetDollars}
              onChange={(e) => setBudget({ ...budget, monthlyBudgetDollars: e.target.value })}
              placeholder={t('settings.aiUsage.noLimit')}
              disabled={isLocked('monthlyBudgetCents')}
              className={`mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm ${isLocked('monthlyBudgetCents') ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
            {isLocked('monthlyBudgetCents') && (
              lockedHint
            )}
          </label>
          <label className="block">
            <span className="text-sm text-muted-foreground">{t('settings.aiUsage.dailyBudget')}</span>
            <input
              type="number"
              step="0.01"
              value={budget.dailyBudgetDollars}
              onChange={(e) => setBudget({ ...budget, dailyBudgetDollars: e.target.value })}
              placeholder={t('settings.aiUsage.noLimit')}
              disabled={isLocked('dailyBudgetCents')}
              className={`mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm ${isLocked('dailyBudgetCents') ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
            {isLocked('dailyBudgetCents') && (
              lockedHint
            )}
          </label>
          <label className="block">
            <span className="text-sm text-muted-foreground">{t('settings.aiUsage.maxTurnsPerSession')}</span>
            <input
              type="number"
              value={budget.maxTurnsPerSession}
              onChange={(e) => setBudget({ ...budget, maxTurnsPerSession: e.target.value })}
              disabled={isLocked('maxTurnsPerSession')}
              className={`mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm ${isLocked('maxTurnsPerSession') ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
            {isLocked('maxTurnsPerSession') && (
              lockedHint
            )}
          </label>
          <label className="block">
            <span className="text-sm text-muted-foreground">{t('settings.aiUsage.messagesPerMinutePerUser')}</span>
            <input
              type="number"
              value={budget.messagesPerMinutePerUser}
              onChange={(e) => setBudget({ ...budget, messagesPerMinutePerUser: e.target.value })}
              disabled={isLocked('messagesPerMinutePerUser')}
              className={`mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm ${isLocked('messagesPerMinutePerUser') ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
            {isLocked('messagesPerMinutePerUser') && (
              lockedHint
            )}
          </label>
          <label className="block">
            <span className="text-sm text-muted-foreground">{t('settings.aiUsage.messagesPerHourPerOrg')}</span>
            <input
              type="number"
              value={budget.messagesPerHourPerOrg}
              onChange={(e) => setBudget({ ...budget, messagesPerHourPerOrg: e.target.value })}
              disabled={isLocked('messagesPerHourPerOrg')}
              className={`mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm ${isLocked('messagesPerHourPerOrg') ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
            {isLocked('messagesPerHourPerOrg') && (
              lockedHint
            )}
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSaveBudget}
            disabled={saving || allFieldsLocked}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('settings.aiUsage.saveBudget')}
          </button>
          {saveSuccess && <span className="text-sm text-green-500">{t('settings.aiUsage.savedSuccessfully')}</span>}
          {allFieldsLocked && (
            <span className="text-sm text-amber-600 dark:text-amber-400 italic">
              {t('settings.aiUsage.allBudgetSettingsManaged')}
            </span>
          )}
        </div>
      </div>

      {/* Session history */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('settings.aiUsage.recentSessions')}</h2>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={showFlaggedOnly}
              onChange={(e) => setShowFlaggedOnly(e.target.checked)}
              className="rounded border-border"
            />
            {t('settings.aiUsage.showFlaggedOnly')}
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2">{t('settings.aiUsage.sessionTitle')}</th>
                <th className="px-4 py-2">{t('settings.aiUsage.model')}</th>
                <th className="px-4 py-2 text-right">{t('settings.aiUsage.turns')}</th>
                <th className="px-4 py-2 text-right">{t('settings.aiUsage.cost')}</th>
                <th className="px-4 py-2">{t('settings.aiUsage.status')}</th>
                <th className="px-4 py-2">{t('settings.aiUsage.flagged')}</th>
                <th className="px-4 py-2">{t('settings.aiUsage.created')}</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className={`border-b last:border-0 hover:bg-muted/20 ${s.flaggedAt ? 'border-l-2 border-l-amber-500' : ''}`}>
                  <td className="px-4 py-2.5 truncate max-w-[200px]">{s.title || t('settings.aiUsage.untitled')}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{s.model.split('-').slice(0, 2).join(' ')}</td>
                  <td className="px-4 py-2.5 text-right">{s.turnCount}</td>
                  <td className="px-4 py-2.5 text-right">{formatCost(s.totalCostCents)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                      s.status === 'active' ? 'bg-green-500/20 text-green-400' :
                      s.status === 'closed' ? 'bg-gray-500/20 text-gray-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {t(`settings.aiUsage.sessionStatuses.${s.status}`, undefined, s.status)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {s.flaggedAt ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400"
                        title={s.flagReason || t('settings.aiUsage.flagged')}
                      >
                        <Flag className="h-3 w-3" />
                        {t('settings.aiUsage.flagged')}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">
                    {formatCreatedAt(s.createdAt)}
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    {t('settings.aiUsage.noSessions')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }: {
  icon: typeof Bot;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
