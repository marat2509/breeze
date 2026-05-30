import { useState, type FormEvent } from 'react';
import type { FilterConditionGroup } from '@breeze/shared';
import { Dialog } from '../shared/Dialog';
import { FilterBuilder, DEFAULT_FILTER_FIELDS } from '../filters/FilterBuilder';
import { fetchWithAuth } from '../../stores/auth';
import { useI18n } from '@/i18n/react';
import { extractLocalizedApiError } from '@/lib/apiError';

type GroupType = 'static' | 'dynamic';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (groupId: string) => void;
}

const makeEmptyFilter = (): FilterConditionGroup => ({
  operator: 'AND',
  conditions: [{ field: 'hostname', operator: 'contains', value: '' }]
});

export default function CreateGroupModal({ isOpen, onClose, onCreated }: CreateGroupModalProps) {
  const { locale, t } = useI18n();
  const [name, setName] = useState('');
  const [type, setType] = useState<GroupType>('static');
  const [filterConditions, setFilterConditions] = useState<FilterConditionGroup>(makeEmptyFilter());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const body: Record<string, unknown> = { name: name.trim(), type };
      if (type === 'dynamic') {
        body.filterConditions = filterConditions;
      }

      const res = await fetchWithAuth('/device-groups', {
        method: 'POST',
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(extractLocalizedApiError(data, t('devices.groupModal.createFailed'), locale));
      }

      const data = await res.json();
      const newGroupId = data.data?.id ?? data.id;

      if (!newGroupId || typeof newGroupId !== 'string') {
        throw new Error(t('devices.groupModal.missingGroupId'));
      }

      // Reset form
      setName('');
      setType('static');
      setFilterConditions(makeEmptyFilter());
      onCreated(newGroupId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('devices.groupModal.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setType('static');
    setFilterConditions(makeEmptyFilter());
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} title={t('devices.groupModal.title')} maxWidth="lg">
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-4">{t('devices.groupModal.title')}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="group-name" className="block text-sm font-medium mb-1">{t('devices.groupModal.name')}</label>
            <input
              id="group-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('devices.groupModal.namePlaceholder')}
              required
              className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('devices.groupModal.type')}</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType('static')}
                className={`rounded-md border px-4 py-2 text-sm font-medium transition ${
                  type === 'static' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                }`}
              >
                {t('devices.groupModal.static')}
              </button>
              <button
                type="button"
                onClick={() => setType('dynamic')}
                className={`rounded-md border px-4 py-2 text-sm font-medium transition ${
                  type === 'dynamic' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                }`}
              >
                {t('devices.groupModal.dynamic')}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {type === 'static'
                ? t('devices.groupModal.staticHelp')
                : t('devices.groupModal.dynamicHelp')}
            </p>
          </div>

          {type === 'dynamic' && (
            <div>
              <label className="block text-sm font-medium mb-1">{t('devices.groupModal.filterRules')}</label>
              <FilterBuilder
                value={filterConditions}
                onChange={setFilterConditions}
                filterFields={DEFAULT_FILTER_FIELDS}
                showPreview={false}
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? t('devices.groupModal.creating') : t('devices.groupModal.createGroup')}
            </button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
