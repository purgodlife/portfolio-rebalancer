import { routing } from '@/i18n/routing';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * 구글 서치콘솔이 "사용자가 선택한 표준이 없는 중복 페이지"로 잡아내는 문제의
 * 핵심 원인은 canonical 태그 부재다(hreflang은 next-intl 미들웨어가 이미
 * Link 헤더로 자동 발급하고 있음 — 이건 그것과 별개로, 각 페이지 자신을
 * 가리키는 자기참조 canonical과, 언어별 대응 페이지를 명시하는 명확한
 * hreflang alternates <link> 태그를 HTML head에 직접 심어준다).
 *
 * @param locale 현재 페이지의 로케일
 * @param path 로케일 프리픽스를 뺀 경로(예: '/portfolio/calculator', 홈은 '')
 */
export function buildAlternates(locale: string, path: string) {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = `${SITE_URL}/${l}${path}`;
  }
  languages['x-default'] = `${SITE_URL}/${routing.defaultLocale}${path}`;

  return {
    canonical: `${SITE_URL}/${locale}${path}`,
    languages,
  };
}
