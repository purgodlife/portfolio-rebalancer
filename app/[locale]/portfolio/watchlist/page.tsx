import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/seo/canonical';
import Watchlist from '@/components/Watchlist';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: buildAlternates(locale, '/portfolio/watchlist') };
}

export default function PortfolioWatchlistPage() {
  return <Watchlist />;
}
