'use client';

/**
 * 자산추이 화면에서 "내 포트폴리오 vs 지수" 성과를 비교하기 위한 지수
 * 월별 종가 시계열 조회. /api/quote(순수 중계 프록시)를 통해 Yahoo Finance
 * 차트 API에서 지수 심볼의 월간 캔들을 가져온다. 포트폴리오 데이터는 전혀
 * 관여하지 않는다.
 */

export const BENCHMARK_SYMBOLS = {
  kospi: '^KS11',
  sp500: '^GSPC',
  nasdaq: '^IXIC',
} as const;

export type BenchmarkKey = keyof typeof BENCHMARK_SYMBOLS;

export interface BenchmarkSeriesPoint {
  /** YYYY-MM */
  month: string;
  close: number;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: (number | null)[] }> };
    }>;
    error?: unknown;
  };
}

/**
 * 지수의 월별 종가 시계열을 가져온다. 매월 마지막 거래일 종가를 그 달의
 * 대표값으로 쓴다(포트폴리오 월별 스냅샷과 동일한 방식으로 비교 가능하게).
 * 실패하면 null을 반환하고, 화면에서는 벤치마크 없이 내 포트폴리오만 보여준다.
 */
export async function fetchBenchmarkMonthlySeries(
  key: BenchmarkKey,
  range: '1y' | '2y' | '5y' | '10y' | 'max' = '5y'
): Promise<BenchmarkSeriesPoint[] | null> {
  try {
    const symbol = BENCHMARK_SYMBOLS[key];
    const res = await fetch(
      `/api/quote?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=1mo`
    );
    if (!res.ok) return null;
    const data: YahooChartResponse = await res.json();
    const result = data.chart?.result?.[0];
    const timestamps = result?.timestamp;
    const closes = result?.indicators?.quote?.[0]?.close;
    if (!timestamps || !closes || timestamps.length === 0) return null;

    const points: BenchmarkSeriesPoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (close == null) continue;
      const d = new Date(timestamps[i] * 1000);
      const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      points.push({ month, close });
    }
    return points.length > 0 ? points : null;
  } catch {
    return null;
  }
}
