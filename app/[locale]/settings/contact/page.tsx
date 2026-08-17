import { getTranslations } from 'next-intl/server';

export default async function SettingsContactPage() {
  const t = await getTranslations('contact');
  return (
    <div className="card mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold">{t('title')}</h1>
      <div className="space-y-3 text-sm text-gray-700">
        <p>{t('intro')}</p>
        <p>
          {t('emailLabel')}:{' '}
          <a href={`mailto:${t('email')}`} className="text-brand-600 hover:underline">
            {t('email')}
          </a>
        </p>
        <p className="text-xs text-gray-400">{t('responseNote')}</p>
      </div>
    </div>
  );
}
