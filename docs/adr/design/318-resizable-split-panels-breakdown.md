# ADR-318 breakdown — Resizable 분할창 (끌어서 나누는 패널 묶음)

> 본문: [318-resizable-split-panels.md](../318-resizable-split-panels.md). 이 문서는 구현 상세 (대조 표 · 노드와 prop · D1 예외 목록 · 설계 · Phase · 파일 추정) 의 정본이다.

## 1. 범위 · 출처

- 사용자 2026-11-25: 「https://reui.io/components/resizable 확인후 깃헙리포지토리에서 코드 체크후 우리 컴퍼넌트에도 동일한기능을 가진 컴퍼넌트를 추가해야한다」.
- 같은 날 답 3: D1 = 「react-aria 훅 + D1 예외」 · 「ADR 먼저」 · 범위 = 「기본 분할, 접기 · 펼치기, pill 손잡이 모양, 크기 상태 연동」.
- 기존 ADR 을 나누거나 합치지 않는다 — 새 컴포넌트 계열 하나다. 빌더 chrome 의 `PanelSplitter` (ADR-922) 는 고치지 않는다.
- 초안 입력 (로컬 전용): 2026-11-25 세션의 scratchpad `adr-318-resizable-draft.md`. 결론은 이 문서와 본문에 옮겼다.

## 2. reui 대조 표

reui 쪽은 `keenthemes/reui` 의 `registry/bases/base/ui/resizable.tsx` 와 예제 소스에서 읽었다 (초안 세션). 이 세션이 소스를 다시 확인한 예제는 1 · 5 · 10 이고, 나머지 예제의 내용은 초안 기록이다 — Phase 0 에서 전부 다시 읽는다.

|  #  | reui (부품 · prop · 예제)                                                               | 우리 (이 ADR)                                                                    |
| :-: | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
|  1  | `ResizablePanelGroup` `orientation` (가로 · 세로)                                       | `ResizablePanelGroup` `orientation`                                              |
|  2  | `ResizablePanel` `defaultSize` · `minSize` · `maxSize`                                  | 같은 이름 (단위는 사용자 결정 2)                                                 |
|  3  | `ResizablePanel` `collapsible` · `collapsedSize`                                        | 같은 이름 + Do 「Collapse · Expand · Toggle panel」                              |
|  4  | `ResizableHandle` `withHandle` (grip 표시)                                              | 같은 이름                                                                        |
|  5  | pill 손잡이 — 예제의 `className` (hover 길어짐 · 누르면 더 길고 굵게 · 큰 capsule)      | Handle `variant` (`line` · `pill`) — 상태 칠은 rule 의 조건 트리 (사용자 결정 7) |
|  6  | 중첩 (Panel 안 Group) · 3 분할 이상                                                     | Panel 은 자유 내용 host — Group 을 넣을 수 있다 · Panel 수 제한 없음 (2 이상)    |
|  7  | `onLayoutChange` (패널 id → %) — 예제 10                                                | Panel 의 크기 · 접힘 상태를 변수에 잇는다 (사용자 결정 1)                        |
|  8  | 재방문 복원 (라이브러리 `useDefaultLayout` + storage)                                   | Group 「Remember sizes」 (사용자 결정 5)                                         |
|  9  | `disabled` (Group · Panel · Separator)                                                  | `isDisabled` (저장소 이름 규칙 — RAC · S2 의 `isDisabled`)                       |
| 10  | 라이브러리의 F6 (손잡이 사이 focus 이동) · `collapsedThreshold` · `groupResizeBehavior` | 넣지 않는다 (§4 목록 밖 — Tab 으로 이동, 임계는 고정 식 §5.3)                    |

## 3. 설치본 · 원본이 주는 것

- **RAC 1.22.1**: 분할창 없음. 크기 조절은 Table 의 `ColumnResizer` · `ResizableTableContainer` 뿐이다 (`node_modules/react-aria-components/dist/types` 에서 `Splitter` · `SplitView` · `ResizablePanel` 0 건).
- **react-aria** (설치본 — `apps/builder` · `packages/shared` 가 이미 의존): `useMove` (포인터 끌기 + 화살표 키 이동) · `useKeyboard` · `useFocusRing`. 빌더 `PanelSplitter.tsx:1` 이 같은 훅을 쓴다.
- **S2 1.8.2**: `src` 에 분할창 없음 (`Divider.tsx` · `SideNavPanel.tsx` 만 이름이 걸린다). **design-data**: `bar-panel` (끌어 옮기는 손잡이) · `standard-panel` 뿐 — 분할창 없음 (MCP 검색 2026-11-26). **v3**: 로컬에 설치되어 있지 않다 — Phase 0 에서 공개 패키지 목록으로 확인한다.
- **react-resizable-panels** (reui 는 `^4.7.6`, 2026-11-26 최신 4.24.2 를 내려받아 읽음 — 도입하지 않는다, 동작의 뜻만 참고):
  - 패널 크기는 `flexGrow: layout[id] ?? 1` · `flexBasis: 0` 이다 — 비율을 CSS flex 가 푼다.
  - separator: `role="separator"` · `aria-orientation` · `aria-valuenow` · `aria-valuemin` · `aria-valuemax` · `aria-controls` · `aria-disabled`.
  - 키: 화살표 · Home · End · Enter · F6.
  - 패키지 전체 JS 는 gzip 69,196 B (4.x 사이에 Grid · Workspace · Tabs 까지 넓어졌다).
  - 크기 값: 숫자 = px, 단위 없는 문자열 = %.

## 4. D1 예외 — 닫힌 목록 (정본)

사용자 컴포넌트 Resizable 만, `ResizableHandle` 요소 하나에서만 다음을 직접 다룬다. 구현이 이 목록을 넘으면 규칙 위반이다. 규칙 파일 (`.claude/rules/ssot-hierarchy.md` §1 D1) 은 두 번 고친다 — Accepted 승격 때 승인을 가리키는 한 줄 (ADR-317 의 「넓힘 승인」 줄과 같은 방식: 사용자 답 2026-11-25 · 목록은 이 절이 정본 · 구현 Phase 가 끝나면 옮긴다) 을 넣고, Phase 6 이 끝날 때 목록 전문을 옮긴다. 가리킴 줄이 없으면 Phase 2 ~ 5 의 Handle 수동 ARIA 가 상시 로드 규칙의 금지와 충돌한다 (리뷰 round 1).

**속성 (Handle 요소)**

| 속성               | 값                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `role`             | `separator`                                                                                                       |
| `aria-orientation` | Group 이 가로면 `vertical`, 세로면 `horizontal` (선의 방향 — APG)                                                 |
| `aria-valuenow`    | 손잡이 앞 Panel 의 지금 크기 (%, 정수) — px 로 접힌 Panel 은 Group main 에서 손잡이 합을 뺀 자리에 대한 % 로 환산 |
| `aria-valuemin`    | 그 Panel 이 줄어들 수 있는 가장 작은 크기 (%) — 접을 수 있으면 `collapsedSize`                                    |
| `aria-valuemax`    | 그 Panel 이 늘어날 수 있는 가장 큰 크기 (%) — 뒤 Panel 의 최소를 뺀 값                                            |
| `aria-controls`    | 손잡이 앞 Panel 요소의 `id`                                                                                       |
| `aria-label`       | 작성자 값, 없으면 기본 문구 (i18n)                                                                                |
| `aria-disabled`    | 끌 수 없을 때 `true`                                                                                              |
| `tabIndex`         | `0` (끌 수 없으면 `-1`)                                                                                           |

**키 (Handle 에 focus 가 있을 때만)**

| 키         | 동작                                                               |
| ---------- | ------------------------------------------------------------------ |
| 화살표     | Group 축의 두 방향으로 한 단계 (단계 값은 Phase 0 에서 확정 — 5 %) |
| Home · End | 앞 Panel 을 가장 작게 · 가장 크게                                  |
| Enter      | 앞 Panel 이 `collapsible` 이면 접기 · 펼치기                       |

축과 다른 방향의 화살표 · 그 밖의 키는 건드리지 않는다 (`continuePropagation`). 설치본 `useMove` 의 `moveProps.onKeyDown` 은 화살표 넷 모두에 `preventDefault` · `stopPropagation` 을 건다 (react-aria 3.53.1 `useMove.mjs:207-232`) — 그래서 Handle 에는 `moveProps` 의 포인터 handler 만 붙이고 `onKeyDown` 은 뺀다. 화살표는 `useKeyboard` 가 축 방향만 처리한다 (빌더 `PanelSplitter` 는 넷을 모두 `useMove` 에 맡긴다 — 여기서는 따르지 않는다).

**포인터 (Handle 요소)**: 끌기 (크기 조절) · 더블클릭 (접기 · 펼치기, `collapsible` 일 때).

**그대로 두는 것**

- Group · Panel 은 일반 `div` 다 — role 없음. Panel 은 `aria-controls` 의 대상이 되도록 `id` 만 갖는다 (전역 속성).
- Panel 안의 내용 (RAC 컴포넌트) 의 DOM · 키 · focus 는 건드리지 않는다. Table 의 `ColumnResizer` 는 자기 focus 에서 자기 화살표 키를 쓴다 — Handle 은 자기에게 focus 가 있을 때만 키를 받으므로 겹치지 않는다.
- focus 순서는 문서 순서 (Tab) 그대로다.
- RTL 은 대상이 아니다 (사용자 결정 2026-11-24 「RTL 제외」) — 좌우 화살표를 뒤집지 않는다.

RAC 가 분할창을 내면 이 예외를 지우고 RAC 것을 쓴다.

## 5. 설계

### 5.1 노드 · prop

| type                  | 자리                           | prop                                                                                                        | 자식                          |
| --------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `ResizablePanelGroup` | 팔레트 (layout) · 어디든       | `orientation` (`horizontal` 기본 · `vertical`) · `isDisabled` · `rememberSizes` (사용자 결정 5)             | Panel · Handle 만 (번갈아)    |
| `ResizablePanel`      | owners = Group · 팔레트에 없음 | `defaultSize` · `minSize` · `maxSize` · `collapsible` · `collapsedSize` · `defaultCollapsed` · `isDisabled` | 자유 내용 (`freeContentHost`) |
| `ResizableHandle`     | owners = Group · 팔레트에 없음 | `withHandle` · `variant` (`line` 기본 · `pill`) · `isDisabled` · `aria-label`                               | 없음                          |

- 이름은 reui · react-resizable-panels 의 어휘다. 세 type 모두 `d2Provenance.ts` 의 `CATALOG_D2_COMPOSITION_TYPES` (`:38`) 에 넣는다 (S2 · design-data 에 대응 컴포넌트가 없다 — §3).
- **Handle 은 노드다.** 부품은 노드이고 모양은 부품 자신의 rule 이라는 원칙 (ADR-251, `.claude/rules/catalog-subparts.md`) 그대로이고, Canvas 가 그릴 record 가 생기며, 손잡이마다 `withHandle` · `variant` 를 줄 수 있다.
- **짝 유지**: Group 의 자식은 `Panel (Handle Panel)*` 순서여야 한다. 명령이 지킨다 — 「Add panel」 = Handle + Panel 을 한 명령으로 · Panel 삭제 = 붙은 Handle 하나를 같이 · Handle 단독 삭제 · 이동 · 복제는 막는다 · Panel 순서 바꾸기는 Panel 끼리 자리를 맞바꾼다. 선례: Tab 삭제 · 복제가 짝 TabPanel 을 같이 다룬다 (`commands/collections.ts:300` `catalogPairedTabPanels`).
- 필수 부품 (`requiredParts.ts`): Group = Panel 2 이상. 원본 template 의 기본 모양 = Panel · Handle · Panel (30 / 70 대신 50 / 50).

### 5.2 크기 식 — Canvas 와 DOM 이 같은 CSS flex 를 푼다

- Group: `display: flex` · 방향은 `orientation` · `overflow: hidden`. **main 축 크기가 확정되어야 한다** — template 기본은 폭 채움 · 높이 고정 (값은 Phase 1 에서 rule 토큰으로). 중첩 Group 은 부모 Panel 이 확정 크기다.
- Panel: `flexGrow = 몫` · `flexShrink = 1` · `flexBasis = 0px` · main 축 `min` · `max` = `minSize` · `maxSize` · `overflow: hidden` (내용 스크롤은 작성자가 안쪽 frame 에).
  - **몫**: `defaultSize` 를 적은 Panel 은 그 값, 안 적은 Panel 은 `(100 − 적은 값의 합) / 안 적은 Panel 수` (음수면 0). 합이 100 이 아니면 비례로 100 에 맞춘다 — 몫이 곧 지금 크기 (%) 이고 `aria-valuenow` · 실행 상태 `size` · 변수 값과 같은 수다 (맞추지 않으면 실행 값을 쓴 Panel 과 파생 몫에 머문 Panel 의 비율이 어긋난다). Group 을 해석할 때 한 번 계산해 Panel 의 파생 값 (`_panelGrow`) 으로 싣는다 — Canvas (`styleOf`) 와 DOM (인라인 style) 이 같은 값을 읽는다. 선례: `_justified` → `{ flexGrow: 1, flexBasis: "0%" }` (`compositionRoot.ts:1927-1929`).
  - `flexBasis` 는 `0%` 가 아니라 `0px` 다. 엔진은 main 축이 확정되지 않았을 때 `%` basis 를 `content` 로 바꾼다 (`packages/engine/src/tree.rs:8504-8512`) — 그 경우 비율이 깨진다. px 0 은 그대로 0 이다.
  - 접힌 Panel: `min` 은 적용하지 않는다. `collapsedSize` 가 % 면 몫 = 그 값 (다른 Panel 과 같은 식). px 면 `flexGrow = 0` · `flexBasis = 그 px` (파생 값 `_panelBasis`) — 몫에 px 를 실으면 48 px 이 몫 48 이 되어 이웃 몫 70 과 48 : 70 으로 나뉜다. 남은 Panel 은 남은 자리를 몫 비율로 나눈다 (CSS flex 가 푼다 — 두 consumer 같은 값). 접힌 Panel 의 `size` 는 손잡이를 뺀 자리에 대한 % 로 환산한 값이다.
- Handle: `flex: 0 0 auto`. 선 두께 · 색 · grip · pill 은 rule. 잡는 영역은 선보다 넓다 — DOM 은 배치에 들어가지 않는 가상 요소 (rule 의 selector), Canvas 는 그리지 않는다 (배치 무변화).
- 손잡이의 px 두께는 flex 가 먼저 빼고 남은 자리를 몫으로 나눈다 — 두 consumer 가 같은 식이라 따로 계산하지 않는다.

### 5.3 끌기 · 키 (Preview · Publish, lazy chunk)

- 모듈 하나 (`runtime/resizablePanels.ts` — 순수 계산) 와 Handle 컴포넌트 (`resizable.components.tsx` — `useMove` 의 포인터 handler · `useKeyboard` · `useFocusRing`. `useMove` 의 `onKeyDown` 은 붙이지 않는다 — §4). Handle 컴포넌트는 lazy chunk 이고, 로드 전에도 Group · Panel · Handle 의 모양과 배치는 선다 (정적 renderer 가 같은 인라인 style 을 쓴다).
- **계산 (순수 함수 — unit 정답표)**: 입력 = Group main 크기 (px) · 손잡이 두께 합 · Panel 별 지금 몫 · `min` · `max` · 접힘 값 · 끌린 px. 출력 = 그 Group 의 모든 Panel 의 새 크기 (%, 손잡이를 뺀 자리 기준 · 합 100) 와 접힘. 끌린 만큼 앞 Panel 을 늘리고 뒤 Panel 을 줄인다 — 한쪽이 한계에 닿으면 거기서 멈춘다 (그 너머 Panel 을 미는지는 사용자 결정 4).
- **접기 임계**: `collapsible` 인 Panel 을 `minSize` 아래로 끌면 `minSize` 와 `collapsedSize` 의 가운데를 넘을 때 접힌다 (펼칠 때도 같은 가운데). 고정 식이고 prop 으로 내지 않는다.
- **끌기 중 쓰기**: `pointermove` 마다 두 Panel 요소의 `style.flexGrow` 와 Handle 의 `aria-valuenow` 를 직접 쓴다 — React commit 없음. 실행 상태는 프레임당 한 번 (rAF) 과 끌기 끝에, 값이 바뀐 Panel 마다 `setRuntimeProps(panelId, { size })` (접힘이 바뀌면 `isCollapsed` 도) 로 쓴다.
- **끌기 중 가림막**: 끌기 동안 Panel 안 iframe · 글자 선택이 포인터를 가져가지 않게 한다 (빌더 `PanelSplitter.tsx:137-149` 의 shield 와 같은 뜻 — 구현은 Phase 0 시제품에서 `useMove` 의 포인터 capture 로 충분한지 먼저 본다).
- 실행 상태의 자리: **Panel 마다의 `size` (number — 지금 크기 %) · `isCollapsed` (boolean)**. Group 에는 실행 상태를 두지 않는다. Panel 은 자기 값을 읽어 (`runtimeState` — `delegatedDom.runtime.ts:839`) `flexGrow = size ?? _panelGrow` 로 그리고, Handle 은 계산 입력으로 같은 Group 의 Panel 들 값을 읽는다. 끌기 · 키 · Do 3 이 모두 이 Panel prop 을 쓴다 — 정본 하나.
  - Why (리뷰 round 1): 미러 변수는 `setRuntimeProps(id, patch)` 의 그 `id` record 에서 `patch` 에 든 prop 만 채워진다 (`catalogPreviewInteractions.ts:1500-1507` — `mirrorsOf(graph, root, id)` 가운데 `mirror.prop in patch`). Group 의 `layout` 하나에 쓰면 §5.4 의 Panel `size` · `isCollapsed` 변수가 기본값에 머문다.

### 5.4 상태 연동 (Phase 5)

- 연결 대상 (사용자 결정 1 의 권고안): Panel 의 `size` (number — 지금 크기 %) · `isCollapsed` (boolean). `COMPONENT_INTERACTION_SPECS` 에 Panel 의 상태 concept 둘을 더하면 `IMPLICIT_STATE_SOURCES` 가 따라 생긴다 (`state/implicitState.ts:32-42` 의 값 형 표 — `number` · `boolean` 은 이미 있다). 새 값 형 0. 연결 대상이 곧 실행 상태의 정본이다 (§5.3) — 사용자 결정 1 이 「Group 값 하나」 나 「둘 다」 로 정해져도 정본은 Panel 이고 Group 값은 거기서 파생한다.
- Do: 「Collapse panel」 · 「Expand panel」 · 「Toggle panel」 (대상 = Panel).
- When: Panel 「Resize」 (끌기 끝 · 키 한 단계마다) · 「Collapse change」.
- 재방문 복원 (사용자 결정 5 의 권고안): Group `rememberSizes` — Publish 에서만 그 브라우저에 저장한다 (저장 값 = 그 Group 의 Panel id → `size` · `isCollapsed`, 열 때 Panel 의 실행 상태로 되읽는다). Table 「Remember state」 (`Table.binding.ts:98` · `runtime/tableState.ts:403-439`) 와 같은 방식 · 같은 저장 키 규칙. Builder 의 Preview 는 저장하지 않는다.

### 5.5 Canvas 편집

- Canvas 는 `defaultSize` · `defaultCollapsed` 로 정적 배치만 한다 — 끌린 크기는 실행 상태다.
- Panel 을 고르면 main 축 크기 손잡이가 `width` · `height` 대신 `defaultSize` 를 쓴다 (사용자 결정 3 의 권고안). cross 축 손잡이는 내지 않는다 (Group 이 정한다). Handle 노드는 고를 수 있고 옮기거나 크기를 바꿀 수 없다.
- Layers: Group > Panel · Handle · Panel. Panel 의 「Add panel」 은 Group 의 패널 편집기와 Layers 메뉴에 둔다.

### 5.6 pill 손잡이 (Phase 4)

- Handle rule 의 `paint` 조건 트리 한 곳: 기본 · hover · pressed (끌기 중) · focus-visible · disabled (ADR-297). `variant: pill` 은 가운데 capsule 의 길이 · 두께가 상태마다 다르다.
- 길이 변화의 움직임은 rule 의 `transition` (DOM). Canvas 는 상태별 정지 모양만 그린다 — 「같은 상태에서 같은 모양」 이 대칭 기준이다.
- 끌기 중 상태는 `data-resizing` (포인터 끌기일 때만 — 키 조작에는 붙이지 않는다, 빌더 `PanelSplitter` 와 같다).

## 6. Phase

| Phase | 내용                                                                                                                                                                    | Gate |
| :---: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--: |
|   0   | 코드 사실 재대조 · reui 예제 10 전부 읽기 · v3 확인 · 시제품 4 (§7) · 기준선 (번들 · ratchet)                                                                           |  G0  |
|   1   | 등록 — binding 3 · catalog entry · rule 3 · traits · nesting · requiredParts · origin template · `_panelGrow` 파생 · Canvas 정적 배치 · DOM 정적 renderer · contract 78 |  G1  |
|   2   | Preview runtime — 계산 모듈 · Handle 컴포넌트 (lazy) · 끌기 · 키 · min / max · 중첩 · D1 예외 속성                                                                      |  G2  |
|   3   | 접기 · 펼치기 — `collapsible` · `collapsedSize` · `defaultCollapsed` · Enter · 더블클릭 · Do 3                                                                          |  G3  |
|   4   | pill 손잡이 — `variant` · 상태 칠 · transition                                                                                                                          |  G4  |
|   5   | 상태 연동 — Panel 상태 concept 2 · When 2 · `rememberSizes`                                                                                                             |  G5  |
|   6   | Design 패널 편집기 (Group 의 Panel 목록 · 크기 칸) · 팔레트 · 짝 유지 명령 · Canvas 크기 손잡이 · 규칙 문서 D1 목록 옮김 · 종결 live · CHANGELOG                        |  G6  |

Phase 1 이 끝나면 정적 분할 (끌 수 없는 2 · 3 분할) 로 커밋 가능한 상태다. 각 Phase 끝이 커밋 단위다.

## 7. Phase 0 시제품

| #   | 묻는 것                                                                                                                                  | go 기준                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| P1  | 엔진이 `flexGrow` 몫 + `flexBasis: 0px` + px 손잡이 + `min` · `max` + px 접힘 (`flexGrow 0` · px basis) 을 Chrome 과 같은 rect 로 푸는가 | fixture 7 (가로 · 세로 · 3 분할 · 중첩 · min 걸림 · max 걸림 · px 로 접힘) ±1 px |
| P2  | `useMove` 끌기에서 `style.flexGrow` 직접 쓰기로 프레임이 서는가 (Panel 안 Table 1,000 행 · 중첩 2 단)                                    | 끌기 중 frame p95 ≤ 16.7 ms (CPU 1x), 4x 값 병기                                 |
| P3  | 중첩 Group 에서 안쪽 Handle 의 끌기 · 키가 바깥 Group 으로 번지지 않는가 · Panel 안 iframe 위에서 끌기가 끊기는가                        | 번짐 0 · 끊김 0 (끊기면 가림막을 둔다)                                           |
| P4  | VoiceOver 가 separator 의 이름과 값 (%) 을 읽는가 (Chrome · Safari)                                                                      | 사용자 청취 — 읽지 못하면 `aria-valuetext` 를 §4 목록에 더할지 보고              |

## 8. 파일 추정 (Phase 0 에서 확정)

| 영역                    | 파일 (예상)                                                                                                                                                                                                                                                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 등록 (shared)           | `catalog/bindings/Resizable{PanelGroup,Panel,Handle}.binding.ts` · `bindings/index.ts` · `componentCatalog.ts` · `generated/componentRulesTable.ts` · `domain/componentTraits.ts` · `nesting/nestingRules.ts` · `nesting/requiredParts.ts` · `document/d2Provenance.ts` · `document/types.ts` (contract) · `document/generated/reusableOriginLibrary.ts` |
| 배치 · runtime (shared) | `runtime/compositionRoot.ts` (파생 몫 · `styleOf`) · `runtime/delegatedDom.runtime.ts` (정적 renderer · 실행 상태) · `runtime/resizablePanels.ts` (새 파일 — 계산) · `runtime/resizable.components.tsx` (새 파일 — Handle, lazy)                                                                                                                         |
| 상태 · 명령 (shared)    | `interactions/componentInteractionSpecs.ts` · concept 정의 · `commands/` (짝 유지 · Do 3) · 저장 (`rememberSizes`)                                                                                                                                                                                                                                       |
| builder                 | `catalogRuntime/canvasBinding.ts` · `panels/components/paletteItems.ts` · Design 패널 편집기 · Canvas 크기 손잡이 분기 · i18n `messages/en-US.ts`                                                                                                                                                                                                        |
| 테스트                  | 계산 정답표 (unit) · 등록 게이트 · parity fixture (browser) · 닫힌 목록 정적 검사 · live 하니스                                                                                                                                                                                                                                                          |

추정: shared 16 ~ 22 · builder 8 ~ 12 파일 + 테스트.

## 9. Phase 결과

(각 Phase 종료 시 기록)
