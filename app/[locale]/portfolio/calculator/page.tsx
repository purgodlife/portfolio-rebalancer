import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/seo/canonical';
import RebalanceCalculator from '@/components/RebalanceCalculator';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: buildAlternates(locale, '/portfolio/calculator') };
}

export default function PortfolioCalculatorPage() {
  return <RebalanceCalculator />;
}
