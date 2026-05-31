import { useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n/react';
import type { TranslationParams } from '@/i18n/resources';
import { cn } from '@/lib/utils';

type Translate = (key: string, params?: TranslationParams, fallback?: string) => string;

function createCategoryRuleSchema(t: Translate) {
  return z.object({
    category: z.string().min(1, t('updateRingForm.validation.selectCategory')),
    autoApprove: z.boolean(),
    autoApproveSeverities: z.array(z.enum(['critical', 'important', 'moderate', 'low'])).optional(),
    deferralDaysOverride: z.coerce.number().int().min(0).max(365).nullable().optional(),
  });
}

function createRingSchema(t: Translate) {
  return z.object({
    name: z.string().min(1, t('updateRingForm.validation.nameRequired')),
    description: z.string().optional(),
    ringOrder: z.coerce.number().int().min(0).max(100),
    deferralDays: z.coerce.number().int().min(0).max(365),
    deadlineDays: z.coerce.number().int().min(0).max(365).nullable().optional(),
    gracePeriodHours: z.coerce.number().int().min(0).max(168),
    categoryRules: z.array(createCategoryRuleSchema(t)).optional(),
  });
}

export type UpdateRingFormValues = z.infer<ReturnType<typeof createRingSchema>>;

type UpdateRingFormProps = {
  onSubmit?: (values: UpdateRingFormValues) => void | Promise<void>;
  onCancel?: () => void;
  defaultValues?: Partial<UpdateRingFormValues>;
  submitLabel?: string;
  loading?: boolean;
};

const categoryOptions = [
  { value: 'security', labelKey: 'updateRingForm.categories.security' },
  { value: 'feature', labelKey: 'updateRingForm.categories.feature' },
  { value: 'driver', labelKey: 'updateRingForm.categories.driver' },
  { value: 'firmware', labelKey: 'updateRingForm.categories.firmware' },
  { value: 'third_party_app', labelKey: 'updateRingForm.categories.thirdPartyApp' },
  { value: 'definition', labelKey: 'updateRingForm.categories.definition' },
];

const severityOptions = [
  { value: 'critical' as const, labelKey: 'updateRingForm.severity.critical', color: 'border-red-500/40 bg-red-500/10 text-red-700' },
  { value: 'important' as const, labelKey: 'updateRingForm.severity.important', color: 'border-orange-500/40 bg-orange-500/10 text-orange-700' },
  { value: 'moderate' as const, labelKey: 'updateRingForm.severity.moderate', color: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-700' },
  { value: 'low' as const, labelKey: 'updateRingForm.severity.low', color: 'border-blue-500/40 bg-blue-500/10 text-blue-700' },
];

export default function UpdateRingForm({
  onSubmit,
  onCancel,
  defaultValues,
  submitLabel,
  loading,
}: UpdateRingFormProps) {
  const { t } = useI18n();
  const ringSchema = useMemo(() => createRingSchema(t), [t]);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<UpdateRingFormValues>({
    resolver: zodResolver(ringSchema),
    defaultValues: {
      name: '',
      description: '',
      ringOrder: 0,
      deferralDays: 0,
      deadlineDays: null,
      gracePeriodHours: 4,
      categoryRules: [],
      ...defaultValues,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'categoryRules',
  });

  const watchCategoryRules = watch('categoryRules') ?? [];
  const usedCategories = watchCategoryRules.map((r) => r.category);
  const availableCategories = categoryOptions.filter((c) => !usedCategories.includes(c.value));

  const isLoading = useMemo(() => loading ?? isSubmitting, [loading, isSubmitting]);

  const toggleSeverity = (ruleIndex: number, severity: string) => {
    const current = watchCategoryRules[ruleIndex]?.autoApproveSeverities ?? [];
    const next = current.includes(severity as 'critical' | 'important' | 'moderate' | 'low')
      ? current.filter((s) => s !== severity)
      : [...current, severity as 'critical' | 'important' | 'moderate' | 'low'];
    setValue(`categoryRules.${ruleIndex}.autoApproveSeverities`, next, { shouldDirty: true });
  };

  return (
    <form onSubmit={handleSubmit((values) => onSubmit?.(values))} className="space-y-4">
      {/* Ring Details + Timing — single row */}
      <div className="grid gap-3 sm:grid-cols-6">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium">{t('updateRingForm.labels.name')}</label>
          <input
            {...register('name')}
            className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={t('updateRingForm.placeholders.name')}
          />
          {errors.name && <p className="mt-0.5 text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div>
          <label className="text-xs font-medium">{t('updateRingForm.labels.order')}</label>
          <input
            type="number"
            min={0}
            max={100}
            {...register('ringOrder')}
            className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-xs font-medium">{t('updateRingForm.labels.deferralDays')}</label>
          <input
            type="number"
            min={0}
            max={365}
            {...register('deferralDays')}
            className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-xs font-medium">{t('updateRingForm.labels.deadlineDays')}</label>
          <input
            type="number"
            min={0}
            max={365}
            {...register('deadlineDays')}
            className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={t('updateRingForm.placeholders.deadlineNone')}
          />
        </div>
        <div>
          <label className="text-xs font-medium">{t('updateRingForm.labels.gracePeriodHours')}</label>
          <input
            type="number"
            min={0}
            max={168}
            {...register('gracePeriodHours')}
            className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Description — compact */}
      <div>
        <label className="text-xs font-medium">{t('updateRingForm.labels.description')}</label>
        <input
          {...register('description')}
          className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={t('updateRingForm.placeholders.description')}
        />
      </div>

      {/* Category Rules */}
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t('updateRingForm.labels.categoryRules')}</h3>
          {availableCategories.length > 0 && (
            <button
              type="button"
              onClick={() =>
                append({
                  category: availableCategories[0].value,
                  autoApprove: false,
                  autoApproveSeverities: [],
                  deferralDaysOverride: null,
                })
              }
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted transition"
            >
              <Plus className="h-3 w-3" />
              {t('updateRingForm.actions.add')}
            </button>
          )}
        </div>

        {fields.length === 0 ? (
          <div className="mt-2 rounded-md border border-dashed px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">{t('updateRingForm.empty.noRules')}</p>
            {availableCategories.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  append({
                    category: availableCategories[0].value,
                    autoApprove: false,
                    autoApproveSeverities: [],
                    deferralDaysOverride: null,
                  })
                }
                className="mt-2 inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition"
              >
                <Plus className="h-3 w-3" />
                {t('updateRingForm.actions.addCategoryRule')}
              </button>
            )}
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {fields.map((field, index) => {
              const rule = watchCategoryRules[index];
              return (
                <div key={field.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                  {/* Category */}
                  <select
                    {...register(`categoryRules.${index}.category`)}
                    className="h-8 w-36 shrink-0 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {categoryOptions
                      .filter((c) => c.value === rule?.category || !usedCategories.includes(c.value))
                      .map((c) => (
                        <option key={c.value} value={c.value}>{t(c.labelKey)}</option>
                      ))}
                  </select>

                  {/* Auto-approve toggle */}
                  <label className="flex items-center gap-1.5 text-xs shrink-0">
                    <input
                      type="checkbox"
                      {...register(`categoryRules.${index}.autoApprove`)}
                      className="h-3.5 w-3.5 rounded border-muted"
                    />
                    {t('updateRingForm.labels.autoApprove')}
                  </label>

                  {/* Severity chips (inline, shown when auto-approve) */}
                  {rule?.autoApprove && (
                    <div className="flex gap-1">
                      {severityOptions.map((sev) => (
                        <button
                          key={sev.value}
                          type="button"
                          onClick={() => toggleSeverity(index, sev.value)}
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-[10px] font-medium transition',
                            (rule.autoApproveSeverities ?? []).includes(sev.value)
                              ? sev.color
                              : 'border-muted text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {t(sev.labelKey)}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Deferral override */}
                  <div className="ml-auto flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-muted-foreground">{t('updateRingForm.labels.deferral')}</span>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      {...register(`categoryRules.${index}.deferralDaysOverride`)}
                      className="h-8 w-14 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder={t('updateRingForm.placeholders.deferralOverride')}
                    />
                  </div>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label={t('updateRingForm.actions.removeRule')}
                    className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-md border px-4 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            disabled={isLoading}
          >
            {t('updateRingForm.actions.cancel')}
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? t('updateRingForm.actions.saving') : submitLabel ?? t('updateRingForm.actions.save')}
        </button>
      </div>
    </form>
  );
}
