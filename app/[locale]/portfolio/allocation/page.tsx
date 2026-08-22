import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/seo/canonical';
import AllocationEditor from '@/components/AllocationEditor';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: buildAlternates(locale, '/portfolio/allocation') };
}

export default function PortfolioAllocationPage() {
  return <AllocationEditor />;
}
