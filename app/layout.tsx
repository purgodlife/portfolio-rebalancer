import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Portfolio Rebalancer',
  description: '개인용 주식 포트폴리오 리밸런싱 계산기',
};

// next-intl의 [locale] 레이아웃이 언어/본문을 담당하므로,
// 이 최상위 레이아웃은 html/body 뼈대만 제공한다.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
