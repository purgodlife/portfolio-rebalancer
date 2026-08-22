import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/seo/canonical';
import AccountsManager from '@/components/AccountsManager';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: buildAlternates(locale, '/portfolio/accounts') };
}

export default function PortfolioAccountsPage() {
  return <AccountsManager />;
}
