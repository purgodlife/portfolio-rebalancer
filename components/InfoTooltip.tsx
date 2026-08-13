'use client';

/**
 * 헤더 옆에 붙는 "i" 아이콘. 마우스를 올리면(hover) 설명과 출처가 담긴
 * 말풍선이 뜬다. 별도 JS 상태 없이 CSS(group-hover)만으로 동작한다.
 */
export default function InfoTooltip({ text, source }: { text: string; source?: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <span
        className="flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-gray-300 text-[9px] leading-none text-gray-400 hover:border-gray-400 hover:text-gray-600"
        aria-label={text}
      >
        i
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 w-56 -translate-x-1/2 rounded-md bg-gray-800 px-2.5 py-1.5 text-xs leading-snug text-white opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100">
        {text}
        {source && <span className="mt-1 block text-[10px] text-gray-300">{source}</span>}
      </span>
    </span>
  );
}
