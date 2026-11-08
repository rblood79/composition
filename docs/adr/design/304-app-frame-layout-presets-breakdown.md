# ADR-304 breakdown — App frame preset 묶음 · 콘텐츠 영역 preset 의 중첩 적용 · 좁은 폭 접힘 · 랜드마크

> 본문: [304-app-frame-layout-presets.md](../304-app-frame-layout-presets.md). 실측 기준 main `6d63f07af` (2026-11-08). `docs/adr/evidence/` 는 gitignore 라 인벤토리 · 실측의 결론은 이 문서에 둔다.

## 1. 선행 관계 · 전제

분리 · fork 가 아니라 새 응용 ADR 이다 (fork 4 질문 해당 없음). base 셋 —

| base                                                           | 이 ADR 이 그대로 쓰는 것                                                                                                                                     | 바꾸지 않는 것                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| ADR-248 Phase 4e-6-37 (layout preset)                          | 정의 `usage: "layout"` · 슬롯 = `slot: { name, required }` 를 가진 template 노드 · `catalogLayoutPresetCommand(rootId)` · `replace` / `merge` · 소유 키 정리 | 슬롯 저장 모양 · 적용 알고리즘 (컨테이너 단위 호출만 늘림) |
| ADR-300 (SideNav family)                                       | SideNavPanel 원본 · `isCollapsed` 42 · 접기 버튼 · `catalogSideNavPanelCollapsed` (`sideNav.ts:48`)                                                          | rule 값 · S2 prop 표면                                     |
| ADR-303 (컨테이너 층)                                          | Nav 배경 `{color.container}` (`componentRulesTable.ts:9978`)                                                                                                 | —                                                          |
| ADR-248 4e 사용자 결정 (2026-10-01, 메모리 `project-adr248-…`) | page body = layout instance · 슬롯 역할 표시 · 내용은 content 역할 슬롯                                                                                      | 그 모델 (대안 C 기각 사유)                                 |

전제 확정은 리뷰 (`docs/adr/reviews/304.md`) pending 0 으로.

## 2. 인벤토리 (실측, 줄 인용)

### 2a. preset 정의 · 적용

| 사실                                                                                                                                                                                                                       | 위치                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `LAYOUT_PRESETS` 10 — fullscreen · vertical-2 · vertical-3 · sidebar-left · sidebar-right · list-detail · feed · holy-grail · dashboard · dashboard-widgets                                                                | `presetDefinitions.ts:120` · 순서 `:525 ~ :536`                                            |
| `PRESET_CATEGORIES` basic · navigation · list · feed · complex · dashboard                                                                                                                                                 | `:513 ~ :520`                                                                              |
| `STACK_ON_MOBILE` = mobile `display: flex` · `flexDirection: column`                                                                                                                                                       | `:70 ~ :72`                                                                                |
| `LayoutPreset { id, name, category, slots, containerStyle, responsiveContainerStyle? }` · `SlotDefinition { name, required?, defaultStyle?, responsiveStyle?, description? }`                                              | `types.ts:40 ~ :56` · `:90 ~ :110` (LayoutPresetSelector)                                  |
| 적용 명령 — 컨테이너 소유 키 지움 (`OWNED_CONTAINER_KEYS` 5) → 컨테이너 쓰기 → tablet · mobile 층 → `replace` 면 기존 슬롯 제거 → 슬롯 노드 삽입 (빈 Frame `lib:definition:type-frame`)                                    | `layoutPreset.ts:152 ~ :247` (`:89 ~ :95` · `:176 ~ :200` · `:202 ~ :210` · `:212 ~ :241`) |
| `presetCss` — `gridArea` 는 버리고 숫자 선은 유지 · `flex` 는 longhand 3                                                                                                                                                   | `:102 ~ :122`                                                                              |
| `catalogLayoutSlots` — 슬롯에서 멈춤 (바깥이 안쪽을 가림)                                                                                                                                                                  | `:52 ~ :72`                                                                                |
| `catalogAppliedPreset` — 슬롯 **이름** 열 = preset 슬롯 이름 열, `PRESET_ORDER` 첫 일치 · 같은 키면 클릭 무시 (`LayoutPresetSelector/index.tsx:120`) — 이름이 같고 정체가 다른 preset 을 구별하지 못한다 (리뷰 round 1 h2) | `:75 ~ :86`                                                                                |
| responsive 소유 키 = 컨테이너 소유 키 ∩ eligible + 작성 가능 responsive prop — 뒤쪽에 item 축 `gridColumnStart` · `gridRowStart` 가 섞여 있어 안쪽 적용이 바깥이 준 자리를 지운다 (리뷰 round 1 m1)                        | `presetStyle.ts:22 ~ :31` · `:51 ~ :55` · `responsive.types.ts:200 ~ :208`                 |
| 썸네일은 정의에서 파생                                                                                                                                                                                                     | `derivePreviewAreas.ts:336`                                                                |

### 2b. UI 자리

| 사실                                                                                                          | 위치                                                  |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| preset 격자 · Slots 목록은 `layoutOfRoot(graph, nodeId)` 가 layout 정의의 `templateRootId === nodeId` 일 때만 | `CatalogLayoutBodySection.tsx:24 ~ :34` · `:51 ~ :52` |
| 적용 모드 다이얼로그 `replace` / `merge` / `cancel`                                                           | `:66 ~ :77`                                           |
| Slots 목록 행 = 노드 선택                                                                                     | `LayoutSlotsSection.tsx:18 ~ :50`                     |
| Layers 슬롯 배지 (`node.slot`)                                                                                | `CatalogLayerItem.tsx:98 ~ :105`                      |
| Navigator 탭 Pages / Components / Layouts — Layouts 는 `usage: "layout"` 정의 목록                            | `CatalogNavigatorPanel.tsx:40 ~ :44` · `:184`         |
| layout 추가 명령 `createLayout` (「Add layout」)                                                              | `project.ts:374 ~ :407`                               |

### 2c. 페이지 · 내용 슬롯

| 사실                                                                                            | 위치                                                                                                           |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| page body = layout instance 하나 (`children.length !== 1` 이면 없음)                            | `project.ts:413 ~ :422`                                                                                        |
| `bodyLayout` — template 루트가 body 면 page body 자체가 instance                                | `:424 ~ :430`                                                                                                  |
| `layoutContentSlotPath` — 슬롯 전부를 모아 `content` → 첫 required → 첫                         | `:431 ~ :460`                                                                                                  |
| `releaseLayout` — 모든 슬롯의 `fillSlot` 자식을 페이지로 되돌림                                 | `:463 ~`                                                                                                       |
| 노드 `responsive[bp]` = `visual` · `layout` · `sizing` · `fillSizing` (prop 없음)               | `types.ts:947 ~ :952` · `:650` · `:1270`                                                                       |
| 슬롯 선언 `slot?: { name: string; required: boolean }`                                          | `types.ts:1712` (template `:1234`)                                                                             |
| layout 정의 제외 — component property · swap · properties · instance property · componentOrigin | `validation.ts:1832` · `swap.ts:203` · `properties.ts:49` · `instanceProperty.ts:68` · `componentOrigin.ts:14` |

### 2d. 컴포넌트 · rule · S2

| 사실                                                                                                                                                                   | 위치                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Nav — `element: "nav"` · container · S 48 / M 56 / L 64 · 배경 `{color.container}`                                                                                     | `componentRulesTable.ts:9971 ~ :10016`                                                                 |
| SideNavPanel — `element: "div"` · `stateStyles.width.isCollapsed: "42px"` (작성 폭을 이김 — S2 inline `--collapsedWidth`) · 접힘 = `isCollapsed` ?? `defaultCollapsed` | `:16148` · `:16186 ~ :16191` · `sideNav.ts:47 ~ :55`                                                   |
| S2 SideNavPanel — `aria-label` 있으면 `role="region"`                                                                                                                  | `@react-spectrum/s2/src/SideNavPanel.tsx:166 ~ :171`                                                   |
| Header — S2 Menu `sectionHeader`, `element: "div"`                                                                                                                     | `componentRulesTable.ts:6947` · `:6988 ~ :6989`                                                        |
| frame — container · `element: "div"` · `skipCSSGeneration: true`                                                                                                       | `:6601` · `:6612 ~ :6614` · DOM `domBinding.runtime.ts:924`                                            |
| `main` · `aside` 요소 type 없음 (`element: "main"` 참조 0) · Section 은 layout 카테고리 primitive                                                                      | `componentCatalog.ts:257 ~ :261`                                                                       |
| Sheet 360 (mobile overlay 후속 ADR 의 자리)                                                                                                                            | `componentRulesTable.ts:5511`                                                                          |
| Canvas 프레임 desktop 1920 × 1080 · tablet 768 × 1024 · mobile 390 × 844 (미디어 경계 1280 / 768 / 0 과 다름)                                                          | `canvasBreakpoints.ts:8 ~ :9` · `:21 ~ :23`                                                            |
| 엔진 grid `auto` 열 — intrinsic 측정 (row 와 대칭) · 테스트 `gridTemplateColumns: ["auto","1fr"]`                                                                      | `packages/engine/src/tree.rs:5345` · `:9204 ~ :9213` · `grid.rs:629 ~ :636` (`parse_tracks` auto 지원) |

### 2e. Hub 수치 (design-data 3.8.2 guideline)

header 56 · CTA 1 · sidenav 최소 160 / 200 / 240 (1 · 2 · 3 단) · 1단 아이콘 필수 · end 섹션 구분선 · 「Show / Hide menu labels」 · ≤ 768 overlay tray · content area 단일 · 가로 · 세로 · 격자 · 스크롤 한 곳 · 랜드마크 navigation (이름) · banner · main / region · skip link · F6 · `h1` in main.

### 2f. 번들 (직전 공지 합산 — G0 재측정)

Builder 1,411,708 (300 종결) + 140 (302) + 589 (303) = 1,412,437 추정 / 상한 1,414,000 → 여유 ≈ 1,563 B. Preview 323,910 + 1,101 (302 까지) + 35 (303) = 325,046 추정 / 상한 327,000 → 여유 ≈ 1,954 B. 둘 다 `adr201-bundle-gate.mjs` 로 HEAD 를 다시 잰다 (`BUILDER_CEILING` · `PREVIEW_CEILING` `:29 ~ :30`).

## 3. 설계

### 3a. preset 정의 (TS 형만 — 문서 스키마 아님)

```ts
// LayoutPresetSelector/types.ts
export type PresetScope = "frame" | "content"; // frame = layout 루트에서만 · content = 어느 컨테이너에서나
export interface SlotDefinition {
  name: string;
  required?: boolean;
  description?: string;
  defaultStyle?: CSSProperties;
  responsiveStyle?: ResponsiveStyleSet;
  /** 슬롯 노드가 이 원본의 instance 로 선다 (없으면 빈 Frame). */
  instanceOf?: string; // 원본 definition id — Phase 0 에서 Nav · SideNavPanel · (결정 3 (a)) Main · Aside 의 id 확정
}
export interface LayoutPreset {
  /* 기존 */ scope: PresetScope;
}
```

- 카테고리 `appframe` (라벨 「App frame」, 아이콘 `PanelsTopLeft`) 를 `PRESET_CATEGORIES` 맨 앞에, `PRESET_ORDER` 맨 앞에 `app-header` · `app-shell` · `app-shell-end`.
- `app-shell` 컨테이너: `display: grid` · `gridTemplateAreas: "header header" / "sidenav content"` · `gridTemplateColumns: "auto 1fr"` · `gridTemplateRows: "auto 1fr"` · `minHeight: 100vh` (기존 `normalizeFramePresetContainerStyle` 가 처리) · gap 없음 (0 폭 열에도 gap 은 남으므로 preset 은 gap 을 쓰지 않는다). 슬롯 — `header` (`instanceOf` Nav, `gridSlotLines([1,3],[1,2])`) · `sidenav` (`instanceOf` SideNavPanel, `defaultStyle = { width: <결정 2 — 200> }` · `responsiveStyle.mobile = { display: "none" }`) · `content` (Frame 또는 결정 3 (a) Main, `minWidth: 0` · `minHeight: 0`). tablet 층은 컨테이너 · 슬롯 모두 **없음** — 접힘은 판정 (3e), 열은 `auto` 라 패널 폭 (작성 200 → rule `stateStyles.width.isCollapsed` 42 가 작성 폭을 이김 → `display: none` 0) 을 따른다. **리뷰 round 1 h1 수리**: 고정 `200px` 열은 접힘 뒤 158 · 숨김 뒤 200 의 빈 열을 남겼고 (Chromium 1920 / 768 / 390 — 트랙 `200px 1720px` / `200px 568px` / `200px 190px`, contentX 전부 200), tablet 층 `42px 1fr` 로는 runtime 접기 · 작성 `isCollapsed` 가 트랙에 닿지 않는다. 엔진은 `auto` 열의 intrinsic 측정을 지원한다 (`packages/engine/src/tree.rs:5345` — row 와 대칭 · 테스트 `:9204` `["auto","1fr"]`). 두 열을 걸치는 header 는 `1fr` 을 지나므로 `auto` 열 크기에 기여하지 않는다 (CSS Grid §12.5 — 걸침 item 의 flexible 트랙 제외; 엔진 쪽 같은 규칙인지 G1 unit 1 + G2 content 시작점으로 확인).
- `app-header`: `display: flex` · `flexDirection: column`, 슬롯 `header` (Nav) · `content`.
- `app-shell-end`: `app-shell` + sidenav 슬롯 `instanceOf` = **별도 Library 원본** `SideNavPanel/End` (`reusableOriginLibrary.ts` — SideNavPanel 기본 내용 + end 섹션 (ADR-300 의 section type — Phase 0 에서 이름 확정) + 구분선). 명령이 section 을 추가로 넣는 안은 **기각** — 적용 판정 서명 (3c) 이 (이름 · `definitionId`) 열이라 app-shell 과 app-shell-end 는 원본이 달라야 구별된다 (리뷰 round 1 h2 의 「app-shell · app-shell-end 도 같은 충돌」). 원본 쪽이 Library 카드와도 일치한다.
- 기존 10: `scope` 를 붙인다 — content = 결정 4 집합 · 나머지 `frame`. 결정 1 (b) 면 sidebar-left · dashboard · holy-grail 을 `PRESET_ORDER` 에서만 뺀다 (키 · 정의 유지 → 판정 집합이 `LAYOUT_PRESETS` 전체라 기존 layout 의 `catalogAppliedPreset` 유지 — 3c).
- 썸네일: `derivePreviewAreas` 가 그대로 그리고, `instanceOf` 가 있는 영역은 채운 띠 (Nav) · 아이콘 열 (SideNavPanel) 로 표시 (`LayoutPresetGrid` 의 영역 렌더에 분기 하나).

### 3b. 적용 명령 (`layoutPreset.ts`)

- 슬롯 entry 생성 (`:212 ~ :233`): `definitionId = slot.instanceOf ?? "lib:definition:type-frame"`. instance 면 `insertNodes` 가 이미 `ownSlotContents` 로 기본 내용 (SideNavPanel → SideNav + 항목 + 접기 버튼) 을 소유 노드로 만든다 (`materialize.ts`) — 새 코드 없음. `slot: { name, required }` 는 Frame 슬롯과 같다.
- 검증: instance 노드의 `slot` 선언이 `validation.ts` 를 지나는지 G0 가 본다 (지금 슬롯은 Frame 뿐이라 실측 0).
- 컨테이너 단위 호출: 명령은 이미 `rootId` 를 받는다 — 호출 모양은 바뀌지 않는다.
- **responsive 정리 집합 분리 (리뷰 round 1 m1 수리, Decision 7)**: `presetStyle.ts:51 ~ :55` 의 `PRESET_RESPONSIVE_OWNED_KEYS` 를 `PRESET_OWNED_CONTAINER_KEYS.filter(isResponsiveEligibleStyleProp)` 만으로 — `PRESET_AUTHORED_RESPONSIVE_STYLE_PROPS` 의 item 키 (`gridColumnStart` · `gridRowStart`, `responsive.types.ts:206 ~ :207`) 를 뺀다 (`gridTemplateAreas` 는 컨테이너 키 쪽에 이미 있어 남는다). 결과 집합 = `display` · `flexDirection` · `gridTemplateAreas` · `gridTemplateColumns` · `gridTemplateRows` — base 정리 `OWNED_CONTAINER_KEYS` (`layoutPreset.ts:89 ~ :95`) 와 같은 축 (ADR-168 R1 「같은 상수에서 파생」 유지). `PRESET_AUTHORED_RESPONSIVE_STYLE_PROPS` 자체는 eligibility 판정용 (`RESPONSIVE_ELIGIBLE_STYLE_PROPS` · `responsiveEligible.static.test.ts`) 이라 무변경. `:190` 의 `cleared(PRESET_RESPONSIVE_OWNED_KEYS, styles)` 는 그대로 — 집합만 줄어든다. 기존 동작 변화 0: layout 루트의 responsive 층에 preset 이 item 키를 쓴 적이 없다 (`presetCss(responsive?.[bp])` 는 `responsiveContainerStyle` 만 읽고, 슬롯의 `responsiveStyle` item 키는 새 노드 entry 에 쓴다 `:212 ~ :233`). 재현 (리뷰 probe): 루트에 dashboard-widgets → `widgets` 슬롯에 vertical-2 안쪽 적용 → 바깥이 준 tablet `gridColumnStart 1` · `gridRowStart 3` 이 지워져 base 3열 / 2행 자리가 살아났다. 수리 뒤 남는다 — G1 unit + 원복 RED (집합에 두 키를 되돌리면 실패). 주석 (`presetStyle.ts:33 ~ :50`) 은 「컨테이너 축 / item 축」 으로 고쳐 쓴다.

### 3c. 컨테이너 단위 UI (`CatalogLayoutBodySection.tsx` · Page Properties)

- `layoutOfRoot` 대신 `layoutContainerOf(graph, nodeId)` — nodeId 가 layout 정의의 `templateRootId` 이거나 그 template 안의 슬롯 노드 (Frame · Main · Aside — instance 슬롯 Nav · SideNavPanel 은 제외) 이면 `{ definitionId, isRoot }`. 격자는 `isRoot ? frame + content : content` 로 거른다.
- Slots 목록 · 다이얼로그는 `catalogLayoutSlots(graph, nodeId)` 그대로 (컨테이너의 직속 슬롯만 — 바깥이 안쪽을 가리는 규칙이 컨테이너 단위에서는 올바른 결과다). `CatalogLayoutSlot` 에 `definitionId: string` 을 더한다 (`:45 ~ :49`, `node.definitionId` 그대로).
- **적용 판정 (리뷰 round 1 h2 수리)**: `catalogAppliedPreset(slots)` (`:75 ~ :86`) 의 서명을 이름 열에서 **(이름 · `definitionId`) 열** 로 — `slots.map(s => s.slotName + ":" + s.definitionId)` ↔ `preset.slots.map(s => s.name + ":" + (s.instanceOf ?? FRAME_DEFINITION))`. 판정 집합은 `Object.keys(LAYOUT_PRESETS)` (표시 순서 `PRESET_ORDER` 아님) — 결정 1 (b) 로 표시에서 뺀 키의 기존 layout 도 판정된다. 서명 유일성은 정적 검사 (`presetDefinitions.static.test.ts` 신설 — `LAYOUT_PRESETS` 전체 서명 중복 0). 재현 (리뷰 probe): 기존 vertical-2 layout (`header` · `content` 빈 Frame) 에 app-header 를 `PRESET_ORDER` 선두로 임시 등록 → `catalogAppliedPreset` 이 vertical-2 대신 app-header → `LayoutPresetSelector/index.tsx:120` 이 같은 키라 클릭 무시. 수리 뒤 vertical-2 (`header:frame` · `content:frame`) ≠ app-header (`header:Nav` · `content:frame|Main`) · app-shell (`sidenav:SideNavPanel`) ≠ app-shell-end (`sidenav:SideNavPanel/End`). `instanceOf` 를 쓰는 preset 의 `definitionId` 는 Library 원본 id 라 Phase 0 에서 확정한 id 상수를 preset 정의와 명령이 같이 읽는다. 기존 10 preset 은 전부 Frame 슬롯이라 서명이 이름 열과 1:1 — 적용 표시 무변경 (G1 회귀).
- Page Properties: 「내용이 채우는 슬롯」 한 줄 = `layoutContentSlotPath` 의 슬롯 이름을 `▸` 로 이어 표시 (`content ▸ bottom`).

### 3d. 내용 슬롯 경로 · 해제 (`project.ts`)

- `layoutContentSlotPath` (`:431`): 슬롯 전체 수집 대신 **단계별** — 루트의 직속 슬롯에서 하나 고르고 (`content` → 첫 required → 첫), 그 슬롯이 직속 슬롯을 가지면 반복. 결과 경로는 그 슬롯까지의 template 경로.
- `releaseLayout` (`:463`): `instance.descendantOverrides` 의 모든 `fillSlot` 을 슬롯 순서로 — 안쪽 슬롯의 `fillSlot` 주소 (바깥 슬롯 → 안쪽 슬롯 template 경로) 도 같은 배열에 있으므로 수집은 그대로, **순서** 만 경로 깊이 → template 순으로 정렬. G1 이 왕복을 잰다.
- 바깥 preset `replace` 는 바깥 슬롯 노드를 지우므로 안쪽 슬롯 · 내용도 같이 사라진다 — 지금과 같은 의미 (다이얼로그 문구에 「안쪽 배치 포함」 추가).

### 3e. 좁은 폭 — 판정 함수 (`sideNav.ts`)

```ts
// catalogSideNavPanelCollapsed(panel, env)
// 1. runtime 접힘 (Preview 접기 버튼) 2. 작성 isCollapsed 3. 작성 defaultCollapsed
// 4. App frame sidenav 슬롯 && env.breakpoint === "tablet"  → true   ← 새 가지
// 5. false
```

- 「App frame sidenav 슬롯」 판정 = 패널 노드 (template 노드 또는 그 instance 투영) 의 `slot?.name === "sidenav"` 이고 그 슬롯이 `usage: "layout"` 정의의 template 안 (instance 는 `templatePath` 의 정의로). 이름 규약은 preset 정의 안 상수 `APP_FRAME_SIDENAV_SLOT = "sidenav"` 하나.
- `env.breakpoint`: Canvas = 세션 활성 breakpoint (`CatalogSession`), Preview · Publish = `matchMedia` 로 `BREAKPOINTS` 경계 (tablet `minWidth 768` · desktop 1280 — `responsive.types.ts`) 에서 계산한 이름. 두 consumer 가 같은 이름 집합을 넘긴다. Canvas 의 tablet 프레임 (768) 은 미디어 경계 tablet (768 ≤ w < 1280) 안에 있다.
- 파생 전파: 접힘은 이미 `isCollapsed` 조건으로 자손 (SideNav 행 · 접기 버튼) 에 닿는다 (ADR-300 Decision 3) — 판정 결과가 같은 자리 (`presence.ts` 파생) 로 들어가면 자손 갱신도 같다. breakpoint 전환은 Canvas 전체 재해석이라 dependents 추가 없음 (Phase 0 확인).
- Properties: `isCollapsed` 칸이 비어 있고 판정이 접힘이면 안내 한 줄 「tablet 에서 접힘 (App frame)」.
- mobile: preset 이 sidenav 슬롯 `responsive.mobile.layout.display = "none"` 을 쓴다 (`layerOf` → `layout`) — Canvas 는 presence → 엔진 `display: none` (ADR-300 ④ 와 같은 길), DOM 은 생성 responsive CSS. 컨테이너 열이 `auto` (3a) 라 숨은 패널의 열은 0 이고 content 가 전폭 — mobile 에 컨테이너 층을 따로 두지 않는다.
- 폭의 한 길: 작성 폭 200 (슬롯 노드 `sizing.width`) → 접힘이면 rule `stateStyles.width.isCollapsed` 42 (DOM binding · Canvas `catalogSideNavPartLayout` 둘 다 작성 폭을 이김 — `componentRulesTable.ts:16186` 주석) → `display: none` 이면 0. 판정 (tablet) · 작성 `isCollapsed` · runtime 접기 (Preview 버튼) 는 모두 「접힘」 하나로 들어가고, 트랙은 `auto` 로 그 결과를 따른다 — 트랙에 breakpoint 값을 쓰지 않는다 (h1).

### 3f. 랜드마크 (결정 3 (a) 일 때)

- `componentCatalog.ts` layout 카테고리에 `Main` (라벨 「main」) · `Aside` (「aside」) primitive entry — `placeable: true`, Section 옆.
- rule: frame 과 같은 구조 (`archetype: "container"` · `skipCSSGeneration: true`) 에 `element: "main"` / `"aside"`. `variants: {}`. 배경 없음.
- `d2Provenance.ts`: 두 type 은 `composition` (S2 · RAC 에 없음 — HTML 랜드마크). `nestingRules`: Frame 과 같은 허용.
- DOM: `element("main")` · `element("aside")` (`domBinding.runtime.ts:922 ~ :926` 옆). Canvas: frame 과 같은 상자.
- App frame preset 의 `content` 슬롯 `instanceOf` = Main 원본 id, 세로 분할 (sidebar-right) 의 `sidebar` 슬롯은 Aside — 단 sidebar-right 는 기존 preset 이라 **값 무변경 원칙** 에 걸린다 → 결정 3 (a) 와 함께 「기존 preset 의 슬롯 type 변경 여부」 를 Phase 0 에서 사용자에게 같이 묻는다 (기본: 새 App frame preset 에만 적용, 기존 preset 은 Frame 유지).
- (b) 를 고르면: `domBinding.runtime.ts` frame 분기에서 `node.slot?.name === "content"` → `main` — Canvas 무관 (D1), 하지만 슬롯 이름이 요소를 정하는 숨은 결합이라 권고하지 않는다.

## 4. Phase

| Phase | 내용                                                                                                                                                                                                                                                                                                                                                                                                                       | 파일 (추정)                                                                                                                                                                                                                   | Gate    |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 0     | 인벤토리 — 번들 HEAD 재측정 · Nav · SideNavPanel 원본 id · `ownSlotContents` 결과 (SideNavPanel 기본 내용 노드 수) · instance 노드 `slot` 검증 통과 여부 · 안쪽 슬롯 `fillSlot` 주소 RED (바깥 content 안 안쪽 슬롯에 내용 → instance 투영에서 보이는가) · breakpoint 전환 때 SideNav 자손 재해석 경로 · end 섹션 type 이름 · 사용자 결정 1 ~ 4 · 6                                                                        | 테스트 2 (RED) · breakdown §6                                                                                                                                                                                                 | G0      |
| 1     | preset 모델 — `PresetScope` · `instanceOf` · 카테고리 `appframe` · preset 3 (app-shell 열 `auto 1fr` · sidenav 슬롯 폭 · `SideNavPanel/End` 원본) · 기존 10 `scope` · (결정 1) 순서 · 적용 명령의 `definitionId` 분기 · `CatalogLayoutSlot.definitionId` + 서명 판정 (h2) · 판정 집합 = `LAYOUT_PRESETS` 전체 · responsive 정리 집합 컨테이너 축만 (m1) · 서명 유일성 정적 검사 · 썸네일 분기 · 기존 preset 적용 표시 회귀 | `LayoutPresetSelector/types.ts` · `presetDefinitions.ts` (+ `.static.test.ts`) · `presetStyle.ts` · `LayoutPresetGrid.tsx` · `derivePreviewAreas.ts` · `catalogRuntime/layoutPreset.ts` · `reusableOriginLibrary.ts` + 테스트 | G1      |
| 2     | 컨테이너 단위 — `layoutContainerOf` · 격자 scope 필터 · Slots 목록 · 다이얼로그 문구 · `layoutContentSlotPath` 단계별 · `releaseLayout` 순서 · Page Properties 경로 표시 · 원복 RED 2 (R1 · R2)                                                                                                                                                                                                                            | `CatalogLayoutBodySection.tsx` · `commands/project.ts` · Page Properties 절 · i18n 2 키 + 테스트                                                                                                                              | G1      |
| 3     | 좁은 폭 — `catalogSideNavPanelCollapsed` 가지 · `env.breakpoint` (Canvas 세션 · Preview `matchMedia` 훅) · Properties 안내 · mobile 층 (preset 정의) · browser parity (1920 · 768 · 390 × Canvas · Preview × template · instance · 접기 버튼 runtime · 작성 `isCollapsed`) — sidenav 폭 **과 content 시작점 x · 폭** (h1)                                                                                                  | `runtime/sideNav.ts` · `presence.ts` (env 전달) · Preview 세션 breakpoint 훅 · `SideNavPanel` Properties + 테스트 `adr304AppFrameParity.browser.test.ts`                                                                      | G2      |
| 4     | 랜드마크 (결정 3) · 번들 · live — type `Main` · `Aside` (결정 3 (a)) · DOM 요소 · nesting · Library 카드 · `d2Provenance` · content 슬롯 `instanceOf` · G2 랜드마크 항목 · G3 · G4 live · README · CHANGELOG · `### Live Exercise`                                                                                                                                                                                         | `componentCatalog.ts` · `componentRulesTable.ts` · `domBinding.runtime.ts` · `d2Provenance.ts` · `nestingRules.ts` · `reusableOriginLibrary.ts` + 테스트                                                                      | G2 ~ G4 |

추정 파일 ≈ 18 (테스트 제외 — round 1 수리로 `presetStyle.ts` · `reusableOriginLibrary.ts` 추가). 1.5× 를 넘으면 Phase 0 inventory 보강 commit 으로 흡수 (adr-writing M3).

## 5. 범위 밖

- **mobile overlay** — hamburger Button (header 슬롯) → Sheet (360, `componentRulesTable.ts:5511`) 안 같은 SideNav · esc · focus 반환 — 후속 상호작용 ADR. 이 ADR 의 mobile 층은 sidenav 숨김까지.
- **린트성 Hub 지침** — CTA 1 · 내비 한 곳 · 라벨 길이 · skip link · F6 영역 이동 · `h1` in main · 그라데이션 content 안만. 내용 저작 규칙이라 preset 이 강제할 수 없다 — 필요하면 Publish 검증 (경고) 후속.
- **creating bluelines** — 치수 표기 지침.
- **세 층 이상 중첩** — 막지 않지만 검증 대상 아님.
- **Header type 개명** — S2 Menu section header 의 이름은 그대로.

## 6. 리뷰 round 1 수리 대응표 (2026-11-08, codex — `docs/adr/reviews/304.md`)

| 이슈                                                  | 수리 위치                                                                                                                      | 검증                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| h1 HIGH — 접힘 · 숨김 뒤 고정 사이드 열이 남음        | §3a app-shell 열 `auto 1fr` + sidenav 슬롯 노드 폭 · §3e 「폭의 한 길」 · 본문 Decision 1 · 4 · 제약 · R8                      | G1 unit (컨테이너 `auto 1fr` · 슬롯 폭) · G2 content 시작점 x · 폭 (200 · 42 · 0, runtime 접기 · 작성 prop 포함)           |
| h2 HIGH — 이름 열 판정이 vertical-2 ↔ app-header 혼동 | §3c 적용 판정 (이름 · `definitionId`) 서명 · 판정 집합 = `LAYOUT_PRESETS` 전체 · §3a app-shell-end 별도 원본 · 본문 Decision 3 | G1 서명 유일성 정적 검사 · vertical-2 layout 에서 app-header 적용 · 기존 10 적용 표시 무변경 · 원복 RED (이름 열로 되돌림) |
| m1 MEDIUM — 안쪽 적용이 바깥 tablet item 선을 지움    | §3b responsive 정리 집합 = 컨테이너 축만 · 본문 Decision 7 · R2                                                                | G1 dashboard-widgets `widgets` + vertical-2 → tablet `gridColumnStart 1` · `gridRowStart 3` 유지 · 원복 RED (item 키 복귀) |

리뷰의 UNVERIFIED (Builder · Preview 실제 흐름 · 슬롯 왕복 · 번들) 는 G1 · G2 · G3 · G4 그대로.

## 7. 실측 (Phase 0 에서 채움)

(번들 HEAD · 원본 id · 검증 결과 · RED 결과 · 사용자 결정 기록)
