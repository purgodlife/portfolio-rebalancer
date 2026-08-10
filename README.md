# Portfolio Rebalancer (MVP)

정기 입금액을 목표 자산배분에 맞춰 "무엇을 얼마나 매수/매도해야 하는지" 계산해주는 개인용 웹앱입니다.
서버 DB 없이 모든 데이터는 브라우저 로컬(IndexedDB)에만 저장됩니다.

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000/ko (또는 /en) 접속.

## 테스트

리밸런싱 계산 핵심 로직은 순수 함수로 분리되어 있고 Vitest로 유닛테스트가 되어 있습니다.

```bash
npm test
```

## 프로덕션 빌드

```bash
npm run build
npm start
```

## 1단계(MVP) 구현 범위

- 리밸런싱 계산기 (`lib/rebalance`): 입금액을 카테고리/종목별로 배분. "매도 포함" 옵션 시 정확히
  목표 비중에 도달하도록 재계산.
- 자산배분 설정 (`/[locale]/allocation`), 보유종목 수동 입력 (`/[locale]/holdings`)
- 로컬 저장(Dexie/IndexedDB) — `lib/storage`
- JSON 백업/복원 — `lib/storage/backup.ts` (설정 화면에서 연결 예정)
- 한국어/영어 다국어 뼈대 (`next-intl`), 상단 언어 전환 드롭다운
- 최초 접속 시 동의가 필요한 면책조항 게이트

## 다음 단계 (2차 범위)

- 실시간 시세/환율 티커, `/api/quote` Yahoo Finance pass-through 프록시
- 관심종목(워치리스트), 외부 링크(investing.com/Yahoo Finance)
- 벤저민 그레이엄 공격적 투자자 체크리스트
- 설정 화면에 백업/복원 UI 연결

## 개인정보 원칙

서버에 사용자의 포트폴리오 데이터를 저장하거나 전송하지 않습니다. 모든 데이터는 브라우저의
IndexedDB에만 저장되며, JSON 파일로 내보내기/가져오기가 가능합니다.
