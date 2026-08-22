import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/seo/canonical';
import HoldingsEditor from '@/components/HoldingsEditor';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: buildAlternates(locale, '/portfolio/holdings') };
}

export default function PortfolioHoldingsPage() {
  return <HoldingsEditor />;
}
