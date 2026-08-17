import { getTranslations } from 'next-intl/server';

export default async function SettingsAboutPage() {
  const t = await getTranslations('about');
  return (
    <div className="card mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold">{t('title')}</h1>
      <div className="space-y-3 text-sm text-gray-700">
        <p>{t('intro')}</p>
        <p>{t('purpose')}</p>
        <p>{t('dataPrinciple')}</p>
        <p>{t('notAdvice')}</p>
      </div>
    </div>
  );
}
