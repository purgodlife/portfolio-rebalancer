/**
 * 구글 애드센스가 요구하는 /ads.txt (IAB 표준 — "이 퍼블리셔 ID로 이 사이트에
 * 광고를 팔 권한을 준 게 맞다"는 걸 검증하는 용도). 애드센스 승인을 받고
 * 퍼블리셔 ID(AdSlot.tsx가 이미 쓰는 것과 같은 NEXT_PUBLIC_ADSENSE_CLIENT
 * 환경변수)를 넣으면 자동으로 채워진다. 아직 없으면 빈 파일을 200 OK로
 * 반환한다(에러 없이 빌드·배포되게).
 *
 * 주의: AdSlot.tsx의 data-ad-client·스크립트 URL은 "ca-pub-..." 형태를
 * 그대로 써야 하지만, ads.txt 표준(IAB)은 "ca-" 접두사 없는 "pub-..."
 * 형태를 요구한다. 두 곳에서 같은 값을 쓰되 여기서만 접두사를 제거해
 * 형식을 맞춘다.
 *
 * 카카오 애드핏은 ads.txt를 요구하지 않는다(구글/IAB 표준이라 애드센스 전용).
 */
export async function GET() {
  const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const publisherId = adsenseClient?.replace(/^ca-/, '');
  const lines = publisherId ? [`google.com, ${publisherId}, DIRECT, f08c47fec0942fa0`] : [];
  const body = lines.length > 0 ? lines.join('\n') + '\n' : '';
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
