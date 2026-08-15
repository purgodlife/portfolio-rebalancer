'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import InfoTooltip from './InfoTooltip';
import { ResultStat } from './KrTaxBenefitCalculator';
import {
  calculate401kLimit,
  calculateIraContributionLimit,
  calculateTraditionalIraDeduction,
  calculateRothIraEligibility,
  estimateLtcgBracket,
  type FilingStatus,
  type LtcgFilingStatus,
} from '@/lib/tax/usTaxBenefits';

function toNumber(v: string): number {
  const n = Number(v.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(0)}%`;
}

const CONTRIBUTION_FORM_DEFAULT = { age: '' };

const TRADITIONAL_FORM_DEFAULT = {
  filingStatus: 'single' as FilingStatus,
  magi: '',
  coveredByWorkplacePlan: true,
  spouseCoveredByWorkplacePlan: false,
  contribution: '',
};

const ROTH_FORM_DEFAULT = {
  filingStatus: 'single' as FilingStatus,
  magi: '',
  age: '',
  desiredContribution: '',
};

const LTCG_FORM_DEFAULT = {
  filingStatus: 'single' as LtcgFilingStatus,
  taxableIncome: '',
};

/**
 * 미국 401(k)/Traditional IRA/Roth IRA 납입한도, 소득공제·납입가능액,
 * 장기양도소득세 구간을 보여주는 참고용 계산기. 세무 자문이 아니며, 모든
 * 계산은 브라우저 안에서만 이뤄지고 입력값은 저장·전송되지 않는다.
 */
export default function UsTaxBenefitCalculator() {
  const t = useTranslations('usTaxBenefits');
  const [contributionForm, setContributionForm] = useState(CONTRIBUTION_FORM_DEFAULT);
  const [traditionalForm, setTraditionalForm] = useState(TRADITIONAL_FORM_DEFAULT);
  const [rothForm, setRothForm] = useState(ROTH_FORM_DEFAULT);
  const [ltcgForm, setLtcgForm] = useState(LTCG_FORM_DEFAULT);

  const age = contributionForm.age ? toNumber(contributionForm.age) : 0;
  const contribution401k = useMemo(() => calculate401kLimit(age), [age]);
  const iraLimit = useMemo(() => calculateIraContributionLimit(age), [age]);

  const traditionalResult = useMemo(
    () =>
      calculateTraditionalIraDeduction({
        filingStatus: traditionalForm.filingStatus,
        magi: toNumber(traditionalForm.magi),
        coveredByWorkplacePlan: traditionalForm.coveredByWorkplacePlan,
        spouseCoveredByWorkplacePlan: traditionalForm.spouseCoveredByWorkplacePlan,
        contribution: toNumber(traditionalForm.contribution),
      }),
    [traditionalForm]
  );

  const rothResult = useMemo(
    () =>
      calculateRothIraEligibility({
        filingStatus: rothForm.filingStatus,
        magi: toNumber(rothForm.magi),
        age: rothForm.age ? toNumber(rothForm.age) : 0,
        desiredContribution: toNumber(rothForm.desiredContribution),
      }),
    [rothForm]
  );

  const ltcgResult = useMemo(
    () => estimateLtcgBracket(ltcgForm.filingStatus, toNumber(ltcgForm.taxableIncome)),
    [ltcgForm]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        {t('notAdviceWarning')}
      </div>

      {/* 401(k) / IRA 납입한도 */}
      <div className="card space-y-4">
        <h2 className="font-medium text-gray-900">
          {t('contributionTitle')} <InfoTooltip text={t('contributionInfo')} source={t('sourceIrs401k')} />
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('age')}</label>
            <input
              type="number"
              className="input"
              value={contributionForm.age}
              onChange={(e) => setContributionForm({ age: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-3">
          <ResultStat label={t('employee401kLimit')} value={usd(contribution401k.employeeLimit)} />
          <ResultStat label={t('catchUp')} value={usd(contribution401k.catchUp)} />
          <ResultStat label={t('total401kLimit')} value={usd(contribution401k.total)} highlight />
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-3">
          <ResultStat label={t('iraBase')} value={usd(iraLimit.base)} />
          <ResultStat label={t('catchUp')} value={usd(iraLimit.catchUp)} />
          <ResultStat label={t('iraTotal')} value={usd(iraLimit.total)} highlight />
        </div>
      </div>

      {/* Traditional IRA 소득공제 */}
      <div className="card space-y-4">
        <h2 className="font-medium text-gray-900">
          {t('traditionalTitle')} <InfoTooltip text={t('traditionalInfo')} source={t('sourceIrsIra')} />
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('filingStatus')}</label>
            <select
              className="input"
              value={traditionalForm.filingStatus}
              onChange={(e) =>
                setTraditionalForm((f) => ({ ...f, filingStatus: e.target.value as FilingStatus }))
              }
            >
              <option value="single">{t('filingStatusSingle')}</option>
              <option value="marriedFilingJointly">{t('filingStatusMfj')}</option>
              <option value="marriedFilingSeparately">{t('filingStatusMfs')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('magi')}</label>
            <input
              type="number"
              className="input"
              value={traditionalForm.magi}
              onChange={(e) => setTraditionalForm((f) => ({ ...f, magi: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('contributionAmount')}</label>
            <input
              type="number"
              className="input"
              value={traditionalForm.contribution}
              onChange={(e) => setTraditionalForm((f) => ({ ...f, contribution: e.target.value }))}
            />
          </div>
          <div className="flex flex-col justify-center gap-1.5 pt-4 text-sm text-gray-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={traditionalForm.coveredByWorkplacePlan}
                onChange={(e) =>
                  setTraditionalForm((f) => ({ ...f, coveredByWorkplacePlan: e.target.checked }))
                }
              />
              {t('coveredByWorkplacePlan')}
            </label>
            {!traditionalForm.coveredByWorkplacePlan && traditionalForm.filingStatus === 'marriedFilingJointly' && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={traditionalForm.spouseCoveredByWorkplacePlan}
                  onChange={(e) =>
                    setTraditionalForm((f) => ({ ...f, spouseCoveredByWorkplacePlan: e.target.checked }))
                  }
                />
                {t('spouseCovered')}
              </label>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-3">
          <ResultStat label={t('deductibleFraction')} value={pct(traditionalResult.deductibleFraction)} />
          <ResultStat label={t('deductibleAmount')} value={usd(traditionalResult.deductibleAmount)} highlight />
          <ResultStat label={t('nonDeductibleAmount')} value={usd(traditionalResult.nonDeductibleAmount)} />
        </div>
      </div>

      {/* Roth IRA 납입 가능액 */}
      <div className="card space-y-4">
        <h2 className="font-medium text-gray-900">
          {t('rothTitle')} <InfoTooltip text={t('rothInfo')} source={t('sourceIrsIra')} />
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('filingStatus')}</label>
            <select
              className="input"
              value={rothForm.filingStatus}
              onChange={(e) => setRothForm((f) => ({ ...f, filingStatus: e.target.value as FilingStatus }))}
            >
              <option value="single">{t('filingStatusSingle')}</option>
              <option value="marriedFilingJointly">{t('filingStatusMfj')}</option>
              <option value="marriedFilingSeparately">{t('filingStatusMfs')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('magi')}</label>
            <input
              type="number"
              className="input"
              value={rothForm.magi}
              onChange={(e) => setRothForm((f) => ({ ...f, magi: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('age')}</label>
            <input
              type="number"
              className="input"
              value={rothForm.age}
              onChange={(e) => setRothForm((f) => ({ ...f, age: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('desiredContribution')}</label>
            <input
              type="number"
              className="input"
              value={rothForm.desiredContribution}
              onChange={(e) => setRothForm((f) => ({ ...f, desiredContribution: e.target.value }))}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-4">
          <ResultStat label={t('iraTotal')} value={usd(rothResult.contributionLimit)} />
          <ResultStat label={t('eligibleFraction')} value={pct(rothResult.eligibleFraction)} />
          <ResultStat label={t('maxAllowedContribution')} value={usd(rothResult.maxAllowedContribution)} highlight />
          <ResultStat label={t('disallowedAmount')} value={usd(rothResult.disallowedAmount)} />
        </div>
      </div>

      {/* 장기 양도소득세(LTCG) 구간 참고 */}
      <div className="card space-y-4">
        <h2 className="font-medium text-gray-900">
          {t('ltcgTitle')} <InfoTooltip text={t('ltcgInfo')} source={t('sourceIrsLtcg')} />
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('filingStatus')}</label>
            <select
              className="input"
              value={ltcgForm.filingStatus}
              onChange={(e) =>
                setLtcgForm((f) => ({ ...f, filingStatus: e.target.value as LtcgFilingStatus }))
              }
            >
              <option value="single">{t('filingStatusSingle')}</option>
              <option value="marriedFilingJointly">{t('filingStatusMfj')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('taxableIncome')}</label>
            <input
              type="number"
              className="input"
              value={ltcgForm.taxableIncome}
              onChange={(e) => setLtcgForm((f) => ({ ...f, taxableIncome: e.target.value }))}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-3">
          <ResultStat label={t('ltcgRate')} value={ltcgResult.bracketLabel} highlight />
        </div>
        <p className="text-xs text-gray-400">{t('niitNote')}</p>
      </div>
    </div>
  );
}
