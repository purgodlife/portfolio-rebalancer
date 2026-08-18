import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

/**
 * 검색엔진 노출·소유확인용 메타데이터. verification 필드는 구글 서치콘솔·
 * 네이버 서치어드바이저에서 발급받는 코드를 넣는 곳인데, 여기서도 다른
 * 광고/외부연동 값들과 같은 원칙으로 환경변수로 뺐다 — 값이 없으면 그냥
 * 아무 태그도 안 붙으니(undefined는 Next가 알아서 생략) 코드 수정 없이
 * 배포 후 값만 채우면 된다.
 *
 * 필요한 환경변수(.env.local 또는 Vercel 프로젝트 설정):
 * - NEXT_PUBLIC_SITE_URL: 배포된 실제 주소(예: https://내사이트.vercel.app).
 *   sitemap.xml·robots.txt·Open Graph 링크에 쓰인다.
 * - NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: 구글 서치콘솔 "HTML 태그" 소유확인
 *   방식에서 주는 content 값만(전체 <meta> 태그가 아니라 content="" 안의 값만).
 * - NEXT_PUBLIC_NAVER_SITE_VERIFICATION: 네이버 서치어드바이저 소유확인 값.
 * - NEXT_PUBLIC_ADSENSE_CLIENT: 구글 애드센스 퍼블리셔 ID("ca-pub-..." 형태).
 *   이 값이 있으면 애드센스 확인 스크립트를 모든 페이지 <head>에 심는다 —
 *   애드센스는 광고 단위(슬롯) 없이도 이 스크립트만으로 사이트 소유를
 *   확인하므로, 실제 광고 표시 여부(AdSlot.tsx, NEXT_PUBLIC_ADSENSE_SLOT
 *   필요)와 별개로 여기서 독립적으로 로드한다.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;
const TITLE = 'Portfolio Rebalancer';
const DESCRIPTION = '개인용 주식 포트폴리오 리밸런싱 계산기 — 목표 자산배분에 맞춰 무엇을 얼마나 사고팔지 계산합니다. 모든 데이터는 브라우저에만 저장되며 서버로 전송되지 않습니다.';

export const metadata: Metadata = {
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    locale: 'ko_KR',
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other: process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION
      ? { 'naver-site-verification': [process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION] }
      : undefined,
  },
};

// next-intl의 [locale] 레이아웃이 언어/본문을 담당하므로,
// 이 최상위 레이아웃은 html/body 뼈대만 제공한다.
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html>
      <head>
        {ADSENSE_CLIENT && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
