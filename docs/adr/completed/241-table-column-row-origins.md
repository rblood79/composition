# ADR-241: Table 열 · 행 origin — 2차원 collection 의 origin · instance · slot 과 두 leg 열 원천 통일

## Status

Implemented — 2026-09-25 (worktree `adr-241` Phase 0~4 / G0~G5 같은 날 종결 — [실행 기록](../design/241-table-column-row-origins-breakdown.md#5-실행-기록)) · Accepted — 2026-09-25 (사용자 `/execute-adr 241` 실행 지시, Codex 리뷰 판독 1 + 수리 검증 1 종결 (round 3 이슈 0) 후 · worktree `adr-241`) · Proposed — 2026-09-24

설계 요청: 사용자 (2026-09-24) — RAC 조사 후보 중 남은 항목 "설계부터 하자" → 사용자 판정 3 ADR 분리 (239 Tree · 240 이름 영역 · **241 Table**). 전제 기록: [breakdown §1](../design/241-table-column-row-origins-breakdown.md#1-전제-확정-기록-fork-4-질문--사용자-confirm).

## Context

### 문제

RAC Table 은 두 축 collection 이다 — 열 (`TableHeader > Column`) 과 행 (`TableBody > Row`), 행의 셀 수 = 열 수 (R1). composition 에서 이 구조는 234 모델 밖에 있고, 그 전에 열 자체가 두 leg 에서 다른 곳을 읽는다.

1. **두 leg 열 원천 불일치** — Preview Table 은 TableHeader 의 Column 요소를, Canvas projection 은 `props.columns` 를 읽는다 (F3). Column 요소만 있는 Table 은 Canvas 데이터 행에 셀이 없다.
2. **instance 가 열을 가질 수 없다** — Table · TableView origin 에 slot 이 없고 (F2), quick connect 는 ref instance 에서 열을 만들지 않는다 (F5). 팔레트로 놓은 Table 은 전부 ref instance (ADR-228) 이라 사실상 자기 열을 둘 수 없다.
3. **정적 행 (TableView) 이 구조 규칙 없이 요소로만 있다** — 열을 더해도 행 셀이 따라오지 않는다 (진단 (d)).

D1 기록 (이 ADR 의 범위 밖, 사실만): Table Preview 는 RAC Table 이 아니라 TanStack `<table>` 이고 (F7), TableView 는 plain div 다 (F6). 그래서 행 상태 변형 (RAC Row render props, R3) 을 Preview 에 겹칠 경로가 없다. 렌더러의 RAC 전환은 별도 결정 대상이다.

### 3-Domain

- **D1 (관찰만)**: RAC 구조 (열 collection · 행 = 열 수만큼 셀) 를 문서 모양의 기준으로 쓴다. 렌더러 교체 없음 (위 기록).
- **D2**: 새 prop 없음. Column prop (F9) 그대로.
- **D3**: 열 · 행 · 셀 모양 = 새 origin (Components 페이지) + 기존 catalog rule. 열 원천 통일은 두 consumer 가 같은 값을 읽게 하는 대칭 수리.
- **SSOT 경계 변경 없음.** 새 노드 type · 새 저장 필드 없음.

### 코드 사실

레퍼런스 R1~~R3 · 코드 사실 F1~~F9 (경로:라인) 는 [breakdown §2 · §3](../design/241-table-column-row-origins-breakdown.md#2-레퍼런스--rac-react-aria-components1210--starter-packagesreact-aria-startersrctabletsx-read-only).

### Hard constraints

- **열 원천 하나**: 같은 Table 에서 Canvas 와 Preview 가 같은 열 (수 · 순서 · 글자 · 폭) 을 쓴다. 폭 = 유효 폭 `clamp(width ?? 150, minWidth, maxWidth)` — Preview TanStack 이 하는 clamp 를 공용 reader 가 한다.
- **바인딩 행 = 데이터** (234): 데이터 Table 의 행은 instance 로 만들지 않는다.
- **셀 = 열 대응**: 이관된 (또는 새) 정적 행의 셀 수 · 순서는 열과 같다 — 열 추가 · 삭제 · 순서 변경이 한 history 항목에서 모든 정적 행에 반영된다. 셀 수가 어긋난 행이 있는 기존 TableView 는 이관하지 않는다 (plain 그대로 — 동기화 대상 아님).
- **셀 편집 보존**: 이관 뒤 기존 셀의 글자 · 모양 편집 (행 안 · 바깥 instance `descendants`) 이 같은 셀에 적용된다 — 셀은 행 instance 자기 자식으로 노드째 옮긴다.
- **Canvas 시각 보존 이관**: 기존 TableView · 열이 있는 Table 을 열었을 때 Canvas 픽셀이 이관 전과 같다 (열 원천 통일로 바뀌는 문서 = `props.columns` 와 Column 요소가 어긋난 것 — Phase 0 실측, 그 문서는 Preview 쪽으로 맞춘다).
- **BC 수식**: 문서당 (i) Components 새 노드 — Column origin 1 · Row origin 1 (+ Cell 템플릿 1) (ii) 사용자 TableView plain Column `c` · Row `r` → ref (셀 `r × c` 는 행 instance 자기 자식 — 노드 이동, 셀 Δbyte 0) (iii) 데이터 Table Δ0 (열은 요소 그대로 — 원천만 통일). 항목당 byte 는 Phase 0 실측.
- **성능**: `scene.build` p95 증가 ≤ +1 ms · 500 행 가상화 경로 회귀 없음.

### Soft constraints

- Preview iframe / Compare Mode 는 사용자 지시 전까지 live 검증에 쓰지 않는다 — renderer unit + 사용자 확인.

## Alternatives Considered

### 대안 A: 열 원천 = Column 요소로 통일 · 열/행 origin + TableHeader/TableBody slot · 셀 구조 동기화

- 설명: Canvas 가 해석된 Column 요소에서 열 정의를 얻는다. Column · Row origin 을 두고 TableHeader (Table · TableView) · TableBody (TableView) 를 slot host 로 연다. ref instance 도 열을 가질 수 있고 quick connect 가 그 경로를 쓴다. 열 변경이 정적 행 셀을 같이 바꾼다.
- 위험: 기술 M (셀 동기화 · instance 열 채우기) / 성능 M (Column 해석이 projection 에 들어감) / 유지보수 L (열 원천 하나) / 마이그레이션 **H** (열 원천이 어긋난 기존 문서의 Canvas 가 바뀐다 · TableView ref 이관)

### 대안 B: 열 원천 = `props.columns` 로 통일 (Preview 가 따라감)

- 설명: Column 요소를 `props.columns` 로 옮기고 요소를 없앤다.
- 위험: 기술 M / 성능 L / 유지보수 **H** (열이 요소가 아니면 origin · instance · slot 을 쓸 수 없다 — 234 모델 밖으로) / 마이그레이션 H (quick connect · `ADD_COLUMN_ELEMENTS` 가 쓰는 요소 모양을 전부 바꿈)

### 대안 C: 열 origin · slot 만 — 원천 불일치 · 행 동기화는 두기

- 설명: Column origin 과 TableHeader slot 만 도입.
- 위험: 기술 L / 성능 L / 유지보수 **H** (Slot 으로 넣은 열이 Canvas 데이터 행에 안 보인다 — 발산 확대) / 마이그레이션 L

### 대안 D: 행도 데이터 Table 까지 instance 로 (행 origin 을 데이터 행에 적용)

- 설명: 바인딩 행도 Row instance 로 만든다.
- 위험: 기술 H / 성능 **H** (500 행 = 노드 500 × 셀 — 가상화 경로 파괴) / 유지보수 H (234 "바인딩 = 데이터" 위반) / 마이그레이션 H

### Risk Threshold Check

| 대안 | HIGH+                                | 판정                                                                       |
| ---- | ------------------------------------ | -------------------------------------------------------------------------- |
| A    | 마이그레이션 H                       | 바뀌는 문서 = 원천이 이미 어긋난 것 (지금 두 leg 가 다르게 그림) — G5 관리 |
| B    | 유지보수 H · 마이그레이션 H          | 요소 모델 이탈                                                             |
| C    | 유지보수 H                           | 발산 확대                                                                  |
| D    | 성능 H · 유지보수 H · 마이그레이션 H | 234 위반 · 가상화 파괴                                                     |

모든 대안이 HIGH 1 이상 → 루프 1회: 원천을 통일하지 않는 대안 (C) 은 발산을 키우므로 H 를 피할 수 없다. A 의 H 는 "지금 이미 두 leg 가 다르게 그리는 문서" 에만 걸리고, 그 문서는 Preview (사용자가 발행 결과로 보는 쪽 · 요소 정본) 에 맞춘다 — 수용.

## Decision

**대안 A**.

1. **열 원천 통일**: Canvas 는 해석된 TableHeader 의 Column 요소 (instance 상속 · 자기 열) 에서 열 정의를 얻는다 — 두 leg 가 한 reader. `props.columns` 는 legacy 폴백.
2. **열 origin**: `component-table-column` (팔레트 밖 reusable). Table · TableView origin 의 TableHeader `slot` = Column origin. "+" 는 형제와 다른 `key` 를 배정.
3. **instance 열**: Table instance 의 TableHeader 에 instance 자기 열. quick connect · `ADD_COLUMN_ELEMENTS` 가 ref instance 에서도 이 경로로 열을 만든다 (한 history 항목).
4. **정적 행**: Row origin `component-table-row` (행 모양만) · TableView TableBody `slot` = Row origin. 셀 = 행 instance 자기 자식 (Cell 템플릿 1 개 origin 으로는 2 번째 이후 셀의 경로가 없다 — 해석기는 origin 에 있는 경로에만 patch 를 붙인다). 이관은 기존 셀 노드를 id 째 옮기고, 바깥 instance 경로가 안 닿으면 전치 · 불가하면 이관 보류. **선행**: 두 해석기가 origin 안 중첩 ref 의 자기 자식을 materialize 하고 바깥 `descendants` 를 적용하도록 맞춘다 (지금 Canvas 는 버리고 Preview 는 patch 를 무시 — 새 origin 을 팔레트로 놓아도 셀이 사라지므로 이관 보류로 막을 수 없다).
5. **셀 동기화**: 열 추가 · 삭제 · 순서 변경 → 모든 정적 행의 셀 추가 · 삭제 · 순서 변경 (한 history 항목). 셀 수가 어긋난 행이 있는 TableView 는 이관 · 동기화 대상이 아니다.

기각: B 는 열을 요소 밖으로 빼 origin 모델을 못 쓴다 · C 는 발산을 키운다 · D 는 234 규칙과 가상화를 깬다.

범위 밖 (후속 결정): **Table · TableView 렌더러의 RAC 전환** (F6 · F7 — 선택 · 행 상태 변형 · 정렬 · 크기 조절의 D1 경로) · 행 상태 변형 · 열별 셀 템플릿 · 행 드래그 · TableLoadMoreItem · Table ↔ TableView 통합.

> 구현 상세: [241-table-column-row-origins-breakdown.md](../design/241-table-column-row-origins-breakdown.md)

## Risks

| ID  | 위험                                                                                                                               | 심각도 | 관리                                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------- |
| R1  | 열 원천 통일로 `props.columns` 만 있고 Column 요소가 없는 기존 Table 의 Canvas 열이 사라진다                                       |  HIGH  | G1 — `props.columns` 폴백 유지 (Column 요소 0 일 때) · Phase 0 에서 해당 문서 모양 실측                                   |
| R2  | 셀 동기화가 행마다 다른 셀 수 (진단 (d)) 문서에서 셀 글자를 잃거나, 남는 셀을 두면 셀 = 열 계약이 깨진다 (리뷰 r1 m2)              |  HIGH  | G3 · G5 — 셀 수 어긋난 TableView 는 이관 · 동기화 제외 (plain 유지, 픽셀 · 내용 불변) unit                                |
| R6  | Row ref 이관이 2 번째 이후 셀 편집 · 바깥 instance 셀 override 를 잃는다 (Cell 템플릿 1 개 origin — 리뷰 r1 h1)                    |  HIGH  | 셀 = 행 instance 자기 자식 (노드 id 째 이동) · Phase 0 진단 (f) · G5 기존 셀 편집 적용 동일 · 경로 불가 문서 이관 보류    |
| R8  | 중첩 ref 자기 자식 해석 규칙 변경이 공용 해석기라 다른 문서 (origin 안 ref 가 자기 자식을 가진 모양) 의 Canvas 를 바꾼다 (리뷰 r2) |  HIGH  | 진단 RED (g) · Phase 0 영향 문서 수 · 바뀌는 쪽은 Preview 와 맞춰지는 방향만 (G5 변경 영역) · 두 해석기 같은 unit fixture |
| R7  | `width` 만 공유하면 min/max 제한 열에서 Canvas · Preview 폭이 갈린다 (리뷰 r1 m1)                                                  |  MED   | 공용 reader 가 유효 폭 clamp · G1 제한 열 폭 비교 (진단 (e) GREEN)                                                        |
| R3  | instance 열 추가가 origin 열과 key 가 겹쳐 데이터 필드 매핑이 틀린다                                                               |  MED   | key 유일 배정 unit (G2) · quick connect 필드 key 사용                                                                     |
| R4  | Column 요소 해석이 500 행 projection 경로를 느리게 한다                                                                            |  MED   | G4 A/B (가상화 fixture)                                                                                                   |
| R5  | 렌더러가 RAC 가 아니라 (F6 · F7) 선택 · 행 상태 변형이 계속 Preview 에 없다                                                        |  MED   | 범위 밖 기록 — 별도 결정 대상으로 보고                                                                                    |

## Gates

| Gate | Phase   | 조건                                                                                                                                                                                                                                                                                                                                                          | 실패 시             |
| ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| G0   | Phase 0 | F1~~F9 재확인 · 진단 RED 7 (breakdown §4 (a)~~(g)) · 쓰기 경로 표 · 열 원천이 어긋난 문서 모양 · 이관 수식 실측                                                                                                                                                                                                                                               | 본문 개정           |
| G1   | Phase 1 | unit (원복 RED): Column 요소만 있는 Table → Canvas 데이터 행 셀 = Preview 열 (진단 (a) GREEN) · `width:80 · minWidth:120` 열의 두 leg 폭 = 120 (진단 (e) GREEN) · `props.columns` 만 있는 legacy 무변경 · live (Skia): 열 3 Table 의 셀 rect                                                                                                                  | 원천 통일 보류      |
| G2   | Phase 2 | unit (원복 RED): TableHeader Slot "+" · key 유일 · ref instance 열 추가 (quick connect 포함 — 진단 (b) GREEN) · `ADD_COLUMN_ELEMENTS` 경로 · undo 한 번 · live (Skia · store)                                                                                                                                                                                 | instance 열 보류    |
| G3   | Phase 3 | unit (원복 RED): Row Slot "+" (열 수만큼 셀) · 열 추가/삭제/순서 변경 → 모든 정적 행 셀 동기화 (한 history) · 셀 수 어긋난 TableView 이관 · 동기화 제외 · 이관 뒤 기존 셀 편집 (행 안 · 바깥 instance) 동일 (진단 (f) GREEN) · 중첩 Row ref 자기 Cell 이 두 leg 에 같은 수 · 바깥 override 적용 (진단 (g) GREEN) · live (Skia): TableView 열 추가 → 행마다 셀 | 행 origin 보류      |
| G4   | Phase 4 | 같은 세션 headed A/B (대조 arm = 241 전 빌드) · `scene.build` p95 median Δ ≤ +1 ms · fixture = 사람이 만든 모양 (Q1) · 불리 조작 (origin 편집 · 열 추가 · breakpoint · 가상화 스크롤, Q2) · 총비용 A/B (Q3)                                                                                                                                                   | 사용자 판정         |
| G5   | Phase 4 | BC: 이관 전후 Canvas 픽셀 (TableView · 열이 맞는 Table, oracle = 241 전 빌드 arm) · 원천이 어긋났던 문서는 Preview 열과 일치 · 기존 셀 override 적용 동일 · 셀 수 어긋난 TableView 무변경 · Δbyte · 재hydration Δ0 (IndexedDB 저장 층 live)                                                                                                                   | 실패 가족 이관 보류 |

### Live Exercise

실제 builder (worktree dev 서버 5182 · headed Playwright · 새 프로젝트, Compare Mode · Preview iframe 미개방 — 사용자 지시) 에서 Skia layout · scene props · store · IndexedDB 로 확인했다 (2026-09-25). Preview 채널은 unit (두 leg · TanStack `getSize()` 대조) 고정 — 사용자 확인 대상.

- `adr241-g0-probe-live.mjs` (Phase 0 → 1): Column 요소 3 + 정적 바인딩 Table — 수리 전 Column 640×3 (폭 무시) · 빈 projection 헤더 행 · 데이터 셀 0 → 수리 뒤 Column 150/120/150 = 데이터 셀 폭 · 헤더 행 없음 · page error 0.
- `adr241-phase2-live.mjs` **7/7** (Phase 2): 실제 팔레트 Table (ref instance) → Data 「New table」 Contacts → instance 자기 열 13 (Column origin ref · schema key) · Canvas 합성 Column · 데이터 셀 key = 열 key · 셀 폭 = Column 폭 · undo 1회 → 열 · 바인딩 같이 제거 · redo 복원 · Slot Fill 「Fill slot」 → 열 1 (key 유일) · undo 1회 → 그 열만 · page error 0 · dialog 0.
- `adr241-phase3-live.mjs` **5/5** (Phase 3): 팔레트 TableView instance 열 3 · 행 1 × 셀 3 (셀 x = 열 x) · TableHeader 「Fill slot」 → 열 4 · 셀 4 · undo 1회 → 3/3 · TableBody 「Fill slot」 → 행 2 × 셀 3.
- `adr241-g5-bc-live.mjs` **7/7** (Phase 4 G5, 241 전 빌드 `a2d1fe649` worktree = oracle): 사용자 plain TableView · 셀 수 어긋난 TableView · legacy `props.columns` Table · TableView instance (바깥 override) 의 rect · 글자 동일 · Column 요소 Table 은 Preview 열로 바뀜 · 재hydration Δ0 · Δbyte +828.
- `adr241-g4-perf-ab.mjs` + `adr241G4.sceneBench.test.ts` (Phase 4 G4): 위 판정 수치.
- live 에서 잡은 결함 (수리): quick connect redo 가 바인딩을 지움 (replace event 를 바인딩 전 스냅샷으로 만듦) · Column 요소 폭이 catalog `flex:1` basis `0%` 에 막힘.

## Consequences

### Positive

- Table 열이 두 leg 에서 같아진다 (지금 발산).
- 팔레트로 놓은 Table instance 가 자기 열을 가질 수 있다 — quick connect 가 instance 에서도 동작한다.
- TableView 열 · 행을 Slot "+" 로 늘리고 셀이 열을 따라온다.

### Negative

- Components 페이지 노드 3 증가.
- 선택 · 행 상태 변형 · 정렬은 렌더러 (TanStack · plain div) 가 RAC 가 아니라서 이 ADR 뒤에도 Preview 에 없다 — 별도 결정이 필요하다.
- Table 과 TableView 두 구현이 계속 공존한다.
