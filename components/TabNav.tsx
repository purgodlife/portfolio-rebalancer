'use client';

import { Link, usePathname } from '@/i18n/navigation';

export interface TabItem {
  href: string;
  label: string;
}

/**
 * 그룹 페이지(포트폴리오/기록/분석/설정) 안에서 세부 항목을 전환하는 상단 탭.
 * 탭마다 고유 URL을 가지므로 새로고침해도 어느 탭을 보고 있었는지 유지된다.
 */
export default function TabNav({ items }: { items: TabItem[] }) {
  const pathname = usePathname();

  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-gray-200">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm ${
              active
                ? 'border-brand-600 font-medium text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
