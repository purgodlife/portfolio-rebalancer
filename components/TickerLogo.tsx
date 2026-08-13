'use client';

import { useState } from 'react';

/**
 * elbstream.com의 무료 로고 API로 종목 로고를 보여준다(출처 표기 조건부 무료 이용).
 * 못 찾으면(주로 한국 종목) 티커 이니셜 원형 아바타로 대체한다.
 */
export default function TickerLogo({ ticker, size = 22 }: { ticker: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const clean = ticker.trim().toUpperCase();

  if (failed || !clean) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-gray-200 font-semibold text-gray-500"
        style={{ width: size, height: size, fontSize: Math.max(8, size * 0.4) }}
      >
        {clean.slice(0, 2)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://api.elbstream.com/logos/symbol/${encodeURIComponent(clean)}?format=png`}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full bg-white object-contain"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
