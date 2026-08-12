'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCategories, useHoldings } from '@/lib/storage/hooks';
import { calculateRebalance } from '@/lib/rebalance';
import { useUsdKrwRate, FALLBACK_USD_KRW_RATE } from '@/lib/market/fxRate';
import type { Currency } from '@/lib/rebalance/types';

const TOLERANCE = 0.05;

export default function RebalanceCalculator() {
  const t = useTranslations('calculator');
  const ta = useTranslations('allocation');
  const categories = useCategories();
  const holdings = useHoldings();

  const [depositAmount, setDepositAmount] = useState('1000000');
  const [depositCurrency, setDepositCurrency] = useState<Currency>('KRW');
  const [allowSell, setAllowSell] = useState(false);
  const fx = useUsdKrwRate();
  const [usdKrwRate, setUsdKrwRate] = useState(String(FALLBACK_USD_KRW_RATE));
  const [rateTouchedByUser, setRateTouchedByUser] = useState(false);

  // 실시간 환율이 도착하면, 사용자가 아직 직접 수정하지 않았을 때만 자동으로 채워준다.
  useEffect(() => {
    if (!rateTouchedByUser && fx.rate) {
      setUsdKrwRate(String(fx.rate));
    }
  }, [fx.rate, rateTouchedByUser]);

  const totalPercent = categories.reduce((s, c) => s + c.targetPercent, 0);
  const isAllocationValid = categories.length > 0 && Math.abs(totalPercent - 100) < TOLERANCE;

  const result = useMemo(() => {
    const amount = parseFloat(depositAmount);
    const rate = parseFloat(usdKrwRate);
    if (Number.isNaN(amount) || Number.isNaN(rate) || !isAllocationValid) return null;
    return calculateRebalance({
      categories,
      holdings,
      depositAmount: amount,
      depositCurrency,
      usdKrwRate: rate,
      allowSell,
    });
  }, [categories, holdings, depositAmount, depositCurrency, usdKrwRate, allowSell, isAllocationValid]);

  const hasData = categories.length > 0 && holdings.length > 0;

  return (
    <div className="space-y-5">
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
      </div>

      {categories.length > 0 && !isAllocationValid && (
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
                    <th className="table-cell">≈ 수량</th>
                  </tr>
                </thead>
                <tbody>
                  {result.actions
                    .filter((a) => a.action !== 'hold')
                    .map((a) => (
                      <tr key={a.holdingId}>
                        <td className="table-cell font-mono">
                          {a.ticker} <span className="text-gray-400">({a.name})</span>
                        </td>
                        <td className="table-cell">{a.action === 'buy' ? t('buy') : t('sell')}</td>
                        <td className="table-cell">
                          {Math.round(a.amountInHoldingCurrency).toLocaleString()} {a.currency}
                        </td>
                        <td className="table-cell">{a.approxShares.toFixed(2)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
