'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import InfoTooltip from './InfoTooltip';
import {
  calculatePensionTaxCredit,
  calculateIsaTax,
  PENSION_SAVINGS_LIMIT,
  PENSION_TOTAL_LIMIT,
  type IsaType,
} from '@/lib/tax/taxBenefits';

function toNumber(v: string): number {
  const n = Number(v.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function won(n: number): string {
  return `${Math.round(n).toLocaleString()}원`;
}

const PENSION_FORM_DEFAULT = {
  totalSalary: '',
  pensionSavingsContribution: '',
  irpContribution: '',
  isaTransferAmount: '',
};

const ISA_FORM_DEFAULT = {
  isaType: 'general' as IsaType,
  realizedGain: '',
};

/**
 * 연금저축·IRP 세액공제, ISA 비과세/저율과세를 계산해 보여주는 참고용 계산기.
 * 세무 자문이 아니며, 실제 적용 결과는 개인 상황에 따라 다를 수 있다는 점을
 * 화면 상단에 명시한다. 모든 계산은 브라우저 안에서만 이뤄지고 입력값은
 * 저장되거나 서버로 전송되지 않는다.
 */
export default function KrTaxBenefitCalculator() {
  const t = useTranslations('taxBenefits');
  const [pensionForm, setPensionForm] = useState(PENSION_FORM_DEFAULT);
  const [isaForm, setIsaForm] = useState(ISA_FORM_DEFAULT);

  const pensionResult = useMemo(
    () =>
      calculatePensionTaxCredit({
        totalSalary: pensionForm.totalSalary ? toNumber(pensionForm.totalSalary) : undefined,
        pensionSavingsContribution: toNumber(pensionForm.pensionSavingsContribution),
        irpContribution: toNumber(pensionForm.irpContribution),
        isaTransferAmount: pensionForm.isaTransferAmount ? toNumber(pensionForm.isaTransferAmount) : undefined,
      }),
    [pensionForm]
  );

  const isaResult = useMemo(
    () =>
      calculateIsaTax({
        isaType: isaForm.isaType,
        realizedGain: toNumber(isaForm.realizedGain),
      }),
    [isaForm]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        {t('notAdviceWarning')}
      </div>

      {/* 연금저축 · IRP 세액공제 */}
      <div className="card space-y-4">
        <h2 className="font-medium text-gray-900">
          {t('pensionTitle')} <InfoTooltip text={t('pensionInfo')} source={t('sourceNts')} />
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('totalSalary')}</label>
            <input
              type="number"
              className="input"
              placeholder={t('totalSalaryPlaceholder')}
              value={pensionForm.totalSalary}
              onChange={(e) => setPensionForm((f) => ({ ...f, totalSalary: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {t('pensionSavingsContribution')} ({t('limitHint', { limit: won(PENSION_SAVINGS_LIMIT) })})
            </label>
            <input
              type="number"
              className="input"
              value={pensionForm.pensionSavingsContribution}
              onChange={(e) => setPensionForm((f) => ({ ...f, pensionSavingsContribution: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('irpContribution')}</label>
            <input
              type="number"
              className="input"
              value={pensionForm.irpContribution}
              onChange={(e) => setPensionForm((f) => ({ ...f, irpContribution: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {t('isaTransferAmount')} <InfoTooltip text={t('isaTransferInfo')} source={t('sourceNts')} />
            </label>
            <input
              type="number"
              className="input"
              value={pensionForm.isaTransferAmount}
              onChange={(e) => setPensionForm((f) => ({ ...f, isaTransferAmount: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-4">
          <ResultStat label={t('appliedRate')} value={`${(pensionResult.rate * 100).toFixed(1)}%`} />
          <ResultStat label={t('eligibleTotal')} value={won(pensionResult.eligibleTotal)} />
          <ResultStat label={t('estimatedCredit')} value={won(pensionResult.estimatedCredit)} highlight />
          <ResultStat label={t('remainingRoom')} value={won(pensionResult.remainingRoom)} />
        </div>
        <p className="text-xs text-gray-400">{t('pensionLimitNote', { total: won(PENSION_TOTAL_LIMIT) })}</p>
      </div>

      {/* ISA 비과세 / 저율과세 */}
      <div className="card space-y-4">
        <h2 className="font-medium text-gray-900">
          {t('isaTitle')} <InfoTooltip text={t('isaInfo')} source={t('sourceIsa')} />
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('isaType')}</label>
            <select
              className="input"
              value={isaForm.isaType}
              onChange={(e) => setIsaForm((f) => ({ ...f, isaType: e.target.value as IsaType }))}
            >
              <option value="general">{t('isaTypeGeneral')}</option>
              <option value="preferential">{t('isaTypePreferential')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('realizedGain')}</label>
            <input
              type="number"
              className="input"
              value={isaForm.realizedGain}
              onChange={(e) => setIsaForm((f) => ({ ...f, realizedGain: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-4">
          <ResultStat label={t('nonTaxableLimit')} value={won(isaResult.nonTaxableLimit)} />
          <ResultStat label={t('taxableExcess')} value={won(isaResult.taxableExcess)} />
          <ResultStat label={t('estimatedTax')} value={won(isaResult.estimatedTax)} highlight />
          <ResultStat label={t('taxSavingsVsGeneral')} value={won(isaResult.taxSavingsVsGeneral)} />
        </div>
      </div>
    </div>
  );
}

export function ResultStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-base font-semibold ${highlight ? 'text-brand-700' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
