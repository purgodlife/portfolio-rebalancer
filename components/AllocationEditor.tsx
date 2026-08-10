'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCategories, addCategory, updateCategory, removeCategory } from '@/lib/storage/hooks';

export default function AllocationEditor() {
  const t = useTranslations('allocation');
  const tc = useTranslations('common');
  const categories = useCategories();
  const [newName, setNewName] = useState('');
  const [newPercent, setNewPercent] = useState('');

  const total = categories.reduce((s, c) => s + c.targetPercent, 0);
  const isValid = Math.abs(total - 100) < 0.01;

  async function handleAdd() {
    const percent = parseFloat(newPercent);
    if (!newName.trim() || Number.isNaN(percent)) return;
    await addCategory(newName.trim(), percent);
    setNewName('');
    setNewPercent('');
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-1">{t('title')}</h2>
      <p className="text-sm text-gray-500 mb-4">{t('description')}</p>

      <div className="space-y-2 mb-4">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center gap-2">
            <input
              className="input flex-1"
              value={c.name}
              onChange={(e) => updateCategory({ ...c, name: e.target.value })}
            />
            <input
              type="number"
              className="input w-28"
              value={c.targetPercent}
              onChange={(e) => updateCategory({ ...c, targetPercent: parseFloat(e.target.value) || 0 })}
            />
            <span className="text-sm text-gray-400">%</span>
            <button
              type="button"
              className="text-sm text-red-500 hover:text-red-700 px-2"
              onClick={() => removeCategory(c.id)}
            >
              {tc('delete')}
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <input
          className="input flex-1"
          placeholder={t('categoryName')}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          type="number"
          className="input w-28"
          placeholder={t('targetPercent')}
          value={newPercent}
          onChange={(e) => setNewPercent(e.target.value)}
        />
        <button type="button" className="btn-secondary" onClick={handleAdd}>
          {t('addCategory')}
        </button>
      </div>

      <div className={`text-sm font-medium ${isValid ? 'text-green-600' : 'text-amber-600'}`}>
        {t('totalLabel')}: {total.toFixed(1)}%{!isValid && ` — ${t('totalWarning')}`}
      </div>
    </div>
  );
}
