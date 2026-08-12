'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCategories, useHoldings, addHolding, updateHolding, removeHolding } from '@/lib/storage/hooks';
import StockAutocomplete from './StockAutocomplete';
import { fetchCurrentPrice } from '@/lib/market/quote';
import { useUsdKrwRate, FALLBACK_USD_KRW_RATE } from '@/lib/market/fxRate';
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
  purchaseFxRate: '',
};

const NEW_ROW_KEY = '__new__';

export default function HoldingsEditor() {
  const t = useTranslations('holdings');
  const tc = useTranslations('common');
  const categories = useCategories();
  const holdings = useHoldings();
  const [form, setForm] = useState(EMPTY_FORM);
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});
  const [refreshError, setRefreshError] = useState<Record<string, boolean>>({});
  const fx = useUsdKrwRate();
  const currentFxRate = fx.rate ?? FALLBACK_USD_KRW_RATE;

  function onMarketChange(market: Market) {
    setForm((f) => ({
      ...f,
      market,
      currency: market === 'KR' ? 'KRW' : 'USD',
      purchaseFxRate: market === 'US' ? (fx.rate ? String(fx.rate) : f.purchaseFxRate) : '',
    }));
  }

  function applySelectedStock(entry: StockEntry) {
    setForm((f) => ({ ...f, ticker: entry.ticker, name: entry.name }));
  }

  async function refreshExistingPrice(h: Holding) {
    setRefreshing((r) => ({ ...r, [h.id]: true }));
    setRefreshError((e) => ({ ...e, [h.id]: false }));
    const quote = await fetchCurrentPrice(h.ticker, h.market);
    setRefreshing((r) => ({ ...r, [h.id]: false }));
    if (!quote) {
      setRefreshError((e) => ({ ...e, [h.id]: true }));
      return;
    }
    await updateHolding({ ...h, currentPrice: quote.price });
  }

  async function refreshNewPrice() {
    if (!form.ticker.trim()) return;
    setRefreshing((r) => ({ ...r, [NEW_ROW_KEY]: true }));
    setRefreshError((e) => ({ ...e, [NEW_ROW_KEY]: false }));
    const quote = await fetchCurrentPrice(form.ticker, form.market);
    setRefreshing((r) => ({ ...r, [NEW_ROW_KEY]: false }));
    if (!quote) {
      setRefreshError((e) => ({ ...e, [NEW_ROW_KEY]: true }));
      return;
    }
    setForm((f) => ({ ...f, currentPrice: String(quote.price) }));
  }

  async function handleAdd() {
    const avgPrice = parseFloat(form.avgPrice);
    const quantity = parseFloat(form.quantity);
    const currentPrice = parseFloat(form.currentPrice || form.avgPrice);
    const purchaseFxRate = form.currency === 'USD' ? parseFloat(form.purchaseFxRate) : undefined;
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
      purchaseFxRate: purchaseFxRate !== undefined && !Number.isNaN(purchaseFxRate) ? purchaseFxRate : undefined,
    });
    setForm(EMPTY_FORM);
  }

  function categoryName(id: string) {
    return categories.find((c) => c.id === id)?.name ?? '-';
  }

  const usdHoldings = holdings.filter((h) => h.currency === 'USD');

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        <span className="text-xs text-gray-500">
          {t('currentFxLabel')}:{' '}
          {fx.loading
            ? t('fxLoading')
            : fx.rate
              ? `1 USD = ${fx.rate.toLocaleString(undefined, { maximumFractionDigits: 2 })} KRW`
              : `${t('fxError')} (${FALLBACK_USD_KRW_RATE.toLocaleString()})`}
          <button type="button" className="ml-2 text-brand-600 hover:underline" onClick={fx.refresh}>
            ↻
          </button>
        </span>
      </div>
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
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      className="input w-24"
                      value={h.currentPrice}
                      onChange={(e) =>
                        updateHolding({ ...h, currentPrice: parseFloat(e.target.value) || 0 } as Holding)
                      }
                    />
                    <button
                      type="button"
                      title={t('refreshPrice')}
                      className="shrink-0 rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      disabled={!!refreshing[h.id]}
                      onClick={() => refreshExistingPrice(h)}
                    >
                      {refreshing[h.id] ? '...' : '↻'}
                    </button>
                  </div>
                  {refreshError[h.id] && (
                    <p className="mt-1 text-xs text-red-500">조회 실패 (티커 확인)</p>
                  )}
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
          placeholder={`${t('avgPrice')} (${form.currency})`}
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
        <div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              className="input"
              placeholder={`${t('currentPrice')} (${form.currency})`}
              value={form.currentPrice}
              onChange={(e) => setForm((f) => ({ ...f, currentPrice: e.target.value }))}
            />
            <button
              type="button"
              title={t('refreshPrice')}
              className="shrink-0 rounded-md border border-gray-300 px-2 py-2 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              disabled={!form.ticker.trim() || !!refreshing[NEW_ROW_KEY]}
              onClick={refreshNewPrice}
            >
              {refreshing[NEW_ROW_KEY] ? '...' : '↻'}
            </button>
          </div>
          {refreshError[NEW_ROW_KEY] && (
            <p className="mt-1 text-xs text-red-500">조회 실패 (티커 확인)</p>
          )}
        </div>
        {form.currency === 'USD' && (
          <input
            type="number"
            className="input"
            placeholder={t('purchaseFxRate')}
            value={form.purchaseFxRate}
            onChange={(e) => setForm((f) => ({ ...f, purchaseFxRate: e.target.value }))}
          />
        )}
        <button type="button" className="btn-secondary" onClick={handleAdd}>
          {t('addHolding')}
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-2">
        티커나 종목명 중 하나만 입력해도(한글 초성 검색 가능) 목록에서 골라 자동완성할 수 있습니다. 목록에 없는
        종목은 직접 입력하면 됩니다. ↻ 버튼을 누르면 Yahoo Finance에서 현재가를 조회해 채워줍니다(목록에 없는
        티커도 조회는 됩니다). 미국 종목은 매수가/현재가를 달러로 그대로 입력하시면 됩니다.
      </p>

      {usdHoldings.length > 0 && (
        <div className="mt-5 border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold mb-1">{t('fxSummaryTitle')}</h3>
          <p className="text-xs text-gray-500 mb-3">{t('fxSummaryDescription')}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="table-cell">{t('ticker')}</th>
                  <th className="table-cell">{t('colPurchaseFx')}</th>
                  <th className="table-cell">{t('colCostKrw')}</th>
                  <th className="table-cell">{t('colValueKrw')}</th>
                  <th className="table-cell">{t('colPriceGain')}</th>
                  <th className="table-cell">{t('colFxGain')}</th>
                  <th className="table-cell">{t('colTotalGain')}</th>
                </tr>
              </thead>
              <tbody>
                {usdHoldings.map((h) => {
                  const purchaseFx = h.purchaseFxRate ?? currentFxRate;
                  const costKrw = h.avgPrice * h.quantity * purchaseFx;
                  const valueKrw = h.currentPrice * h.quantity * currentFxRate;
                  const priceGainKrw = (h.currentPrice - h.avgPrice) * h.quantity * currentFxRate;
                  const fxGainKrw = h.avgPrice * h.quantity * (currentFxRate - purchaseFx);
                  const totalGainKrw = valueKrw - costKrw;
                  return (
                    <tr key={h.id}>
                      <td className="table-cell font-mono">
                        {h.ticker} <span className="text-gray-400">({h.name})</span>
                      </td>
                      <td className="table-cell">{purchaseFx.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td className="table-cell">{Math.round(costKrw).toLocaleString()}</td>
                      <td className="table-cell">{Math.round(valueKrw).toLocaleString()}</td>
                      <td className={`table-cell ${priceGainKrw >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {priceGainKrw >= 0 ? '+' : ''}
                        {Math.round(priceGainKrw).toLocaleString()}
                      </td>
                      <td className={`table-cell ${fxGainKrw >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {fxGainKrw >= 0 ? '+' : ''}
                        {Math.round(fxGainKrw).toLocaleString()}
                      </td>
                      <td className={`table-cell font-medium ${totalGainKrw >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {totalGainKrw >= 0 ? '+' : ''}
                        {Math.round(totalGainKrw).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            매입 시 환율을 입력하지 않은 종목은 현재 환율을 매입환율로 대신 사용해 환차익을 0으로 계산합니다.
          </p>
        </div>
      )}
    </div>
  );
}
