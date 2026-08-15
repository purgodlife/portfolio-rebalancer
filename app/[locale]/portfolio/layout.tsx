import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import TabNav from '@/components/TabNav';

export default async function PortfolioLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('nav');
  const items = [
    { href: '/portfolio/accounts', label: t('accounts') },
    { href: '/portfolio/allocation', label: t('allocation') },
    { href: '/portfolio/holdings', label: t('holdings') },
    { href: '/portfolio/watchlist', label: t('watchlist') },
  ];
  return (
    <div>
      <TabNav items={items} />
      {children}
    </div>
  );
}
