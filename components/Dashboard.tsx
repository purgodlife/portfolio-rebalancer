'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAccounts, useAllCategories, useAllHoldings } from '@/lib/storage/hooks';
import { calculateRebalance } from '@/lib/rebalance';
import { groupHoldings } from '@/lib/rebalance/grouping';
import { mergeAccountsForUnifiedRebalance } from '@/lib/rebalance/unifiedRebalance';
import { useUsdKrwRate, FALLBACK_USD_KRW_RATE } from '@/lib/market/fxRate';
import OnboardingChecklist from './OnboardingChecklist';

/** 카테고리 하나가 목표비중과 이만큼(%p) 이상 벌어지면 "리밸런싱 필요"로 표시한다. */
const DRIFT_THRESHOLD_PP = 5;

/**
 * 홈 화면. 계좌를 고를 필요 없이 "지금 내 자산이 전체적으로 어떤 상태인지"만
 * 한눈에 보여주는 가벼운 요약이다(총자산/평가손익, 카테고리별 현재비중 vs
 * 목표비중, 리밸런싱 필요 여부). 실제 매수/매도 계산은 포트폴리오 탭의
 * 리밸런싱 계산기에서 한다 — 여기서는 항상 모든 계좌를 합산해서 보여준다
 * (계좌 선택과 무관하게 전체 그림을 보여주는 게 홈 화면의 목적이라서, 자산추이
 * 화면의 "전 계좌 합산" 보기와 같은 방식을 쓴다).
 */
export default function Dashboard() {
  const t = useTranslations('dashboard');
  const accounts = useAccounts();
  const allCategories = useAllCategories();
  const allHoldings = useAllHoldings();
  const fx = useUsdKrwRate();
  const usdKrwRate = fx.rate ?? FALLBACK_USD_KRW_RATE;

  const merged = useMemo(
    () => mergeAccountsForUnifiedRebalance(accounts, allCategories, allHoldings),
    [accounts, allCategories, allHoldings]
  );

  const hasData = merged.categories.length > 0 && merged.holdings.length > 0;
  const isAllocationValid = merged.rawTotalPercent > 0;

  const result = useMemo(() => {
    if (!hasData || !isAllocationValid) return null;
    return calculateRebalance({
      categories: merged.categories,
      holdings: merged.holdings,
      depositAmount: 0,
      depositCurrency: 'KRW',
      usdKrwRate,
      allowSell: false,
    });
  }, [merged, usdKrwRate, hasData, isAllocationValid]);

  // 평가손익(총 평가금액 - 총 매입원가)을 구하려면 매입원가가 필요한데
  // calculateRebalance()의 결과에는 없으므로, 원본 보유종목을 다시 그룹핑해서
  // 매수 lot들의 평균원가 기준으로 계산한다(평균원가법, lib/rebalance/grouping.ts).
  const totalCostBase = useMemo(() => {
    let sum = 0;
    for (const g of groupHoldings(merged.holdings)) {
      if (g.netQuantity <= 0) continue;
      const costInHoldingCcy = g.avgBuyPrice * g.netQuantity;
      sum += g.currency === 'USD' ? costInHoldingCcy * usdKrwRate : costInHoldingCcy;
    }
    return sum;
  }, [merged.holdings, usdKrwRate]);

  const totalValueBase = result?.totalValueBeforeBase ?? 0;
  const gainBase = totalValueBase - totalCostBase;
  const gainPercent = totalCostBase > 0 ? (gainBase / totalCostBase) * 100 : 0;

  const maxDriftPp = result
    ? Math.max(0, ...result.categories.map((c) => Math.abs(c.currentPercent - c.targetPercent)))
    : 0;
  const needsRebalance = maxDriftPp >= DRIFT_THRESHOLD_PP;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('allAccountsNote')}</p>
      </div>

      {!hasData && <div className="card text-sm text-gray-500">{t('emptyNote')}</div>}

      {hasData && result && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="card">
              <p className="text-xs text-gray-500">{t('totalValueLabel')}</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {Math.round(totalValueBase).toLocaleString()}{' '}
                <span className="text-sm font-normal text-gray-400">KRW</span>
              </p>
            </div>
            <div className="card">
              <p className="text-xs text-gray-500">{t('unrealizedGainLabel')}</p>
              <p className={`mt-1 text-2xl font-semibold ${gainBase >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                {gainBase >= 0 ? '+' : ''}
                {Math.round(gainBase).toLocaleString()}{' '}
                <span className="text-sm font-normal">
                  KRW ({gainPercent >= 0 ? '+' : ''}
                  {gainPercent.toFixed(1)}%)
                </span>
              </p>
            </div>
          </div>

          <div className="card">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-semibold">{t('allocationTitle')}</h3>
              {needsRebalance ? (
                <span className="whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                  {t('needsRebalanceBadge')}
                </span>
              ) : (
                <span className="whitespace-nowrap rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                  {t('onTrackBadge')}
                </span>
              )}
            </div>
            <div className="space-y-3">
              {result.categories.map((c) => (
                <div key={c.categoryId}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium text-gray-700">{c.name}</span>
                    <span className="whitespace-nowrap text-gray-500">
                      {c.currentPercent.toFixed(1)}% / {t('targetOf', { percent: c.targetPercent.toFixed(1) })}
                    </span>
                  </div>
                  <div className="relative h-2 rounded-full bg-gray-100">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-brand-500"
                      style={{ width: `${Math.min(100, Math.max(0, c.currentPercent))}%` }}
                    />
                    <div
                      className="absolute inset-y-0 w-0.5 bg-gray-800"
                      style={{ left: `${Math.min(100, Math.max(0, c.targetPercent))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link href="/portfolio/calculator" className="card transition-colors hover:border-brand-300">
          <p className="font-medium text-gray-900">{t('quickCalculator')}</p>
          <p className="mt-1 text-xs text-gray-500">{t('quickCalculatorDesc')}</p>
        </Link>
        <Link href="/portfolio/holdings" className="card transition-colors hover:border-brand-300">
          <p className="font-medium text-gray-900">{t('quickHoldings')}</p>
          <p className="mt-1 text-xs text-gray-500">{t('quickHoldingsDesc')}</p>
        </Link>
        <Link href="/records/history" className="card transition-colors hover:border-brand-300">
          <p className="font-medium text-gray-900">{t('quickHistory')}</p>
          <p className="mt-1 text-xs text-gray-500">{t('quickHistoryDesc')}</p>
        </Link>
      </div>

      <OnboardingChecklist hasCategories={allCategories.length > 0} hasHoldings={allHoldings.length > 0} />
    </div>
  );
}
