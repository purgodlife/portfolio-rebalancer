import { getTranslations } from 'next-intl/server';

export default async function DisclaimerPage() {
  const t = await getTranslations('disclaimer');
  return (
    <div className="card max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">{t('title')}</h1>
      <ul className="text-sm text-gray-700 space-y-3 list-disc list-inside">
        <li>{t('point1')}</li>
        <li>{t('point2')}</li>
        <li>{t('point3')}</li>
        <li>{t('point4')}</li>
        <li>{t('point5')}</li>
      </ul>
    </div>
  );
}
