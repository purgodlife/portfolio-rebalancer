'use client';

import { useEffect } from 'react';
import { useCategories, useHoldings, upsertSnapshot } from '@/lib/storage/hooks';
import { useUsdKrwRate, FALLBACK_USD_KRW_RATE } from '@/lib/market/fxRate';
import { computeSnapshot } from '@/lib/rebalance/snapshot';

/**
 * 화면에 아무것도 그리지 않는다. 앱을 쓸 때마다(카테고리/보유종목/환율이 바뀔 때마다)
 * "오늘 날짜" 스냅샷을 최신값으로 덮어써서, 시간이 지나며 월별 자산추이가 자연스럽게
 * 쌓이게 한다. 과거 시세를 따로 구해오지 않으므로 오늘 이전 데이터는 생기지 않는다.
 */
export default function PortfolioSnapshotter() {
  const categories = useCategories();
  const holdings = useHoldings();
  const fx = useUsdKrwRate();

  useEffect(() => {
    if (categories.length === 0 || holdings.length === 0) return;
    const rate = fx.rate ?? FALLBACK_USD_KRW_RATE;
    const today = new Date().toISOString().slice(0, 10);
    const snapshot = computeSnapshot(categories, holdings, rate, today);
    upsertSnapshot(snapshot);
  }, [categories, holdings, fx.rate]);

  return null;
}
