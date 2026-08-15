'use client';

import Script from 'next/script';
import { useTranslations } from 'next-intl';

/**
 * 광고 영역(카카오 애드핏 / 구글 애드센스). 둘 다 승인 전이라 관련 환경변수가
 * 없으면 아무것도 렌더링하지 않는다 — 그래야 승인 전에도 빌드·배포가 정상
 * 동작하고, 나중에 승인받으면 코드 수정 없이 환경변수만 추가하면 된다.
 *
 * 필요한 환경변수(.env.local 또는 Vercel 프로젝트 설정 → Environment Variables):
 * - 카카오 애드핏: NEXT_PUBLIC_KAKAO_ADFIT_UNIT (필수), NEXT_PUBLIC_KAKAO_ADFIT_WIDTH,
 *   NEXT_PUBLIC_KAKAO_ADFIT_HEIGHT (선택, 기본 728x90)
 * - 구글 애드센스: NEXT_PUBLIC_ADSENSE_CLIENT, NEXT_PUBLIC_ADSENSE_SLOT (둘 다 필요)
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
  const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const adsenseSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT;

  const hasKakao = Boolean(kakaoUnit);
  const hasAdsense = Boolean(adsenseClient && adsenseSlot);

  if (!hasKakao && !hasAdsense) return null;

  return (
    <div className="mx-auto my-6 max-w-5xl px-4">
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] uppercase tracking-wide text-gray-300">{t('label')}</span>
        {hasKakao ? (
          <>
            <ins
              className="kakao_ad_area"
              style={{ display: 'none' }}
              data-ad-unit={kakaoUnit}
              data-ad-width={kakaoWidth}
              data-ad-height={kakaoHeight}
            />
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
            <Script
              async
              src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
              strategy="afterInteractive"
              crossOrigin="anonymous"
              onLoad={() => {
                try {
                  const w = window as unknown as { adsbygoogle?: unknown[] };
                  w.adsbygoogle = w.adsbygoogle || [];
                  w.adsbygoogle.push({});
                } catch {
                  // 광고 차단기 등으로 실패해도 앱 동작에는 영향 없음
                }
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
