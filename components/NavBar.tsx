'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import LanguageSwitcher from './LanguageSwitcher';

export default function NavBar() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  const items: { href: string; label: string }[] = [
    { href: '/', label: t('dashboard') },
    { href: '/allocation', label: t('allocation') },
    { href: '/holdings', label: t('holdings') },
    { href: '/disclaimer', label: t('disclaimer') },
  ];

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6 overflow-x-auto">
          <span className="font-semibold text-brand-700 whitespace-nowrap">
            Portfolio Rebalancer
          </span>
          <nav className="flex gap-4 text-sm">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  pathname === item.href
                    ? 'text-brand-700 font-medium whitespace-nowrap'
                    : 'text-gray-500 hover:text-gray-800 whitespace-nowrap'
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
