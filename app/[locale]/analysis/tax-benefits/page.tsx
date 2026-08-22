import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/seo/canonical';
import TaxBenefitCalculator from '@/components/TaxBenefitCalculator';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: buildAlternates(locale, '/analysis/tax-benefits') };
}

export default function AnalysisTaxBenefitsPage() {
  return <TaxBenefitCalculator />;
}
