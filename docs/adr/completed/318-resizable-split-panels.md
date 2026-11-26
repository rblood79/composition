# ADR-318: Resizable 분할창 컴포넌트 — 끌어서 나누는 패널 묶음 (react-aria 훅 + 닫힌 D1 예외)

## Status

Implemented — 2026-11-26 (G6 의 남은 두 항목: VoiceOver 청취 사용자 「VoiceOver 청취 확인했다」 · 사용자 확인 「adr-318 은 완료 된것 아닌가?」 — 같은 날). 승격 전 재확인: Phase 6 뒤 커밋 (`13def5364` /simplify · ADR-319 `39b277f95` 의 `canvasGesture.ts`) 을 지난 HEAD 로 `adr318-g6-live.mjs` Chrome · WebKit 7/7. 본문을 `completed/` 로 옮겼다.

Accepted — 2026-11-26 (사용자 `/execute-adr 318` + 리뷰 [reviews/318.md](../reviews/318.md) round 2 pending 0 · CRITICAL/HIGH 전부 fixed). 같은 날 `.claude/rules/ssot-hierarchy.md` §1 D1 에 승인 가리킴 줄 (「Resizable 손잡이 예외」) 을 넣었다 — 목록 전문은 Phase 6 끝에 옮긴다.

> **Phase 0 (G0) 닫힘 — 2026-11-26**: 코드 사실 F1 ~ F10 차이 0 (317 커밋으로 줄 번호만 이동) · v3 에도 분할창 없음 (`@react-spectrum/splitview` 미공개) · reui 예제 10 전부 읽음 · 시제품 P1 go (`tests/parity/adr318ResizableFlexShare.browser.test.ts` 16/16 — engine = Chrome = 식이 뜻한 크기) · P2 가상 Table go (p95 10.3 ms, 4x 10.2) · 가상 없는 1,000 행은 p95 41 ms 로 기준 밖 → 사용자 답 「그대로 실시간 · 한계로 기록」 (HC5 문구 갱신) · P3 go — 중첩 번짐 0 · iframe 위에서 놓기는 pointerdown 의 pointer capture 가 필요 (없으면 두 브라우저에서 끌기가 이어짐) · 잡는 영역 필수 · P4 Chrome 접근성 트리 go · VoiceOver 청취는 사용자 (G2 · G6). 기준선: Builder 1,634,229 · Preview 172,213 B · ratchet 은 HEAD 가 이미 block (등급 A 초과 98 — 318 전). 사용자 결정 2 · 8 확정 (권고 그대로), 6 확정 (5 %). 상세 [breakdown §9](../design/318-resizable-split-panels-breakdown.md).

> **Phase 1 (G1) 닫힘 — 2026-11-26 (contract 79 · 번들 Δ Builder +3,234 · Preview −2 B gzip — 결정 8 안)**: 세 type 등록 · 원본 (Panel · Handle · Panel) · 팔레트 · 크기 식 한 곳 (`runtime/resizablePanels.ts` — Panel 몫 · Group 방향 · Handle 두께를 파생 값으로, Canvas `styleOf` 와 DOM `authoredStyle` 이 같이). live Chrome · WebKit 14/14 (기본 · defaultSize · px 최소 · % 최대 · 세로 — Canvas = Publish = 식이 뜻한 크기). 계획과 달라진 것: 축 값은 rule `containerVariants` 가 아니라 파생 값 (Canvas 배치가 그것을 읽지 않음) · 팔레트를 Phase 6 에서 앞당김 · `requiredParts` 는 두지 않음. 상세 breakdown §9.
>
> **Phase 2 (G2) 닫힘 — 2026-11-26 (VoiceOver 청취 — 사용자 확인 2026-11-26)**: 사용자 결정 4 = 양옆 두 Panel 만. 손잡이 상호작용 (lazy — `useMove` 포인터 · `useKeyboard` 축 방향 · pointer capture · focus ring) · 실행 상태 = Panel 마다 `size`. live Chrome · WebKit 8/8 — live 가 잡은 결함 3 (형제 구독 · `aria-controls` = HTML id · T 교차점의 잡는 영역) 수리.

> **Phase 3 (G3) 닫힘 — 2026-11-26**: Panel 접기 · 펼치기 — `collapsible` · `collapsedSize` (% · px) · `isCollapsed` (S2 SideNavPanel 이름). 화면 몫 한 함수 (접힌 Panel = 접힌 크기, 나머지는 펼친 몫 비율) 를 Canvas 시작 접힘과 Preview 가 같이 씀. Enter · 더블클릭 · 끌기 임계 (min 과 접힌 크기의 가운데) · Do 3 (guard `collapsible`). live Chrome · WebKit 5/5 — live 가 잡은 결함 1 (끌기 중 옛 props 비교 — 끌기가 자기 쓰기를 들게) 수리. Do 의 live 실행은 Phase 5 에서.

> **Phase 6 (G6) 닫힘 — 2026-11-26 · VoiceOver 청취 · 사용자 확인 받아 Implemented**: 사용자 결정 3 = Canvas 의 Panel 주축 손잡이가 `defaultSize` 를 씀 (Panel 가장자리의 padding 0 손잡이보다 우선 · Handle 은 손잡이 없음). 짝 유지 명령 — 「+」 · Panel 복제 = Handle 동반, Panel 삭제 = 붙은 Handle 같이, Handle 단독 삭제 · 이동 · 복제 거절, Group 안 Panel 이동 = Handle 자리 유지로 다시 엮음 (Slot 목록에서도 Handle 제외). Design 패널 칸 라벨 번역. **HC5**: production 빌드 · 보이는 탭 · 교대 3 쌍 — 이 기기의 idle rAF 간격이 20 ms (50 Hz) 라 16.7 ms 기준 대신 idle 대비로 판정. 매 프레임 실행 상태를 쓰던 판은 이름 붙인 상태가 그 크기를 읽을 때 4x p95 100.9 ms · LoAF 1,495 (세션이 변수 쓰기마다 보기 전체를 다시 그림 — 모든 변수 쓰기에 공통인 경로) → G6 실패 시 대안대로 끌기 중 실행 상태 쓰기를 끌기 끝으로 밀어 1x · 4x p95 20.9 ms (= idle) · LoAF 0. 번들: 결정 8 고침 (위 표). D1 목록 전문을 규칙 문서로 옮김. live G1 ~ G6 Chrome · WebKit 전부 PASS.

> **Phase 5 (G5) 닫힘 — 2026-11-26**: 사용자 결정 1 = Panel 마다 숫자 (`size` % + `isCollapsed`), 결정 5 = Group 「Remember sizes」 (Publish 만). When 「Resize」 (`onSizeChange` — `onResize` 는 은퇴한 DOM 별칭이라 이름만 바꿈 · 끌기는 놓을 때 · 키는 한 단계마다) · 「Collapse change」 (Enter · 더블클릭 · 끌기 임계 — Do 의 쓰기에는 실행되지 않음, RAC 처럼). 이름 붙인 상태는 Panel record 의 실행 값을 따름. 「Remember sizes」 는 세션의 브라우저 저장소 (Table 「Remember state」 와 같은 것 — Builder Preview 에는 없음). live Chrome · WebKit 7/7 (Phase 3 에서 넘긴 Do 「Toggle collapse」 live 포함) · 원복 RED 2 (When 호출 제거 → 3 FAIL · 기억 값 제거 → 1 FAIL).

> **Phase 4 (G4) 닫힘 — 2026-11-26**: 사용자 결정 7 = pill 하나. Handle `variant` (`line` · `pill`) · `withHandle` grip — 값 한 모듈 (`document/resizableChrome.ts`) 을 DOM (`::before` · grip `span`) 과 Canvas 도형이 같이 읽음. live Chrome · WebKit 5/5 (상태별 pill 크기 · 색 · grip · focus ring) — live 가 잡은 결함 1 (끌기 중 모양이 hover 에 짐 — 선택자 우선순위) 수리.

Proposed — 2026-11-26

- 사용자 요청: `/create-adr` (2026-11-26). 방향을 정한 원문 (2026-11-25): 「https://reui.io/components/resizable 확인후 깃헙리포지토리에서 코드 체크후 우리 컴퍼넌트에도 동일한기능을 가진 컴퍼넌트를 추가해야한다」. 2026-11-26 「https://reui.io/components/resizable 분석후 설계한 것 찾아」 → `/create-adr`.
- 사용자가 이미 답한 것 (2026-11-25, 선택 질문 3):
  1. D1 처리 = 「react-aria 훅 + D1 예외」 — `react-resizable-panels` 는 들이지 않는다. **결정 지점 3 (SSOT 경계 — 사용자 컴포넌트의 D1 예외 추가) 의 확정이다.** 예외의 범위는 [breakdown §4](../design/318-resizable-split-panels-breakdown.md) 의 목록으로 닫는다.
  2. 진행 방식 = 「ADR 먼저」.
  3. 범위 = 「기본 분할, 접기 · 펼치기, pill 손잡이 모양, 크기 상태 연동」 (넷 다).
- 기존 ADR 을 나누거나 합치지 않는다 — 새 컴포넌트 계열 하나다.
- 리뷰 [reviews/318.md](../reviews/318.md) round 2 HIGH 0 · pending 0 (round 1 의 HIGH 1 · MEDIUM 3 수리 — 실행 상태 정본 = Panel · 화살표는 축 방향만 · px 접힘 식 · 규칙 가리킴 줄은 Accepted 때, LOW 3 deferred). 착수는 사용자 `/execute-adr 318`.

## Context

### 도메인

- **D1 (DOM · 접근성)**: 설치된 `react-aria-components` 1.22.1 에 분할창이 없다. 손잡이의 `role="separator"` 와 값 · 키 · 포인터를 우리가 직접 다룬다 — 사용자 컴포넌트의 D1 예외이고 (사용자 답 1), 범위는 Handle 요소 하나의 속성 · 키 · 포인터 목록으로 닫는다. 동작은 react-aria 훅 (`useMove` · `useKeyboard`) 이 맡고, 계약은 WAI-ARIA APG 의 Window Splitter 패턴을 따른다.
- **D2 (Props)**: S2 1.8.2 · design-data 에 대응 컴포넌트가 없다 (v3 는 Phase 0 확인). 정본 순서의 4 번 — composition 확장으로 `d2Provenance.ts` 에 적는다. 이름은 reui · `react-resizable-panels` 의 어휘다.
- **D3 (시각)**: Group · Panel · Handle 의 배치와 손잡이의 선 · grip · pill · 상태 칠은 catalog rule 이 정본이다. 작성 값 (기본 크기 · 최소 · 최대 · 접힘 기본) 은 Canvas 와 DOM 이 같은 결과로 그리고, 끌어 바꾼 크기는 실행 상태라 Preview · Publish 에만 있다.

### 문제

고객은 대량 데이터를 조회하는 화면을 만든다 — 목록과 상세, 필터와 표, 표와 차트를 나란히 두고 화면에서 폭을 조절하는 배치가 필요하다. 지금 frame 으로는 고정 비율 분할만 만들 수 있고, 만든 화면의 사용자가 경계를 끌어 옮길 길이 없다. reui 의 Resizable 은 이것을 Group · Panel · Handle 세 부품으로 푼다.

### 코드 사실 (2026-11-26 실측, HEAD `e8c51fa2a`)

- **F1** RAC 1.22.1 에 분할창이 없다 — 타입 선언에서 크기 조절은 Table 의 `ColumnResizer` · `ResizableTableContainer` 뿐이다.
- **F2** S2 1.8.2 `src` 에 분할창이 없고 (`Divider.tsx` · `SideNavPanel.tsx` 만 이름이 걸린다), design-data 검색 결과도 `bar-panel` · `standard-panel` 뿐이다.
- **F3** 빌더 chrome 에 같은 방식의 선례가 있다 — `apps/builder/src/builder/layout/PanelSplitter.tsx` (152 줄): `useMove` (`:65`) · `useKeyboard` (`:91`) · `role="separator"` 와 `aria-orientation` · `aria-valuenow` · `aria-valuemin` · `aria-valuemax` · `aria-controls` · `tabIndex` (`:127-135`). builder 타입을 import 하므로 `packages/shared` 에서 쓸 수 없다 — 방식만 따른다.
- **F4** 사용자 컴포넌트의 D1 예외는 지금 둘이고 둘 다 닫힌 목록이다 (`.claude/rules/ssot-hierarchy.md` §1 D1 — Table 칸 범위 선택 · TokenField 필수 · 오류). 칸 선택은 lazy 모듈을 ref 에 붙였다 뗀다 (`packages/shared/src/catalog/runtime/domRegistry.components.tsx:101-128`).
- **F5** 자유 내용을 담는 묶음 컴포넌트의 등록 선례는 Accordion > Disclosure 다 — `componentCatalog.ts:292` · `:299`, `domain/componentTraits.ts:192` (`GROUP_ITEM_TYPES`) · `:255` (owners), `catalog/nesting/requiredParts.ts:43`, `interactions/componentInteractionSpecs.ts:348-351`, 팔레트 `paletteItems.ts:345-346`. `LIBRARY_CONTRACT_VERSION` 은 77 이다 (`catalog/document/types.ts:198`).
- **F6** 자식의 flex 값은 `ITEM_LAYOUT_FIELDS` (`catalog/runtime/compositionRoot.ts:2078`) 로 엔진에 간다. 파생 값이 flex 를 정하는 선례가 있다 — `_justified` → `{ flexGrow: 1, flexBasis: "0%" }` (`:1927-1929`). 엔진은 main 축이 확정되지 않으면 `%` basis 를 `content` 로 바꾼다 (`packages/engine/src/tree.rs:8493` `resolve_flex_basis`, `:8504-8512`).
- **F7** 실행 상태는 한 길이다 — renderer 가 `runtimeState` 로 읽고 (`catalog/runtime/delegatedDom.runtime.ts:839`) `setRuntimeProps` 로 쓰면 (`catalogPreviewInteractions.ts:1470`) 그 prop 을 미러하는 변수에 값이 간다 (`:346` `mirrorsOf`). 미러할 수 있는 값 형은 `ValueTypeId` (`interactions/concepts/types.ts:16-27`) 와 `VARIABLE_TYPE_OF` (`state/implicitState.ts:32-42`) 가 정한다 — `number` · `boolean` 은 있고 「패널 id → 비율」 형은 없다.
- **F8** 브라우저에 실행 상태를 기억하는 선례는 Table 「Remember state」 다 (`bindings/Table.binding.ts:98`, `runtime/tableState.ts:403-439`). 요소 미러 변수는 `persist` 대상이 아니다 (`state/variable.types.ts:44-49`).
- **F9** 짝을 같이 다루는 명령 선례가 있다 — Tab 의 삭제 · 복제가 짝 TabPanel 을 같이 (`catalog/commands/collections.ts:300` `catalogPairedTabPanels`).
- **F10** initial 번들: Builder 1,629,237 / 상한 1,650,000 B gzip (여유 20,763) · Preview 172,215 / 327,000 ([ADR-201](201-large-file-upload-engine-component-server-contract.md) 2026-11-25 재승인, 만료 2026-12-25).

### 레퍼런스 (2026-11-25 ~ 26)

- **reui Resizable** (`reui.io/components/resizable`, `keenthemes/reui` `registry/bases/base/ui/resizable.tsx`): `react-resizable-panels` `^4.7.6` 의 얇은 래퍼. 부품 3 (`ResizablePanelGroup` · `ResizablePanel` · `ResizableHandle` — `withHandle`), 예제 10 (가로 · 세로 · 중첩 · 3 분할 · pill 손잡이 · 크기 추적). pill 모양은 prop 이 아니라 예제의 `className` 이다.
- **react-resizable-panels 4.24.2** (내려받아 읽음): 패널 크기 = `flexGrow` 몫 + `flexBasis: 0`, separator 의 ARIA 는 APG 그대로, 키는 화살표 · Home · End · Enter · F6. 패키지 전체 JS gzip 69,196 B — 4.x 사이에 Grid · Workspace · Tabs 까지 넓어졌다.
- **WAI-ARIA APG Window Splitter**: separator 가 focus 를 받고, 값 = 주 패널의 크기, 화살표로 이동 · Enter 로 접기 · Home / End 로 끝까지.
- 대조 표 전문은 [breakdown §2](../design/318-resizable-split-panels-breakdown.md).

### Hard constraints

- **HC1** 새 런타임 의존성 0 (사용자 답 1).
- **HC2** D1 예외는 breakdown §4 의 목록으로 닫힌다 — 구현이 쓰는 ARIA 속성 · 키 · 포인터가 그 목록과 같아야 한다 (정적 검사).
- **HC3** 대칭: 같은 작성 값에서 Canvas 와 Preview 첫 화면의 Panel · Handle rect 가 ±1 px 로 같다. 기준값은 실제 Chrome 의 `getBoundingClientRect` 다.
- **HC4** 번들: initial 은 ADR-201 의 현재 상한 안 (F10). 끌기 · 키 처리는 lazy chunk 이고 로드 전에도 배치와 모양이 선다.
- **HC5** 프레임: 끌기 중 frame time p95 ≤ 16.7 ms (60 Hz floor, CPU 1x — 4x 값 병기). Panel 안 Table 1,000 행 (가상 스크롤 — 제품 기본) · 중첩 2 단 문서에서. 가상 없는 큰 내용 (행 표시 「pages」 1,000 행 같은 작성) 은 내용 재배치 비용이라 기준 밖이고 값만 병기한다 (Phase 0 P2 p95 41 ms — 사용자 답 2026-11-26 「그대로 실시간 · 한계로 기록」).
- **HC6** 키보드만으로 크기 조절 · 접기 · 펼치기 전부.
- **HC7** 문서 변환 코드 0 — contract 는 더하기만 (+1 — ADR-317 Phase 4 다음 번호).
- **HC8** Group 의 main 축 크기는 확정이어야 한다 (F6) — 원본 template 이 그 모양으로 나온다.

### Soft constraints

- RAC 가 분할창을 내면 이 예외를 지우고 RAC 것을 쓴다.
- RTL 은 대상이 아니다 (사용자 결정 2026-11-24).
- 사용자는 비개발자다 — Panel 과 Handle 의 순서를 손으로 맞추게 하지 않는다.

## Alternatives Considered

### 대안 A: `react-resizable-panels` 도입 (reui 그대로)

- 설명: reui 처럼 라이브러리의 Group · Panel · Separator 를 감싼다.
- 근거: reui · shadcn 이 쓰는 사실상 표준. ARIA · 키 · 접기 · 저장을 라이브러리가 한다.
- 위험: 기술 MEDIUM (크기를 라이브러리가 계산한다 — Canvas 는 같은 식을 엔진으로 다시 세우고 대조해야 한다) / 성능 MEDIUM (패키지 69 KB gzip — 배치를 라이브러리가 하므로 lazy 로 미루면 첫 화면이 흔들린다) / 유지보수 **HIGH** (D1 정본 밖의 제3자 DOM · 크기 식이 둘 · 4.7 → 4.24 사이에 표면이 크게 넓어진 패키지) / 마이그레이션 LOW.

### 대안 B: 전용 세 type + react-aria 훅 + 닫힌 D1 예외 (채택)

- 설명: `ResizablePanelGroup` · `ResizablePanel` · `ResizableHandle` 을 catalog 에 등록한다. 크기는 flex 몫 하나로 Canvas (엔진) 와 DOM 이 같은 CSS flex 를 푼다. 끌기 · 키는 `useMove` · `useKeyboard`, ARIA 는 Handle 요소에 직접.
- 근거: F3 (같은 방식이 빌더에서 돌고 있다) · F4 (닫힌 예외의 선례) · F6 (파생 값 → flex 선례) · 라이브러리도 같은 flex 몫 방식이다.
- 위험: 기술 MEDIUM (끌기 계산 — 한계 · 접기 임계 · 중첩 — 을 우리가 쓴다) / 성능 MEDIUM (끌기 중 Panel 내용 reflow — HC5) / 유지보수 MEDIUM (예외를 우리가 유지) / 마이그레이션 LOW (더하기만).

### 대안 C: 새 type 없이 frame 의 스위치 (자식 사이에 손잡이를 자동으로)

- 설명: flex frame 에 「Resizable」 을 켜면 자식 사이에 손잡이가 생긴다. 손잡이는 노드가 아니다.
- 근거: 새 type 0 · 작성자가 짝을 맞출 일이 없다.
- 위험: 기술 **HIGH** (frame 은 모든 배치의 바탕이다 — flex · grid · 절대 배치 · 넘침 줄바꿈과 겹치고, 노드가 아닌 손잡이는 Canvas 가 그릴 record 가 없다) / 성능 MEDIUM (frame 해석 경로에 분기) / 유지보수 **HIGH** (부품 = 노드 원칙 밖 · 손잡이마다 모양을 줄 수 없다) / 마이그레이션 LOW.

### 대안 D: CSS `resize` 속성

- 설명: Panel 에 `resize: horizontal` · `overflow: auto` 만 준다.
- 위험: 기술 LOW / 성능 LOW / 유지보수 LOW / 마이그레이션 LOW. 키보드로 조절할 수 없고 (HC6), 손잡이 모양 · 접기 · 최소 최대 연동 · 상태 연동이 없다 — 사용자 범위를 채우지 못한다.

### Risk Threshold Check

| 대안 | HIGH 이상       | 판정                            |
| ---- | --------------- | ------------------------------- |
| A    | 유지보수        | 기각 (사용자 답 1 과도 같다)    |
| B    | 없음 (MEDIUM 3) | 채택 — 루프 불필요              |
| C    | 기술 · 유지보수 | 기각                            |
| D    | 없음            | 범위 · 접근성 (HC6) 미달로 기각 |

## Decision

**대안 B 를 채택한다.**

1. **세 type** — `ResizablePanelGroup` (팔레트 layout) · `ResizablePanel` (자유 내용 host) · `ResizableHandle`. Panel 과 Handle 은 Group 안에만 놓인다. 세 type 모두 composition 확장으로 `d2Provenance.ts` 에 적는다. prop 목록은 breakdown §5.1.
2. **Handle 은 노드다** — 부품은 노드이고 모양은 부품 자신의 rule 이다. Group 의 자식 순서 (Panel · Handle 이 번갈아) 는 명령이 지킨다: 「Add panel」 은 Handle 과 Panel 을 한 명령으로 넣고, Panel 삭제는 붙은 Handle 을 같이 지우고, Handle 단독 삭제 · 이동은 막는다 (F9 의 방식).
3. **크기 식 하나** — Panel 의 몫 (`defaultSize`, 안 적으면 남은 비율을 고르게 — 합이 100 이 되게 맞춘다) 을 Group 해석 때 파생 값으로 싣고, 두 consumer 가 `flexGrow = 몫` · `flexBasis = 0px` · main 축 최소 · 최대로 그린다. 손잡이의 px 두께는 flex 가 먼저 뺀다. basis 를 `0%` 로 두지 않는다 (F6). 접힌 크기가 px 인 Panel 만 접힌 동안 `flexGrow = 0` · `flexBasis = 그 px` 다 — 같은 CSS flex 에 싣는 값이고 두 consumer 가 같은 파생 값을 읽는다 (breakdown §5.2).
4. **D1 예외** — Handle 요소 하나에서만: `role="separator"` 와 값 · 방향 · 대상 · 이름 · 비활성 속성, Group 축 방향의 화살표 · Home · End · Enter, 끌기 · 더블클릭. 축과 다른 방향의 화살표는 받지 않는다 — `useMove` 의 키 handler 는 화살표 넷을 모두 삼키므로 Handle 에 붙이지 않고 (포인터 handler 만), 화살표는 `useKeyboard` 가 축 방향만 처리한다. Group 과 Panel 은 role 없는 `div` 다. 목록 전문과 그대로 두는 것은 breakdown §4. 규칙 파일 (`.claude/rules/ssot-hierarchy.md` §1 D1) 에는 Accepted 승격 때 승인을 가리키는 한 줄을 넣고 (ADR-317 과 같은 방식 — 목록은 breakdown §4 가 정본), 구현 Phase 가 끝날 때 목록 전문을 옮긴다.
5. **끌기** — 순수 계산 모듈 하나가 끌린 px 를 새 몫으로 바꾼다. 끌기 중에는 두 Panel 의 style 과 Handle 의 값을 직접 쓰고 (React commit 없음), 실행 상태는 프레임당 한 번과 끌기 끝에 쓴다. 실행 상태의 정본은 Panel 마다의 `size` · `isCollapsed` 다 — Group 에는 실행 상태를 두지 않는다 (미러 변수는 그 prop 을 쓴 record 에서만 채워진다 — F7). Handle 의 동작 코드는 lazy chunk 다.
6. **접기 · 펼치기** — `collapsible` · `collapsedSize` · `defaultCollapsed`. 최소 아래로 끌면 가운데 임계에서 접히고, Enter · 더블클릭 · Do 「Collapse · Expand · Toggle panel」 로도 바뀐다.
7. **pill 손잡이** — Handle `variant` (`line` · `pill`) 와 `withHandle`. 상태 칠 (hover · pressed · focus-visible · disabled) 은 rule 의 조건 트리 한 곳이고 ([ADR-297](297-rule-state-condition-tree-single-priority.md)), 움직임은 rule 의 `transition` 이다 — Canvas 는 상태별 정지 모양을 그린다.
8. **상태 연동** — Panel 의 지금 크기와 접힘을 변수에 잇고 (값 형은 사용자 결정 1), Group 「Remember sizes」 로 Publish 에서 다시 열 때 복원한다 (사용자 결정 5).
9. **Canvas** — 작성 값으로 정적 배치만 한다. Panel 의 main 축 크기 손잡이가 `defaultSize` 를 쓰는지는 사용자 결정 3.
10. **하지 않는 것**
    - `react-resizable-panels` 도입 (대안 A) · frame 스위치 (대안 C).
    - 라이브러리의 F6 (손잡이 사이 focus 이동) · `collapsedThreshold` · `groupResizeBehavior` · Grid · Workspace · Tabs.
    - 빌더 chrome `PanelSplitter` 를 이 컴포넌트로 바꾸는 일 — 빌더 chrome 은 사용자 컴포넌트와 분리되어 있다.
    - Canvas 에서 끌린 크기 · 접힘 전환을 흉내 내는 일.
    - 문서 변환 코드 (HC7).

위험 수용 근거: B 의 남는 위험은 계산을 우리가 쓴다는 것이다. 계산은 입력과 출력이 숫자인 순수 함수라 정답표로 고정할 수 있고 (G2), 배치는 두 consumer 가 이미 가진 CSS flex 에 맡겨 새 배치 식이 없다. 같은 훅 조합이 빌더에서 이미 돌고 있다 (F3).

기각 사유:

- **A** — 사용자 답 1. 그리고 크기 식이 라이브러리와 엔진 둘이 되고, DOM 과 ARIA 가 D1 정본 (RAC) 도 우리 목록도 아닌 제3자 것이 된다.
- **C** — frame 의 모든 배치 모드에 분기가 들어가고, 손잡이가 노드가 아니라 Canvas · Layers · rule 어디에도 자리가 없다.
- **D** — 키보드 조작이 없고 (HC6) 범위 넷 가운데 기본 분할의 일부만 된다.

> 구현 상세: [318-resizable-split-panels-breakdown.md](../design/318-resizable-split-panels-breakdown.md)

### 사용자 결정 (8 건 — 그 Phase 에 닿을 때 묻는다)

|  #  | 항목                                                                                                                              | 권고                                                                                                                                                                                                                                                                                                                                                         | 닿는 Phase |
| :-: | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------: |
|  1  | 크기 상태를 변수에 잇는 모양 — Panel 마다 숫자 하나 (+ 접힘 boolean) / Group 에 「패널 → 비율」 값 하나 (새 값 형) / 둘 다        | Panel 마다 숫자 + 접힘 — 값 형을 새로 만들지 않고 (F7), 「왼쪽 30 %」 를 글자 · 조건에 바로 쓴다 **— 확정 2026-11-26: 권고 그대로 (Panel 마다 숫자 `size` + 접힘 `isCollapsed`)**                                                                                                                                                                            |     5      |
|  2  | 크기 단위 — `defaultSize` · `minSize` · `maxSize` · `collapsedSize` 를 % 만 / px 도                                               | 기본 크기는 %, 최소 · 최대 · 접힌 크기는 % 와 px 둘 다 (사이드바 최소 200 px 같은 쓰임 — 라이브러리도 둘 다 받는다) **— 확정 2026-11-26: 권고 그대로 (기본 % · 최소 · 최대 · 접힌 크기 % 와 px)**                                                                                                                                                            |     1      |
|  3  | Canvas 에서 크기를 끌어 정하기 — Panel 의 main 축 크기 손잡이가 `defaultSize` 를 쓴다 / Canvas 에서는 고르기만 (값은 패널 칸에서) | 크기 손잡이가 `defaultSize` 를 쓴다. Handle 노드는 고를 수만 있다 **— 확정 2026-11-26: 권고 그대로 (Panel 의 주축 손잡이 둘 · `defaultSize` 쓰기 · Handle 은 고르기만)**                                                                                                                                                                                     |     6      |
|  4  | 끌기가 미치는 범위 — 손잡이 양옆 두 Panel 만 / 이웃이 최소에 닿으면 그 너머 Panel 까지 민다 (라이브러리 방식)                     | 양옆 두 Panel 만 — 손잡이의 값이 앞 Panel 하나의 크기라는 APG 계약과 맞고 계산이 작다                                                                                                                                                                                                                                                                        |     2      |
|  5  | 다시 열 때 복원 — Group 「Remember sizes」 스위치 (Publish 의 그 브라우저) / 변수에 맡긴다 / 하지 않는다                          | Group 스위치 — Table 「Remember state」 와 같은 방식 (F8) **— 확정 2026-11-26: 권고 그대로 (Group 「Remember sizes」 — Publish 만)**                                                                                                                                                                                                                         |     5      |
|  6  | 화살표 한 단계의 크기 — 5 % 고정 / Group prop 으로                                                                                | 5 % 고정 (Phase 0 에서 라이브러리 기본값과 대조) **— 확정 (Phase 0): 5 % 고정 — 라이브러리도 prop 없는 고정 5**                                                                                                                                                                                                                                              |     2      |
|  7  | pill 손잡이의 종류 — 하나 (hover 에 길어지고 끌 때 더 길고 굵게) / reui 예제처럼 여럿 (큰 capsule 포함)                           | 하나 — 크기 차이는 Handle 의 size 축이 필요해질 때 따로 정한다 **— 확정 2026-11-26: 하나**                                                                                                                                                                                                                                                                   |     4      |
|  8  | 번들 Δ 수용 범위                                                                                                                  | initial Δ ≤ Builder +4,000 · Preview +2,000 B gzip (등록 · 정적 renderer · rule 의 몫), 동작 코드는 lazy. 넘으면 보고 **— 확정 2026-11-26: 권고 그대로 (Builder +4,000 · Preview +2,000)** **— 고침 2026-11-26 Phase 6 (사용자 답): Builder +5,500 B (실측 +5,183 — 끌기 계산 · 크기 기억 저장을 첫 화면 밖으로 옮긴 뒤) · Preview +2,000 그대로 (실측 +3)** |  각 Phase  |

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                              | 심각도 | 대응                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Canvas 와 Preview 의 Panel 크기가 어긋난다 — 몫 파생 값을 한쪽만 읽거나 (`compositionRoot.ts` `styleOf` 의 `:1927` 자리 · `delegatedDom.runtime.ts` 의 인라인 style), basis 가 `%` 로 들어가 엔진이 `content` 로 바꾸거나 (`tree.rs:8504-8512`), Group main 축이 확정되지 않은 문서 (`tree.rs:8493` 의 `main_ctx`), px 최소 · 최대가 한쪽에서만 걸린다 (`ITEM_LAYOUT_FIELDS` `:2078` 밖의 box 값) |  HIGH  | G0 시제품 P1 (go — fixture 8) · G1 — fixture 8 의 rect 를 실제 Chrome 값과 대조 (HC3). 몫은 파생 값 한 곳에서만 계산한다. main 축이 확정되지 않은 Group 은 Design 패널에 알림을 낸다  |
| R2  | D1 예외가 목록을 넘거나 APG 와 어긋난다 — Handle 컴포넌트 (새 `runtime/resizable.components.tsx`) 가 목록 밖 속성을 쓰거나, 중첩 Group 에서 안쪽 손잡이의 키 · 포인터가 바깥으로 번지거나, 화면 낭독기가 값을 읽지 못한다. 선례 코드: `PanelSplitter.tsx:91-115` (키) · `:127-135` (속성) · `domRegistry.components.tsx:101-128` (붙였다 떼기)                                                    |  HIGH  | G2 — 구현이 쓰는 속성 · 키 = breakdown §4 (정적 검사) · 키보드 전 경로 · 중첩 번짐 0. G6 — VoiceOver 청취 (사용자). 읽지 못하면 그 속성을 목록에 더할지 사용자에게 보고 (결정 지점 3) |
| R3  | 끌기가 느리다 — `pointermove` 마다 실행 상태를 쓰면 (`catalogPreviewInteractions.ts:1470` `setRuntimeProps`) 미러 변수 (`:346` `mirrorsOf`) 와 그 구독자가 매번 다시 그려지고, Panel 안의 큰 내용이 매 프레임 reflow 한다                                                                                                                                                                         |  HIGH  | G0 시제품 P2 · G6 — HC5 측정. 끌기 중에는 style 직접 쓰기, 실행 상태는 프레임당 한 번. 넘으면 실행 상태 쓰기를 끌기 끝으로 민다                                                       |
| R4  | 짝이 깨진 문서 — 코드 보기 · 붙여넣기 · AI 편집이 Handle 없는 Panel 나열이나 Handle 연속을 만든다                                                                                                                                                                                                                                                                                                 | MEDIUM | nesting 규칙이 Group 직계를 Panel · Handle 로 제한하고, renderer 는 깨진 순서를 그대로 그린다 (Handle 이 없으면 끌 수 없을 뿐 — 배치는 선다). 명령 경로는 짝을 지킨다 (G6)            |
| R5  | 상태 연동의 값 형이 넓게 번진다 (사용자 결정 1 이 「새 값 형」 이면 `ValueTypeId` · 변수 편집기 · 표현식까지)                                                                                                                                                                                                                                                                                     | MEDIUM | 권고안은 새 값 형 0. 「새 값 형」 으로 정해지면 Phase 5 의 inventory 를 다시 세고 보고한다                                                                                            |
| R6  | initial 번들 — binding 3 · rule 3 · template · traits 가 첫 화면 몫이다 (F10 여유 20,763 B · 상한 만료 2026-12-25)                                                                                                                                                                                                                                                                                | MEDIUM | G0 기준선 · Phase 마다 Δ (사용자 결정 8)                                                                                                                                              |
| R7  | Canvas 의 기존 크기 손잡이가 Panel 에 `width` · `height` 를 써서 몫과 싸운다                                                                                                                                                                                                                                                                                                                      | MEDIUM | Phase 1 에서 Panel 의 main 축 크기 편집을 막고, Phase 6 에서 사용자 결정 3 대로 `defaultSize` 쓰기로 바꾼다                                                                           |
| R8  | pill 의 길이 변화가 Canvas 에서는 정지 모양이다                                                                                                                                                                                                                                                                                                                                                   |  LOW   | 대칭 기준을 「같은 상태에서 같은 모양」 으로 둔다 (`/cross-check` 은 상태별)                                                                                                          |

HIGH 가 셋이지만 Phase 를 다른 ADR 로 나누지 않는다 — 셋 다 같은 세 type 의 등록 · 동작에서 나오고, 따로 떼면 Phase 1 (정적 배치) 만으로는 사용자 요청 (「동일한 기능」) 을 채우지 못한다.

## Gates

측정 조건 (HC3 · HC5 · G1 · G6 공통, [measurement-validity.md](../../../.claude/rules/measurement-validity.md)): 배치 대조의 fixture 는 계약이 갈리는 입력 차원 (px 최소 · 최대 · 손잡이 두께 · 중첩 · 미지정 크기 · 접힘) 을 모두 쓰고 기준값은 실제 Chrome 의 `getBoundingClientRect` 다 (Canvas 출력으로 채점하지 않는다). 프레임 측정의 문서는 부하용 생성 문서 (규모 전용), 불리한 경우 = Panel 안 Table 1,000 행 + 중첩 2 단 + 미러 변수를 읽는 글자 3 개, 대조군 = 같은 문서에서 실행 상태 쓰기를 끌기 끝으로 민 arm 과 교대 3 쌍, 조건 = production 빌드 · headed Chrome · 보이는 탭 · CPU 1x 와 4x.

| Gate | 시점       | 통과 조건                                                                                                                                                                                                                                                                                | 실패 시 대안                                                          |
| ---- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| G0   | Phase 0 끝 | 코드 사실 F1 ~ F10 재대조 차이 0 · reui 예제 10 전부 읽음 · v3 확인 · 시제품 4 (엔진 flex 몫 rect · 끌기 프레임 · 중첩 번짐 · VoiceOver 값 읽기) 의 go / no-go · 번들과 ratchet 기준선                                                                                                   | no-go 항목은 그 기능을 빼거나 방식을 바꿔 사용자에게 보고             |
| G1   | Phase 1 끝 | 등록 게이트 (`pnpm codex:preflight` 의 registration · `d2S2Alignment.static.test.ts`) · contract (317 다음 번호) · fixture 8 의 Canvas rect = Chrome rect ±1 px · Canvas 와 Preview 첫 화면 `/cross-check` · 수정을 되돌리면 실패 (원복 RED)                                             | 어긋나는 입력 차원 (예: px 최대) 을 빼고 사용자 결정 2 를 다시 묻는다 |
| G2   | Phase 2 끝 | 계산 정답표 (따로 적은 값 — 한계 · 미지정 · 3 분할 · 중첩) · 구현의 ARIA 속성 · 키 = breakdown §4 (정적 검사 — `useMove` 의 키 handler 를 Handle 에 붙이지 않음 포함) · 축과 다른 방향의 화살표가 페이지 스크롤을 막지 않음 · 키보드만으로 전 경로 · 중첩 번짐 0 · Chrome 과 WebKit live | 번지는 입력 (키 또는 포인터) 을 그 Group 에서 멈추는 처리를 더한다    |
| G3   | Phase 3 끝 | 접기 임계 · Enter · 더블클릭 · Do 3 이 정답표와 일치 · 접힌 Panel 의 `aria-valuenow` = 접힌 크기 · Canvas 의 `defaultCollapsed` = Preview 첫 화면                                                                                                                                        | 끌어서 접기를 빼고 Enter · Do 만                                      |
| G4   | Phase 4 끝 | pill · line 의 상태별 모양이 Canvas = DOM (`/cross-check` — 기본 · hover · pressed · focus-visible · disabled) · 칠 우선순위 = 조건 트리 순서                                                                                                                                            | pill 을 hover · pressed 구분 없는 정지 모양으로                       |
| G5   | Phase 5 끝 | 끌면 양옆 Panel 의 미러 변수 값 = 그 Panel 의 % (정답표 — 쓰기는 Panel record 에) · When 2 가 실행 · 「Remember sizes」 가 Publish 에서 복원하고 Builder Preview 에서는 저장하지 않음                                                                                                    | 복원을 빼고 변수 연동만                                               |
| G6   | Phase 6 끝 | HC5 프레임 측정 통과 · 번들 (사용자 결정 8) · 짝 유지 명령 (추가 · 삭제 · 순서 바꾸기 · 되돌리기) · 규칙 문서의 D1 목록 = 구현 · `/evaluate` 종결 live · VoiceOver 청취와 사용자 확인                                                                                                    | 넘는 항목을 수리하거나 실행 상태 쓰기를 끌기 끝으로 민다              |

집행: 각 Gate 의 테스트는 unit · browser project 에 두고 Phase 끝에 실행자가 `pnpm -F @composition/shared test` · `pnpm -F @composition/builder test` (browser 는 `test:parity`) 와 `pnpm codex:preflight` 로 돌려 결과를 breakdown §9 에 적는다. 번들은 `adr201-bundle-gate.mjs` 와 배포 workflow (`push: main`) 의 상한 단계가 막는다.

### Live Exercise

실행: dev 서버 (5173) · headed Chrome · Playwright WebKit, 하니스 `apps/builder/scripts/adr318-g{1..6}-live.mjs` (각 Phase 끝, 전 Phase 회귀 포함). 결과 상세는 [breakdown §9](../design/318-resizable-split-panels-breakdown.md).

- G1 14/14 — 기본 · `defaultSize` · px 최소 · % 최대 · 세로: Canvas = Publish = 식이 뜻한 크기.
- G2 8/8 — 끌기 (양옆 두 Panel · 최소 · 최대에서 멈춤) · 축 화살표 · Home · End · 중첩 번짐 0 · iframe 위 놓기 · 끄는 동안 축 커서 유지.
- G3 5/5 — 접기 · 펼치기 (Enter · 더블클릭 · 끌기 임계 · Do 3).
- G4 5/5 — pill · grip 모양 · 상태별 색 · focus ring (Canvas = DOM).
- G5 7/7 — 변수 연동 (`size` · `isCollapsed`) · When 「Resize」 · 「Collapse change」 · 「Remember sizes」 (Publish).
- G6 7/7 — 짝 유지 명령 (「+」 · 삭제 · Handle 단독 거절 · ⌘Z) · Canvas 손잡이 = Default size · Layout 탭 크기 칸 = Panel 크기 props · Layers 방향 아이콘 · page error 0. 승격 직전 재실행 (2026-11-26, HEAD `b65c557b7` 위 dev 서버) Chrome · WebKit 7/7.
- HC5 (production · 교대 3 쌍): 끌기 4x p95 20.9 ms = idle · LoAF 0.
- VoiceOver: separator 이름 · 값 (%) 청취 — 사용자 확인 (2026-11-26).

## Consequences

### Positive

- 만든 화면의 사용자가 경계를 끌어 폭을 조절한다 — 목록과 상세, 필터와 표 같은 분할 화면을 컴포넌트 하나로 만든다.
- 키보드와 화면 낭독기로 같은 조작을 할 수 있다 (APG Window Splitter).
- 새 의존성이 없고, 배치 식이 Canvas 와 DOM 에서 같은 CSS flex 다.
- 크기와 접힘을 변수 · 조건 · 규칙에 이을 수 있다.

### Negative

- 사용자 컴포넌트의 D1 예외가 셋이 된다 — Handle 의 속성 · 키 · 포인터를 RAC 가 아니라 우리가 유지한다.
- 끌기 계산 (한계 · 접기 임계) 을 우리가 쓰고 고친다. 라이브러리가 주는 기능 일부 (이웃 너머 밀기 · F6) 는 없다.
- contract 가 78 로 오른다. initial 번들에 등록 몫이 더해진다 (사용자 결정 8).
- Canvas 는 끌린 크기와 접힘 전환을 보여 주지 않는다 — 작성자는 Preview 에서 확인한다.
