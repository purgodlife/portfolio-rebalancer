import { NextRequest, NextResponse } from 'next/server';

/**
 * 이 API 라우트가 왜 필요한가:
 * 상단 정보 티커에 CNN Fear & Greed Index를 보여주기 위해, CNN의 비공식
 * 데이터 엔드포인트(production.dataviz.cnn.io)를 대신 호출해 그대로
 * 전달(pass-through)한다. 브라우저에서 직접 호출하면 CORS에 막힌다.
 *
 * 이 라우트는 쿼리 파라미터를 전혀 받지 않는다(항상 같은 고정 URL만 조회).
 * 사용자의 포트폴리오 데이터는 이 함수에 절대 전달되지 않고, 요청/응답을
 * 별도로 저장하거나 로깅하지 않는다(Vercel 기본 액세스 로그 이외에는 아무
 * 기록도 남기지 않음).
 */

export const runtime = 'nodejs';

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const requestLog = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  requestLog.set(key, recent);
  return recent.length > MAX_REQUESTS_PER_WINDOW;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const upstream = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
      headers: {
        'User-Agent': UA,
        Referer: 'https://www.cnn.com/markets/fear-and-greed',
      },
      cache: 'no-store',
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: 'Upstream request failed' }, { status: 502 });
  }
}
