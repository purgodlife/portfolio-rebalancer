import { getTranslations } from 'next-intl/server';
import GuideArticle from '@/components/GuideArticle';

export default async function Page() {
  const t = await getTranslations('guides.grahamChecklist');
  const tGuides = await getTranslations('guides');
  const sections = [1, 2, 3, 4]
    .filter((n) => t.has(`section${n}Heading`))
    .map((n) => ({ heading: t(`section${n}Heading`), body: t(`section${n}Body`) }));
  return (
    <GuideArticle
      backLabel={tGuides('backToList')}
      backHref="/analysis/guides"
      title={t('title')}
      intro={t('intro')}
      sections={sections}
      sourceLabel={tGuides('sourceLabel')}
      source={t('source')}
    />
  );
}
