'use client';

export interface DualPoint {
  label: string;
  /** 기준 시리즈(보통 내 포트폴리오) 지수화 값. 없으면 null. */
  a: number | null;
  /** 비교 시리즈(보통 벤치마크 지수) 지수화 값. 없으면 null. */
  b: number | null;
}

/**
 * 신규 라이브러리 의존성 없이 그리는 2개 시리즈 비교용 SVG 라인 차트.
 * 값이 없는 구간(null)은 선을 끊고 건너뛴다.
 */
export default function DualLineChart({
  points,
  aLabel,
  bLabel,
  valueFormatter,
}: {
  points: DualPoint[];
  aLabel: string;
  bLabel: string;
  valueFormatter?: (v: number) => string;
}) {
  if (points.length === 0) return null;

  const width = 700;
  const height = 260;
  const padding = { top: 16, right: 16, bottom: 28, left: 56 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const allValues = points.flatMap((p) => [p.a, p.b]).filter((v): v is number => v != null);
  if (allValues.length === 0) return null;
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  const x = (i: number) =>
    padding.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => padding.top + innerH - ((v - min) / range) * innerH;

  function buildPath(key: 'a' | 'b'): string {
    let d = '';
    let started = false;
    points.forEach((p, i) => {
      const v = p[key];
      if (v == null) {
        started = false;
        return;
      }
      d += `${started ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
      started = true;
    });
    return d.trim();
  }

  const fmt = valueFormatter ?? ((v: number) => v.toFixed(1));
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64">
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + innerH} className="stroke-gray-200" />
        <line
          x1={padding.left}
          y1={padding.top + innerH}
          x2={width - padding.right}
          y2={padding.top + innerH}
          className="stroke-gray-200"
        />
        <text x={padding.left - 8} y={padding.top + 4} textAnchor="end" fontSize="10" className="fill-gray-400">
          {fmt(max)}
        </text>
        <text x={padding.left - 8} y={padding.top + innerH} textAnchor="end" fontSize="10" className="fill-gray-400">
          {fmt(min)}
        </text>

        <path d={buildPath('b')} fill="none" className="stroke-gray-400" strokeWidth="2" strokeDasharray="4 3" />
        <path d={buildPath('a')} fill="none" className="stroke-brand-600" strokeWidth="2" />

        {points.map(
          (p, i) =>
            p.a != null && (
              <circle key={`a-${p.label}`} cx={x(i)} cy={y(p.a)} r={3} className="fill-brand-600">
                <title>{`${p.label} · ${aLabel}: ${fmt(p.a)}`}</title>
              </circle>
            )
        )}
        {points.map(
          (p, i) =>
            p.b != null && (
              <circle key={`b-${p.label}`} cx={x(i)} cy={y(p.b)} r={2.5} className="fill-gray-400">
                <title>{`${p.label} · ${bLabel}: ${fmt(p.b)}`}</title>
              </circle>
            )
        )}

        {points.map((p, i) => {
          if (i % labelEvery !== 0 && i !== points.length - 1) return null;
          return (
            <text key={`label-${p.label}`} x={x(i)} y={height - 6} textAnchor="middle" fontSize="10" className="fill-gray-400">
              {p.label}
            </text>
          );
        })}
      </svg>
      <div className="mt-1 flex items-center justify-center gap-4 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 bg-brand-600" />
          {aLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 border-t-2 border-dashed border-gray-400" />
          {bLabel}
        </span>
      </div>
    </div>
  );
}
