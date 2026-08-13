import type { Holding } from './types';

/**
 * 매수/매도 기록(lot)이 생성된 시각을 반환한다. createdAt이 있으면 그대로 쓰고,
 * 과거 데이터(필드가 생기기 전)는 id에 박혀 있는 타임스탬프(`hold-<ts>-...`)에서 복원한다.
 */
export function lotCreatedAt(h: Pick<Holding, 'id' | 'createdAt'>): number {
  if (h.createdAt) return h.createdAt;
  const match = /^hold-(\d+)-/.exec(h.id);
  return match ? Number(match[1]) : 0;
}
