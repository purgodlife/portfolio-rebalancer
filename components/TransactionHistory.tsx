'use client';

import { useTranslations } from 'next-intl';
import { useCategories, useHoldings, removeHolding } from '@/lib/storage/hooks';
import { lotCreatedAt } from '@/lib/rebalance/lotTime';
import { calculateUsRealizedGainsByYear, estimateUsCapitalGainsTax } from '@/lib/tax/usRealizedGains';
import { US_CAPITAL_GAINS_ANNUAL_DEDUCTION_KRW } from '@/lib/tax/tradeCosts';
import { useUsdKrwRate, FALLBACK_USD_KRW_RATE } from '@/lib/market/fxRate';
import InfoTooltip from './InfoTooltip';
import CurrentAccountBadge from './CurrentAccountBadge';

export default function TransactionHistory() {
  const t = useTranslations('history');
  const th = useTranslations('holdings');
  const tc = useTranslations('common');
  const categories = useCategories();
  const holdings = useHoldings();
  const fx = useUsdKrwRate();
  const usdKrwRate = fx.rate ?? FALLBACK_USD_KRW_RATE;

  const yearlyUsGains = calculateUsRealizedGainsByYear(holdings, usdKrwRate);

  function categoryName(id: string) {
    return categories.find((c) => c.id === id)?.name ?? '-';
  }

  const sorted = [...holdings].sort((a, b) => lotCreatedAt(b) - lotCreatedAt(a));

  return (
    <div className="card">
      <CurrentAccountBadge />
      <h2 className="text-lg font-semibold mb-1">{t('title')}</h2>
      <p className="text-sm text-gray-500 mb-4">{t('description')}</p>

      {yearlyUsGains.length > 0 && (
        <div className="mb-5 rounded-md border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {t('usGainsTitle')} <InfoTooltip text={t('usGainsInfo')} source={t('usGainsSource')} />
          </h3>
          <p className="mt-1 text-xs text-gray-500">{t('usGainsDescription')}</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="table-cell">{t('usGainsYear')}</th>
                  <th className="table-cell">{t('usGainsSellCount')}</th>
                  <th className="table-cell">{t('usGainsRealizedUsd')}</th>
                  <th className="table-cell">{t('usGainsRealizedKrw')}</th>
                  <th className="table-cell">{t('usGainsTaxable')}</th>
                  <th className="table-cell">{t('usGainsEstimatedTax')}</th>
                </tr>
              </thead>
              <tbody>
                {yearlyUsGains.map((y) => {
                  const est = estimateUsCapitalGainsTax(y.realizedGainKrw);
                  const over = est.taxableGainKrw > 0;
                  return (
                    <tr key={y.year}>
                      <td className="table-cell font-medium">{y.year}</td>
                      <td className="table-cell">{y.sellCount}</td>
                      <td
                        className={`table-cell ${y.realizedGainUsd >= 0 ? 'text-green-600' : 'text-red-500'}`}
                      >
                        {y.realizedGainUsd >= 0 ? '+' : ''}
                        {Math.round(y.realizedGainUsd).toLocaleString()} USD
                      </td>
                      <td className="table-cell text-gray-500">
                        {Math.round(y.realizedGainKrw).toLocaleString()} KRW
                        {y.hasApproximatedKrw && <span title={t('usGainsApproximatedNote')}>*</span>}
                      </td>
                      <td className={`table-cell ${over ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                        {Math.round(est.taxableGainKrw).toLocaleString()} KRW
                      </td>
                      <td className={`table-cell ${over ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                        {Math.round(est.estimatedTaxKrw).toLocaleString()} KRW
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            {t('usGainsDeductionNote', { deduction: US_CAPITAL_GAINS_ANNUAL_DEDUCTION_KRW.toLocaleString() })}
          </p>
          {yearlyUsGains.some((y) => y.hasApproximatedKrw) && (
            <p className="mt-1 text-xs text-gray-400">{t('usGainsApproximatedNote')}</p>
          )}
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="table-cell">{t('date')}</th>
                <th className="table-cell">{th('ticker')}</th>
                <th className="table-cell">{th('name')}</th>
                <th className="table-cell">{th('category')}</th>
                <th className="table-cell">{t('type')}</th>
                <th className="table-cell">{th('avgPrice')}</th>
                <th className="table-cell">{th('quantity')}</th>
                <th className="table-cell">{t('totalAmount')}</th>
                <th className="table-cell" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((h) => {
                const type = h.lotType ?? 'buy';
                const ts = lotCreatedAt(h);
                return (
                  <tr key={h.id}>
                    <td className="table-cell text-gray-500 whitespace-nowrap">
                      {ts > 0 ? new Date(ts).toLocaleDateString() : '-'}
                    </td>
                    <td className="table-cell font-mono">{h.ticker}</td>
                    <td className="table-cell">{h.name}</td>
                    <td className="table-cell">{categoryName(h.categoryId)}</td>
                    <td className="table-cell">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          type === 'sell' ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-700'
                        }`}
                      >
                        {type === 'sell' ? th('sellLot') : th('buyLot')}
                      </span>
                    </td>
                    <td className="table-cell">
                      {h.avgPrice.toLocaleString()} {h.currency}
                    </td>
                    <td className="table-cell">{h.quantity.toLocaleString()}</td>
                    <td className="table-cell">
                      {Math.round(h.avgPrice * h.quantity).toLocaleString()} {h.currency}
                    </td>
                    <td className="table-cell">
                      <button
                        type="button"
                        className="text-sm text-red-500 hover:text-red-700"
                        onClick={() => removeHolding(h.id)}
                      >
                        {tc('delete')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
