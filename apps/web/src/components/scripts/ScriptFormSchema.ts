import { z } from 'zod';
import type { ScriptLanguage } from './ScriptList';

export type ScriptFormT = (
  key: string,
  params?: Record<string, string | number | boolean | null | undefined>,
) => string;

export function createParameterSchema(t: ScriptFormT) {
  return z.object({
    name: z.string().min(1, t('scripts.form.validation.parameterNameRequired')),
    type: z.enum(['string', 'number', 'boolean', 'select']),
    defaultValue: z.string().optional(),
    required: z.boolean().optional().default(false),
    options: z.string().optional() // comma-separated for select type
  });
}

export const severityValues = ['critical', 'high', 'medium', 'low', 'info'] as const;
export type Severity = (typeof severityValues)[number];

// Sentinel used in form-row state to represent the wire-shape `null`
// (explicitly suppress the alert for this exit code). Kept as a string so
// `<select>` values and `register()` round-trip cleanly; converted to/from
// `null` at the form boundary by rowsToMapping / mappingToRows.
export const SUPPRESS_SEVERITY = '__suppress__' as const;
export type SeverityRowValue = Severity | typeof SUPPRESS_SEVERITY;

// Form-side representation of one exit-code → severity mapping row. Stored as
// a list during editing so order is stable and each row owns its own state;
// converted to/from the wire `Record<string, severity | null>` at form boundaries.
export function createExitCodeSeverityRowSchema(t: ScriptFormT) {
  return z.object({
    exitCode: z.string().regex(/^\d+$/, t('scripts.form.validation.exitCodeInteger')),
    severity: z.enum([...severityValues, SUPPRESS_SEVERITY]),
  });
}

export function createScriptSchema(t: ScriptFormT) {
  const parameterSchema = createParameterSchema(t);
  const exitCodeSeverityRowSchema = createExitCodeSeverityRowSchema(t);

  return z.object({
    name: z.string().min(1, t('scripts.form.validation.scriptNameRequired')),
    description: z.string().optional(),
    category: z.string().min(1, t('scripts.form.validation.categoryRequired')),
    language: z.enum(['powershell', 'bash', 'python', 'cmd']),
    osTypes: z.array(z.enum(['windows', 'macos', 'linux'])).min(1, t('scripts.form.validation.selectOs')),
    content: z.string().min(1, t('scripts.form.validation.contentRequired')),
    parameters: z.array(parameterSchema).optional(),
    timeoutSeconds: z.coerce
      .number({ invalid_type_error: t('scripts.form.validation.timeoutRequired') })
      .int(t('scripts.form.validation.timeoutInteger'))
      .min(1, t('scripts.form.validation.timeoutMin'))
      .max(86400, t('scripts.form.validation.timeoutMax')),
    runAs: z.enum(['system', 'user', 'elevated']),
    exitCodeSeverityMapping: z
      .array(exitCodeSeverityRowSchema)
      .optional()
      .superRefine((rows, ctx) => {
        if (!rows) return;
        const seen = new Set<string>();
        rows.forEach((row, i) => {
          if (seen.has(row.exitCode)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [i, 'exitCode'],
              message: t('scripts.form.validation.duplicateExitCode', { code: row.exitCode }),
            });
          }
          seen.add(row.exitCode);
        });
      }),
  });
}

export type ScriptFormValues = z.infer<ReturnType<typeof createScriptSchema>>;
export type ScriptParameter = z.infer<ReturnType<typeof createParameterSchema>>;
export type ExitCodeSeverityRow = z.infer<ReturnType<typeof createExitCodeSeverityRowSchema>>;

// Wire shape sent to / received from the API. Form-side editing keeps an
// ordered list of rows for stable React keys + per-row error display; we
// convert at the form boundary. `null` = explicitly suppress the alert for
// that exit code (distinct from omitting the key, which falls back to
// script-level default handling).
export type ExitCodeSeverityMapping = Record<string, Severity | null>;

export type ScriptSubmitValues = Omit<ScriptFormValues, 'exitCodeSeverityMapping'> & {
  exitCodeSeverityMapping?: ExitCodeSeverityMapping;
};

export function rowsToMapping(rows: ExitCodeSeverityRow[] | undefined): ExitCodeSeverityMapping | undefined {
  if (!rows || rows.length === 0) return undefined;
  return rows.reduce<ExitCodeSeverityMapping>((acc, { exitCode, severity }) => {
    acc[exitCode] = severity === SUPPRESS_SEVERITY ? null : severity;
    return acc;
  }, {});
}

export function mappingToRows(mapping: ExitCodeSeverityMapping | null | undefined): ExitCodeSeverityRow[] {
  if (!mapping) return [];
  return Object.entries(mapping)
    .map<ExitCodeSeverityRow>(([exitCode, severity]) => ({
      exitCode,
      severity: severity === null ? SUPPRESS_SEVERITY : severity,
    }))
    .sort((a, b) => Number(a.exitCode) - Number(b.exitCode));
}

export function createSeverityOptions(t: ScriptFormT): { value: SeverityRowValue; label: string }[] {
  return [
    { value: 'critical', label: t('scripts.form.severity.critical') },
    { value: 'high', label: t('scripts.form.severity.high') },
    { value: 'medium', label: t('scripts.form.severity.medium') },
    { value: 'low', label: t('scripts.form.severity.low') },
    { value: 'info', label: t('scripts.form.severity.info') },
    { value: SUPPRESS_SEVERITY, label: t('scripts.form.suppressAlert') },
  ];
}

export function createLanguageOptions(t: ScriptFormT): { value: ScriptLanguage; label: string; monacoLang: string }[] {
  return [
    { value: 'powershell', label: t('scripts.list.languages.powershell'), monacoLang: 'powershell' },
    { value: 'bash', label: t('scripts.list.languages.bash'), monacoLang: 'shell' },
    { value: 'python', label: t('scripts.list.languages.python'), monacoLang: 'python' },
    { value: 'cmd', label: t('scripts.form.languages.cmdBatch'), monacoLang: 'bat' }
  ];
}

export function createCategoryOptions(t: ScriptFormT): { value: string; label: string }[] {
  return [
    { value: 'Maintenance', label: t('scripts.form.categories.maintenance') },
    { value: 'Security', label: t('scripts.form.categories.security') },
    { value: 'Monitoring', label: t('scripts.form.categories.monitoring') },
    { value: 'Deployment', label: t('scripts.form.categories.deployment') },
    { value: 'Backup', label: t('scripts.form.categories.backup') },
    { value: 'Network', label: t('scripts.form.categories.network') },
    { value: 'User Management', label: t('scripts.form.categories.userManagement') },
    { value: 'Software', label: t('scripts.form.categories.software') },
    { value: 'Custom', label: t('scripts.form.categories.custom') }
  ];
}

export function createRunAsOptions(t: ScriptFormT): { value: 'system' | 'user' | 'elevated'; label: string; description: string }[] {
  return [
    { value: 'system', label: t('scripts.form.runAs.system'), description: t('scripts.form.runAs.systemDescription') },
    { value: 'user', label: t('scripts.form.runAs.user'), description: t('scripts.form.runAs.userDescription') },
    { value: 'elevated', label: t('scripts.form.runAs.elevated'), description: t('scripts.form.runAs.elevatedDescription') }
  ];
}

export function createParameterTypeOptions(t: ScriptFormT): { value: 'string' | 'number' | 'boolean' | 'select'; label: string }[] {
  return [
    { value: 'string', label: t('scripts.form.parameterTypes.string') },
    { value: 'number', label: t('scripts.form.parameterTypes.number') },
    { value: 'boolean', label: t('scripts.form.parameterTypes.boolean') },
    { value: 'select', label: t('scripts.form.parameterTypes.select') }
  ];
}
