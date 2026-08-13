'use client';

import { useTranslations } from 'next-intl';
import { useSnapshots } from '@/lib/storage/hooks';
import { aggregateMonthly } from '@/lib/rebalance/snapshot';
import SimpleLineChart from './SimpleLineChart';

function formatManwon(v: number): string {
  return `${Math.round(v / 10000).toLocaleString()}${'만'}`;
}

export default function AssetTrend() {
  const t = useTranslations('trend');
  const snapshots = useSnapshots();
  const monthly = aggregateMonthly(snapshots);

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-1">{t('title')}</h2>
      <p className="text-sm text-gray-500 mb-4">{t('description')}</p>

      {monthly.length === 0 ? (
        <p className="text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <>
          <SimpleLineChart
            points={monthly.map((m) => ({ label: m.month.slice(5), value: m.totalValueBase }))}
            valueFormatter={formatManwon}
          />
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
