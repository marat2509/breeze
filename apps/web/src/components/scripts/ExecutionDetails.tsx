import { useState } from 'react';
import { X, ChevronDown, ChevronUp, Copy, Check, Clock, CheckCircle, XCircle, Loader2, AlertTriangle, Terminal, AlertOctagon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScriptExecution, ExecutionStatus } from './ExecutionHistory';
import { formatDate, formatNumber } from '@/i18n/formatters';
import { useI18n } from '@/i18n/react';
import type { Locale } from '@/i18n/locales';

type ExecutionDetailsProps = {
  execution: ScriptExecution;
  isOpen: boolean;
  onClose: () => void;
  timezone?: string;
};

const statusConfig: Record<ExecutionStatus, { color: string; bgColor: string; icon: typeof CheckCircle }> = {
  pending: { color: 'text-muted-foreground', bgColor: 'bg-muted', icon: Clock },
  running: { color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-500/10', icon: Loader2 },
  completed: { color: 'text-success', bgColor: 'bg-success/10', icon: CheckCircle },
  failed: { color: 'text-destructive', bgColor: 'bg-destructive/10', icon: XCircle },
  timeout: { color: 'text-warning', bgColor: 'bg-warning/10', icon: AlertTriangle }
};

function formatDuration(
  seconds: number | undefined,
  locale: Locale,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (seconds === undefined || seconds === null) return '-';
  if (seconds < 1) return t('scripts.execution.duration.lessThanSecond');
  if (seconds < 60) return t('scripts.execution.duration.seconds', { count: formatNumber(Math.round(seconds), locale) });
  if (seconds < 3600) {
    return t('scripts.execution.duration.minutesSeconds', {
      minutes: formatNumber(Math.floor(seconds / 60), locale),
      seconds: formatNumber(Math.round(seconds % 60), locale),
    });
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return t('scripts.execution.duration.hoursMinutes', {
    hours: formatNumber(hours, locale),
    minutes: formatNumber(mins, locale),
  });
}

function formatDateTime(dateString: string, locale: Locale, timezone?: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  return formatDate(date, locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: tz
  });
}

function normalizeOutput(raw: string): string {
  let s = raw;
  // Strip surrounding quotes from double-serialized JSON strings
  if (s.startsWith('"') && s.endsWith('"')) {
    try { s = JSON.parse(s); } catch { /* not valid JSON, leave as-is */ }
  }
  // Convert literal escape sequences to actual characters
  s = s.replace(/\\r\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  return s;
}

function OutputSection({
  title,
  content,
  icon: Icon,
  defaultOpen = true,
  variant = 'default'
}: {
  title: string;
  content?: string;
  icon: typeof Terminal;
  defaultOpen?: boolean;
  variant?: 'default' | 'error';
}) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const normalized = content ? normalizeOutput(content) : content;

  const handleCopy = async () => {
    if (!normalized) return;
    try {
      await navigator.clipboard.writeText(normalized!);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const isEmpty = !normalized || normalized.trim() === '';

  return (
    <div className={cn(
      'rounded-md border',
      variant === 'error' && normalized && 'border-destructive/40'
    )}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex w-full items-center justify-between px-4 py-3 text-left transition',
          isOpen ? 'border-b' : '',
          variant === 'error' && normalized ? 'bg-destructive/5' : 'bg-muted/20'
        )}
      >
        <div className="flex items-center gap-2">
          <Icon className={cn(
            'h-4 w-4',
            variant === 'error' && normalized ? 'text-destructive' : 'text-muted-foreground'
          )} />
          <span className={cn(
            'text-sm font-medium',
            variant === 'error' && normalized && 'text-destructive'
          )}>
            {title}
          </span>
          {isEmpty && (
            <span className="text-xs text-muted-foreground">{t('scripts.execution.details.emptyMarker')}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isEmpty && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              className="flex h-7 w-7 items-center justify-center rounded hover:bg-muted"
              title={t('scripts.execution.details.copyToClipboard')}
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          )}
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {isOpen && (
        <div className="p-4">
          {isEmpty ? (
            <p className="text-sm text-muted-foreground italic">{t('scripts.execution.details.noOutput')}</p>
          ) : (
            <pre className={cn(
              'overflow-x-auto rounded-md p-4 text-sm font-mono whitespace-pre-wrap break-words',
              variant === 'error' ? 'bg-destructive/5 text-destructive' : 'bg-muted/40 text-foreground'
            )}>
              {normalized}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export default function ExecutionDetails({
  execution,
  isOpen,
  onClose,
  timezone
}: ExecutionDetailsProps) {
  const { locale, t } = useI18n();
  if (!isOpen) return null;

  const StatusIcon = statusConfig[execution.status].icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-8">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-lg border bg-card shadow-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">{t('scripts.execution.details.title')}</h2>
            <p className="text-sm text-muted-foreground">{execution.scriptName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.dismiss')}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status Banner */}
          <div className={cn(
            'rounded-md p-4',
            statusConfig[execution.status].bgColor
          )}>
            <div className="flex items-center gap-3">
              <StatusIcon className={cn(
                'h-6 w-6',
                statusConfig[execution.status].color,
                execution.status === 'running' && 'animate-spin'
              )} />
              <div>
                <p className={cn(
                  'text-lg font-semibold',
                  statusConfig[execution.status].color
                )}>
                  {t(`scripts.execution.status.${execution.status}`)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t(`scripts.execution.details.statusDescriptions.${execution.status}`)}
                </p>
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-xs font-medium text-muted-foreground">{t('scripts.execution.details.device')}</p>
              <p className="text-sm font-medium mt-1">{execution.deviceHostname}</p>
            </div>
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-xs font-medium text-muted-foreground">{t('scripts.execution.details.startedAt')}</p>
              <p className="text-sm font-medium mt-1">{formatDateTime(execution.startedAt, locale, timezone)}</p>
            </div>
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-xs font-medium text-muted-foreground">{t('scripts.execution.details.duration')}</p>
              <p className="text-sm font-medium mt-1">
                {execution.status === 'running' ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t('scripts.execution.details.running')}
                  </span>
                ) : (
                  formatDuration(execution.duration, locale, t)
                )}
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-xs font-medium text-muted-foreground">{t('scripts.execution.details.exitCode')}</p>
              <p className="text-sm font-medium mt-1">
                {execution.exitCode !== undefined ? (
                  <span className={cn(
                    'inline-flex items-center rounded px-2 py-0.5 font-mono',
                    execution.exitCode === 0
                      ? 'bg-success/15 text-success'
                      : 'bg-destructive/15 text-destructive'
                  )}>
                    {execution.exitCode}
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </p>
            </div>
          </div>

          {execution.completedAt && (
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-xs font-medium text-muted-foreground">{t('scripts.execution.details.completedAt')}</p>
              <p className="text-sm font-medium mt-1">{formatDateTime(execution.completedAt, locale, timezone)}</p>
            </div>
          )}

          {/* Output Sections */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">{t('scripts.execution.details.output')}</h3>

            <OutputSection
              title={t('scripts.execution.details.stdout')}
              content={execution.stdout}
              icon={Terminal}
              defaultOpen={true}
            />

            <OutputSection
              title={t('scripts.execution.details.stderr')}
              content={execution.stderr}
              icon={AlertOctagon}
              defaultOpen={!!execution.stderr}
              variant="error"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-md border px-4 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            {t('scripts.execution.details.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
