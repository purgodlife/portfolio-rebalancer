'use client';

/** 카테고리마다 순서대로 돌려쓰는 색상(도넛 링과 범례 점에 각각 씀). 8가지를
 * 넘는 카테고리는 색이 반복된다 — 개인 포트폴리오 배분은 보통 몇 개 안 되므로
 * 실용적으로 충분하다. */
const SLICE_COLORS = [
  { stroke: 'stroke-brand-500', bg: 'bg-brand-500' },
  { stroke: 'stroke-amber-500', bg: 'bg-amber-500' },
  { stroke: 'stroke-emerald-500', bg: 'bg-emerald-500' },
  { stroke: 'stroke-sky-500', bg: 'bg-sky-500' },
  { stroke: 'stroke-violet-500', bg: 'bg-violet-500' },
  { stroke: 'stroke-rose-500', bg: 'bg-rose-500' },
  { stroke: 'stroke-lime-500', bg: 'bg-lime-500' },
  { stroke: 'stroke-cyan-600', bg: 'bg-cyan-600' },
];

export interface PieChartDatum {
  categoryId: string;
  name: string;
  /** 절대값 크기(예: currentValueBase). 차트 안에서 비율로 정규화하므로
   * 원화든 다른 단위든 상관없다. */
  value: number;
}

/**
 * "지금 뭘 얼마나 들고 있는지"를 도넛 차트로 한눈에 보여준다. 목표비중·
 * 리밸런싱 후 비중과의 비교는 바로 아래 막대 차트(CategoryAllocationChart)가
 * 더 적합하다(한 줄에 현재/목표/예상 세 값을 겹쳐 보여줄 수 있어서) — 이
 * 도넛은 "현재 구성"만 보여주는 보조 차트다.
 *
 * 별도 차트 라이브러리 없이 SVG <circle>의 stroke-dasharray/dashoffset을
 * 이어붙이는 방식으로 그린다(SimpleLineChart.tsx와 같은 원칙).
 */
export default function CategoryPieChart({ data }: { data: PieChartDatum[] }) {
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0);
  if (total <= 0) return null;

  const size = 160;
  const strokeWidth = 26;
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  let cumulativeFraction = 0;
  const segments = data
    .filter((d) => d.value > 0)
    .map((d, i) => {
      const fraction = d.value / total;
      const dash = fraction * circumference;
      const offset = -cumulativeFraction * circumference;
      cumulativeFraction += fraction;
      return {
        categoryId: d.categoryId,
        name: d.name,
        percent: fraction * 100,
        dash,
        offset,
        color: SLICE_COLORS[i % SLICE_COLORS.length],
      };
    });

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={strokeWidth} className="stroke-gray-100" />
        {segments.map((s) => (
          <circle
            key={s.categoryId}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            strokeWidth={strokeWidth}
            strokeDasharray={`${s.dash} ${circumference - s.dash}`}
            strokeDashoffset={s.offset}
            className={s.color.stroke}
          />
        ))}
      </svg>
      <ul className="w-full space-y-1.5 text-sm">
        {segments.map((s) => (
          <li key={s.categoryId} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.color.bg}`} />
              <span className="truncate font-medium text-gray-700">{s.name}</span>
            </span>
            <span className="whitespace-nowrap text-gray-500">{s.percent.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
