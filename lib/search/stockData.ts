import type { Market } from '@/lib/rebalance/types';
import krStocksJson from './data/kr-stocks.json';
import usStocksJson from './data/us-stocks.json';

export interface StockEntry {
  ticker: string;
  name: string;
  market: Market;
}

/**
 * 자동완성용 종목 리스트 (코스피/코스닥 + 미국 NYSE/NYSE American/NYSE Arca/NASDAQ 전종목).
 *
 * 데이터 출처:
 * - KR(개별종목): KRX 정보데이터시스템 상장법인목록
 *   (kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13)
 *   코스피/코스닥만 포함, 코넥스는 제외.
 * - KR(ETF): 네이버 금융 공개 API(finance.naver.com/api/sise/etfItemList.nhn).
 *   data.krx.co.kr의 OTP/다운로드 엔드포인트는 로그인 세션이 없으면 차단되어
 *   (익명 요청 시 에러페이지/403) 로그인 없이 접근 가능한 이 소스를 사용했다.
 *   개별종목과 ETF는 티커 체계가 겹치지 않아 충돌 없이 병합된다.
 * - US: Nasdaq Trader 심볼 디렉토리(nasdaqlisted.txt, otherlisted.txt).
 *   테스트 종목, 재무 결격(deficient/delinquent) 종목, 워런트/라이트/유닛(SPAC
 *   파생 증권)은 제외했고, otherlisted는 주요 거래소(NYSE/NYSE American/
 *   NYSE Arca)만 포함해 얇은 거래소(Cboe BZX 등) 상장 상품을 걸러냈다.
 *   티커의 클래스 구분 점(.)은 Yahoo Finance 표기에 맞춰 하이픈(-)으로
 *   변환했다(예: BRK.B -> BRK-B).
 *
 * 목록에 없는 종목이라도 티커/종목명을 직접 입력하면 정상적으로 추가할 수
 * 있고, "현재가 조회" 버튼은 이 목록과 무관하게 Yahoo Finance에서 해당
 * 티커를 그대로 조회하기 때문에 목록에 없는 종목도 시세는 정상 조회된다.
 */
export const KR_STOCKS: StockEntry[] = krStocksJson as StockEntry[];
export const US_STOCKS: StockEntry[] = usStocksJson as StockEntry[];
