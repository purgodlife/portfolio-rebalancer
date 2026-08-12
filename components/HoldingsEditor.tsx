'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCategories, useHoldings, addHolding, updateHolding, removeHolding } from '@/lib/storage/hooks';
import StockAutocomplete from './StockAutocomplete';
import type { StockEntry } from '@/lib/search/stockData';
import type { Currency, Holding, Market } from '@/lib/rebalance/types';

const EMPTY_FORM = {
  ticker: '',
  name: '',
  categoryId: '',
  market: 'KR' as Market,
  currency: 'KRW' as Currency,
  avgPrice: '',
  quantity: '',
  currentPrice: '',
};

export default function HoldingsEditor() {
  const t = useTranslations('holdings');
  const tc = useTranslations('common');
  const categories = useCategories();
  const holdings = useHoldings();
  const [form, setForm] = useState(EMPTY_FORM);

  function onMarketChange(market: Market) {
    setForm((f) => ({ ...f, market, currency: market === 'KR' ? 'KRW' : 'USD' }));
  }

  function applySelectedStock(entry: StockEntry) {
    setForm((f) => ({ ...f, ticker: entry.ticker, name: entry.name }));
  }

  async function handleAdd() {
    const avgPrice = parseFloat(form.avgPrice);
    const quantity = parseFloat(form.quantity);
    const currentPrice = parseFloat(form.currentPrice || form.avgPrice);
    if (!form.ticker || !form.categoryId || Number.isNaN(avgPrice) || Number.isNaN(quantity)) return;
    await addHolding({
      ticker: form.ticker.trim(),
      name: form.name.trim() || form.ticker.trim(),
      categoryId: form.categoryId,
      market: form.market,
      currency: form.currency,
      avgPrice,
      quantity,
      currentPrice: Number.isNaN(currentPrice) ? avgPrice : currentPrice,
    });
    setForm(EMPTY_FORM);
  }

  function categoryName(id: string) {
    return categories.find((c) => c.id === id)?.name ?? '-';
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-1">{t('title')}</h2>
      <p className="text-sm text-gray-500 mb-4">{t('description')}</p>

      <div className="overflow-x-auto mb-5">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="table-cell">{t('ticker')}</th>
              <th className="table-cell">{t('name')}</th>
              <th className="table-cell">{t('category')}</th>
              <th className="table-cell">{t('currency')}</th>
              <th className="table-cell">{t('avgPrice')}</th>
              <th className="table-cell">{t('quantity')}</th>
              <th className="table-cell">{t('currentPrice')}</th>
              <th className="table-cell" />
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => (
              <tr key={h.id}>
                <td className="table-cell font-mono">{h.ticker}</td>
                <td className="table-cell">{h.name}</td>
                <td className="table-cell">{categoryName(h.categoryId)}</td>
                <td className="table-cell">{h.currency}</td>
                <td className="table-cell">{h.avgPrice.toLocaleString()}</td>
                <td className="table-cell">{h.quantity.toLocaleString()}</td>
                <td className="table-cell">
                  <input
                    type="number"
                    className="input w-28"
                    value={h.currentPrice}
                    onChange={(e) =>
                      updateHolding({ ...h, currentPrice: parseFloat(e.target.value) || 0 } as Holding)
                    }
                  />
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
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2 items-start">
        <select
          className="input"
          value={form.market}
          onChange={(e) => onMarketChange(e.target.value as Market)}
        >
          <option value="KR">{t('marketKR')}</option>
          <option value="US">{t('marketUS')}</option>
        </select>
        <select
          className="input"
          value={form.categoryId}
          onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
        >
          <option value="">{t('category')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <StockAutocomplete
          market={form.market}
          value={form.ticker}
          placeholder={t('ticker')}
          onChange={(v) => setForm((f) => ({ ...f, ticker: v }))}
          onSelect={applySelectedStock}
        />
        <StockAutocomplete
          market={form.market}
          value={form.name}
          placeholder={t('name')}
          onChange={(v) => setForm((f) => ({ ...f, name: v }))}
          onSelect={applySelectedStock}
        />
        <input
          type="number"
          className="input"
          placeholder={t('avgPrice')}
          value={form.avgPrice}
          onChange={(e) => setForm((f) => ({ ...f, avgPrice: e.target.value }))}
        />
        <input
          type="number"
          className="input"
          placeholder={t('quantity')}
          value={form.quantity}
          onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
        />
        <input
          type="number"
          className="input"
          placeholder={t('currentPrice')}
          value={form.currentPrice}
          onChange={(e) => setForm((f) => ({ ...f, currentPrice: e.target.value }))}
        />
        <button type="button" className="btn-secondary" onClick={handleAdd}>
          {t('addHolding')}
        </button>
      </div>
      <p className="text-xs text-gray-400">
        티커나 종목명 중 하나만 입력해도(한글 초성 검색 가능) 목록에서 골라 자동완성할 수 있습니다. 목록에 없는 종목은 직접 입력하면 됩니다.
      </p>
    </div>
  );
}
