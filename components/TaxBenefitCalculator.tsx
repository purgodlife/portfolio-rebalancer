'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import KrTaxBenefitCalculator from './KrTaxBenefitCalculator';
import UsTaxBenefitCalculator from './UsTaxBenefitCalculator';

type Jurisdiction = 'kr' | 'us';

/**
 * 세제혜택 계산기 페이지. 한국(연금저축·IRP·ISA)과 미국(401(k)·Traditional
 * IRA·Roth IRA) 세제는 근거 법령·수치 출처가 완전히 다르므로 탭으로 분리해서
 * 보여준다. 실제 계산 로직은 KrTaxBenefitCalculator/UsTaxBenefitCalculator에
 * 있다.
 */
export default function TaxBenefitCalculator() {
  const t = useTranslations('taxBenefits');
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>('kr');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('description')}</p>
      </div>

      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-sm">
        <button
          type="button"
          className={`rounded-md px-3 py-1.5 ${
            jurisdiction === 'kr' ? 'bg-white font-medium text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
          onClick={() => setJurisdiction('kr')}
        >
          {t('jurisdictionKr')}
        </button>
        <button
          type="button"
          className={`rounded-md px-3 py-1.5 ${
            jurisdiction === 'us' ? 'bg-white font-medium text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
          onClick={() => setJurisdiction('us')}
        >
          {t('jurisdictionUs')}
        </button>
      </div>

      {jurisdiction === 'kr' ? <KrTaxBenefitCalculator /> : <UsTaxBenefitCalculator />}
    </div>
  );
}
