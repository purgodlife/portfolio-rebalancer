import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/seo/canonical';
import { getTranslations } from 'next-intl/server';
import GuideArticle from '@/components/GuideArticle';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: buildAlternates(locale, '/analysis/guides/tax-benefits-kr') };
}

export default async function Page() {
  const t = await getTranslations('guides.taxBenefitsKr');
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
