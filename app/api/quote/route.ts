import { NextRequest, NextResponse } from 'next/server';

/**
 * 이 API 라우트가 왜 필요한가:
 * 브라우저에서 Yahoo Finance 비공식 차트 API(query1.finance.yahoo.com)를
 * 직접 호출하면 CORS에 막히기 때문에, 이 서버리스 함수가 "티커 심볼(+선택적
 * range/interval)"만 그대로 전달해 시세를 대신 받아오는 순수 중계(pass-through)
 * 역할만 한다.
 *
 * 이 함수를 통과하는 데이터는 오직 요청 쿼리의 "symbol"·"range"·"interval"
 * 문자열뿐이다(둘 다 미리 정해둔 값 중에서만 허용). 사용자의 포트폴리오 데이터
 * (보유종목/수량/매수가/자산배분 등)는 이 함수에 절대 전달되지 않고, 요청/응답
 * 내용을 별도로 저장하거나 로깅하지도 않는다(Vercel의 기본 액세스 로그 이외에는
 * 아무 기록도 남기지 않음).
 */

export const runtime = 'nodejs';

// 매우 단순한 메모리 기반 rate limit. 서버리스 인스턴스마다 상태가 독립적이라
// 완벽한 방어는 아니지만, 남용을 줄이는 최소한의 안전장치 역할을 한다.
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;
const requestLog = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  requestLog.set(key, recent);
  return recent.length > MAX_REQUESTS_PER_WINDOW;
}

// 티커 심볼 형태만 허용 (영문/숫자/.  -  = ^ 정도). 그 외 값은 거부.
const TICKER_PATTERN = /^[A-Za-z0-9.\-=^]{1,15}$/;

// range/interval은 자산추이 화면의 벤치마크 비교(월별 지수 시계열 조회)에만 쓰이며,
// 정해둔 값 중 하나가 아니면 무시하고 Yahoo 기본값(하루치, 일간)을 사용한다.
const ALLOWED_RANGES = new Set(['1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'max']);
const ALLOWED_INTERVALS = new Set(['1d', '1wk', '1mo']);

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const symbol = req.nextUrl.searchParams.get('symbol');
  if (!symbol || !TICKER_PATTERN.test(symbol)) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
  }

  const rangeParam = req.nextUrl.searchParams.get('range');
  const intervalParam = req.nextUrl.searchParams.get('interval');
  const range = rangeParam && ALLOWED_RANGES.has(rangeParam) ? rangeParam : null;
  const interval = intervalParam && ALLOWED_INTERVALS.has(intervalParam) ? intervalParam : null;
  const extraParams = range && interval ? `&range=${range}&interval=${interval}` : '';

  try {
    const upstream = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?dummy=1${extraParams}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        },
        cache: 'no-store',
      }
    );
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: 'Upstream request failed' }, { status: 502 });
  }
}
