# ADR-223: 생성 CSS archetype 미지정 기본값 중립화 — `DEFAULT_BASE_STYLES` 버튼 어법 제거 + `archetype: "default"` cohort 재판정

## Status

Implemented — 2026-09-18 (Proposed 09-18 → [reviews/223.md](../reviews/223.md) round 1 HIGH 1 · MEDIUM 2 · LOW 1 전부 fixed → 사용자 `/execute-adr 223` · Phase 0~~3 / G0~~G5 종결, 같은 날)

설계 요청: 사용자 `/create-adr` (2026-09-18). 실행 기록은 아래 `### 실행 기록`, 근거는 [evidence/223-phase0-inventory.md](../evidence/223-phase0-inventory.md) · [evidence/223-phase2-g2.md](../evidence/223-phase2-g2.md), live 는 `### Live Exercise`. 발단은 2026-09-17 Section·Nav 수리 (`944fc78d6`) 의 `/simplify` 판독 — "archetype `container` 신설은 옳은 깊이지만 2건만 옮긴 것은 특수 사례다. 결함의 기제는 미지정 archetype 의 fallback 이 버튼 어법이고 Skia 는 그것을 읽지 않는다는 것이다."

### 실행 기록

- **Phase 0 (G0 PASS)**: inventory 재실측 — `archetype: "default"` 28 = layout 17 / containerStyles 만 3 / composition 없음 8 (§2 F4 일치). 생성물은 catalog 28 + 잔존 spec **Slot** (archetype 미선언 → 같은 fallback) = 29 파일, cohort **12 / runtime loaded 8 / unloaded 4** 로 표 정정 (G0 규칙: 표를 고친다). 파일별 root 실효 잔존 표 + before sha 기록.
- **Phase 1 (G1 · G4 PASS)**: `DEFAULT_BASE_STYLES = ARCHETYPE_BASE_STYLES.container` (상수 하나, `archetypeBaseStyles()` 가 `isArchetypeId` 로 판정) · catalog entry 3 이관 (Pagination `containerStyles.alignItems` · Card `rootSelectors["&"].cursor` · Tab `rootSelectors["&"]` cursor/user-select/transition) · 재생성 diff 정확히 12 파일, layout 17 byte-identical · Slot 스냅샷 갱신 · 생성기 양성 테스트 5 (원복 4 RED) · 정적 ratchet 3 · type-check · text-axis-matrix drift 0.
- **Phase 2 (G2-A · G2-B · G3 PASS)**: `catalogComponentBox` Toolbar/TableView/Pagination 불리 케이스 GREEN (원복 시 Δ114 / Δ79 RED) + GridListItem 기존 Δ18 GREEN (원복 RED) · Disclosure 는 archetype 밖 Δ2 (border-style 부재) 라 제외 기록 · 실제 Card · Tabs>TabList>Tab · Toolbar before/after arm root box Δ0 + interaction (원복 2 RED) · live 7종 (아래).
- **Phase 3 (G5 PASS)**: CHANGELOG · `ssot-hierarchy.md` §3 · README · 인벤토리 주석 · visual-parity smoke 98/98.
- **이 ADR 밖으로 기록한 기존 발산 5** (evidence §후속): Pagination preview DOM 에 `.react-aria-Pagination` 미부여 (생성 CSS 전량 dead) · Disclosure border-style 부재 · Tabs TabPanels padding 12 vs 0 · Toolbar Skia 높이 29 vs 22 + Separator 여백 · Tooltip Δ20 (HEAD 에서 RED).

## Context

**Domain**: D3 시각 스타일 (생성 CSS 의 base 블록). D1 (RAC DOM · ARIA) · D2 (props) 무변경. 경계 교차 없음.

**문제**. catalog entry 가 `structure.archetype` 을 지정하지 않으면 (`"default"`, 28건) 생성기는 `DEFAULT_BASE_STYLES` 8 선언 — `inline-flex · align-items/justify-content center · cursor pointer · user-select none · transition …` — 을 `.react-aria-{Type}` root 블록에 낸다 (`CSSGenerator.ts:184-193`). 이 값은 **버튼의 어법**이다. 그런데 Skia/layout 은 archetype base 를 전혀 읽지 않고 `composition.layout` + `containerStyles` 만 합친다 (`resolveCatalogContainer.ts:77-102`). 즉 이 8 선언은 **DOM 전용 채널**이고 대칭 상대가 없다 — `ssot-hierarchy.md` §6 이 금지하는 "consumer 한쪽만의 시각 표현" 이 생성기 기본값 자리에 있다.

실제로 난 형태 (2026-09-17): Section 을 `display:flex` 로 바꾸면 자식이 DOM 에서만 가운데로 갔다 (x 104 vs Skia 16). 수리는 archetype `container` (block · box-sizing · font-family) 를 만들어 Section·Nav 2건을 옮긴 것이다. 같은 기제가 남아 있는 곳:

- `composition` 없이 F1 을 그대로 타는 8건 (Card · GridListItem · Tab · TableView · AvatarGroup · ButtonGroup · CardView · body) 과 `composition.layout` 없이 F1 뒤에 `containerStyles` 를 추가하는 3건 (Toolbar · Pagination · Disclosure — `CSSGenerator.ts:704-726`). 뒤 선언은 같은 속성을 정상 override 하지만, entry 가 선언하지 않은 F1 속성은 남는다.
- 그중 로드된 7건의 실효 잔존: Toolbar·TableView 는 `justify-content:center` (Section 동형 — width/height 를 주는 순간 발산), Pagination·GridListItem 은 `align-items:center`, 7건 전부 `cursor:pointer` + `user-select:none` 이 남는다. GridListItem 의 수동 CSS 는 cursor·transition 은 다시 선언하지만 `align-items`·`user-select` 는 덮지 않는다. 따라서 중립화는 GridListItem 의 기존 DOM x 35 vs Skia x 17 발산도 닫는 **의도된 시각 수리**다.
- `composition.layout` 17건은 base 를 layout token 으로 대체해 F1 을 소비하지 않는다 — 이 ADR 의 영향 밖이어야 하고, 그것을 G1 이 확인한다.

**Hard constraints**

- 대칭: 변경 대상 컴포넌트마다 Skia layout rect vs Preview DOM `getBoundingClientRect` Δ ≤ 1px (`catalogComponentBox` 오라클 — 외부 ground-truth 는 실 Chrome). 불리 케이스 (`display:flex` + `width:100%` + 고정 `height`, 자식 2) 필수.
- 비영향 증명: `composition.layout` 17 entry 의 생성 CSS 가 재생성 후 byte-identical.
- 문서 호환: 문서 schema · 저장 형식 무변경 (재직렬화 0 파일). 기존 프로젝트의 변화는 DOM 시각/커서뿐이고, 그 목록은 Phase 0 inventory 가 entry 단위로 고정한다.
- 번들: CSS 는 initial JS 게이트 밖 (`adr201-bundle-gate.mjs` 는 `initial.js.gzipBytes` 만). 생성 CSS 는 선언이 줄어 감소 방향.
- 생성기 질문 (adr-writing §반복 패턴 #2): 자식 selector / variant emit 확장 **없음** — root base 블록을 바꾸고, Card·Tab 의 DOM 상호작용 어법은 기존 `composition.rootSelectors["&"]` 채널을 재사용한다 (`CSSGenerator.ts:1747-1792`).

**Soft constraints**: catalog 표는 직접 편집 정본 (ADR-912) 이고 병행 세션이 자주 만진다 — entry 편집은 3건 이하로 좁힌다. ADR-907 Layer B ("container layout = props.style") 와의 경계는 건드리지 않는다 — 이 ADR 은 DOM 기본값을 **빼는** 것이지 layout 을 catalog 로 **올리는** 것이 아니다.

## Alternatives Considered

### 대안 A: 현행 유지 — 발산이 잡힐 때마다 entry 를 `container` 로 옮긴다

- 설명: 2026-09-17 방식의 반복. 결함이 보고된 entry 만 명시 archetype 으로.
- 근거: 이미 2건 처리됐고 나머지는 "평소 무증상" (Toolbar 는 `width: fit-content`, TableView 는 고정 height 를 잘 안 준다).
- 위험: 기술(L) / 성능(L) / **유지보수(H)** — 기제가 그대로라 Toolbar·TableView 에서 같은 1건 patch 가 또 나온다 (ADR-923 34 라운드의 "카테고리 반복" 형태) / 마이그레이션(L)

### 대안 B: 미지정 기본값을 중립 상자로 바꾸고, 버튼 어법이 실제로 필요한 entry 만 명시한다 (선택)

- 설명: `DEFAULT_BASE_STYLES` 를 `container` 와 같은 3 선언 (block · box-sizing · font-family) 으로 합친다. 공통 geometry 인 Pagination `align-items:center` 는 `structure.containerStyles` 로 이관해 Skia·DOM 이 같이 읽는다. DOM 상호작용 어법인 Card `cursor:pointer` 와 Tab 의 cursor/user-select/transition 은 기존 generator 전용 `structure.composition.rootSelectors["&"]` 로 이관한다. Canvas 는 저작 surface 자체의 cursor·텍스트 선택·transition 정책을 가지므로 이 세 속성을 layout/Skia style 로 가장하지 않는다. Toolbar·TableView 의 `justify-content:center` 와 비상호작용 컨테이너의 cursor/user-select/transition 은 제거하고, GridListItem 의 `align-items:center` 제거는 기존 parity 발산 수리로 분류한다. 신규 entry 가 미지정으로 남지 않도록 정적 ratchet (미지정 + `composition.layout` 없음 목록 pin).
- 근거: 생성기 기본값이 "가장 흔한 형태" 여야 한다면 그것은 버튼이 아니라 상자다 — 28 미지정 entry 중 element 가 button 인 것은 Tab 1건. Skia 가 안 읽는 값은 DOM 기본값에서도 빠지는 것이 대칭 원칙에 맞다.
- 위험: 기술(M — 로드된 7 entry 의 DOM 시각이 바뀌므로 entry 별 오라클 필요) / 성능(L) / 유지보수(L) / 마이그레이션(M — 기존 프로젝트의 publish 에서 컨테이너 커서·텍스트 선택이 바뀐다; 문서 무변경)

### 대안 C: `archetype` 을 필수로 만들고 fallback 을 없앤다

- 설명: `ComponentRuleStructure.archetype: ArchetypeId` (string → union), `"default"` 28건을 전부 명시값으로 편집, 생성기의 fallback 분기 삭제.
- 근거: "fallback = 기본값이면 무증상" 함정 (메모리 `feedback-fallback-equals-default-masks-dropped-channel`) 을 타입으로 원천 차단.
- 위험: 기술(M) / 성능(L) / 유지보수(L) / **마이그레이션(H)** — 표 직접 편집 28 entry + 타입 변경이 병행 세션의 표 편집과 충돌하고, `composition.layout` 17건은 archetype 을 소비하지도 않는데 값을 골라야 한다 (의미 없는 선택 17개). B 의 ratchet 이 신규 entry 에 한해 같은 효과를 준다.

### 대안 D: Skia 도 archetype base 를 읽어 대칭을 만든다

- 설명: `resolveCatalogContainerBase` 가 `ARCHETYPE_BASE_STYLES` / `DEFAULT_BASE_STYLES` 의 layout 키 (display · align · justify) 를 합친다.
- 근거: "두 leg 가 같은 SSOT 를 읽는다" 를 문자 그대로 만족.
- 위험: **기술(H)** — 버튼 어법 (center 정렬) 을 캔버스에 들여와 Section 발산이 "양쪽 다 가운데" 로 대칭화된다. 사용자가 고른 `display:flex` 의 기본 정렬은 flex-start 여야 한다 (CSS 초기값) / 성능(L) / 유지보수(M) / **마이그레이션(H)** — 기존 문서의 캔버스가 일제히 바뀐다.

### Risk Threshold Check

| 대안 | HIGH+                   | 판정                                           |
| ---- | ----------------------- | ---------------------------------------------- |
| A    | 유지보수 H              | 기각 — 재발 기제 유지                          |
| B    | 없음 (M 2)              | **선택**                                       |
| C    | 마이그레이션 H          | 기각 — B 의 ratchet 이 신규 entry 에 같은 효과 |
| D    | 기술 H · 마이그레이션 H | 기각 — 방향이 거꾸로                           |

루프 불필요 (B 에 HIGH 없음).

## Decision

**대안 B**. 미지정 archetype 의 생성 CSS base 를 중립 상자 (block · box-sizing · font-family) 로 바꾸고, 잔존 선언은 entry 별로 "공통 geometry 이관", "DOM 상호작용 이관", "제거"로 판정한다. Pagination align 은 `structure.containerStyles`, Card·Tab interaction 은 `structure.composition.rootSelectors["&"]` 로 옮긴다. 제거 대상은 (a) Toolbar·TableView 와 GridListItem 의 정렬 잔존 (기존 Canvas parity 발산) 및 (b) 비상호작용 컨테이너의 cursor · user-select · transition 이다. 신규 entry 가 미지정으로 남는 것은 정적 ratchet 이 막는다.

위험 수용 근거: M 2개는 둘 다 "로드된 7 entry 의 DOM 이 바뀐다" 에서 오고, 그 7건은 Phase 0 inventory 가 entry 단위로 고정한다. G2-A 는 layout 영향 5종을 실 Chrome 구조 오라클로, G2-B 는 실제 React Card·Tab root 의 computed style/box 를 검증하고, G3 는 실제 빌더 live 7종을 판정한다. 기존 프로젝트 영향은 비상호작용 컨테이너의 커서/텍스트 선택/transition 제거와 Toolbar·TableView·GridListItem 정렬 수리로 한정한다.

기각 사유: A — 기제가 남아 Toolbar·TableView 에서 같은 patch 가 반복된다. C — 표 28 entry 편집 + 타입 변경의 병행 세션 충돌 대비 이득이 신규 entry ratchet 과 같다. D — 버튼 어법을 캔버스에 들여오는 것은 대칭이 아니라 결함의 복제다.

> 구현 상세: [223-generated-css-default-archetype-neutralization-breakdown.md](../design/223-generated-css-default-archetype-neutralization-breakdown.md) — §2 코드 사실 표 (F1~~F10, 경로:라인) · §3 cohort 12건 판정 표 · §4 Phase 0~~3.

## Risks

| ID  | 위험                                                                                                                                                      | 심각도 | 대응                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Card·Tab 의 `cursor:pointer` 가 빠지면 publish 에서 상호작용 힌트가 사라진다 (Card 는 `onPress` 보유)                                                     |  MED   | 기존 generator 전용 `rootSelectors["&"]` 로 Card cursor, Tab cursor/user-select/transition 이관. G2-B/G3 가 실제 computed style 기록    |
| R2  | 수동 CSS 가 생성 CSS 뒤에서 base 를 덮는 곳 (GridListItem ← `GridList.css`) 은 오라클이 생성 CSS 만 실으면 결과가 다르게 나온다 (measurement-validity #8) |  MED   | G2 DOM leg 은 production 순서의 `index.css` 번들 전체를 싣는다 (`feedback-parity-dom-leg-must-carry-preview-base-styles`)               |
| R3  | Tab 에 `archetype: "button"` 을 주면 `width: fit-content` 가 딸려 와 TabList 안 폭이 바뀐다                                                               |  MED   | button archetype 을 쓰지 않고 interaction 3선언만 `rootSelectors["&"]` 로 이관 (breakdown §3)                                           |
| R4  | 미로드 4건 (AvatarGroup · ButtonGroup · CardView · Body) 의 생성 CSS 가 바뀌지만 runtime 에서 보이지 않는다                                               |  LOW   | ADR-923 인벤토리 (`generatedCssLoadInventory`) 판정 유지 — 로드 경로가 생기면 그 게이트가 먼저 실패                                     |
| R5  | 병행 세션이 catalog 표를 편집 중이면 entry 3건 편집이 hunk 충돌한다                                                                                       |  LOW   | entry 편집을 Phase 1 한 커밋으로 · 착수 전 `git status` 로 표 dirty 확인 (`feedback-parallel-session-sweep-during-single-commit-phase`) |

잔존 HIGH 위험 없음.

## Gates

측정 착수 전 5-질문 (measurement-validity §1): Q1 대상 = G2-A 는 정렬 차원을 격리하는 합성 고정-box fixture (분포/실사용 주장에 쓰지 않음), G2-B/G3 는 실제 shared React 컴포넌트와 팔레트 생성물 · Q2 불리 케이스 = `display:flex` + `width:100%` + 고정 `height` 자식 2 및 실제 GridList 카드 · Q3 대조군 = 같은 조건의 변경 전 생성 CSS arm (Phase 0 sha) · Q4 소비 경로 = index.css import + 실제 component class 방출 + Canvas production projection · Q5 oracle = 실 Chrome `getBoundingClientRect`/`getComputedStyle` 및 실제 Builder scene rect (생성기 자기 재생성만으로 판정하지 않음).

| Gate | 시점         | 통과 조건                                                                                                                                                                                                                                                                                                                                                           | 실패 시 대안                                                                   |
| ---- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| G0   | Phase 0      | `archetype: "default"` 목록과 파일별 root 블록 실효 선언이 evidence 로 저장되고 breakdown §3 과 일치 (불일치는 표를 고친다, 전제 재검토 아님)                                                                                                                                                                                                                       | inventory 재실측 후 §3 갱신                                                    |
| G1   | Phase 1      | 재생성 diff 는 §3 cohort 의 생성 CSS **12파일** (catalog 11 + 잔존 spec Slot, Phase 0 재실측) 에만 있고 runtime load 8 / unloaded 4 분류가 evidence 와 일치 · `composition.layout` 17 파일은 byte-identical · Card/Tab rootSelectors 양성 생성 테스트 · `text-axis-matrix` drift 0 · type-check PASS                                                                | 17 파일 중 하나라도 바뀌면 F2 소비 분기 재확인 — 생성기 변경 되돌리고 원인부터 |
| G2-A | Phase 2      | `catalogComponentBox` 의 Toolbar · TableView · Disclosure · Pagination · GridListItem (불리 케이스 포함) — Skia vs DOM rect Δ ≤ 1px. 기존 GridListItem `child0.x` Δ18 known failure 가 GREEN, `DEFAULT_BASE_STYLES` 만 되돌리면 Toolbar/TableView/GridListItem RED                                                                                                  | Δ > 1 인 entry 는 §3 layout 판정 재검토                                        |
| G2-B | Phase 2      | 실제 shared React Card와 `Tabs > TabList > Tab` 트리를 production `index.css` 로 렌더하는 전용 browser case — Phase 0 before CSS와 after CSS를 한 arm씩만 활성화해 같은 component tree를 순차 측정. root box Δ ≤ 1px, Card `cursor:pointer`, Tab `cursor:pointer`/`user-select:none`/transition 유지, Card user-select/transition 제거를 `getComputedStyle` 로 확인 | interaction 이 빠지면 rootSelectors 이관/selector reach 재확인                 |
| G3   | Phase 2 live | 실제 빌더 (headed Playwright 또는 Chrome MCP, hidden 탭 금지) 팔레트 추가 7종 (기존 6종 + GridList): Skia scene rect vs Preview iframe DOM rect Δ ≤ 2.5 · computed cursor/user-select/transition 이 §3 판정과 일치 · GridList 카드 자식 x parity · pageerror 0 · Compare 반폭 함정 기록                                                                             | 불일치 entry 는 §3 판정 재검토                                                 |
| G4   | Phase 1      | 정적 ratchet: `archetype: "default"` 이면서 `composition.layout` 없는 entry 목록이 pin 되고, 목록 밖 신규 entry 는 테스트 실패 (명시 선택 강제)                                                                                                                                                                                                                     | —                                                                              |
| G5   | Phase 3      | CHANGELOG 엔트리 · `ssot-hierarchy.md` §3 한 줄 · README 상태 · pre-push visual-parity smoke PASS                                                                                                                                                                                                                                                                   | —                                                                              |

### Live Exercise

2026-09-18, **headed Playwright** (dev 5173, 실제 빌더 부팅 — Chrome MCP 는 hidden 탭 RAF 정지로 대체하지 않았다) · `apps/builder/scripts/adr223-archetype-live.mjs` · pageerror 0. 새 프로젝트에 팔레트 7종 (Toolbar · TableView · Disclosure · Pagination · Card · Tabs · GridList) 추가 → Skia layout map (부모 기준 rect) → Compare Mode 1회 → preview iframe 폭을 페이지 폭 1920 으로 강제 (반폭 함정) → DOM rect (부모 기준) + `getComputedStyle`.

- **정렬 축 (기제 제거)**: TableView 10 노드 (header/column/body/row/cell) · Disclosure 2 · Card · TabList · GridList projection row 3 ↔ DOM GridListItem 3 (954×76 / 189×76, 0,0 · 966,0 · 0,88) 전부 Δ ≤ 2.5. GridList 카드 텍스트 자식 x = item + 17 · 폭 = item − 34 (stretch — 종전 `align-items:center` 면 수축·가운데).
- **interaction 축 (§3 판정)**: Toolbar · TableView · Disclosure `cursor auto · user-select auto · transition 없음` / Card `cursor pointer · user-select auto · transition 없음` / Tab `cursor pointer · user-select none · transition background, border-color, transform` / GridListItem `pointer · auto · all` (수동 GridList.css).
- **이 ADR 밖 기존 발산 (기록, 판정 분리)**: Pagination 은 preview `renderPagination` 이 class 를 안 붙여 생성 CSS 가 DOM 에 도달하지 않는다 (Skia space-between 1920 vs DOM 50px 간격) · Tabs TabPanels 래퍼 padding · Toolbar Skia 높이/Separator 여백 — G2-B 에서 DOM 값이 before/after 동일함을 확인.

## Consequences

### Positive

- 생성기 기본값에서 암묵적 DOM 전용 채널이 사라진다 — 미지정 entry 의 CSS base 는 중립 상자가 되고, 필요한 DOM 상호작용 값은 catalog 의 명시적 generator-only 채널에만 남는다. Section 형 발산 (정렬이 DOM 만) 의 기제 자체가 닫힌다.
- Toolbar · TableView 의 잠재 발산 (`justify-content:center`) 이 발견 전에 제거된다.
- publish 에서 컨테이너 (Disclosure 본문 · TableView · Toolbar · Pagination) 위 손가락 커서와 텍스트 선택 차단이 없어진다 — 상호작용 힌트는 실제 상호작용 요소 (Button · Tab · Card) 만 갖는다.
- 신규 catalog entry 는 archetype 을 고르거나 ratchet 목록에 이름을 올려야 한다 — 무증상 fallback 이 막힌다.

### Negative

- 로드된 7 entry 의 생성 CSS 가 바뀐다 — 기존 프로젝트의 publish 시각/커서가 entry 단위로 달라진다 (목록은 Phase 0 evidence). Card cursor와 Tab 3 interaction 선언은 현행 유지하고, GridListItem cross-axis 정렬은 기존 Canvas 값으로 맞춰진다.
- 명시 이관은 두 채널로 나뉜다. Pagination `alignItems` 는 공통 geometry `containerStyles`, Card·Tab interaction 은 DOM 전용 `rootSelectors["&"]` 다. 둘 다 catalog 정본이지만 후자는 Canvas 저작 surface 가 소비하지 않는다는 계약을 문서화한다.
- `container` archetype 과 미지정이 같은 값이 된다 — `container` 는 "명시했다" 는 표지로만 남는다 (Section · Nav). 혼동을 막기 위해 생성기 주석에 그 관계를 적는다.
