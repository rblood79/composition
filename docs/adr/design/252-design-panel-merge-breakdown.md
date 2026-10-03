# ADR-252 breakdown — Properties · Styles 패널을 Design 패널로 통합

> 본문: [ADR-252](../252-design-panel-merge.md). 대안 A 기준 (사용자 2026-10-03 「권장안으로」). 줄 번호는 main `db76cc301` 기준이며 G0 에서 다시 확인한다.

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
