import { useMemo, useState, useEffect, useRef, type ComponentType } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import type { EditorProps } from '@monaco-editor/react';

import ScriptAiPanel from './ScriptAiPanel';
import CollapsibleSection from './CollapsibleSection';
import { cn } from '@/lib/utils';
import { useScriptAiStore } from '@/stores/scriptAiStore';
import type { ScriptFormBridge } from '@/stores/scriptAiStore';
import type { OSType } from './ScriptList';
import {
  createScriptSchema,
  createLanguageOptions,
  createCategoryOptions,
  createRunAsOptions,
  createParameterTypeOptions,
  createSeverityOptions,
  rowsToMapping,
  type ScriptFormValues, type ScriptSubmitValues,
} from './ScriptFormSchema';
import { formatNumber } from '@/i18n/formatters';
import { useI18n } from '@/i18n/react';

export type { ScriptFormValues, ScriptParameter, ScriptSubmitValues } from './ScriptFormSchema';

type ScriptFormProps = {
  onSubmit?: (values: ScriptSubmitValues) => void | Promise<void>;
  onCancel?: () => void;
  defaultValues?: Partial<ScriptFormValues>;
  submitLabel?: string;
  loading?: boolean;
};

export default function ScriptForm({
  onSubmit,
  onCancel,
  defaultValues,
  submitLabel,
  loading
}: ScriptFormProps) {
  const { locale, t } = useI18n();
  const editorInstanceRef = useRef<Parameters<NonNullable<EditorProps['onMount']>>[0] | null>(null);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Dynamic import for Monaco Editor — avoids React.lazy/Suspense which
  // can cause hydration issues during Astro View Transition DOM swaps.
  // Re-triggers after View Transition swaps the DOM so the editor reloads
  // on SPA back-navigation (e.g. scripts list → edit → list → edit).
  const [MonacoEditor, setMonacoEditor] = useState<ComponentType<EditorProps> | null>(null);
  const [editorLoadError, setEditorLoadError] = useState<string | null>(null);
  const scriptSchema = useMemo(() => createScriptSchema(t), [t]);
  const languageOptions = useMemo(() => createLanguageOptions(t), [t]);
  const categoryOptions = useMemo(() => createCategoryOptions(t), [t]);
  const runAsOptions = useMemo(() => createRunAsOptions(t), [t]);
  const parameterTypeOptions = useMemo(() => createParameterTypeOptions(t), [t]);
  const severityOptions = useMemo(() => createSeverityOptions(t), [t]);
  const effectiveSubmitLabel = submitLabel ?? t('scripts.form.saveScript');

  useEffect(() => {
    let cancelled = false;
    const loadEditor = () => {
      editorInstanceRef.current = null;
      setEditorLoadError(null);
      import('@monaco-editor/react')
        .then((mod) => {
          if (!cancelled) setMonacoEditor(() => mod.default);
        })
        .catch((err) => {
          if (!cancelled) {
            console.error('Failed to load script editor:', err);
            setEditorLoadError(t('scripts.form.editorLoadFailed'));
          }
        });
    };
    loadEditor();
    document.addEventListener('astro:after-swap', loadEditor);
    return () => {
      cancelled = true;
      document.removeEventListener('astro:after-swap', loadEditor);
    };
  }, [t]);

  // Force editor relayout after View Transition navigation completes
  useEffect(() => {
    const forceLayout = () => {
      requestAnimationFrame(() => editorInstanceRef.current?.layout());
    };
    document.addEventListener('astro:page-load', forceLayout);
    return () => document.removeEventListener('astro:page-load', forceLayout);
  }, []);

  const {
    register,
    handleSubmit,
    control,
    watch,
    getValues,
    setValue,
    formState: { errors, isSubmitting, isDirty }
  } = useForm<ScriptFormValues>({
    resolver: zodResolver(scriptSchema) as never,
    mode: 'onTouched',
    defaultValues: {
      name: '',
      description: '',
      category: 'Custom',
      language: 'powershell',
      osTypes: ['windows'],
      content: '',
      parameters: [],
      timeoutSeconds: 300,
      runAs: 'system',
      exitCodeSeverityMapping: [],
      ...defaultValues
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'parameters'
  });

  const {
    fields: severityFields,
    append: appendSeverity,
    remove: removeSeverity,
  } = useFieldArray({ control, name: 'exitCodeSeverityMapping' });

  const [severityOpen, setSeverityOpen] = useState(false);

  // Auto-expand sections when editing a script that has existing data
  useEffect(() => {
    if (defaultValues?.parameters && defaultValues.parameters.length > 0) setParamsOpen(true);
    if (defaultValues?.timeoutSeconds !== undefined && defaultValues.timeoutSeconds !== 300) setSettingsOpen(true);
    if (defaultValues?.runAs !== undefined && defaultValues.runAs !== 'system') setSettingsOpen(true);
    if (defaultValues?.exitCodeSeverityMapping && defaultValues.exitCodeSeverityMapping.length > 0) setSeverityOpen(true);
  }, [defaultValues]);

  const { panelOpen, togglePanel } = useScriptAiStore();

  const bridge: ScriptFormBridge = useMemo(() => ({
    getFormValues: () => getValues() as ScriptFormValues,
    setFormValues: (partial) => {
      Object.entries(partial).forEach(([key, value]) => {
        if (value !== undefined) {
          setValue(key as keyof ScriptFormValues, value as never, { shouldDirty: true });
        }
      });
    },
    takeSnapshot: () => {
      return structuredClone(getValues() as ScriptFormValues);
    },
    restoreSnapshot: (snapshot) => {
      if (snapshot) {
        Object.entries(snapshot).forEach(([key, value]) => {
          setValue(key as keyof ScriptFormValues, value as never, { shouldDirty: true });
        });
      }
    },
  }), [getValues, setValue]);

  // Warn before leaving with unsaved changes (browser close/refresh + Astro SPA nav)
  const isDirtyRef = useRef(false);
  const skipGuardRef = useRef(false);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) e.preventDefault();
    };
    const onAstroNav = (e: Event) => {
      if (skipGuardRef.current) { skipGuardRef.current = false; return; }
      if (isDirtyRef.current && !window.confirm(t('scripts.form.unsavedConfirm'))) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('astro:before-preparation', onAstroNav);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('astro:before-preparation', onAstroNav);
    };
  }, [t]);

  const formRef = useRef<HTMLFormElement>(null);

  // Keyboard shortcuts: Cmd+S to save, Cmd+Shift+I to toggle AI panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'i') {
        e.preventDefault();
        togglePanel();
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 's') {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePanel]);

  const watchLanguage = watch('language');
  const watchOsTypes = watch('osTypes');
  const watchParameters = watch('parameters');

  const monacoLanguage = useMemo(() => {
    return languageOptions.find(l => l.value === watchLanguage)?.monacoLang || 'plaintext';
  }, [languageOptions, watchLanguage]);

  const isLoading = useMemo(() => loading ?? isSubmitting, [loading, isSubmitting]);

  const handleOsToggle = (os: OSType) => {
    const current = watchOsTypes || [];
    if (current.includes(os)) {
      if (current.length > 1) {
        setValue('osTypes', current.filter(o => o !== os));
      }
    } else {
      setValue('osTypes', [...current, os]);
    }
  };

  const addParameter = () => {
    append({
      name: '',
      type: 'string',
      defaultValue: '',
      required: false,
      options: ''
    });
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit(async values => {
        // Allow the post-save navigation through the guard. Set BEFORE
        // onSubmit so it's true before navigateTo dispatches the event.
        skipGuardRef.current = true;
        try {
          const { exitCodeSeverityMapping, ...rest } = values;
          const submitValues: ScriptSubmitValues = {
            ...rest,
            exitCodeSeverityMapping: rowsToMapping(exitCodeSeverityMapping),
          };
          await onSubmit?.(submitValues);
        } catch {
          // Save failed — re-arm the nav guard so user doesn't lose work
          skipGuardRef.current = false;
        }
      })}
      className="space-y-8 rounded-lg border bg-card p-6 shadow-sm"
    >
      {/* Basic Information */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="script-name" className="text-sm font-medium">
            {t('scripts.form.scriptName')}
          </label>
          <input
            id="script-name"
            placeholder={t('scripts.form.scriptNamePlaceholder')}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            {...register('name')}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <label htmlFor="script-category" className="text-sm font-medium">
            {t('scripts.form.category')}
          </label>
          <select
            id="script-category"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            {...register('category')}
          >
            {categoryOptions.map(cat => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="script-description" className="text-sm font-medium">
            {t('scripts.form.description')}
          </label>
          <textarea
            id="script-description"
            placeholder={t('scripts.form.descriptionPlaceholder')}
            rows={2}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            {...register('description')}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="script-language" className="text-sm font-medium">
            {t('scripts.form.language')}
          </label>
          <select
            id="script-language"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            {...register('language')}
          >
            {languageOptions.map(lang => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
          {errors.language && <p className="text-sm text-destructive">{errors.language.message}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">{t('scripts.form.targetOs')}</label>
          <div className="flex flex-wrap gap-2">
            {(['windows', 'macos', 'linux'] as OSType[]).map(os => (
              <button
                key={os}
                type="button"
                onClick={() => handleOsToggle(os)}
                className={cn(
                  'rounded-md border px-3 py-2 text-sm font-medium transition',
                  watchOsTypes?.includes(os)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background hover:bg-muted'
                )}
              >
                {t(`scripts.list.os.${os}`)}
              </button>
            ))}
          </div>
          {errors.osTypes && <p className="text-sm text-destructive">{errors.osTypes.message}</p>}
        </div>
      </div>

      {/* Script Content + AI Panel */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold tracking-tight">{t('scripts.form.scriptContent')}</h3>
          <button
            type="button"
            onClick={togglePanel}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition',
              panelOpen
                ? 'bg-primary text-primary-foreground'
                : 'border hover:bg-muted'
            )}
            title={t('scripts.form.toggleAiTitle')}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t('scripts.form.aiAssistant')}
          </button>
        </div>
        <div className="flex rounded-md border">
          <div className="min-w-0 flex-1">
            <Controller
              name="content"
              control={control}
              render={({ field }) =>
                MonacoEditor ? (
                  <MonacoEditor
                    height="600px"
                    language={monacoLanguage}
                    value={field.value}
                    onChange={(value) => field.onChange(value || '')}
                    onMount={(editor) => {
                      editorInstanceRef.current = editor;
                      requestAnimationFrame(() => editor.layout());
                    }}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      automaticLayout: true,
                      tabSize: 2,
                      padding: { top: 12, bottom: 12 }
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-[600px] bg-[#1e1e1e]">
                    <div className="text-center text-white/60">
                      {editorLoadError ? (
                        <>
                          <p className="text-sm text-red-400">{editorLoadError}</p>
                          <button type="button" onClick={() => window.location.reload()} className="mt-2 text-xs underline hover:text-white">
                            {t('scripts.form.refreshPage')}
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white mx-auto" />
                          <p className="mt-2 text-sm">{t('scripts.form.loadingEditor')}</p>
                        </>
                      )}
                    </div>
                  </div>
                )
              }
            />
          </div>
          {panelOpen && <ScriptAiPanel bridge={bridge} />}
        </div>
        {errors.content && <p className="text-sm text-destructive">{errors.content.message}</p>}
      </div>

      {/* Parameters */}
      <CollapsibleSection
        title={t('scripts.form.parameters')}
        open={paramsOpen}
        onToggle={() => setParamsOpen(prev => !prev)}
        badge={fields.length > 0 ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{formatNumber(fields.length, locale)}</span>
        ) : undefined}
      >
        <div className="space-y-3">
          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t('scripts.form.parametersEmptyPrefix')}{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">$paramName</code>{' '}
              {t('scripts.form.parametersEmptyMiddle')}{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">sys.argv</code>{' '}
              {t('scripts.form.parametersEmptySuffix')}
            </p>
          )}
          {fields.map((field, index) => (
            <div key={field.id} className="rounded-md border bg-muted/20 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground mt-2">{formatNumber(index + 1, locale)}</span>
                <div className="flex-1 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">{t('scripts.form.parameterName')}</label>
                    <input placeholder={t('scripts.form.parameterNamePlaceholder')} className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" {...register(`parameters.${index}.name`)} />
                    {errors.parameters?.[index]?.name && <p className="text-xs text-destructive">{errors.parameters[index]?.name?.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">{t('scripts.form.parameterType')}</label>
                    <select className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" {...register(`parameters.${index}.type`)}>
                      {parameterTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">{t('scripts.form.defaultValue')}</label>
                    <input placeholder={t('scripts.form.defaultValuePlaceholder')} className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" {...register(`parameters.${index}.defaultValue`)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">{t('scripts.form.required')}</label>
                    <div className="flex items-center h-9">
                      <input type="checkbox" className="h-4 w-4 rounded border-border" {...register(`parameters.${index}.required`)} />
                      <span className="ml-2 text-sm">{t('scripts.form.yes')}</span>
                    </div>
                  </div>
                  {watchParameters?.[index]?.type === 'select' && (
                    <div className="space-y-1 sm:col-span-2 md:col-span-4">
                      <label className="text-xs font-medium text-muted-foreground">{t('scripts.form.options')}</label>
                      <input placeholder={t('scripts.form.optionsPlaceholder')} className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" {...register(`parameters.${index}.options`)} />
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => remove(index)} className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted text-destructive" title={t('scripts.form.removeParameter')}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={addParameter} className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition">
            <Plus className="h-4 w-4" />
            {t('scripts.form.addParameter')}
          </button>
        </div>
      </CollapsibleSection>

      {/* Execution Settings */}
      <CollapsibleSection
        title={t('scripts.form.executionSettings')}
        open={settingsOpen}
        onToggle={() => setSettingsOpen(prev => !prev)}
        summary={
          <span className="text-xs text-muted-foreground">
            {t('scripts.form.timeoutSummary', {
              seconds: formatNumber(Number(watch('timeoutSeconds') ?? 0), locale),
              runAs: runAsOptions.find(o => o.value === watch('runAs'))?.label ?? '',
            })}
          </span>
        }
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="timeout-seconds" className="text-sm font-medium">{t('scripts.form.timeoutSeconds')}</label>
            <input id="timeout-seconds" type="number" min={1} max={86400} className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" {...register('timeoutSeconds')} />
            {errors.timeoutSeconds && <p className="text-sm text-destructive">{errors.timeoutSeconds.message}</p>}
            <p className="text-xs text-muted-foreground">{t('scripts.form.timeoutHelp')}</p>
          </div>
          <div className="space-y-2">
            <label htmlFor="run-as" className="text-sm font-medium">{t('scripts.form.runAsLabel')}</label>
            <select id="run-as" className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" {...register('runAs')}>
              {runAsOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            {errors.runAs && <p className="text-sm text-destructive">{errors.runAs.message}</p>}
            <p className="text-xs text-muted-foreground">
              {runAsOptions.find(o => o.value === watch('runAs'))?.description}
              {watch('runAs') === 'elevated' && ` ${t('scripts.form.elevatedHelp')}`}
            </p>
          </div>
        </div>
      </CollapsibleSection>

      {/* Exit-code severity mapping */}
      <CollapsibleSection
        title={t('scripts.form.exitCodeSeverity')}
        open={severityOpen}
        onToggle={() => setSeverityOpen(prev => !prev)}
        badge={severityFields.length > 0 ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{formatNumber(severityFields.length, locale)}</span>
        ) : undefined}
      >
        <div className="space-y-3">
          {severityFields.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t('scripts.form.exitSeverityEmptyPrefix')}{' '}
              <em>{t('scripts.form.suppressAlert')}</em>{' '}
              {t('scripts.form.exitSeverityEmptySuffix')}
            </p>
          )}
          {severityFields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-3 rounded-md border bg-muted/20 p-3">
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{t('scripts.form.exitCode')}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder={t('scripts.form.exitCodePlaceholder')}
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    {...register(`exitCodeSeverityMapping.${index}.exitCode`)}
                  />
                  {errors.exitCodeSeverityMapping?.[index]?.exitCode && (
                    <p className="text-xs text-destructive">
                      {errors.exitCodeSeverityMapping[index]?.exitCode?.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{t('scripts.form.severityLabel')}</label>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    {...register(`exitCodeSeverityMapping.${index}.severity`)}
                  >
                    {severityOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {t('scripts.form.suppressAlertDescription')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeSeverity(index)}
                className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted text-destructive"
                title={t('scripts.form.removeMapping')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => appendSeverity({ exitCode: '', severity: 'medium' })}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition"
          >
            <Plus className="h-4 w-4" />
            {t('scripts.form.addExitCode')}
          </button>
        </div>
      </CollapsibleSection>

      {/* Form Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="hidden text-xs text-muted-foreground sm:block">
          {t('scripts.form.shortcutSave', {
            shortcut: typeof navigator !== 'undefined' && /\bMac/i.test(navigator.userAgent) ? '⌘S' : 'Ctrl+S',
          })}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 w-full rounded-md border bg-background text-sm font-medium text-foreground transition hover:bg-muted sm:w-auto sm:px-6"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex h-11 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-6"
          >
            {isLoading ? t('common.saving') : effectiveSubmitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
