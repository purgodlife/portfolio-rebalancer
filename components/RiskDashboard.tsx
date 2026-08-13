'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCategories, useHoldings } from '@/lib/storage/hooks';
import { useUsdKrwRate, FALLBACK_USD_KRW_RATE } from '@/lib/market/fxRate';
import { groupHoldings, groupToHolding } from '@/lib/rebalance/grouping';
import { computeStructuralRisk, type StructuralRiskItem } from '@/lib/risk/structural';
import { evaluateGraham, type GrahamCheckKey } from '@/lib/risk/graham';
import { primaryLabel, secondaryLabel } from '@/lib/format/holdingLabel';
import { fetchFundamentals, type Fundamentals } from '@/lib/market/fundamentals';
import TickerLogo from './TickerLogo';

const CHECK_COLUMNS: GrahamCheckKey[] = [
  'currentRatio',
  'debtToEquity',
  'earningsStability',
  'dividendRecord',
  'per',
  'pbr',
];

export default function RiskDashboard() {
  const t = useTranslations('risk');
  const categories = useCategories();
  const holdings = useHoldings();
  const fx = useUsdKrwRate();
  const usdKrwRate = fx.rate ?? FALLBACK_USD_KRW_RATE;

  const groups = groupHoldings(holdings)
    .map(groupToHolding)
    .filter((h) => h.quantity > 0);
  const structural = computeStructuralRisk(categories, holdings, usdKrwRate);

  // undefined = 아직 시도 안 함, null = 시도했지만 실패, Fundamentals = 성공
  const [fundamentalsByKey, setFundamentalsByKey] = useState<Record<string, Fundamentals | null>>({});
  const [loadingByKey, setLoadingByKey] = useState<Record<string, boolean>>({});

  async function loadFundamentals(ticker: string, market: 'KR' | 'US', key: string) {
    setLoadingByKey((s) => ({ ...s, [key]: true }));
    const data = await fetchFundamentals(ticker, market);
    setFundamentalsByKey((s) => ({ ...s, [key]: data }));
    setLoadingByKey((s) => ({ ...s, [key]: false }));
  }

  useEffect(() => {
    for (const h of groups) {
      const key = `${h.market}:${h.ticker}`;
      if (!(key in fundamentalsByKey) && !loadingByKey[key]) {
        loadFundamentals(h.ticker, h.market, key);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings]);

  return (
    <div className="space-y-5">
      <div className="card">
        <h2 className="text-lg font-semibold mb-1">{t('structuralTitle')}</h2>
        <p className="text-sm text-gray-500 mb-4">{t('structuralDescription')}</p>

        {groups.length === 0 ? (
          <p className="text-sm text-gray-500">{t('noHoldings')}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <RiskStat label={t('topHolding')} value={`${structural.topHoldingWeightPercent.toFixed(1)}%`} warn={structural.topHoldingWeightPercent > 20} />
              <RiskStat label={t('top3')} value={`${structural.top3WeightPercent.toFixed(1)}%`} warn={structural.top3WeightPercent > 50} />
              <RiskStat label={t('holdingHHI')} value={structural.holdingHHI.toFixed(3)} warn={structural.holdingHHI > 0.25} />
              <RiskStat label={t('categoryHHI')} value={structural.categoryHHI.toFixed(3)} warn={structural.categoryHHI > 0.4} />
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <ExposureBar title={t('currencyExposure')} items={structural.byCurrency} />
              <ExposureBar title={t('marketExposure')} items={structural.byMarket} />
            </div>
            <p className="text-xs text-gray-400 mt-4">{t('hhiNote')}</p>
          </>
        )}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-1">{t('grahamTitle')}</h2>
        <p className="text-sm text-gray-500 mb-1">{t('grahamDescription')}</p>
        <p className="text-xs text-gray-400 mb-4">{t('grahamDataNote')}</p>

        {groups.length === 0 ? (
          <p className="text-sm text-gray-500">{t('noHoldings')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="table-cell">{t('colTicker')}</th>
                  <th className="table-cell" title={t('checkCurrentRatio')}>{t('colCurrentRatio')}</th>
                  <th className="table-cell" title={t('checkDebtToEquity')}>{t('colDebtToEquity')}</th>
                  <th className="table-cell" title={t('checkEarnings')}>{t('colEarnings')}</th>
                  <th className="table-cell" title={t('checkDividend')}>{t('colDividend')}</th>
                  <th className="table-cell" title={t('checkPer')}>{t('colPer')}</th>
                  <th className="table-cell" title={t('checkPbr')}>{t('colPbr')}</th>
                  <th className="table-cell">{t('colScore')}</th>
                  <th className="table-cell" />
                </tr>
              </thead>
              <tbody>
                {groups.map((h) => {
                  const key = `${h.market}:${h.ticker}`;
                  const fundamentals = fundamentalsByKey[key];
                  const result = evaluateGraham(fundamentals);
                  const attempted = key in fundamentalsByKey;
                  return (
                    <tr key={key}>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <TickerLogo ticker={h.ticker} size={20} />
                          <div>
                            <div className={h.market === 'KR' ? '' : 'font-mono'}>{primaryLabel(h)}</div>
                            <div className="font-mono text-xs text-gray-400">{secondaryLabel(h)}</div>
                          </div>
                        </div>
                      </td>
                      {CHECK_COLUMNS.map((ck) => {
                        const c = result.checks.find((chk) => chk.key === ck)!;
                        return (
                          <td
                            key={ck}
                            className={`table-cell ${
                              c.status === 'pass' ? 'text-green-600' : c.status === 'fail' ? 'text-red-500' : 'text-gray-400'
                            }`}
                          >
                            {c.value}
                          </td>
                        );
                      })}
                      <td className="table-cell font-medium">
                        {loadingByKey[key]
                          ? '...'
                          : !attempted
                            ? '-'
                            : fundamentals === null
                              ? <span className="text-gray-400">{t('fetchFailed')}</span>
                              : `${result.passCount}/${result.passCount + result.failCount}`}
                      </td>
                      <td className="table-cell">
                        <button
                          type="button"
                          title={t('refresh')}
                          className="shrink-0 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                          disabled={!!loadingByKey[key]}
                          onClick={() => loadFundamentals(h.ticker, h.market, key)}
                        >
                          ↻
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-3">
          {t('logoAttribution')}{' '}
          <a href="https://elbstream.com" target="_blank" rel="noopener noreferrer" className="underline">
            Elbstream
          </a>
        </p>
      </div>
    </div>
  );
}

function RiskStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${warn ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-semibold ${warn ? 'text-red-600' : 'text-gray-800'}`}>{value}</p>
    </div>
  );
}

function ExposureBar({ title, items }: { title: string; items: StructuralRiskItem[] }) {
  return (
    <div>
      <h3 className="text-sm font-medium mb-2">{title}</h3>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id}>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{it.label}</span>
              <span>{it.weightPercent.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full bg-brand-500" style={{ width: `${Math.min(100, it.weightPercent)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
