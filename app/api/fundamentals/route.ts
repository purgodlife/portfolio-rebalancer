import { NextRequest, NextResponse } from 'next/server';
import type { Fundamentals } from '@/lib/risk/graham';

/**
 * 이 API 라우트가 왜 필요한가:
 * 벤저민 그레이엄 체크리스트(유동비율/부채비율/PER/PBR/이익 안정성/배당 기록)를
 * 계산하려면 Yahoo Finance의 재무 데이터(quoteSummary)와 배당 이력(chart
 * events=div)이 필요하다. 브라우저에서 직접 호출하면 CORS에 막히고,
 * quoteSummary는 별도 인증(cookie+crumb)이 필요해서 이 서버리스 함수가 그
 * 과정을 대신 처리한 뒤 필요한 값만 추려서 돌려준다.
 *
 * 이 함수를 통과하는 데이터는 오직 요청 쿼리의 "symbol" 문자열뿐이다.
 * 사용자의 포트폴리오 데이터(보유종목/수량/매수가 등)는 이 함수에 절대
 * 전달되지 않고, 요청/응답을 별도로 저장하거나 로깅하지 않는다(Vercel 기본
 * 액세스 로그 이외에는 아무 기록도 남기지 않음).
 *
 * 주의: quoteSummary는 야후의 비공식 인증 절차(cookie+crumb)에 의존하기
 * 때문에 시세 조회(/api/quote)보다 불안정할 수 있다. 그래서 이 라우트는
 * 절대 요청 전체를 실패(500)시키지 않고, 못 가져온 항목은 null로 비운 채
 * warnings 배열에 이유를 담아 항상 200으로 응답한다.
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

const TICKER_PATTERN = /^[A-Za-z0-9.\-=^]{1,15}$/;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

interface CrumbSession {
  cookie: string;
  crumb: string;
}

async function getCrumbSession(): Promise<CrumbSession | null> {
  try {
    const cookieRes = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': UA },
      cache: 'no-store',
      redirect: 'manual',
    });
    const setCookie = cookieRes.headers.get('set-cookie');
    if (!setCookie) return null;
    const cookie = setCookie.split(';')[0];

    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': UA, Cookie: cookie },
      cache: 'no-store',
    });
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.includes('<')) return null;
    return { cookie, crumb };
  } catch {
    return null;
  }
}

type SummaryFields = Pick<
  Fundamentals,
  | 'currency'
  | 'currentRatio'
  | 'debtToEquity'
  | 'trailingPE'
  | 'priceToBook'
  | 'dividendYield'
  | 'marketCap'
  | 'annualNetIncomes'
  | 'quoteType'
  | 'expenseRatio'
  | 'topHoldingsConcentration'
  | 'earningsDate'
>;

async function fetchQuoteSummary(symbol: string): Promise<Partial<SummaryFields> & { warning?: string }> {
  const session = await getCrumbSession();
  if (!session) return { warning: '재무 데이터를 가져오지 못했습니다 (인증 실패)' };

  try {
    const modules = 'financialData,defaultKeyStatistics,summaryDetail,incomeStatementHistory,quoteType,fundProfile,topHoldings,calendarEvents';
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(session.crumb)}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA, Cookie: session.cookie }, cache: 'no-store' });
    if (!res.ok) return { warning: '재무 데이터를 가져오지 못했습니다' };
    const json = await res.json();
    const result = json?.quoteSummary?.result?.[0];
    if (!result) return { warning: '재무 데이터를 가져오지 못했습니다' };

    const financialData = result.financialData ?? {};
    const keyStats = result.defaultKeyStatistics ?? {};
    const summary = result.summaryDetail ?? {};
    const incomeHistory: Array<{ endDate?: { fmt?: string }; netIncome?: { raw?: number } }> =
      result.incomeStatementHistory?.incomeStatementHistory ?? [];

    const annualNetIncomes = incomeHistory
      .map((entry) => {
        const year = entry.endDate?.fmt ? Number(entry.endDate.fmt.slice(0, 4)) : null;
        const netIncome = entry.netIncome?.raw;
        return year && typeof netIncome === 'number' ? { year, netIncome } : null;
      })
      .filter((v): v is { year: number; netIncome: number } => v !== null)
      .sort((a, b) => b.year - a.year);

    const quoteType: string | null = result.quoteType?.quoteType ?? null;

    const expenseRatio: number | null =
      result.fundProfile?.feesExpensesInvestment?.annualReportExpenseRatio?.raw ?? null;

    const topHoldingsList: Array<{ holdingPercent?: { raw?: number } }> = result.topHoldings?.holdings ?? [];
    const topHoldingsConcentration =
      topHoldingsList.length > 0
        ? topHoldingsList.reduce((sum, h) => sum + (h.holdingPercent?.raw ?? 0), 0)
        : null;

    // calendarEvents.earnings.earningsDate는 예상 실적발표일이 범위로 나올 때가
    // 많아(예: 확정 전 잠정 범위 2개) 배열로 온다 — 가장 이른 값을 다가오는
    // 실적발표일로 취급한다. epoch 초 단위라 ms로 변환.
    const earningsDateRaw: number | undefined = result.calendarEvents?.earnings?.earningsDate?.[0]?.raw;
    const earningsDate = typeof earningsDateRaw === 'number' ? earningsDateRaw * 1000 : null;

    return {
      currency: summary.currency ?? null,
      currentRatio: financialData.currentRatio?.raw ?? null,
      debtToEquity: financialData.debtToEquity?.raw ?? null,
      trailingPE: summary.trailingPE?.raw ?? null,
      priceToBook: keyStats.priceToBook?.raw ?? null,
      dividendYield: summary.dividendYield?.raw ?? null,
      marketCap: summary.marketCap?.raw ?? keyStats.marketCap?.raw ?? null,
      annualNetIncomes,
      quoteType,
      expenseRatio,
      topHoldingsConcentration,
      earningsDate,
    };
  } catch {
    return { warning: '재무 데이터를 가져오지 못했습니다' };
  }
}

async function fetchDividendYears(symbol: string): Promise<{ dividendYears: number[]; warning?: string }> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=max&interval=1mo&events=div`;
    const res = await fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' });
    if (!res.ok) return { dividendYears: [], warning: '배당 이력을 가져오지 못했습니다' };
    const json = await res.json();
    const dividends = json?.chart?.result?.[0]?.events?.dividends as Record<string, { date?: number }> | undefined;
    if (!dividends) return { dividendYears: [] };
    const years = new Set<number>();
    for (const entry of Object.values(dividends)) {
      if (typeof entry.date === 'number') years.add(new Date(entry.date * 1000).getUTCFullYear());
    }
    return { dividendYears: [...years].sort((a, b) => a - b) };
  } catch {
    return { dividendYears: [], warning: '배당 이력을 가져오지 못했습니다' };
  }
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const symbol = req.nextUrl.searchParams.get('symbol');
  if (!symbol || !TICKER_PATTERN.test(symbol)) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
  }

  const [summaryData, dividendData] = await Promise.all([fetchQuoteSummary(symbol), fetchDividendYears(symbol)]);

  const warnings = [summaryData.warning, dividendData.warning].filter((w): w is string => !!w);

  const payload: Fundamentals = {
    symbol,
    currency: summaryData.currency ?? null,
    currentRatio: summaryData.currentRatio ?? null,
    debtToEquity: summaryData.debtToEquity ?? null,
    trailingPE: summaryData.trailingPE ?? null,
    priceToBook: summaryData.priceToBook ?? null,
    dividendYield: summaryData.dividendYield ?? null,
    marketCap: summaryData.marketCap ?? null,
    annualNetIncomes: summaryData.annualNetIncomes ?? [],
    dividendYears: dividendData.dividendYears,
    quoteType: summaryData.quoteType ?? null,
    expenseRatio: summaryData.expenseRatio ?? null,
    topHoldingsConcentration: summaryData.topHoldingsConcentration ?? null,
    earningsDate: summaryData.earningsDate ?? null,
    fetchedAt: Date.now(),
    warnings,
  };

  return NextResponse.json(payload, { status: 200 });
}
