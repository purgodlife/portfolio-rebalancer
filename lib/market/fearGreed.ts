'use client';

export interface FearGreedResult {
  /** 0~100 */
  score: number;
  /** 'extreme fear' | 'fear' | 'neutral' | 'greed' | 'extreme greed' 등 CNN 원문 그대로 */
  rating: string;
}

interface FearGreedGraphData {
  fear_and_greed?: { score?: number; rating?: string };
  fear_and_greed_historical?: { data?: Array<{ x?: number; y?: number; rating?: string }> };
}

/** CNN Fear & Greed Index 현재 값을 가져온다. /api/fear-greed는 순수 중계 프록시다. */
export async function fetchFearGreed(): Promise<FearGreedResult | null> {
  try {
    const res = await fetch('/api/fear-greed');
    if (!res.ok) return null;
    const data: FearGreedGraphData = await res.json();

    const current = data.fear_and_greed;
    if (typeof current?.score === 'number') {
      return { score: Math.round(current.score), rating: current.rating ?? '' };
    }

    const hist = data.fear_and_greed_historical?.data;
    if (Array.isArray(hist) && hist.length > 0) {
      const last = hist[hist.length - 1];
      if (typeof last.y === 'number') {
        return { score: Math.round(last.y), rating: last.rating ?? '' };
      }
    }
    return null;
  } catch {
    return null;
  }
}
