import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, Settings, AlertCircle } from 'lucide-react';
import { fetchWithAuth } from '../../stores/auth';
import { useI18n } from '@/i18n/react';
import type { Locale } from '@/i18n/locales';
import type { CustomFieldDefinition, CustomFieldType, CustomFieldOptions } from '@breeze/shared';

interface CustomField extends Omit<CustomFieldDefinition, 'createdAt' | 'updatedAt'> {
  createdAt: string | Date;
  updatedAt: string | Date;
}

type ModalMode = 'closed' | 'create' | 'edit' | 'delete';

const FIELD_TYPES: Array<{ value: CustomFieldType; labelKey: string; descriptionKey: string }> = [
  { value: 'text', labelKey: 'settings.customFields.types.text', descriptionKey: 'settings.customFields.typeDescriptions.text' },
  { value: 'number', labelKey: 'settings.customFields.types.number', descriptionKey: 'settings.customFields.typeDescriptions.number' },
  { value: 'boolean', labelKey: 'settings.customFields.types.boolean', descriptionKey: 'settings.customFields.typeDescriptions.boolean' },
  { value: 'dropdown', labelKey: 'settings.customFields.types.dropdown', descriptionKey: 'settings.customFields.typeDescriptions.dropdown' },
  { value: 'date', labelKey: 'settings.customFields.types.date', descriptionKey: 'settings.customFields.typeDescriptions.date' }
];

const DEVICE_TYPE_OPTIONS = [
  { value: 'windows', labelKey: 'devices.osNames.windows' },
  { value: 'macos', labelKey: 'devices.osNames.macos' },
  { value: 'linux', labelKey: 'devices.osNames.linux' }
];

type CustomFieldsPageProps = {
  locale?: Locale;
};

export default function CustomFieldsPage({ locale: initialLocale = 'en' }: CustomFieldsPageProps) {
  const { t } = useI18n(initialLocale);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<CustomFieldType | ''>('');

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>('closed');
  const [selectedField, setSelectedField] = useState<CustomField | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formFieldKey, setFormFieldKey] = useState('');
  const [formType, setFormType] = useState<CustomFieldType>('text');
  const [formRequired, setFormRequired] = useState(false);
  const [formDefaultValue, setFormDefaultValue] = useState<unknown>(null);
  const [formDeviceTypes, setFormDeviceTypes] = useState<string[]>([]);
  const [formOptions, setFormOptions] = useState<CustomFieldOptions>({});
  const [dropdownChoices, setDropdownChoices] = useState<Array<{ label: string; value: string }>>([]);

  const fetchFields = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      if (searchQuery) params.set('search', searchQuery);

      const response = await fetchWithAuth(`/custom-fields?${params.toString()}`);
      if (!response.ok) {
        throw new Error(t('settings.customFields.errors.load'));
      }
      const data = await response.json();
      setFields(data.data ?? data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.customFields.errors.load'));
    } finally {
      setLoading(false);
    }
  }, [typeFilter, searchQuery, t]);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  const filteredFields = fields.filter((field) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !field.name.toLowerCase().includes(query) &&
        !field.fieldKey.toLowerCase().includes(query)
      ) {
        return false;
      }
    }
    if (typeFilter && field.type !== typeFilter) {
      return false;
    }
    return true;
  });

  const fieldTypeLabel = (type: CustomFieldType) =>
    t(FIELD_TYPES.find((fieldType) => fieldType.value === type)?.labelKey ?? type, undefined, type);

  const deviceTypeLabel = (deviceType: string) =>
    t(DEVICE_TYPE_OPTIONS.find((option) => option.value === deviceType)?.labelKey ?? deviceType, undefined, deviceType);

  const resetForm = () => {
    setFormName('');
    setFormFieldKey('');
    setFormType('text');
    setFormRequired(false);
    setFormDefaultValue(null);
    setFormDeviceTypes([]);
    setFormOptions({});
    setDropdownChoices([]);
    setFormError(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setSelectedField(null);
    setModalMode('create');
  };

  const handleOpenEdit = (field: CustomField) => {
    setSelectedField(field);
    setFormName(field.name);
    setFormFieldKey(field.fieldKey);
    setFormType(field.type as CustomFieldType);
    setFormRequired(field.required);
    setFormDefaultValue(field.defaultValue);
    setFormDeviceTypes(field.deviceTypes ?? []);
    setFormOptions((field.options as CustomFieldOptions) ?? {});
    setDropdownChoices(
      (field.options as CustomFieldOptions)?.choices ?? []
    );
    setFormError(null);
    setModalMode('edit');
  };

  const handleOpenDelete = (field: CustomField) => {
    setSelectedField(field);
    setModalMode('delete');
  };

  const handleCloseModal = () => {
    setModalMode('closed');
    setSelectedField(null);
    resetForm();
  };

  const generateFieldKey = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormName(name);
    if (modalMode === 'create') {
      setFormFieldKey(generateFieldKey(name));
    }
  };

  const handleAddDropdownChoice = () => {
    setDropdownChoices([...dropdownChoices, { label: '', value: '' }]);
  };

  const handleRemoveDropdownChoice = (index: number) => {
    setDropdownChoices(dropdownChoices.filter((_, i) => i !== index));
  };

  const handleDropdownChoiceChange = (
    index: number,
    field: 'label' | 'value',
    newValue: string
  ) => {
    const updated = [...dropdownChoices];
    const current = updated[index];
    updated[index] = {
      label: current?.label ?? '',
      value: current?.value ?? '',
      [field]: newValue
    };
    // Auto-generate value from label if value is empty
    if (field === 'label' && !updated[index].value) {
      updated[index].value = generateFieldKey(newValue);
    }
    setDropdownChoices(updated);
  };

  const handleToggleDeviceType = (deviceType: string) => {
    setFormDeviceTypes((prev) =>
      prev.includes(deviceType)
        ? prev.filter((t) => t !== deviceType)
        : [...prev, deviceType]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = formName.trim();
    const trimmedKey = formFieldKey.trim();

    if (!trimmedName) {
      setFormError(t('settings.customFields.validation.nameRequired'));
      return;
    }

    if (!trimmedKey) {
      setFormError(t('settings.customFields.validation.fieldKeyRequired'));
      return;
    }

    if (!/^[a-z][a-z0-9_]*$/.test(trimmedKey)) {
      setFormError(t('settings.customFields.validation.fieldKeyFormat'));
      return;
    }

    if (formType === 'dropdown' && dropdownChoices.length < 2) {
      setFormError(t('settings.customFields.validation.dropdownChoices'));
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const options: CustomFieldOptions = {};
      if (formType === 'dropdown') {
        options.choices = dropdownChoices.filter((c) => c.label && c.value);
      }
      if (formType === 'number') {
        if (formOptions.min !== undefined) options.min = formOptions.min;
        if (formOptions.max !== undefined) options.max = formOptions.max;
      }
      if (formType === 'text') {
        if (formOptions.minLength !== undefined) options.minLength = formOptions.minLength;
        if (formOptions.maxLength !== undefined) options.maxLength = formOptions.maxLength;
        if (formOptions.pattern) options.pattern = formOptions.pattern;
      }

      const payload = {
        name: trimmedName,
        fieldKey: trimmedKey,
        type: formType,
        required: formRequired,
        defaultValue: formDefaultValue,
        deviceTypes: formDeviceTypes.length > 0 ? formDeviceTypes : null,
        options: Object.keys(options).length > 0 ? options : null
      };

      const url = modalMode === 'edit' && selectedField
        ? `/custom-fields/${selectedField.id}`
        : '/custom-fields';
      const method = modalMode === 'edit' ? 'PATCH' : 'POST';

      const response = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        await response.json().catch(() => ({}));
        throw new Error(t('settings.customFields.errors.save'));
      }

      await fetchFields();
      handleCloseModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('settings.customFields.errors.save'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedField) return;

    setSubmitting(true);
    setFormError(null);

    try {
      const response = await fetchWithAuth(`/custom-fields/${selectedField.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(t('settings.customFields.errors.delete'));
      }

      await fetchFields();
      handleCloseModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('settings.customFields.errors.delete'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('settings.customFields.title')}</h1>
          <p className="text-muted-foreground">
            {t('settings.customFields.description')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          {t('settings.customFields.addCustomField')}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('settings.customFields.searchPlaceholder')}
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as CustomFieldType | '')}
          className="h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">{t('settings.customFields.allTypes')}</option>
          {FIELD_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {t(type.labelKey)}
            </option>
          ))}
        </select>
      </div>

      {filteredFields.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <Settings className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            {searchQuery || typeFilter
              ? t('settings.customFields.emptyFiltered')
              : t('settings.customFields.empty')}
          </p>
          {!searchQuery && !typeFilter && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              {t('settings.customFields.addFirst')}
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <table className="w-full">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">{t('settings.customFields.name')}</th>
                <th className="px-4 py-3">{t('settings.customFields.key')}</th>
                <th className="px-4 py-3">{t('settings.customFields.type')}</th>
                <th className="px-4 py-3">{t('settings.customFields.required')}</th>
                <th className="px-4 py-3">{t('settings.customFields.deviceTypes')}</th>
                <th className="px-4 py-3 text-right">{t('settings.customFields.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredFields.map((field) => (
                <tr key={field.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-medium">{field.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {field.fieldKey}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border px-2 py-0.5 text-xs">
                      {fieldTypeLabel(field.type as CustomFieldType)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        field.required
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {field.required ? t('settings.customFields.requiredValue') : t('settings.customFields.optionalValue')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {field.deviceTypes && field.deviceTypes.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {field.deviceTypes.map((dt) => (
                          <span
                            key={dt}
                            className="rounded bg-muted px-1.5 py-0.5 text-xs"
                          >
                            {deviceTypeLabel(dt)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('settings.customFields.allDeviceTypes')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(field)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                        title={t('settings.customFields.edit')}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDelete(field)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-destructive"
                        title={t('settings.customFields.delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-8 overflow-y-auto">
          <div className="w-full max-w-2xl my-8 rounded-lg border bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold">
              {modalMode === 'create' ? t('settings.customFields.addCustomField') : t('settings.customFields.editCustomField')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {modalMode === 'create'
                ? t('settings.customFields.addDescription')
                : t('settings.customFields.editDescription')}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">{t('settings.customFields.displayName')}</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder={t('settings.customFields.displayNamePlaceholder')}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('settings.customFields.fieldKey')}</label>
                  <input
                    type="text"
                    value={formFieldKey}
                    onChange={(e) => setFormFieldKey(e.target.value)}
                    disabled={modalMode === 'edit'}
                    className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                    placeholder={t('settings.customFields.fieldKeyPlaceholder')}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('settings.customFields.fieldKeyHint')}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">{t('settings.customFields.fieldType')}</label>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {FIELD_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => {
                        setFormType(type.value);
                        setFormDefaultValue(null);
                        setFormOptions({});
                        setDropdownChoices([]);
                      }}
                      disabled={modalMode === 'edit'}
                      className={`rounded-md border p-3 text-left transition disabled:opacity-60 ${
                        formType === type.value
                          ? 'border-primary bg-primary/10'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="font-medium text-sm">{t(type.labelKey)}</div>
                      <div className="text-xs text-muted-foreground">
                        {t(type.descriptionKey)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Type-specific options */}
              {formType === 'dropdown' && (
                <div>
                  <label className="text-sm font-medium">{t('settings.customFields.dropdownChoices')}</label>
                  <div className="mt-2 space-y-2">
                    {dropdownChoices.map((choice, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={choice.label}
                          onChange={(e) =>
                            handleDropdownChoiceChange(index, 'label', e.target.value)
                          }
                          placeholder={t('settings.customFields.choiceLabel')}
                          className="h-9 flex-1 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <input
                          type="text"
                          value={choice.value}
                          onChange={(e) =>
                            handleDropdownChoiceChange(index, 'value', e.target.value)
                          }
                          placeholder={t('settings.customFields.choiceValue')}
                          className="h-9 w-32 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveDropdownChoice(index)}
                          className="h-9 w-9 rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mx-auto" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleAddDropdownChoice}
                      className="inline-flex h-9 items-center gap-1 rounded-md border px-3 text-sm font-medium hover:bg-muted"
                    >
                      <Plus className="h-4 w-4" />
                      {t('settings.customFields.addChoice')}
                    </button>
                  </div>
                </div>
              )}

              {formType === 'number' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">{t('settings.customFields.minimumValue')}</label>
                    <input
                      type="number"
                      value={formOptions.min ?? ''}
                      onChange={(e) =>
                        setFormOptions({
                          ...formOptions,
                          min: e.target.value ? Number(e.target.value) : undefined
                        })
                      }
                      className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('settings.customFields.maximumValue')}</label>
                    <input
                      type="number"
                      value={formOptions.max ?? ''}
                      onChange={(e) =>
                        setFormOptions({
                          ...formOptions,
                          max: e.target.value ? Number(e.target.value) : undefined
                        })
                      }
                      className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              )}

              {formType === 'text' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">{t('settings.customFields.maxLength')}</label>
                    <input
                      type="number"
                      value={formOptions.maxLength ?? ''}
                      onChange={(e) =>
                        setFormOptions({
                          ...formOptions,
                          maxLength: e.target.value ? Number(e.target.value) : undefined
                        })
                      }
                      className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('settings.customFields.pattern')}</label>
                    <input
                      type="text"
                      value={formOptions.pattern ?? ''}
                      onChange={(e) =>
                        setFormOptions({
                          ...formOptions,
                          pattern: e.target.value || undefined
                        })
                      }
                      placeholder={t('settings.customFields.patternPlaceholder')}
                      className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              )}

              <div>
                    <label className="text-sm font-medium">{t('settings.customFields.deviceTypesOptional')}</label>
                <p className="text-xs text-muted-foreground">
                  {t('settings.customFields.deviceTypesHint')}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DEVICE_TYPE_OPTIONS.map((dt) => (
                    <label
                      key={dt.value}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm cursor-pointer transition ${
                        formDeviceTypes.includes(dt.value)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formDeviceTypes.includes(dt.value)}
                        onChange={() => handleToggleDeviceType(dt.value)}
                        className="sr-only"
                      />
                      {t(dt.labelKey)}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="required"
                  checked={formRequired}
                  onChange={(e) => setFormRequired(e.target.checked)}
                  className="h-4 w-4 rounded border-muted"
                />
                <label htmlFor="required" className="text-sm font-medium">
                  {t('settings.customFields.requiredField')}
                </label>
              </div>

              {formError && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="h-10 rounded-md border px-4 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  {submitting
                    ? t('common.saving')
                    : modalMode === 'create'
                      ? t('settings.customFields.createField')
                      : t('common.saveChanges')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {modalMode === 'delete' && selectedField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4">
          <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold">{t('settings.customFields.deleteTitle')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('settings.customFields.deleteConfirmPrefix')}{' '}
              <span className="font-medium text-foreground">{selectedField.name}</span>?
              {t('settings.customFields.deleteConfirmSuffix')}
            </p>

            {formError && (
              <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="h-10 rounded-md border px-4 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="h-10 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? t('settings.customFields.deleting') : t('settings.customFields.deleteField')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
