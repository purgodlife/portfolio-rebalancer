'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAccounts, addAccount, updateAccount, removeAccount } from '@/lib/storage/hooks';
import { useSelectedAccountId, useSetSelectedAccountId } from '@/lib/storage/accountContext';
import type { Account, AccountType } from '@/lib/rebalance/types';
import { ACCOUNT_TYPE_GROUPS } from '@/lib/rebalance/accountTypeGroups';

/**
 * 계좌(포트폴리오) 관리 화면. 계좌마다 자산배분·보유종목·거래내역·자산추이가
 * 완전히 분리되어 있으므로, 계좌를 지우면 그 계좌의 카테고리/보유종목도
 * 함께 지워진다(연쇄 삭제). 최소 1개 계좌는 항상 남아있어야 한다.
 */
function AccountTypeOptions({ t }: { t: (key: string) => string }) {
  return (
    <>
      {ACCOUNT_TYPE_GROUPS.map((group) => (
        <optgroup key={group.labelKey} label={t(group.labelKey)}>
          {group.types.map((type) => (
            <option key={type} value={type}>
              {t(`type_${type}`)}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

export default function AccountsManager() {
  const t = useTranslations('accounts');
  const tc = useTranslations('common');
  const accounts = useAccounts();
  const selected = useSelectedAccountId();
  const setSelected = useSetSelectedAccountId();
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<AccountType>('general');
  const [nameEdit, setNameEdit] = useState<{ id: string; value: string } | null>(null);

  async function handleAdd() {
    if (!newName.trim()) return;
    const id = await addAccount(newName.trim(), newType);
    setNewName('');
    setNewType('general');
    setSelected(id);
  }

  async function handleDelete(a: Account) {
    if (accounts.length <= 1) return;
    if (!window.confirm(t('deleteWarning', { name: a.name }))) return;
    await removeAccount(a.id);
  }

  function nameValue(a: Account): string {
    return nameEdit && nameEdit.id === a.id ? nameEdit.value : a.name;
  }

  async function commitName(a: Account) {
    if (!nameEdit || nameEdit.id !== a.id) return;
    const value = nameEdit.value;
    setNameEdit(null);
    if (!value.trim() || value === a.name) return;
    await updateAccount({ ...a, name: value });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('description')}</p>
      </div>

      <div className="card space-y-2">
        {accounts.map((a) => (
          <div key={a.id} className="grid grid-cols-[minmax(0,1fr)_150px_auto_auto] gap-2 items-center">
            <input
              className="input min-w-0"
              value={nameValue(a)}
              onChange={(e) => setNameEdit({ id: a.id, value: e.target.value })}
              onBlur={() => commitName(a)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
            />
            <select
              className="input"
              value={a.type}
              onChange={(e) => updateAccount({ ...a, type: e.target.value as AccountType })}
            >
              <AccountTypeOptions t={t} />
            </select>
            <button
              type="button"
              className={`text-sm px-2 whitespace-nowrap ${
                selected === a.id ? 'text-brand-600 font-medium' : 'text-gray-400 hover:text-gray-700'
              }`}
              onClick={() => setSelected(a.id)}
            >
              {selected === a.id ? t('current') : t('switchTo')}
            </button>
            <button
              type="button"
              className="text-sm text-red-500 hover:text-red-700 px-2 whitespace-nowrap disabled:opacity-30 disabled:cursor-not-allowed"
              disabled={accounts.length <= 1}
              title={accounts.length <= 1 ? t('lastAccountHint') : undefined}
              onClick={() => handleDelete(a)}
            >
              {tc('delete')}
            </button>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="font-medium text-gray-900 mb-3">{t('addTitle')}</h2>
        <div className="grid grid-cols-[minmax(0,1fr)_150px_auto] gap-2 items-center">
          <input
            className="input min-w-0"
            placeholder={t('namePlaceholder')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <select className="input" value={newType} onChange={(e) => setNewType(e.target.value as AccountType)}>
            <AccountTypeOptions t={t} />
          </select>
          <button type="button" className="btn-secondary whitespace-nowrap" onClick={handleAdd}>
            {t('addButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
