# ADR-315: Table 을 data grid 로 — 표 상태 모델 하나 (정렬 · 검색 · 필터 · 열 · 행 · 칸) 로 TanStack Table 기능 표면 전부

## Status

Accepted — 2026-11-20 (사용자 `/execute-adr 315` + [reviews/315.md](reviews/315.md) round 3 pending 0 · HIGH 0). Proposed 2026-11-20.

> **Phase 4 종결 (2026-11-21 — G4, 미해결 1 건은 사용자 결정으로 Phase 7)**: 열 조각 — 숨김 · 순서 · 고정 · 폭이 표 상태다. resolver 의 열 투영 한 곳 (`resolution/tableColumns.ts`) 이 머리글 · 모든 행의 칸 · 트랙을 같은 순서로 세우고 (선택 열 · 앞 고정 · 가운데 · 뒤 고정, colSpan 덩어리 · row header 보호), 열 조각 변경은 행 source 를 부르지 않는다. 작성 기본값 Column 「Hidden by default」 · 「Pinned」 (Canvas 도 그린다 — Builder 는 숨긴 Column 을 record 로 남겨 Layers 에서 흐리게 고른다). 고정은 가상 표 `isStickyColumn` 훅 · 비가상 CSS sticky, 경계선은 rule (`pinned-edge`). 폭은 RAC 크기 조절 끝 → `columnWidths`. 최종 사용자 조작: 열 메뉴 (S2 `ColumnWithMenu` — Column 「Allow hiding」 · 「Allow pinning」 · 「Allow filtering」, Table 「Reorder columns」; 정렬 · 정렬에 추가 · 숨기기 · 고정 · 이동 · 크기 조절 · 필터… — 항목 · 쓰기는 `runtime/tableColumnMenu.ts` 한 곳, 필터 대화상자는 lazy) · 열 선택 메뉴 (Table 「Column visibility menu」 — 메뉴 노드 `columnsOf`, **contract 75**) · 머리글 끌기 (사용자 결정 3 — react-aria `useDrag` · `useDrop`, RAC DOM 그대로) · 열 Do 8. Phase 2 · 3 에서 넘어온 것 (작성된 정렬의 머리글 표시 · Canvas 순번 · 열 필터 조작 자리 · 후보 값 소비) 도 끝났다. 검사: 변이 RED 128 (증분별 전부 RED) · 회귀 새 실패 0 (shared 2,722 · builder 9,421 통과 — 실패 7 · 12 는 착수 전 목록) · 증분마다 live (고정 Chrome · WebKit × 가상 · 비가상, 폭 기억 새로고침, 필터, 끌기 포인터 · 키보드, 작성 정렬, 열 선택 메뉴, Layers 숨김 표시). **HC4 측정에서 결함 1 을 찾아 고쳤다**: 정렬된 10,000 행 가상 표의 열 숨김 · 보이기가 CPU 4x 2,093 / 2,855 ms (정렬 706 ms) — 화면 밖 빈 행 key 의 칸 span 서명 때문에 React 가 행을 하나씩 다시 놓았다 → 572 / 587 ms. 수리 뒤 열 변경은 모두 정렬 기준선 아래 (1x 66 ~ 84 vs 정렬 210 ~ 221 ms). Phase 3 빌드 대비: 스크롤 p95 · 로드 · 힙 1.00 ~ 1.01, 정렬 클릭 단독 (6 쌍) · 스크롤 1 회 뒤 ≈ 1.00. **미해결 1 (사용자 결정 2026-11-21 → Phase 7)**: 긴 순서 (스크롤 여러 번 + 정렬 여러 번) 뒤의 정렬 클릭이 4x 에서 1.18 / 1.11 배 (5 쌍, 순서 바꿔도 같음 — HC4 ≤ 1.10 초과, 약 +110 ms) — 쌓이는 무언가로 보이며 Phase 7 A/B 가 같은 순서로 다시 잰다. 번들 Builder +8,017 · Preview +4 B (사용자 결정 6 의 Builder +8,000 을 17 B 넘음 — 보고). 사용자 결정 (2026-11-21): A/B · live 재확인 묶음 · `/cross-check` 은 Phase 7 에서 한 번에 — Canvas 기본값 `/cross-check` (G4 조건 하나) 도 그때. 상세 [breakdown §9](design/315-table-data-grid-state-model-breakdown.md).
>
> **Phase 3 종결 (2026-11-20 — G3 통과: 검색 입력 속도 기준은 사용자 결정으로 정렬 클릭 기준선)**: 검색 · 열 필터 · 후보 값. Table 「Search」 스위치가 표 앞에 SearchField 를 연결된 채 넣고 (규칙 하나 — 유도 Do `setSearchText`), 검색어는 표 상태 `search` 다. 검색 대상은 Column 「Searchable」 (기본 켜짐 — 숨겨도 그대로) 이고 「Search match」 로 「포함」 (기본) · 「유사」 (등급 6 — 한글은 자모 단위, 정렬이 없으면 등급 순) 를 표마다 고른다 (사용자 결정 2 확정). 거르기는 보기의 비교 그대로 행 번호 위에서 한다 (`collections/view/rowFilter.ts` — 정렬된 순서를 유지한 채 거르고, 이어 친 검색어는 확실히 빠진 행을 다시 비교하지 않는다). 열 필터는 표 상태 조각 (열마다 조건 하나) 으로 번역 · 실행 · 서버 판정까지 들어왔다. 서버가 쪽을 나누는 표는 요청이 담을 때만 받는다 — `body` 는 조건, `suffix` 는 endpoint 의 새 칸 「표 검색어」 와 접미사 표의 연산자 (`catalogTableSliceServable` — 줄여 보내지 않는다). 후보 값은 보기의 새 필드 `facet` (자기 조건 제외 · 비교가 같다고 보는 값은 한 후보 · 개수 = 그 후보로 거른 행 수) 이고, 「검색 · 필터」 구획에서 새로 넣는 고르기 컨트롤의 항목이 그 보기에 연결된다 (표본 20 개 고정 항목 대신). 문서 형은 더하기만 (`facet` · `searchParam`) — contract 74 그대로. 검사: 새 테스트 63 · 변이 RED 31/31 · 회귀 새 실패 0 (shared 2,691 · builder 9,385 통과 — 실패 7 · 12 건은 Phase 2 종결 때와 같은 목록) · Phase 2 빌드 대비 속도 비율 0.92 ~ 1.05 · 힙 1.00 (교대 3 쌍) · 번들 Builder +4,612 · Preview −1 B (처음 잰 +10,589 는 요청 직렬화 모듈이 첫 화면에 실린 것 — 끊고 정적 게이트) · live (Builder 패널 스위치 → Publish 에서 질의 5 를 한 글자씩 — 행 · 행 수가 따로 계산한 값과 일치, 유사 검색 동작 · 패널에서 넣은 RadioGroup 필터의 항목 51 = 「All」 + 도시 50 종, 고른 값의 행 수 일치). **검색 입력 p95 는 136 ~ 152 ms (10,000 행 1x, 교대 3 쌍 · 4x 320 ~ 376 ms) — 처음 기준 100 ms 는 넘고, 사용자 결정 (2026-11-20) 으로 바꾼 기준 「정렬 클릭 기준선」 (G0: 1x 154 ~ 169 · 4x 556 ~ 589 ms) 안이다.** 결과가 같은 글자는 72 ~ 96 ms 로 조건 안이고 (이 Phase 에서 120 ~ 128 → 72 ~ 80 으로 줄였다: 자리 같은 행 유지 · 같은 행 목록 재사용 · 보이는 행 먼저), 결과가 바뀌는 글자가 136 ~ 144 ms 다. 원인은 계산 (키당 3 ~ 6 ms) 이 아니라 행 집합이 바뀔 때 RAC collection 을 다시 짜는 비용 (정렬 클릭과 같은 부류) 이라 Gate 의 대안 「Phase 7 로」 의 Worker 로는 줄지 않는다 — 그래서 사용자가 기준을 정렬 클릭 기준선으로 맞췄다 (collection 에 두는 행 수를 줄이는 설계는 이 ADR 에 더하지 않는다). 뒤로 옮긴 것 (범위 그대로): 열 필터의 조작 자리 (열 메뉴 「필터」 · Do) 는 Phase 4 로. 상세 [breakdown §9](design/315-table-data-grid-state-model-breakdown.md).
>
> **Phase 2 종결 (2026-11-20 — G2)**: 여러 열 정렬. 정렬 구현이 하나가 됐다 (`collections/view/sortOrder.ts` — 보기의 정렬 · 표 머리글 정렬 · 작성 Row 정렬이 같은 함수, 필드 타입별 비교 (숫자 · 날짜 · 불리언 · 글자), 빈 값은 방향과 무관하게 뒤 · 열마다 앞으로 바꿀 수 있음, 열의 순위를 보관해 방향 전환 · 둘째 정렬에서 값을 다시 읽지 않는다). 표 상태의 정렬은 번역 하나 (`runtime/tableStateQuery.ts`) 로 로컬 행 순서와 서버 요청이 같이 읽고, 서버가 쪽을 나누는 표는 요청이 정렬 목록 전체를 담을 때만 여러 열 정렬을 받는다 (`catalogTableSliceServable` — `body` 는 목록, `suffix` 는 endpoint 의 「여러 정렬 받기」 를 켰을 때 쉼표 목록, 아니면 한 열 — 줄여 보내지 않는다). Preview · Publish 에서 Shift 를 누른 머리글 누름이 열을 정렬에 더하고 정렬 열에 순번이 붙는다 (`aria-sort` 는 첫 정렬만 — RAC). 새 설정: Table 「Multi-column sort」 · 「Max sort columns」 · 「Allow unsorted」, Column 「First direction」 · 「Empty values」 (기본은 전부 지금과 같음). 문서 형: 보기의 `sort` 가 목록 — **contract 74** (이전 프로젝트는 열리지 않는다). 검사: 새 테스트 34 · 변이 RED 16/16 · 회귀 새 실패 0 (shared 2,641 · builder 9,371 통과 — 실패 7 · 12 건은 착수 전과 같은 목록) · 속도 비율 0.94 ~ 1.03 · 힙 1.00 (Phase 1 빌드와 교대 3 쌍, 10,000 행 — 첫 측정이 잡은 힙 +9 MB 는 구독 하나를 같이 쓰게 고친 뒤 다시 잼) · 번들 Builder +1,732 · Preview 0 B · live (Builder 패널 스위치 → Publish 에서 Dept 클릭 · Shift + Amount → 따로 계산한 순서와 일치 · 순번 표시). 뒤로 옮긴 것 (범위 그대로): 작성된 기본 정렬의 머리글 표시 (Canvas 순번 포함) · 「정렬에 추가」 Do 는 Phase 4 로. 상세 [breakdown §9](design/315-table-data-grid-state-model-breakdown.md).
>
> **Phase 1 종결 (2026-11-20 — G1)**: 표 상태 모델 하나 (`runtime/tableState.ts` — 닫힌 형과 조각 사이 규칙) 가 세션에 들어왔다. 정렬 상태 (`tableSorts`) 가 그 안으로 옮겨졌고 쓰기 (`setTableState`) · 읽기 (`tableState`) 가 하나씩이다 — 열은 Column key 로 적고 (RAC key 는 세션 가장자리에서 바꾼다), 데이터 조각이 바뀔 때만 행을 다시 읽는다 (열 조각 쓰기의 행 source 호출 0 — 테스트가 호출 수로 막는다). 사용자 결정 1 = 「표마다 켜는 스위치」: Table 의 「Remember state」 (기본 꺼짐) 를 켜면 Publish 에서 정렬이 새로고침 뒤에도 남는다 (Builder 의 Preview 는 저장하지 않는다). 이름 없는 열의 기본 key 를 한 함수로 합쳤다 (F5). 화면 동작은 그 스위치 말고는 그대로다. 검사: 새 테스트 17 · 변이 RED 6/6 · 회귀 새 실패 0 (실패 19 건은 착수 전과 같은 목록) · 속도 비율 0.97 ~ 1.006 (변경 전 · 후 빌드 교대 3 쌍, 1x · 4x — 기준 ≤ 1.10) · 번들 Builder −3 · Preview 0 B · live (Builder 패널의 스위치 → Publish 정렬 → 새로고침, 켬 · 끔). 실행 순서 조정 (범위 그대로): 조각의 변수 · Do 노출은 그 조각의 prop 이 생기는 Phase 로, 폭을 상태로 올리는 것은 Phase 4 로, 번역 함수와 실행 자리 판정은 Phase 2 로. 상세 [breakdown §9](design/315-table-data-grid-state-model-breakdown.md).

> **Phase 0 종결 (2026-11-20 — G0)**: 기능 표 「지금」 열 재대조 (차이 2 정정 — 집계는 값 5 종 + `applied` · 줄 번호 하나). 시제품 6 은 전부 go 다 — 설치된 RAC 1.22.1 의 공개 prop · `protected` 훅 · CSS · `render` prop 만으로 Chrome 157 (판정 78) · WebKit (77) 에서 통과: 고정 열 (가상 · 비가상, 앞 · 뒤) · 행 창 위 펼침 행 (11,000 행, 빈 행 0) · 고정 행 (위 · 아래) · Shift 정렬 판정 · 열 메뉴 항목과 머리글 끌기 (포인터 · 키보드) · 칸 범위 선택. 칸 범위 선택은 VoiceOver 청취가 남아 조건부다 (G6). 시제품이 설계에 더한 것: 접힌 묶음도 자식 Row 가 collection 에 있어야 `aria-expanded` 가 붙는다 · 끝 고정과 아래 고정은 CSS `:has` + flex 채움 · 머리글과 body 의 `allowOverflow`. 기준선 (10,000 행 · production · headed Chrome): 로드 389 ms · 힙 155 MB · 정렬 클릭 154 ~ 169 ms (4x 556 ~ 589) · 스크롤 p95 16.7 ~ 25 ms (4x 108 ~ 109). 번들 (closure) Builder 1,586,066 · Preview 171,811 B. 10 만 행 화면 스레드 계산: 검색 12 ~ 56 ms · 글자 열 정렬 246 ms (1x) — 정렬 순서를 유지한 채 거르면 검색 입력은 100 ms 안이다 (Worker 판정은 G3 · G7 의 실측으로). 시제품은 순수 RAC 위에서 돈 것이고 제품의 resolver · 행 창 경로와의 결합은 Phase 4 · 5 의 일이다. 상세 [breakdown §9](design/315-table-data-grid-state-model-breakdown.md).

- 사용자 요청: `/create-adr` (2026-11-20).
- 방향을 정한 사용자 원문 (2026-11-19 ~ 20 대화 순서대로):
  - 「tankstack과 현재 table의 성능 비교 부터 해야한다 data grid기능이 되어야하기에」
  - 「https://github.com/TanStack/table.git tankstack 레퍼지토리다. 속도,개선 할수있는 코드를 찾고, 컬럼 필터링 기능과 search filter기능 sorting기능등 data table(grid) 에 필요한 모든 기능을 위한 코드 패턴 분석을 해」
  - 「4번 (전체 검색 · 여러 열 정렬 · 필터 후보 값 · 열 숨김 · 순서 · 고정) 은 범위는 tankstack이 지원하는 기능 모두.」
- 사용자가 이미 답한 확인 항목 (2026-11-20, 작성 전 질문 2 건):
  - **칸 범위 선택** — 「예외 두고 마지막 단계」: RAC Table 에 없는 칸 범위 선택을 이 ADR 에 넣고, D1 (사용자 컴포넌트는 RAC 의 접근성 동작을 그대로 쓴다) 에 Table 칸 선택 한정 예외를 둔다. Phase 0 시제품에서 키보드 · 화면 낭독기 동작을 확인한 뒤 진행하고 실패하면 그 단계만 뺀다 (결정 지점 3 — SSOT 경계 재판정).
  - **Worker 계산** — 「측정 뒤 조건부 포함」: ADR-291 Phase 4 의 보류 항목 (「재개는 새 ADR」) 을 이 ADR 의 마지막 단계로 합친다. 10 만 행에서 기준을 넘을 때만 구현하고 안 넘으면 「필요 없음」 으로 닫는다 (결정 지점 1 — ADR 통합).
- 범위는 한 ADR 이다 — 사용자 원문이 「tankstack이 지원하는 기능 모두」 를 한 `/create-adr` 로 지시했다. 앞선 ADR 이 「별도 작업」 으로 남긴 항목 중 이 ADR 이 맡는 것: 고정 열 (ADR-257 Decision 4), Worker (ADR-291 Phase 4). 맡지 않는 것: 표시 층 Autocomplete 저작 구조 (ADR-284 사용자 결정 4 — 전체 검색은 데이터 층 조건으로 한다).
- 리뷰 round 1 (2026-11-20, codex — [reviews/315.md](reviews/315.md)) 의 HIGH 3 건을 설계에 반영했다. 셋 다 「서버가 쪽을 나눠 주는 표」 에서 난 문제다.
  > H1 여러 열 정렬을 첫 정렬로 줄여 보내면 쪽의 행 집합이 틀린다 → 요청이 조각 전체를 담을 때만 실행하고, 담지 못하면 그 조각을 받지 않는다 (HC2 · Decision 3). H2 숨긴 열을 검색에서 빼면 열 숨김이 재조회를 요구한다 → 검색 대상은 가시성과 무관하다 (TanStack 도 같다 — 초안의 「TanStack 기본과 같음」 은 틀린 인용이었다). H3 서버 집계 응답에는 펼칠 원본 행이 없다 → 묶음 조회와 자식 조회 둘로 나눈다 (Decision 6). 상세는 breakdown §4.3.1 · §4.3.2 · §4.4. LOW 1 건 (Gate 집행 설명) 도 고쳤다.
- 리뷰 round 2 (2026-11-20, codex — 수리 검증) 는 round 1 의 4 건을 fixed 로 확인하고 수리에서 생긴 HIGH 1 건을 냈다. 반영했다.
  > h4 「이 묶음의 행」 · 「이 key 의 행」 을 필터 조건 (`equals` · `notExists` · `oneOf`) 으로 적으면 대소문자만 다른 값 · `null` 과 빈 글자가 섞인다 → 식별은 `where` 밖의 요청 항목 (`groupOf` · `keys`) 으로 싣고, 그 항목을 선언한 endpoint 에만 보낸다. 서버가 구현해야 하는 새 계약이다 (breakdown §4.3.3).
- 리뷰 round 3 (2026-11-20, codex) 이 h4 를 fixed 로 확인했다 — 미해결 HIGH 0 · pending 0. 설계 리뷰를 닫는다 (전제 확정 — [premise-decision-points.md](../../.claude/rules/premise-decision-points.md) 종결 계약 1).
- 아래의 새 이름 (표 상태 · 조각 이름 · Column · Table 의 새 prop) 은 제안이고 아직 구현되지 않았다. 코드 인용은 main `23b1c802b` 기준이다.

## Context

### 도메인

- **D1 (DOM · 접근성)**: 화면은 설치된 `react-aria-components` 1.22.1 의 Table · Virtualizer 를 그대로 쓴다. 이 ADR 이 D1 에 두는 예외는 칸 범위 선택 하나다 (위 사용자 답).
- **D2 (Props)**: S2 `TableView` 1.8.2 가 선언한 이름은 그대로 가져오고 (`treeColumn` · `expandedKeys` · Column `menuItems` 의 자리), S2 · design-data · v3 에 없는 것은 composition 확장으로 `d2Provenance.ts` 에 적는다.
- **D3 (시각)**: 고정 열의 경계선 · 정렬 순번 · 묶음 행 · 병합 칸 · 선택 칸의 칠은 catalog rule 이 정본이고 Canvas 와 DOM 이 같은 rule 을 읽는다.
- 데이터 계산 (필터 · 정렬 · 묶기) 은 D1 ~ D3 밖의 데이터 층이다 (ADR-284 · 291 · 310).

### 문제

고객은 대량 데이터를 정렬 · 차트 · 다중 조건 필터로 조회한다. 우리 Table 은 2026-11-19 ~ 20 작업으로 10,000 행에서 순수 RAC Table 보다 빠른 정렬 클릭 (155 ~ 170 ms 대 384 ~ 391 ms) 과 보이는 행만 계산하는 행 창을 갖췄지만, data grid 로 쓰기에는 기능이 빠져 있다. TanStack Table v9.3.1 의 기능 17 개와 대조하면 (전수 표는 [breakdown §2](design/315-table-data-grid-state-model-breakdown.md)):

- **있음 4**: 열 필터 (보기 조건 — 그리고 / 또는 묶음, 연산자 21), 열 폭 · 폭 조절, 쪽 나누기 (더 보기 · 쪽 · 가상 스크롤), 행 선택.
- **일부 6**: 전체 검색 (조건 하나가 필드 여러 개를 읽을 수 있으나 「이 표의 모든 열」 이 없고 유사 검색 없음), 정렬 (한 열만 · 날짜를 글자로 비교), 필터 후보 값 (작성 때 20 개까지 · 실행 중 없음), 묶기 · 집계 (결과가 새 표가 되고 표 안의 묶음 행이 아님 · 값 집계 5 종 + `applied`), 칸 병합 (`colSpan` 만), 서버 처리 (조건 · 정렬 하나 · 쪽).
- **작성 때만 2**: 열 순서 · 열 숨김 (문서의 Column 노드를 옮기거나 끄는 것 — 최종 사용자가 바꿀 수 없음).
- **없음 5**: 열 고정, 행 펼침, 행 고정, 칸 범위 선택, Worker 계산.

상태의 자리도 기능마다 다르다 — 머리글 정렬은 세션의 `tableSorts` Map, 폭은 RAC 내부 상태와 CSS 변수, 선택은 controlled prop, 쪽은 query unit, 필터는 페이지 변수. 기능 13 개를 지금 방식으로 하나씩 붙이면 상태 자리가 13 개 더 생긴다.

### 코드 사실 (2026-11-20 실측)

- **F1 정렬은 한 열이다.** RAC `sortDescriptor` 는 `{column, direction}` 하나이고 (`@react-types/shared` `collections.d.ts:90-102`), 보기의 `ViewSort` 도 `{field, direction}` 하나 또는 변수 하나다 (`packages/shared/src/catalog/document/types.ts` `ViewSort`). 세션은 `tableSorts: Map<string, CatalogTableSort>` 에 표마다 하나를 둔다 (`catalogPreviewSession.ts:565`).
- **F2 정렬 비교는 필드 타입을 읽지 않는다.** `catalogTableSortCompare` 는 숫자끼리는 뺄셈, 나머지는 숫자 인식 collator 의 글자 비교다 (`tableSort.ts:65-71`). 머리글 정렬 · 보기 정렬 · min · max 집계가 같은 함수를 쓰고, 날짜 순서를 아는 비교는 필터 조건에만 있다 (`comparison.ts` `order`).
- **F3 데이터 계산은 평가기 하나다.** 조건 · 묶기 · 집계 · 정렬은 `runViewQueries` (`collections/view/evaluate.ts:600`) 가 Canvas · Preview · Publish 에서 같이 돌고, 서버로 나가는 요청은 `serializeViewQueries` 가 같은 보기에서 만든다 (`serialize.ts` — body 형식 `{ where, sort, group, page, total }`, 정렬은 `sort?: { field, direction }` 하나 `:135`).
- **F4 정렬 · 자르기 순서.** 머리글 정렬은 데이터 층에서 원본 행 번호를 정렬한 뒤 (`sortedRowOrder`, `dataBinding.ts:473`) 창 · 쪽으로 자른다. 가상 Table 은 보이는 행만 record 가 된다 — 새 기능은 「모든 행의 record 가 있다」 고 가정할 수 없다 ([data-interaction.md](../../.claude/rules/data-interaction.md) 행 창).
- **F5 열은 작성 노드다.** Column 은 문서 노드이고 필드와는 `resolveTableColumnKey` 로 잇는다 (`props.key` → 라벨 소문자 → `props.id` → `col${index}`, `resolveCollectionItems.ts:697`). 명령 쪽 기본 key 는 `column${index+1}` 이라 (`commands/collections.ts:906`) 두 기본값이 다르고, `key` 가 없으면 라벨을 고칠 때 필드 연결이 바뀐다.
- **F6 RAC 가 주는 것** (1.22.1 설치본, [breakdown §3](design/315-table-data-grid-state-model-breakdown.md)): 한 열 정렬 · 폭 조절 · 행 선택 · **펼침 행** (`treeColumn` · `expandedKeys` · 중첩 `Row` · `hasChildItems`, `UNSTABLE_` 아님 — `useTableState.d.ts:27,56,60`) · Cell `colSpan` · 행 끌어 놓기 · 더 불러오기 · `TableFooter` · 가로 열 가상화 · 칸 단위 키보드 focus.
- **F7 RAC 가 주지 않는 것**: 여러 열 정렬, 최종 사용자의 열 순서 변경, 열 고정의 공개 prop, 행 고정, `rowSpan`, 머리글 묶음 (RAC `Column` 은 leaf), 칸 범위 선택. 열을 빼는 것은 Column 을 collection 에서 빼는 것이고 두 불변식이 있다 — `isRowHeader` 열이 하나 이상 (`Table.mjs:145`), 행의 칸 수 = 열 수 (colSpan 합, `Table.mjs:117`). 어기면 throw 다.
- **F8 열 고정의 길이 있다.** `TableLayout.isStickyColumn(node)` 은 `protected` 훅이고 (`TableLayout.d.ts:66`, 기본 false — `TableLayout.mjs:232`) 고정 열과 row header 열은 가로 가상화에서 늘 남는다 (`:78`). S2 는 이 훅을 `node.props.isSticky` 로 덮는다 (`TableView.tsx:339-340` — `Cell isSticky` 는 `@private`). 우리는 이미 `TableLayout` 을 상속한다 (`CatalogTableLayout`, `catalogVirtualizer.components.tsx:132`).
- **F9 S2 열 메뉴.** S2 `Column` 은 `menuItems` 로 메뉴 항목을 받는다 (`TableView.tsx:772` — 기본 항목은 오름차순 · 내림차순 · 크기 조절). 우리 DOM 은 크기 조절 가능한 Column 을 메뉴 Button 으로 감싼다 (`domBinding.runtime.ts:5390`).
- **F10 Worker 없음.** 행 계산에 `new Worker` 는 없다. 대신 정렬 순서 캐시 (`Uint32Array`) 와 행 창이 있다. 로컬 조회 상한은 `VIEW_LOCAL_LOAD_CAP = 10_000` (`serialize.ts:49`).
- **F11 기준선** (production · headed Chrome 120 Hz · 열 6, 2026-11-20 `23b1c802b`): 10,000 행 정렬 클릭 155 ~ 170 ms (CPU 4x 0.55 ~ 0.58 s), 로드 0.40 s, 힙 155 MB, 스크롤 p95 16.8 ~ 25 ms (4x 115 ~ 117 ms). 「포함」 필터 10,000 행 × 필드 3 은 2.7 ~ 5 ms, 100,000 행 33 ~ 57 ms (node). 하니스 `apps/builder/scripts/datagrid-table-vs-tanstack-live.mjs`.
- **F12 TanStack 자체의 약점** (같은 날 실측, 그대로 옮기지 않을 것): 글자 정렬이 비교할 때마다 소문자 변환 (`sortFns.ts` `resolveDataValue` — 관리자 기록 `perf-skipped.md` #78), 전체 검색이 행마다 객체 2 개 생성, 검색어를 이어 칠 때 이전 결과에서 좁히지 않음.

### 선행 결정

| ADR                                                                                                                                       | 이 ADR 이 따르는 것                                                                                    | 이 ADR 이 바꾸는 것                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| [257](completed/257-table-column-tracks.md)                                                                                               | 트랙 목록 하나 · 행마다 grid · `colSpan` · 정렬 / 폭 결과는 실행 상태이고 문서에 쓰지 않음             | Decision 4 의 「고정 열은 별도 작업」 을 여기서 한다. 실행 상태의 브라우저 기억은 사용자 결정 1                       |
| [284](completed/284-data-view-filter-sort-group-query.md)                                                                                 | 보기 + 닫힌 어휘 · 평가기 하나 · 자유 코드 없음 · 정렬 변수가 있으면 변수가 소유                       | `ViewSort` 를 목록으로 넓힌다. 「묶기 · 집계는 파생 보기에서만」 에 표 안 묶음 행 (같은 평가기의 표시 방식) 을 더한다 |
| [291](completed/291-data-query-vocabulary-computed-fields.md)                                                                             | 계산 필드 보기는 로컬 · 상한 · Canvas 에 엔진 없음                                                     | Phase 4 Worker 보류를 조건부로 재개한다 (사용자 답)                                                                   |
| [294](completed/294-component-event-variable-properties.md)                                                                               | 컴포넌트 상태는 변수로 읽고 Do 로 바꾼다                                                               | 표 상태 조각을 같은 방식으로 내놓는다                                                                                 |
| [310](completed/310-collection-item-repeat-marker.md)                                                                                     | 열은 작성 노드 (동적 열 기각) · `rowDisplay` · 행 창 · 고정 Row 는 정렬 · 필터 대상 아님               | 없음                                                                                                                  |
| [280](completed/280-interactions-rac-surface-registry-controlled-runtime.md) · [287](completed/287-interactions-do-from-reference-api.md) | RAC 상태는 첫 렌더부터 controlled · 실행 중 값은 저장하지 않음 · RAC 상태의 두 번째 소유자를 두지 않음 | 없음                                                                                                                  |
| [212](completed/212-data-panel-editor-redesign.md)                                                                                        | Builder 패널 격자에서 TanStack · AG Grid · Glide 기각 (접근성 모델 둘 · 번들)                          | 없음 — 같은 이유가 사용자 Table 에도 선다                                                                             |

fork 4 질문 (이 ADR 은 기존 ADR 의 분리가 아니라 새 범위지만 선행 관계를 고정한다):

1. base / 응용 — ADR-284 (보기 어휘) · 310 (반복 · 행 창) 이 base 이고 이 ADR 은 그 위의 응용이다.
2. schema 직교성 — 표 상태는 보기 어휘의 specialization 이다 (데이터 조각은 `ViewQuery` 로 번역된다). 열 · 행 · 칸 조각은 보기 어휘와 직교한다.
3. 선행 전제 — 「정렬 결과는 문서에 쓰지 않는다」 (257) · 「평가기 하나」 (284) 를 그대로 둔다. 뒤집는 것은 위 표의 「바꾸는 것」 뿐이다.
4. 전제 검증은 이 문서의 사용자 답 2 건과 사용자 결정 목록에서 끝낸다 — 판독 라운드로 미루지 않는다.

### 레퍼런스 (2026-11-20)

- **TanStack Table v9.3.1** (`packages/table-core/src/features/` 17 디렉터리 + worker plugin): 상태 조각마다 형이 하나 (`SortingState = {id, desc}[]` · `ColumnFiltersState = {id, value}[]` · `Record<id, boolean>` · `string[]` · `{start, end}` · `{top, bottom}` · `CellSelectionRange[]`) 이고 row model 이 단계로 이어진다 (core → filtered → grouped → sorted → expanded → paginated). 칸 범위 선택 · 칸 병합은 v9 새 기능, Worker row model 만 experimental.
- **S2 TableView 1.8.2**: 열 메뉴 (`menuItems`) · 펼침 행 · `EditableCell` · 고정은 내부 전용.
- **RAC 1.22.1**: F6 · F7.

### Hard constraints

- **HC1 RAC DOM 그대로.** Table · Row · Cell · Column 의 DOM 을 다시 쓰지 않는다. RAC 가 주지 않는 기능은 공개 prop · `protected` 훅 (`isStickyColumn`) · CSS · 우리가 그리는 자식 요소로만 한다. 예외는 칸 범위 선택의 ARIA · 키보드 하나이고 그 범위는 [breakdown §5.6](design/315-table-data-grid-state-model-breakdown.md) 에 적은 속성 · 키로 닫는다.
- **HC2 평가기 하나.** 표 상태의 데이터 조각 (검색 · 열 필터 · 정렬 · 묶기) 은 `ViewQuery` 로 번역되어 `runViewQueries` 와 `serializeViewQueries` 를 지난다. 두 번째 필터 · 정렬 구현을 두지 않는다 — 같은 상태는 로컬과 서버에서 같은 행을 낸다. 서버가 쪽을 나눠 주는 표는 요청이 조각 전체를 담을 때만 그 조각을 실행한다: 일부만 보내고 받은 쪽에서 메우지 않으며, 담지 못하는 조각은 상태에 들어가지 않는다 (쪽을 자르는 것이 서버라 덜 보낸 정렬 · 조건은 복구할 수 없다).
- **HC3 행 창.** 어떤 조각도 모든 행의 record 를 요구하지 않는다. 정렬 · 필터 · 묶기 · 고정 행 계산은 자르기 전 데이터 층에서 원본 행 번호로 한다.
- **HC4 속도 — 뒤로 가지 않는다.** (2026-11-21 사용자 결정: Phase 5 · 6 의 A/B 는 Phase 7 에서 한 번에 — 아래 사용자 결정 목록.) F11 의 같은 하니스 · 같은 문서 · 조각 기능을 끈 arm 과 켠 arm 교대 측정에서 정렬 클릭 · 로드 · 힙 · 스크롤 p95 의 비율 ≤ 1.10 (1x · 4x 둘 다). 새 조작의 상한: 10,000 행에서 검색 글자 입력 → 화면 반영 p95 · 열 숨김 · 순서 · 고정 변경 ≤ 정렬 클릭 기준선 (검색 입력은 처음에 「p95 ≤ 100 ms (1x)」 였다 — 2026-11-20 사용자 결정으로 정렬 클릭 기준선에 맞췄다: 결과가 바뀌는 글자의 비용은 계산이 아니라 행 집합이 바뀔 때의 RAC collection 재구성이고 정렬 클릭과 같은 부류다, breakdown §9 Phase 3). 열 조각의 변경은 행 데이터를 다시 읽지 않는다 (행 source 호출 0 — 카운트 게이트). 열 조각은 데이터 조각의 번역에 들어가지 않는다 — 검색 대상도 열의 가시성과 무관하다.
- **HC5 번들.** ADR-201 상한 (Builder 1,435,351 · Preview 327,000 B gzip, 만료 2026-12-25). 기준선은 G0 에서 다시 잰다. 열 메뉴 · 칸 선택 · Worker 는 쓰는 표가 있을 때 읽는 lazy chunk 다. Δ 수용 범위는 사용자 결정 6.
- **HC6 문서 변환 코드 없음.** entry 형이 바뀌는 Phase 마다 `LIBRARY_CONTRACT_VERSION` (지금 73) 을 한 번 올리고 이전 번호의 문서는 열리지 않는다. 번호는 착수 때 origin/main 과 대조한다 (병렬 세션).
- **HC7 첫 렌더부터 controlled.** 표 상태에서 RAC 로 가는 값 (`sortDescriptor` · `selectedKeys` · `expandedKeys`) 은 `undefined` 를 거치지 않고 key 로 remount 하지 않는다 (data-interaction §6).
- **HC8 열은 작성 노드.** 숨김 · 순서 · 고정은 작성된 Column 노드의 집합 위에서만 동작한다. 실행 중 열을 만들지 않는다.
- **HC9 Canvas 는 기본값을 그린다.** 작성자가 정한 기본값 (기본 숨김 · 기본 고정 · 기본 정렬 · 묶음) 은 Canvas 와 DOM 이 같은 결과를 낸다. 최종 사용자가 실행 중 바꾼 값은 Preview · Publish 에만 있다 (data-interaction §5 의 설계된 비대칭).

### Soft constraints

- 사용자는 비개발자다 — 「이 열을 숨길 수 있게」 · 「검색 추가」 수준에서 켜고, 상태 조각 · 변수 이름을 직접 다루지 않아도 된다.
- Builder 의 데이터 행은 디자인 표본이다 — 행 양은 속도 우선.
- 확인 브라우저는 Chrome + WebKit, 사용자 Chrome 은 CPU 4x.
- 개발 단계다.

## Alternatives Considered

### 대안 A: TanStack Table core 를 계산 엔진으로

- 설명: `@tanstack/table-core` v9 를 Preview · Publish 세션에 넣고 상태 · row model 을 TanStack 이 소유한다. 화면은 RAC Table 그대로.
- 근거: 기능 17 개의 상태 형 · 옵션 · row model 이 이미 있다.
- 위험:
  - 기술: **HIGH** — 필터 정의가 두 벌이 된다. 우리 보기 조건 (그리고 / 또는 중첩 · 연산자 21 · 감도 · 날짜 단위, `types.ts` `ViewCondition`) 은 TanStack `{id, value}[]` + `filterFns` 18 종보다 넓고, 서버 요청은 보기에서 만든다 (`serialize.ts`). TanStack 의 결과와 `runViewQueries` (`evaluate.ts:600`) 의 결과가 같다는 보증을 따로 세워야 한다. 화면의 어려운 부분 (고정 열 · 칸 선택의 DOM) 은 TanStack 이 풀어 주지 않는다 (headless).
  - 성능: MEDIUM — F12 의 약점을 그대로 가져온다. 행 창 · 정렬 순서 캐시 (`dataBinding.ts:473`) 와 row model 이 겹친다.
  - 유지보수: **HIGH** — RAC 상태의 두 번째 소유자다 (ADR-280 이 기각한 형태). 설치된 것은 v8.21.3 이고 v9 는 구조가 다르다.
  - 마이그레이션: MEDIUM — 세션의 행 경로 (`catalogBoundRows` · `windowedRows` · `sortTable`) 를 TanStack 뒤로 옮겨야 한다.

### 대안 B: 기능마다 따로 붙이기

- 설명: 지금 방식 (`tableSorts` Map 처럼) 으로 기능마다 prop · 세션 상태 · 명령을 하나씩 더한다.
- 근거: 한 기능씩 작게 낼 수 있다.
- 위험:
  - 기술: MEDIUM — 조각이 서로 읽는 규칙 (필터가 바뀌면 첫 쪽 · 묶기 열은 정렬 앞 · 검색 대상은 가시성과 무관 · 고정 열은 순서의 앞) 이 기능 쌍마다 흩어진다.
  - 성능: MEDIUM — 조각마다 무효화 범위가 달라 「열 조각은 행을 다시 읽지 않는다」 를 한 곳에서 보장하지 못한다.
  - 유지보수: **HIGH** — 상태 자리 13 개 · 변수 노출 · 서버 번역 · Canvas 기본값 · 브라우저 기억을 기능마다 다시 만든다. 지금도 다섯 자리 (`catalogPreviewSession.ts:565` · RAC 폭 상태 · controlled prop · query unit · 페이지 변수) 다.
  - 마이그레이션: LOW.

### 대안 C: RAC · S2 가 직접 주는 것만

- 설명: 펼침 행 · 열 메뉴 · `TableFooter` 처럼 RAC · S2 에 있는 것만 넣고 나머지 (여러 열 정렬 · 열 순서 · 고정 · 행 고정 · 칸 범위 선택 · 유사 검색 · 필터 후보 값 · Worker) 는 하지 않는다.
- 근거: D1 · D2 예외가 0 이다.
- 위험:
  - 기술: LOW.
  - 성능: LOW.
  - 유지보수: LOW.
  - 마이그레이션: LOW.
- 사용자가 정한 범위 (「tankstack이 지원하는 기능 모두」) 의 절반을 채우지 못한다 — 위험이 아니라 요구 미충족이다.

### 대안 D: 표 상태 모델 하나 + 기존 평가기 · RAC 위에

- 설명: 표 instance 마다 닫힌 형의 상태 하나를 둔다 (조각: 정렬 · 전체 검색 · 열 필터 · 묶기 / 열 숨김 · 순서 · 고정 · 폭 / 펼침 · 행 고정 · 행 선택 · 쪽 / 칸 선택). 조각마다 세 층이 같다 — 작성자의 기본값과 허용 여부 (문서), 실행 중 값 (세션 한 곳), 선택적인 브라우저 기억. 데이터 조각은 `ViewQuery` 로 번역해 기존 평가기 · 서버 직렬화를 지나고 (HC2), 열 조각은 resolver 의 열 투영 (트랙 목록) 에서, 행 조각은 데이터 층의 행 번호 단계에서, 칸 조각은 DOM 층에서 적용한다. 화면은 RAC 그대로이고 RAC 에 없는 것은 HC1 의 수단으로 한다. TanStack 에서는 상태 형과 단계 순서 · 옵션 이름의 뜻만 가져오고 코드는 넣지 않는다.
- 근거: 상태 형은 TanStack 이 17 기능에 걸쳐 검증한 모양이고, 계산 · 서버 · 화면은 이미 있는 한 벌을 쓴다.
- 위험:
  - 기술: **MEDIUM** — RAC 밖 기능 다섯 (여러 열 정렬의 Shift 판정 · 고정 열 · 고정 행 · 행 병합 · 칸 범위 선택) 과 행 창 위의 펼침 행은 시제품 확인이 필요하다 (Phase 0). 실패한 기능은 그 Phase 만 빠진다.
  - 성능: MEDIUM — 조각이 늘수록 무효화가 넓어질 수 있다. HC4 의 카운트 · 교대 측정으로 막는다.
  - 유지보수: MEDIUM — 우리 코드로 17 기능을 유지한다. 상태 · 번역 · 적용 자리가 한 곳씩이라 대안 B 보다 낮다.
  - 마이그레이션: MEDIUM — contract 를 Phase 마다 올린다 (변환 없음). `tableSorts` · 폭 상태를 새 모델로 옮긴다.

### Risk Threshold Check

| 대안             |  기술  |  성능  | 유지보수 | 마이그레이션 |      HIGH+      |
| ---------------- | :----: | :----: | :------: | :----------: | :-------------: |
| A TanStack 엔진  |  HIGH  | MEDIUM |   HIGH   |    MEDIUM    |        2        |
| B 기능마다       | MEDIUM | MEDIUM |   HIGH   |     LOW      |        1        |
| C RAC · S2 만    |  LOW   |  LOW   |   LOW    |     LOW      | 0 (범위 미충족) |
| D 상태 모델 하나 | MEDIUM | MEDIUM |  MEDIUM  |    MEDIUM    |        0        |

HIGH 0 이면서 범위를 채우는 대안은 D 다. 루프 추가 없음. D 의 MEDIUM 가운데 기술 위험은 Phase 0 의 기능별 go / no-go 로, 범위 누적은 「이 Phase 를 별도 ADR 로 뺄 수 있는가」 질문으로 다뤘다 — 조각이 한 모델을 나눠 쓰므로 Phase 는 한 ADR 에 두고, Worker 만 조건부 Phase 다.

## Decision

**대안 D 를 채택한다.** 표 상태 모델 하나를 두고 TanStack Table v9 의 기능 17 개 + Worker 를 그 조각으로 구현한다. 계산은 기존 보기 평가기, 화면은 RAC Table 그대로다.

1. **표 상태** — 표 instance 마다 하나, 닫힌 형. 조각 이름과 형은 RAC · S2 에 있으면 그 이름 (`sortDescriptor` 의 목록 · `selectedKeys` · `expandedKeys`), 없으면 TanStack 의 뜻을 우리 이름으로 옮긴다. 세션의 `tableSorts` 와 폭 상태는 이 모델로 들어온다. 형 전문은 [breakdown §4](design/315-table-data-grid-state-model-breakdown.md).
2. **세 층** — 조각마다 (a) 문서: 작성자의 기본값과 「최종 사용자가 바꿀 수 있는가」, (b) 세션: 실행 중 값 (저장하지 않음 — ADR-257 · 287), (c) 브라우저 기억: 사용자 결정 1. Canvas 는 (a) 만 그린다 (HC9).
3. **데이터 조각은 보기로 번역** — 전체 검색 = 검색 가능한 열 전부를 읽는 「포함」 조건 하나, 열 필터 = 조건 항목, 여러 열 정렬 = `ViewSort` 목록, 표 안 묶기 = `groupBy` + 집계. 작성된 보기 조건과 「그리고」 로 합친다. 서버로 보내는 표는 같은 번역이 `serializeViewQueries` 로 나간다 (HC2) — 요청 형식이 조각 전체를 담을 때만이고, 담지 못하는 조각 (여러 정렬을 받지 않는 `suffix` 의 둘째 정렬 등) 은 받지 않는다. 줄여 보내지 않는다. 검색 대상은 「검색 가능」 으로 표시한 열이고 숨겨도 바뀌지 않는다. 정렬 비교는 필드 타입을 읽는다 (F2 — 날짜 · 숫자 · 글자, 빈 값 위치, 첫 방향).
4. **필터 후보 값** — 열마다 「그 열의 필터만 뺀 결과」 에서 고유 값 · 개수 · 최소 · 최대를 낸다 (TanStack faceting 의 뜻). 필터 컨트롤 (Select · CheckboxGroup · TagGroup · Slider) 의 항목 source 로 연결한다. 작성 때의 20 개 상한 (`viewAuthoring.ts:158` `ITEM_LIMIT`) 은 작성 화면의 표본에만 남는다.
5. **열 조각** — 숨김 · 순서 · 고정 · 폭. 작성된 Column 집합 위에서만 동작하고 (HC8) resolver 의 열 투영 한 곳에서 적용해 머리글 · 행 · 트랙 목록이 같은 결과를 읽는다. RAC 불변식 (F7) 은 투영이 지킨다 — row header 열은 숨길 수 없고 colSpan 이 덮는 열은 같이 움직인다. 고정은 `isStickyColumn` 훅 (가상) 과 CSS sticky (비가상) 로 한다 (F8). 최종 사용자의 조작은 S2 열 메뉴 (`menuItems` — F9) 가 기본이고 머리글 끌기는 사용자 결정 3.
6. **행 조각** — 펼침은 RAC 펼침 행 (F6) 으로 한다: 묶음 행 · 계층 데이터 · 상세 행 (열 전체 `colSpan` 의 자식 Row) 이 같은 기구다. 묶음 행 아래의 원본 행은 집계 결과에서 나오지 않는다 — 원본 행이 전부 있는 표는 평가기가 묶음별 행 번호를 내고, 서버가 쪽을 나눠 주는 표는 묶음 조회 (집계 응답) 와 펼친 묶음마다의 자식 조회 (원시 행) 둘로 한다. 자식 조회는 어느 묶음인지를 필터 조건이 아니라 식별 항목으로 싣는다 — 묶음 나누기는 값 정확 일치이고 필터 비교는 대소문자 · 빈 값을 합치기 때문이다. 고정 행의 key 조회도 같다. 이 식별 항목은 서버가 구현해야 하는 새 계약이고, 지원을 선언한 endpoint 에만 쓴다. 묶음 요청을 담지 못하는 형식은 전량 로드 (상한 10,000 — ADR-291 사용자 결정 3) 뒤 로컬로 돌고, 상한을 넘으면 거절한다. 행 고정은 데이터 층에서 위 · 아래 묶음으로 가른 뒤 sticky 로 그린다. 작성한 고정 Row (ADR-310 Decision 5) 와는 다른 것이다 — 그쪽은 문서 노드, 이쪽은 데이터 행의 실행 상태.
7. **칸 조각** — 행 병합 (`spanRows` 의 뜻) 은 **시각 병합** 이다: 이어지는 같은 값의 칸을 하나로 보이게 그리되 DOM 은 행마다 칸 그대로 (RAC 는 `rowSpan` 이 없다 — F7). 칸 범위 선택은 D1 예외로 구현한다 (사용자 답) — 범위 사각형 목록 · Shift 확장 · 복사, ARIA 는 grid 패턴의 `aria-selected` · `aria-multiselectable`. 행 선택과 동시에 켜지 않는다.
8. **Worker 는 조건부** (사용자 답) — 10 만 행에서 HC4 의 검색 입력 상한을 화면 스레드 계산으로 넘을 때만 구현한다. 구현하면 필터 · 정렬 · 묶기를 Worker 에서 하고 행 번호 배열만 받는다 (TanStack worker plugin 의 모양). 안 넘으면 측정 표와 함께 「필요 없음」 으로 닫는다.
9. **작성 화면** — Property 탭의 Collection 구획에 기능 단위 스위치 (「검색」 · 「여러 열 정렬」 · 「열 숨김 허용」 …) 를 두고, 켜면 필요한 컨트롤 (검색 칸 · 열 선택 메뉴) 을 연결된 채 넣는다 — 지금의 「검색 · 필터」 구획 (`viewAuthoring.ts` `CATALOG_FILTER_CONTROLS`) 과 같은 방식. 표 상태는 변수로 읽고 Do 로 바꿀 수 있다 (ADR-294 · 287).
10. **하지 않는 것**
    - TanStack 코드를 runtime 에 넣지 않는다 (대안 A). 설치된 v8.21.3 은 bench 전용 그대로다.
    - 실제 `rowSpan` · 머리글 묶음 (여러 줄 머리글) — RAC 가 내지 않는 DOM 이다. RAC 가 공개하면 새 ADR.
    - 동적 열 (ADR-310 기각 유지) · 자유 코드의 필터 · 정렬 함수 (ADR-284 유지 — TanStack 의 custom `filterFn` · `sortFn` 자리는 닫힌 어휘의 연산자 · 계산 필드가 맡는다).
    - Canvas 에서 최종 사용자 조작을 흉내 내지 않는다.
    - 문서 변환 코드 (HC6).

기각 사유:

- **A** — 필터 · 서버 요청이 두 벌이 되고 RAC 상태의 소유자가 둘이 된다. TanStack 이 주는 것 (상태 형 · 단계 순서) 은 코드 없이 가져올 수 있고, 주지 않는 것 (DOM) 이 어려운 부분이다. 실측으로도 계산이 병목이 아니다 (정렬 계산 약 2 ms — ADR-310 breakdown 후속 절).
- **B** — 상태 자리가 기능 수만큼 늘고 조각 사이 규칙이 흩어진다.
- **C** — 사용자가 정한 범위를 채우지 못한다.

> 구현 상세: [315-table-data-grid-state-model-breakdown.md](design/315-table-data-grid-state-model-breakdown.md)

### 사용자 결정 (7 건 — 그 Phase 에 닿을 때 묻는다)

- **결정 4 확정 (2026-11-21, Phase 5 착수 때)**: 「전부 더함」 — median · unique · uniqueCount · extent · first · last 를 표 안 묶음 · 합계 행 · 보기 집계에 같이 더한다 (집계 어휘 한 벌). 서버가 묶음을 계산하는 `body` endpoint 는 「Median · unique · extent · first · last aggregates」 를 선언했을 때만 이 집계를 받고, 아니면 전체 행을 불러와 여기서 묶는다.
- **검증 묶음은 Phase 7 에서 한 번에 (2026-11-21, Phase 4 검증 때 — 「매번 테스트 시간이 너무 길다」)**: Phase 5 · 6 은 HC4 A/B 교대 측정 · Chrome · WebKit live 재확인 묶음 (하니스 `--check-*`) · `/cross-check` 을 하지 않고, Phase 7 종결 때 Phase 0 기준선 빌드 대 최종 빌드로 한 번 잰다. Phase 마다 남는 것: 단위 테스트 · 변이 RED · type-check · 회귀 · 번들 (결정 6 의 Phase 별 Δ) · 그 Phase 가 새로 만든 동작의 live 1 회. Phase 4 는 증분마다 한 live 로 닫고 마지막 재확인 묶음 · `/cross-check` 도 Phase 7 로 옮겼다. 선택하지 않은 안: Phase 4 부터 측정 중단 · Phase 마다 전부. 대가: 성능 결함이 여러 Phase 의 변경과 섞여 나오면 원인 Phase 를 가르는 비용이 커진다 (Phase 4 의 측정에서 열 숨김 2,093 ms 결함을 찾았다 — breakdown §9).
- **결정 3 확정 (2026-11-20, Phase 4 착수 때)**: 「메뉴 + 끌기」 — 열 메뉴의 「왼쪽 · 오른쪽으로」 와 머리글 손잡이 끌기를 둘 다 넣는다.
- **G3 속도 기준 (2026-11-20, Phase 3 종결 때)**: 「정렬 클릭 기준으로」 — 검색 입력의 상한을 100 ms 에서 정렬 클릭 기준선으로 (HC4 · G3). 선택하지 않은 안: collection 설계를 Phase 7 에 추가 · Phase 7 에서 재측정만.
- **결정 2 확정 (2026-11-20, Phase 3 착수 때)**: 「표마다 선택, 기본 포함」 — 유사 검색을 넣되 표마다 「Search match」 로 고르고 기본은 「포함」 이다.
- **결정 1 확정 (2026-11-20, Phase 1 착수 때)**: 「표마다 켜는 스위치」 — 작성자가 표마다 「상태 기억」 을 켜고 기본은 꺼짐. 켠 표만 그 브라우저에 저장한다 (Builder 의 Preview 는 저장하지 않는다).

|  #  | 항목                                                                                                                                                              | 권고                                                                     | 닿는 Phase |
| :-: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | :--------: |
|  1  | 최종 사용자가 바꾼 표 상태 (정렬 · 숨긴 열 · 순서 · 고정 · 폭) 를 새로고침 뒤에도 그 브라우저에서 유지할지 — ADR-257 사용자 결정 4 · 5 는 「reload 하면 문서 값」 | 작성자가 표마다 켜는 「상태 기억」 (기본 끔)                             |     1      |
|  2  | 유사 검색 (오타 허용 · 일치 등급 순 정렬) 을 넣을지 — 한글은 자모 단위 비교라 영문과 결과 감각이 다르다                                                           | 넣되 기본은 「포함」, 유사는 표마다 선택                                 |     3      |
|  3  | 열 순서 변경의 조작 — 열 메뉴 「왼쪽 · 오른쪽으로」 만 / 머리글 끌기까지                                                                                          | 메뉴 + 끌기 (끌기는 Phase 0 시제품 통과 시)                              |     4      |
|  4  | 표 안 묶음 행의 집계 종류 — 지금 5 종 (count · sum · mean · min · max) 에 TanStack 의 median · unique · uniqueCount · extent · first · last 를 더할지             | 전부 더한다 (보기 집계에도 같이)                                         |     5      |
|  5  | 칸 범위 선택과 행 선택을 한 표에서 같이 켤 수 있게 할지                                                                                                           | 같이 켜지 않는다 (표마다 하나)                                           |     6      |
|  6  | 번들 Δ 수용 범위 — 상한 안 / 초과분 재승인                                                                                                                        | lazy chunk 로 initial Δ ≤ Preview +6,000 · Builder +8,000 B, 넘으면 보고 |  각 Phase  |
|  7  | 로컬 조회 상한 (지금 10,000 행) 을 Worker 구현 때 올릴지                                                                                                          | Worker 를 구현하면 100,000 으로, 아니면 그대로                           |     7      |

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                     | 심각도 | 대응                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | RAC 밖 기능의 시제품이 실패한다 — 고정 열 (`catalogVirtualizer.components.tsx:132` 의 `CatalogTableLayout` 에 `isStickyColumn` 추가 + 비가상 CSS sticky), 행 창 위 펼침 행 (`domBinding.runtime.ts` `catalogWindowRowChunks` 는 평평한 행을 가정), 고정 행, 여러 열 정렬의 Shift 판정 (`domBinding.runtime.ts:3519-3530` 의 `onSortChange` 는 열만 받는다), 칸 범위 선택 |  HIGH  | Phase 0 의 기능별 go / no-go (G0). no-go 인 기능은 그 Phase 에서 빼고 본문 「하지 않는 것」 에 사유를 적는다                                                                                                                                                                                                                                                                                                                                          |
| R2  | 번역이 평가기 · 서버와 어긋난다 — 표 상태 → `ViewQuery` 번역 결과가 로컬 (`evaluate.ts:600`) 과 서버 (`serialize.ts` body · suffix) 에서 다른 행을 내거나, 계산 필드 보기의 로컬 전환 (`serialize.ts:49`) 과 섞인다                                                                                                                                                      |  HIGH  | G2 · G3 · G5 — 같은 fixture 로 로컬 결과와 서버 요청을 손계산 정답과 대조. 서버 실행 표는 요청이 담는 조각만 실행한다 — 담지 못하는 조각은 받지 않고 줄여 보내지 않는다 (판정 함수 하나를 세션 · 패널 · Do 가 읽는다). 리뷰 round 1 의 반례 셋 (쪽 크기 2 의 두 열 정렬 · 검색 중 열 숨김 · 같은 집계를 내는 두 원본의 펼침) 과 round 2 의 식별 반례 셋 (대소문자만 다른 묶음 · `null` 과 빈 글자 묶음 · 대소문자만 다른 고정 key) 을 fixture 로 둔다 |
| R3  | 조각이 늘며 속도가 뒤로 간다 — 열 조각 변경이 행을 다시 읽거나 (`dataBinding.ts:180` `catalogBoundRows`), 검색 입력마다 전체 행을 다시 정렬하거나, 행 창의 chunk key (`domBinding.runtime.ts` `windowRowChunkNames`) 가 열 변경에 전부 바뀐다                                                                                                                            |  HIGH  | HC4 를 Phase 마다 잰다 (G1 ~ G7 공통 조건). 행 source 호출 수 카운트를 먼저 RED 로 둔다                                                                                                                                                                                                                                                                                                                                                               |
| R4  | 칸 범위 선택의 접근성이 RAC 의 행 선택 · 칸 focus 와 충돌한다 — RAC 는 선택을 행 key 로만 알고 (`useTableState.d.ts` `selectedKeys`) 칸의 `isSelected` 는 부모 행에서 오며, Shift + 화살표는 행 범위 확장이다. 우리 쪽 자리는 Table 의 선택 prop (`Table.binding.ts:31,63,77`) 과 DOM 의 선택 전달 (`domBinding.runtime.ts`)                                             |  HIGH  | G6 — 키보드 전 경로와 화면 낭독기 (VoiceOver) 확인. 실패하면 Phase 6 의 칸 선택만 뺀다. 예외 범위를 규칙 문서에 속성 · 키 목록으로 적는다                                                                                                                                                                                                                                                                                                             |
| R5  | contract 가 Phase 마다 올라 그 사이 프로젝트가 안 열린다 (HC6)                                                                                                                                                                                                                                                                                                           | MEDIUM | entry 형 변경을 Phase 2 · 4 · 5 세 번으로 모은다. 번호는 착수 때 origin 과 대조                                                                                                                                                                                                                                                                                                                                                                       |
| R6  | 작성자 기본값과 최종 사용자 상태가 어긋난다 — 작성자가 열을 지우거나 key 를 바꾼 뒤 기억된 상태가 없는 열을 가리킨다 (F5 의 key 기본값 불일치 포함)                                                                                                                                                                                                                      | MEDIUM | 상태는 Column key 로 적고 없는 key 는 버린다. Phase 1 에서 key 기본값을 한 함수로 합친다                                                                                                                                                                                                                                                                                                                                                              |
| R7  | 작성 화면의 스위치가 많아진다 (17 기능)                                                                                                                                                                                                                                                                                                                                  | MEDIUM | 기능 단위 묶음 (검색 · 정렬 · 열 · 행 · 칸) 으로 접고 기본은 꺼 둔다. Design 패널 속성 감사 원칙 (개발자용 속성 금지) 을 따른다                                                                                                                                                                                                                                                                                                                       |
| R8  | Canvas 의 기본값 그리기가 DOM 과 달라진다 (고정 열 경계 · 묶음 행 · 병합 칸)                                                                                                                                                                                                                                                                                             | MEDIUM | 기본값은 resolver 의 열 투영 한 곳에서 적용하고 `/cross-check` 로 Phase 마다 확인                                                                                                                                                                                                                                                                                                                                                                     |
| R9  | Worker 가 조건을 넘지 않아 구현하지 않는데 범위가 「전부」 다                                                                                                                                                                                                                                                                                                            |  LOW   | 사용자 답대로 측정 표와 함께 「필요 없음」 으로 닫는 것이 정상 종결이다                                                                                                                                                                                                                                                                                                                                                                               |

## Gates

측정 조건 (HC4 · G1 ~ G7 공통, [measurement-validity.md](../../.claude/rules/measurement-validity.md) §1): 대상은 부하용 생성 문서 (규모 전용 — 분포를 인용하지 않는다), 불리한 경우 = 값이 모두 다른 글자 열 · 가로 스크롤이 있는 열 30 개 · 원격 collection · CPU 4x, 대조군 = 같은 문서에서 기능을 끈 arm 과 교대 3 쌍, 조건 = production 빌드 · headed Chrome 120 Hz · 1x 와 4x · 측정 중 테스트 실행 없음, 기준값 = 실제 브라우저의 시간 · 손계산한 행 순서 (시스템 자신의 출력으로 채점하지 않는다).

| Gate | 시점       | 통과 조건                                                                                                                                                                                                                                         | 실패 시 대안                                                       |
| ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| G0   | Phase 0 끝 | 기능 표 (17 + Worker) 의 「지금」 열이 코드와 차이 0 · 시제품 6 (고정 열 · 행 창 위 펼침 행 · 고정 행 · Shift 판정 · 열 메뉴 항목 · 칸 범위 선택) 의 go / no-go 기록 · 기준선 (속도 · 힙 · 번들) · 10 만 행 화면 스레드 측정                      | no-go 기능은 그 Phase 에서 빼고 사용자에게 보고                    |
| G1   | Phase 1 끝 | 표 상태 한 곳 · 기존 동작 (한 열 정렬 · 폭 · 선택 · 쪽) 의 회귀 새 실패 0 · HC4 비율 ≤ 1.10 · 열 조각 변경의 행 source 호출 0                                                                                                                     | 무효화 범위를 조각별로 가른다                                      |
| G2   | Phase 2 끝 | 여러 열 정렬이 손계산 순서와 일치 (로컬 · 서버 요청 · 「더 보기」 · 「쪽」 · 가상) · 여러 정렬을 담지 못하는 형식에서 둘째 정렬이 상태에 들어가지 않음 · 날짜 · 숫자 · 빈 값 fixture · 원복 RED · live                                            | 그 형식의 표는 한 열 정렬로 둔다 (줄여 보내지 않는다)              |
| G3   | Phase 3 끝 | 전체 검색 · 열 필터 · 후보 값 (자기 필터 제외) 이 손계산과 일치 · 검색 입력 p95 ≤ 정렬 클릭 기준선 (10,000 행 1x · 4x — 2026-11-20 사용자 결정, 처음 기준은 100 ms) · 한글 자모 · 로케일 무작위 대조 0 불일치 · live                              | 입력 지연이 넘으면 이전 결과에서 좁히기 · 그래도 넘으면 Phase 7 로 |
| G4   | Phase 4 끝 | 열 숨김 · 순서 · 고정 · 폭 기억이 Preview · Publish 에서 동작 · 검색 중 열 숨김에서 요청 · 결과 무변경 (행 source 호출 0) · RAC 불변식 위반 throw 0 · 가로 스크롤 중 고정 열 유지 (가상 · 비가상, Chrome · WebKit) · Canvas 기본값 `/cross-check` | 고정이 no-go 면 숨김 · 순서만                                      |
| G5   | Phase 5 끝 | 묶음 행 · 집계 · 펼침 · 상세 행 · 고정 행이 손계산과 일치 (로컬 · 서버의 묶음 조회 + 자식 조회 · 전량 로드 상한 거절) · 10,000 행 가상 스크롤 blank 0 · HC4                                                                                       | 행 창 위 펼침이 no-go 면 비가상 표에서만                           |
| G6   | Phase 6 끝 | 시각 병합 · 칸 범위 선택 · 복사 · 키보드 전 경로 · VoiceOver 확인 · 규칙 문서의 예외 범위와 구현의 속성 목록 일치                                                                                                                                 | 칸 선택을 빼고 병합만                                              |
| G7   | Phase 7 끝 | Worker 조건 판정 (측정 표) · 구현했다면 화면 스레드 결과와 행 번호 배열 일치 · 번들 · 문서 · 종결 live · 사용자 확인                                                                                                                              | 조건 미달이면 구현 없이 닫음                                       |

집행: 각 Gate 의 테스트는 unit · browser project 에 두고 Phase 끝에 실행자가 `pnpm -F @composition/shared test` · `pnpm -F @composition/builder test` (browser 는 `test:parity`) 로 돌려 결과를 breakdown §9 에 적는다. `pnpm codex:preflight` 는 형식 · 타입 · 등록 검사만 돌고 pre-push hook 은 CSS 경계 검사와 조건부 성능 ratchet 만 돈다 — 둘 다 이 Gate 의 unit · browser 테스트를 대신하지 않는다. 카운트 게이트 (행 source 호출 수) 는 `pnpm gate:perf-ratchet` 수동 실행이다.

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- TanStack Table 의 기능 17 개가 표 한 모델로 들어온다 — 전체 검색 · 여러 열 정렬 · 필터 후보 값 · 열 숨김 · 순서 · 고정 · 묶음 행 · 펼침 · 행 고정 · 병합 · 칸 범위 선택.
- 상태 자리가 다섯에서 하나로 준다. 변수 노출 · 서버 번역 · 브라우저 기억 · Canvas 기본값을 조각마다 다시 만들지 않는다.
- 필터 · 정렬 구현과 서버 요청은 한 벌 그대로다.
- 정렬이 필드 타입을 읽는다 — 날짜 열이 날짜 순으로 정렬된다 (지금은 글자 순).
- 번들에 TanStack 이 들어오지 않는다.

### Negative

- 기능 17 개를 우리 코드로 유지한다.
- contract 가 세 번 오른다 — 그때마다 이전 프로젝트는 열리지 않는다.
- D1 에 Table 칸 선택 예외가 생긴다. 접근성 동작을 우리가 책임진다.
- 실제 `rowSpan` · 머리글 묶음은 들어오지 않는다.
- 서버가 쪽을 나눠 주는 표는 endpoint 형식이 담는 조각만 쓸 수 있다 — 여러 정렬 · 검색을 받지 않는 형식에서는 그 기능이 꺼진다. 묶기 · 계층은 그런 형식에서 10,000 행까지만 동작한다.
- 서버 표에서 묶음을 펼치거나 행을 고정하려면 서버가 요청 항목 둘 (`groupOf` · `keys`) 을 새로 구현해야 한다. 구현하지 않은 서버에서는 묶음 펼침이 10,000 행 전량 로드로 돌고 행 고정은 꺼진다.
- Phase 0 ~ 7 의 큰 작업이다. 추정 shared 40 ~ 55 · builder 25 ~ 35 파일 + 테스트.
