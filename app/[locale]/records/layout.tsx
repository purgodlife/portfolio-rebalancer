import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import TabNav from '@/components/TabNav';

export default async function RecordsLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('nav');
  const items = [
    { href: '/records/history', label: t('history') },
    { href: '/records/trend', label: t('trend') },
  ];
  return (
    <div>
      <TabNav items={items} />
      {children}
    </div>
  );
}
