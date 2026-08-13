export type CheckStatus = 'pass' | 'fail' | 'unknown';

export interface RiskCheck<K extends string> {
  key: K;
  status: CheckStatus;
  /** 화면에 보여줄 값(단위 없이, 포맷은 UI에서) */
  value: string;
}
