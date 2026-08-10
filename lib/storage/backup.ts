'use client';

import { getDb, type AppSettings, type WatchlistItem } from './db';
import type { Category, Holding } from '@/lib/rebalance/types';

export interface BackupPayload {
  schemaVersion: 1;
  exportedAt: string;
  categories: Category[];
  holdings: Holding[];
  watchlist: WatchlistItem[];
  settings: AppSettings[];
}

/** 현재 로컬 DB 전체를 JSON으로 직렬화한다. 서버 전송 없음. */
export async function exportBackup(): Promise<BackupPayload> {
  const db = getDb();
  const [categories, holdings, watchlist, settings] = await Promise.all([
    db.categories.toArray(),
    db.holdings.toArray(),
    db.watchlist.toArray(),
    db.settings.toArray(),
  ]);
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    categories,
    holdings,
    watchlist,
    settings,
  };
}

export function downloadBackupFile(payload: BackupPayload, filename = 'portfolio-backup.json') {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function isBackupPayload(data: unknown): data is BackupPayload {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    d.schemaVersion === 1 &&
    Array.isArray(d.categories) &&
    Array.isArray(d.holdings) &&
    Array.isArray(d.watchlist)
  );
}

/** JSON 백업 파일을 읽어 로컬 DB를 덮어쓴다. 기존 데이터는 모두 대체된다. */
export async function importBackup(file: File): Promise<void> {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!isBackupPayload(data)) {
    throw new Error('올바르지 않은 백업 파일 형식입니다.');
  }
  const db = getDb();
  await db.transaction('rw', db.categories, db.holdings, db.watchlist, db.settings, async () => {
    await Promise.all([
      db.categories.clear(),
      db.holdings.clear(),
      db.watchlist.clear(),
      db.settings.clear(),
    ]);
    await Promise.all([
      db.categories.bulkAdd(data.categories),
      db.holdings.bulkAdd(data.holdings),
      db.watchlist.bulkAdd(data.watchlist),
      db.settings.bulkAdd(data.settings ?? []),
    ]);
  });
}
