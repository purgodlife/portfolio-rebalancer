/**
 * 한글 초성 검색 유틸리티.
 * 예: "클로드건설" -> 초성 "ㅋㄹㄷㄱㅅ". 사용자가 "ㅋ"만 입력해도 초성이 "ㅋ"으로
 * 시작하는 종목을, "크"까지 입력하면 실제 "크"로 시작하는 종목을 찾을 수 있게 한다.
 */

const CHOSUNG_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;
const CHOSUNG_UNIT = 588; // 21(중성) * 28(종성)

const CHOSUNG_JAMO_SET = new Set<string>(CHOSUNG_LIST);

/** 한글 완성형 음절 한 글자에서 초성 자음만 뽑아낸다. 한글이 아니면 그대로 반환. */
function extractChosungChar(char: string): string {
  const code = char.charCodeAt(0);
  if (code < HANGUL_BASE || code > HANGUL_LAST) return char;
  const index = Math.floor((code - HANGUL_BASE) / CHOSUNG_UNIT);
  return CHOSUNG_LIST[index] ?? char;
}

/** 문자열 전체를 초성 문자열로 변환한다. */
export function toChosungString(text: string): string {
  return Array.from(text).map(extractChosungChar).join('');
}

/** 문자열이 (공백을 제외하고) 초성 자음으로만 이루어져 있는지 확인한다. */
export function isChosungOnly(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return Array.from(trimmed).every((ch) => ch === ' ' || CHOSUNG_JAMO_SET.has(ch));
}
