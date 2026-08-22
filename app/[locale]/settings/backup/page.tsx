import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/seo/canonical';
import SettingsPage from '@/components/SettingsPage';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: buildAlternates(locale, '/settings/backup') };
}

export default function SettingsBackupPage() {
  return <SettingsPage />;
}
