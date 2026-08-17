/**
 * 구글 애드센스가 요구하는 /ads.txt (IAB 표준 — "이 퍼블리셔 ID로 이 사이트에
 * 광고를 팔 권한을 준 게 맞다"는 걸 검증하는 용도). 애드센스 승인을 받고
 * 퍼블리셔 ID(pub-로 시작하는 값, AdSlot.tsx가 이미 쓰는 것과 같은
 * NEXT_PUBLIC_ADSENSE_CLIENT 환경변수)를 넣으면 자동으로 채워진다. 아직
 * 없으면 빈 파일을 200 OK로 반환한다(에러 없이 빌드·배포되게).
 *
 * 카카오 애드핏은 ads.txt를 요구하지 않는다(구글/IAB 표준이라 애드센스 전용).
 */
export async function GET() {
  const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const lines = adsenseClient ? [`google.com, ${adsenseClient}, DIRECT, f08c47fec0942fa0`] : [];
  const body = lines.length > 0 ? lines.join('\n') + '\n' : '';
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
