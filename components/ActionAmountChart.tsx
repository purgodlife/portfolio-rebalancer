'use client';

export interface ActionChartDatum {
  key: string;
  primaryLabel: string;
  secondaryLabel: string;
  action: 'buy' | 'sell';
  /** 통화가 다른 종목도 공정하게 비교할 수 있도록 원화 환산 기준 금액을 쓴다. */
  amountInBaseCurrency: number;
}

/**
 * 종목별 매수/매도 금액을 막대 길이로 비교하는 차트(원화 환산 기준이라
 * 통화가 달라도 크기를 공정하게 비교할 수 있다). 정확한 금액·통화·수량은
 * 바로 아래 표에서 확인한다. 금액이 큰 순서로 정렬해서 "어디에 가장 큰
 * 변화가 생기는지"가 위쪽에 오도록 한다.
 */
export default function ActionAmountChart({
  data,
  buyLabel,
  sellLabel,
}: {
  data: ActionChartDatum[];
  buyLabel: string;
  sellLabel: string;
}) {
  if (data.length === 0) return null;

  const maxAmount = Math.max(...data.map((d) => d.amountInBaseCurrency), 1);
  const sorted = [...data].sort((a, b) => b.amountInBaseCurrency - a.amountInBaseCurrency);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-500" /> {buyLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> {sellLabel}
        </span>
      </div>
      <div className="space-y-2.5">
        {sorted.map((d) => (
          <div key={d.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate font-medium text-gray-700">
                {d.primaryLabel} <span className="font-mono text-gray-400">({d.secondaryLabel})</span>
              </span>
              <span className="whitespace-nowrap text-xs text-gray-400">
                {Math.round(d.amountInBaseCurrency).toLocaleString()} KRW
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full ${d.action === 'sell' ? 'bg-red-500' : 'bg-brand-500'}`}
                style={{ width: `${(d.amountInBaseCurrency / maxAmount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
