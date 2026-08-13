'use client';

import { useTranslations } from 'next-intl';
import { yahooFinanceUrl, investingSearchUrl } from '@/lib/format/externalLinks';
import type { Market } from '@/lib/rebalance/types';

export default function ExternalLinks({ ticker, name, market }: { ticker: string; name: string; market: Market }) {
  const t = useTranslations('common');
  return (
    <span className="inline-flex items-center gap-2 text-xs whitespace-nowrap">
      <a
        href={yahooFinanceUrl(ticker, market)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-600 hover:underline"
        title={t('viewOnYahoo')}
      >
        Yahoo
      </a>
      <a
        href={investingSearchUrl(name || ticker)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-600 hover:underline"
        title={t('viewOnInvesting')}
      >
        Investing.com
      </a>
    </span>
  );
}
