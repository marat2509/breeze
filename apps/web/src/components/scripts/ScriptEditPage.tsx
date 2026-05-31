import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, History } from 'lucide-react';
import ScriptForm, { type ScriptFormValues, type ScriptSubmitValues } from './ScriptForm';
import { mappingToRows } from './ScriptFormSchema';
import { fetchWithAuth } from '../../stores/auth';
import { useOrgStore } from '../../stores/orgStore';
import { showToast } from '../shared/Toast';
import { navigateTo } from '@/lib/navigation';
import Breadcrumbs from '../layout/Breadcrumbs';
import { extractLocalizedApiError } from '@/lib/apiError';
import { useI18n } from '@/i18n/react';

type ScriptEditPageProps = {
  scriptId?: string;
};

export default function ScriptEditPage({ scriptId }: ScriptEditPageProps) {
  const { locale, t } = useI18n();
  const [script, setScript] = useState<ScriptFormValues | null>(null);
  const [loading, setLoading] = useState(!!scriptId);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const isNew = !scriptId;

  const fetchScript = useCallback(async () => {
    if (!scriptId) return;

    try {
      setLoading(true);
      setError(undefined);
      const response = await fetchWithAuth(`/scripts/${scriptId}`);
      if (!response.ok) {
        if (response.status === 401) {
          void navigateTo('/login', { replace: true });
          return;
        }
        throw new Error(t('scripts.edit.fetchFailed'));
      }
      const data = await response.json();
      const scriptData = data.script ?? data;
      setScript({
        name: scriptData.name,
        description: scriptData.description || '',
        category: scriptData.category,
        language: scriptData.language,
        osTypes: scriptData.osTypes,
        content: scriptData.content || '',
        parameters: scriptData.parameters || [],
        timeoutSeconds: scriptData.timeoutSeconds || 300,
        runAs: scriptData.runAs || 'system',
        exitCodeSeverityMapping: mappingToRows(scriptData.exitCodeSeverityMapping),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('scripts.edit.errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [scriptId, t]);

  useEffect(() => {
    fetchScript();
  }, [fetchScript]);

  const handleSubmit = async (values: ScriptSubmitValues) => {
    setSubmitting(true);
    setError(undefined);

    try {
      const url = isNew ? '/scripts' : `/scripts/${scriptId}`;
      const method = isNew ? 'POST' : 'PUT';

      const currentOrgId = useOrgStore.getState().currentOrgId;
      const payload = isNew && currentOrgId ? { ...values, orgId: currentOrgId } : values;

      const response = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMessage = t('scripts.edit.saveFailed');
        try {
          const data = await response.json();
          errorMessage = extractLocalizedApiError(data, t('scripts.edit.saveFailed'), locale);
        } catch { /* non-JSON response body (e.g. proxy error page) */ }
        throw new Error(errorMessage);
      }

      showToast({ type: 'success', message: isNew ? t('scripts.edit.createdToast') : t('scripts.edit.savedToast') });
      void navigateTo('/scripts');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('scripts.edit.errorGeneric'));
      throw err; // re-throw so ScriptForm knows the save failed
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    void navigateTo('/scripts');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">{t('scripts.edit.loading')}</p>
        </div>
      </div>
    );
  }

  if (error && !script && !isNew) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <div className="mt-4 flex justify-center gap-3">
          <a
            href="/scripts"
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            {t('scripts.edit.backToScripts')}
          </a>
          <button
            type="button"
            onClick={fetchScript}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t('scripts.edit.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: t('scripts.edit.scriptsCrumb'), href: '/scripts' },
        { label: isNew ? t('scripts.edit.newScript') : (script?.name || t('scripts.edit.editScript')) }
      ]} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a
            href="/scripts"
            className="flex h-10 w-10 items-center justify-center rounded-md border hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </a>
          <h1 className="text-xl font-semibold tracking-tight">
            {isNew ? t('scripts.edit.newScript') : (script?.name || t('scripts.edit.editScript'))}
          </h1>
        </div>
        {!isNew && (
          <a
            href={`/scripts/${scriptId}/executions`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium transition hover:bg-muted"
          >
            <History className="h-4 w-4" />
            {t('scripts.edit.executionHistory')}
          </a>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <ScriptForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        defaultValues={script || undefined}
        submitLabel={isNew ? t('scripts.edit.createScript') : t('common.saveChanges')}
        loading={submitting}
      />
    </div>
  );
}
