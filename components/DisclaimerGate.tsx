'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useAppSettings, setDisclaimerAgreed, seedDefaultAccountIfEmpty, seedDefaultCategoriesIfEmpty } from '@/lib/storage/hooks';
import PortfolioSnapshotter from './PortfolioSnapshotter';

export default function DisclaimerGate({ children }: { children: ReactNode }) {
  const t = useTranslations('disclaimer');
  const { settings, isLoading } = useAppSettings();
  const [checked, setChecked] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    (async () => {
      await seedDefaultAccountIfEmpty();
      await seedDefaultCategoriesIfEmpty();
    })();
  }, []);

  // 아직 마운트 전이거나 IndexedDB 조회가 끝나지 않았으면(첫 렌더) 깜빡임 방지를 위해 대기
  if (!mounted || isLoading) {
    return null;
  }

  if (settings?.hasAgreedToDisclaimer) {
    return (
      <>
        <PortfolioSnapshotter />
        {children}
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="card max-w-lg w-full">
        <h2 className="text-lg font-semibold mb-2">{t('title')}</h2>
        <p className="text-sm text-gray-600 mb-4">{t('intro')}</p>
        <ul className="text-sm text-gray-700 space-y-2 mb-5 list-disc list-inside">
          <li>{t('point1')}</li>
          <li>{t('point2')}</li>
          <li>{t('point3')}</li>
          <li>{t('point4')}</li>
        </ul>
        <label className="flex items-start gap-2 text-sm mb-5">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5"
          />
          <span>{t('agree')}</span>
        </label>
        <button
          type="button"
          className="btn-primary w-full"
          disabled={!checked}
          onClick={() => setDisclaimerAgreed()}
        >
          {t('continue')}
        </button>
      </div>
    </div>
  );
}
