'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

const STORAGE_KEY = 'portfolio-rebalancer:onboardingDismissed';

/**
 * 처음 앱을 켠 사용자에게 "자산배분 카테고리 설정 → 보유종목 입력 → 리밸런싱
 * 계산 확인" 순서를 안내하는 체크리스트. 카테고리·보유종목이 모두 채워지면
 * 자동으로 사라지고, 직접 닫으면(dismiss) 다시 보이지 않는다(localStorage에
 * 저장, 서버로는 전송되지 않음).
 */
export default function OnboardingChecklist({
  hasCategories,
  hasHoldings,
}: {
  hasCategories: boolean;
  hasHoldings: boolean;
}) {
  const t = useTranslations('onboarding');
  // 초기값은 true로 둬서 localStorage 확인 전에는 아무것도 안 그린다(깜빡임 방지).
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(STORAGE_KEY) === '1');
  }, []);

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  }

  if (dismissed || (hasCategories && hasHoldings)) return null;

  return (
    <div className="card border-brand-100 bg-brand-50/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900">{t('title')}</h2>
          <p className="mt-0.5 text-sm text-gray-500">{t('description')}</p>
        </div>
        <button
          type="button"
          className="shrink-0 text-xs text-gray-400 hover:text-gray-600"
          onClick={dismiss}
        >
          {t('dismiss')}
        </button>
      </div>
      <ol className="mt-3 space-y-2 text-sm">
        <Step number={1} done={hasCategories} label={t('step1Title')} href="/portfolio/allocation" cta={t('step1Cta')} />
        <Step number={2} done={hasHoldings} label={t('step2Title')} href="/portfolio/holdings" cta={t('step2Cta')} />
        <li className="flex items-center gap-2 text-gray-500">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-300 text-xs text-gray-400">
            3
          </span>
          {t('step3Title')}
        </li>
      </ol>
    </div>
  );
}

function Step({
  number,
  done,
  label,
  href,
  cta,
}: {
  number: number;
  done: boolean;
  label: string;
  href: string;
  cta: string;
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
          done ? 'bg-brand-600 text-white' : 'border border-gray-300 text-gray-400'
        }`}
      >
        {done ? '✓' : number}
      </span>
      <span className={done ? 'text-gray-400 line-through' : 'text-gray-700'}>{label}</span>
      {!done && (
        <Link href={href} className="ml-auto shrink-0 text-brand-600 hover:underline">
          {cta}
        </Link>
      )}
    </li>
  );
}
