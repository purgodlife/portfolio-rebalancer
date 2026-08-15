import type { AccountType, Market } from '@/lib/rebalance/types';
import { detectLeverage } from './etf';

/**
 * 계좌 유형(연금저축/IRP/ISA/일반)에 맞게 그 계좌의 보유종목이 실제로 그
 * 계좌의 세제 혜택·매매 가능 범위에 맞게 운용되고 있는지 훑어본다.
 *
 * 핵심 근거:
 * - ISA·연금저축·IRP 모두 해외 "거래소 상장" 종목은 직접 매매할 수 없다
 *   (국내 상장 ETF를 통한 간접 투자만 가능). 이 계좌들에 해외(US) 종목이
 *   들어있다면 실제로는 매매가 불가능한 상품이거나 계좌 구분이 잘못됐을
 *   가능성이 크다.
 * - ISA 비과세·저율과세는 "이자소득·배당소득"과, 매매차익이 과세대상인
 *   상품(국내 상장 해외지수 ETF·채권형 ETF 등)에서 나온 차익에 적용된다.
 *   국내 개별주식의 매매차익은 세제상 원래도 비과세이므로, 배당수익률이
 *   낮은 국내 개별주식만 ISA에 담으면 ISA 특유의 절세 효과는 크지 않다
 *   (배당 부분에서는 여전히 비과세 효과가 있다).
 * - 연금저축·IRP는 레버리지·인버스 ETF 매매가 전면 금지되어 있다(파생상품
 *   위험자산 한도 규정). IRP는 추가로 위험자산(주식형 ETF·펀드 등) 비중이
 *   적립금의 70%를 넘을 수 없다는 한도가 있다(이 앱은 원리금보장형 상품
 *   잔액을 입력받지 않으므로 정확한 비중 계산은 하지 않고 안내만 한다).
 *
 * 이 판정은 종목명 기반 휴리스틱(예: ETF 이름에 "미국"/"S&P"/"채권" 등이
 * 있으면 해외·채권형으로 추정)을 일부 포함하므로 참고용이며, 실제 상품
 * 설명서(투자설명서)로 반드시 다시 확인해야 한다.
 *
 * 출처:
 * - 조세특례제한법 제91조의18(ISA 과세특례)
 * - 자본시장법 시행령 제241조(파생상품 위험자산 한도), 연금저축·IRP 위험자산
 *   투자한도 관련 감독규정
 */

export type AccountFitLevel = 'good' | 'info' | 'low' | 'critical';

export interface AccountFitFinding {
  level: AccountFitLevel;
  /** i18n 메시지 키(accountFit.finding_* ) */
  key: string;
  ticker?: string;
  name?: string;
  params?: Record<string, string>;
}

export interface AccountFitReport {
  accountType: AccountType;
  findings: AccountFitFinding[];
}

export interface HoldingFitInput {
  ticker: string;
  name: string;
  market: Market;
  /** Yahoo quoteType (EQUITY/ETF 등). 모르면 undefined. */
  quoteType?: string | null;
  /** 배당수익률(소수, 0.02 = 2%). 모르면 undefined. */
  dividendYield?: number | null;
}

const DOMESTIC_HINT = /(코스피|코스닥|KRX|국내)/;
const FOREIGN_OR_BOND_HINT =
  /(미국|US|S&P|나스닥|NASDAQ|다우|차이나|중국|일본|유럽|글로벌|선진국|신흥국|이머징|채권|국채|회사채|리츠|REIT|원자재|금|골드|GOLD)/i;

/** ETF 이름에 근거해 "매매차익이 원래 과세대상일 가능성이 큰 상품"인지 휴리스틱으로 추정한다. */
function isLikelyTaxableEtf(name: string): boolean {
  return FOREIGN_OR_BOND_HINT.test(name) && !DOMESTIC_HINT.test(name);
}

const DIVIDEND_YIELD_GOOD_THRESHOLD = 0.02; // 2%

export function evaluateAccountFit(accountType: AccountType, holdings: HoldingFitInput[]): AccountFitReport {
  const findings: AccountFitFinding[] = [];

  if (accountType === 'general') {
    findings.push({ level: 'info', key: 'generalNoRestriction' });
    return { accountType, findings };
  }

  // 공통: ISA·연금저축·IRP는 해외 거래소에 상장된 종목을 직접 매매할 수 없다.
  for (const h of holdings) {
    if (h.market === 'US') {
      findings.push({ level: 'critical', key: 'foreignDirectStock', ticker: h.ticker, name: h.name });
    }
  }

  if (accountType === 'isa') {
    for (const h of holdings) {
      if (h.market !== 'KR') continue;
      if (h.quoteType === 'ETF') {
        if (isLikelyTaxableEtf(h.name)) {
          findings.push({ level: 'good', key: 'isaTaxableEtfGood', ticker: h.ticker, name: h.name });
        } else {
          findings.push({ level: 'info', key: 'isaDomesticEtfLimited', ticker: h.ticker, name: h.name });
        }
      } else {
        const yieldPct = (h.dividendYield ?? 0) * 100;
        if ((h.dividendYield ?? 0) >= DIVIDEND_YIELD_GOOD_THRESHOLD) {
          findings.push({
            level: 'good',
            key: 'isaDividendGood',
            ticker: h.ticker,
            name: h.name,
            params: { yield: yieldPct.toFixed(1) },
          });
        } else {
          findings.push({ level: 'low', key: 'isaLowBenefitStock', ticker: h.ticker, name: h.name });
        }
      }
    }
  }

  if (accountType === 'irp' || accountType === 'pensionSavings') {
    for (const h of holdings) {
      if (detectLeverage(h.name, h.ticker)) {
        findings.push({ level: 'critical', key: 'pensionLeverageBanned', ticker: h.ticker, name: h.name });
      }
    }
    if (accountType === 'irp' && holdings.length > 0) {
      findings.push({ level: 'info', key: 'irpRiskyAssetLimitInfo' });
    }
  }

  if (findings.length === 0) {
    findings.push({ level: 'good', key: 'noIssuesFound' });
  }

  return { accountType, findings };
}
