'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { useTranslations } from 'next-intl';

function PushAdsenseSlot() {
  useEffect(() => {
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle.push({});
    } catch {
      // 광고 차단기 등으로 실패해도 앱 동작에는 영향 없음
    }
  }, []);
  return null;
}

// Tailwind의 md 브레이크포인트(768px)와 동일하게 맞춘다.
const DESKTOP_BREAKPOINT_PX = 768;

/**
 * 카카오 애드핏 자체 스크립트(ba.min.js)는 페이지의 모든 `.kakao_ad_area`
 * 엘리먼트를 찾아 인라인 style을 직접 덮어써서 광고를 그려 넣는다. 그래서
 * 데스크톱(728x90)/모바일(320x50) 광고단위를 둘 다 DOM에 넣어두고 Tailwind의
 * `hidden md:block` 같은 CSS 클래스로만 화면크기별로 숨기면, 인라인 style이
 * 클래스보다 우선순위가 높아 스크립트가 강제로 두 단위를 모두 노출시켜
 * 버린다 — 실제로 카카오 애드핏 매체 심사에서 "모바일 접속 시 728x90이
 * 잘린 채 노출됨"이라는 사유로 보류된 원인이 이것이었다. 이를 막으려면
 * 현재 화면 크기에 맞는 <ins> 태그 딱 하나만 DOM에 존재하게 해야 한다
 * (CSS로 숨기는 게 아니라 애초에 렌더링하지 않음).
 */
function useIsDesktop(): boolean | null {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT_PX}px)`);
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}

/**
 * 광고 영역(카카오 애드핏 / 구글 애드센스). 둘 다 승인 전이라 관련 환경변수가
 * 없으면 아무것도 렌더링하지 않는다 — 그래야 승인 전에도 빌드·배포가 정상
 * 동작하고, 나중에 승인받으면 코드 수정 없이 환경변수만 추가하면 된다.
 *
 * 필요한 환경변수(.env.local 또는 Vercel 프로젝트 설정 → Environment Variables):
 * - 카카오 애드핏(데스크톱): NEXT_PUBLIC_KAKAO_ADFIT_UNIT (필수), NEXT_PUBLIC_KAKAO_ADFIT_WIDTH,
 *   NEXT_PUBLIC_KAKAO_ADFIT_HEIGHT (선택, 기본 728x90)
 * - 카카오 애드핏(모바일): NEXT_PUBLIC_KAKAO_ADFIT_UNIT_MOBILE (선택),
 *   NEXT_PUBLIC_KAKAO_ADFIT_WIDTH_MOBILE, NEXT_PUBLIC_KAKAO_ADFIT_HEIGHT_MOBILE
 *   (선택, 기본 320x50) — 모바일 전용 단위를 아직 안 만들었다면 모바일
 *   화면에서는 광고를 아예 표시하지 않는다(레이아웃이 깨지는 것보다 안전).
 * - 구글 애드센스: NEXT_PUBLIC_ADSENSE_CLIENT, NEXT_PUBLIC_ADSENSE_SLOT (둘 다 필요).
 *   `data-full-width-responsive`를 쓰므로 화면폭에 자동으로 맞춰진다(별도
 *   모바일 단위 불필요).
 * - 둘 다 설정돼 있으면 애드핏을 우선 표시한다.
 *
 * 값은 광고 단위 ID일 뿐 비밀값이 아니라서(어차피 페이지 소스에 그대로 노출됨)
 * NEXT_PUBLIC_ 접두사를 써서 클라이언트에 노출해도 안전하다.
 *
 * 배치 원칙: 이 앱은 실제 투자 판단에 쓰는 도구라 신뢰가 중요하므로, 광고는
 * 입력/계산 결과 등 핵심 기능 사이에 끼워 넣지 않고 각 페이지 맨 아래에
 * "광고" 라벨과 함께 한 곳(전역 레이아웃 하단)에만 둔다.
 */
export default function AdSlot() {
  const t = useTranslations('ads');
  const isDesktop = useIsDesktop();

  const kakaoUnit = process.env.NEXT_PUBLIC_KAKAO_ADFIT_UNIT;
  const kakaoWidth = process.env.NEXT_PUBLIC_KAKAO_ADFIT_WIDTH ?? '728';
  const kakaoHeight = process.env.NEXT_PUBLIC_KAKAO_ADFIT_HEIGHT ?? '90';
  const kakaoUnitMobile = process.env.NEXT_PUBLIC_KAKAO_ADFIT_UNIT_MOBILE;
  const kakaoWidthMobile = process.env.NEXT_PUBLIC_KAKAO_ADFIT_WIDTH_MOBILE ?? '320';
  const kakaoHeightMobile = process.env.NEXT_PUBLIC_KAKAO_ADFIT_HEIGHT_MOBILE ?? '50';
  const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const adsenseSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT;

  const hasKakao = Boolean(kakaoUnit);
  const hasKakaoMobile = Boolean(kakaoUnitMobile);
  const hasAdsense = Boolean(adsenseClient && adsenseSlot);

  if (!hasKakao && !hasAdsense) return null;

  // 화면 크기를 아직 판단하기 전(isDesktop === null, 최초 마운트 직후)에는
  // 어느 쪽 광고단위도 그리지 않는다 — 잘못된 단위가 잠깐이라도 DOM에
  // 나타났다가 스크립트에 의해 강제로 보여지는 걸 막기 위함.
  const showKakaoDesktop = hasKakao && isDesktop === true;
  const showKakaoMobile = hasKakao && hasKakaoMobile && isDesktop === false;

  return (
    <div className="mx-auto my-6 max-w-5xl px-4">
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] uppercase tracking-wide text-gray-300">{t('label')}</span>
        {hasKakao ? (
          <>
            {showKakaoDesktop && (
              <ins
                className="kakao_ad_area"
                style={{ display: 'none' }}
                data-ad-unit={kakaoUnit}
                data-ad-width={kakaoWidth}
                data-ad-height={kakaoHeight}
              />
            )}
            {showKakaoMobile && (
              <ins
                className="kakao_ad_area"
                style={{ display: 'none' }}
                data-ad-unit={kakaoUnitMobile}
                data-ad-width={kakaoWidthMobile}
                data-ad-height={kakaoHeightMobile}
              />
            )}
            {(showKakaoDesktop || showKakaoMobile) && (
              <Script src="//t1.daumcdn.net/kas/static/ba.min.js" strategy="afterInteractive" async />
            )}
          </>
        ) : (
          <>
            <ins
              className="adsbygoogle"
              style={{ display: 'block', width: '100%' }}
              data-ad-client={adsenseClient}
              data-ad-slot={adsenseSlot}
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
            <PushAdsenseSlot />
          </>
        )}
      </div>
    </div>
  );
}
