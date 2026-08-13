'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { fetchQuoteBySymbol, type QuoteResult } from '@/lib/market/quote';
import { fetchFearGreed, type FearGreedResult } from '@/lib/market/fearGreed';
import { useUsdKrwRate } from '@/lib/market/fxRate';

const REFRESH_MS = 120_000;

const RATING_KEY: Record<string, string> = {
  'extreme fear': 'extremeFear',
  fear: 'fear',
  neutral: 'neutral',
  greed: 'greed',
  'extreme greed': 'extremeGreed',
};

interface Entry {
  key: string;
  label: string;
  text: string;
  changePercent?: number | null;
}

/**
 * 화면 상단에서 우→좌로 계속 흐르는 시세 정보 배너. 개인 포트폴리오 데이터는
 * 전혀 쓰지 않고 공개 시장 정보(지수/환율/공포탐욕지수)만 보여준다.
 */
export default function MarketTicker() {
  const t = useTranslations('ticker');
  const fx = useUsdKrwRate();
  const [indices, setIndices] = useState<Record<string, QuoteResult | null>>({});
  const [fearGreed, setFearGreed] = useState<FearGreedResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [kospi, sp500, nasdaq, fg] = await Promise.all([
        fetchQuoteBySymbol('^KS11'),
        fetchQuoteBySymbol('^GSPC'),
        fetchQuoteBySymbol('^IXIC'),
        fetchFearGreed(),
      ]);
      if (cancelled) return;
      setIndices({ kospi, sp500, nasdaq });
      setFearGreed(fg);
    }

    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const entries: Entry[] = [];

  if (indices.kospi) {
    entries.push({ key: 'kospi', label: t('kospi'), text: indices.kospi.price.toLocaleString(undefined, { maximumFractionDigits: 2 }), changePercent: indices.kospi.changePercent });
  }
  if (indices.sp500) {
    entries.push({ key: 'sp500', label: t('sp500'), text: indices.sp500.price.toLocaleString(undefined, { maximumFractionDigits: 2 }), changePercent: indices.sp500.changePercent });
  }
  if (indices.nasdaq) {
    entries.push({ key: 'nasdaq', label: t('nasdaq'), text: indices.nasdaq.price.toLocaleString(undefined, { maximumFractionDigits: 2 }), changePercent: indices.nasdaq.changePercent });
  }
  if (fx.rate) {
    entries.push({ key: 'usdkrw', label: t('usdKrw'), text: fx.rate.toLocaleString(undefined, { maximumFractionDigits: 2 }) });
  }
  if (fearGreed) {
    const ratingKey = RATING_KEY[fearGreed.rating.toLowerCase()];
    entries.push({
      key: 'feargreed',
      label: t('fearGreed'),
      text: `${fearGreed.score} (${ratingKey ? t(ratingKey) : fearGreed.rating})`,
    });
  }

  if (entries.length === 0) return null;

  const looped = [...entries, ...entries];

  return (
    <div className="overflow-hidden border-b border-gray-100 bg-gray-50">
      <div className="ticker-track flex w-max gap-8 whitespace-nowrap px-4 py-1.5 text-xs">
        {looped.map((e, i) => (
          <span key={`${e.key}-${i}`} className="flex items-center gap-1.5 text-gray-600">
            <span className="font-medium text-gray-800">{e.label}</span>
            <span>{e.text}</span>
            {typeof e.changePercent === 'number' && (
              // 국내 관행: 상승(빨강) / 하락(파랑)
              <span className={e.changePercent >= 0 ? 'text-red-500' : 'text-blue-500'}>
                {e.changePercent >= 0 ? '▲' : '▼'} {Math.abs(e.changePercent).toFixed(2)}%
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
