'use client';

import { useEffect, useRef, useState } from 'react';
import { searchStocks } from '@/lib/search/stockSearch';
import type { StockEntry } from '@/lib/search/stockData';
import type { Market } from '@/lib/rebalance/types';

interface StockAutocompleteProps {
  market: Market;
  value: string;
  placeholder?: string;
  className?: string;
  onChange: (value: string) => void;
  onSelect: (entry: StockEntry) => void;
}

/**
 * 티커 또는 종목명 입력창. 입력값에 맞는 종목 후보를 드롭다운으로 보여주고,
 * 하나를 고르면 onSelect로 (티커+종목명 세트) 전체가 넘어간다.
 * 한글 초성만 입력해도("ㅋ") 매칭되고, 목록에 없는 종목은 그냥 직접 입력해서 쓸 수 있다.
 */
export default function StockAutocomplete({
  market,
  value,
  placeholder,
  className,
  onChange,
  onSelect,
}: StockAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const results = open ? searchStocks(value, market) : [];
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHighlight(0);
  }, [value, market]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function pick(entry: StockEntry) {
    onSelect(entry);
    setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      <input
        className={className ?? 'input'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!results.length) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            pick(results[highlight]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {results.map((entry, idx) => (
            <li key={entry.ticker}>
              <button
                type="button"
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                  idx === highlight ? 'bg-brand-50' : 'hover:bg-gray-50'
                }`}
                onMouseEnter={() => setHighlight(idx)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(entry)}
              >
                <span className="truncate">{entry.name}</span>
                <span className="shrink-0 font-mono text-xs text-gray-400">{entry.ticker}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
