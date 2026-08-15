'use client';

import { useTranslations } from 'next-intl';
import { useAccounts } from '@/lib/storage/hooks';
import { useSelectedAccountId } from '@/lib/storage/accountContext';

/**
 * "지금 보고 있는 게 어느 계좌인지" 헷갈리지 않도록, 계좌별로 분리되는
 * 화면(자산배분/보유종목/계산기/거래내역/추이/리스크) 상단에 붙이는 배지.
 */
export default function CurrentAccountBadge() {
  const t = useTranslations('accounts');
  const accounts = useAccounts();
  const selectedAccountId = useSelectedAccountId();
  const account = accounts.find((a) => a.id === selectedAccountId);

  if (!account) return null;

  return (
    <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs text-brand-700">
      <span className="text-gray-400">{t('currentAccountLabel')}</span>
      <span className="font-medium">{account.name}</span>
      <span className="text-gray-400">· {t(`type_${account.type}`)}</span>
    </div>
  );
}
