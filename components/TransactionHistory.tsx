'use client';

import { useTranslations } from 'next-intl';
import { useCategories, useHoldings, removeHolding } from '@/lib/storage/hooks';
import { lotCreatedAt } from '@/lib/rebalance/lotTime';

export default function TransactionHistory() {
  const t = useTranslations('history');
  const th = useTranslations('holdings');
  const tc = useTranslations('common');
  const categories = useCategories();
  const holdings = useHoldings();

  function categoryName(id: string) {
    return categories.find((c) => c.id === id)?.name ?? '-';
  }

  const sorted = [...holdings].sort((a, b) => lotCreatedAt(b) - lotCreatedAt(a));

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-1">{t('title')}</h2>
      <p className="text-sm text-gray-500 mb-4">{t('description')}</p>

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
