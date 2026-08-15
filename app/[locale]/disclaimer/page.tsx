import { redirect } from '@/i18n/navigation';

// 이 경로는 네비게이션 재구성으로 '/settings/disclaimer'(으)로 이동했다. 옛 북마크·링크가
// 계속 동작하도록 새 위치로 리다이렉트만 한다.
export default async function LegacyRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/settings/disclaimer', locale });
}
