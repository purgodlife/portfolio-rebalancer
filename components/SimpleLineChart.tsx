'use client';

export interface ChartPoint {
  label: string;
  value: number;
}

/**
 * 신규 차트 라이브러리 의존성 없이 그리는 간단한 SVG 라인 차트.
 * 데이터 포인트 수가 적은(수십 개 이하) 개인 포트폴리오 추이 용도로 충분하다.
 */
export default function SimpleLineChart({
  points,
  valueFormatter,
}: {
  points: ChartPoint[];
  valueFormatter?: (v: number) => string;
}) {
  if (points.length === 0) return null;

  const width = 700;
  const height = 260;
  const padding = { top: 16, right: 16, bottom: 28, left: 64 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const values = points.map((p) => p.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values);
  const range = max - min || 1;

  const x = (i: number) =>
    padding.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => padding.top + innerH - ((v - min) / range) * innerH;

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const areaPath =
    `${linePath} L ${x(points.length - 1).toFixed(1)} ${(padding.top + innerH).toFixed(1)} ` +
    `L ${x(0).toFixed(1)} ${(padding.top + innerH).toFixed(1)} Z`;

  const fmt = valueFormatter ?? ((v: number) => v.toLocaleString());
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));

  return (
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
      <path d={areaPath} className="fill-brand-50" stroke="none" />
      <path d={linePath} fill="none" className="stroke-brand-600" strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={p.label} cx={x(i)} cy={y(p.value)} r={3} className="fill-brand-600">
          <title>{`${p.label}: ${fmt(p.value)}`}</title>
        </circle>
      ))}
      {points.map((p, i) => {
        if (i % labelEvery !== 0 && i !== points.length - 1) return null;
        return (
          <text key={`label-${p.label}`} x={x(i)} y={height - 6} textAnchor="middle" fontSize="10" className="fill-gray-400">
            {p.label}
          </text>
        );
      })}
    </svg>
  );
}
