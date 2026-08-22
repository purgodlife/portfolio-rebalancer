import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/seo/canonical';
import TransactionHistory from '@/components/TransactionHistory';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: buildAlternates(locale, '/records/history') };
}

export default function RecordsHistoryPage() {
  return <TransactionHistory />;
}
