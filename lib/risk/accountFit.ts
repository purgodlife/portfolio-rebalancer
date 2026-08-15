import type { AccountType, Market } from '@/lib/rebalance/types';
import { detectLeverage } from './etf';

/**
 * 계좌 유형(한국: 연금저축/IRP/ISA/일반, 미국: 401(k)/Traditional IRA/Roth IRA)에
 * 맞게 그 계좌의 보유종목이 실제로 그 계좌의 세제 혜택·매매 가능 범위에 맞게
 * 운용되고 있는지 훑어본다.
 *
 * 핵심 근거 (한국 계좌):
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
 * 핵심 근거 (미국 계좌):
 * - IRS 법령상 IRA/401(k)가 보유할 수 없는 자산은 collectibles(수집품)와
 *   생명보험 정도로 매우 제한적이며(IRC §408(m)), 해외 상장 주식 자체를
 *   법으로 금지하지는 않는다. 다만 대부분의 미국 증권사·플랜 커스터디언은
 *   실무적으로 미국 거래소 상장 종목·ETF만 매매를 지원하고 한국 등 해외
 *   거래소에 직접 상장된 종목의 매매는 지원하지 않는 경우가 많다(증권사마다
 *   다를 수 있음). 그래서 이 계좌들에 국내(KR) 상장 종목이 들어있으면
 *   "법적으로 금지"라기보다는 "실제로 매매 가능한지 증권사에 확인이 필요한"
 *   낮은 수준의 경고로 표시한다.
 * - Traditional IRA는 세전 효과(소득공제)를 받는 대신 인출 시 원금·수익
 *   모두 일반소득으로 과세되고, Roth IRA는 세후 납입 대신 요건 충족 시
 *   인출이 전액 비과세다. 401(k)는 세전 급여공제 방식이 기본이며 플랜에
 *   따라 Roth 옵션이 있을 수 있다. 이 차이는 보유종목이 아니라 계좌
 *   자체의 성격이므로 정보성 안내로만 표시한다.
 *
 * 이 판정은 종목명 기반 휴리스틱(예: ETF 이름에 "미국"/"S&P"/"채권" 등이
 * 있으면 해외·채권형으로 추정)을 일부 포함하므로 참고용이며, 실제 상품
 * 설명서(투자설명서)로 반드시 다시 확인해야 한다.
 *
 * 출처:
 * - 조세특례제한법 제91조의18(ISA 과세특례)
 * - 자본시장법 시행령 제241조(파생상품 위험자산 한도), 연금저축·IRP 위험자산
 *   투자한도 관련 감독규정
 * - IRS Publication 590-A/B(미국 IRA 일반 규정, 납입 가능 자산 범위)
 *   https://www.irs.gov/publications/p590a
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

  const isKrTaxAdvantaged = accountType === 'isa' || accountType === 'irp' || accountType === 'pensionSavings';
  const isUsRetirement = accountType === 'us401k' || accountType === 'usTraditionalIra' || accountType === 'usRothIra';

  // 한국: ISA·연금저축·IRP는 해외 거래소에 상장된 종목을 직접 매매할 수 없다.
  if (isKrTaxAdvantaged) {
    for (const h of holdings) {
      if (h.market === 'US') {
        findings.push({ level: 'critical', key: 'foreignDirectStock', ticker: h.ticker, name: h.name });
      }
    }
  }

  // 미국: 401(k)/IRA 계좌는 실무적으로 국내(KR) 상장 종목 매매를 지원하지
  // 않는 경우가 많다(법적 금지는 아니므로 'low' 수준으로만 안내).
  if (isUsRetirement) {
    for (const h of holdings) {
      if (h.market === 'KR') {
        findings.push({ level: 'low', key: 'usAccountKrListedStockCheck', ticker: h.ticker, name: h.name });
      }
    }
    if (accountType === 'usRothIra') {
      findings.push({ level: 'info', key: 'usRothAfterTaxInfo' });
    } else if (accountType === 'usTraditionalIra') {
      findings.push({ level: 'info', key: 'usTraditionalPreTaxInfo' });
    } else {
      findings.push({ level: 'info', key: 'us401kInfo' });
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
