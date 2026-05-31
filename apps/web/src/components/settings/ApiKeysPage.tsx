import { useState, useEffect, useCallback } from 'react';
import ApiKeyList, { type ApiKey } from './ApiKeyList';
import ApiKeyForm, { CreatedKeyModal, type ApiKeyFormValues } from './ApiKeyForm';
import { fetchWithAuth } from '../../stores/auth';
import { useOrgStore } from '../../stores/orgStore';
import type { Locale } from '@/i18n/locales';
import { useI18n } from '@/i18n/react';
import { navigateTo } from '@/lib/navigation';

type ModalMode = 'closed' | 'create' | 'view' | 'rotate' | 'revoke';

const scopeLabelKeys: Record<string, string> = {
  'devices:read': 'settings.apiKeys.scopeLabels.devicesRead',
  'devices:write': 'settings.apiKeys.scopeLabels.devicesWrite',
  'scripts:read': 'settings.apiKeys.scopeLabels.scriptsRead',
  'scripts:write': 'settings.apiKeys.scopeLabels.scriptsWrite',
  'scripts:execute': 'settings.apiKeys.scopeLabels.scriptsExecute',
  'alerts:read': 'settings.apiKeys.scopeLabels.alertsRead',
  'alerts:write': 'settings.apiKeys.scopeLabels.alertsWrite',
  'reports:read': 'settings.apiKeys.scopeLabels.reportsRead',
  'reports:write': 'settings.apiKeys.scopeLabels.reportsWrite',
  'ai:read': 'settings.apiKeys.scopeLabels.aiRead',
  'ai:write': 'settings.apiKeys.scopeLabels.aiWrite',
  'ai:execute': 'settings.apiKeys.scopeLabels.aiExecute',
  'users:read': 'settings.apiKeys.scopeLabels.usersRead',
};

function formatDate(value: string | null | undefined, locale: Locale, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(locale);
}

type ApiKeysPageProps = {
  locale?: Locale;
};

export default function ApiKeysPage({ locale: initialLocale = 'en' }: ApiKeysPageProps) {
  const { locale, t } = useI18n(initialLocale);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [modalMode, setModalMode] = useState<ModalMode>('closed');
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchApiKeys = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(undefined);
      const response = await fetchWithAuth(`/api-keys?page=${page}`);
      if (!response.ok) {
        if (response.status === 401) {
          void navigateTo('/login', { replace: true });
          return;
        }
        throw new Error(t('settings.apiKeys.errors.load'));
      }
      const data = await response.json();
      setApiKeys(data.data ?? data.apiKeys ?? []);
      const pagination = data.pagination;
      if (pagination) {
        setTotalPages(Math.ceil(pagination.total / pagination.limit) || 1);
        setCurrentPage(pagination.page ?? page);
      }
      setIsAdmin(data.isAdmin ?? false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknown'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const handleCreate = () => {
    setSelectedKey(null);
    setModalMode('create');
  };

  const handleView = (apiKey: ApiKey) => {
    setSelectedKey(apiKey);
    setModalMode('view');
  };

  const handleRotate = (apiKey: ApiKey) => {
    setSelectedKey(apiKey);
    setModalMode('rotate');
  };

  const handleRevoke = (apiKey: ApiKey) => {
    setSelectedKey(apiKey);
    setModalMode('revoke');
  };

  const handleCloseModal = () => {
    setModalMode('closed');
    setSelectedKey(null);
  };

  const handleCloseCreatedKeyModal = () => {
    setCreatedKey(null);
  };

  const handlePageChange = (page: number) => {
    fetchApiKeys(page);
  };

  const handleCreateSubmit = async (values: ApiKeyFormValues) => {
    setSubmitting(true);
    try {
      const { currentOrgId } = useOrgStore.getState();
      if (!currentOrgId) {
        throw new Error(t('settings.apiKeys.errors.noOrganization'));
      }
      const response = await fetchWithAuth('/api-keys', {
        method: 'POST',
        body: JSON.stringify({ ...values, orgId: currentOrgId })
      });

      if (!response.ok) {
        await response.json().catch(() => null);
        throw new Error(t('settings.apiKeys.errors.create'));
      }

      const data = await response.json();
      setCreatedKey(data.key);
      await fetchApiKeys(currentPage);
      handleCloseModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknown'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmRotate = async () => {
    if (!selectedKey) return;

    setSubmitting(true);
    try {
      const response = await fetchWithAuth(`/api-keys/${selectedKey.id}/rotate`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(t('settings.apiKeys.errors.rotate'));
      }

      const data = await response.json();
      setCreatedKey(data.key);
      await fetchApiKeys(currentPage);
      handleCloseModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknown'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!selectedKey) return;

    setSubmitting(true);
    try {
      const response = await fetchWithAuth(`/api-keys/${selectedKey.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(t('settings.apiKeys.errors.revoke'));
      }

      await fetchApiKeys(currentPage);
      handleCloseModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknown'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">{t('settings.apiKeys.loading')}</p>
        </div>
      </div>
    );
  }

  if (error && apiKeys.length === 0) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <button
          type="button"
          onClick={() => fetchApiKeys()}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {t('common.tryAgain')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('settings.apiKeys.title')}</h1>
          <p className="text-muted-foreground">
            {t('settings.apiKeys.description')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('settings.apiKeys.createKey')}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <ApiKeyList
        apiKeys={apiKeys}
        onView={handleView}
        onRotate={handleRotate}
        onRevoke={handleRevoke}
        locale={locale}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />

      {/* Create Modal */}
      {modalMode === 'create' && (
        <ApiKeyForm
          isOpen
          onSubmit={handleCreateSubmit}
          onCancel={handleCloseModal}
          loading={submitting}
          locale={locale}
          title={t('settings.apiKeys.createTitle')}
          description={t('settings.apiKeys.createDescription')}
          isAdmin={isAdmin}
        />
      )}

      {/* View Modal */}
      {modalMode === 'view' && selectedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-8">
          <div className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">{t('settings.apiKeys.detailsTitle')}</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-medium uppercase text-muted-foreground">{t('settings.apiKeys.name')}</label>
                <p className="mt-1 text-sm font-medium">{selectedKey.name}</p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-muted-foreground">{t('settings.apiKeys.keyPrefix')}</label>
                <p className="mt-1 font-mono text-sm">{selectedKey.keyPrefix}...</p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-muted-foreground">{t('settings.apiKeys.status')}</label>
                <p className="mt-1 text-sm">{t(`settings.apiKeys.statuses.${selectedKey.status}`)}</p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-muted-foreground">{t('settings.apiKeys.scopes')}</label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedKey.scopes.map(scope => (
                    <span
                      key={scope}
                      className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
                    >
                      {t(scopeLabelKeys[scope] ?? scope, undefined, scope)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium uppercase text-muted-foreground">{t('settings.apiKeys.created')}</label>
                  <p className="mt-1 text-sm">
                    {formatDate(selectedKey.createdAt, locale, t('settings.apiKeys.never'))}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase text-muted-foreground">{t('settings.apiKeys.lastUsed')}</label>
                  <p className="mt-1 text-sm">
                    {formatDate(selectedKey.lastUsedAt, locale, t('settings.apiKeys.never'))}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium uppercase text-muted-foreground">{t('settings.apiKeys.expires')}</label>
                  <p className="mt-1 text-sm">
                    {formatDate(selectedKey.expiresAt, locale, t('settings.apiKeys.never'))}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase text-muted-foreground">{t('settings.apiKeys.rateLimit')}</label>
                  <p className="mt-1 text-sm">
                    {selectedKey.rateLimit
                      ? t('settings.apiKeys.requestsPerHour', { count: selectedKey.rateLimit })
                      : t('settings.apiKeys.defaultLimit')}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleCloseModal}
                className="h-10 rounded-md border px-4 text-sm font-medium text-muted-foreground transition hover:text-foreground"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rotate Confirmation Modal */}
      {modalMode === 'rotate' && selectedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-8">
          <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">{t('settings.apiKeys.rotateTitle')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('settings.apiKeys.rotateConfirmPrefix')}{' '}
              <span className="font-medium">{selectedKey.name}</span>{t('settings.apiKeys.rotateConfirmSuffix')}
            </p>
            <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="text-xs text-amber-800">
                {t('settings.apiKeys.rotateWarning')}
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="h-10 rounded-md border px-4 text-sm font-medium text-muted-foreground transition hover:text-foreground"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmRotate}
                disabled={submitting}
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? t('settings.apiKeys.rotating') : t('settings.apiKeys.rotateKey')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Confirmation Modal */}
      {modalMode === 'revoke' && selectedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-8">
          <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">{t('settings.apiKeys.revokeTitle')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('settings.apiKeys.revokeConfirmPrefix')}{' '}
              <span className="font-medium">{selectedKey.name}</span>{t('settings.apiKeys.revokeConfirmSuffix')}
            </p>
            <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3">
              <p className="text-xs text-destructive">
                {t('settings.apiKeys.revokeWarning')}
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="h-10 rounded-md border px-4 text-sm font-medium text-muted-foreground transition hover:text-foreground"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                disabled={submitting}
                className="inline-flex h-10 items-center justify-center rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? t('settings.apiKeys.revoking') : t('settings.apiKeys.revokeKey')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Created Key Modal */}
      <CreatedKeyModal
        isOpen={!!createdKey}
        apiKey={createdKey ?? ''}
        locale={locale}
        onClose={handleCloseCreatedKeyModal}
      />
    </div>
  );
}
