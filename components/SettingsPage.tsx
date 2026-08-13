'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { exportBackup, downloadBackupFile, importBackup } from '@/lib/storage/backup';
import LanguageSwitcher from './LanguageSwitcher';

type ImportStatus = { type: 'success' | 'error'; message: string } | null;

/**
 * 백업/복원은 전부 브라우저 안에서 끝난다. 내보내기는 로컬 DB를 JSON 파일로
 * 다운로드하고, 가져오기는 그 파일을 읽어 로컬 DB를 덮어쓴다. 서버로 전송되는
 * 데이터는 전혀 없다.
 */
export default function SettingsPage() {
  const t = useTranslations('settings');
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<ImportStatus>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onExport() {
    const payload = await exportBackup();
    const date = new Date().toISOString().slice(0, 10);
    downloadBackupFile(payload, `portfolio-backup-${date}.json`);
  }

  function onImportClick() {
    fileInputRef.current?.click();
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!window.confirm(t('importWarning'))) return;
    setImporting(true);
    setStatus(null);
    try {
      await importBackup(file);
      setStatus({ type: 'success', message: t('importSuccess') });
    } catch {
      setStatus({ type: 'error', message: t('importError') });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{t('title')}</h1>
      </div>

      <div className="card space-y-3">
        <h2 className="font-medium text-gray-900">{t('language')}</h2>
        <LanguageSwitcher />
      </div>

      <div className="card space-y-3">
        <h2 className="font-medium text-gray-900">{t('backupTitle')}</h2>
        <p className="text-sm text-gray-500">{t('backupDescription')}</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-primary" onClick={onExport}>
            {t('exportJson')}
          </button>
          <button type="button" className="btn-secondary" disabled={importing} onClick={onImportClick}>
            {importing ? t('importing') : t('importJson')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={onFileSelected}
          />
        </div>
        <p className="text-xs text-amber-600">{t('importWarning')}</p>
        {status && (
          <p className={`text-sm ${status.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {status.message}
          </p>
        )}
      </div>
    </div>
  );
}
