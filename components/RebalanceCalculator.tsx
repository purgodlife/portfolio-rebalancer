'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCategories, useHoldings } from '@/lib/storage/hooks';
import { calculateRebalance } from '@/lib/rebalance';
import type { Currency } from '@/lib/rebalance/types';

// MVP 기본 환율 (사용자가 값을 직접 조정 가능). 이후 단계에서 Frankfurter.app 실시간 조회로 대체.
const DEFAULT_USD_KRW = 1380;

export default function RebalanceCalculator() {
  const t = useTranslations('calculator');
  const categories = useCategories();
  const holdings = useHoldings();

  const [depositAmount, setDepositAmount] = useState('1000000');
  const [depositCurrency, setDepositCurrency] = useState<Currency>('KRW');
  const [allowSell, setAllowSell] = useState(false);
  const [usdKrwRate, setUsdKrwRate] = useState(String(DEFAULT_USD_KRW));

  const result = useMemo(() => {
    const amount = parseFloat(depositAmount);
    const rate = parseFloat(usdKrwRate);
    if (Number.isNaN(amount) || Number.isNaN(rate) || categories.length === 0) return null;
    return calculateRebalance({
      categories,
      holdings,
      depositAmount: amount,
      depositCurrency,
      usdKrwRate: rate,
      allowSell,
    });
  }, [categories, holdings, depositAmount, depositCurrency, usdKrwRate, allowSell]);

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
            <label className="block text-xs text-gray-500 mb-1">USD/KRW</label>
            <input
              type="number"
              className="input"
              value={usdKrwRate}
              onChange={(e) => setUsdKrwRate(e.target.value)}
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

      {!hasData && (
        <div className="card text-sm text-gray-500">{t('noHoldings')}</div>
      )}

      {hasData && result && (
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
