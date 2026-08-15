/**
 * 보유종목/관심종목 목록 검색·필터에 쓰는 아주 단순한 매칭 함수.
 * 대소문자 구분 없이 부분 문자열이 포함되는지만 확인한다(초성 검색 등은
 * 하지 않음 — 그건 StockAutocomplete의 전체 종목 데이터 검색에서만 쓴다).
 */
export function matchesQuery(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return text.toLowerCase().includes(q);
}

/** 여러 필드(티커, 종목명 등) 중 하나라도 검색어를 포함하면 true. */
export function matchesAnyQuery(fields: string[], query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => f.toLowerCase().includes(q));
}
