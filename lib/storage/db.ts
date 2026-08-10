'use client';

import Dexie, { type Table } from 'dexie';
import type { Category, Holding } from '@/lib/rebalance/types';

export interface WatchlistItem {
  id: string;
  ticker: string;
  name: string;
  market: 'KR' | 'US';
}

export interface AppSettings {
  id: 'app-settings';
  locale: 'ko' | 'en';
  hasAgreedToDisclaimer: boolean;
  disclaimerAgreedAt?: string;
}

/**
 * 브라우저 로컬(IndexedDB)에만 저장되는 데이터베이스.
 * 서버로 전송되거나 서버에 저장되는 데이터는 전혀 없다.
 */
export class PortfolioDatabase extends Dexie {
  categories!: Table<Category, string>;
  holdings!: Table<Holding, string>;
  watchlist!: Table<WatchlistItem, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('portfolio-rebalancer-db');
    this.version(1).stores({
      categories: 'id',
      holdings: 'id, categoryId',
      watchlist: 'id',
      settings: 'id',
    });
  }
}

let dbInstance: PortfolioDatabase | null = null;

export function getDb(): PortfolioDatabase {
  if (typeof window === 'undefined') {
    throw new Error('getDb()는 브라우저 환경에서만 호출할 수 있습니다.');
  }
  if (!dbInstance) {
    dbInstance = new PortfolioDatabase();
  }
  return dbInstance;
}
