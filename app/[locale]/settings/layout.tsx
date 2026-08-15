import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import TabNav from '@/components/TabNav';

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('nav');
  const items = [
    { href: '/settings/backup', label: t('settingsBackupTab') },
    { href: '/settings/disclaimer', label: t('disclaimer') },
  ];
  return (
    <div>
      <TabNav items={items} />
      {children}
    </div>
  );
}
