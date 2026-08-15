'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useCategories,
  useAllCategories,
  useUnifiedCategories,
  useHoldings,
  useAccounts,
  addCategory,
  updateCategory,
  removeCategory,
  replaceCategoriesFromAccount,
  addUnifiedCategory,
  updateUnifiedCategory,
  removeUnifiedCategory,
  getUnifiedCategoryRemovalImpact,
  setAccountAllocationMode,
  isUnifiedAllocationAccount,
  UNIFIED_ALLOCATION_ACCOUNT_ID,
} from '@/lib/storage/hooks';
import { useSelectedAccountId, DEFAULT_ACCOUNT_ID } from '@/lib/storage/accountContext';
import CurrentAccountBadge from './CurrentAccountBadge';
import InfoTooltip from './InfoTooltip';
import type { Category } from '@/lib/rebalance/types';

const TOLERANCE = 0.05;

export default function AllocationEditor() {
  const t = useTranslations('allocation');
  const tc = useTranslations('common');
  const categories = useCategories();
  const holdings = useHoldings();
  const allCategories = useAllCategories();
  const unifiedCategories = useUnifiedCategories();
  const accountId = useSelectedAccountId();
  const accounts = useAccounts();
  const currentAccount = accounts.find((a) => a.id === accountId);
  const isUnified = isUnifiedAllocationAccount(currentAccount);
  const otherAccounts = accounts.filter((a) => a.id !== accountId);
  const [newName, setNewName] = useState('');
  const [newPercent, setNewPercent] = useState('');
  const [copySourceId, setCopySourceId] = useState('');
  const [copying, setCopying] = useState(false);
  const [switchingMode, setSwitchingMode] = useState(false);
  const [showUnifiedEditor, setShowUnifiedEditor] = useState(false);

  // 복사를 실행하면 이 계좌의 기존 카테고리는 모두 지워지고 소스(다른 계좌 또는
  // 통합 자산배분)의 카테고리로 교체된다. 이름이 같은 카테고리는 보유종목이 새
  // 카테고리로 옮겨져 살아남지만, 소스에 없는 이름의 카테고리에 속한 보유종목은
  // 카테고리와 함께 삭제된다 — 실행 전에 몇 개가 위험한지 미리 계산해서
  // 확인창에 보여준다.
  const sourceCategoryNames = new Set(
    (copySourceId === UNIFIED_ALLOCATION_ACCOUNT_ID
      ? unifiedCategories
      : allCategories.filter((c) => (c.accountId ?? DEFAULT_ACCOUNT_ID) === copySourceId)
    ).map((c) => c.name.trim())
  );
  const atRiskCategoryIds = new Set(
    categories.filter((c) => !sourceCategoryNames.has(c.name.trim())).map((c) => c.id)
  );
  const holdingsAtRiskCount = holdings.filter((h) => atRiskCategoryIds.has(h.categoryId)).length;

  // 입력 중에는 로컬 상태만 바꾸고, blur 시점에만 저장한다.
  // (매 keystroke마다 IndexedDB에 쓰고 live query로 되돌아오는 구조면
  //  한글 조합 입력이 중간에 끊기는 문제가 있어 이렇게 분리했다.)
  const [nameEdit, setNameEdit] = useState<{ id: string; value: string } | null>(null);
  const [percentEdit, setPercentEdit] = useState<{ id: string; value: string } | null>(null);

  const total = categories.reduce((s, c) => s + c.targetPercent, 0);
  const isValid = categories.length > 0 && Math.abs(total - 100) < TOLERANCE;

  function nameValue(c: Category): string {
    return nameEdit && nameEdit.id === c.id ? nameEdit.value : c.name;
  }

  function percentValue(c: Category): string {
    return percentEdit && percentEdit.id === c.id ? percentEdit.value : String(c.targetPercent);
  }

  async function commitName(c: Category) {
    if (!nameEdit || nameEdit.id !== c.id) return;
    const value = nameEdit.value;
    setNameEdit(null);
    if (!value.trim() || value === c.name) return;
    await updateCategory({ ...c, name: value });
  }

  async function commitPercent(c: Category) {
    if (!percentEdit || percentEdit.id !== c.id) return;
    const raw = percentEdit.value;
    setPercentEdit(null);
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed) || parsed === c.targetPercent) return;
    await updateCategory({ ...c, targetPercent: parsed });
  }

  async function handleAdd() {
    const percent = parseFloat(newPercent);
    if (!newName.trim() || Number.isNaN(percent)) return;
    await addCategory(newName.trim(), percent, accountId);
    setNewName('');
    setNewPercent('');
  }

  async function handleCopy() {
    if (!copySourceId) return;
    const sourceName =
      copySourceId === UNIFIED_ALLOCATION_ACCOUNT_ID
        ? t('unifiedLabel')
        : accounts.find((a) => a.id === copySourceId)?.name ?? '';
    const confirmMessage =
      holdingsAtRiskCount > 0
        ? t('copyConfirmWithLoss', { source: sourceName, count: holdingsAtRiskCount })
        : t('copyConfirm', { source: sourceName });
    if (!window.confirm(confirmMessage)) return;
    setCopying(true);
    try {
      await replaceCategoriesFromAccount(copySourceId, accountId);
    } finally {
      setCopying(false);
    }
  }

  async function handleModeChange(useIndividual: boolean) {
    setSwitchingMode(true);
    try {
      await setAccountAllocationMode(accountId, useIndividual);
    } finally {
      setSwitchingMode(false);
    }
  }

  // ── 통합 자산배분(모든 계좌가 공유하는 목표표) 편집용 상태 ─────────────────
  const [unifiedNameEdit, setUnifiedNameEdit] = useState<{ id: string; value: string } | null>(null);
  const [unifiedPercentEdit, setUnifiedPercentEdit] = useState<{ id: string; value: string } | null>(null);
  const [newUnifiedName, setNewUnifiedName] = useState('');
  const [newUnifiedPercent, setNewUnifiedPercent] = useState('');
  const unifiedTotal = unifiedCategories.reduce((s, c) => s + c.targetPercent, 0);

  function unifiedNameValue(c: Category): string {
    return unifiedNameEdit && unifiedNameEdit.id === c.id ? unifiedNameEdit.value : c.name;
  }
  function unifiedPercentValue(c: Category): string {
    return unifiedPercentEdit && unifiedPercentEdit.id === c.id
      ? unifiedPercentEdit.value
      : String(c.targetPercent);
  }
  async function commitUnifiedName(c: Category) {
    if (!unifiedNameEdit || unifiedNameEdit.id !== c.id) return;
    const value = unifiedNameEdit.value;
    setUnifiedNameEdit(null);
    if (!value.trim() || value === c.name) return;
    await updateUnifiedCategory({ ...c, name: value });
  }
  async function commitUnifiedPercent(c: Category) {
    if (!unifiedPercentEdit || unifiedPercentEdit.id !== c.id) return;
    const raw = unifiedPercentEdit.value;
    setUnifiedPercentEdit(null);
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed) || parsed === c.targetPercent) return;
    await updateUnifiedCategory({ ...c, targetPercent: parsed });
  }
  async function handleAddUnified() {
    const percent = parseFloat(newUnifiedPercent);
    if (!newUnifiedName.trim() || Number.isNaN(percent)) return;
    await addUnifiedCategory(newUnifiedName.trim(), percent);
    setNewUnifiedName('');
    setNewUnifiedPercent('');
  }
  async function handleRemoveUnified(c: Category) {
    const impact = await getUnifiedCategoryRemovalImpact(c.id);
    const confirmMessage =
      impact.holdingsAtRiskCount > 0
        ? t('unifiedRemoveConfirmWithLoss', {
            name: c.name,
            accounts: impact.mirrorCategoryIds.length,
            count: impact.holdingsAtRiskCount,
          })
        : t('unifiedRemoveConfirm', { name: c.name });
    if (!window.confirm(confirmMessage)) return;
    await removeUnifiedCategory(c.id);
  }

  const unifiedEditorVisible = isUnified || showUnifiedEditor;

  return (
    <div>
      <CurrentAccountBadge />
      <div className="card">
        <h2 className="text-lg font-semibold mb-1">{t('title')}</h2>
        <p className="text-sm text-gray-500 mb-4">{t('description')}</p>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-700">{t('modeLabel')}</span>
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-sm">
            <button
              type="button"
              disabled={switchingMode}
              className={`rounded-md px-3 py-1.5 disabled:opacity-50 ${
                !isUnified ? 'bg-white font-medium text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
              onClick={() => handleModeChange(true)}
            >
              {t('modeIndividual')}
            </button>
            <button
              type="button"
              disabled={switchingMode}
              className={`rounded-md px-3 py-1.5 disabled:opacity-50 ${
                isUnified ? 'bg-white font-medium text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
              onClick={() => handleModeChange(false)}
            >
              {t('modeUnified')}
            </button>
          </div>
          <InfoTooltip text={t('modeHint')} />
        </div>

        {isUnified && <p className="mb-4 text-xs text-gray-500">{t('unifiedFollowNote')}</p>}

        {isUnified && (
          <div className="mb-5 space-y-2">
            {categories.map((c) => (
              <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_110px] gap-2 items-center">
                <div className="input min-w-0 bg-gray-100 text-gray-500">{c.name}</div>
                <div className="input bg-gray-100 text-gray-500">{c.targetPercent}%</div>
              </div>
            ))}
            {categories.length === 0 && <p className="text-sm text-gray-400">{t('unifiedEmptyNote')}</p>}
          </div>
        )}

        {!isUnified && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
              <span className="text-sm text-gray-600">{t('copyFromLabel')}</span>
              <select
                className="input w-auto"
                value={copySourceId}
                onChange={(e) => setCopySourceId(e.target.value)}
              >
                <option value="">{t('copyFromPlaceholder')}</option>
                <option value={UNIFIED_ALLOCATION_ACCOUNT_ID}>{t('unifiedLabel')}</option>
                {otherAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-secondary text-sm disabled:opacity-50"
                disabled={!copySourceId || copying}
                onClick={handleCopy}
              >
                {copying ? t('copying') : t('copyButton')}
              </button>
              <p className="w-full text-xs text-gray-400">{t('copyHint')}</p>
              {copySourceId && holdingsAtRiskCount > 0 && (
                <p className="w-full text-xs font-medium text-red-600">
                  {t('copyLossWarning', { count: holdingsAtRiskCount })}
                </p>
              )}
            </div>

            <div className="space-y-2 mb-4">
              {categories.map((c) => (
                <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_110px_auto] gap-2 items-center">
                  <input
                    className="input min-w-0"
                    value={nameValue(c)}
                    onChange={(e) => setNameEdit({ id: c.id, value: e.target.value })}
                    onBlur={() => commitName(c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                  />
                  <div className="relative">
                    <input
                      type="number"
                      className="input pr-7"
                      value={percentValue(c)}
                      onChange={(e) => setPercentEdit({ id: c.id, value: e.target.value })}
                      onBlur={() => commitPercent(c)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      %
                    </span>
                  </div>
                  <button
                    type="button"
                    className="text-sm text-red-500 hover:text-red-700 px-2 whitespace-nowrap"
                    onClick={() => removeCategory(c.id)}
                  >
                    {tc('delete')}
                  </button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_110px_auto] gap-2 items-center mb-4">
              <input
                className="input min-w-0"
                placeholder={t('categoryName')}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <input
                type="number"
                className="input"
                placeholder={t('targetPercent')}
                value={newPercent}
                onChange={(e) => setNewPercent(e.target.value)}
              />
              <button type="button" className="btn-secondary whitespace-nowrap" onClick={handleAdd}>
                {t('addCategory')}
              </button>
            </div>

            <div
              className={`rounded-md border px-3 py-2 text-sm font-medium ${
                isValid ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-300 bg-red-50 text-red-600'
              }`}
            >
              {t('totalLabel')}: {total.toFixed(1)}%
              {!isValid && <div className="mt-1 text-xs font-normal">{t('totalWarning')}</div>}
            </div>
          </>
        )}

        {!isUnified && (
          <button
            type="button"
            className="mt-4 text-sm text-brand-600 hover:underline"
            onClick={() => setShowUnifiedEditor((v) => !v)}
          >
            {showUnifiedEditor ? t('hideUnifiedEditor') : t('showUnifiedEditor')}
          </button>
        )}
      </div>

      {unifiedEditorVisible && (
        <div className="card mt-4 border-brand-200 bg-brand-50/30">
          <h3 className="text-base font-semibold mb-1">{t('unifiedEditorTitle')}</h3>
          <p className="text-sm text-gray-500 mb-4">{t('unifiedEditorDescription')}</p>

          <div className="space-y-2 mb-4">
            {unifiedCategories.map((c) => (
              <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_110px_auto] gap-2 items-center">
                <input
                  className="input min-w-0"
                  value={unifiedNameValue(c)}
                  onChange={(e) => setUnifiedNameEdit({ id: c.id, value: e.target.value })}
                  onBlur={() => commitUnifiedName(c)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                />
                <div className="relative">
                  <input
                    type="number"
                    className="input pr-7"
                    value={unifiedPercentValue(c)}
                    onChange={(e) => setUnifiedPercentEdit({ id: c.id, value: e.target.value })}
                    onBlur={() => commitUnifiedPercent(c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    %
                  </span>
                </div>
                <button
                  type="button"
                  className="text-sm text-red-500 hover:text-red-700 px-2 whitespace-nowrap"
                  onClick={() => handleRemoveUnified(c)}
                >
                  {tc('delete')}
                </button>
              </div>
            ))}
            {unifiedCategories.length === 0 && (
              <p className="text-sm text-gray-400">{t('unifiedEmptyNote')}</p>
            )}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_110px_auto] gap-2 items-center mb-4">
            <input
              className="input min-w-0"
              placeholder={t('categoryName')}
              value={newUnifiedName}
              onChange={(e) => setNewUnifiedName(e.target.value)}
            />
            <input
              type="number"
              className="input"
              placeholder={t('targetPercent')}
              value={newUnifiedPercent}
              onChange={(e) => setNewUnifiedPercent(e.target.value)}
            />
            <button type="button" className="btn-secondary whitespace-nowrap" onClick={handleAddUnified}>
              {t('addCategory')}
            </button>
          </div>

          <div
            className={`rounded-md border px-3 py-2 text-sm font-medium ${
              unifiedCategories.length > 0 && Math.abs(unifiedTotal - 100) < TOLERANCE
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-300 bg-red-50 text-red-600'
            }`}
          >
            {t('totalLabel')}: {unifiedTotal.toFixed(1)}%
            {!(unifiedCategories.length > 0 && Math.abs(unifiedTotal - 100) < TOLERANCE) && (
              <div className="mt-1 text-xs font-normal">{t('totalWarning')}</div>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-400">{t('unifiedEditorAppliesNote')}</p>
        </div>
      )}
    </div>
  );
}
