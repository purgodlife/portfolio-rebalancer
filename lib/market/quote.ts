'use client';

import type { Market } from '@/lib/rebalance/types';

export interface QuoteResult {
  price: number;
  currency: string;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        currency?: string;
      };
    }>;
    error?: unknown;
  };
}

async function fetchYahooChart(symbol: string): Promise<QuoteResult | null> {
  try {
    const res = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`);
    if (!res.ok) return null;
    const data: YahooChartResponse = await res.json();
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') return null;
    return { price: meta.regularMarketPrice, currency: meta.currency ?? 'USD' };
  } catch {
    return null;
  }
}

/**
 * 티커의 현재가를 조회하면서, 실제로 값을 반환한 Yahoo 심볼(예: "005930.KS")도
 * 함께 돌려준다. 한국 종목은 거래소 접미사(.KS 코스피 / .KQ 코스닥)를 모르는
 * 상태로 입력되므로, 코스피(.KS)로 먼저 시도하고 실패하면 코스닥(.KQ)으로
 * 재시도한다. 재무 데이터 조회(fetchFundamentals)에서 이 심볼을 재사용하면
 * 접미사를 또 추측할 필요가 없다. /api/quote는 순수 중계 프록시이며 portfolio
 * 데이터는 전달하지 않는다.
 */
export async function resolveYahooSymbol(
  ticker: string,
  market: Market
): Promise<{ symbol: string; quote: QuoteResult } | null> {
  const trimmed = ticker.trim();
  if (!trimmed) return null;

  if (market === 'US') {
    const symbol = trimmed.toUpperCase();
    const quote = await fetchYahooChart(symbol);
    return quote ? { symbol, quote } : null;
  }

  const kospiSymbol = `${trimmed}.KS`;
  const kospiQuote = await fetchYahooChart(kospiSymbol);
  if (kospiQuote) return { symbol: kospiSymbol, quote: kospiQuote };

  const kosdaqSymbol = `${trimmed}.KQ`;
  const kosdaqQuote = await fetchYahooChart(kosdaqSymbol);
  return kosdaqQuote ? { symbol: kosdaqSymbol, quote: kosdaqQuote } : null;
}

export async function fetchCurrentPrice(ticker: string, market: Market): Promise<QuoteResult | null> {
  const resolved = await resolveYahooSymbol(ticker, market);
  return resolved?.quote ?? null;
}
