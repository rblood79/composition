# ADR-252 breakdown — Properties · Styles 패널을 Design 패널로 통합

> 본문: [ADR-252](../completed/252-design-panel-merge.md). 대안 A 기준 (사용자 2026-10-03 「권장안으로」). 줄 번호는 main `db76cc301` 기준이며 G0 에서 다시 확인한다.

경로 약어: `B/` = `apps/builder/src/builder/` · `P/` = `apps/builder/src/builder/panels/`

## 1. 분리 점검 (fork 4 질문)

1. **base / 응용**: ADR-248 (새 패널 host — `CatalogPropertiesPanel` · `StylesHost`) 과 ADR-163 (패널 구조 표준) 이 base, ADR-252 (두 패널의 배치 통합) 가 응용. ADR-251 은 252 의 선행 — 묶음 노드가 있어야 Direction 의 두 축이 한 패널 안에서 갈린다.
2. **schema 직교성**: 문서 schema · catalog · rule 변경 0. 바뀌는 저장 데이터는 localStorage 의 패널 레이아웃뿐이고 포맷 (V4) 은 그대로다.
3. **선행 전제 검증**: ADR-910 원칙 2 「패널 = 단일 공급원의 두 view」 의 구현 (`useEditContract` 의 이중 origin) 은 ADR-248 에서 삭제됐다 — 그 전제를 승계하지 않는다. 252 의 통합은 계약 통합이 아니라 **배치 통합**이다 (두 본문을 한 패널의 탭으로 옮김).
4. **분리 confirm**: 사용자 `/create-adr Design 패널 통합 권장안으로` (2026-10-03).

## 2. 소비처 인벤토리 (G0 에서 고정)

| #   | 위치                                                                                                                                                                                                                                                                                                          | 현재                                                                                                                                                                                                         | 바꿀 모양                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| 1   | `P/core/panelConfigs.ts:220-247`                                                                                                                                                                                                                                                                              | `properties` · `styles` 두 항목                                                                                                                                                                              | `properties` 하나 (이름 Design · 컴포넌트 = 통합 패널). `styles` 항목 삭제                                   |
| 2   | `P/core/types.ts:64-82` · `:278-298`                                                                                                                                                                                                                                                                          | `PanelId` 에 `"styles"` · `DEFAULT_PANEL_LAYOUT.rightPanels`                                                                                                                                                 | `"styles"` 제거                                                                                              |
| 3   | `B/layout/panelWorkspaceLayoutV4.ts:562-577` · `:634-644`                                                                                                                                                                                                                                                     | registry 에 없는 id 를 버림                                                                                                                                                                                  | 변경 없음 — G3 가 이 동작에 기대므로 테스트만 추가                                                           |
| 4   | `B/config/keyboardShortcuts.ts:196-216`                                                                                                                                                                                                                                                                       | `toggleProperties` ⌥5 · `toggleStyles` ⌥6                                                                                                                                                                    | id 유지. 라벨 변경. ⌥6 handler = Design 을 Layout 탭으로                                                     |
| 5   | `B/config/keyboardShortcuts.ts:584-645` · `B/hooks/useKeyboardShortcutsRegistry.ts:371-379`                                                                                                                                                                                                                   | `copyProperties` / `pasteProperties` (`panel:properties`) · `copyStyles` / `pasteStyles` · `toggleFocusMode` · `toggleSections` (`panel:styles`). dispatcher 는 같은 scope 의 첫 매치만 실행 (`canRun` 무시) | scope 를 `panel:properties` 하나로. 정의 4개 유지 (단축키 개수 71 그대로). 활성 탭의 쌍만 등록 (배타적 등록) |
| 6   | `B/types/keyboard.ts:27-35` · `B/hooks/useActiveScope.ts:50-76` · `B/components/overlay/CommandPalette.tsx:100-101`                                                                                                                                                                                           | scope `panel:styles`                                                                                                                                                                                         | 제거                                                                                                         |
| 7   | `B/main/useCatalogGlobalShortcuts.ts:96-108` · `:150-161`                                                                                                                                                                                                                                                     | `toggleStyles: "styles"` · ⌘C/⌘V = 요소 복사 (`panel:properties`)                                                                                                                                            | ⌥6 을 패널 + 탭 호출로. ⌘C/⌘V 는 그대로 (style 탭에서도 동작 — 의도)                                         |
| 8   | `B/config/commandMeta.ts:129-130` · `B/main/headerMenu/builderMenuStructure.ts:246-247` · `menuModel.ts:124-146`                                                                                                                                                                                              | 패널 토글 명령 2개 · 메뉴의 작업 공간 구역은 registry 에서 생성                                                                                                                                              | `toggleStyles` 의 메뉴 · 팔레트 표기 갱신                                                                    |
| 9   | `apps/builder/src/services/agent/agentViewCommands.ts:49-50`                                                                                                                                                                                                                                                  | `toggleStyles: panel("styles")`                                                                                                                                                                              | Design 을 Layout 탭으로 여는 호출                                                                            |
| 10  | `P/navigator/catalog/CatalogPagesSection.tsx:125` · `P/datatable/usage/dataVariablesHost.ts:49`                                                                                                                                                                                                               | `setPanelWorkspacePanelVisibility("properties", true)`                                                                                                                                                       | 「열고 Property 탭 선택」 호출 하나                                                                          |
| 11  | `B/components/styles/panel-system.css:27-30`                                                                                                                                                                                                                                                                  | `[data-panel="properties"] .section .section-content` = flex column                                                                                                                                          | Property 탭 본문으로 범위를 좁힘 (조상 스코프 — 예약 클래스 base 정의 금지 규칙 준수)                        |
| 12  | `P/styles/StylesPanel.tsx` · `components/StylesPanelTabs.tsx` · `constants/styleGroups.ts:28-61`                                                                                                                                                                                                              | 탭 5 · 로컬 `useState` · 자체 `PanelHeader`                                                                                                                                                                  | 탭 6 (Property 추가) · 탭 상태 = 세션 store · 헤더는 통합 패널이 소유                                        |
| 13  | `P/properties/catalog/CatalogPropertiesPanel.tsx:55-224`                                                                                                                                                                                                                                                      | 자체 `PanelHeader` + `PanelContents`                                                                                                                                                                         | 본문 (`CatalogPropertiesContent` 의 섹션 부분) 을 Property 탭의 `TabPanel` 로                                |
| 14  | `P/styles/catalog/CatalogStylesPanel.tsx` · `CatalogStyleClipboardShortcuts.tsx`                                                                                                                                                                                                                              | host 공급 + 단축키 등록                                                                                                                                                                                      | host 공급을 통합 패널 최상위로                                                                               |
| 15  | `P/styles/hooks/useSectionCollapse.ts:54-63` · `:199-206`                                                                                                                                                                                                                                                     | `STYLE_PANEL_SECTION_IDS` · localStorage `styles-panel-collapse`                                                                                                                                             | 키 이름 유지 (저장된 접힘 상태 보존)                                                                         |
| 16  | `apps/builder/src/i18n/translations.ts` (`panels.properties` · `panels.styles` · 단축키 라벨 · scope 힌트) · `B/layout/panelLabels.ts:12-13` · `i18n/types.ts:132-133`                                                                                                                                        | 두 이름                                                                                                                                                                                                      | `panels.properties` = Design / 디자인. `panels.styles` · `scopePanelStyles` 제거. Property 탭 라벨 추가      |
| 17  | 개수 고정 테스트: `P/core/panelCloseActions.static.test.ts:55` (12) · `P/styles/StylesPanel.test.tsx:93` (탭 5) · `B/main/headerMenu/builderMenuStructure.static.test.ts:151-212` (레일 8 · 메뉴 패널 10 · 정의 71 · 포함 49 · 제외 22)                                                                       | —                                                                                                                                                                                                            | 새 개수로 갱신                                                                                               |
| 18  | 경로 · id 고정 테스트: `B/components/panel/sectionGroupToggle.static.test.ts:24-31` · `B/components/styles/panel-system.static.test.ts:56-65` · `B/catalogRuntime/__tests__/phase4eClipboard.test.tsx:171` · `P/properties/CanvasSelectionShortcuts.scope.test.ts:24` · `P/styles/StylesPanel.static.test.ts` | —                                                                                                                                                                                                            | 새 구조로 갱신                                                                                               |
| 19  | `apps/builder/scripts/` — `RAIL_ORDER` 인덱스 58개 · `[data-panel-id="properties\|styles"]` 선택자 15개                                                                                                                                                                                                       | 레일 버튼을 순서 인덱스로 찾음. 배열은 이미 실제 레일과 다름                                                                                                                                                 | 공용 helper 한 곳으로 모으고 `aria-label` 로 찾게                                                            |
| 20  | `.claude/rules/panel-structure.md:14` · `:57` · `docs/features/completed/KEYBOARD_SHORTCUTS.md`                                                                                                                                                                                                               | 「Properties/Styles 패널이 표준 정본」                                                                                                                                                                       | 「Design 패널」 로 갱신                                                                                      |

## 3. Phase

각 phase 끝은 type-check 통과 + 커밋 가능 상태.

### P0 — 인벤토리 · 기준 기록 (G0)

- §2 표를 grep 으로 다시 세어 고정한다.
- 탭 6개 실측: 임시 로컬 변경으로 탭 하나를 더해 233 · 387 px 에서 선택 탭 라벨이 잘리는지 본다 (ko 「속성 / 레이아웃 / 스타일 / 텍스트 / 화면 / 수정됨」 · en). 잘리면 최소 폭 값을 정한다 (상한 약 270 px). 최소 폭을 올리면 `defaultWidth ?? minWidth` (`panelWorkspaceLayoutV2.ts:259-266`) 라 기본 폭도 같이 오른다.
- 통합 전 기준: 탭별 (Properties 본문 + Styles 5탭) × 폭 2 스크린샷 · `pnpm perf:baseline -- --lane frame --fixed-inputs --call-counts` 의 선택 변경 카운트 (두 패널 열림 · Properties 만 열림).
- ADR-251 구현 여부 확인.

### P1 — 통합 패널 (G1)

- `P/design/DesignPanel.tsx` (가칭): `CatalogWorkspaceGate` → `StylesHostContext` 공급 → `PanelHeader` (제목 Design, `panelId="properties"`) → `Tabs.panel-tabs` > `.panel-header.panel-tabrow` > 탭 6 → `TabPanel` (`panelContents()`) ×6.
- Property 탭 본문 = `CatalogPropertiesPanel` 의 섹션 부분을 헤더 없이 꺼낸 컴포넌트. style 탭 본문 = `StylesPanel` 의 `GroupSections` · `ModifiedSectionsWrapper`.
- 탭별 빈 상태 · sub-part 안내: 지금 두 패널은 패널 전체를 안내로 바꾼다. 통합 뒤에는 **탭 줄은 그대로 두고 탭 본문만** 안내로 바꾼다 (Property = 전체 owner, style 탭 = style owner).
- 탭 상태 store: `{ view, setView }` 세션 store 하나 (persist 없음). 기본 `property`.
- `panel-system.css:27-30` 범위 좁힘 (R2).
- `panelConfigs` 에서 `styles` 제거, `PanelId` 정리.

### P2 — 단축키 · 진입 경로 · 레이아웃 (G2 · G3)

- ⌥6: 패널이 닫혀 있거나 다른 탭이면 열고 Layout 탭, 이미 Layout 탭이면 닫기.
- ⌘⌥C / ⌘⌥V: **배타적 등록** — 탭 상태 store 를 구독하는 등록부가 Property 탭이면 `copyProperties` · `pasteProperties`, style 탭이면 `copyStyles` · `pasteStyles` 만 shortcut registry · command registry 에 올린다. 정의 4개는 유지해 메뉴 · 명령 팔레트에 「속성 복사」 「스타일 복사」 가 따로 보이고, 비활성 쪽은 「등록 = 실행 가능」 규칙으로 실행 불가가 된다. 두 정의를 함께 등록하고 `canRun` 이나 handler 안의 탭 검사로 가르는 방식은 쓰지 않는다 — dispatcher 가 첫 매치에서 멈춰 다음 정의로 넘어가지 않는다 (리뷰 round 1 m1). 헤더 버튼도 같은 쌍.
- ⌥⇧S / ⌥⇧E: scope `panel:properties`, style 탭에서만 동작.
- 「열고 탭 선택」 호출 (`openDesignPanel(view)`): §2 #9 · #10 이 쓴다.
- G3 unit: `properties` · `styles` row 가 함께 있는 V4 레이아웃 → 정규화 결과.

### P3 — 테스트 · 하니스 · 성능 (G4)

- §2 #17 · #18 갱신.
- 하니스: 레일 버튼 찾기를 공용 helper (`aria-label`) 로. `[data-panel-id="styles"]` 선택자 → `properties` + 탭 선택.
- `pnpm gate:perf-ratchet` · initial 번들 · 선택 변경 카운트를 G0 값과 대조.

### P4 — 문서 · live · 사용자 확인 (G5)

- `panel-structure.md` · `KEYBOARD_SHORTCUTS.md` · CHANGELOG (레일 버튼 하나로 · ⌥6 의미 변경 · 저장된 Styles 배치 사라짐).
- live (headed Playwright): 본문 §Live Exercise 시나리오.
- 사용자 확인: 탭 구성 · 폭 · 동시 표시 손실.

## 4. 검증 명령

```bash
pnpm type-check
pnpm -F @composition/builder exec vitest run src/builder/panels src/builder/catalogRuntime/__tests__ src/builder/layout src/builder/config src/builder/main/headerMenu
pnpm gate:perf-ratchet
```

## 5. 범위 밖

- Modified 에 prop override 포함 (후속).
- Property 탭 섹션에 접힘 id 부여 · 「Layout」 섹션 이름 정리.
- 패널 id · 단축키 id 의 rename.
- 속성과 스타일의 계약 통합 (ADR-910 원칙 2) — 이 ADR 은 배치만 합친다.
- RadioItems 의 Direction → owner `orientation` (ADR-251).

## 6. 실행 기록

### P0 — G0 (2026-10-04, main `2ae503d9c`)

- **④ ADR-251**: main 에 있음 (구현 `3648a262f` · Implemented `2ee00aad5`). Direction 항목을 뒤로 미루지 않는다.
- **① 인벤토리**: §2 의 줄 번호를 `2ae503d9c` 에서 다시 확인 — 20행 모두 위치 그대로. 추가로 찾은 것 3곳 (바꾸지 않음): `P/styles/hooks/useStyleActions.ts:101` `name: "styles"` (클립보드 종류 이름이라 패널 id 아님) · `B/layout/PanelWorkspace.tsx:508` 주석 · `B/layout/panelWorkspaceAdr186.testFixtures.ts:68,154` (테스트 fixture — P3 에서 정리).
- **② 탭 6 폭** (`apps/builder/scripts/adr252-g0-live.mjs` — 실제 Builder, headless Chrome, 탭 하나를 복제해 6개로 만들고 선택 탭 라벨에 후보 글자를 넣어 `scrollWidth > clientWidth` 판정):

  | 폭 (px) | en 최장 「Property」 · 「Modified」 47 px | ko 최장 「레이아웃」 41 px |
  | ------- | ----------------------------------------- | -------------------------- |
  | 233     | 잘림 (라벨 칸 37) — 6개 전부 잘림         | 잘림 (34) — 6개 전부 잘림  |
  | 255     | 「Property」 · 「Modified」 잘림 (45)     | 통과                       |
  | 260     | 「Property」 잘림 (46)                    | 통과                       |
  | 262     | 통과                                      | 통과                       |
  | 387     | 통과                                      | 통과                       |

  → **최소 폭 264 px** (통과 경계 262 + 글꼴 차이 여유 2). 비선택 탭은 32 px 그대로 (233 px 에서는 30 px 로 줄었다).

- **③ 통합 전 기준**: 스크린샷 Properties 1 + Styles 탭 5 × 폭 233 · 387 (en) — 같은 스크립트로 `2ae503d9c` 에서 다시 만들 수 있다. `pnpm perf:baseline -- --lane frame --fixed-inputs --call-counts --classes select` 결정적 카운트:

  | 열린 패널                       | Layout / RecalcStyle | DOM mut (child/attr/text) | React render measure | V8 calls total / app |
  | ------------------------------- | -------------------: | ------------------------: | -------------------: | -------------------: |
  | navigator · properties · styles |            139 / 212 |               458/2300/62 |               12,847 | 14,908,474 / 415,698 |
  | navigator · properties          |            107 / 155 |                280/243/31 |                4,496 |  5,127,194 / 123,244 |

  G4 기준 = 첫 행 (두 패널 열림) 이하.

### P1 · P2 — G1 · G2 · G3 (2026-10-04, 작업 트리 — 미커밋)

- **구현**: `P/design/DesignPanel.tsx` (패널 = `PanelHeader` + `Tabs.panel-tabs` 탭 6 · Styles host 를 최상위에서 공급) · `P/design/designPanelView.ts` (탭 세션 store · `openDesignPanel(view)` · `toggleDesignPanelView(view)`). `CatalogPropertiesPanel.tsx` 는 선택 hook · 탭 본문 · 헤더 액션으로, `StylesPanel.tsx` 는 탭 본문 · 헤더 액션 · 단축키 등록부 · 탭 표시로 나눴다 (본문 JSX 는 그대로). `CatalogStylesPanel.tsx` 는 host 공급 컴포넌트가 됐다. `panel:styles` scope 제거, 스타일 탭 명령 4개는 `panel:properties`. agent 의 ⌥6 은 등록된 명령을 부른다 (`resolveCommand("toggleStyles")`).
- **배타적 등록**: 활성 탭 쪽 등록부만 마운트 (Property = `CatalogPropertiesHeaderActions`, 스타일 탭 = `CatalogStyleClipboardShortcuts` + `StylesTabShortcuts`). unit `P/design/DesignPanel.test.tsx` 6/6 — 원복 (두 쪽 다 마운트) 시 「활성 탭의 쌍만 등록」 · 「⌘⌥C 가 탭을 따름」 2건 RED 확인 후 복구.
- **G3**: `B/layout/adr252StylesRowDrop.test.ts` — `styles` row 가 `properties` 위에 있던 V4 문서 → `properties` 의 zone · cluster · column id · column 폭 · row 높이 · 열림 보존, `styles` 는 rows · visibility · railOrder 어디에도 없음, hydration `ready`.
- **G1 live** (`apps/builder/scripts/adr252-live.mjs`): 통합 전 기준은 `.cache/perf-ratchet/wt` (`381d205fa` — 패널 · components 코드가 `2ae503d9c` 와 같음) 의 vite 5179 에서 Properties 만 · Styles 만 열고 찍은 본문 (`.panel-contents`). 통합 뒤 Design 의 탭 본문과 픽셀 대조 (RGB 합 차 > 24 를 다름으로): 스타일 탭 5 × 폭 264 · 387 = **10/10 차이 0**. Property 탭은 위쪽 416 px 차이 0 — 차이는 아래 24 px 뿐이고, 본문이 33 px 짧아져 (헤더 아래 탭 줄) 스크롤 힌트 페이드 띠 (`panel-system.css` 마지막 24 px) 가 다른 행에 걸린 것이다.
- **G2 live** 10/10: 레일에 Design 하나 (Properties · Styles 없음) · 탭 6 · ⌥5 토글 · ⌥6 = Layout 탭으로 열고 다시 누르면 닫힘 · ⌘⌥C 가 Property 탭에서 `{"children":"Save"}`, Layout 탭에서 `{"width":"120px"}` · ⌥⇧S 는 스타일 탭에서만 · 명령 팔레트 (Property 탭) 에서 Copy Properties = executable, Copy Styles = unregistered · 페이지 설정 → Design 의 Property 탭 · 새로고침 뒤 열림 유지. 페이지 오류 0.
- 테스트 갱신 (개수 · id 고정): 패널 12 → 11 · 레일 8 → 7 · 메뉴 패널 10 → 9 · 탭 5 → 6 · `commandPalette.*` 키 26 → 25 · 레이아웃 테스트의 둘째 오른쪽 패널 `styles` → `events` (fixture `datatableField`). ⌥6 (`toggleStyles`) 은 레일 패널 묶음에서 빠져 메뉴 「보기」 의 체크 없는 구역으로 갔다 (`builderMenuStructure.ts`).

### P3 — G4 (2026-10-04)

- **선택 변경 카운트** (`perf:baseline --lane frame --fixed-inputs --call-counts --classes select --open-panels navigator,design`): Layout/Recalc 137/185 · DOM mut 280/245/31 · React measure 5,275 · V8 app 124,757 — G0 「두 패널 열림」 (139/212 · 458/2300/62 · 12,847 · 415,698) 이하 **통과**.
  - 첫 측정은 Property 탭에서도 탭 줄이 스타일 dirty 표시를 구독해 A등급 10건을 넘었다 (DOM 속성 243 → 307, i18n 호출 +926). 표시 구독을 스타일 탭 활성일 때로 한정하고 (`MarkedStylesPanelTabs`), 선택 hook 이 graph 를 넘겨 본문의 workspace 재조회를 없앴다.
- **perf ratchet** (`--judge`, seed 60 · 600 전 부류, 하니스 기본 열림 패널 `navigator,design`): **A등급 초과 2 — 둘 다 `select.domMutations.attributes` 243 → 245.** 원인은 RAC `useTabPanel` 이 탭 가능한 자식이 없는 tabpanel 에 `tabIndex=0` 을 붙이는 접근성 동작 (`react-aria/dist/private/tabs/useTabPanel.mjs:24`, D1) — 빈 선택 안내 ↔ 선택 본문 전환 때 `div.panel-contents.design-property-contents@tabindex` 가 붙었다 떨어진다 (MutationObserver 실측). B 경고 7 (선택당 Layout · Recalc +1 — 같은 훅의 가시성 검사, React measure +25). **사용자 판정 (2026-10-04): 상한 245 로 올림** — `apps/builder/perf/ratchet.json` `raises` 에 seed 60 · 600 두 건 (만료 2027-04-04). 재판정 A등급 초과 0 · B 경고 7.
- **initial 번들** (`adr209-bundle-closure.mjs`, 기준 `2ae503d9c` 빌드): **JS gzip +346 B · raw +431 · CSS gzip +9** (1,233,694 → 1,234,040 — ADR-201 상한 1,421,000 아래. 파일별 기여는 sourcemap 빌드로 쟀다). 새 아이콘 `PenTool` (+445 raw) 은 구 Styles 의 `PaintRoller` 로 바꿔 뺐고, agent 의 직접 import 를 없애 공유 chunk 분리를 줄였다. 남은 것은 새 패널 코드 (DesignPanel +1,121 · designPanelView +326 · 탭 +94 raw, 옮겨 온 쪽 −994) 와 rolldown 이 `fillDerivedStyleProps` 를 별도 initial chunk 로 떼어 낸 고정 비용. **사용자 판정 (2026-10-04): 수용** — ADR Constraints 「initial 증가 0」 의 예외로 기록.
- 하니스: 레일 버튼을 순서 인덱스로 찾던 65 스크립트를 `scripts/railButton.mjs` (접근 이름) 로 모았다 (`RAIL_ORDER` 0). `[data-panel-id="styles"]` 선택자 2 스크립트는 `properties` 로. `perf-baseline.mjs` 기본 열림 패널 `properties` → `design` (레일 이름 — 바꾸지 않으면 Design 이 열리지 않은 채로 재서 카운트가 거짓으로 낮아진다).

### 개정 — Modified 탭 제거 (2026-10-04, 사용자 「진행해」)

- **코드**: `styleGroups.ts` 의 `StyleViewId` · `STYLE_VIEW_IDS` · `isStyleGroupId` 제거 (뷰 = 그룹 4) · `DesignViewId = "property" | StyleGroupId` · `StylesPanel.tsx` 의 Modified 본문 분기 · `useStylesTabMarks` → `useStylesDirtyGroups` (개수 없음) · `StylesPanelTabs` 탭 5 · 최소 폭 264 → 233. i18n `styles.modified` · `modifiedHint` · `modifiedCount` 제거 (`I18nProvider.test` 의 매개변수 예시는 `navigator.layersDragCount` 로). `ModifiedStylesSection` 은 쓰는 곳이 없어 삭제 (사용자 「삭제해도 돼」) — `.tsx` · `.css` · 테스트 2 · `sections/index.ts` export · 라벨 `styles.modified.{title,empty,emptyHint}` · `editorPresentationPhase2.static.test.ts` 의 read-only 단언. 삭제 뒤 builder 4,576 · type-check 0 · live 22/22.
- **폭** (`adr252-live.mjs widths`, en · ko): 5탭 × 233 · 387 px 에서 선택 탭 라벨 `scrollWidth ≤ clientWidth` 10/10 — en 「Property」 47/47, ko 「레이아웃」 41/41.
- **live** 22/22 (G1 스타일 탭 4 × 2폭 차이 0 · Property 페이드 띠 밖 0 · G2 10), 페이지 오류 0. unit builder 4,582 · type-check 0.
- **G4 재측정**: initial JS gzip **−59 B** (raw −943 · CSS +9) — 「증가 0」 충족, +346 B 예외는 필요 없어졌다. ratchet (seed 60 · 600 전 부류) A등급 초과 0 (올린 상한 245 적용) · B 경고 7 그대로.
