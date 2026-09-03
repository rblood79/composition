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

- **layout 모드 frame body 의 flex row 가 Canvas 에서 column 으로 보인다** — Frame 1 body 는 store·canonical 모두 `display: flex · flexDirection: row` 인데 Slot sidebar (`width: 250px`) 가 390 폭으로 세로 적층되고 width 편집 (100px) 에도 rect 가 안 변한다 (content slot 의 `flex: 1` 은 세로로 반응). Preview 는 layout 모드를 안 그려 대조 표면이 없다. 다음 착수 후보 — 원인은 미확정 (frame body 축 또는 Slot 폭 채널).
- catalog `TailSwatch` 팔레트 항목이 dead (creator 없음) — 제거 vs 구현은 제품 판단. `TailSwatch.sizes.height 32` 도 그때 정리.
- Slot.spec `sizes.height` 가 CSS `height` 로 나가지만 Canvas 는 `minHeight` 로 읽는다 — 의미를 spec 에서 `minHeight` 로 옮길지 (CSSGenerator 필드) 별도 판단.
