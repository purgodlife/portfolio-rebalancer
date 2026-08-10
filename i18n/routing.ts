import { defineRouting } from 'next-intl/routing';

// 언어 추가는 이 배열에 로케일 코드만 추가하면 됨 (예: 'ja' 추가 시 messages/ja.json 생성)
export const routing = defineRouting({
  locales: ['ko', 'en'],
  defaultLocale: 'ko',
});

export type AppLocale = (typeof routing.locales)[number];
