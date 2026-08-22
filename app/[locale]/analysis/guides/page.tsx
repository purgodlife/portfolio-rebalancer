import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/seo/canonical';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

const SLUGS = ['rebalancing', 'grahamChecklist', 'taxBenefitsKr', 'taxBenefitsUs', 'capitalGainsTax'] as const;
const HREFS: Record<(typeof SLUGS)[number], string> = {
  rebalancing: '/analysis/guides/rebalancing',
  grahamChecklist: '/analysis/guides/graham-checklist',
  taxBenefitsKr: '/analysis/guides/tax-benefits-kr',
  taxBenefitsUs: '/analysis/guides/tax-benefits-us',
  capitalGainsTax: '/analysis/guides/capital-gains-tax',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: buildAlternates(locale, '/analysis/guides') };
}

export default async function GuidesIndexPage() {
  const t = await getTranslations('guides');
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-xl font-semibold text-gray-900">{t('indexTitle')}</h1>
      <p className="mb-6 text-sm text-gray-600">{t('indexDescription')}</p>
      <div className="space-y-3">
        {SLUGS.map((slug) => (
          <Link
            key={slug}
            href={HREFS[slug]}
            className="card block hover:border-brand-300 hover:shadow-sm"
          >
            <h2 className="mb-1 text-base font-medium text-gray-900">{t(`list.${slug}.title`)}</h2>
            <p className="text-sm text-gray-600">{t(`list.${slug}.summary`)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
