'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useCategories,
  addCategoryBalanced,
  renameCategory,
  setCategoryPercent,
  removeCategoryBalanced,
} from '@/lib/storage/hooks';
import type { Category } from '@/lib/rebalance/types';

export default function AllocationEditor() {
  const t = useTranslations('allocation');
  const tc = useTranslations('common');
  const categories = useCategories();
  const [newName, setNewName] = useState('');
  const [newPercent, setNewPercent] = useState('');
  const [editingPercent, setEditingPercent] = useState<{ id: string; value: string } | null>(null);

  const total = categories.reduce((s, c) => s + c.targetPercent, 0);
  const isValid = Math.abs(total - 100) < 0.05;

  function percentDisplayValue(c: Category): string {
    if (editingPercent && editingPercent.id === c.id) return editingPercent.value;
    return String(c.targetPercent);
  }

  async function commitPercent(id: string) {
    if (!editingPercent || editingPercent.id !== id) return;
    const parsed = parseFloat(editingPercent.value);
    setEditingPercent(null);
    if (Number.isNaN(parsed)) return;
    await setCategoryPercent(id, parsed);
  }

  async function handleAdd() {
    const percent = parseFloat(newPercent);
    if (!newName.trim() || Number.isNaN(percent)) return;
    await addCategoryBalanced(newName.trim(), percent);
    setNewName('');
    setNewPercent('');
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-1">{t('title')}</h2>
      <p className="text-sm text-gray-500 mb-4">{t('description')}</p>

      <div className="space-y-2 mb-4">
        {categories.map((c) => (
          <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_110px_auto] gap-2 items-center">
            <input
              className="input min-w-0"
              value={c.name}
              onChange={(e) => renameCategory(c.id, e.target.value)}
            />
            <div className="relative">
              <input
                type="number"
                className="input pr-7"
                value={percentDisplayValue(c)}
                onChange={(e) => setEditingPercent({ id: c.id, value: e.target.value })}
                onBlur={() => commitPercent(c.id)}
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
              onClick={() => removeCategoryBalanced(c.id)}
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

      <div className={`text-sm font-medium ${isValid ? 'text-green-600' : 'text-amber-600'}`}>
        {t('totalLabel')}: {total.toFixed(1)}%
      </div>
      <p className="text-xs text-gray-400 mt-1">
        하나의 비중을 조정하면 나머지 카테고리들이 기존 비율대로 자동 조정되어 합계가 항상 100.0%로 유지됩니다.
      </p>
    </div>
  );
}
