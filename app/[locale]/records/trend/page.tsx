import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/seo/canonical';
import AssetTrend from '@/components/AssetTrend';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: buildAlternates(locale, '/records/trend') };
}

export default function RecordsTrendPage() {
  return <AssetTrend />;
}
