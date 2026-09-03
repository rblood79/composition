# ADR-923 Phase 5 후속 착수 3 — Slot placeholder 높이 (Canvas 0 → spec 60) · TailSwatch 32↔74 판정 (2026-09-04)

> 착수 순위 3 (Lane A [hc2-conversion §0](923-phase5-followup-hc2-conversion.md) "범위 밖 기록": Slot Canvas 높이 0 · TailSwatch 높이 32↔74). 착수 전 production 표면에서 먼저 쟀다.

## 1. 사실 (착수 전)

### Slot

- Slot 은 reusable frame 편집 (**layout 모드**) 에서만 생성된다 (`paletteItems` `layoutOnly`, factory `createSlotDefinition` "Layout Body 에서만"). page 모드의 Slot 은 `resolvePageWithFrame` 이 `_slotChrome: "hidden"` 으로 투영하고 DOM 은 `App.tsx:1044` `.preview-slot` (content 높이).
- **Preview 는 layout 모드를 그리지 않는다** — Compare 모드에서 Frame 1 을 열어도 iframe 은 page 요소만 낸다 (`[data-element-id]` 전부 page). 따라서 layout 모드 Slot 의 DOM 표면은 production 에 없고, 시각 정본은 잔존 spec `Slot.spec.ts` sizes (sm 40 · md 60 · lg 80) → generated `Slot.css` `.react-aria-Slot { height: 60px }` 이다 (HC2 rect gate 가 이 CSS 로 DOM leg 을 그린다: DOM 400×60).
- Canvas: Slot 은 자식 없는 컨테이너라 content 0 — spec sizes.height 를 layout 이 안 읽는다 → 400×0 (팔레트로 넣은 Slot 이 안 보인다). 레이아웃 템플릿 (`layoutTemplates.ts`) 의 Slot 은 인라인 `minHeight: 60` (content slot 은 `flex: 1`) 이라 템플릿 Slot 만 보였다.

### TailSwatch

- 팔레트 항목 (`paletteItems` `source: "overlay"`, 라벨 "color picker") 은 있으나 **`ComponentFactory` 에 creator 가 없다** → `No creator found for component type: TailSwatch` — 사용자가 추가할 수 없다 (live: "Add color picker element" 클릭 후 store 변화 0). DOM 렌더 (`renderTailSwatch` → `MyColorSwatches` `flex flex-col gap-4` Tailwind class) 는 Preview 에 Tailwind 가 없어 unstyled 74 이고, Skia 는 catalog `sizes.md.height` 32 상자만 그린다. **사용자 표면이 없는 격차** — 수리 대상 아님. 팔레트 dead 항목 (제거 또는 creator 추가) 은 제품 판단 (§4).

## 2. 수리 (동작 변경 — Canvas, Slot 만)

- `implicitStyles.ts` `applyImplicitStyles`: `containerTag === "slot"` 이고 `_slotChrome !== "hidden"` (layout 모드) 이며 사용자 height/minHeight 가 없으면 spec `sizes[size].height` 를 **`minHeight`** 로 주입 (`specSizeField("slot", size, "height")` — 잔존 spec read-through). minHeight 인 이유: 템플릿 Slot 인라인 (`minHeight: 60` · `flex: 1`) 과 같은 계약 — generated CSS 는 `height` 고정이지만 그 CSS 를 소비하는 production DOM 이 없고, 고정 height 는 `flex: 1` content slot 을 60 으로 눌러 앉힌다.
- 손대지 않음: Slot.spec (height → min-height 의미 전환은 별도 판단, §4) · page 모드 · TailSwatch.

## 3. 게이트 · 원복 RED

- unit `slotImplicitStyles.test.ts` (신규 4): md → minHeight 60 (height 미주입) · sm 40 / lg 80 · `_slotChrome hidden` 미주입 · 사용자 height/minHeight 우선 (템플릿 `flex 1 · minHeight 60` 그대로). RED 2 → GREEN.
- browser `adr923Hc2ConversionRect.browser.test.ts`: Slot 행에 Δh ≤ 1 단언 추가 (DOM 60 ↔ Canvas). 원복 (`if (false && …)`) 시 `Slot Δh (placeholder 0 vs 60)` 1 FAIL + unit 2 FAIL → 복원 GREEN.

## 4. 검증 · live

- type-check PASS · engines unit 466 · rect gate 6 · full parity (§4 표 아래).
- live (Frame 1, layout 모드, Chrome CPU throttle 4x): 팔레트 "Add slot element" 로 넣은 Slot (인라인 없음) 이 `[0,784,390,60]` — 종전 0. 템플릿 Slot 2개 (`minHeight 60` · `flex 1`) 는 `[0,0,390,60]` · `[0,60,390,724]` 로 변화 0 (minHeight 계약 유지). 스크린샷: 세 번째 hatched placeholder 가 390×60 으로 보인다.

## 5. 범위 밖 (기록만)

- ~~**layout 모드 frame body 의 flex row 가 Canvas 에서 column 으로 보인다**~~ — **오판정 (2026-09-04 사용자 지적 후 실측 철회)**. 결함이 아니라 responsive breakpoint 의 정상 동작이다: canonical body 가 `responsive.styles.flexDirection = { mobile: "column" }`, sidebar Slot 이 `responsive.styles.width = { tablet: "200px", mobile: "100%" }` 를 갖는다 (`appliedPreset: "sidebar-left"`). 측정 당시 뷰포트가 mobile (390) 이라 column + 폭 100% 가 맞다. 뷰포트 전환 실측 — desktop: body 1920, sidebar `[0,0,250,1080]`, content `[250,0,1670,1080]` (row) · tablet: body 768, sidebar 200 (row) · mobile: column. **교훈**: layout 축이 이상해 보이면 결함으로 적기 전에 `activeBreakpoint` 와 노드의 `responsive.styles` 를 먼저 읽는다.
- 계측 함정 (같이 확인): `useStore.setActiveBreakpoint(bp)` 만 부르면 layout rect 가 이전 breakpoint 값에 머문다 (`getSharedLayoutVersion` 은 오르는데 body 폭은 그대로). 헤더 뷰포트 radio (데스크톱/태블릿/모바일) 를 클릭해야 프레임 영역 크기까지 바뀐다 — breakpoint 별 rect 는 UI 경로로 잰다.
- ~~catalog `TailSwatch` 팔레트 항목이 dead (creator 없음) — 제거 vs 구현은 제품 판단.~~ **사용자 판정 (2026-09-04): "컴포넌트에서 제공하지 않는다" → 팔레트 노출 제거** (`paletteItems.ts` PALETTE_ONLY · PALETTE_ORDER, `ComponentList` i18n 매핑, oracle fixture; 게이트 `paletteItems.test.ts` "TailSwatch 는 팔레트에 없다"). catalog rule/binding/generated CSS/shared `TailSwatch.tsx` (builder `PropertyColorPicker` 가 `MyColorSwatches` 를 쓴다) 는 남긴다 — 파일 삭제는 별도 승인.
- Slot.spec `sizes.height` 가 CSS `height` 로 나가지만 Canvas 는 `minHeight` 로 읽는다 — 의미를 spec 에서 `minHeight` 로 옮길지 (CSSGenerator 필드) 별도 판단.

## 후속 — spec 축을 `height` → `minHeight` 로 전환 (2026-09-04, 착수 8, 사용자 판단)

Canvas 는 이미 spec 값을 minHeight 로 **번역**해 주입하고 있었다 (§2 — layout 템플릿의 Slot 인라인 `minHeight: 60` · content slot `flex: 1` 과 같은 계약; 고정 높이로 누르면 flex 로 늘어나야 하는 slot 이 깨진다). spec 만 `height` 라 **선언과 소비 의미가 어긋나** 있었고, 생성 CSS 는 DOM 에 고정 높이를 주고 있었다. 사용자 판단: 전환 — 단, 생성 CSS 가 `height` → `min-height` 로 바뀌는 **사용자-가시 semantic** 이므로 별도 commit.

### 변경

| 파일                          | 변경                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `Slot.spec.ts` sizes          | `height: 40/60/80` → `minHeight: 40/60/80`                                             |
| `spec.types.ts` `SizeSpec`    | `height: number` → `height?: number` (축은 컴포넌트가 정한다 — Frame/Group·primitives 는 그대로 height) |
| `implicitStyles.ts` Slot 분기 | `specSizeField(..., "height")` → `"minHeight"` (번역 없이 같은 축을 읽는다)            |
| 생성 `Slot.css`               | `height: 60px` → `height: auto` + `min-height: 60px` (sm 40 · lg 80 동형)              |
| `variantColors.ts` / `skiaPrimitives.ts` | optional 전파 — `getSizePreset` 반환 타입 `number \| undefined`, divider 두께 `?? 1` |

### 전환이 드러낸 것 — placeholder chrome 이 상자를 넘고 있었다

고정 높이를 걷어내자 DOM 이 **74** 로 늘어났다 (Canvas 60). 원인은 `Slot.tsx` 의 placeholder chrome (icon + 이름) 에 **CSS 가 하나도 없어** 블록 흐름으로 쌓인 것 — 자연 높이 74 가 종전 `height: 60px` 를 넘어 상자 **밖으로 넘치고 있었다** (고정 높이가 그 넘침을 가렸다). Canvas 는 이 chrome 을 그리지 않고 점선 상자만 그린다 (`Slot.spec.render.shapes`).

수리: chrome 배치를 spec `composition.externalStyles` 로 선언해 (수동 CSS 아님 — D3 파생 채널) 한 줄 (icon · 이름) 로 눕혔다. 값은 배치뿐 (display/align-items/gap/flex-direction/min-width) — 색·타이포는 도입하지 않았다. content 24 + padding 24 = 48 < 60 → 선언 최소 높이가 이긴다.

남는 비대칭 (기록): `description` 이 있어 chrome 이 두 줄이 되면 DOM 만 늘어난다. chrome 자체가 DOM 전용 편집 장식이라는 성질에서 오는 것으로, Canvas 가 chrome 을 그리게 되면 같이 해소된다.

### 게이트 · 원복 RED

- 신규 `packages/specs/src/components/__tests__/slotMinHeightAxis.test.ts` 2 — spec 이 minHeight 축을 쓴다 + 생성 CSS 가 `min-height` 를 emit 하고 고정 `height: Npx` 를 emit 하지 않는다 (한쪽만 고정하면 spec 을 되돌려도 CSS 만 보고 통과한다).
- 원복 (minHeight → height) → 두 케이스 모두 FAIL.
- 기존 `slotImplicitStyles.test.ts` 4 PASS (필드명 전환 후에도 주입값 60 동일 — 이 게이트가 rename 회귀를 막는다).
- `CSSGenerator.snapshot` Slot 스냅샷 갱신 (생성물 diff 는 Slot.css 한 파일).

### 검증

- browser 게이트 `adr923Hc2ConversionRect` Slot: **canvas block 400×60 ↔ dom div:block 400×60** (production Canvas 트리 ↔ production rendererMap, Preview 전역 reset 포함). 전환 직후엔 이 게이트가 `Δh 60 vs 74` 로 RED 였고, chrome 배치 수리로 GREEN — 즉 이 숫자가 위 "넘침" 의 실측 근거다.
- type-check PASS · specs 880 PASS · parity 1086 PASS (기존 2) · builder 5223 PASS (기존 4, 무관).
