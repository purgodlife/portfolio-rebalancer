'use client';

import { Fragment, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useCategories,
  useAllCategories,
  useAccounts,
  useHoldings,
  addHolding,
  updateHolding,
  removeHolding,
  moveHoldingsToCategory,
} from '@/lib/storage/hooks';
import { DEFAULT_ACCOUNT_ID } from '@/lib/storage/accountContext';
import StockAutocomplete from './StockAutocomplete';
import { fetchCurrentPrice } from '@/lib/market/quote';
import { useUsdKrwRate, FALLBACK_USD_KRW_RATE } from '@/lib/market/fxRate';
import { groupHoldings, type HoldingGroup } from '@/lib/rebalance/grouping';
import TickerLogo from './TickerLogo';
import CurrentAccountBadge from './CurrentAccountBadge';
import type { StockEntry } from '@/lib/search/stockData';
import type { Currency, LotType, Market } from '@/lib/rebalance/types';
import { matchesAnyQuery } from '@/lib/search/textFilter';

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

const EMPTY_LOT_FORM = {
  avgPrice: '',
  quantity: '',
  purchaseFxRate: '',
};

const NEW_ROW_KEY = '__new__';

export default function HoldingsEditor() {
  const t = useTranslations('holdings');
  const tc = useTranslations('common');
  const categories = useCategories();
  const allCategories = useAllCategories();
  const accounts = useAccounts();
  const holdings = useHoldings();
  const [form, setForm] = useState(EMPTY_FORM);
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});
  const [refreshError, setRefreshError] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [lotForm, setLotForm] = useState<{ groupKey: string; type: LotType } | null>(null);
  const [lotFormValues, setLotFormValues] = useState(EMPTY_LOT_FORM);
  const [lotFormError, setLotFormError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [bulkRefreshing, setBulkRefreshing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const fx = useUsdKrwRate();
  const currentFxRate = fx.rate ?? FALLBACK_USD_KRW_RATE;

  const groups = groupHoldings(holdings);
  const filteredGroups = groups.filter((g) => matchesAnyQuery([g.ticker, g.name], searchQuery));

  function onMarketChange(market: Market) {
    setForm((f) => ({
      ...f,
      market,
      currency: market === 'KR' ? 'KRW' : 'USD',
      // 매입 시 환율은 "매입 시점"의 환율이라 현재 환율과 다를 수 있으므로
      // 자동으로 채우지 않고, 다른 입력칸처럼 회색 placeholder로만 안내한다.
      purchaseFxRate: '',
    }));
  }

  function applySelectedStock(entry: StockEntry) {
    setForm((f) => ({ ...f, ticker: entry.ticker, name: entry.name }));
  }

  function toggleExpand(key: string) {
    setExpanded((e) => ({ ...e, [key]: !e[key] }));
  }

  function openLotForm(group: HoldingGroup, type: LotType) {
    setExpanded((e) => ({ ...e, [group.key]: true }));
    setLotFormError(null);
    // 매입 시 환율은 자동으로 채우지 않고 다른 입력칸처럼 회색 placeholder로만 안내한다
    // (매입 시점 환율은 현재 환율과 다를 수 있어서, 값을 미리 채워두면 그대로 잘못 저장되기 쉽다).
    setLotFormValues(EMPTY_LOT_FORM);
    setLotForm({ groupKey: group.key, type });
  }

  function closeLotForm() {
    setLotForm(null);
    setLotFormError(null);
    setLotFormValues(EMPTY_LOT_FORM);
  }

  async function submitLotForm(group: HoldingGroup) {
    if (!lotForm) return;
    const avgPrice = parseFloat(lotFormValues.avgPrice);
    const quantity = parseFloat(lotFormValues.quantity);
    if (Number.isNaN(avgPrice) || Number.isNaN(quantity) || quantity <= 0) return;
    if (lotForm.type === 'sell' && quantity > group.netQuantity) {
      setLotFormError(`${t('sellExceedsHolding')} (${group.netQuantity.toLocaleString()})`);
      return;
    }
    const purchaseFxRate = group.currency === 'USD' ? parseFloat(lotFormValues.purchaseFxRate) : undefined;
    await addHolding({
      ticker: group.ticker,
      name: group.name,
      categoryId: group.categoryId,
      market: group.market,
      currency: group.currency,
      avgPrice,
      quantity,
      currentPrice: group.currentPrice,
      purchaseFxRate: purchaseFxRate !== undefined && !Number.isNaN(purchaseFxRate) ? purchaseFxRate : undefined,
      lotType: lotForm.type,
    });
    closeLotForm();
  }

  async function refreshGroupPrice(group: HoldingGroup) {
    const key = `group:${group.key}`;
    setRefreshing((r) => ({ ...r, [key]: true }));
    setRefreshError((e) => ({ ...e, [key]: false }));
    const quote = await fetchCurrentPrice(group.ticker, group.market);
    setRefreshing((r) => ({ ...r, [key]: false }));
    if (!quote) {
      setRefreshError((e) => ({ ...e, [key]: true }));
      return;
    }
    await Promise.all(group.lots.map((lot) => updateHolding({ ...lot, currentPrice: quote.price })));
  }

  async function refreshAllPrices() {
    const targets = groups.filter((g) => g.netQuantity !== 0);
    if (targets.length === 0) return;
    setBulkRefreshing(true);
    setBulkProgress({ done: 0, total: targets.length });
    for (let i = 0; i < targets.length; i++) {
      await refreshGroupPrice(targets[i]);
      setBulkProgress({ done: i + 1, total: targets.length });
    }
    setBulkRefreshing(false);
    setBulkProgress(null);
  }

  async function setGroupCurrentPrice(group: HoldingGroup, value: string) {
    const price = parseFloat(value);
    if (Number.isNaN(price)) return;
    await Promise.all(group.lots.map((lot) => updateHolding({ ...lot, currentPrice: price })));
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
      lotType: 'buy',
    });
    setForm(EMPTY_FORM);
  }

  function categoryName(id: string) {
    return categories.find((c) => c.id === id)?.name ?? '-';
  }

  function accountName(accountId: string | undefined): string {
    const resolved = accountId ?? DEFAULT_ACCOUNT_ID;
    return accounts.find((a) => a.id === resolved)?.name ?? '-';
  }

  // "계좌명 · 카테고리명" 형태로 모든 계좌의 카테고리를 한 목록에 펼쳐서, 이 값을
  // 고르는 것만으로 보유종목을 다른 계좌로도 옮길 수 있게 한다.
  const categoryMoveOptions = allCategories
    .map((c) => ({ id: c.id, label: `${accountName(c.accountId)} · ${c.name}` }))
    .sort((a, b) => a.label.localeCompare(b.label));

  async function moveGroupToCategory(group: HoldingGroup, categoryId: string) {
    if (!categoryId || categoryId === group.categoryId) return;
    await moveHoldingsToCategory(
      group.lots.map((l) => l.id),
      categoryId
    );
  }

  const usdGroups = groups.filter((g) => g.currency === 'USD' && g.netQuantity > 0);

  return (
    <div className="card">
      <CurrentAccountBadge />
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
      <p className="text-sm text-gray-500 mb-1">{t('description')}</p>
      <p className="text-xs text-gray-400 mb-3">{t('groupedHint')}</p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          className="input max-w-xs"
          placeholder={t('searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {groups.length > 0 && (
          <button
            type="button"
            className="shrink-0 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            disabled={bulkRefreshing}
            onClick={refreshAllPrices}
          >
            {bulkRefreshing
              ? `${t('refreshAllPrices')} (${bulkProgress?.done ?? 0}/${bulkProgress?.total ?? 0})`
              : t('refreshAllPrices')}
          </button>
        )}
      </div>

      <div className="overflow-x-auto mb-5">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="table-cell" />
              <th className="table-cell">{t('ticker')}</th>
              <th className="table-cell">{t('name')}</th>
              <th className="table-cell">{t('category')}</th>
              <th className="table-cell">{t('currency')}</th>
              <th className="table-cell">{t('avgBuyPrice')}</th>
              <th className="table-cell">{t('netQuantity')}</th>
              <th className="table-cell">{t('currentPrice')}</th>
              <th className="table-cell">{t('evalAmount')}</th>
              <th className="table-cell">{t('gain')}</th>
              <th className="table-cell" />
            </tr>
          </thead>
          <tbody>
            {groups.length > 0 && filteredGroups.length === 0 && (
              <tr>
                <td className="table-cell text-sm text-gray-400" colSpan={11}>
                  {t('noSearchResults')}
                </td>
              </tr>
            )}
            {filteredGroups.map((g) => {
              const evalAmount = g.currentPrice * g.netQuantity;
              const gain = (g.currentPrice - g.avgBuyPrice) * g.netQuantity;
              const isOpen = !!expanded[g.key];
              const refreshKey = `group:${g.key}`;
              return (
                <Fragment key={g.key}>
                  <tr className="cursor-pointer hover:bg-gray-50" onClick={() => toggleExpand(g.key)}>
                    <td className="table-cell text-gray-400 select-none">{isOpen ? '▾' : '▸'}</td>
                    <td className="table-cell font-mono">
                      <div className="flex items-center gap-2">
                        <TickerLogo ticker={g.ticker} size={18} />
                        {g.ticker}
                      </div>
                    </td>
                    <td className="table-cell">{g.name}</td>
                    <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                      <select
                        className="min-w-[160px] rounded-md border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                        value={g.categoryId}
                        title={t('moveToAccountCategory')}
                        onChange={(e) => moveGroupToCategory(g, e.target.value)}
                      >
                        {!categoryMoveOptions.some((opt) => opt.id === g.categoryId) && (
                          <option value={g.categoryId} disabled>
                            {categoryName(g.categoryId)}
                          </option>
                        )}
                        {categoryMoveOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="table-cell">{g.currency}</td>
                    <td className="table-cell">
                      {g.avgBuyPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="table-cell">{g.netQuantity.toLocaleString()}</td>
                    <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          className="input w-24"
                          value={g.currentPrice}
                          onChange={(e) => setGroupCurrentPrice(g, e.target.value)}
                        />
                        <button
                          type="button"
                          title={t('refreshPrice')}
                          className="shrink-0 rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                          disabled={!!refreshing[refreshKey]}
                          onClick={() => refreshGroupPrice(g)}
                        >
                          {refreshing[refreshKey] ? '...' : '↻'}
                        </button>
                      </div>
                      {refreshError[refreshKey] && (
                        <p className="mt-1 text-xs text-red-500">조회 실패 (티커 확인)</p>
                      )}
                    </td>
                    <td className="table-cell">{Math.round(evalAmount).toLocaleString()}</td>
                    <td className={`table-cell font-medium ${gain >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {gain >= 0 ? '+' : ''}
                      {Math.round(gain).toLocaleString()}
                    </td>
                    <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2 text-xs whitespace-nowrap">
                        <button type="button" className="text-brand-600 hover:underline" onClick={() => openLotForm(g, 'buy')}>
                          {t('addBuyLot')}
                        </button>
                        <button type="button" className="text-red-500 hover:underline" onClick={() => openLotForm(g, 'sell')}>
                          {t('addSellLot')}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td className="table-cell bg-gray-50 align-top" colSpan={11}>
                        <div className="pl-6 py-1 space-y-1">
                          {g.lots.length === 0 && <p className="text-xs text-gray-400">{t('noLotsYet')}</p>}
                          {g.lots.map((lot) => {
                            const type = lot.lotType ?? 'buy';
                            return (
                              <div
                                key={lot.id}
                                className="flex flex-wrap items-center gap-3 text-xs py-1.5 border-b border-gray-100 last:border-0"
                              >
                                <span
                                  className={`shrink-0 rounded px-1.5 py-0.5 font-medium ${
                                    type === 'sell' ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-700'
                                  }`}
                                >
                                  {type === 'sell' ? t('sellLot') : t('buyLot')}
                                </span>
                                <span className="text-gray-600">
                                  {t('lotPrice')} {lot.avgPrice.toLocaleString()} {lot.currency}
                                </span>
                                <span className="text-gray-600">
                                  {t('quantity')} {lot.quantity.toLocaleString()}
                                </span>
                                {lot.currency === 'USD' && lot.purchaseFxRate !== undefined && (
                                  <span className="text-gray-400">
                                    {t('purchaseFxRate')} {lot.purchaseFxRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  className="ml-auto shrink-0 text-red-400 hover:text-red-600"
                                  onClick={() => {
                                    if (window.confirm(t('deleteLotConfirm'))) removeHolding(lot.id);
                                  }}
                                >
                                  {tc('delete')}
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {lotForm?.groupKey === g.key && (
                          <div className="mt-2 ml-6 flex flex-wrap items-end gap-2 rounded-md border border-gray-200 bg-white p-3">
                            <span
                              className={`text-xs font-medium px-1.5 py-1 rounded ${
                                lotForm.type === 'sell' ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-700'
                              }`}
                            >
                              {lotForm.type === 'sell' ? t('sellLot') : t('buyLot')}
                            </span>
                            <input
                              type="number"
                              className="input w-32"
                              placeholder={`${t('lotPrice')} (${g.currency})`}
                              value={lotFormValues.avgPrice}
                              onChange={(e) => setLotFormValues((v) => ({ ...v, avgPrice: e.target.value }))}
                            />
                            <input
                              type="number"
                              className="input w-24"
                              placeholder={t('quantity')}
                              value={lotFormValues.quantity}
                              onChange={(e) => setLotFormValues((v) => ({ ...v, quantity: e.target.value }))}
                            />
                            {g.currency === 'USD' && (
                              <input
                                type="number"
                                className="input w-32"
                                placeholder={t('purchaseFxRate')}
                                value={lotFormValues.purchaseFxRate}
                                onChange={(e) => setLotFormValues((v) => ({ ...v, purchaseFxRate: e.target.value }))}
                              />
                            )}
                            <button type="button" className="btn-secondary text-xs" onClick={() => submitLotForm(g)}>
                              {t('confirm')}
                            </button>
                            <button type="button" className="text-xs text-gray-500 hover:underline" onClick={closeLotForm}>
                              {t('cancel')}
                            </button>
                            {lotFormError && <p className="w-full text-xs text-red-500">{lotFormError}</p>}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
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
        티커도 조회는 됩니다). 미국 종목은 매수가/현재가를 달러로 그대로 입력하시면 됩니다. 이미 있는 종목을 또
        추가하면 별도 행이 아니라 위 표에서 자동으로 합산됩니다. 종목 로고는{' '}
        <a href="https://elbstream.com" target="_blank" rel="noopener noreferrer" className="underline">
          Elbstream
        </a>
        에서 제공하며, 못 찾은 종목은 이니셜 아이콘으로 대신 표시됩니다.
      </p>

      {usdGroups.length > 0 && (
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
                {usdGroups.map((g) => {
                  const purchaseFx = g.avgPurchaseFxRate ?? currentFxRate;
                  const costKrw = g.avgBuyPrice * g.netQuantity * purchaseFx;
                  const valueKrw = g.currentPrice * g.netQuantity * currentFxRate;
                  const priceGainKrw = (g.currentPrice - g.avgBuyPrice) * g.netQuantity * currentFxRate;
                  const fxGainKrw = g.avgBuyPrice * g.netQuantity * (currentFxRate - purchaseFx);
                  const totalGainKrw = valueKrw - costKrw;
                  return (
                    <tr key={g.key}>
                      <td className="table-cell font-mono">
                        {g.ticker} <span className="text-gray-400">({g.name})</span>
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
