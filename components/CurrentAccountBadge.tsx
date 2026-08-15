'use client';

import { useTranslations } from 'next-intl';
import { useAccounts } from '@/lib/storage/hooks';
import { useSelectedAccountId, useSetSelectedAccountId } from '@/lib/storage/accountContext';

/**
 * "지금 보고 있는 게 어느 계좌인지" 헷갈리지 않도록, 계좌별로 분리되는
 * 화면(자산배분/보유종목/계산기/거래내역/추이/리스크) 상단에 붙이는 배지.
 * 상단 네비게이션의 AccountSwitcher와 별개로, 이 화면 안에서 바로 다른
 * 계좌로 전환할 수 있도록 드롭다운으로 되어 있다.
 */
export default function CurrentAccountBadge() {
  const t = useTranslations('accounts');
  const accounts = useAccounts();
  const selectedAccountId = useSelectedAccountId();
  const setSelectedAccountId = useSetSelectedAccountId();

  if (accounts.length === 0) return null;

  return (
    <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 pl-3 pr-1 py-1 text-xs text-brand-700">
      <span className="text-gray-400">{t('currentAccountLabel')}</span>
      <select
        className="cursor-pointer rounded-full border-none bg-transparent py-0.5 pr-5 text-xs font-medium text-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-300"
        value={selectedAccountId}
        onChange={(e) => setSelectedAccountId(e.target.value)}
        aria-label={t('switcherLabel')}
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} · {t(`type_${a.type}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
