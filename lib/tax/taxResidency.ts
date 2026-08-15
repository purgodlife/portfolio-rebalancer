'use client';

import { useEffect, useState } from 'react';
import type { LtcgFilingStatus } from './usTaxBenefits';

/**
 * 이 앱의 세금 추정 기능(리밸런싱 계산기의 "세금 반영(추정)", 거래내역의
 * 연도별 매매손익)이 어느 나라 세법을 기준으로 계산할지 정하는 설정이다.
 *
 * 왜 필요한가: 증권거래세(국내 상장주식 매도에 붙는 거래세)는 매매 대상
 * 종목이 상장된 "시장"을 기준으로 매겨지지만(거주자·비거주자 불문, 국내
 * 금융투자업자를 통한 정상 거래라면 매도인에게 부과), 양도소득세는 그
 * "투자자가 어느 나라에 세금을 내는 사람인지(거주지/시민권)"에 따라 완전히
 * 다른 세법이 적용된다. 한국 거주자는 국내상장주식 매매차익이 비과세이고
 * 해외(미국 등)상장주식만 22%로 과세되지만, 미국 거주자·시민권자는 전세계
 * 소득에 과세하는 원칙상 국내(한국) 상장주식 매매차익도 미국 국세청에
 * 신고·과세 대상이다. 그래서 세금 추정 로직은 "종목이 어느 시장에
 * 상장됐는지"가 아니라 "사용자가 어느 나라 세금 거주자인지"를 함께 고려해야
 * 한다. (다른 나라는 이번 범위에서 다루지 않는다.)
 */
export type TaxResidency = 'kr' | 'us';

const RESIDENCY_STORAGE_KEY = 'portfolio-rebalancer:taxResidency';

export function useTaxResidency() {
  const [residency, setResidencyState] = useState<TaxResidency>('kr');

  useEffect(() => {
    const stored = window.localStorage.getItem(RESIDENCY_STORAGE_KEY);
    if (stored === 'us' || stored === 'kr') setResidencyState(stored);
  }, []);

  function setResidency(value: TaxResidency) {
    setResidencyState(value);
    window.localStorage.setItem(RESIDENCY_STORAGE_KEY, value);
  }

  return [residency, setResidency] as const;
}

/** 미국 거주자용 세율 추정에 필요한 입력값. 리밸런싱 계산기/거래내역 화면이 공유한다. */
export interface UsTaxSettings {
  /** 장기양도소득세(LTCG) 구간 추정용 신고유형 */
  filingStatus: LtcgFilingStatus;
  /** 장기양도소득세 구간 추정용 연간 과세대상소득(입력 문자열) */
  taxableIncome: string;
  /** 단기(1년 미만 보유) 매매차익에 적용할 세율(%). 이 앱은 미국 연방
   * 일반소득세 브래킷 전체를 계산하지 않으므로 사용자가 자신의 한계세율을
   * 직접 입력한다. */
  shortTermRatePercent: string;
  /** 순투자소득세(NIIT, 3.8%) 대상 고소득자인지 */
  subjectToNiit: boolean;
}

const US_SETTINGS_STORAGE_KEY = 'portfolio-rebalancer:usTaxSettings';

const US_SETTINGS_DEFAULT: UsTaxSettings = {
  filingStatus: 'single',
  taxableIncome: '',
  shortTermRatePercent: '22',
  subjectToNiit: false,
};

export function useUsTaxSettings() {
  const [settings, setSettingsState] = useState<UsTaxSettings>(US_SETTINGS_DEFAULT);

  useEffect(() => {
    const raw = window.localStorage.getItem(US_SETTINGS_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setSettingsState({ ...US_SETTINGS_DEFAULT, ...parsed });
    } catch {
      // 저장된 값이 손상된 경우 기본값을 그대로 유지한다.
    }
  }, []);

  function updateSettings(patch: Partial<UsTaxSettings>) {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      window.localStorage.setItem(US_SETTINGS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return [settings, updateSettings] as const;
}
