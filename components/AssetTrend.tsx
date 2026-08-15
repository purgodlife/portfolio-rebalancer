'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSnapshots, useAllSnapshots } from '@/lib/storage/hooks';
import { aggregateMonthly, aggregateMonthlyAcrossAccounts } from '@/lib/rebalance/snapshot';
import { buildIndexedComparison } from '@/lib/rebalance/benchmarkCompare';
import { fetchBenchmarkMonthlySeries, type BenchmarkKey } from '@/lib/market/benchmark';
import SimpleLineChart from './SimpleLineChart';
import DualLineChart from './DualLineChart';
import CurrentAccountBadge from './CurrentAccountBadge';

function formatManwon(v: number): string {
  return `${Math.round(v / 10000).toLocaleString()}${'만'}`;
}

const BENCHMARK_OPTIONS: BenchmarkKey[] = ['kospi', 'sp500', 'nasdaq'];
const TREND_SCOPE_STORAGE_KEY = 'portfolio-rebalancer:trendScope';

type TrendScope = 'account' | 'all';

export default function AssetTrend() {
  const t = useTranslations('trend');
  const snapshots = useSnapshots();
  const allSnapshots = useAllSnapshots();

  const [scope, setScope] = useState<TrendScope>('account');
  useEffect(() => {
    const stored = window.localStorage.getItem(TREND_SCOPE_STORAGE_KEY);
    if (stored === 'all' || stored === 'account') setScope(stored);
  }, []);
  function changeScope(value: TrendScope) {
    setScope(value);
    window.localStorage.setItem(TREND_SCOPE_STORAGE_KEY, value);
  }

  const monthly = scope === 'all' ? aggregateMonthlyAcrossAccounts(allSnapshots) : aggregateMonthly(snapshots);

  const [benchmark, setBenchmark] = useState<BenchmarkKey | 'none'>('none');
  const [benchmarkSeries, setBenchmarkSeries] = useState<Awaited<ReturnType<typeof fetchBenchmarkMonthlySeries>>>(null);
  const [loadingBenchmark, setLoadingBenchmark] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState(false);

  useEffect(() => {
    if (benchmark === 'none') {
      setBenchmarkSeries(null);
      setBenchmarkError(false);
      return;
    }
    let cancelled = false;
    setLoadingBenchmark(true);
    setBenchmarkError(false);
    fetchBenchmarkMonthlySeries(benchmark).then((series) => {
      if (cancelled) return;
      setLoadingBenchmark(false);
      if (!series) {
        setBenchmarkError(true);
        setBenchmarkSeries(null);
      } else {
        setBenchmarkSeries(series);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [benchmark]);

  const comparison = benchmark !== 'none' ? buildIndexedComparison(monthly, benchmarkSeries) : null;

  return (
    <div className="card">
      {scope === 'account' && <CurrentAccountBadge />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold mb-1">{t('title')}</h2>
          <p className="text-sm text-gray-500">{t('description')}</p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-sm">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 ${
              scope === 'account' ? 'bg-white font-medium text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
            onClick={() => changeScope('account')}
          >
            {t('scopePerAccount')}
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 ${
              scope === 'all' ? 'bg-white font-medium text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
            onClick={() => changeScope('all')}
          >
            {t('scopeAllAccounts')}
          </button>
        </div>
      </div>
      {scope === 'all' && <p className="mb-4 -mt-2 text-xs text-gray-500">{t('scopeAllAccountsHint')}</p>}

      {monthly.length === 0 ? (
        <p className="text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2">
            <label className="text-xs text-gray-500">{t('benchmarkLabel')}</label>
            <select
              className="input w-auto"
              value={benchmark}
              onChange={(e) => setBenchmark(e.target.value as BenchmarkKey | 'none')}
            >
              <option value="none">{t('benchmarkNone')}</option>
              {BENCHMARK_OPTIONS.map((key) => (
                <option key={key} value={key}>
                  {t(`benchmark_${key}`)}
                </option>
              ))}
            </select>
            {loadingBenchmark && <span className="text-xs text-gray-400">{t('benchmarkLoading')}</span>}
            {benchmarkError && <span className="text-xs text-red-500">{t('benchmarkError')}</span>}
          </div>

          {benchmark !== 'none' && comparison && comparison.length > 0 ? (
            <>
              <DualLineChart
                points={comparison.map((c) => ({ label: c.month.slice(5), a: c.portfolioIndex, b: c.benchmarkIndex }))}
                aLabel={t('myPortfolio')}
                bLabel={t(`benchmark_${benchmark}`)}
                valueFormatter={(v) => v.toFixed(1)}
              />
              <p className="text-xs text-gray-400 mt-2">{t('indexedNote')}</p>
            </>
          ) : (
            <SimpleLineChart
              points={monthly.map((m) => ({ label: m.month.slice(5), value: m.totalValueBase }))}
              valueFormatter={formatManwon}
            />
          )}
          {monthly.length === 1 && <p className="text-xs text-gray-400 mt-2">{t('onlyOneNote')}</p>}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="table-cell">{t('month')}</th>
                  <th className="table-cell">{t('totalValue')}</th>
                </tr>
              </thead>
              <tbody>
                {[...monthly].reverse().map((m) => (
                  <tr key={m.month}>
                    <td className="table-cell">{m.month}</td>
                    <td className="table-cell">{Math.round(m.totalValueBase).toLocaleString()} KRW</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
