# ADR-300: SideNav 가족 — RAC `NavigationTree` 위에 S2 `SideNav` · `SideNavPanel` 표면을 그대로 올리고, 접기 · 아이콘 줄은 catalog rule 로 두 consumer 가 같이 그린다

## Status

Accepted — 2026-11-02 (사용자 `/execute-adr 300` · [reviews/300.md](reviews/300.md) round 2 HIGH 0 · pending 0)

> **Phase 2 닫힘 (2026-11-02)**: G2 — Preview DOM = 설치 RAC `NavigationTree` · `NavigationTreeItem` · `NavigationTreeItemContent` · `Link` · `NavigationTreeSection` · `NavigationTreeHeader` (`runtime/sideNav.components.tsx`, delegated `sidenavpanel` · `sidenav` + 부품 3). 구조 대조 PASS (설치 RAC 기준 예제 3 arm — 저장 키 · 현재 경로 · 접힌 Panel 의 빈 유효 키 Decision 4) · 사용자 결정 1 = 세션 경로 context (`sideNavRoute.ts`) · 결정 2 = DOM 이 S2 동작을 돈다 (Panel 폭 200 ms · 내용은 폭 뒤 · 행 · 머리 view transition 3 종 · reduced motion 끔) · 결정 5 = lazy chunk (`sideNav.lazy.ts` — 첫 배선 측정 Builder 1,411,819 > 1,410,000 → 분리 뒤 1,409,737). G4 (a) 배포 workflow 절대 상한 단계 · (b) Δ Builder +3,694 / 4,096 · Preview +1,474 / 3,584 PASS (기준선 `b0d1e77e4` 대비 — Phase 1 · 다른 세션 WIP 포함). live (5175, Compare Mode CSS 쪽): ↓ · ← · → · 링크 없는 부모 Enter 펼침 · 링크 Enter 이동 · 접기 42 / 펴기 · 현재 행 · 콘솔 0. 판독 1 (MEDIUM 1 — 행 gap 6 → 수리 · 원복 RED) + 가설 1 수리 (lazy 경계가 상태 style · rule handler 전달). 상세: breakdown §8.

> **Phase 1 닫힘 (2026-11-02)**: G1 — 7 type (`SideNav.binding.ts` · entry · traits · nesting · rule 7) · origin 3 (`component-sidenavpanel` · `-sidenav` · `-sidenavitem`, 팔레트 밖 — Phase 4) · contract 54 · Decision 3 다섯 층 (① 조건 키 `isCollapsed` · `isCurrent` ② `:is([data-side-panel-collapsed], [data-side-panel-collapsed] *)` ③ `catalogSideNavDerived` → `_sideNavCollapsed` · `_sideNavCurrent` · `_sideNavLevel` → paint 조건 ④ `catalogSideNavHidden` → presence · 엔진 `display: none` ⑤ `catalogSideNavDependents` → derived · presence dependents). D2 확장 0 (`d2S2Alignment` PASS, 원복 RED — S2 에 없는 키 FAIL) · G1 단위 9 (원복 RED — 상속 제거 FAIL). 사용자 결정 4 = 권고. 상세: breakdown §8.

> **Phase 0 닫힘 (2026-11-02, main `b0d1e77e4`)**: G0 — 등록 지점 (Tree 선례 production 15 지점 · 7 type 추정 60 ~ 80 파일) · Decision 3 다섯 층 현재 상태 (① 조건 키 없음 → 새로 · ② CSS 조상 선택자 기구 있음 — `inPopover` 선례 · ③ 조상 context 는 `_inGroup` 파생 선례, ADR-281 Provider 값과 분리 · ④ 숨김 = presence → `display: none` 엔진 입력 · ⑤ Panel 변경 dependents 없음 → 새로) · 설치 RAC 기준 예제 DOM (펼침 · 빈 펼침 키 두 arm) · 번들 기준선 Builder 1,406,043 (여유 3,957) · Preview 322,341 (여유 2,659). 299 코드가 main 에 들어가 worktree 없이 같은 checkout (R4 조건 성립). 상세: breakdown §8.

- 사용자 요청: `/create-adr` (2026-11-02) — 같은 대화에서 「NavigationTree(RAC) <-> SideNav(RSC) 에 대응하는 컴퍼넌트인가?」 → 「SideNavPanel 껍데이 부분 "Panel" 그냥 컨테이너 역활 아닌가?」 → 「대안방안은?」 → 「react-spectrum 컴퍼넌트를 사용하는건가?」 → **「A안으로 진행해」** → `/create-adr`.
- 방향을 정한 사용자 원문 (2026-11-02): 「A안으로 진행해」 — A안 = S2 `SideNavPanel` 표면 (`isCollapsed` · `defaultCollapsed` · `onCollapsedChange`) 을 그대로 catalog 에 추가하고, 접힘 모양 (아이콘 줄) 은 SideNav rule 에 둔다.
- 사용자가 이미 답한 것: react-spectrum 컴포넌트를 **런타임에 쓰지 않는다** — S2 는 prop 이름 · 값 (D2) 과 치수 값 (ADR-295) 의 정본일 뿐이고 그리는 코드는 RAC + catalog 다 (`@react-spectrum/s2` 는 `apps/builder/package.json` devDependencies 에만 있고 테스트 밖 import 0). 「접기 제외」 (대안 C) · 「조합」 (대안 B) 은 A 를 고르며 기각됐다.
- ADR 분리 4 질문 lock-in: breakdown §1 (fork 아님 — 새 컴포넌트 가족 등록. Tree 가족 [ADR-239](completed/239-tree-submenu-swatch-item-origins.md) 이 범위 밖으로 둔 `NavigationTree` (239 §범위 밖, 94행) 를 받는다).
- 리뷰 · 착수는 사용자 요청 때 (`review-adr` · `/execute-adr 300`). 아래 「사용자 결정 5건」 은 execute-adr 가 그 Phase 에 닿을 때 묻는다.

> **리뷰 round 1 반영 (2026-11-02, codex — HIGH 2 · MEDIUM 1, [reviews/300.md](reviews/300.md))**: h1 조상 상태 → 자손 rule 의 필수 경로 (조건 키 · CSS 매핑 · resolver 상속 · 레이아웃 · 증분 dependents) 를 Decision 3 다섯 층으로 Phase 1 범위에 명시 · R2 · G1 · G3 보강. h2 접힌 동안 RAC 유효 펼침 키 = 빈 집합 · 저장 키 보존을 Decision 4 로 추가 · R7 · G2 · G3 fixture 2 추가. m1 G4 절대 상한을 `push: main` 배포 workflow 단계로 · Δ 는 실행자 절차 + ledger (집행 수단 절).

> **리뷰 round 2 (2026-11-02, codex 수리 검증)**: h1 · h2 · m1 closed · 새 차단 이슈 0 → HIGH 0 · pending 0, 설계 리뷰 닫힘 (실행자 선언 — 판독 상한 도달). 착수는 사용자 `/execute-adr 300`.

> 구현 상세: [design/300-sidenav-navigation-tree-breakdown.md](design/300-sidenav-navigation-tree-breakdown.md)

## Context

### 도메인

- **D1** (DOM/접근성): 설치된 `react-aria-components` 1.22.1 의 `NavigationTree` · `NavigationTreeItem` · `NavigationTreeItemContent` · `NavigationTreeSection` · `NavigationTreeHeader` (`exports/index.d.ts:68`) 를 **그대로 소비**한다. RAC 는 이 부품이 `Tree` 를 감싼 것이며 (`NavigationTree.tsx:142` `<Tree>`), 선택 prop 을 모두 뺐고 (`selectionMode` · `selectedKeys` · `onSelectionChange` …) 그 대신 `selectedRoute` 를 항목의 `href` 와 맞춘다 (`:217` `isCurrent = hasLink && href === selectedRoute`). 링크가 있는 행은 focus 를 자식 링크에 주고 (`:263` `focusMode: 'child'`), 행 내용은 RAC `LinkContext` 로 `aria-current="page"` 와 (링크 없는 부모 행의) 펼침 `onPress` 를 내려 준다 (`:441-447`). composition 은 이 DOM 을 수정 · 확장하지 않는다.
- **D1 에 대응 부품이 없는 S2 부품 2개**: `SideNavPanel` (div + 접기 버튼) 과 `SideNavItemLink` (RAC `Link` 하나). 둘 다 S2 구현이 RAC 의 기존 부품만으로 짜여 있다 — Panel = `div` (`aria-label` 이 있으면 `role="region"`) + RAC `Button` (S2 `SideNavPanel.tsx`), ItemLink = RAC `Link` (`LinkContext` 를 받는 쪽, S2 `SideNav.tsx:669`). composition 도 같은 RAC 부품으로 만든다 — 새 ARIA 작성 0.
- **D2** (Props/API): 정본 순서 1번 S2 `@react-spectrum/s2` 1.8.1 이 7 타입을 모두 선언한다 (`dist/types/exports/index.d.ts:64-65` — `SideNav` · `SideNavItem` · `SideNavItemContent` · `SideNavItemLink` · `SideNavSection` · `SideNavHeader` · `SideNavPanel`). 그 표면을 그대로 쓴다: `SideNav` = `NavigationTreeProps` − 스타일 prop (`selectedRoute` · `expandedKeys` · `defaultExpandedKeys` · `onExpandedChange` · `items` · `aria-label`), `SideNavItem` = **`textValue` 필수** · `hasChildItems` · `href` · `id`, `SideNavPanel` = `isCollapsed` · `defaultCollapsed` · `onCollapsedChange` · `aria-label`. composition 확장 (정본 순서 4번) 은 0 이 목표다 — `d2S2Alignment.static.test.ts` 가 설치 S2 타입과 binding `accepts` 를 대조한다.
- **D3** (시각 스타일): catalog `COMPONENT_RULES_TABLE` 에 7 타입의 rule 을 둔다. 값은 S2 설치본이 정본 (ADR-295) — 행 최소 높이 32 · 행 간격 `space(6)` · 들여쓰기 16 · 현재 표시 막대 2 × 18 · 접힌 폭 42 · 전환 200 ms · 머리 `ui-sm` medium · 구역 간격 24 (값 표 전체: breakdown §3). Builder (Skia) 와 Preview/Publish (DOM + 생성 CSS) 가 같은 rule 을 읽는다.
- **Generator 확장 선언** (adr-writing 선차단 #2): 접힘 상태 `isCollapsed` 는 **조상 (Panel) 의 상태로 자손 (SideNav 행) 모양이 바뀐다** — S2 는 context (`SideNavPanelContext`, `SideNav.tsx:182` · `:437`) 와 조상 속성 선택자 (`:is([data-side-panel-collapsed] *)`, `:642`) 로 한다. 생성 CSS 가 「조상 상태 → 자손 rule」 을 emit 하는지가 Phase 0 확인 항목이다 (rule 자손 선택자 선례 — 메모리 `feedback-rule-descendant-selector-vs-direct-part-rule` · `feedback-ancestor-context-belongs-in-resolver-not-dom-fallback`). Canvas 쪽은 owner 값으로 자식을 칠하는 dirty 확장이 필요하다 (메모리 `feedback-canvas-child-painted-from-owner-needs-dirty-expansion`). 지금은 조건 키 · resolver 상속 · 증분 dependents 가 모두 없다 — 필요한 다섯 층은 Decision 3.
- **문서 스키마 변경 있음** — 새 type 7 · origin template · `LIBRARY_CONTRACT_VERSION` +1 (현재 53, `packages/shared/src/catalog/document/types.ts:148` — ADR-299 Phase 1 이 올린 값. 300 의 번호는 반영 시점의 main 기준). 개발 단계라 **변환 코드 0** (메모리 `feedback-no-document-migration-code-dev-stage`).

### 실측 (2026-11-02, main `75935c07b` + 작업 트리)

| #   | 사실                                                                                                                                                                                                                                                              | 근거                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| F1  | catalog 에 SideNav · NavigationTree 계열 type 0. 가장 가까운 선례는 Tree 가족 3 type (`Tree` · `TreeItem` · `TreeItemContent`)                                                                                                                                    | `componentCatalog.ts:1026` · `:1036` · `:1051`                                              |
| F2  | Tree 항목 층 하나 (TreeItemContent) 를 더한 커밋이 53 파일을 바꿨다 — 등록 지점 (binding · entry · traits · nesting · presence · delegatedDom · domBinding · canvasBinding · manualBoxRules · origin · contract 테스트)                                           | `0dfcc0282` (`git show --stat`)                                                             |
| F3  | 이름 `Nav` 인 catalog type 이 이미 있다 — RAC 대응 없는 layout 컨테이너 (`<nav>`), composition 출처                                                                                                                                                               | `componentCatalog.ts:247` · `d2Provenance.ts:47` · `Nav.binding.ts:18`                      |
| F4  | Preview 는 RAC `RouterProvider` 로 링크 `href` 를 session router 에 보낸다 — 같은 경로가 NavigationTree 항목 `href` 도 받는다. session 은 현재 경로 (`currentPath`) 와 page `route` 매칭을 가진다                                                                 | `domView.components.tsx:73` · `catalogPreviewSession.ts:705` · `catalogPreviewRoute.ts:2-6` |
| F5  | Tree 의 Canvas 행은 `manualBoxRules` 수동 상자 (행 40 = S2 Tree) 이고 행 내용은 TreeItemContent 의 flex 줄                                                                                                                                                        | `manualBoxRules.ts:255` · `:872-888` · `canvasBinding.ts:614`                               |
| F6  | `SideNavPanel` 은 S2 1.8.1 의 index 에서 export 되지만 로컬 S2 문서 스냅샷에는 `SideNav.md` 만 있고 Panel 문서 · 예제는 없다 (SideNav 는 v1.6.0 에 추가)                                                                                                          | `.claude/skills/react-spectrum/references/llms.txt:69` · `:117`                             |
| F7  | 번들 여유 (ADR-201): 상한 Builder 1,410,000 · Preview 325,000, 커밋당 Δ 상한 4,096 · 3,584 B. ADR-299 Phase 1 뒤 추정 Builder 1,401,901 · Preview 322,340 → 여유 약 8.1 KB · 2.7 KB. RAC `NavigationTree.mjs` 원본 gzip 3,858 B (`Tree` · `Link` 는 이미 번들 안) | `adr201-bundle-gate.mjs:29-33` · ADR-299 Status (Phase 0 · 1 종결)                          |
| F8  | Preview 런타임에 lazy 분리 선례가 있다 — DnD 부품                                                                                                                                                                                                                 | `domBinding.components.tsx:22`                                                              |

### Hard constraints

- 번들: Preview Δ ≤ 3,584 B / 커밋 · 절대 ≤ 325,000 B, Builder Δ ≤ 4,096 · 절대 ≤ 1,410,000 (만료 2026-11-25) — F7 의 여유가 Preview 2.7 KB 뿐이다.
- D1 구조 동일성: 설치 RAC 기준 예제와 태그 · 부모/자식 · 순서 · role/aria (`tree` · `row`/`treeitem` · `aria-current` · `aria-expanded`) 가 같아야 한다 (RAC 조립 계약 §변경 범위의 검증).
- D3 대칭: 같은 입력 · viewport · DPR · theme · 상태에서 Canvas ↔ Preview 시각 동일 (ADR-248 G3 하니스).
- 기능 단위 다섯 표면 (catalog · Canvas · Design/Properties · Interactions · Code) 을 한 번에 — 메모리 `project-feature-unit-spans-catalog-canvas-code-panels`.

### Soft constraints

- 같은 checkout 에서 ADR-299 가 진행 중이다 (contract · 공용 테스트 파일이 겹친다) — 구현은 worktree 격리, 반영은 299 의 해당 Phase 뒤 rebase.
- S2 `SideNavPanel` 은 문서가 없는 export (F6) — 다음 S2 판에서 표면이 바뀔 수 있다.

## Alternatives Considered

### 대안 A: S2 표면 7 타입 그대로 (Panel 접기 포함) — RAC 부품 + catalog rule

- 설명: 7 type 을 catalog 에 등록한다. D1 은 RAC `NavigationTree*` 5 부품 + Panel (div + RAC `Button`) + ItemLink (RAC `Link`). D2 는 S2 이름 그대로. D3 는 rule — 접힘은 Panel 의 `isCollapsed` 를 SideNav 행 rule 이 조상 상태로 읽는다 (글자 · chevron · 머리 숨김, 하위 항목 닫힘, 폭 42). Canvas 는 `isCollapsed` · 현재 경로를 정적 값으로 그리고, 실제 토글 · 이동은 Preview/Publish.
- 근거 (외부): S2 1.8.1 이 Panel 을 SideNav 와 같은 패키지 export 로 낸다 (F6) — Adobe 의 앱 셸 패턴. Framer · Webflow 의 nav 컴포넌트도 「접힌 상태」 를 컴포넌트 variant 로 둔다 (메모리 `reference-framer-components-model-2026-10` — variant = 속성 델타).
- 위험: 기술(**M** — 7 type · 조상 상태 → 자손 rule 이 두 consumer 에 처음 들어간다) / 성능(**H** — F7: Preview 여유 2.7 KB 에 NavigationTree 3.9 KB 원본) / 유지보수(**M** — 문서 없는 Panel export, 단 `d2S2Alignment` 가 설치 타입으로 자동 대조) / 마이그레이션(**L** — 새 type 만, 변환 0)

### 대안 B: 기존 부품 조합 — `Nav` + SideNav + ToggleButton + 상태 변수

- 설명: Panel type 을 만들지 않는다. 사용자가 `Nav` (F3) 안에 SideNav 와 ToggleButton 을 넣고, 접힘을 프로젝트 상태 변수 + Interactions 로 잇는다.
- 위험: 기술(M) / 성능(H — NavigationTree 는 같다) / 유지보수(**H** — 아이콘 줄 모양은 SideNav 행 쪽 규칙이라 결국 SideNav 에 `collapsed` 축을 따로 만들어야 하고 그 이름은 S2 에 없다 → D2 확장 (정본 순서 4번). 사용자가 매 화면 조립해야 해 빌더 목적 (인건비 · 일관성) 에 어긋난다 — 메모리 `project-builder-purpose-labor-cost-consistency`) / 마이그레이션(L)

### 대안 C: 접기 제외 — SideNav 6 타입만, 바깥 상자는 `Nav`

- 설명: Panel 을 범위에서 영구히 뺀다. 접기는 제공하지 않는다.
- 위험: 기술(L) / 성능(H — 같다) / 유지보수(L) / 마이그레이션(L). 단 S2 가 제공하는 기능 하나가 없다 — 「필요해지면」 으로 미루는 형태면 설계 원칙 위반 (메모리 `feedback-design-whole-scope-upfront-no-deferral`).

### 대안 D: 기존 `Tree` 에 `selectedRoute` · `href` 축을 더한다

- 설명: 새 type 없이 Tree 에 내비게이션 모드를 얹는다.
- 위험: 기술(**H** — RAC `NavigationTree` 는 Tree 에서 선택 prop 을 **빼고** `focusMode: 'child'` · `aria-current` · `LinkContext` 를 더한 다른 D1 계약이다 (`NavigationTree.tsx:263` · `:441-447`). Tree 하나에 두 계약을 섞으면 D1 을 직접 쓰는 셈이 된다 — RAC DOM 재작성 금지 위반) / 성능(L — NavigationTree 미포함) / 유지보수(H — S2 `TreeView` 와 `SideNav` 두 표면을 한 binding 이 대조) / 마이그레이션(M — 기존 Tree 문서에 축 추가)

### Risk Threshold Check

| 대안 | HIGH+               | 판정                                 |
| ---- | ------------------- | ------------------------------------ |
| A    | 성능 H (번들)       | 회피 변형 A′ 추가                    |
| B    | 성능 H · 유지보수 H | 기각 후보                            |
| C    | 성능 H              | 기능 누락 — 사용자가 A 선택으로 기각 |
| D    | 기술 H · 유지보수 H | D1 침범 — 기각                       |

모든 대안이 HIGH 1 이상 → 루프 1회: NavigationTree 를 넣는 한 번들 H 는 대안과 무관하다 (B · C 도 같다). 회피 변형 **A′ = A + 번들 조건부 lazy**: Phase 2 의 첫 배선 커밋에서 Preview Δ 를 재고, Δ > 3,584 또는 절대 > 325,000 이면 SideNav DOM 부품을 DnD 선례 (F8) 처럼 lazy chunk 로 뺀다 (첫 표시는 같은 크기의 빈 상자 — 레이아웃 이동 0). 두 번째 루프 불필요 — A′ 의 성능 위험은 **M** (측정으로 판정되는 조건부 분리).

## Decision

**대안 A′** 를 채택한다 — S2 `SideNav*` 7 타입을 RAC 부품 위에 그대로 올리고, 접기 · 아이콘 줄 · 현재 표시는 catalog rule 로 두 consumer 가 같이 그리며, Preview 번들이 상한을 넘으면 SideNav DOM 부품만 lazy 로 뺀다.

1. **7 type 등록** — `SideNavPanel` · `SideNav` · `SideNavItem` · `SideNavItemContent` · `SideNavItemLink` · `SideNavSection` · `SideNavHeader`. RAC 대응: `SideNav` → `NavigationTree`, `SideNavItem` → `NavigationTreeItem`, `SideNavItemContent` → `NavigationTreeItemContent` (DOM 요소 없음 — Tree 의 TreeItemContent 와 같다), `SideNavSection` / `SideNavHeader` → `NavigationTreeSection` / `NavigationTreeHeader`, `SideNavItemLink` → RAC `Link` (`LinkContext` 소비 — RAC 가 `aria-current` 를 준다), `SideNavPanel` → `div` + RAC `Button` (접기 버튼, 라벨은 S2 i18n 문구 `sidepanel.expand` / `collapse` 와 같은 뜻).
2. **D2 = S2 이름 그대로** — `SideNavItem.textValue` 필수 · `hasChildItems`, `SideNavPanel.isCollapsed` · `defaultCollapsed` · `onCollapsedChange`. S2 가 뺀 prop (`className` · `style` · `onAction` · 선택 prop) 은 binding 에도 없다. composition 확장 0 (사용자 결정 1 의 답에 따라 `selectedRoute` 기본값만 composition 동작).
3. **접힘 = 조상 상태 → 자손 rule, 다섯 층을 같이 만든다** (리뷰 h1) — Panel `isCollapsed` 가 SideNav 행의 글자 · chevron · 머리 표시와 Panel 폭 (42) 을 정한다. 지금 이 경로는 없다: 조건 트리는 모르는 키에서 예외를 내고 (`conditionTree.ts:139` `CONDITION_TREE_UNKNOWN_KEY`), paint 평가의 조건 집합은 노드 자신의 값만 담으며 (`resolveCatalogPaint.ts:86-98`), 증분 재판정은 `showWhen` 자식만 모은다 (`presence.ts:3485-3489` `catalogStateDependents`). 그래서 Phase 1 범위에 다섯 층을 넣는다 — ① 조건 어휘 (`isCollapsed` 조건 키), ② 생성 CSS 매핑 (Panel 의 `data-side-panel-collapsed` 조상 선택자 — `domOnly` 금지: Canvas 가 기본값에 남는다), ③ resolver 의 조상 context (Panel 에서 자손 SideNav 부품으로 내려 주는 상속 값 — 선례 ADR-281 페이지 · frame 의 `isDisabled` 상속, `presence.ts:1952-1969` · `inheritedProps.ts`), ④ 레이아웃 · 표시 (숨긴 글자 · chevron · 머리는 Canvas 레이아웃에서도 자리를 차지하지 않는다 — `display: none` 이 엔진 입력에 닿는지), ⑤ 증분 의존성 (Panel 값만 바뀌어도 자손 행을 다시 해석 · 다시 그린다 — `catalogStateDependents` 확장 또는 Panel 전용 dependents). 상태 우선순위는 rule `paint` 조건 트리 한 곳 (ADR-297). 조상 context 축은 resolver 에 둔다 (메모리 `feedback-ancestor-context-belongs-in-resolver-not-dom-fallback`).
4. **접힌 동안 유효 펼침 키 = 빈 집합, 저장된 키는 보존** (리뷰 h2) — S2 는 저장된 `expandedKeys` 와 RAC 에 넘기는 키를 나눈다 (`SideNav.tsx:191-195` — 접힘이면 빈 집합, 다시 펼치면 남겨 둔 키로 복원). 시각 rule 로 하위 행만 숨기면 RAC 는 부모를 `aria-expanded=true` 로 계속 내고, 현재 조상 표시 조건 (`isCurrentAncestor && !isExpanded`, `:464` · `:472`) 이 거짓이 되어 접힌 줄에서 현재 위치가 사라진다. 그래서 DOM 은 binding 이 RAC `NavigationTree` 에 유효 키 (`isCollapsed ? ∅ : expandedKeys`) 를 넘기고, Canvas 도 같은 유효 키로 자식 행 · 현재 조상 표시를 판정한다. 문서의 `expandedKeys` · `defaultExpandedKeys` 는 접힘으로 바뀌지 않는다.
5. **현재 경로** — RAC 계약대로 `selectedRoute` ↔ 항목 `href` 일치로 `isCurrent` · `isCurrentAncestor` 를 낸다. Preview 는 F4 의 session router 를 그대로 쓴다 (새 router 0).
6. **Canvas = 정적** — `isCollapsed` · `defaultExpandedKeys` · 현재 경로를 문서 값으로 그린다 (펼침은 4 의 유효 키). 접기 버튼 클릭 · 행 이동 · 키보드는 Preview/Publish (캔버스 = 그리는 도구 — 메모리 `feedback-skia-builder-not-frontend-interaction-belongs-to-preview`).
7. **번들 조건부 lazy** — 위 A′.

**위험 수용 근거**: 번들 H 는 A′ 의 측정 조건 (G4) 으로 M 이 된다. 문서 없는 Panel export 는 `d2S2Alignment` 가 설치 타입을 읽어 S2 판이 바뀌면 바로 막으므로 조용한 drift 가 없다. 조상 상태 → 자손 경로는 새 경로지만 (Decision 3), 조상 값을 자손 record 로 내려 주는 상속은 ADR-281 `isDisabled` 선례가 있고, 다섯 층을 한 Phase 에서 같이 만들어 G3 의 증분 갱신 arm 으로 확인한다.

**기각 사유**:

- **B 조합**: 아이콘 줄 모양이 SideNav 행 규칙이라 조합으로는 재현되지 않고, 결국 S2 에 없는 `collapsed` 축 (D2 확장) 이 생긴다. S2 가 이미 그 표면 (Panel `isCollapsed`) 을 낸다.
- **C 접기 제외**: 사용자가 A 를 골랐다 — S2 기능 하나를 영구히 빼는 결정이 아니다.
- **D Tree 확장**: RAC 가 NavigationTree 를 Tree 와 다른 D1 계약으로 낸다 (선택 제거 · `focusMode: 'child'` · `aria-current`). 한 type 에 두 계약을 섞는 것은 D1 침범이다.
- **E Disclosure 재사용** (대화에서 검토): Disclosure 는 접으면 내용이 사라지고 (`aria-expanded` + 숨김 패널), Panel 은 접어도 아이콘 줄로 남는다 — 의미가 다르다.

### 사용자 결정 5건 (execute-adr 가 그 Phase 에 닿을 때 묻는다)

1. **`selectedRoute` 의 출처** (Phase 2) — **답 (2026-11-02): (b) 현재 page route** — (a) S2 그대로 작성 값만, (b) 작성 값이 비면 **현재 page 의 route** (Canvas = 그리는 page 의 `route`, Preview = session `currentPath`, Publish = location). 권고 (b) — 이름은 S2 그대로이고 빌더 기본값만 composition 동작 (`d2Provenance` 에 출처 기록).
2. **행 펼침 view transition** (Phase 2) — **답 (2026-11-02, 사용자 원문)**: 「행펼침 · 패널펼침이 canvas 영역에서는 필요없다 이미 Tree, Tabs, disclosure 등 canvas 영역에서는 애니메이션을 보여주지는 않는다. 프러퍼티에서 열림 닫힘으로 보여준다 다른 컴퍼넌트도, compare mode 의 css 영역과 preview 에서 애니메이션되는 실제 구동되는 화면을 보여주는것」 — Canvas 는 정적 (Properties 의 열림 · 닫힘), DOM (Compare Mode CSS 쪽 · Preview · Publish) 은 S2 의 패널 폭 · 행 펼침 애니메이션을 실제로 돈다 — S2 는 React `ViewTransition` 으로 행 펼침 · 패널 펼침을 애니메이션한다 (`SideNav.tsx:66-93`). 작성 때 권고 (「행 단위 view transition 은 범위 밖」) 는 이 답으로 바뀌었다 — DOM 은 Panel 폭 전환 200 ms 와 행 · 머리 view transition (`side-nav-item-expand` · `-collapse` · `side-panel-expand`) 을 모두 돌고, reduced motion 에서는 S2 처럼 끈다 (Phase 2).
3. **팔레트 노출 단위** (Phase 4) — (a) `SideNavPanel` (안에 SideNav) 하나, (b) `SideNav` 와 `SideNavPanel` 둘. 권고 (b) — S2 도 SideNav 단독을 허용한다 (패널 밖 `minWidth: 160`, `SideNav.tsx:128-131`).
4. **행의 actions · actionmenu 자리** (Phase 1) — **답 (2026-11-02): 권고안 「자유 내용 + grid 칸」** — S2 행 grid 에 `actions` · `actionmenu` 칸이 있다 (`SideNav.tsx:265-267` · `:505-506`). composition 에 ActionMenu type 은 없다. 권고: 행 내용은 자유 내용 (`free`) 이라 Button · ButtonGroup 은 넣을 수 있고, grid 칸은 rule 에 둔다 — ActionMenu type 신설은 이 ADR 밖.
5. **번들 초과 시** (Phase 2) — **답 (2026-11-02): (a) lazy 분리** — (a) A′ lazy 분리 (권고), (b) ADR-201 상한 재승인.

## Risks

| ID  | 위험                                                                                                                                                                                             | 심각도 | 대응                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | -------------------------------------------------------------------------------------------------------------------------- |
| R1  | Preview 번들 상한 초과 (F7: 여유 2.7 KB vs NavigationTree 원본 3.9 KB)                                                                                                                           |  HIGH  | G4 — 첫 배선 커밋에서 측정, 초과면 lazy (A′) 또는 사용자 결정 5                                                            |
| R2  | 조상 상태 (Panel 접힘) → 자손 rule 이 한 consumer 에만 닿거나 어디에도 닿지 않는다 — 조건 키 예외 · `domOnly` 선택자 · resolver 조상 context 없음 · 레이아웃 미반영 · 증분 재판정 누락 (리뷰 h1) |  HIGH  | Decision 3 다섯 층 · G1 (조건 키 · 상속 단위) · G3 — fixture 를 두 consumer 에서 같이 비교 + Panel 값만 바꾼 증분 갱신 arm |
| R3  | D1 구조 차이 — 행 `focusMode: 'child'` · `aria-current` · 링크 없는 부모 행의 펼침 `onPress` 를 composition 조립이 끊는다                                                                        |  HIGH  | G2 — 설치 RAC 기준 예제와 구조 · role/aria 대조 (adr256-g5 하니스) + 키보드 (화살표 · Enter) live                          |
| R4  | ADR-299 와 같은 checkout · 같은 contract 테스트                                                                                                                                                  | MEDIUM | worktree 격리, 299 해당 Phase 반영 뒤 rebase · contract 번호는 반영 시점 main + 1                                          |
| R5  | 문서 없는 S2 Panel export 가 다음 판에서 바뀐다                                                                                                                                                  | MEDIUM | `d2S2Alignment.static.test.ts` 가 설치 타입으로 자동 대조 — S2 판 올림 때 실패로 드러난다                                  |
| R6  | Canvas 에서 접기 버튼 · 링크가 눌리는 것처럼 보이지만 반응 없음                                                                                                                                  |  LOW   | 기존 Button · Link 와 같은 정책 (Canvas 는 선택 · 편집, 동작은 Preview)                                                    |
| R7  | 접힌 동안 RAC 펼침 상태와 시각이 어긋난다 — 부모 `aria-expanded=true` 유지 · 현재 조상 표시 소실 (리뷰 h2)                                                                                       |  HIGH  | Decision 4 유효 키 · G2 (접힘 상태 `aria-expanded`) · G3 fixture 「접힘 + 현재 자손」 · 「다시 펼침 = 원래 키 복원」       |

## Gates

| Gate | 시점                                               | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                         | 실패 시 대안                                                    |
| ---- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| G0   | Phase 0 종결                                       | 등록 지점 인벤토리 (Tree 선례 대조표) · S2 값 표 · 설치 RAC 기준 예제 DOM 캡처 · 번들 기준선 · Decision 3 다섯 층 각각의 현재 상태 (있음 / 새로 만듦 — 조건 키 · CSS 조상 선택자 · resolver 상속 · 레이아웃 display · 증분 dependents) 기록                                                                                                                                                                                                       | 확장 필요면 Phase 1 범위에 generator 변경 포함 (breakdown 갱신) |
| G1   | Phase 1 종결                                       | 7 type `d2S2Alignment` PASS (확장 0 또는 결정 1 의 1행) · contract · nesting · traits 단위 테스트 · Decision 3 의 조건 키 (`isCollapsed` 가 조건 트리에서 예외 없이 평가) · Panel → 자손 상속 단위 · 원복 RED (binding `textValue` 제거 → 대조 FAIL · 상속 제거 → 자손 조건 FAIL)                                                                                                                                                                 | 대조 실패 키는 S2 이름으로 고친다 (확장 추가 금지)              |
| G2   | Phase 2 종결                                       | D1 구조 대조 PASS (기준 예제 vs Preview — 태그 · 순서 · role · `aria-current` · `aria-expanded` · `aria-labelledby`) · 접힌 Panel 안 부모 행 `aria-expanded=false` (Decision 4 — 기준 예제에 빈 펼침 키를 넘긴 arm 과 같음) · 키보드 화살표 이동 · Enter 이동 · 링크 없는 부모 행 펼침                                                                                                                                                            | 차이 1건마다 조립 수리 (RAC 재작성 금지)                        |
| G3   | Phase 3 종결                                       | ADR-248 G3 하니스에서 fixture 8 (펼침 · 하위 닫힘 · 현재 · 현재 조상 · 구역+머리 · Panel 접힘 · 접힘 + 현재 자손 = 부모 닫힘과 조상 표시 · 접었다 다시 펼침 = 원래 키 복원) Canvas ↔ Preview 시각 동일 + Panel `isCollapsed` 만 바꾼 증분 갱신 arm 동일                                                                                                                                                                                           | 차이는 rule 쪽에서 수리 (한 consumer 만 고치기 금지)            |
| G4   | (a) Phase 2 첫 배선 커밋부터 매 push · (b) Phase 4 | (a) 절대 상한 — `push: main` 배포 workflow (`.github/workflows/deploy.yml`) 의 build 뒤 · 배포 앞 단계가 `adr209-bundle-closure.mjs` 로 builder · preview initial closure 를 재고 Builder ≤ 1,410,000 · Preview ≤ 325,000 이 아니면 실패 (배포 중단). 이 단계는 Phase 2 첫 배선 커밋에 같이 넣는다. (b) Δ — `adr201-bundle-gate.mjs` before/after (Preview Δ ≤ 3,584 · Builder Δ ≤ 4,096) 를 실행자가 배선 커밋 push 전에 돌려 run ledger 에 기록 | lazy 분리 (A′) → 그래도 초과면 사용자 결정 5 (b)                |
| G5   | Phase 4 종결                                       | live (5174+): 팔레트 넣기 → Layers 순서 → Design 패널 (`isCollapsed` · `href` · `textValue`) → Preview 링크 클릭 이동 · 현재 표시 이동 · 접기 버튼 · 키보드 · Undo/Redo · 저장 후 다시 열기 · code view 투영                                                                                                                                                                                                                                      | 실패 항목 수리 후 재실행                                        |

측정 조건 (measurement-validity §1): G2 · G3 의 oracle 은 외부다 — G2 는 설치 RAC 로 그린 기준 예제의 DOM (composition 출력이 아님), G3 은 실 브라우저 DOM 렌더와 Skia 렌더의 독립 두 arm. fixture 는 사람이 짠 2단 이상 중첩 · 링크 없는 부모 행 · 아이콘 있는/없는 행을 쓴다 (합성 대량 문서 아님). 불리 케이스 = G3 의 증분 갱신 arm (Panel 값만 바뀌고 SideNav 노드는 그대로 — dirty 확장 누락이 드러나는 조작). G4 는 before/after 같은 빌드 조건의 두 arm. 측정 조건 (viewport · DPR · theme · visibilityState) 은 breakdown §6 에 기록한다.

집행 수단 (리뷰 m1): G4 (a) 는 `push: main` 배포 workflow 단계라 상한을 넘은 main 은 배포되지 않는다. pre-push 에 번들 측정을 넣지 않는 이유 — production build 가 push 마다 분 단위로 돈다 (지금 pre-push 는 perf-ratchet 하나, 기본 끔 — `.githooks/pre-push`). G4 (b) Δ 는 before 빌드가 필요해 workflow 로 옮기지 않고 실행자 절차 + run ledger 로 둔다. G0 ~ G3 · G5 는 Phase 종결 조건이다 — 실행자가 run ledger 에 기록하고, Implemented 승격은 `adr-status-sync-check.sh` 가 `### Live Exercise` 없이는 막는다.

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- S2 앱 내비게이션 패턴 (사이드바 · 접히는 아이콘 줄 · 현재 위치 표시) 을 사용자가 조립 없이 넣는다.
- RAC 기준 예제와 같은 DOM — 키보드 · 스크린리더 동작이 RAC 그대로다.
- ADR-239 가 범위 밖으로 둔 NavigationTree 가 catalog 에 들어온다.

### Negative

- catalog type 7 · origin template · contract +1 — 기존 개발 문서는 거부 · 재생성 (변환 0).
- 조상 상태 → 자손 rule 경로가 하나 늘어 Canvas dirty 확장 · 생성 CSS 선택자의 유지 범위가 커진다.
- Preview 번들이 늘거나 (상한 안), lazy 분리 시 SideNav 첫 표시가 chunk 로드만큼 늦다.
