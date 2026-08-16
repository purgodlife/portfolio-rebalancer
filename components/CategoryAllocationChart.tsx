'use client';

/** 이 정도(%p) 이상 목표에서 벗어나 있으면 막대를 강조색으로 표시한다. */
const DRIFT_THRESHOLD_PP = 5;

export interface CategoryChartDatum {
  categoryId: string;
  name: string;
  currentPercent: number;
  targetPercent: number;
  projectedPercent: number;
}

/**
 * 카테고리별 현재비중·목표비중·리밸런싱 후 예상비중을 막대+표시선으로 한눈에
 * 비교하는 차트. 정확한 숫자는 바로 아래 표에서 확인할 수 있으므로, 여기서는
 * "얼마나 벗어나 있고 이번 리밸런싱으로 얼마나 가까워지는지"를 시각적으로
 * 보여주는 데 집중한다. 목표에서 5%p 이상 벗어난 카테고리는 막대 색을
 * 강조(amber)해서 눈에 바로 띄게 한다.
 *
 * recharts 등 별도 차트 라이브러리를 쓰지 않고 순수 div만으로 그린다
 * (SimpleLineChart.tsx의 SVG 라인차트와 같은 원칙 — 번들 크기를 늘리지 않고,
 * 퍼센트 기반 너비라 화면 크기와 무관하게 자연스럽게 반응형이다).
 */
export default function CategoryAllocationChart({
  data,
  currentLabel,
  targetLabel,
  projectedLabel,
}: {
  data: CategoryChartDatum[];
  currentLabel: string;
  targetLabel: string;
  projectedLabel: string;
}) {
  if (data.length === 0) return null;

  const maxScale = Math.max(
    100,
    ...data.flatMap((d) => [d.currentPercent, d.targetPercent, d.projectedPercent])
  );

  function pct(v: number): number {
    return Math.min(100, Math.max(0, (v / maxScale) * 100));
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-500" /> {currentLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-0.5 bg-gray-800" /> {targetLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-0.5 bg-green-500" /> {projectedLabel}
        </span>
      </div>
      <div className="space-y-3">
        {data.map((d) => {
          const offTarget = Math.abs(d.currentPercent - d.targetPercent) >= DRIFT_THRESHOLD_PP;
          return (
            <div key={d.categoryId}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-gray-700">{d.name}</span>
                <span className="whitespace-nowrap text-xs text-gray-400">
                  {d.currentPercent.toFixed(1)}% → {d.projectedPercent.toFixed(1)}%
                </span>
              </div>
              <div className="relative h-2.5 rounded-full bg-gray-100">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${
                    offTarget ? 'bg-amber-500' : 'bg-brand-500'
                  }`}
                  style={{ width: `${pct(d.currentPercent)}%` }}
                />
                <div
                  className="absolute inset-y-0 w-0.5 bg-gray-800"
                  style={{ left: `${pct(d.targetPercent)}%` }}
                  title={targetLabel}
                />
                <div
                  className="absolute inset-y-0 w-0.5 bg-green-500"
                  style={{ left: `${pct(d.projectedPercent)}%` }}
                  title={projectedLabel}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
