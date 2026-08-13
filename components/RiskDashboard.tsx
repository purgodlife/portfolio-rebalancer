'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCategories, useHoldings } from '@/lib/storage/hooks';
import { useUsdKrwRate, FALLBACK_USD_KRW_RATE } from '@/lib/market/fxRate';
import { groupHoldings, groupToHolding } from '@/lib/rebalance/grouping';
import { computeStructuralRisk, type StructuralRiskItem } from '@/lib/risk/structural';
import { evaluateGraham, type GrahamCheckKey } from '@/lib/risk/graham';
import { evaluateGrahamEnterprising, type GrahamEnterprisingCheckKey } from '@/lib/risk/grahamEnterprising';
import { evaluateEtfRisk, type EtfCheckKey } from '@/lib/risk/etf';
import { fetchFundamentals, type Fundamentals } from '@/lib/market/fundamentals';
import { primaryLabel, secondaryLabel } from '@/lib/format/holdingLabel';
import TickerLogo from './TickerLogo';
import InfoTooltip from './InfoTooltip';
import type { Holding } from '@/lib/rebalance/types';

const GRAHAM_COLUMNS: GrahamCheckKey[] = [
  'marketCap',
  'currentRatio',
  'debtToEquity',
  'earningsStability',
  'earningsGrowth',
  'dividendRecord',
  'per',
  'pbr',
  'perPbrCombo',
];

const GRAHAM_ENTERPRISING_COLUMNS: GrahamEnterprisingCheckKey[] = [
  'currentRatio',
  'debtToEquity',
  'earningsStability',
  'currentDividend',
  'earningsGrowth',
  'priceToTangibleAssets',
];

const ETF_COLUMNS: EtfCheckKey[] = ['leverage', 'expenseRatio', 'concentration'];

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

  const etfGroups = groups.filter((h) => fundamentalsByKey[`${h.market}:${h.ticker}`]?.quoteType === 'ETF');
  const stockGroups = groups.filter((h) => fundamentalsByKey[`${h.market}:${h.ticker}`]?.quoteType !== 'ETF');

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

        {stockGroups.length === 0 ? (
          <p className="text-sm text-gray-500">{t('noHoldings')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="table-cell">{t('colTicker')}</th>
                  {GRAHAM_COLUMNS.map((ck) => (
                    <th key={ck} className="table-cell whitespace-nowrap">
                      {t(`col_${ck}`)} <InfoTooltip text={t(`check_${ck}`)} source={t('sourceGraham')} />
                    </th>
                  ))}
                  <th className="table-cell">{t('colScore')}</th>
                  <th className="table-cell" />
                </tr>
              </thead>
              <tbody>
                {stockGroups.map((h) => {
                  const key = `${h.market}:${h.ticker}`;
                  const fundamentals = fundamentalsByKey[key];
                  const result = evaluateGraham(fundamentals);
                  const attempted = key in fundamentalsByKey;
                  return (
                    <tr key={key}>
                      <td className="table-cell">
                        <HoldingCell h={h} />
                      </td>
                      {GRAHAM_COLUMNS.map((ck) => {
                        const c = result.checks.find((chk) => chk.key === ck)!;
                        return <CheckCell key={ck} status={c.status} value={c.value} />;
                      })}
                      <ScoreCell loading={!!loadingByKey[key]} attempted={attempted} failed={fundamentals === null} result={result} fetchFailedLabel={t('fetchFailed')} />
                      <RefreshCell loading={!!loadingByKey[key]} onClick={() => loadFundamentals(h.ticker, h.market, key)} label={t('refresh')} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <LogoAttribution text={t('logoAttribution')} />
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-1">{t('enterprisingTitle')}</h2>
        <p className="text-sm text-gray-500 mb-1">{t('enterprisingDescription')}</p>
        <p className="text-xs text-gray-400 mb-4">{t('grahamDataNote')}</p>

        {stockGroups.length === 0 ? (
          <p className="text-sm text-gray-500">{t('noHoldings')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="table-cell">{t('colTicker')}</th>
                  {GRAHAM_ENTERPRISING_COLUMNS.map((ck) => (
                    <th key={ck} className="table-cell whitespace-nowrap">
                      {t(`ecol_${ck}`)} <InfoTooltip text={t(`echeck_${ck}`)} source={t('sourceGrahamEnterprising')} />
                    </th>
                  ))}
                  <th className="table-cell">{t('colScore')}</th>
                  <th className="table-cell" />
                </tr>
              </thead>
              <tbody>
                {stockGroups.map((h) => {
                  const key = `${h.market}:${h.ticker}`;
                  const fundamentals = fundamentalsByKey[key];
                  const result = evaluateGrahamEnterprising(fundamentals);
                  const attempted = key in fundamentalsByKey;
                  return (
                    <tr key={key}>
                      <td className="table-cell">
                        <HoldingCell h={h} />
                      </td>
                      {GRAHAM_ENTERPRISING_COLUMNS.map((ck) => {
                        const c = result.checks.find((chk) => chk.key === ck)!;
                        return <CheckCell key={ck} status={c.status} value={c.value} />;
                      })}
                      <ScoreCell loading={!!loadingByKey[key]} attempted={attempted} failed={fundamentals === null} result={result} fetchFailedLabel={t('fetchFailed')} />
                      <RefreshCell loading={!!loadingByKey[key]} onClick={() => loadFundamentals(h.ticker, h.market, key)} label={t('refresh')} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <LogoAttribution text={t('logoAttribution')} />
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-1">{t('etfTitle')}</h2>
        <p className="text-sm text-gray-500 mb-1">{t('etfDescription')}</p>
        <p className="text-xs text-gray-400 mb-4">{t('etfDataNote')}</p>

        {etfGroups.length === 0 ? (
          <p className="text-sm text-gray-500">{t('noEtfHoldings')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="table-cell">{t('colTicker')}</th>
                  {ETF_COLUMNS.map((ck) => (
                    <th key={ck} className="table-cell whitespace-nowrap">
                      {t(`col_${ck}`)} <InfoTooltip text={t(`check_${ck}`)} source={t('sourceEtf')} />
                    </th>
                  ))}
                  <th className="table-cell">{t('colScore')}</th>
                  <th className="table-cell" />
                </tr>
              </thead>
              <tbody>
                {etfGroups.map((h) => {
                  const key = `${h.market}:${h.ticker}`;
                  const fundamentals = fundamentalsByKey[key];
                  const result = evaluateEtfRisk(h.name, h.ticker, fundamentals);
                  const attempted = key in fundamentalsByKey;
                  return (
                    <tr key={key}>
                      <td className="table-cell">
                        <HoldingCell h={h} />
                      </td>
                      {ETF_COLUMNS.map((ck) => {
                        const c = result.checks.find((chk) => chk.key === ck)!;
                        return <CheckCell key={ck} status={c.status} value={c.value} />;
                      })}
                      <ScoreCell loading={!!loadingByKey[key]} attempted={attempted} failed={fundamentals === null} result={result} fetchFailedLabel={t('fetchFailed')} />
                      <RefreshCell loading={!!loadingByKey[key]} onClick={() => loadFundamentals(h.ticker, h.market, key)} label={t('refresh')} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <LogoAttribution text={t('logoAttribution')} />
      </div>
    </div>
  );
}

function HoldingCell({ h }: { h: Holding }) {
  return (
    <div className="flex items-center gap-2">
      <TickerLogo ticker={h.ticker} size={20} />
      <div>
        <div className={h.market === 'KR' ? '' : 'font-mono'}>{primaryLabel(h)}</div>
        <div className="font-mono text-xs text-gray-400">{secondaryLabel(h)}</div>
      </div>
    </div>
  );
}

function CheckCell({ status, value }: { status: 'pass' | 'fail' | 'unknown'; value: string }) {
  return (
    <td className={`table-cell ${status === 'pass' ? 'text-green-600' : status === 'fail' ? 'text-red-500' : 'text-gray-400'}`}>
      {value}
    </td>
  );
}

function ScoreCell({
  loading,
  attempted,
  failed,
  result,
  fetchFailedLabel,
}: {
  loading: boolean;
  attempted: boolean;
  failed: boolean;
  result: { passCount: number; failCount: number };
  fetchFailedLabel: string;
}) {
  return (
    <td className="table-cell font-medium">
      {loading ? '...' : !attempted ? '-' : failed ? <span className="text-gray-400">{fetchFailedLabel}</span> : `${result.passCount}/${result.passCount + result.failCount}`}
    </td>
  );
}

function RefreshCell({ loading, onClick, label }: { loading: boolean; onClick: () => void; label: string }) {
  return (
    <td className="table-cell">
      <button
        type="button"
        title={label}
        className="shrink-0 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-50"
        disabled={loading}
        onClick={onClick}
      >
        ↻
      </button>
    </td>
  );
}

function LogoAttribution({ text }: { text: string }) {
  return (
    <p className="text-xs text-gray-400 mt-3">
      {text}{' '}
      <a href="https://elbstream.com" target="_blank" rel="noopener noreferrer" className="underline">
        Elbstream
      </a>
    </p>
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
