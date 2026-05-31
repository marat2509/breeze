import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { resources } from '../src/i18n/resources.ts';
import { SUPPORTED_LOCALES } from '../src/i18n/locales.ts';

type FlatResources = Record<string, string>;

function flatten(value: unknown, prefix = ''): FlatResources {
  if (!value || typeof value !== 'object') return {};
  return Object.entries(value as Record<string, unknown>).reduce<FlatResources>((acc, [key, child]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') {
      acc[next] = child;
    } else {
      Object.assign(acc, flatten(child, next));
    }
    return acc;
  }, {});
}

function interpolationTokens(value: string): string[] {
  return [...value.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(match => match[1]).sort();
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return walk(fullPath);
    return fullPath;
  });
}

function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function checkKeyParity(errors: string[]) {
  const resourceLocales = new Set(Object.keys(resources));
  const supportedLocales = new Set(SUPPORTED_LOCALES);
  const base = flatten(resources.en);
  const baseKeys = Object.keys(base).sort();

  for (const locale of SUPPORTED_LOCALES) {
    if (!resourceLocales.has(locale)) {
      errors.push(`${locale} resources are missing`);
      continue;
    }

    if (locale === 'en') continue;

    const localized = flatten(resources[locale]);
    const localizedKeys = Object.keys(localized).sort();
    const missing = baseKeys.filter(key => !(key in localized));
    const extra = localizedKeys.filter(key => !(key in base));

    for (const key of missing) errors.push(`${locale} is missing key: ${key}`);
    for (const key of extra) errors.push(`${locale} has extra key: ${key}`);

    for (const key of baseKeys) {
      if (!(key in localized)) continue;
      const baseTokens = interpolationTokens(base[key]);
      const localizedTokens = interpolationTokens(localized[key]);
      if (baseTokens.join(',') !== localizedTokens.join(',')) {
        errors.push(`interpolation mismatch for ${locale}.${key}: en=[${baseTokens}] ${locale}=[${localizedTokens}]`);
      }
    }
  }

  for (const locale of resourceLocales) {
    if (!supportedLocales.has(locale as typeof SUPPORTED_LOCALES[number])) {
      errors.push(`resources include unsupported locale: ${locale}`);
    }
  }
}

function checkLocaleValues(root: string, errors: string[]) {
  const valid = new Set(SUPPORTED_LOCALES);
  const files = walk(path.join(root, 'src')).filter(file => /\.(ts|tsx|astro)$/.test(file));
  const localeLiteralPattern = /\blocale\s*[:=]\s*["']([a-z]{2})["']/g;

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(localeLiteralPattern)) {
      if (!valid.has(match[1] as typeof SUPPORTED_LOCALES[number])) {
        errors.push(`${normalizePath(path.relative(root, file))}: invalid locale literal "${match[1]}"`);
      }
    }
  }
}

const HARD_CODED_SCAN_FILES = [
  'src/components/auth/AuthPage.tsx',
  'src/components/auth/LoginForm.tsx',
  'src/components/auth/LoginPage.tsx',
  'src/components/devices/AddDeviceModal.tsx',
  'src/components/devices/ChangeSiteModal.tsx',
  'src/components/devices/CreateGroupModal.tsx',
  'src/components/devices/DeviceAlertHistory.tsx',
  'src/components/devices/DeviceActions.tsx',
  'src/components/devices/DeviceBootPerformanceTab.tsx',
  'src/components/devices/DeviceCard.tsx',
  'src/components/devices/DeviceCompare.tsx',
  'src/components/devices/DeviceDetailPage.tsx',
  'src/components/devices/DeviceDetails.tsx',
  'src/components/devices/DeviceEffectiveConfigTab.tsx',
  'src/components/devices/DeviceEventLogViewer.tsx',
  'src/components/devices/DeviceFilters.tsx',
  'src/components/devices/DeviceFilesystemTab.tsx',
  'src/components/devices/DeviceGroupsPage.tsx',
  'src/components/devices/DeviceHardwareInventory.tsx',
  'src/components/devices/DeviceInfoTab.tsx',
  'src/components/devices/DeviceIpHistoryTab.tsx',
  'src/components/devices/DeviceSettingsModal.tsx',
  'src/components/devices/DeviceList.tsx',
  'src/components/devices/DeviceLogsTab.tsx',
  'src/components/devices/DeviceManagementTab.tsx',
  'src/components/devices/DeviceMetricsChart.tsx',
  'src/components/devices/DeviceNetworkConnections.tsx',
  'src/components/devices/DevicePerformanceGraphs.tsx',
  'src/components/devices/DevicePatchStatusTab.tsx',
  'src/components/devices/DevicePeripheralsTab.tsx',
  'src/components/devices/DevicePlaybookHistory.tsx',
  'src/components/devices/DeviceScriptHistory.tsx',
  'src/components/devices/DeviceSecurityTab.tsx',
  'src/components/devices/DeviceSoftwareInventory.tsx',
  'src/components/devices/DevicesPage.tsx',
  'src/components/devices/DeviceWarrantyCard.tsx',
  'src/components/devices/MacOSPermissionsBanner.tsx',
  'src/components/devices/MacOSPermissionsCard.tsx',
  'src/components/devices/ScriptPickerModal.tsx',
  'src/components/dashboard/DashboardStats.tsx',
  'src/components/dashboard/DeviceStatusChart.tsx',
  'src/components/dashboard/DashboardCustomizer.tsx',
  'src/components/dashboard/RecentActivity.tsx',
  'src/components/dashboard/RecentAlerts.tsx',
  'src/components/scripts/ExecutionDetails.tsx',
  'src/components/scripts/ExecutionHistory.tsx',
  'src/components/patches/PatchApprovalModal.tsx',
  'src/components/patches/PatchComplianceView.tsx',
  'src/components/patches/PatchInstallHistory.tsx',
  'src/components/patches/PatchList.tsx',
  'src/components/patches/PatchesPage.tsx',
  'src/components/patches/RingSelector.tsx',
  'src/components/patches/SourceFilterChips.tsx',
  'src/components/patches/UpdateRingForm.tsx',
  'src/components/patches/UpdateRingList.tsx',
  'src/components/filters/ConditionGroup.tsx',
  'src/components/filters/ConditionRow.tsx',
  'src/components/filters/DeviceFilterBar.tsx',
  'src/components/filters/DeviceTargetSelector.tsx',
  'src/components/filters/FieldSelector.tsx',
  'src/components/filters/FilterBuilder.tsx',
  'src/components/filters/FilterPreview.tsx',
  'src/components/filters/OperatorSelector.tsx',
  'src/components/filters/SavedFilterList.tsx',
  'src/components/filters/ValueInput.tsx',
  'src/components/scripts/ScriptParametersForm.tsx',
  'src/components/scripts/ScriptAiInput.tsx',
  'src/components/scripts/ScriptAiMessages.tsx',
  'src/components/scripts/ScriptAiPanel.tsx',
  'src/components/scripts/ScriptCategoryTree.tsx',
  'src/components/scripts/ScriptEditPage.tsx',
  'src/components/scripts/ScriptForm.tsx',
  'src/components/scripts/ScriptExecutionModal.tsx',
  'src/components/scripts/ScriptExecutionsPage.tsx',
  'src/components/scripts/ScriptList.tsx',
  'src/components/scripts/ScriptTagManager.tsx',
  'src/components/scripts/ScriptTemplateGallery.tsx',
  'src/components/scripts/ScriptVersionHistory.tsx',
  'src/components/scripts/ScriptsPage.tsx',
  'src/components/auth/MFAVerifyForm.tsx',
  'src/components/account/AccountSubNav.tsx',
  'src/components/account/AccountDeletionPage.tsx',
  'src/components/account/MobileDevicesPage.tsx',
  'src/components/account/MyConnectedAppsPage.tsx',
  'src/components/account/TestApprovalPage.tsx',
  'src/components/layout/CommandPalette.tsx',
  'src/components/layout/Header.tsx',
  'src/components/layout/LanguageSelector.tsx',
  'src/components/layout/Sidebar.tsx',
  'src/components/settings/ChangePasswordForm.tsx',
  'src/components/settings/MFASettings.tsx',
  'src/components/settings/PartnerSettingsPage.tsx',
  'src/components/settings/ProfilePage.tsx',
  'src/layouts/AuthLayout.astro',
  'src/layouts/AuthShellBranded.astro',
  'src/layouts/DashboardLayout.astro',
  'src/layouts/Layout.astro',
  'src/layouts/SetupLayout.astro',
  'src/pages/auth.astro',
  'src/pages/account/delete.astro',
  'src/pages/account/connected-apps.astro',
  'src/pages/account/devices.astro',
  'src/pages/account/test-approval.astro',
  'src/pages/login.astro',
  'src/pages/register-partner.astro',
  'src/pages/settings/partner.astro',
  'src/pages/settings/profile.astro',
  'src/pages/setup.astro',
];

const UI_TEXT_ALLOWLIST = new Set([
  'Breeze',
  'Breeze RMM',
  'Web',
  'API',
  'Esc',
  'Set',
  'Promise',
]);

function stripExpressions(value: string): string {
  return value.replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim();
}

function checkHardcodedUiText(root: string, errors: string[]) {
  const jsxTextPattern = /(?<!=)>\s*([A-ZА-Я][^<>{}]*[a-zа-я][^<>{}]*)\s*</g;
  const attrPattern = /\b(?:aria-label|title|placeholder)\s*=\s*["']([^"']*[A-Za-zА-Яа-я][^"']*)["']/g;

  for (const relative of HARD_CODED_SCAN_FILES) {
    const file = path.join(root, relative);
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf8');
    const matches = [
      ...text.matchAll(jsxTextPattern).map(match => stripExpressions(match[1])),
      ...text.matchAll(attrPattern).map(match => stripExpressions(match[1])),
    ].filter(Boolean);

    for (const value of matches) {
      if (UI_TEXT_ALLOWLIST.has(value)) continue;
      if (/^(svg|path|div|span|button|label|input|select|option|section|header|main)$/i.test(value)) continue;
      if (/^(http|data-|aria-|className|on[A-Z]|client:|transition:)/.test(value)) continue;
      errors.push(`${relative}: hardcoded UI text "${value}"`);
    }
  }
}

const root = process.cwd();
const errors: string[] = [];

checkKeyParity(errors);
checkLocaleValues(root, errors);
checkHardcodedUiText(root, errors);

if (errors.length > 0) {
  console.error(`i18n check failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('i18n check passed');
