import { useState } from 'react';
import { X } from 'lucide-react';
import type { FilterFieldDefinition, FilterOperator, FilterValue } from '@breeze/shared';
import { useI18n } from '@/i18n/react';

interface ValueInputProps {
  value: FilterValue;
  onChange: (value: FilterValue) => void;
  field: FilterFieldDefinition | undefined;
  operator: FilterOperator;
  className?: string;
}

export function ValueInput({
  value,
  onChange,
  field,
  operator,
  className = ''
}: ValueInputProps) {
  const { t } = useI18n();
  // Operators that don't need a value input
  const noValueOperators: FilterOperator[] = ['isNull', 'isNotNull', 'isEmpty', 'isNotEmpty'];
  if (noValueOperators.includes(operator)) {
    return (
      <div className="flex items-center py-2 text-sm text-muted-foreground italic">
        {t('filters.valueInput.noValueNeeded')}
      </div>
    );
  }

  // Duration input for withinLast/notWithinLast
  if (operator === 'withinLast' || operator === 'notWithinLast') {
    return (
      <DurationInput
        value={value as { amount: number; unit: string }}
        onChange={onChange}
        className={className}
      />
    );
  }

  // Date range input for between
  if (operator === 'between') {
    return (
      <DateRangeInput
        value={value as { from: Date; to: Date }}
        onChange={onChange}
        className={className}
      />
    );
  }

  // Multi-select for in/notIn/hasAny/hasAll
  if (['in', 'notIn', 'hasAny', 'hasAll'].includes(operator)) {
    const arrayValue = Array.isArray(value) ? value.map(v => String(v)) : [];
    return (
      <MultiValueInput
        value={arrayValue}
        onChange={onChange}
        enumValues={field?.enumValues}
        formatEnumValue={(enumValue) => t(`filters.enumValues.${enumValue}`, undefined, formatEnumValue(enumValue))}
        className={className}
      />
    );
  }

  // Enum select for enum types
  if (field?.type === 'enum' && field.enumValues) {
    return (
      <select
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${className}`}
      >
        {field.enumValues.map((enumValue) => (
          <option key={enumValue} value={enumValue}>
            {t(`filters.enumValues.${enumValue}`, undefined, formatEnumValue(enumValue))}
          </option>
        ))}
      </select>
    );
  }

  // Boolean select
  if (field?.type === 'boolean') {
    return (
      <select
        value={String(value)}
        onChange={(e) => onChange(e.target.value === 'true')}
        className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${className}`}
      >
        <option value="true">{t('filters.valueInput.yes')}</option>
        <option value="false">{t('filters.valueInput.no')}</option>
      </select>
    );
  }

  // Number input
  if (field?.type === 'number') {
    return (
      <input
        type="number"
        value={typeof value === 'number' ? value : ''}
        onChange={(e) => onChange(e.target.valueAsNumber || 0)}
        className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${className}`}
        placeholder={t('filters.valueInput.enterNumber')}
      />
    );
  }

  // Date/datetime input
  if (field?.type === 'date' || field?.type === 'datetime') {
    const dateValue = value instanceof Date
      ? value.toISOString().slice(0, field.type === 'date' ? 10 : 16)
      : typeof value === 'string'
        ? value.slice(0, field.type === 'date' ? 10 : 16)
        : '';

    return (
      <input
        type={field.type === 'date' ? 'date' : 'datetime-local'}
        value={dateValue}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${className}`}
      />
    );
  }

  // Default text input
  return (
    <input
      type="text"
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${className}`}
      placeholder={getPlaceholder(field, operator, t)}
    />
  );
}

// Sub-components

type DurationUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months';

function DurationInput({
  value,
  onChange,
  className
}: {
  value: { amount: number; unit: string };
  onChange: (value: FilterValue) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const safeValue = value && typeof value === 'object' && 'amount' in value
    ? value
    : { amount: 7, unit: 'days' as DurationUnit };

  const handleUnitChange = (newUnit: string) => {
    const validUnit = newUnit as DurationUnit;
    onChange({ amount: safeValue.amount, unit: validUnit });
  };

  const handleAmountChange = (newAmount: number) => {
    const validUnit = safeValue.unit as DurationUnit;
    onChange({ amount: newAmount || 1, unit: validUnit });
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <input
        type="number"
        value={safeValue.amount}
        onChange={(e) => handleAmountChange(e.target.valueAsNumber)}
        min={1}
        className="w-20 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <select
        value={safeValue.unit}
        onChange={(e) => handleUnitChange(e.target.value)}
        className="rounded-md border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="minutes">{t('filters.valueInput.units.minutes')}</option>
        <option value="hours">{t('filters.valueInput.units.hours')}</option>
        <option value="days">{t('filters.valueInput.units.days')}</option>
        <option value="weeks">{t('filters.valueInput.units.weeks')}</option>
        <option value="months">{t('filters.valueInput.units.months')}</option>
      </select>
    </div>
  );
}

function DateRangeInput({
  value,
  onChange,
  className
}: {
  value: { from: Date; to: Date };
  onChange: (value: FilterValue) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const safeValue = value && typeof value === 'object' && 'from' in value
    ? value
    : { from: new Date(), to: new Date() };

  const fromStr = safeValue.from instanceof Date
    ? safeValue.from.toISOString().slice(0, 10)
    : String(safeValue.from).slice(0, 10);

  const toStr = safeValue.to instanceof Date
    ? safeValue.to.toISOString().slice(0, 10)
    : String(safeValue.to).slice(0, 10);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <input
        type="date"
        value={fromStr}
        onChange={(e) => onChange({ ...safeValue, from: new Date(e.target.value) })}
        className="rounded-md border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <span className="text-sm text-muted-foreground">{t('filters.valueInput.rangeTo')}</span>
      <input
        type="date"
        value={toStr}
        onChange={(e) => onChange({ ...safeValue, to: new Date(e.target.value) })}
        className="rounded-md border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

function MultiValueInput({
  value,
  onChange,
  enumValues,
  formatEnumValue,
  className
}: {
  value: string[];
  onChange: (value: FilterValue) => void;
  enumValues?: string[];
  formatEnumValue: (value: string) => string;
  className?: string;
}) {
  const { t } = useI18n();
  const [inputValue, setInputValue] = useState('');

  const addValue = (newValue: string) => {
    const trimmed = newValue.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInputValue('');
  };

  const removeValue = (valueToRemove: string) => {
    onChange(value.filter((v) => v !== valueToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addValue(inputValue);
    }
  };

  // If we have enum values, show checkboxes instead of free text
  if (enumValues && enumValues.length <= 10) {
    return (
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {enumValues.map((enumValue) => {
          const isSelected = value.includes(enumValue);
          return (
            <label
              key={enumValue}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs cursor-pointer transition ${
                isSelected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'hover:bg-muted'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {
                  if (isSelected) {
                    removeValue(enumValue);
                  } else {
                    onChange([...value, enumValue]);
                  }
                }}
                className="sr-only"
              />
              {formatEnumValue(enumValue)}
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-1 min-h-[36px] p-1 rounded-md border bg-background">
        {value.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs"
          >
            {v}
            <button
              type="button"
              onClick={() => removeValue(v)}
              aria-label={t('filters.valueInput.removeValue', { value: v })}
              className="rounded-full p-0.5 hover:bg-background"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => inputValue && addValue(inputValue)}
          placeholder={value.length === 0 ? t('filters.valueInput.typeAndPressEnter') : ''}
          className="flex-1 min-w-[100px] h-7 bg-transparent px-2 text-sm outline-none"
        />
      </div>
    </div>
  );
}

// Helpers

function formatEnumValue(value: string): string {
  // Convert snake_case or camelCase to Title Case
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getPlaceholder(
  field: FilterFieldDefinition | undefined,
  operator: FilterOperator,
  t: ReturnType<typeof useI18n>['t']
): string {
  if (operator === 'matches') {
    return t('filters.valueInput.regex');
  }
  if (field?.key.includes('ip')) {
    return t('filters.valueInput.ipExample');
  }
  if (field?.key.includes('mac')) {
    return t('filters.valueInput.macExample');
  }
  if (field?.key === 'hostname') {
    return t('filters.valueInput.hostnameExample');
  }
  if (field?.key === 'software.installed' || field?.key === 'software.notInstalled') {
    return t('filters.valueInput.softwareExample');
  }
  return t('filters.valueInput.enterValue');
}

export default ValueInput;
