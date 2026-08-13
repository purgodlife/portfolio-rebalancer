'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useWatchlist, addWatchlistItem, removeWatchlistItem } from '@/lib/storage/hooks';
import StockAutocomplete from './StockAutocomplete';
import ExternalLinks from './ExternalLinks';
import TickerLogo from './TickerLogo';
import { fetchCurrentPrice, type QuoteResult } from '@/lib/market/quote';
import { primaryLabel, secondaryLabel } from '@/lib/format/holdingLabel';
import type { StockEntry } from '@/lib/search/stockData';
import type { Market } from '@/lib/rebalance/types';
import type { WatchlistItem } from '@/lib/storage/db';

const EMPTY_FORM = { ticker: '', name: '', market: 'KR' as Market };

type QuoteState = { loading: boolean; error: boolean; quote: QuoteResult | null };

/**
 * 관심종목: 매수가/수량 없이 티커만 등록해서 현재가·등락률만 확인하는 목록.
 * 리밸런싱 계산에는 전혀 관여하지 않는다.
 */
export default function Watchlist() {
  const t = useTranslations('watchlist');
  const tc = useTranslations('common');
  const items = useWatchlist();
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Record<string, QuoteState>>({});

  function key(item: Pick<WatchlistItem, 'ticker' | 'market'>): string {
    return `${item.market}:${item.ticker}`;
  }

  async function refreshQuote(item: Pick<WatchlistItem, 'ticker' | 'market'>) {
    const k = key(item);
    setQuotes((q) => ({ ...q, [k]: { loading: true, error: false, quote: q[k]?.quote ?? null } }));
    const quote = await fetchCurrentPrice(item.ticker, item.market);
    setQuotes((q) => ({ ...q, [k]: { loading: false, error: !quote, quote } }));
  }

  function refreshAll(list: WatchlistItem[]) {
    list.forEach((item) => refreshQuote(item));
  }

  function applySelectedStock(entry: StockEntry) {
    setForm((f) => ({ ...f, ticker: entry.ticker, name: entry.name }));
  }

  async function onAdd() {
    setFormError(null);
    const ticker = form.ticker.trim();
    if (!ticker) {
      setFormError(t('tickerRequired'));
      return;
    }
    const duplicate = items.some((i) => i.market === form.market && i.ticker.toUpperCase() === ticker.toUpperCase());
    if (duplicate) {
      setFormError(t('duplicate'));
      return;
    }
    await addWatchlistItem({ ticker, name: form.name.trim() || ticker, market: form.market });
    setForm(EMPTY_FORM);
    refreshQuote({ ticker, market: form.market });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('description')}</p>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('market')}</label>
            <select
              className="input"
              value={form.market}
              onChange={(e) => setForm((f) => ({ ...f, market: e.target.value as Market, ticker: '', name: '' }))}
            >
              <option value="KR">{t('marketKR')}</option>
              <option value="US">{t('marketUS')}</option>
            </select>
          </div>
          <div className="min-w-[220px] flex-1">
            <label className="block text-xs text-gray-500 mb-1">{t('ticker')}</label>
            <StockAutocomplete
              market={form.market}
              value={form.ticker}
              placeholder={t('tickerPlaceholder')}
              className="input"
              onChange={(v) => setForm((f) => ({ ...f, ticker: v }))}
              onSelect={applySelectedStock}
            />
          </div>
          <div className="min-w-[180px] flex-1">
            <label className="block text-xs text-gray-500 mb-1">{t('name')}</label>
            <input
              className="input"
              value={form.name}
              placeholder={t('namePlaceholder')}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <button type="button" className="btn-primary" onClick={onAdd}>
            {t('addItem')}
          </button>
        </div>
        {formError && <p className="text-sm text-red-600">{formError}</p>}
      </div>

      <div className="card overflow-x-auto">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium text-gray-900">{t('listTitle')}</h2>
          {items.length > 0 && (
            <button type="button" className="text-sm text-brand-600 hover:underline" onClick={() => refreshAll(items)}>
              {t('refreshAll')}
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">{t('empty')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-cell text-left">{t('colName')}</th>
                <th className="table-cell text-right">{t('colPrice')}</th>
                <th className="table-cell text-right">{t('colChange')}</th>
                <th className="table-cell text-left">{t('colLinks')}</th>
                <th className="table-cell text-right">{tc('delete')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const k = key(item);
                const state = quotes[k];
                const changePercent = state?.quote?.changePercent ?? null;
                const changeColorClass =
                  changePercent == null
                    ? 'text-gray-400'
                    : changePercent > 0
                      ? 'text-red-500'
                      : changePercent < 0
                        ? 'text-blue-500'
                        : 'text-gray-500';
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <TickerLogo ticker={item.ticker} size={18} />
                        <div>
                          <div className="font-medium text-gray-900">{primaryLabel(item)}</div>
                          <div className="text-xs text-gray-400">{secondaryLabel(item)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell text-right">
                      {state?.loading ? (
                        '...'
                      ) : state?.quote ? (
                        `${state.quote.price.toLocaleString()} ${state.quote.currency}`
                      ) : state?.error ? (
                        <span className="text-red-500">{t('quoteError')}</span>
                      ) : (
                        <button type="button" className="text-brand-600 hover:underline" onClick={() => refreshQuote(item)}>
                          {t('loadQuote')}
                        </button>
                      )}
                    </td>
                    <td className={`table-cell text-right ${changeColorClass}`}>
                      {changePercent == null ? '—' : `${changePercent > 0 ? '▲' : changePercent < 0 ? '▼' : ''} ${Math.abs(changePercent).toFixed(2)}%`}
                    </td>
                    <td className="table-cell">
                      <ExternalLinks ticker={item.ticker} name={item.name} market={item.market} />
                    </td>
                    <td className="table-cell text-right">
                      <button
                        type="button"
                        className="text-gray-400 hover:text-red-600"
                        onClick={() => removeWatchlistItem(item.id)}
                        title={tc('delete')}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
