'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAccounts } from '@/lib/storage/hooks';
import { useSelectedAccountId, useSetSelectedAccountId } from '@/lib/storage/accountContext';

/**
 * 상단 네비게이션에서 계좌를 빠르게 전환하는 드롭다운. 카테고리/보유종목/
 * 계산기/거래내역/추이/리스크 화면이 모두 여기서 고른 계좌 기준으로 필터링된다.
 */
export default function AccountSwitcher() {
  const t = useTranslations('accounts');
  const accounts = useAccounts();
  const selected = useSelectedAccountId();
  const setSelected = useSetSelectedAccountId();

  // 선택된 계좌가 삭제되어 더 이상 존재하지 않으면 첫 번째 계좌로 되돌린다.
  useEffect(() => {
    if (accounts.length === 0) return;
    if (!accounts.some((a) => a.id === selected)) {
      setSelected(accounts[0].id);
    }
  }, [accounts, selected, setSelected]);

  if (accounts.length === 0) return null;

  return (
    <select
      className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white max-w-[140px]"
      value={selected}
      onChange={(e) => setSelected(e.target.value)}
      aria-label={t('switcherLabel')}
    >
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  );
}
