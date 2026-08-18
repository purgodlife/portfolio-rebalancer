import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import TabNav from '@/components/TabNav';

export default async function AnalysisLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('nav');
  const items = [
    { href: '/analysis/risk', label: t('risk') },
    { href: '/analysis/tax-benefits', label: t('taxBenefits') },
    { href: '/analysis/guides', label: t('guides') },
  ];
  return (
    <div>
      <TabNav items={items} />
      {children}
    </div>
  );
}
