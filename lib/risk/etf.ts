import type { CheckStatus, RiskCheck } from './types';
import type { Fundamentals } from './graham';

/**
 * ETF는 회사가 아니라 여러 자산을 담은 바구니라서 그레이엄 체크리스트(재무제표
 * 기반)가 적용되지 않는다. 대신 ETF 고유의 리스크 축 — 비용(운용보수),
 * 집중도(상위 보유종목 비중), 레버리지/인버스 구조 여부 — 를 본다.
 */

export type EtfCheckKey = 'expenseRatio' | 'concentration' | 'leverage';
export type EtfCheck = RiskCheck<EtfCheckKey>;

export interface EtfRiskResult {
  checks: EtfCheck[];
  passCount: number;
  failCount: number;
  unknownCount: number;
  isLikelyLeveraged: boolean;
}

const LEVERAGE_PATTERN = /(\b2X\b|\b3X\b|ULTRA|LEVERAGED|INVERSE|\bBEAR\b|\bBULL\b)/i;

/** 종목명/티커에 레버리지·인버스 상품임을 시사하는 흔한 표현이 있는지 휴리스틱으로 판단한다. */
export function detectLeverage(name: string, ticker: string): boolean {
  return LEVERAGE_PATTERN.test(name) || LEVERAGE_PATTERN.test(ticker);
}

export function evaluateEtfRisk(
  name: string,
  ticker: string,
  f: Pick<Fundamentals, 'expenseRatio' | 'topHoldingsConcentration'> | null | undefined
): EtfRiskResult {
  const checks: EtfCheck[] = [];
  const leveraged = detectLeverage(name, ticker);

  // 레버리지/인버스 상품 자체가 "나쁜 투자"는 아니지만, 매일 리밸런싱하는 구조
  // 특성상 변동성 큰 장에서 손실이 복리로 커지는(decay) 구조적 리스크가 있어서
  // 그 자체를 하나의 체크 항목으로 다룬다.
  checks.push({ key: 'leverage', status: leveraged ? 'fail' : 'pass', value: leveraged ? '의심됨' : '해당없음' });

  // 운용보수(expense ratio) — 매년 확정적으로 수익을 깎아먹는 비용. 0.5% 이하를
  // 낮은 비용의 기준으로 삼는다(SPY류 대형 지수 ETF는 보통 0.03~0.1%대).
  if (f?.expenseRatio != null) {
    checks.push({
      key: 'expenseRatio',
      status: f.expenseRatio <= 0.005 ? 'pass' : 'fail',
      value: `${(f.expenseRatio * 100).toFixed(2)}%`,
    });
  } else {
    checks.push({ key: 'expenseRatio', status: 'unknown', value: '-' });
  }

  // 상위 보유종목 집중도 — "지수 ETF"라는 이름과 달리 상위 10종목이 순자산의
  // 큰 비중을 차지하는 경우가 많다. 40% 이하를 비교적 분산된 기준으로 삼는다.
  if (f?.topHoldingsConcentration != null) {
    checks.push({
      key: 'concentration',
      status: f.topHoldingsConcentration <= 0.4 ? 'pass' : 'fail',
      value: `${(f.topHoldingsConcentration * 100).toFixed(1)}%`,
    });
  } else {
    checks.push({ key: 'concentration', status: 'unknown', value: '-' });
  }

  return {
    checks,
    passCount: checks.filter((c) => c.status === 'pass').length,
    failCount: checks.filter((c) => c.status === 'fail').length,
    unknownCount: checks.filter((c) => c.status === 'unknown').length,
    isLikelyLeveraged: leveraged,
  };
}

export type { CheckStatus };
