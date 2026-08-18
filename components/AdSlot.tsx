'use client';

import { useEffect } from 'react';
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
 *   (선택, 기본 320x50) — 애드핏은 애드센스와 달리 지정한 픽셀 크기 그대로
 *   렌더링되고 자동으로 화면폭에 맞춰 줄어들지 않는다. 728x90짜리 데스크톱
 *   배너를 모바일에 그대로 띄우면 가로 스크롤이 생기므로, 모바일 전용 광고
 *   단위를 따로 만들어 이 값에 넣어야 한다(카카오 애드핏 대시보드에서 모바일
 *   배너 단위를 새로 발급받으면 됨). 모바일 전용 단위를 아직 안 만들었다면
 *   모바일 화면에서는 광고를 아예 표시하지 않는다(레이아웃이 깨지는 것보다
 *   안전).
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

  return (
    <div className="mx-auto my-6 max-w-5xl px-4">
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] uppercase tracking-wide text-gray-300">{t('label')}</span>
        {hasKakao ? (
          <>
            {/* 데스크톱 전용 고정폭 배너(md 이상에서만 표시 — 애드핏은 화면폭에
                맞춰 자동으로 줄어들지 않아 모바일에 그대로 두면 가로 스크롤이
                생긴다). */}
            <ins
              className="kakao_ad_area hidden md:block"
              style={{ display: 'none' }}
              data-ad-unit={kakaoUnit}
              data-ad-width={kakaoWidth}
              data-ad-height={kakaoHeight}
            />
            {/* 모바일 전용 단위가 있을 때만 md 미만에서 표시. 없으면 모바일에서는
                광고를 아예 안 띄운다(레이아웃이 깨지는 것보다 안전). */}
            {hasKakaoMobile && (
              <ins
                className="kakao_ad_area block md:hidden"
                style={{ display: 'none' }}
                data-ad-unit={kakaoUnitMobile}
                data-ad-width={kakaoWidthMobile}
                data-ad-height={kakaoHeightMobile}
              />
            )}
            <Script src="//t1.daumcdn.net/kas/static/ba.min.js" strategy="afterInteractive" async />
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
