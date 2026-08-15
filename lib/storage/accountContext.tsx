'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'portfolio-rebalancer:selectedAccountId';

/** DisclaimerGate에서 최초 1회 시드하는 기본 계좌의 id. */
export const DEFAULT_ACCOUNT_ID = 'acc-default';

interface AccountContextValue {
  selectedAccountId: string;
  setSelectedAccountId: (id: string) => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

/**
 * 현재 선택된 계좌 id를 앱 전역에서 공유한다. 브라우저 localStorage에만
 * 저장되고(서버 없음), 새로고침해도 마지막으로 보던 계좌가 유지된다.
 * 카테고리/보유종목/거래내역/자산추이 등 모든 화면은 이 값을 기준으로
 * 필터링되어 계좌별로 완전히 분리된 것처럼 동작한다.
 */
export function AccountProvider({ children }: { children: ReactNode }) {
  const [selectedAccountId, setSelectedAccountIdState] = useState<string>(DEFAULT_ACCOUNT_ID);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) setSelectedAccountIdState(stored);
  }, []);

  function setSelectedAccountId(id: string) {
    setSelectedAccountIdState(id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, id);
    }
  }

  return (
    <AccountContext.Provider value={{ selectedAccountId, setSelectedAccountId }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useSelectedAccountId(): string {
  const ctx = useContext(AccountContext);
  return ctx?.selectedAccountId ?? DEFAULT_ACCOUNT_ID;
}

export function useSetSelectedAccountId(): (id: string) => void {
  const ctx = useContext(AccountContext);
  return ctx?.setSelectedAccountId ?? (() => {});
}
