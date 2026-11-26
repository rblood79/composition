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

> **2026-11-26 Phase 6**: 아래 목록 전문을 `.claude/rules/ssot-hierarchy.md` §1 D1 「Resizable 손잡이 예외」 로 옮겼다 — 이제 그 줄이 정본이고 이 절은 설계 기록이다.

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

| 키         | 동작                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------ |
| 화살표     | Group 축의 두 방향으로 한 단계 (5 % — 라이브러리 4.24.2 도 prop 없는 고정 5, Phase 0 대조) |
| Home · End | 앞 Panel 을 가장 작게 · 가장 크게                                                          |
| Enter      | 앞 Panel 이 `collapsible` 이면 접기 · 펼치기                                               |

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
- **끌기 중 가림막 (Phase 0 P3 로 확정)**: 손잡이가 **pointerdown 에서** `setPointerCapture` 를 잡는다 — Panel 안 iframe 위에서 움직이고 놓아도 이벤트가 손잡이로 온다. `useMove` 의 `onMoveStart` 에서 켜면 늦다 (첫 이동이 iframe 위면 영영 오지 않는다). 가림막이 없으면 iframe 위에서 놓은 끌기가 끝나지 않고 다음 포인터 이동을 계속 따라간다 (Chrome · WebKit 둘 다 재현). Panel 들의 `pointer-events` 를 끄는 방식도 통과했지만 rule selector · Group 속성이 하나 더 필요해 capture 를 고른다. `useMove` 는 포인터 capture 가 아니라 window 전역 listener 다 (react-aria 3.53.1 `useMove.mjs:114-198`).
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

| #   | 묻는 것                                                                                                                                  | go 기준                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | 엔진이 `flexGrow` 몫 + `flexBasis: 0px` + px 손잡이 + `min` · `max` + px 접힘 (`flexGrow 0` · px basis) 을 Chrome 과 같은 rect 로 푸는가 | fixture 8 (가로 · 세로 · 3 분할 · 중첩 · px min · % max (인라인 축) · % min (블록 축) · px 로 접힘 — 몫보다 넓은 내용 포함) ±1 px · Chrome = 식이 뜻한 크기 ±0.5 px |
| P2  | `useMove` 끌기에서 `style.flexGrow` 직접 쓰기로 프레임이 서는가 (Panel 안 Table 1,000 행 · 중첩 2 단)                                    | 끌기 중 frame p95 ≤ 16.7 ms (CPU 1x), 4x 값 병기                                                                                                                    |
| P3  | 중첩 Group 에서 안쪽 Handle 의 끌기 · 키가 바깥 Group 으로 번지지 않는가 · Panel 안 iframe 위에서 끌기가 끊기는가                        | 번짐 0 · 끊김 0 (끊기면 가림막을 둔다)                                                                                                                              |
| P4  | VoiceOver 가 separator 의 이름과 값 (%) 을 읽는가 (Chrome · Safari)                                                                      | 사용자 청취 — 읽지 못하면 `aria-valuetext` 를 §4 목록에 더할지 보고                                                                                                 |

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

### Phase 0 (G0) — 2026-11-26 닫힘

HEAD `bd088d28b` (ADR-317 Phase 0 ~ 3 위). 실행 = parity browser test + `apps/builder/scripts/adr318-phase0-prototypes.mjs` (시제품 `adr318Prototypes.mjs` — 설치된 react-aria 3.53.1 · RAC 1.22.1 위의 작은 Resizable, production lib build, headed Chrome 156 · Playwright WebKit). 결과 원본은 로컬 scratchpad (커밋하지 않음).

**코드 사실 재대조 (F1 ~ F10)** — 내용 차이 0. 줄 번호만 ADR-317 커밋으로 밀렸다: `catalogPreviewInteractions.ts` `mirrorsOf` :346 → :348 · `setRuntimeProps` :1470 → :1503 · 미러 쓰기 :1500-1507 → :1534. F1 RAC 1.22.1 의 `.d.ts` 에 splitter · splitview · PanelGroup 0 건 (같은 검색으로 `ColumnResizer` 3 건 — 검색 유효). F2 S2 1.8.2 `src` = `Divider.tsx` · `SideNavPanel.tsx` 뿐. **v3**: `@react-spectrum/splitview` 는 npm 에 없다 (404), `@adobe/react-spectrum` 3.47.7 의존 목록에 split · resiz · panel 0 — D2 정본 순서 4 (composition 확장) 확정. F10 은 아래 기준선으로 갱신.

**reui 예제 10 전부 읽음** (`keenthemes/reui` main `registry-reui/bases/base/components/resizable/c-resizable-1..10.tsx` · `meta.json` · `registry/bases/base/ui/resizable.tsx`): 1 세로 (머리 25 / 75) · 2 가로 (사이드 25 / 75) · 3 중첩 가로 40 / 60 안 세로 30 / 70 · 4 중첩 + `withHandle` (크기를 `"50%"` 글자로) · 5 ~ 7 pill (가상 요소 `before:` — 배치 밖 · 기본 h 24px w 4px → hover 32 ~ 40px → 누름 48 ~ 80px · w 6px · primary 색, `transition 300ms`, 7 은 누름에 선 전체도 primary 20 %) · 8 중첩 pill (세로 Group 은 pill 의 h · w 를 바꿔 쓴다) · 9 3 분할 25 / 50 / 25 + 모두 `minSize` · 10 `onLayoutChange` 로 % 읽기. Group 높이는 `min-h-[300px]` (main 축이 min-height 뿐) — basis `0px` 라 그래도 몫이 선다 (`%` basis 면 HC8 위반). pill 은 사용자 결정 7 의 「하나」 권고와 맞고, Phase 4 의 Canvas 는 손잡이 밖으로 나가는 겹침 모양을 그린다.

**라이브러리 4.24.2 대조** (scratchpad 에 `npm pack` — 실행하지 않음): 키 한 단계 = 고정 5 (prop 없음 — 사용자 결정 6 권고 그대로) · 축과 다른 화살표도 `preventDefault` (우리는 하지 않는다 — §4) · Enter 펼치기 = 접기 전 크기, 없으면 `minSize` (Phase 3 에서 같은 뜻) · JS gzip 69,196 B 재확인.

| 시제품                                             | 결과                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 판정                                                                                                                                   |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| P1 엔진 flex 몫 rect                               | `tests/parity/adr318ResizableFlexShare.browser.test.ts` 16/16 — fixture 8 의 engine = Chrome ±1 px, Chrome = 식이 뜻한 크기 ±0.5 px (중첩 안쪽 Group 의 `height: 100%` 가 stretch 된 부모 Panel 높이로 풀림 · 몫보다 넓은 내용은 overflow hidden 으로 자동 최소 0)                                                                                                                                                                                               | go                                                                                                                                     |
| P2 끌기 프레임 (Chrome, 교대 3 쌍 중앙값, visible) | 가상 스크롤 Table 1,000 행: p95 10.3 ms (실행 상태 rAF arm) · 10.3 (끌기 끝 arm) · CPU 4x 10.2 · LoAF 0. **불리한 경우** — 가상 없는 1,000 행 (`rowDisplay` 「pages」 1,000 같은 작성): 1x p95 41.5 (rAF arm) · 35.0 (끌기 끝 arm) · 4x 141 · LoAF 300                                                                                                                                                                                                           | 가상 = go. 가상 없음 = 기준 밖 — 내용 재배치 비용 (두 arm 차이 6 ms 만 실행 상태 몫). 사용자 답 「그대로 실시간 · 한계로 기록」 (아래) |
| P3 중첩 번짐 · iframe                              | 안쪽 손잡이 키 · 끌기 → 바깥 · 가운데 값 그대로 (Chrome · WebKit). 축과 다른 화살표 → `document` 까지 가고 막지 않음 · Chrome 은 페이지 스크롤 (WebKit 은 대조군 div 도 스크롤하지 않아 같은 결과). iframe: 가림막 없음 = 놓은 뒤에도 끌기가 이어짐 (두 브라우저 재현 — 대조군) · pointerdown 의 pointer capture = 통과 · Panel `pointer-events` 끄기 = 통과. 잡는 영역 (가상 요소 양옆 4 px) 이 없으면 1 px 손잡이의 가운데 좌표가 WebKit 에서 iframe 을 짚는다 | go — capture 채택 (§5.3) · 잡는 영역 필수 (§5.2)                                                                                       |
| P4 접근성 값                                       | Chrome 접근성 트리: separator 3 개 모두 이름 · 값 · 최소 · 최대 · focus 가능 · 방향. WebKit: 이름 (aria snapshot) · 속성. **VoiceOver 청취는 사용자** — `node apps/builder/scripts/adr318-phase0-prototypes.mjs <out> --serve` 의 `#auto` 주소                                                                                                                                                                                                                   | 트리 go · 청취 대기 (G2 · G6 에서)                                                                                                     |

**기준선**: initial gzip Builder 1,634,229 / 1,650,000 B (여유 15,771 — F10 의 1,629,237 에서 ADR-317 Phase 0 ~ 3 이 +4,992) · Preview 172,213 / 327,000 (src = HEAD 로 `vite build` → `adr209-bundle-closure.mjs`). ratchet (`pnpm gate:perf-ratchet`): HEAD 가 이미 block — 등급 A 초과 98 (select · edit 부류, 318 src 변경 0 인 상태). 318 의 Phase 는 이 값과의 차이로 본다.

**사용자 답 (2026-11-26)**: 결정 2 = 기본 크기 % · 최소 · 최대 · 접힌 크기 % 와 px · 결정 8 = Builder +4,000 · Preview +2,000 B · P2 = 끌기는 실시간 그대로, 가상 없는 큰 내용의 프레임은 한계로 기록 (HC5 의 go 측정은 가상 Table).

**리뷰 LOW 3 흡수**:

- % 의 기준 — 작성 · 실행 · 낭독의 % (`defaultSize` · `size` · `aria-valuenow`) 는 손잡이를 뺀 자리의 %. CSS `min` · `max` 의 % 는 Group main 전체에 대해 풀리므로 계산 모듈은 % 한계를 `한계 × Group main ÷ (Group main − 손잡이 합)` 으로 바꿔 쓴다 — CSS clamp 와 계산이 같은 px 에서 멈춘다 (G2 정답표에 한 줄).
- fixture 목록 한 벌 — 본문 Gates 의 입력 차원과 §7 P1 이 같은 8 이다 (위 표).
- 인용 정밀도 — `_justified` 의 계산 자리 `presence.ts:4362` · DOM 자리 `domBinding.runtime.ts:1052` (§8 파일 추정에 `presence.ts` · `domBinding.runtime.ts` 를 더한다). `useMove` = window listener (위 가림막 줄).

**Phase 1 에 넘기는 것**: contract — ADR-317 Phase 4 가 78 을 쓸 계획이라 (317 breakdown §9) 318 은 그 다음 번호 (착수 때 `LIBRARY_CONTRACT_VERSION` 을 다시 본다).

### Phase 1 (G1) — 2026-11-26 구현 · live 통과 (contract · 번들 Δ 는 ADR-317 Phase 4 커밋 뒤)

등록: binding 3 (`bindings/Resizable.binding.ts`) · catalog entry 3 · rule 3 (`rule/resizable.ts` — rules table 에 세 줄) · traits (Group = 엄격 항목 목록 `children: [Panel, Handle]` · Panel = 자유 내용 · 둘 다 owners Group) · D2 출처 (`CATALOG_D2_COMPOSITION_TYPES` 3) · 원본 `resizableOrigins.ts` (Group 폭 100 % · 높이 200 · slot `Panels` · Panel · Handle · Panel) · 팔레트 원본 · 팔레트 항목 (layout — G1 live 확인용으로 Phase 6 에서 앞당김) · 생성 CSS 3 · index.css 3.

크기 식: `runtime/resizablePanels.ts` 한 곳 — Panel 파생 (`_panelGrow` · `_panelAxis` · `_panelMin` · `_panelMax`) · Group 파생 (`_resizableDirection`) · Handle 파생 (`orientation` · `_resizableHandleAxis` · 중첩이면 `_resizableNested`) 을 `presence.ts` 가 싣고, `catalogResizableLayout` 하나를 Canvas `styleOf` (`itemLayout` 앞 — 작성값이 이김) 와 DOM `authoredStyle` (맨 앞 — 같은 순서) 이 같이 쓴다.

계획과 달라진 것 (사후 보고):

- **축 값을 rule `containerVariants` 에서 파생 값으로**: Canvas 배치는 rule 의 `containerVariants` 를 읽지 않는다 (Style 패널 전용) — 첫 live 에서 Handle 폭 Canvas 0 · DOM 1. Group 방향 · Handle 두께를 파생 값으로 옮겼다.
- **DOM 의 자리는 `catalogDomStyle` 이 아니라 `authoredStyle`**: 세 type 은 `CATALOG_DELEGATED_DOM` renderer 라 inline 이 `authoredStyle` 에서 온다 — 첫 live 에서 Publish Panel 폭 0.
- **형제 · 자식 재계산 의존 (`catalogDerivedPropsDependents`)**: 빼도 단위 root (`adr318ResizableWiring.test.tsx`) 는 통과했지만 live 는 실패했다 (defaultSize 30 뒤 오른쪽 Panel 50 그대로 · 세로 전환 뒤 Handle 가로 두께). 단위 root 가 왜 재현하지 않는지는 확인하지 못했다 — 증분 경로의 정본 검사는 live 하니스.
- 필수 부품 (`requiredParts`) 은 두지 않았다 — 그 표는 「지울 수 없음」 계약이라 Panel 하나하나가 삭제 불가가 된다. 짝 · 개수는 Phase 6 명령이 지킨다.

검증:

- 단위: `packages/shared/src/catalog/runtime/__tests__/adr318ResizablePanels.test.ts` (몫 · 길이 · 파생 · 배치 값) · `apps/builder/src/builder/catalogRuntime/__tests__/adr318ResizableWiring.test.tsx` 3/3 (원본 → Canvas 상자 · DOM inline · 편집 · ⌘Z). 원복 RED: `styleOf` 의 배치 값 제거 → 2 실패 · `authoredStyle` 의 배치 값 제거 → 2 실패 (trap 복원 · cmp 일치).
- 등록 게이트: shared 전체 262 파일 통과 (randomUndo 는 전체 부하의 5 초 시간 초과 — 단독 통과) · builder unit 실패 19 파일은 등록 oracle 3 건 (팔레트 · G3 집계 · 항목형 원본 Slot) 을 고친 뒤 나머지 전부 부하 시간 초과로 단독 재실행 통과 · `codex:registration` · `css-boundary` · `chart-contract` · `agent-catalog` · `skills:gate` · `docs:rule-size` · `d2S2Alignment.static.test.ts` 통과. `codex:format:check` 는 다른 세션 파일 · 기존 포맷 차이로 실패 (제 hunk 아님).
- **live** `apps/builder/scripts/adr318-g1-live.mjs` — Chrome · WebKit 각 14/14: 팔레트 → Group > Panel · Handle · Panel · 기본 50/50 · defaultSize 30 · minSize 200px · maxSize 40 % · 세로 — 각 상태 Canvas record 상자 = Publish `getBoundingClientRect` ±1 px = 식이 뜻한 크기 · 손잡이 1 px · D1 (Group · Panel 은 role 없는 div) · Handle 선 = 토큰 `--neutral-surface-hover` · Panel 칠 없음 · page error 0.

**닫힘 (2026-11-26, ADR-317 Phase 4 `63db458e6` 뒤)**: contract 78 → **79** (`types.ts` · fixture 32 파일 — 다른 세션의 미커밋 변경이 없는 것을 확인하고 올림). 번들 Δ — HEAD `63db458e6` worktree 에 이 ADR 의 hunk 만 얹어 (공유 파일의 다른 세션 hunk 는 빼고 — worktree 타입 검사 통과) `vite build` → `adr209-bundle-closure.mjs`: **Builder 1,634,850 → 1,638,084 (+3,234) · Preview 172,215 → 172,213 (−2) B gzip** — 사용자 결정 8 (+4,000 · +2,000) 안, 절대 상한 1,650,000 안. 끌기 · 키 코드는 lazy chunk `resizable.components` 로 빠졌다. (Phase 3 의 접힘 개념 · 계산까지 포함한 값.)

### Phase 2 (G2) — 2026-11-26 닫힘 (VoiceOver 청취만 대기)

사용자 결정 4 = 양옆 두 Panel 만 (권고). 계산: `catalogResizableMove` · `catalogResizableRange` · `catalogResizableLimits` (% 한계 = Group 전체 기준을 손잡이를 뺀 자리로 환산 — 리뷰 LOW) · `RESIZABLE_KEY_STEP` 5. 손잡이: `runtime/resizable.components.tsx` (lazy — 실행 중 Preview 에서만, 그 전엔 같은 상자의 정적 선) — `useMove` 의 포인터 handler 만 · `useKeyboard` 가 축 방향 화살표 · Home · End · 나머지 `continuePropagation` · pointerdown 의 pointer capture · `useFocusRing` · 끌기 중 두 Panel `flexGrow` 와 `aria-valuenow` 를 DOM 에 직접, 실행 상태 (Panel 마다 `size`) 는 rAF 와 끝에. Panel renderer 는 실행 `size` 를 flexGrow 로 · `id` = record `htmlId`. Handle 은 같은 Group 의 형제를 구독한다 (`watchesChildren`). binding: `isDisabled` (Group · Panel · Handle) · Handle `aria-label` (패널 비노출). rule: 잡는 영역 가상 요소 (양옆 4 px) · 축 커서 · `touch-action: none` · focus ring · 중첩 손잡이의 잡는 영역은 `z-index: 0`.

live 가 잡아 고친 것 (각각 수리 전 실패를 먼저 봄):

- 키를 누르면 Panel 은 바뀌는데 `aria-valuenow` 가 50 에 남고 다음 키 · 끌기가 옛 크기에서 시작 → Handle 이 형제 Panel 의 실행 상태를 구독.
- `aria-controls` 가 없는 id 를 가리킴 — Panel 요소의 id 는 자동 HTML id (`resizablepanel_1`) → `catalogResizablePanelDomId` 가 record `htmlId` 를 먼저.
- T 교차점: 바깥 세로선 가운데가 안쪽 가로 손잡이와 만나는 자리에서 안쪽이 끌림 (`elementsFromPoint` 로 확인 — 안쪽 잡는 영역이 뒤에 그려져 위) → 중첩 손잡이의 잡는 영역을 한 층 아래 (파생 `_resizableNested` → `data-nested`).

검증: 단위 `adr318ResizablePanels.test.ts` (정답표 — 양옆 두 Panel · 한계에서 멈춤 · 움직임 없으면 같은 배열 · Home/End · % 환산 · DOM id) · `adr318D1List.static.test.ts` (ARIA 속성 = §4 목록 7 + role separator · 키 = 축 화살표 4 · Home · End · `useMove` 의 key handler 를 뺌 · Group · Panel renderer 에 role · ARIA 없음) — 17/17. **live** `apps/builder/scripts/adr318-g2-live.mjs` — Chrome · WebKit 각 8/8: separator 속성 (controls = 앞 Panel · 이름 = 사이트 언어) · 키 (55 · 45 · End 100 · Home 0 · Panel 폭 = 그 % · 축 밖 ArrowDown 은 값 그대로 · 막지 않음) · T 교차점 끌기 +120 px (바깥 선이 잡힘 · `data-resizing` 은 끌기 중에만) · 최소 200 px 에서 멈춤 · 중첩 번짐 0 · 비활성 Group · page error 0. G1 live 재실행 14/14 (D1 단언을 Handle = separator 로 갱신).

남은 것: VoiceOver 청취 (사용자 — G6 와 함께) · 끌기 프레임 HC5 측정은 Phase 6.

### Phase 3 (G3) — 2026-11-26 닫힘

접힘의 이름: 동작은 react-resizable-panels (`collapsible` · `collapsedSize`), 상태는 S2 SideNavPanel 의 이름 (`isCollapsed` · 숨은 `defaultCollapsed` · `onCollapsedChange`) — 분할창은 S2 · RAC 어디에도 없어 같은 저장소의 접힘 이름을 따랐다. Panel binding: `collapsible` · `collapsedSize` (% · px — 사용자 결정 2) · `isCollapsed` (둘 다 `collapsible` 일 때만 패널에) · `defaultCollapsed` (패널 비노출).

화면 몫은 한 함수 (`catalogResizableDisplay`): 접힌 Panel = 접힌 크기 (% 면 그 몫, px 면 basis 와 몫 0), 나머지는 남은 자리를 펼친 몫의 비율로 — 펼치면 접기 전 배치로 돌아간다. 실행 상태는 Panel 마다 `size` (펼친 몫) · `isCollapsed`. Canvas 는 시작 접힘 (`isCollapsed ?? defaultCollapsed`, `collapsible` 일 때만) 을 같은 함수로 그리고 (파생 `_panelShare` · `_panelBasis` · `_panelCollapsed` · `_panelCollapsedSize`, 접힌 Panel 은 min 없음), Preview 는 Panel · Handle renderer 가 공용 `resizableRuntimePanels` 로 형제의 실행 상태를 읽는다 (Panel 도 형제를 구독 — 하나가 접히면 나머지 몫이 바뀐다).

동작: Enter · 더블클릭 = 앞 Panel 접기 · 펼치기 (`isCollapsed` 만 쓴다 — Do 와 같은 길). 끌기 · 키 = `catalogResizableMoveCollapsing` — min 과 접힌 크기의 가운데를 넘으면 접히고 (앞 · 뒤 Panel 둘 다), 접힌 Panel 을 그 가운데 너머로 당기면 min 에서 펴진다. 접을 수 없는 Panel 은 min 에서 멈춘다. separator 의 범위는 접을 수 있는 앞 Panel 이면 접힌 크기까지. Do 3 (「Collapse」 · 「Expand」 · 「Toggle collapse」) = 접힘 개념 (`concepts/collapse.ts` `resizablePanelCollapse`) — guard `collapsible` (`constraints.ts` `declaredRefusal` — 실행과 패널 노출이 같은 판정). When 「Collapse change」 는 Phase 5 (이 Phase 는 `events: []`).

live 가 잡아 고친 것: 임계를 넘어 접고 같은 끌기에서 다시 넘어 펴면 Chrome 에서 한 번 앞 Panel 이 87 % 로 남았다 (WebKit · 앞선 Chrome 실행은 통과 — 타이밍). 끌기가 다음 이동을 props (쓰기 뒤 다시 그려지기 전의 옛 접힘) 와 비교한 탓 → 끌기가 자기가 마지막으로 쓴 상태 (`written`) 를 들고, 접힘이 한 번 바뀐 끌기는 이후 매 이동을 바로 쓴다. 수리 뒤 Chrome 3 회 · WebKit 통과.

검증: 단위 `adr318ResizablePanels.test.ts` (접힘 표시 % · px · 시작 접힘 파생 · 접을 수 없는 Panel 은 무시 · 임계에서 접힘 · 그 위는 min · 접힌 Panel 펴기 · 뒤 Panel 접힘 · 접을 수 없으면 min 에서 멈춤) · `adr318D1List.static.test.ts` (키에 Enter) · `interactions/__tests__/adr318PanelCollapse.test.ts` (Do 3 = `isCollapsed` 쓰기 · guard `collapsible` · When 없음 · 상태 거울 `isCollapsed`). **live** `apps/builder/scripts/adr318-g3-live.mjs` — Chrome · WebKit 5/5: Enter → 48 px · `data-collapsed` · valuenow = valuemin = 48 의 % · Enter → 반 · 더블클릭 접기 · 펴기 · 끌기 임계 (124 px) 넘어 접힘 → 다시 넘어 min 200 에 펴짐 · 시작 접힘 Canvas 48 = Publish 48 · 접을 수 없는 Panel 의 Enter 는 값 그대로 · page error 0. G1 14/14 · G2 8/8 재실행 통과.

UNVERIFIED: Do 3 의 live 실행 (규칙을 만들어 누르는 흐름) — 등록 · guard · 노출은 단위로, 쓰는 prop (`isCollapsed`) 을 renderer 가 읽는 길은 Enter · 더블클릭 live 로 확인했다. Phase 5 의 상태 연동 live 에서 규칙 실행을 같이 본다.

### Phase 4 (G4) — 2026-11-26 닫힘

사용자 결정 7 = 하나 (권고). Handle `variant` (`line` 기본 · `pill` — 두 variant 는 같은 선, pill 은 그 위의 장식) · `withHandle` (shadcn / reui grip). 값은 한 모듈 `document/resizableChrome.ts` — pill 상태 표 (휴지 4 × 24 `--border` · hover 4 × 40 `--border-hover` · 끌기 중 6 × 48 `--accent`, reui 예제 5 · 8 의 값) · grip (12 × 16 · 모서리 4 · `--border` · glyph `grip-vertical` / `grip-horizontal` 10 px) 을 DOM (Handle rule `rootSelectors` — pill = `::before`, 6 × 48 상자를 상태마다 `transform: scale` 로 줄임 · grip = 자식 `span.resizable-grip`) 과 Canvas (`ruleShapes.ts` `catalogResizableHandleShapes` — 상태 카드의 정지 모양, R8) 가 같이 읽는다 (Sheet 손잡이 `sheetChrome.ts` 와 같은 방식). 움직임은 `transform` · 배경색 300 ms (reui ease) 이고, 실행 중 손잡이가 `prefers-reduced-motion` 이면 `data-reduced-motion` 으로 끈다 (생성 시트는 가상 요소에 동작 줄이기 블록을 내지 않는다).

ADR-297 게이트 (`componentRulesTable.static.test.ts` 「& 대상 rootSelectors 키의 styles 0」): Handle 자신의 상태 분기 (`&[data-orientation]` · `&[aria-disabled]` 의 커서) 를 잡는 영역 가상 요소 (`::after`) 로 옮겼다.

live 가 잡아 고친 것: 비활성 손잡이가 hover 에 pill 을 키우지 않게 hover 선택자에 `:not([aria-disabled="true"])` 를 넣자 끌기 중 모양이 hover 에 졌다 (우선순위) → pressed 선택자도 같은 무게로 두고 뒤에 둔다.

검증: 단위 `apps/builder/src/builder/catalogRuntime/__tests__/adr318HandleChrome.test.ts` 7/7 (line 은 장식 없음 · pill 상태별 Canvas 크기 · 세로 Group 은 가로로 누운 pill · grip 상자 · glyph · DOM scale = Canvas 크기 / 6 × 48). **live** `apps/builder/scripts/adr318-g4-live.mjs` — Chrome · WebKit 5/5: Publish `::before` 의 크기 × transform = 휴지 4 × 24 · hover 4 × 40 · 끌기 중 6 × 48 · 놓으면 hover 로 · 색 = 상태 토큰 · 비활성은 hover 에도 휴지 · grip 12 × 16 이 선 가운데 · glyph svg · keyboard focus → `data-focus-visible` · outline 2 px · page error 0. Canvas · Publish 스크린샷을 눈으로 대조 (pill · grip 같은 자리).

### Phase 5 (G5) — 2026-11-26 닫힘

사용자 결정 1 = Panel 마다 숫자 (권고 — 새 값 형 0, R5 해당 없음), 결정 5 = Group 「Remember sizes」 (권고).

- **개념** (`interactions/concepts/collapse.ts`): 접힘 개념의 When 을 숨김에서 꺼냄 (`onCollapsedChange` 인자 `isCollapsed`) + 크기 개념 `resizablePanelSize` (state `size` number · When `onSizeChange` 인자 `size`, Do 없음 — 손잡이가 바꾼다). spec `ResizablePanel` = 두 개념. **사후 보고**: When 이름을 react-resizable-panels 의 `onResize` 가 아니라 `onSizeChange` 로 둠 — `onResize` 는 은퇴한 DOM 별칭 목록 (`capabilityRegistry.test.ts`) 에 있다. 표시 이름은 「On panel resize」 · 「패널 크기가 바뀔 때」.
- **실행**: Panel 요소가 규칙 handler 를 받아 (`withRuntime` → `CatalogResizablePanelBox`) 요소별로 등록하고 (`catalogRegisterResizablePanelEvents` — Panel 은 자기 상호작용이 없다), 손잡이가 바꾼 뒤 부른다 — 키 한 단계 · Enter · 더블클릭은 그때, 끌기는 놓을 때 한 번 (시작 상태와 비교). Do 의 쓰기는 When 을 부르지 않는다 (RAC 의 change callback 과 같다). 크기 값은 0.01 % 로 자른다 (`catalogResizableShareValue`). 시작 값: `isCollapsed` = `collapsible` 일 때 `isCollapsed ?? defaultCollapsed`, `size` = 파생 펼친 몫 (`catalogStateSourceValue`).
- **Remember sizes** (Group `rememberSizes` — composition 확장): 세션이 실행 값 쓰기 중 Panel 의 `size` · `isCollapsed` 만 그 브라우저 저장소 (Publish `localStorage`, 세션의 `tableStateStorage` — Builder Preview 는 넘기지 않아 저장 0) 에 프로젝트별로 둔다 (`composition:resizable:v1:<projectId>`). 복원은 root 가 서거나 페이지가 채워질 때 · 실행 runtime 이 붙을 때 record 마다 한 번, 규칙 runtime 의 쓰기로 (손잡이 · 이름 붙인 상태가 같은 값을 읽는다). 읽기는 값 검사 (0 ~ 100 · boolean) 를 지난다.

검증: 단위 `adr318ResizablePanels.test.ts` +4 (저장 조각 · 프로젝트별 왕복 · 깨진 값 · 0.01 %), `adr318PanelCollapse.test.ts` (When 2 · 상태 출처 2). shared 단위 1,598 · builder catalogRuntime · panels 5,728 PASS. **live** `apps/builder/scripts/adr318-g5-live.mjs` — Chrome · WebKit 7/7: 첫 화면 상태 = 시작 값 · → 키 → `!event.size` 55 · 끌기 중 When 없음 · 놓을 때 resized = leftSize = 그려진 몫 · Enter → 「Collapse change」 true / false · Do 「Toggle collapse」 (Button) → 48 px 접힘 · 상태 따름 · When 없음 · 다시 열면 그 크기 · 접은 뒤 다시 열면 접힘 · 스위치 끄면 작성 크기 · page error 0. **원복 RED**: Handle 의 When 호출 제거 → 2 · 3 · 4 FAIL, 기억 값 제거 → 5 FAIL (복원 cmp 확인). G2 8/8 · G3 5/5 회귀 PASS.

### Phase 6 (G6) — 2026-11-26 구현 닫힘 (Implemented 승격 대기 — VoiceOver 청취 · 사용자 확인)

사용자 결정 3 = 권고 (Canvas 주축 손잡이가 `defaultSize` 를 쓴다). 사용자 결정 8 고침 = Builder +5,500 B (실측 +5,183).

- **짝 유지 명령** (`commands/resizablePairs.ts`): Panel 삭제 → 앞 (없으면 뒤) Handle 같이 (`removeTargets`), Handle 단독 삭제 · 이동 · 복제 → `REQUIRED_PART_NOT_REMOVABLE` (패널 안내 「이 부품은 지우거나 밖으로 옮길 수 없음」), Group 안 Panel 이동 → Panel 순서만 바꾸고 Handle 자리는 그대로 다시 엮음 (`reweaveResizableGroup`), Panel 이 Group 을 떠나거나 다른 Group 에 들어가는 이동 거절, Panel 복제 → 앞에 Group 의 Handle 사본 (`duplicateNodes`), Group 「+」 → Handle + Panel 한 명령 (`insertGroupItem` 의 `before` 자리 · `GROUP_ITEM_TYPES.ResizablePanelGroup`). Slot 넣기 목록에서도 Handle 을 뺀다 (`slots.ts`). 붙여넣기 · 코드 보기 · AI 편집이 만든 깨진 순서는 그대로 그린다 (R4 — renderer 는 끌 수 없을 뿐 배치는 선다).
- **Canvas 크기 손잡이** (`canvasGesture.ts`): Panel 은 주축 가장자리 둘만 (`handleAccepted`), 끌면 미리보기 = 그 Panel 의 grow (형제 grow 는 그대로 — `g / (g + O)` = 몫), 놓으면 `defaultSize` (% 소수 1 자리) 를 `setFields` 한 step. Panel 가장자리에 놓인 padding 0 손잡이보다 크기 손잡이가 이긴다 (`spacingAt` — live 가 잡은 결함: 처음엔 padding 손잡이가 눌림을 가져가 끌어도 아무것도 쓰이지 않았다). Handle 은 크기 손잡이가 없다 (`resizable()`).
- **Design 패널**: 칸 라벨 번역 7 (`labels.ts` · en-US · ko-KR — Default size · Collapsible · Collapsed size · Collapsed · With handle · Remember sizes · Pill, Min · Max size 는 기존 키). 편집기 자체는 binding 이 만드는 칸 그대로 — Group 의 Panels 칸 (Slot) 이 「+」 다.
- **HC5** (`apps/builder/scripts/adr318-hc5-frame.mjs`): production 빌드 (`perf:build-dist`) · headed Chrome · 보이는 탭 · CPU 1x 와 4x · 교대 3 쌍 중앙값. 문서 = Group 1200 × 600 > Panel [Table 1,000 행 · 가상 스크롤] · Handle · Panel [세로 Group > Panel (이름 붙인 상태 `leftSize` 를 읽는 글자 3) · Handle · Panel]. 대조군 = 끌기 중 실행 상태 쓰기를 끌기 끝으로 민 빌드. **측정 조건**: 이 기기에서 보이는 탭의 idle rAF 간격이 20.0 ms (50 Hz) 라 16.7 ms 절대값은 잴 수 없다 — 판정은 `p95 ≤ max(16.7, idle + 1.7)` · LoAF 0. 결과 — 매 프레임 쓰기 판: 1x p95 21.8 · 4x p95 100.9 ms · LoAF 1,495 (FAIL), 끌기 끝 쓰기 판: 1x · 4x p95 20.9 · LoAF 0. 원인 대조: 이름 붙인 상태를 뺀 같은 문서는 매 프레임 쓰기 판도 4x p95 20.9 · LoAF 4 — 비용은 미러 변수 쓰기 → 세션 `changed()` 가 보기 전체를 다시 그리는 것 (모든 변수 쓰기에 공통인 경로라 이 ADR 범위 밖 — 프로필 상위 = React props diff · `createElement` · Virtualizer `getSize`). G6 의 실패 시 대안대로 끌기 중에는 DOM flex 값 · `aria-valuenow` 만 쓰고 실행 상태 · 이름 붙인 상태 · When 은 놓을 때 (`resizable.components.tsx` — 접힘이 바뀌는 순간은 그대로 즉시). 수정본 production 빌드 재측정 PASS, 수정 전 빌드는 같은 판정에서 FAIL.
- **번들** (임시 worktree — HEAD `63db458e6` 에 318 코드 hunk 만, 일반 `vite build` · `adr209-bundle-closure.mjs`): 처음 +5,929 B → 끌기 계산 (`runtime/resizableDrag.ts`) · 크기 기억 저장 (`runtime/resizableStorage.ts`) 을 `resizablePanels.ts` 에서 떼어 Builder 첫 화면 밖으로 (lazy Handle · Preview 세션만 읽는다) → **Builder initial JS gzip +5,183 · Preview +3 · Preview CSS +551** (1,640,033 / 1,650,000). 결정 8 의 Builder 값은 사용자 답으로 +5,500 (남은 몫은 Canvas 손잡이 · 짝 명령 · pill 값 · DOM renderer — Builder 가 늘 쓰는 코드).
- **D1 목록 → 규칙 문서**: `.claude/rules/ssot-hierarchy.md` §1 D1 「Resizable 손잡이 예외」 가 목록 전문 (속성 · 키 · 포인터 · 그대로 두는 것) — 대조 `adr318D1List.static.test.ts` 3/3, `docs:rule-size` OK.
- **사후 보고**: R7 대응의 「Phase 1 에서 Panel 의 main 축 크기 편집을 막는다」 는 하지 않았고 Phase 6 의 결정 3 구현이 그 자리를 대신했다.

검증: 단위 — `adr318PairCommands.test.ts` 5/5 (삭제 짝 · Handle 단독 거절 3 · 「+」 · 복제 · 이동 다시 엮음 · Group 밖 이동 거절), `phase4eItemInsert` (Group 항목 Slot = 「+」 = Panel, 넣으면 Handle + Panel), `interactionWhenReach` (When 「Resize」 · 「Collapse change」 행 — 키 · Enter 로 실행), shared 2,814 · builder 9,899 PASS (첫 전체 실행의 나머지 실패 16 은 부하 시간 초과 — 단독 재실행 PASS). **live** — `adr318-g6-live.mjs` Chrome · WebKit 5/5: Group Panels 칸에서 ResizablePanel → Panel · Handle · Panel · Handle · Panel · ⌘Z 셋 · 마지막 Panel Backspace → Panel 하나 · ⌘Z · Handle 만 Backspace → 그대로 (안내 toast) · 첫 Panel 오른쪽 손잡이 끌기 → Default size 25 · Canvas · Publish 모두 자기 Group 의 25 % · Panel 손잡이 좌우 둘 · Handle 0 · 라벨. G1 14/14 · G2 8/8 · G3 5/5 · G4 5/5 · G5 7/7 회귀 PASS.

**사용자 보고 수리 (2026-11-26 — 「마우스오버시 커서가 변하지만 드래그 시작시에는 resizable 커서가 유지되지 않는다」)**: 축 커서는 잡는 영역 `::after` 에만 있는데, 누를 때 pointer capture 를 받는 것은 손잡이 요소 자신 (커서 `auto`) 이고 9 px 영역을 벗어난 포인터 아래는 Panel 이다. 끄는 동안 문서 전체에 그 `::after` 커서를 건다 (`resizable.components.tsx` `catalogResizableDragCursor` — react-resizable-panels 의 전역 커서와 같은 방식, 값은 rule 그대로, 놓거나 손잡이가 사라지면 지운다). live G2 항목 8 — 수정 전 RED (끄는 동안 손잡이 · 영역 밖 모두 `auto`) → Chrome · WebKit PASS (`col-resize` 유지 · 놓으면 `auto`).

**사용자 제안 반영 (2026-11-26 — 「orientation 에 따라 resizablePanel 의 minsize, maxsize, defaultsize 는 layout 탭의 size 와 동기화」)**: Layout 탭 크기 칸은 Panel 을 따로 다루지 않아 같은 flex 값을 작성값으로 따로 썼다 — 작성값이 파생값을 이기므로 Width 「Fill」 은 `flexGrow` 로 `defaultSize` 를 덮고 (손잡이를 끌어도 몫이 안 바뀔 수 있다), 고정 px 는 `flexBasis 0px` 때문에 효과가 없고, Min · Max W 는 `minSize` · `maxSize` 를 덮었다. 저장 위치를 props 하나로: Panel 을 고르면 Layout 탭의 Group 축 칸 (가로 = Width · Min W · Max W, 세로 = Height 줄) 이 `defaultSize` (% — 단위 메뉴 reset · %) · `minSize` · `maxSize` (% · px) 를 읽고 쓴다 (`catalogStylesHost.ts` `catalogResizablePanelSizeAxis` — Column · ColorWheel 의 「Styles 칸 = prop」 과 같은 경로: `styleCommandOf` · `applySizing` · 보기 · scrub 미리보기는 Canvas 손잡이와 같은 grow 식). `defaultSize` 를 안 적은 Panel 은 지금 몫 (`_panelShare`) 을 보인다. 다른 축 칸은 꺼지고 그 축의 `applySizing` · Fill · px 크기는 거절된다. Property 탭의 세 칸은 `editorHidden` (Canvas 크기 손잡이 · Layout 탭이 편집 경로). 단위 `adr318PanelSizeFields.test.ts` 4 (host 를 HEAD 로 되돌리면 3 RED), live G6 항목 5 (Property 탭에 크기 칸 없음) · 6 (Layout 탭 Width 25 % 표시 · Height 꺼짐 · 40 → `defaultSize` 40 · box style 없음 · Canvas 40 % · Min W 120px → `minSize` · Max H 꺼짐 · ⌘Z) — Chrome · WebKit 6/6.

남은 것: VoiceOver 청취 (G2 · G6 — 사용자) 와 사용자 확인 → Implemented 승격 · `completed/` 이동.
