'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import LanguageSwitcher from './LanguageSwitcher';
import MarketTicker from './MarketTicker';
import AccountSwitcher from './AccountSwitcher';

export default function NavBar() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  // href: 그룹을 클릭했을 때 이동할 기본 탭. matchPrefix: 그 그룹 안 어떤 탭에
  // 있든(예: /portfolio/holdings, /portfolio/watchlist) 상단 메뉴가 계속 활성화
  // 표시되도록 pathname이 이 접두사로 시작하면 활성으로 취급한다.
  const items: { href: string; label: string; matchPrefix: string }[] = [
    { href: '/', label: t('dashboard'), matchPrefix: '/' },
    { href: '/portfolio/calculator', label: t('portfolio'), matchPrefix: '/portfolio' },
    { href: '/records/history', label: t('records'), matchPrefix: '/records' },
    { href: '/analysis/risk', label: t('analysis'), matchPrefix: '/analysis' },
    { href: '/settings/backup', label: t('settings'), matchPrefix: '/settings' },
  ];

  return (
    <header className="border-b border-gray-200 bg-white">
      <MarketTicker />
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-6 overflow-x-auto">
          <span className="font-semibold text-brand-700 whitespace-nowrap">
            Portfolio Rebalancer
          </span>
          <nav className="flex gap-4 text-sm">
            {items.map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.matchPrefix);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    active
                      ? 'text-brand-700 font-medium whitespace-nowrap'
                      : 'text-gray-500 hover:text-gray-800 whitespace-nowrap'
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <AccountSwitcher />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
