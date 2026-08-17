import { getTranslations } from 'next-intl/server';

export default async function SettingsPrivacyPage() {
  const t = await getTranslations('privacy');
  return (
    <div className="card mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold">{t('title')}</h1>
      <p className="mb-4 text-xs text-gray-400">{t('updatedNote')}</p>
      <div className="space-y-4 text-sm text-gray-700">
        <section>
          <h2 className="mb-1 font-medium text-gray-900">{t('noServerTitle')}</h2>
          <p>{t('noServerBody')}</p>
        </section>
        <section>
          <h2 className="mb-1 font-medium text-gray-900">{t('localStorageTitle')}</h2>
          <p>{t('localStorageBody')}</p>
        </section>
        <section>
          <h2 className="mb-1 font-medium text-gray-900">{t('quoteProxyTitle')}</h2>
          <p>{t('quoteProxyBody')}</p>
        </section>
        <section>
          <h2 className="mb-1 font-medium text-gray-900">{t('adCookieTitle')}</h2>
          <p>{t('adCookieBody')}</p>
          <p className="mt-1">
            <a
              href="https://policies.google.com/technologies/partner-sites"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:underline"
            >
              {t('googleAdPolicyLinkLabel')}
            </a>
          </p>
        </section>
        <section>
          <h2 className="mb-1 font-medium text-gray-900">{t('contactTitle')}</h2>
          <p>{t('contactBody')}</p>
        </section>
      </div>
    </div>
  );
}
