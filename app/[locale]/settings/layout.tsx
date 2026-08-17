import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import TabNav from '@/components/TabNav';

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('nav');
  const items = [
    { href: '/settings/backup', label: t('settingsBackupTab') },
    { href: '/settings/disclaimer', label: t('disclaimer') },
    { href: '/settings/privacy', label: t('privacy') },
    { href: '/settings/about', label: t('about') },
    { href: '/settings/contact', label: t('contact') },
  ];
  return (
    <div>
      <TabNav items={items} />
      {children}
    </div>
  );
}
