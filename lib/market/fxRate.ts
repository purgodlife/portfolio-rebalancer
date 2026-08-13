'use client';

import { useEffect, useState } from 'react';

/** Frankfurter.app 조회가 실패했을 때 사용자가 참고할 수 있는 기본값(수동 수정 가능). */
export const FALLBACK_USD_KRW_RATE = 1380;

export interface UsdKrwRateState {
  /** 조회된 환율. 아직 못 받아왔거나 실패했으면 null. */
  rate: number | null;
  loading: boolean;
  error: boolean;
  refresh: () => void;
}

/**
 * USD/KRW 환율을 Frankfurter.app에서 가져온다. 무료, API 키 불필요, CORS 허용이라
 * 브라우저에서 바로 호출할 수 있다 (별도 서버 프록시 불필요). 포트폴리오 데이터와는
 * 전혀 무관한 공개 환율 정보만 주고받는다.
 */
export function useUsdKrwRate(): UsdKrwRateState {
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch('https://api.frankfurter.dev/v1/latest?from=USD&to=KRW')
      .then((res) => {
        if (!res.ok) throw new Error('fx fetch failed');
        return res.json();
      })
      .then((data: { rates?: Record<string, number> }) => {
        if (cancelled) return;
        const value = data.rates?.KRW;
        if (typeof value === 'number' && value > 0) {
          setRate(value);
        } else {
          setError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { rate, loading, error, refresh: () => setNonce((n) => n + 1) };
}
