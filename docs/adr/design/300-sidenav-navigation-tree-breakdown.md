# ADR-300 breakdown — SideNav 가족 (RAC NavigationTree · S2 SideNav / SideNavPanel)

> 본문: [../300-sidenav-navigation-tree.md](../300-sidenav-navigation-tree.md). 여기는 Phase · 파일 · 값 · 검증 절차만 둔다. 결정 · 대안 · 위험은 본문이 정본이다.

## §1 ADR 분리 4 질문 lock-in

1. **base / 응용 분류**: fork 가 아니다 — 기존 ADR 의 잔여 영역을 나누는 것이 아니라 새 컴포넌트 가족 등록이다. Tree 가족 ([ADR-239](../completed/239-tree-submenu-swatch-item-origins.md) · [ADR-256](../completed/256-rac-composition-level.md) Phase 5h) 은 **등록 경로의 선례**일 뿐 선행 조건이 아니다 — 300 은 Tree type 을 바꾸지 않는다.
2. **schema 직교성**: 새 type 7 은 Tree type 3 과 직교 (공유 노드 · 공유 rule 없음). 공유하는 것은 RAC 부품 (`NavigationTree` 가 `Tree` 를 감쌈) 과 `LinkContext` · `RouterProvider` 경로뿐이다.
3. **선행 ADR 전제 reverse 검증**: ADR-239 는 NavigationTree 를 「범위 밖」 (239 본문 94행) 으로 두었을 뿐 반대 결정을 하지 않았다 — 의존 방향 반전 없음. ADR-295 (값 정본 = S2 설치본) · ADR-297 (상태 우선순위 = 조건 트리) 은 그대로 적용한다.
4. **판독 라운드에 전제 검증을 미루지 않음**: 위 1~3 은 2026-11-02 대화 (Status 인용) 에서 사용자가 A 를 고르며 확정했다.

## §2 등록 지점 — Tree 선례 대조 (Phase 0 에서 줄 번호 재확인)

| 지점                    | Tree 선례                                                                                                          | SideNav 가족                                                                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| binding                 | `catalog/bindings/Tree.binding.ts` · `TreeItem.binding.ts` · `TreeItemContent.binding.ts`                          | 7 파일 `SideNav*.binding.ts`                                                                                                                                                                                                         |
| binding 색인            | `catalog/bindings/index.ts`                                                                                        | 같은 파일                                                                                                                                                                                                                            |
| catalog entry           | `componentCatalog.ts:1026` · `:1036` · `:1051` (`FAMILY_5_CUTOVER`, `tree-table`)                                  | 같은 파일 — family · category 는 Phase 0 에서 정함                                                                                                                                                                                   |
| 시각 rule               | `generated/componentRulesTable.ts` (직접 편집 정본)                                                                | 7 rule + Panel 조상 상태 조건                                                                                                                                                                                                        |
| 수동 상자 (Canvas)      | `document/manualBoxRules.ts:255` (`TREE_ROW_HEIGHT`) · `:872-888`                                                  | 행 32 · 들여쓰기 · 막대 · chevron · rail 42                                                                                                                                                                                          |
| children 종류 · owner   | `domain/componentTraits.ts:346-387`                                                                                | Panel `free` · SideNav `items(SideNavItem · SideNavSection)` · Item `items(SideNavItem) + SideNavItemContent` · ItemContent `free` (owner Item) · Section `items(SideNavHeader · SideNavItem)` · ItemLink `free` (owner ItemContent) |
| 필수 부품               | `nesting/requiredParts.ts` · `nestingRules.ts`                                                                     | Item → ItemContent 필수 (RAC 가 행 내용을 요구)                                                                                                                                                                                      |
| RAC slot 표             | `generated/racSlotProviders.ts` (생성기 `apps/builder/scripts/adr256-gen-rac-slots.mjs`)                           | 재생성 — NavigationTree 는 `LinkContext` 를 제공                                                                                                                                                                                     |
| D2 출처                 | `document/d2Provenance.ts` · `document/s2PropAlignment.ts`                                                         | S2 type 매핑 7 행 (확장 0 목표)                                                                                                                                                                                                      |
| origin template         | `document/generated/reusableOriginLibrary.ts:1089` (`Tree`) · `:1685~` (`TreeItem/*` 상태)                         | `SideNavPanel` · `SideNav` · `SideNavItem/*` (Default · Current · CurrentAncestor · Disabled · Collapsed)                                                                                                                            |
| contract                | `document/types.ts:148` `LIBRARY_CONTRACT_VERSION`                                                                 | +1 (반영 시점 main 기준)                                                                                                                                                                                                             |
| Preview DOM             | `runtime/delegatedDom.runtime.ts:123` · `:160` · `:764-810` · `runtime/domBinding.runtime.ts:1108-1112` · `:1693`  | NavigationTree 부품 · Panel div + Button + 접힘 context                                                                                                                                                                              |
| Router                  | `runtime/domView.components.tsx:73` (`RouterProvider`)                                                             | 그대로 — 새 router 0                                                                                                                                                                                                                 |
| Canvas                  | `apps/builder/src/builder/catalogRuntime/canvasBinding.ts:614` · `:928`                                            | 행 · Panel 접힘 dirty 확장                                                                                                                                                                                                           |
| 팔레트                  | `apps/builder/src/builder/panels/components/paletteItems.ts:301` (`Tree`)                                          | 사용자 결정 3                                                                                                                                                                                                                        |
| Design 패널             | `apps/builder/src/builder/panels/design/DesignPanel.tsx`                                                           | binding `accepts` 로 자동 + 필요한 편집기                                                                                                                                                                                            |
| 조건 어휘 (리뷰 h1 ①)   | `catalog/rule/conditionTree.ts:139` (모르는 키 = `CONDITION_TREE_UNKNOWN_KEY` 예외)                                | `isCollapsed` 조건 키                                                                                                                                                                                                                |
| paint 조건 집합 (h1 ③)  | `catalog/resolvers/resolveCatalogPaint.ts:86-98` (노드 자신의 값만)                                                | Panel 에서 상속한 `isCollapsed` 를 조건 집합에                                                                                                                                                                                       |
| 조상 상속 (h1 ③)        | `runtime/presence.ts:1952-1969` (ADR-281 페이지 · frame `isDisabled` 상속) · `runtime/inheritedProps.ts`           | Panel → 자손 SideNav 부품                                                                                                                                                                                                            |
| 증분 재판정 (h1 ⑤)      | `runtime/presence.ts:3485-3489` `catalogStateDependents` (`showWhen` 자식만) · `compositionRoot.ts:2557` · `:5063` | Panel 값 변경 → 자손 행 재해석                                                                                                                                                                                                       |
| 배포 workflow (리뷰 m1) | `.github/workflows/deploy.yml` (build → gh-pages 배포) · `apps/builder/scripts/adr209-bundle-closure.mjs`          | build 뒤 절대 상한 단계                                                                                                                                                                                                              |
| CSS                     | `packages/shared/src/components/styles/Tree.css`                                                                   | `pnpm generate:css` 산출 (수동 CSS 0 목표)                                                                                                                                                                                           |

## §3 S2 값 표 (설치본 `@react-spectrum/s2` 1.8.1 `src/SideNav.tsx` · `src/SideNavPanel.tsx`, source map 원문)

| 부위           | 값                                                                                                                                     | S2 줄                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| SideNav 바깥   | `minWidth` 160 (Panel 안이면 unset) · flex · `overflow: clip`                                                                          | `SideNav.tsx:122-139`                           |
| tree           | `--indent` 16 · `overflowY: auto` · focus ring `outlineOffset` −2                                                                      | `:144-161`                                      |
| 행             | `minHeight` 32 · `borderRadius: sm` · `marginTop: space(6)` (첫 행 0) · `font: ui` · 색 `neutral-subdued` · link 면 `cursor: pointer`  | `:230-256`                                      |
| 행 grid        | 열 `[12, auto, auto, 1fr, auto, auto]` · 영역 `. level-padding icon content actions actionmenu` · `paddingEnd` 4 (접힘 0)              | `:258-271`                                      |
| 현재 행        | 색 `neutral` · `fontWeight: bold` (현재 조상이면서 닫힌 행도 같음)                                                                     | `:272-285` · `:464`                             |
| 아이콘         | `marginEnd: text-to-visual` (접힘 0) · 크기 `1lh` · `currentColor`                                                                     | `:290-300` · `:502`                             |
| 글자           | 접힘 시 `display: none`                                                                                                                | `:302-311`                                      |
| 현재 표시 막대 | 2 × 18 · `borderRadius: full` · hover `gray-400` · 현재 `gray-800` · 위치 `(level − 1) × indent + 4`                                   | `:390-419`                                      |
| focus ring     | `outlineWidth` 2 · `outlineOffset` −2 · `focus-ring` 색                                                                                | `:313-328`                                      |
| chevron 버튼   | 32 × 32 · 펼침 `rotate(90deg)` (RTL −90) · 150 ms · 접힘 시 `display: none` · 자식 없으면 `visibility: hidden`                         | `:531-566`                                      |
| 구역           | 두 번째 구역부터 `marginTop` 24                                                                                                        | `:618`                                          |
| 머리           | `font: ui-sm` · `fontWeight: medium` · `gray-600` · `paddingStart: edge-to-text` · `marginBottom` 8 · `height` 16 · Panel 접힘 시 숨김 | `:637-651`                                      |
| ItemLink       | grid `icon content badge` · `textDecoration: none` · `color: inherit`                                                                  | `:330-344`                                      |
| Panel          | flex column · `height: full` · 접힘 폭 `--collapsedWidth` 42 · `transition: width` 200 ms (reduced motion 이면 없음)                   | `SideNavPanel.tsx` `sideNavPanelStyle`          |
| Panel 버튼 칸  | `marginTop` / `marginBottom` 4 · `marginStart` 4 · quiet ActionButton + 패널 아이콘 (20 뷰박스, 안쪽 막대 폭 5 ↔ 1.5)                  | `SideNavPanel.tsx` `ExpandButton` · `PanelIcon` |

토큰 이름 (`neutral-subdued` · `gray-800` · `space(6)` · `ui` · `ui-sm` · `edge-to-text` · `text-to-visual`) 은 ADR-295 규칙대로 저장소 TokenRef 이름으로 옮기고, 값은 `d3S2Alignment.static.test.ts` 가 대조한다.

## §4 D1 구조 — 기준 예제

- 기준 예제: S2 `SideNav.md` 첫 예제와 같은 트리 (2단 중첩 · 링크 없는 부모 「Support」 · `defaultExpandedKeys`) 를 **설치 RAC `NavigationTree*` + RAC `Link`** 로 그린 것 (S2 아님 — D1 권위는 RAC).
- 대조 항목: 태그 · 부모/자식 · 순서 · 텍스트 · role (`treegrid`/`tree` · `row` · `gridcell` — 설치본이 내는 그대로) · `aria-current="page"` · `aria-expanded` · `aria-level` · `aria-labelledby` (ItemLink → 글자 id). 자동 id 문자열 · class · inline style · 추적 data 속성은 제외 (RAC 조립 계약 §변경 범위의 검증).
- 하니스: `apps/builder/scripts/adr256-g5/` (구조 비교).

## §5 Phase

### Phase 0 — 인벤토리 · 기준선 (동작 변경 0)

- §2 표의 줄 번호 재grep · 추정 대비 실측 파일 수 (Tree 선례 53).
- 본문 Decision 3 다섯 층의 현재 상태를 하나씩 기록 (리뷰 h1): ① 조건 키 (`conditionTree.ts:139`) ② 생성 CSS 조상 선택자 (`packages/rendering/scripts/generate-css.ts` · CSSGenerator — `domOnly` 아닌 두 consumer 공용 매핑) ③ resolver 상속 (`presence.ts:1952-1969` 선례) ④ 숨김이 Canvas 레이아웃 입력에 닿는지 (`display: none` → 엔진) ⑤ 증분 dependents (`catalogStateDependents` · `canvasBinding.ts` dirty 확장).
- 번들 기준선 (Builder · Preview) — 299 의 진행 Phase 반영 뒤 main.
- §4 기준 예제 DOM 캡처.
- worktree 생성 (`claude --worktree adr-300` 또는 EnterWorktree) — 299 와 같은 contract 테스트 파일을 만지므로 격리.

### Phase 1 — 문서 · catalog (G1)

- binding 7 · entry 7 · `componentTraits` · nesting · `d2Provenance` / `s2PropAlignment` · rule 7 (§3 값) · origin template · contract +1 · `pnpm generate:css` · `racSlotProviders` 재생성.
- Decision 3 다섯 층 (리뷰 h1): 조건 키 `isCollapsed` · CSS 조상 선택자 매핑 · Panel → 자손 상속 (resolver) · 숨김의 레이아웃 반영 · 증분 dependents. 단위: 조건 트리가 `isCollapsed` 를 예외 없이 평가 · 중첩 Panel 이면 가장 가까운 Panel 을 따름 · Panel 값만 바꾼 증분 해석이 전체 재해석과 같음.
- 사용자 결정 4 (actions 자리) 를 여기서 묻는다.
- 단위: `d2S2Alignment` · `d3S2Alignment` · contract 테스트 묶음 (Tree 선례가 바꾼 `phase3*` · `phase4*` 등) · nesting · traits. 원복 RED: binding 의 `textValue` 제거 → `d2S2Alignment` FAIL.

### Phase 2 — Preview DOM (G2 · G4 첫 측정)

- `delegatedDom.runtime.ts` / `domBinding.runtime.ts` 에 NavigationTree 부품 · `selectedRoute` 공급 (사용자 결정 1) · Panel div + RAC Button + 접힘 상태 · `data-side-panel-collapsed` 속성.
- 유효 펼침 키 (리뷰 h2, 본문 Decision 4): binding 이 RAC 에 `isCollapsed ? ∅ : expandedKeys` 를 넘기고 사용자 펼침 변경은 저장 키에만 쓴다 — 다시 펼치면 저장 키로 복원.
- 배포 workflow 절대 상한 단계 (리뷰 m1, G4 (a)) — 이 Phase 의 첫 배선 커밋에 같이.
- 첫 배선 커밋에서 `adr201-bundle-gate.mjs` → 초과면 lazy 분리 (`domBinding.components.tsx:22` DnD 선례) 또는 사용자 결정 5.
- 사용자 결정 2 (view transition) 를 여기서 묻는다.
- G2: §4 대조 · 키보드 (위/아래 화살표 · 오른쪽 펼침 · Enter 이동 · 링크 없는 부모 행 Enter = 펼침).

### Phase 3 — Canvas (G3)

- `manualBoxRules` (행 · 들여쓰기 · 막대 · chevron · rail) · `canvasBinding` dirty 확장 (Panel `isCollapsed` → 자손 행) · displayState (`isCurrent` · `isCurrentAncestor` · `isCollapsed`) · Canvas 도 같은 유효 펼침 키로 자식 행 · 현재 조상 표시 판정 (리뷰 h2).
- G3 fixture 8 + 증분 갱신 arm (§6 조건).

### Phase 4 — 노출 · 패널 · Interactions · code view (G4 · G5)

- `PALETTE_ORDER` (사용자 결정 3) · Design 패널 편집기 · Interactions 의 `onCollapsedChange` · `onExpandedChange` (RAC/S2 표면 그대로 — 메모리 `project-interactions-expose-rac-surface-not-new-vocabulary`) · code view 투영 (레퍼런스 모양의 RAC 코드).
- G4 최종 번들 · G5 live (5174+, 사용자 5173 서버 건드리지 않음) · CHANGELOG · README.

## §6 측정 조건

| Gate | oracle                                                               | fixture                                  | 불리 케이스                                                  | 조건 기록                                                     |
| ---- | -------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| G2   | 설치 RAC 기준 예제 DOM (독립)                                        | §4 트리 (사람이 짠 2단 · 링크 없는 부모) | 링크 없는 부모 행 · 비활성 행 · 접힌 Panel (빈 유효 펼침 키) | Chrome 버전 · locale (ltr)                                    |
| G3   | DOM 렌더 vs Skia 렌더 (독립 두 arm)                                  | fixture 8 (본문 G3)                      | Panel `isCollapsed` 만 바꾼 증분 갱신                        | viewport · DPR · theme (light/dark) · visibilityState visible |
| G4   | (a) 배포 workflow 의 production dist (b) 같은 빌드 조건 before/after | production 빌드                          | —                                                            | 커밋 해시 (b 는 두 개)                                        |

## §7 사용자 결정이 닿는 Phase

| 결정                   | Phase          |
| ---------------------- | -------------- |
| 1 `selectedRoute` 출처 | 2              |
| 2 행 view transition   | 2              |
| 3 팔레트 노출 단위     | 4              |
| 4 행 actions 자리      | 1              |
| 5 번들 초과 시         | 2 (G4 첫 측정) |

## §8 기록

### Phase 0 — 2026-11-02 (main `b0d1e77e4`, 작업 트리 dirty = `.agent/task-state.json` 만)

- **격리**: ADR-299 의 코드가 `b0d1e77e4` 로 main 에 들어가 R4 의 조건 (「299 해당 Phase 반영 뒤」) 이 이미 성립 — 같은 checkout 에서 진행하고 커밋은 pathspec 으로 한다 (worktree 생략, 사후 보고).
- **등록 지점**: Tree 선례 `0dfcc0282` 53 파일 중 테스트 밖 production 은 15 — binding 3 · `bindings/index.ts` · `componentCatalog.ts:1026` · `:1036` · `:1051` · `componentTraits.ts:346-387` · `nestingRules.ts:254` · `slotRoles.ts:416` · `generated/racStateKeys.ts:226-235` · `manualBoxRules.ts:252` · `:872-923` · `reusableOriginLibrary.ts` · `types.ts:148` (`LIBRARY_CONTRACT_VERSION = 53`) · `resolver.ts:340` · `:380` · `:1145` · `delegatedDom.runtime.ts:123` · `:160` · `:764-880` · `:1965-1996` · `domBinding.runtime.ts:1110-1114` · `:1695` · `:2890` · `presence.ts:523-556` · `:874-879` · `:946-1002` · `:1358-1397` · `canvasBinding.ts:604` · `:918-922`. 7 type 추정 60 ~ 80 파일 (테스트 포함) — 1.5 배 기준 안.
- **Decision 3 다섯 층의 현재 상태**:
  1. 조건 키 — **없음 → 새로 만듦**. `CONDITIONS` (`conditionTree.ts:13-27`) 에 `isCollapsed` 가 없어 `walk` 가 `CONDITION_TREE_UNKNOWN_KEY` (`:139`). Canvas 가 아는 조건이라 `DOM_CONDITIONS` 가 아니라 `CONDITIONS` 에 둔다.
  2. 생성 CSS 조상 선택자 — **기구 있음, 키만 새로**. `compileConditionTree` 가 조건 선택자를 `root:where(…)` 에 넣고 (`:254-266`), 조상 선택자 선례가 `inPopover: ":is(.react-aria-Popover *)"` (`:202`). `isCollapsed: ":is([data-side-panel-collapsed] *)"` = S2 `SideNav.tsx:642` 와 같은 선택자. `domOnly` 아님.
  3. resolver 조상 context — **기구 있음 (다른 축), 새 파생 값**. ADR-281 `catalogAncestorInherited` (`inheritedProps.ts:58`) 는 RAC `Provider` 로 가는 값 (body · frame 의 `isDisabled` …) 이라 섞지 않는다. 선례 = `_inGroup` (`presence.ts:2122-2130` `catalogDisclosureGroupPosition` → derived props → `compositionRoot.ts:1167` · `canvasBinding.ts:1213`). SideNav 부품은 가장 가까운 `SideNavPanel` 의 `isCollapsed` 를 derived `_sideNavCollapsed` 로 받고, paint 조건 집합 (`resolveCatalogPaint.ts:86-98`) 이 그 값을 `isCollapsed` 로 읽는다.
  4. 레이아웃 · 표시 — **기구 있음**. 숨김은 presence (`catalogHiddenAtRest`) → `styleOf` 가 `catalogParticipatesInLayout` 거짓이면 `display: none` (`compositionRoot.ts` `styleOf` 첫 줄) — 엔진 입력에 닿는다. 선례: 자식 없는 TreeItem 의 chevron 숨김 (`presence.ts:876-879`, DOM 은 `Tree.css`).
  5. 증분 dependents — **없음 → 새로 만듦**. `catalogStateDependents` 는 `showWhen` 자식만 (`presence.ts:3489-3509`), ADR-281 의 host 변경 확장 (`compositionRoot.ts:5109-5115` `catalogHostInheritedChanged` → `catalogInheritedReceivers`) 은 `CATALOG_INHERITANCE_HOSTS` (body · frame) 한정. Panel `isCollapsed` 변경 → 자손 SideNav 부품 재해석 · presence 재판정을 같은 자리에 더한다.
- **기준 예제 DOM** (설치 RAC 1.22.1 `NavigationTree*` + `Link`, `renderToString` — §4 트리, `selectedRoute="/background-layers"`): 루트 `div[role=treegrid][aria-label]` · 행 `div[role=row]` (`aria-level` · `aria-posinset` · `aria-setsize` · 자식 있으면 `aria-expanded` · `data-has-child-items` · 링크 행은 `data-href` · 현재 조상 `data-current-ancestor`) > `div[role=gridcell][aria-colindex=1]` > `a[href]` (현재 행은 `aria-current="page"` · `data-current`). 링크 없는 부모 「Support」 는 gridcell 안 글자뿐. 빈 펼침 키 arm: 1단 두 행만 · 둘 다 `aria-expanded="false"` · 「Guidelines」 는 `data-current-ancestor` 유지 (Decision 4 의 대조 기준). 스크립트 · 산출: run ledger `2026-11-02-adr300` (로컬).
- **번들 기준선** (`vite build` → `adr209-bundle-closure.mjs`): Builder initial JS gzip **1,406,043** (상한 1,410,000 — 여유 **3,957 B**) · Preview **322,341** (상한 325,000 — 여유 **2,659 B**). F7 의 Builder 여유 추정 8.1 KB 는 299 Phase 2 ~ 4 뒤 3.9 KB 로 줄었다 — Builder 도 Δ 상한 (4,096) 보다 절대 상한 여유가 작다. G4 (a) 첫 측정에서 두 bundle 을 같이 본다.
- **S2 표면 재확인** (`dist/types/src/SideNav.d.ts` · `SideNavPanel.d.ts`): `SideNavItemProps` = `NavigationTreeItemProps` − (`className` · `style` · `render` · `onClick` · `allowsArrowNavigation` · `value` · `onAction` · GlobalDOM) + `textValue: string` · `hasChildItems?`. `SideNavPanelProps` = `AriaLabelingProps` + `isCollapsed?` · `defaultCollapsed?` · `onCollapsedChange?` · `styles?`. `SideNavItemLinkProps` · `SideNavItemContentProps` = `children` 뿐.

### Phase 1 — 2026-11-02 (G1)

- **등록**: binding 7 은 한 파일 (`catalog/bindings/SideNav.binding.ts` — `bindings/index.ts`) · entry 7 (`componentCatalog.ts` family `tree-table`, category `navigation`, 전부 `placeable: false` — 팔레트는 Phase 4 사용자 결정 3) · traits (`SideNav` · `SideNavSection` · `SideNavItem` collection, 부품 owners) · nesting (`SideNavItemLink` = interactive host, `SideNav` · `SideNavItemLink` interactive) · `ruleDefinition.ts` (`SideNavItem` 의 `id` · `SideNav` 의 `expandedKeys` · `defaultExpandedKeys`) · contract 54 (`types.ts` + 테스트 · 샘플 파일 literal).
- **노드 트리** (결정 4 = 권고 「자유 내용 + grid 칸」): `SideNavPanel > SideNav + Button[slot=collapse] > Icon(panel-left)` · `SideNavItem > SideNavItemContent > Icon{icon} + SideNavItemLink > Text{label} + Button[slot=chevron] > Icon(chevron-right)` · 섹션 `SideNavSection > SideNavHeader + SideNavItem…`. S2 가 스스로 그리는 접기 버튼 · chevron 은 작성자 `Button` 노드로 둔다 (Tree chevron 선례 — 두 consumer 가 노드로 배치), 현재 표시 막대는 행 rule (`::before` — Canvas 는 Phase 3). 잎 항목의 chevron 은 상자를 두고 글리프만 숨긴다 (S2 `visibility: hidden`).
- **origin 3**: `component-sidenavitem` (위 행) · `component-sidenav` (S2 예제 모양 — Home `/` · Guides `/guides` > Getting started · Settings, `expandedKeys: ["item-2"]`) · `component-sidenavpanel` (nav instance + 접기 버튼, 폭 240). `NESTED_REUSABLE_ORIGIN_TYPES` 에 둔다 — 팔레트 노출은 Phase 4.
- **rule 7** (§3 값): Panel `stateStyles.width { isCollapsed: 42px }` · 접힘의 글자 · chevron · 머리 `display: none` · 행 내용 끝 여백 0 (`partStateStyles` — 조건 트리) · nav 안 SideNav `min-width: 0` (S2 `isInSideNavPanel`) · 접기 버튼 칸 margin 4. 행: 최소 32 (`scaled`) · `radius.sm` · 글자 `text-sm` (S2 ui) · `neutral-subdued` → 현재 `neutral` bold · 막대 2 × 18 (`::before`, hover `border-hover` · 현재 `fg`) · 행 내용 `12 + (level − 1) × 16` 앞 · 4 뒤. 머리 `text-xs` 500 · 높이 16 · 아래 8. 생성 CSS 6 (`SideNavItemContent` 는 요소가 없어 생성 생략) · `styles/index.css` import.
- **Decision 3 다섯 층**: ① `CONDITIONS` 에 `isCollapsed` · `isCurrent` (Canvas 가 아는 조건 — `conditionTree.ts`) ② 선택자 `isCollapsed: ":is([data-side-panel-collapsed], [data-side-panel-collapsed] *)"` (패널 자신과 자손 — 폭 · 자손 숨김을 한 조건으로) · `isCurrent: ":is([data-current], [data-current-ancestor]:not([data-expanded]))"` (S2 `isDescendantSelected`) ③ `runtime/sideNav.ts` `catalogSideNavDerived` — 가장 가까운 Panel 의 `isCollapsed ?? defaultCollapsed` → `_sideNavCollapsed`, 항목 `_sideNavCurrent` · `_sideNavLevel` → `presence.ts` `catalogDerivedProps` → `resolveCatalogPaint` 조건 ④ `catalogSideNavHidden` → `catalogHiddenAtRest` (닫힌 항목의 하위 · 접힘의 글자 · chevron · 머리) → `styleOf` 의 `display: none` ⑤ `catalogSideNavDependents` — `catalogDerivedPropsDependents` · `catalogPresenceScope` (Panel · SideNav) · `catalogPresenceDependents`. Decision 4 유효 키 = `catalogSideNavEffectiveKeys` (접힘 ∅ · 저장 키 보존).
- **검증**: `runtime/__tests__/adr300SideNav.test.ts` 9 (조건 평가 · CSS 선택자 · 상속 · 숨김 · dependents · 유효 키 · 현재 · level) — 원복 RED: `_sideNavCollapsed` 상속 제거 → 1 FAIL. `d2S2Alignment.static.test.ts` PASS (확장 0) — 원복 RED: SideNavPanel 에 S2 밖 키 `collapsed` → FAIL. `d3S2Alignment` · `componentRulesTable.static` (치수 리터럴 · `&` 상태 분기 · archetype) PASS · census 159 · shared catalog 1,215 · builder unit 7,633 PASS · `pnpm type-check` PASS.
- **live (커밋 전 `/verify`, 2026-11-02, Chrome MCP · 5175 별도 서버)**: 새 프로젝트 → IndexedDB head `libraryContractVersion: 54` 저장 · 팔레트 검색 「tree」 로 Tree 넣기 → Canvas 행 2 · Compare Mode CSS 쪽 같은 모양 (Preview DOM `role=row` 2) · Preview 문서에 SideNav 생성 시트 규칙 42 · 새로고침 다시 열기 · 콘솔 오류 0. SideNav 자체는 아직 그리지 않는다 (Phase 2 · 3) — 팔레트 검색에 없음 (placeable false).
- **이 Phase 와 무관한 실패** (HEAD 의 다른 커밋 몫 — 건드리지 않음): shared `designDataSurfaceGaps` Toast 1 · builder unit 16 (Button padding 7 ← `20388ea2e` · Calendar When · i18n 키 수 · chromeIsland 등 11 파일).
- **Phase 2 · 3 로 넘긴 것**: DOM 행 = RAC 평평한 형제 행 vs Canvas = 항목 column (SideNavItem `containerStyles` 의 column 이 DOM 행에도 실림 — Phase 2 cross-check) · 섹션 첫째 아닌 것의 24 (Canvas 는 part rule 이 `:not(:first-child)` 를 못 읽는다 — Phase 3 파생 표지) · 접힌 Panel 폭 42 가 작성 폭을 이기는 경로 (DOM inline · Canvas `styleOf`) · `selectedRoute` 기본값 (결정 1).

### Phase 2 — 2026-11-02 (G2 · G4)

- **DOM**: `runtime/sideNav.components.tsx` — `CatalogSideNavPanel` (S2 `SideNavPanel.tsx:96-201`: `div` · 라벨 있으면 `region` · `data-side-panel-collapsed` = 내용 접힘 · 접힌 동안 작성 폭 inline 을 빼 rule 의 42 가 적용 · 접기 버튼 = 작성자 `Button[slot=collapse]` 에 RAC `ButtonContext` 로 press · 이름 — S2 i18n `sidepanel.expand` / `collapse` en · ko) · `CatalogSideNav` (RAC `NavigationTree` — 유효 키 = 접힘이면 ∅, 저장 키 보존 · 펼침 변경은 transition 안 local state → 뒤에 record 실행 값으로) · 행 = `NavigationTreeItem` (`render` 로 `ViewTransition` 감쌈) · 부품 `sidenavitemcontent` · `sidenavitemlink` (RAC `Link` — `LinkContext` 의 `href` · `aria-current` · 링크 없는 부모 행 펼침 press) · `sidenavheader` (`viewTransitionName`). delegated `sidenavpanel` · `sidenav` (`delegatedDom.runtime.ts`) 가 record 에서 항목 · 섹션 표를 만들고 (`sideNavEntries`) 실행 상태 `isCollapsed` (`isCollapsed ?? defaultCollapsed`) · `expandedKeys` 를 준다.
- **사용자 결정 1** — `selectedRoute` 가 비면 `CatalogCurrentRouteContext` (`sideNavRoute.ts`, `CatalogPreviewView` 가 `session.path` — Preview · Publish 공용). live: `/child` 로 이동하면 Child 행이 현재 행.
- **사용자 결정 2** — S2 순서: 접기 = 내용 즉시 숨김 + 폭 200 ms · 펴기 = 폭 먼저 (`transitionend` 또는 250 ms) 뒤 `side-panel-expand` transition 으로 내용. 행 펼침 · 접힘 = `side-nav-item-expand` · `-collapse` transition. view transition CSS 는 SideNav rule `externalStyles` (S2 `SideNav.module.css` 값). reduced motion = view transition `none` · 폭 전환 0s.
- **사용자 결정 5 · G4** — 첫 배선 (eager) 측정: Builder 1,411,819 (상한 1,410,000 초과) · Preview 324,721. 내 Phase 2 몫 (같은 트리 B arm — 내 파일만 HEAD) Builder +3,231 · Preview +1,205. → lazy chunk (`sideNav.lazy.ts` — `use` 로 읽는 한 promise · 정착 뒤 동기, 경계가 DOM pass 의 상태 style · handler 를 안쪽 요소로) 뒤 Builder 1,409,737 · Preview 323,815 — `adr201-bundle-gate.mjs` PASS (Δ +3,694 / +1,474, 기준선 `b0d1e77e4` 대비 — Phase 1 · 다른 세션 WIP 포함). G4 (a): `.github/workflows/deploy.yml` 「Initial bundle ceiling (ADR-201)」 단계 (build 뒤 · 배포 앞) — 로컬 dist 로 두 arm 실행 (상한 1,410,000 = exit 0 · 1,409,000 = exit 1). **Builder 여유 263 B** — Phase 3 (Canvas) 에서 넘을 가능성이 크다.
- **rule DOM 보정** (Canvas 는 그대로): RAC gridcell 이 `display: contents` 라 DOM 행 (`.react-aria-SideNavItem`) 이 S2 `treeCellGrid` 줄 — row · 가운데 · 앞 `12 + (level − 1) × 16` · 뒤 4 · gap 0, 부품 배치 (Icon 끝 8 · 글자 · 링크 1fr · chevron 32 × 32 `all: unset`, 잎은 `visibility: hidden`, 펼침은 글리프 90°). 행 · 머리 Text 는 주인의 글자 · 색을 받는다 (`& .react-aria-Text { inherit }` + DOM inline 제외 — `catalogSideNavTextOwner`), 행 Icon · chevron 글리프는 `color: inherit`. 흐름 행이라 SideNav · Section · Item 의 column gap 은 DOM 에서 0 (간격은 행 margin 6 · 섹션 24). 행 `rootSelectors["&"]` 의 휴지 색 중복 삭제 (paint 트리 뒤에 와서 현재 행 색을 이겼다). 머리 margin-bottom 8 은 `containerStyles` 하나 (S2: 머리 8 + 첫 행 6).
- **검증**: `adr300SideNavDom.test.tsx` 10 — 구조 대조 3 arm (설치 RAC 기준 예제) · 현재 행 · Panel (region · 접힘 속성 · 작성 폭 해제 · 버튼 이름) · 행 부품 상속 · 접기/펴기 순서 · lazy 정적 import 게이트 · 판독 수리 2. 원복 RED: 유효 키 → 2 FAIL · 경로 기본값 → 2 FAIL · 행 gap → 1 FAIL · lazy 경계 → 1 FAIL. shared catalog 1,214 (+ 기존 Toast 1) · builder 인접 98 · type-check (shared · builder) PASS.
- **live (Chrome MCP · 5175, Compare Mode CSS 쪽 · 데스크톱)**: origin Panel 을 dev handle 로 넣기 → 현재 행 Home (굵게 · neutral · 막대) · 다른 행 subdued 14px · 아이콘→글자 8 · 행 32 + 6 · 들여쓰기 28. 키보드: ↓ (링크로 focus) · ← 접힘 (`side-nav-item-collapse` 1회) · → 펼침 (`side-nav-item-expand`) · type 정의로 만든 링크 없는 부모 행 Enter → 펼침 · 링크 Enter → 세션 이동 (`/settings` 404 화면). 접기 → 42 · 글자 · chevron 숨김 · `aria-expanded=false` · 버튼 이름 「Expand side panel」 / 펴기 → 폭 중간 123 → 240 · 내용 복귀 (`side-panel-expand`) · 저장 키 복원. 새로고침 첫 로드 (lazy) 그대로 · 콘솔 오류 0 (수정 전 조건부 `use` 오류 2 → 수리).
- **판독 (reviewer 1회)**: MEDIUM 1 — DOM 행에 Canvas column gap 6 이 남음 → 수리 · 원복 RED. 가설 「lazy `Suspense` 가 상태 style · rule handler 를 버린다」 → Phase 4 `onCollapsedChange` · `onExpandedChange` 가 그 길이라 수리 (`SideNavLazyBoundary` + `overScopeProps`) · 원복 RED. 가설 「chunk import 실패 = throw」 는 LOW deferred (다른 lazy chunk 와 같은 조건).
- **범위 밖으로 확인한 기존 결함**: Publish 의 layer 밖 `* { margin: 0 }` (`apps/publish/src/styles/index.css:23`) 가 생성 sheet (`@layer components`) 의 margin 을 모두 이긴다 — Publish 에서 SideNav 행 margin 6 이 0 (Preview iframe 은 6). 다른 컴포넌트에도 같은 영향.
- **Phase 3 로 넘긴 것**: Canvas 그리기 전부 (행 · 들여쓰기 · 막대 · chevron · rail · 글자 상속 · 접힌 폭 42 가 작성 폭을 이기는 `styleOf`) · 섹션 첫째 아닌 것의 24 파생 표지 · Phase 1 에서 넘긴 항목 그대로.

