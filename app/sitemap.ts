import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';

/**
 * 검색엔진(구글 서치콘솔·네이버 서치어드바이저)에 제출할 사이트맵을
 * /sitemap.xml로 자동 생성한다. 배포 도메인이 정해지면 NEXT_PUBLIC_SITE_URL
 * 환경변수만 채우면 되고, 코드 수정은 필요 없다(값이 없으면 배포 전 로컬
 * 확인용으로 localhost를 기본값으로 쓴다).
 *
 * 새 페이지를 추가하면 이 목록(ROUTES)에도 한 줄 추가해야 사이트맵에 반영된다.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

const ROUTES = [
  '',
  '/portfolio/calculator',
  '/portfolio/accounts',
  '/portfolio/allocation',
  '/portfolio/holdings',
  '/portfolio/watchlist',
  '/records/history',
  '/records/trend',
  '/analysis/risk',
  '/analysis/tax-benefits',
  '/settings/backup',
  '/settings/disclaimer',
  '/settings/about',
  '/settings/contact',
  '/settings/privacy',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of routing.locales) {
    for (const route of ROUTES) {
      entries.push({
        url: `${SITE_URL}/${locale}${route}`,
        lastModified: now,
      });
    }
  }
  return entries;
}
