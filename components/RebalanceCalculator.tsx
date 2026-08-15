'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCategories, useHoldings, useAllCategories, useAllHoldings, useAccounts } from '@/lib/storage/hooks';
import { calculateRebalance } from '@/lib/rebalance';
import { groupHoldings } from '@/lib/rebalance/grouping';
import { mergeAccountsForUnifiedRebalance } from '@/lib/rebalance/unifiedRebalance';
import { useUsdKrwRate, FALLBACK_USD_KRW_RATE } from '@/lib/market/fxRate';
import { primaryLabel, secondaryLabel } from '@/lib/format/holdingLabel';
import { calculateTradeCost } from '@/lib/tax/tradeCosts';
import type { Currency } from '@/lib/rebalance/types';
import CurrentAccountBadge from './CurrentAccountBadge';
import InfoTooltip from './InfoTooltip';
import OnboardingChecklist from './OnboardingChecklist';

const TOLERANCE = 0.05;
const UNIFIED_MODE_STORAGE_KEY = 'portfolio-rebalancer:unifiedRebalance';

export default function RebalanceCalculator() {
  const t = useTranslations('calculator');
  const ta = useTranslations('allocation');
  const categories = useCategories();
  const holdings = useHoldings();
  const accounts = useAccounts();
  const allCategories = useAllCategories();
  const allHoldings = useAllHoldings();

  const [unifiedMode, setUnifiedMode] = useState(false);
  useEffect(() => {
    setUnifiedMode(window.localStorage.getItem(UNIFIED_MODE_STORAGE_KEY) === '1');
  }, []);
  function changeUnifiedMode(value: boolean) {
    setUnifiedMode(value);
    window.localStorage.setItem(UNIFIED_MODE_STORAGE_KEY, value ? '1' : '0');
  }

  const unifiedMerge = useMemo(() => {
    if (!unifiedMode) return null;
    return mergeAccountsForUnifiedRebalance(accounts, allCategories, allHoldings);
  }, [unifiedMode, accounts, allCategories, allHoldings]);

  const activeCategories = unifiedMerge ? unifiedMerge.categories : categories;
  const activeHoldings = unifiedMerge ? unifiedMerge.holdings : holdings;

  const [depositAmount, setDepositAmount] = useState('1000000');
  const [depositCurrency, setDepositCurrency] = useState<Currency>('KRW');
  const [allowSell, setAllowSell] = useState(false);
  const [feeRatePercent, setFeeRatePercent] = useState('0');
  const [applyCosts, setApplyCosts] = useState(false);
  const fx = useUsdKrwRate();
  const [usdKrwRate, setUsdKrwRate] = useState(String(FALLBACK_USD_KRW_RATE));
  const [rateTouchedByUser, setRateTouchedByUser] = useState(false);

  // 실시간 환율이 도착하면, 사용자가 아직 직접 수정하지 않았을 때만 자동으로 채워준다.
  useEffect(() => {
    if (!rateTouchedByUser && fx.rate) {
      setUsdKrwRate(String(fx.rate));
    }
  }, [fx.rate, rateTouchedByUser]);

  const totalPercent = activeCategories.reduce((s, c) => s + c.targetPercent, 0);
  const isAllocationValid = activeCategories.length > 0 && Math.abs(totalPercent - 100) < TOLERANCE;

  const result = useMemo(() => {
    const amount = parseFloat(depositAmount);
    const rate = parseFloat(usdKrwRate);
    if (Number.isNaN(amount) || Number.isNaN(rate) || !isAllocationValid) return null;
    return calculateRebalance({
      categories: activeCategories,
      holdings: activeHoldings,
      depositAmount: amount,
      depositCurrency,
      usdKrwRate: rate,
      allowSell,
    });
  }, [activeCategories, activeHoldings, depositAmount, depositCurrency, usdKrwRate, allowSell, isAllocationValid]);

  // 매도 시 실현손익(해외주식 양도세 추정용)을 구하려면 평단가가 필요한데,
  // RebalanceResult.actions에는 없으므로 원본 보유종목을 다시 그룹핑해서 조회한다.
  const groupByKey = useMemo(() => {
    const map = new Map<string, { avgBuyPrice: number; currentPrice: number }>();
    for (const g of groupHoldings(activeHoldings)) {
      map.set(g.key, { avgBuyPrice: g.avgBuyPrice, currentPrice: g.currentPrice });
    }
    return map;
  }, [activeHoldings]);

  const feeRate = parseFloat(feeRatePercent) || 0;

  const hasData = activeCategories.length > 0 && activeHoldings.length > 0;
  const hasUsSell = !!result?.actions.some((a) => a.action === 'sell' && a.market === 'US');

  return (
    <div className="space-y-5">
      <CurrentAccountBadge />
      <OnboardingChecklist hasCategories={categories.length > 0} hasHoldings={holdings.length > 0} />

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-700">{t('scopeLabel')}</span>
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-sm">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 ${
                !unifiedMode ? 'bg-white font-medium text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
              onClick={() => changeUnifiedMode(false)}
            >
              {t('scopePerAccount')}
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 ${
                unifiedMode ? 'bg-white font-medium text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
              onClick={() => changeUnifiedMode(true)}
            >
              {t('scopeUnified')}
            </button>
          </div>
        </div>
        {unifiedMode && <p className="mt-2 text-xs text-gray-500">{t('unifiedHint')}</p>}
      </div>

      {unifiedMode && unifiedMerge && unifiedMerge.warnings.length > 0 && (
        <div className="card border-amber-200 bg-amber-50 text-amber-800">
          <p className="text-sm font-medium">{t('unifiedWarningTitle')}</p>
          <ul className="mt-1.5 space-y-1 text-xs">
            {unifiedMerge.warnings.map((w) => (
              <li key={w.categoryName}>
                {t('unifiedWarningItem', {
                  name: w.categoryName,
                  details: w.targets.map((tg) => `${tg.accountName} ${tg.targetPercent}%`).join(', '),
                  avg: w.averagedTargetPercent.toFixed(1),
                })}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold mb-1">{t('title')}</h2>
        <p className="text-sm text-gray-500 mb-4">{t('description')}</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('depositAmount')}</label>
            <input
              type="number"
              className="input"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('depositCurrency')}</label>
            <select
              className="input"
              value={depositCurrency}
              onChange={(e) => setDepositCurrency(e.target.value as Currency)}
            >
              <option value="KRW">KRW</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              USD/KRW {fx.loading && !rateTouchedByUser && '(조회 중...)'}
            </label>
            <input
              type="number"
              className="input"
              value={usdKrwRate}
              onChange={(e) => {
                setRateTouchedByUser(true);
                setUsdKrwRate(e.target.value);
              }}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allowSell}
              onChange={(e) => setAllowSell(e.target.checked)}
            />
            {t('allowSell')}
          </label>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 items-end border-t border-gray-100 pt-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('feeRatePercent')}</label>
            <input
              type="number"
              step="0.001"
              className="input"
              value={feeRatePercent}
              onChange={(e) => setFeeRatePercent(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={applyCosts} onChange={(e) => setApplyCosts(e.target.checked)} />
            {t('applyCosts')}{' '}
            <InfoTooltip text={t('applyCostsInfo')} source={t('sourceTax')} />
          </label>
        </div>
      </div>

      {activeCategories.length > 0 && !isAllocationValid && (
        <div className="card border-red-300 bg-red-50 text-red-600">
          <p className="text-sm font-medium">{t('invalidAllocation')}</p>
          <p className="text-xs mt-1 text-red-500">
            {ta('totalLabel')}: {totalPercent.toFixed(1)}%
          </p>
        </div>
      )}

      {!hasData && isAllocationValid && (
        <div className="card text-sm text-gray-500">{t('noHoldings')}</div>
      )}

      {hasData && isAllocationValid && result && (
        <>
          <div className="card">
            <h3 className="font-semibold mb-3">{t('resultTitle')}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="table-cell">{t('colCategory')}</th>
                    <th className="table-cell">{t('colCurrent')}</th>
                    <th className="table-cell">{t('colTarget')}</th>
                    <th className="table-cell">{t('totalAfter')}</th>
                    <th className="table-cell">{t('colAction')}</th>
                    <th className="table-cell">{t('colAmount')} (KRW)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.categories.map((c) => (
                    <tr key={c.categoryId}>
                      <td className="table-cell font-medium">{c.name}</td>
                      <td className="table-cell">{c.currentPercent.toFixed(1)}%</td>
                      <td className="table-cell">{c.targetPercent.toFixed(1)}%</td>
                      <td className="table-cell">{c.projectedPercent.toFixed(1)}%</td>
                      <td className="table-cell">
                        {c.diffBase > 0.5 ? t('buy') : c.diffBase < -0.5 ? t('sell') : '-'}
                      </td>
                      <td className="table-cell">
                        {Math.round(Math.abs(c.diffBase)).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-3">{t('colTicker')}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="table-cell">{t('colTicker')}</th>
                    <th className="table-cell">{t('colAction')}</th>
                    <th className="table-cell">{t('colAmount')}</th>
                    <th className="table-cell">{t('colQuantity')}</th>
                    {applyCosts && (
                      <>
                        <th className="table-cell">{t('colFee')}</th>
                        <th className="table-cell">{t('colTax')}</th>
                        <th className="table-cell">{t('colNetAmount')}</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {result.actions
                    .filter((a) => a.action !== 'hold')
                    .map((a) => {
                      let cost = null;
                      if (applyCosts && (a.action === 'buy' || a.action === 'sell')) {
                        const group = groupByKey.get(a.holdingId);
                        const realizedGain =
                          a.action === 'sell' && group
                            ? (group.currentPrice - group.avgBuyPrice) * a.approxShares
                            : undefined;
                        cost = calculateTradeCost({
                          market: a.market,
                          action: a.action,
                          amount: a.amountInHoldingCurrency,
                          feeRatePercent: feeRate,
                          realizedGain,
                        });
                      }
                      const tax = cost ? cost.securitiesTransactionTax + cost.estimatedCapitalGainsTax : 0;
                      return (
                        <tr key={a.holdingId}>
                          <td className="table-cell">
                            <span className={a.market === 'KR' ? '' : 'font-mono'}>{primaryLabel(a)}</span>{' '}
                            <span className="font-mono text-gray-400">({secondaryLabel(a)})</span>
                            {unifiedMode &&
                              unifiedMerge &&
                              (unifiedMerge.accountsByHoldingKey[a.holdingId]?.length ?? 0) > 1 && (
                                <span className="mt-0.5 block text-[11px] text-amber-600">
                                  {t('unifiedMultiAccountNote', {
                                    accounts: unifiedMerge.accountsByHoldingKey[a.holdingId].join(', '),
                                  })}
                                </span>
                              )}
                          </td>
                          <td className={`table-cell ${a.action === 'sell' ? 'text-red-600' : 'text-brand-600'}`}>
                            {a.action === 'buy' ? t('buy') : t('sell')}
                          </td>
                          <td className="table-cell">
                            {Math.round(a.amountInHoldingCurrency).toLocaleString()} {a.currency}
                          </td>
                          <td className="table-cell">
                            {a.action === 'sell'
                              ? `${a.approxShares.toLocaleString()}${t('sharesUnit')}`
                              : `${t('approxSharesPrefix')} ${a.approxShares.toFixed(2)}`}
                          </td>
                          {applyCosts && cost && (
                            <>
                              <td className="table-cell text-gray-500">
                                {Math.round(cost.feeAmount).toLocaleString()} {a.currency}
                              </td>
                              <td className="table-cell text-gray-500">
                                {tax > 0 ? `${Math.round(tax).toLocaleString()} ${a.currency}` : '-'}
                              </td>
                              <td className="table-cell font-medium">
                                {Math.round(cost.netAmount).toLocaleString()} {a.currency}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {result.actions.some((a) => a.action === 'sell') && (
              <p className="text-xs text-gray-400 mt-3">{t('sellQuantityNote')}</p>
            )}
            {applyCosts && (
              <p className="text-xs text-gray-400 mt-1">{t('costNote')}</p>
            )}
            {applyCosts && hasUsSell && (
              <p className="text-xs text-amber-600 mt-1">{t('usCapitalGainsNote')}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
