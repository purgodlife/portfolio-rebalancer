import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/seo/canonical';
import RiskDashboard from '@/components/RiskDashboard';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: buildAlternates(locale, '/analysis/risk') };
}

export default function AnalysisRiskPage() {
  return <RiskDashboard />;
}
