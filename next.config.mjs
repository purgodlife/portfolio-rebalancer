import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// 이 프로젝트는 개인 데이터를 서버에 저장하지 않지만(CLAUDE.md 원칙), 배포된
// 사이트는 공개 인터넷에 노출되고 구글 애드센스/카카오 애드핏 광고 스크립트를
// 로드한다. 아래 보안 헤더는 (1) 광고 네트워크가 필요로 하는 도메인만
// 최소한으로 허용하고, (2) 그 외의 인라인 스크립트 주입·클릭재킹·MIME 스니핑
// 같은 일반적인 웹 공격 표면을 줄이기 위한 것이다.
const ContentSecurityPolicy = [
  "default-src 'self'",
  // Next.js 자체 인라인 스크립트(hydration) + 광고 네트워크 스크립트 허용.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.gstatic.com https://t1.daumcdn.net https://t1.kakaocdn.net https://ads.kakao.com",
  "style-src 'self' 'unsafe-inline'",
  // 광고 소재 이미지는 다양한 CDN에서 오므로 https 전체를 허용(과도하게 좁히면
  // 광고가 깨짐 — 실 서비스 운영 중 흔한 트레이드오프).
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://query1.finance.yahoo.com https://api.frankfurter.dev https://pagead2.googlesyndication.com https://*.doubleclick.net https://*.google.com https://ads.kakao.com",
  "frame-src 'self' https://*.doubleclick.net https://*.google.com https://ads.kakao.com https://t1.daumcdn.net",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: ContentSecurityPolicy },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
