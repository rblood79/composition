# ADR-252: Properties · Styles 패널을 Design 패널 하나로 통합

## Status

Proposed — 2026-10-03

사용자 요청: `/create-adr Design 패널 통합 권장안으로` (2026-10-03). 방향은 2026-09-29 에 사용자가 정했다 — 두 패널을 한 패널의 탭 `Property | Layout | Style | Text | Screen | Modified` 로 합치고 이름은 Design, 겹치는 prop (`labelPosition` · `orientation`) 은 양쪽 탭에 그대로 둔다. 이번 요청의 「권장안」 은 같은 날 제시한 네 항목이다 — ① 패널 id `properties` 유지 (라벨만 Design) ② ⌥6 = Design 을 Layout 탭으로 열기 ③ Modified 는 1차에 style 만 ④ 탭 폭은 live 로 재고 부족하면 최소 폭을 올린다.

선행: [ADR-251](251-radio-checkbox-items-node-restore.md) (RadioItems 노드 복원). 문서는 지금 쓰고, 구현은 251 뒤에 한다.

> **2026-10-03 리뷰 round 1 반영** ([reviews/252.md](reviews/252.md), Codex — HIGH 0 · MEDIUM 1 · LOW 1): m1 — 같은 scope 의 두 복사 정의를 `canRun` · 탭 검사로 가를 수 없다 (dispatcher 가 첫 매치에서 멈춤) → 활성 탭의 쌍만 등록하는 배타적 등록으로 확정 (Decision 6 · R3 · G2). l2 (LOW deferred) — G3 「위치 보존」 을 배치 키 보존으로 좁히고 화면 좌표 재배치는 정상으로 명시. 대안 A 는 그대로다.

## Context

### 왜 합치는가

Properties 는 컴포넌트의 설정 (D2 prop) 을, Styles 는 시각 값 (D3 style) 을 편집한다. 둘은 한 요소의 두 면이라 사용자는 둘을 오가며 쓰고, 일부 prop 은 시각과 직접 닿는다 (`size` · `variant` · `labelPosition` · `orientation`). 두 패널이 따로 유지되는 동안 같은 컨트롤의 어법이 갈려 「Styles 기준으로 맞춤」 수리가 반복됐다 (`7b653100a` · `ad4a9e7de` · `0247dc3fd` · `4eba1eabb`).

ADR-248 뒤 두 패널은 이미 같은 토대 위에 있다.

| 항목            | Properties                                     | Styles                                                                                          | 코드                                                                                                                                                                                                                            |
| --------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 등록            | id `properties` · ⌥5 · 최소 폭 233             | id `styles` · ⌥6 · 최소 폭 233                                                                  | [panelConfigs.ts:220-247](../../apps/builder/src/builder/panels/core/panelConfigs.ts)                                                                                                                                           |
| 선택 읽기       | 같은 `CatalogWorkspace` 의 `session.selection` | 같음                                                                                            | [CatalogPropertiesPanel.tsx:63-68](../../apps/builder/src/builder/panels/properties/catalog/CatalogPropertiesPanel.tsx) · [catalogStylesHost.ts:227](../../apps/builder/src/builder/panels/styles/catalog/catalogStylesHost.ts) |
| prop 쓰기       | `catalogSemanticPatchCommand` → `setFields`    | 같은 명령 (Direction 토글이 `labelPosition` 을 쓸 때)                                           | `editContract.ts:146-193` · `catalogStylesHost.ts:303-316`                                                                                                                                                                      |
| 본문 구조       | 섹션 11개를 세로로 쌓음. 탭 없음               | 탭 5개 (Layout · Style · Text · Screen · Modified). 구 `StylesPanel` UI 에 `StylesHost` 를 주입 | `CatalogPropertiesPanel.tsx:163-224` · [StylesPanel.tsx:290-311](../../apps/builder/src/builder/panels/styles/StylesPanel.tsx)                                                                                                  |
| 다중 선택 대상  | 첫 요소와 같은 definition 인 것만              | 선택 전체                                                                                       | `CatalogPropertiesPanel.tsx:72-88` · `catalogStylesHost.ts:227`                                                                                                                                                                 |
| sub-part 안내   | 전체 owner 기준 (`"all"`)                      | style owner 기준 (`"style"`)                                                                    | `CatalogPropertiesPanel.tsx:121-126` · `catalogStylesHost.ts:740-746`                                                                                                                                                           |
| 복사 · 붙여넣기 | ⌘⌥C / ⌘⌥V — own prop                           | **같은 키** — 활성 breakpoint 의 style 전체. 포커스된 패널로 구분                               | [keyboardShortcuts.ts:584-623](../../apps/builder/src/builder/config/keyboardShortcuts.ts)                                                                                                                                      |
| 탭 상태         | —                                              | 컴포넌트 로컬 `useState` (기본 `layout`)                                                        | `StylesPanel.tsx:151`                                                                                                                                                                                                           |
| Modified        | —                                              | 활성 breakpoint 층에 노드가 직접 쓴 style 키. prop 은 대상 아님                                 | [styleDirty.ts:40-80](../../apps/builder/src/builder/catalogRuntime/styleDirty.ts)                                                                                                                                              |

### Domain

빌더 시스템 UI (builder-system layer) 다 — 사용자 캔버스 컴포넌트의 D1/D2/D3 체인 밖이고 catalog · rule · 문서 schema 를 바꾸지 않는다 ([panel-structure.md](../../.claude/rules/panel-structure.md)). 탭은 편집 surface 의 구분과 맞는다: Property 탭 = D2, Layout · Style · Text · Screen · Modified = D3. SSOT 경계는 움직이지 않는다.

### 제약

- **hard — 패널 id 는 레이아웃 저장 키**: 저장된 레이아웃에서 registry 에 없는 id 는 조용히 버려지고, 새 id 는 닫힌 상태로 기본 위치에 추가된다. V4 에는 id 를 옮기는 migration 이 없다 ([panelWorkspaceLayoutV4.ts:562-577](../../apps/builder/src/builder/layout/panelWorkspaceLayoutV4.ts) · `:634-644`). 규칙도 「기존 id 는 persist key 라 rename 안 함」 이다 (panel-structure.md §2).
- **hard — 패널 프레임은 id 당 하나**: 같은 패널을 두 곳에 띄울 수 없다 (`PanelWorkspace.tsx` `SnapshotPanelFrame` 을 config 당 하나 렌더 · 정규화가 같은 id 의 두 번째 row 를 버림). 합치면 속성과 스타일의 동시 표시가 구조적으로 없어진다.
- **hard — 패널 탭 표준**: `Tabs.panel-tabs` > `.panel-header.panel-tabrow` > `TabList` · `TabPanel` = `.panel-contents` (`panelTabs.static.test.ts`). 패널 탭 슬롯은 패널 전체 뷰를 가르는 축 하나만 쓴다.
- **hard — 수치**: Builder initial 번들 증가 0 (두 패널 모두 이미 initial chunk — ADR-201 상한) · `pnpm gate:perf-ratchet` 카운트 증가 0 (ADR-246) · `apps/publish` 수정 0 · 문서 schema 변경 0.
- **hard (BC 수식)**: 문서 재직렬화 0 파일. 영향은 브라우저 localStorage 의 패널 레이아웃뿐 — `styles` row 의 위치 · 높이 · 열림 상태가 사라진다 (`properties` row 는 보존).
- **soft**: 최소 폭 233 px 에서 탭 6개. 지금 Styles 탭은 선택된 탭만 글자를 보이는 형태이고, CSS 값으로 계산하면 탭 6개일 때 선택 탭의 글자 자리가 약 19 px 다 (실측 아님 — G0).

## Alternatives Considered

외부 사례:

- Webflow — 오른쪽 패널 하나에 Style · Settings · Interactions 탭. 요소 설정과 스타일이 같은 패널의 탭이다 (대안 A 와 같은 모양).
- Figma — Design 탭 하나의 세로 스크롤에 컴포넌트 속성 · Layout · Fill · Stroke 섹션을 쌓는다. Prototype 은 다른 탭 (대안 B 와 같은 모양).
- Framer — 오른쪽 패널 하나의 세로 스크롤에 컴포넌트 prop 과 스타일 섹션을 함께 둔다 (대안 B).
- 이 저장소의 선례 — Events → Interactions (2026-07-25 `616950cca`): 컴포넌트와 라벨만 바꾸고 id `events` 를 유지했다. Nodes → Navigator (2026-08-29 `5f3aa8f0a`): id 를 바꾸면서 레이아웃 포맷을 V4 로 올리고 133줄 변환 모듈을 넣었다.

### 대안 A: 한 패널 + 탭 6개, id `properties` 유지 (사용자 선택)

- 설명: `properties` 패널의 컴포넌트를 통합 패널로 바꾸고 라벨을 Design 으로 한다. `styles` 는 등록 해제한다. 통합 패널 = `PanelHeader` + 탭 6개이고, Property 탭에는 지금의 Properties 본문을, 나머지 다섯 탭에는 지금의 Styles 뷰를 그대로 넣는다 (`StylesHostContext` 는 패널 최상위에서 공급). 본문은 새로 만들지 않고 옮긴다. 탭 상태는 단축키 · 다른 패널이 읽고 쓸 수 있는 곳으로 올린다.
- 위험: 기술(MEDIUM — 본문은 그대로지만 패널 id 에 묶인 CSS · scope · 단축키 판정이 한 패널 안에서 겹친다) / 성능(LOW — 한 번에 한 탭만 렌더. 지금 두 패널을 같이 켠 것보다 적다) / 유지보수(LOW — 헤더 · 탭 · 접힘 · 단축키 scope 가 하나로 준다) / 마이그레이션(LOW — `styles` 의 저장된 배치만 사라진다)

### 대안 A′: 대안 A + 새 id `design` 과 레이아웃 id 변환

- 설명: id 를 `design` 으로 새로 만들고, 저장된 레이아웃의 `properties` · `styles` 를 `design` 으로 옮기는 변환을 V4 파서에 넣는다.
- 위험: 기술(MEDIUM — 두 id 를 하나로 합치는 변환은 전례가 없다. Navigator 전례는 1:1 rename 이었고 포맷 버전까지 올렸다) / 성능(LOW) / 유지보수(MEDIUM — 변환 모듈이 영구히 남는다. 대신 id 와 이름이 맞는다) / 마이그레이션(MEDIUM — scope · 단축키 id · 하니스 선택자 · CSS 선택자가 전부 바뀐다)

### 대안 B: 한 패널, 탭 없이 세로 스택 (Figma · Framer 방식)

- 설명: Property 섹션들 아래에 Layout · Fill · Border … 섹션을 한 스크롤로 쌓는다.
- 위험: 기술(MEDIUM — Screen · Modified 는 섹션이 아니라 뷰 (필터) 라 탭 또는 다른 전환 장치가 여전히 필요하다) / 성능(MEDIUM — 선택이 바뀔 때마다 섹션 19개가 한꺼번에 다시 그려진다. 지금은 탭 하나 분량) / 유지보수(LOW) / 마이그레이션(LOW). 제품 위험 MEDIUM — 스크롤이 길어져 Styles 의 탭 · focus mode 가 준 「한 화면에 한 묶음」 이 없어진다. 사용자가 정한 탭 구성과도 다르다.

### 대안 C: 두 패널 유지 (현행)

- 설명: 합치지 않는다. 두 패널을 위아래로 같이 켜는 지금의 사용법을 유지한다.
- 위험: 기술(LOW) / 성능(LOW) / 유지보수(MEDIUM — 헤더 · 복사 단축키 · sub-part 안내 · 접힘이 두 벌. 어법이 다시 갈릴 수 있다) / 마이그레이션(LOW). 제품 위험 MEDIUM — 레일 버튼 둘 · 단축키 둘 · 같은 키의 복사가 포커스에 따라 달라지는 현재의 혼란이 남는다.

### Risk Threshold Check

| 대안 | HIGH+ | 판정                                        |
| ---- | ----- | ------------------------------------------- |
| A    | 없음  | 통과                                        |
| A′   | 없음  | 통과 — A 대비 얻는 것은 id 와 이름의 일치뿐 |
| B    | 없음  | 통과 — 사용자가 정한 탭 구성과 다름         |
| C    | 없음  | 통과 — 문제를 풀지 않음                     |

HIGH 이상인 대안이 없어 추가 루프는 없다. 선택은 위험 크기가 아니라 사용자 방향 (탭) 과 저장 키 규칙으로 갈린다.

## Decision

**대안 A 를 채택한다** (사용자 2026-09-29 방향 · 2026-10-03 「권장안으로」).

결정 내용:

1. **패널**: id `properties` 를 유지하고 라벨 · 아이콘 · 설명을 Design 으로 바꾼다. `styles` 는 registry 에서 뺀다. 저장된 레이아웃의 `styles` 는 정규화가 버린다 — 변환 코드를 만들지 않는다.
2. **탭**: `Property | Layout | Style | Text | Screen | Modified`. 기본 탭은 Property. 탭 상태는 세션 store 하나에 두고 (저장 안 함 — 지금과 같다), 단축키와 「패널 열기」 호출이 같이 읽고 쓴다.
3. **본문은 옮기기만 한다**: Property 탭 = 지금의 Properties 본문, 나머지 = 지금의 Styles 뷰. 탭마다 지금의 규칙을 그대로 둔다 — 다중 선택 대상 (Property = 같은 definition, style 탭 = 선택 전체), sub-part 안내 (Property = 전체 owner, style 탭 = style owner), 빈 선택 · page 설정 표시.
4. **겹치는 prop**: `labelPosition` · `orientation` 은 Property 탭의 필드와 Layout 탭의 Direction 양쪽에 남는다 (사용자 결정). 두 곳은 같은 명령으로 같은 prop 을 쓴다. 축이 갈리는 문제는 ADR-251 이 묶음 노드로 푼다.
5. **단축키**: ⌥5 = 패널 토글. ⌥6 = Design 을 Layout 탭으로 연다 (이미 Layout 탭으로 열려 있으면 닫는다). 단축키 id (`toggleProperties` · `toggleStyles`) 와 scope (`panel:properties`) 는 유지하고 라벨만 바꾼다. `panel:styles` scope 는 없앤다.
6. **복사 · 붙여넣기 (⌘⌥C / ⌘⌥V)**: 활성 탭으로 구분한다 — Property 탭 = 속성, 나머지 = 스타일. 구현은 **배타적 등록**이다: 정의 4개 (`copyProperties` · `pasteProperties` · `copyStyles` · `pasteStyles`) 는 그대로 두고, 활성 탭에 맞는 쌍만 shortcut registry 와 command registry 에 등록한다. 키보드 dispatcher 는 같은 scope 의 첫 매치를 실행하고 멈추므로 (`useKeyboardShortcutsRegistry.ts:371-379` — `canRun` 을 보지 않음) 둘 다 등록한 채 `canRun` 이나 handler 안의 탭 검사로 가를 수 없다. 메뉴 · 명령 팔레트는 「등록 = 실행 가능」 (ADR-249 · `CommandPalette.tsx:266-270`) 이라 비활성 탭의 명령은 자동으로 실행 불가로 보인다. 헤더의 복사 · 붙여넣기 버튼도 같은 쌍을 쓴다.
7. **Modified**: 1차는 지금처럼 style 만. prop override 를 포함하는 것은 이 ADR 범위 밖 (후속).
8. **탭 폭**: G0 에서 233 px · 387 px 에 탭 6개를 실제로 재고, 선택 탭의 글자가 잘리면 패널 최소 폭을 올린다 (상한 약 270 px). 올릴 값은 G0 실측으로 정한다.

위험 수용 근거: A 에 HIGH 는 없다. 가장 큰 잔존 위험은 동시 표시가 없어지는 제품 위험이고, 이것은 사용자가 탭 구성을 정할 때 이미 감수한 것이다 — ⌥5 · ⌥6 과 탭 전환으로 완화하고, 완료 직전 사용자 확인 (G5) 으로 다시 판정받는다. id 를 유지하는 선택은 이름과 id 가 어긋나는 부채를 남기지만 (`events` 에 이어 두 번째), 저장된 배치를 지키고 scope · 선택자 · 하니스의 변경 범위를 절반으로 줄인다.

기각 사유:

- **A′**: id 와 이름이 맞는 것 외에 얻는 것이 없고, 두 id 를 하나로 합치는 레이아웃 변환을 새로 만들어야 한다. 저장 키 규칙 (rename 안 함) 과 Events 전례를 따른다.
- **B**: Screen · Modified 가 뷰라서 탭을 완전히 없앨 수 없고, 선택 변경마다 다시 그리는 양이 늘어난다. 사용자가 정한 구성은 탭이다.
- **C**: 어법이 갈리는 원인 (두 벌의 헤더 · 단축키 · 안내) 을 그대로 둔다.

> 구현 상세: [252-design-panel-merge-breakdown.md](design/252-design-panel-merge-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                    | 심각도 | 대응                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------- |
| R1  | 동시 표시 손실 — 지금은 두 패널을 위아래로 같이 켤 수 있다 (`PanelToggleGroup.tsx:63-66` multiple). 통합 뒤에는 `size` 를 바꾸며 스타일 값을 함께 볼 수 없다                                                                                                                                                                                                                                            |  MED   | ⌥5 · ⌥6 · 탭 전환. G5 사용자 확인에서 받아들일 수 없으면 재판정                                                         |
| R2  | 패널 id 에 묶인 CSS 가 Styles 섹션을 덮음 — `.panel-wrapper[data-panel="properties"] .section .section-content { display: flex; flex-direction: column }` ([panel-system.css:27-30](../../apps/builder/src/builder/components/styles/panel-system.css)) 가 Styles 섹션의 grid (`inspector-layout.css` `.section[data-section-id="…"] .section-content`) 보다 구체적이다                                 |  MED   | 규칙의 적용 범위를 Property 탭 본문으로 좁힌다. G1 — 탭별 화면이 통합 전과 같음 (스크린샷 대조)                         |
| R3  | 같은 키의 두 뜻 — ⌘⌥C / ⌘⌥V 가 포커스된 패널 대신 활성 탭으로 갈린다. 탭 상태가 로컬 `useState` 라 단축키 등록부가 읽을 수 없고 (`StylesPanel.tsx:151`), dispatcher 는 같은 scope 의 첫 매치만 실행한다 (`useKeyboardShortcutsRegistry.ts:371-379`) — 두 정의를 함께 등록하면 Style 복사가 실행되지 않는다 (리뷰 round 1 m1 격리 반증). 두 클립보드는 종류 표시 없는 평문 JSON 이다 (`useCopyPaste.ts`) |  MED   | 탭 상태를 세션 store 로 올리고 활성 탭의 쌍만 등록 (Decision 6). G2 — 탭별 복사 대상 · 비활성 쌍 미등록 unit (원복 RED) |
| R4  | scope 병합 — `panel:styles` 의 ⌥⇧S / ⌥⇧E (focus mode · 섹션 토글) 가 `panel:properties` 로 온다. `panel:properties` 에는 ⌘C / ⌘V = 요소 복사가 따로 등록돼 있다 (`useCatalogGlobalShortcuts.ts:150-161`) — style 탭에서도 동작하게 된다                                                                                                                                                                 |  MED   | 병합 뒤 키 충돌 0 을 `keyboardShortcuts.test.ts` 로 확인. style 탭에서의 ⌘C 동작은 의도된 확장으로 기록                 |
| R5  | 탭 6개가 최소 폭에서 읽히지 않음                                                                                                                                                                                                                                                                                                                                                                        |  MED   | G0 실측 → 최소 폭 조정. 최소 폭을 올리면 저장된 column 폭이 새 최소값으로 올라간다                                      |
| R6  | 저장된 배치 손실 — `styles` 만 켜 두던 사용자는 패널이 닫힌 상태로 시작한다                                                                                                                                                                                                                                                                                                                             |  LOW   | 의도된 동작. CHANGELOG 에 적는다. G3 — `properties` row 보존 · 오류 0                                                   |
| R7  | 개수 · 경로를 고정한 테스트와 하니스 — 패널 12 · 탭 5 · 레일 8 · 단축키 71, `sectionGroupToggle.static.test.ts` 의 경로, `phase4eClipboard.test.tsx`, `apps/builder/scripts/` 58개의 `RAIL_ORDER` 인덱스                                                                                                                                                                                                |  LOW   | breakdown §2 표대로 갱신. 하니스의 `RAIL_ORDER` 는 이미 실제 레일과 다르다 — 이 ADR 에서 한 곳으로 모은다               |
| R8  | 다른 패널이 Properties 를 여는 호출 2곳 (page 설정 · 변수 owner) 이 style 탭이 활성인 패널을 열 수 있다                                                                                                                                                                                                                                                                                                 |  LOW   | 「패널을 열고 탭을 고르는」 호출 하나로 바꾼다 (G2)                                                                     |
| R9  | 탭 전환마다 본문이 다시 마운트돼 느려짐                                                                                                                                                                                                                                                                                                                                                                 |  LOW   | G4 — 카운트 ratchet. Styles 는 지금도 탭 전환에 같은 비용을 낸다                                                        |

잔존 HIGH 위험 없음.

## Gates

측정 조건: live 는 headed Playwright (hidden 탭 rAF 정지 회피), 저장된 인증 세션으로 /dashboard 직행. 화면 대조의 기준은 통합 전 main 에서 찍은 스크린샷이다 (통합 코드가 만든 값이 아니다). 불리한 경우 = 최소 폭 233 px · 한국어 라벨 · 다중 선택 (서로 다른 definition) · sub-part 선택.

| Gate | 시점      | 통과 조건                                                                                                                                                                                                                                                                                                                                                                            | 실패 시 대안                                         |
| ---- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| G0   | 착수 전   | ① 패널 id · scope · 단축키 소비처 전수 목록 고정 (breakdown §2) ② 탭 6개를 233 · 387 px 에서 실측 (ko · en) → 최소 폭 값 확정 ③ 통합 전 탭별 · 폭별 스크린샷과 `perf:baseline` 카운트 기록 ④ ADR-251 구현이 main 에 있는지 확인                                                                                                                                                      | 251 이 없으면 Direction 관련 항목만 뒤로 미루고 진행 |
| G1   | Phase 1   | 한 패널 · 탭 6개. 기존 `catalogRuntime/__tests__/phase4e*` (Properties · Styles) 전부 통과 · `panelTabs.static.test.ts` 통과 · 탭별 화면이 G0 스크린샷과 같음 (233 · 387 px) (R2)                                                                                                                                                                                                    | CSS 범위를 다시 좁힘. 본문 구조는 바꾸지 않음        |
| G2   | Phase 2   | ⌥5 토글 · ⌥6 = Layout 탭으로 열기 · ⌘⌥C/V 가 활성 탭을 따름 (Property 탭에서 `copyStyles` 미등록 · style 탭에서 `copyProperties` 미등록, 탭 전환 직후 바로 바뀜) · 메뉴 · 명령 팔레트에서 비활성 탭의 복사 명령이 실행 불가로 표시 · ⌥⇧S/E 동작 · page 설정 / 변수 owner 가 Property 탭으로 엶 · AI agent 명령 동작 · 키 충돌 0 (unit 원복 RED) (R3 · R4 · R8)                       | 복사는 헤더 버튼만 남기고 단축키는 Property 로 고정  |
| G3   | Phase 2   | 저장 레이아웃: `properties` · `styles` row 가 함께 있는 V4 문서를 열면 `properties` 의 배치 키 (placementZone · cluster · column · row 높이 · 열림) 보존, `styles` 는 오류 없이 빠짐, `memory-fallback` 아님 (unit). 화면 좌표는 보존 대상이 아니다 — `styles` row 가 위에 있었으면 `properties` 가 그 자리로 올라오는 것이 정상 재배치다 (`panelWorkspaceLayoutV4.ts:782-814`) (R6) | 정규화 경로 수리                                     |
| G4   | Phase 3   | `pnpm gate:perf-ratchet` 증가 0 · Builder initial 번들 증가 0 · 선택 변경 1회의 패널 렌더 카운트가 G0 의 「두 패널 열림」 값 이하 (R9)                                                                                                                                                                                                                                               | 탭 본문 마운트 유지 방식을 조정                      |
| G5   | 완료 직전 | live exercise + 사용자 확인 — 탭 구성 · 폭 · 동시 표시 손실 (R1) 을 받아들이는지                                                                                                                                                                                                                                                                                                     | 사용자 재판정                                        |

### Live Exercise

(Implemented 승격 시 기재 — 실제 builder 에서: 요소 선택 → ⌥5 → 탭 6개 전환 → Property 에서 size 변경 → Layout 탭 Direction → ⌘⌥C/V 탭별 → ⌥6 → page 설정 열기 → 새로고침 뒤 배치 유지.)

## Consequences

### Positive

- 오른쪽 레일 버튼 · 패널 헤더 · 접힘 · 단축키 scope 가 하나로 준다. 한 요소의 편집이 한 패널 안에서 끝난다.
- 복사 · 붙여넣기의 기준이 「포커스된 패널」 에서 「보이는 탭」 으로 바뀌어 화면과 동작이 맞는다.
- 두 패널이 한 헤더 · 한 탭 줄을 쓰므로 어법이 다시 갈릴 자리가 준다.

### Negative

- 속성과 스타일을 동시에 볼 수 없다.
- id `properties` · 단축키 id `toggleStyles` 가 이름과 어긋난다 (`events` 에 이어 두 번째).
- 저장된 `styles` 패널 배치가 사라진다.
- 영향 파일 (대표): `apps/builder/src/builder/panels/core/{panelConfigs.ts, types.ts}` · `panels/properties/catalog/CatalogPropertiesPanel.tsx` · `panels/styles/{StylesPanel.tsx, components/StylesPanelTabs.tsx, constants/styleGroups.ts, catalog/*}` · `config/keyboardShortcuts.ts` · `hooks/useActiveScope.ts` · `types/keyboard.ts` · `main/useCatalogGlobalShortcuts.ts` · `components/styles/panel-system.css` · `i18n/translations.ts` · `.claude/rules/panel-structure.md` · `apps/builder/scripts/` 하니스.
