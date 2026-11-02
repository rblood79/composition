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
