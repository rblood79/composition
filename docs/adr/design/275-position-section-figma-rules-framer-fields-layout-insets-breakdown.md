# ADR-275 breakdown — Position 절 (Figma 규칙 + Framer 칸 배치) · layout inset 저장

> 본문: [ADR-275](../275-position-section-figma-rules-framer-fields-layout-insets.md). 이 문서는 Phase · 파일 · 검증의 구현 상세다.

## 1. 전제 lock-in

- **분류**: 새 결정이다. 기존 ADR 의 fork · 분리가 아니고 의존 방향 변화도 없다.
  - ADR-026 (제약 레이어 기각) · ADR-267 결정 1 (sticky · fixed 저작 안 함) · ADR-164 (fixed 미지원) 은 그대로 둔다.
- **schema**:
  - 노드 `placement` 를 지운다.
  - 저작 absolute 는 기존 `layout.position` · `inset*` · `margin*` 을 쓴다. 새 필드는 0 이다.
  - 옛 문서: `LIBRARY_CONTRACT_VERSION` 41 → 42, 옛 개발용 프로젝트 전부 거부 (사용자 결정 1, 2026-10-19).
- **사용자 확정** (본문 Status 원문 인용):
  - pin 4 변
  - 가운데 = 별도 선택
  - Figma 중심 UX + Framer 칸 배치
  - 빈 칸 입력 = 그 변으로 바꿈
  - 저장 = layout inset 통일
  - 가운데 = 양쪽 inset + `justifySelf` / `alignSelf: unsafe center` (A4 — 사용자 결정 4 「figma,framer 처럼 가운데」 로 처음의 margin auto 를 대체)

## 2. 제약 대응 표 (G3 oracle — 손계산)

containing block 폭 `W` = 400, 상자 폭 `w` = 100 (Fixed) 일 때 x (padding box 기준):

| 패널 제약                                                          | 저장 (가로)                                                            | 기대 x · 폭                                      |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------ |
| Left 24                                                            | `insetLeft: 24px`                                                      | 24 · 100                                         |
| Right 24                                                           | `insetRight: 24px`                                                     | 276 · 100                                        |
| Left 24 + Right 24                                                 | `insetLeft: 24px` · `insetRight: 24px` · 폭 auto                       | 24 · 352                                         |
| Center 0                                                           | `insetLeft: 0px` · `insetRight: 0px` · `justifySelf: unsafe center`    | 150 · 100                                        |
| Center +20                                                         | `insetLeft: 20px` · `insetRight: -20px` · `justifySelf: unsafe center` | 170 · 100                                        |
| Left 10 %                                                          | `insetLeft: 10%`                                                       | 40 · 100                                         |
| Center 0 · Hug (내용 60)                                           | 위 Center (폭 auto — 자기 정렬이 fit-content 로 푼다)                  | 170 · 60                                         |
| Center 0 · Hug (내용 60) · 자식 padding 12 · border 2 (리뷰 r1 H2) | 위와 같음                                                              | 156 · 88 (border-box = 60 + 24 + 4)              |
| Center 0 · 부모 W = 100 · 자식 w = 200 (리뷰 r1 H1 · 결정 4)       | Center 0                                                               | x = −50 (넘쳐도 가운데 — `unsafe`) · 세로도 같음 |

세로는 같은 표를 `top · bottom · height` · `alignSelf` 로 읽는다.

**읽기 규칙** (저장 → 패널):

1. `justifySelf` (세로 `alignSelf`) = `unsafe center` ∧ 양쪽 inset ∧ `left = −right` → Center (offset = left)
2. 양쪽 inset → Left+Right
3. right 만 → Right
4. 그 외 → Left (inset 없으면 0)

## 3. Phase

### Phase 0 — inventory freeze · oracle (G0)

- 본문 F1 ~ F16 의 경로 · 줄을 다시 grep 한다.
- **A4 go/no-go (G0, 측정 선행 C 등급)**: 브라우저 fixture 로 Chrome · WebKit 에서 absolute + 양쪽 inset + `justify-self` / `align-self: unsafe center` 를 잰다. 경우 = 넘침 (부모 < 자식) · Hug (폭 auto) · 오프셋 ±20 · 부모 display block / flex / grid. 둘 다 가운데면 go. 하나라도 다르면 no-go → 본문 A5 대체안 (Fixed 폭 `calc(50% − w/2 + o)` · Hug 는 A1) 으로 §2 표 · Phase 1 · 2 를 고치고 사용자에게 보고한다.
- 노드 placement 소비자 목록을 고정한다. 아래 표가 작성일 실측이며, 늘면 이 표를 보강한다 (M3).

| 묶음        | 파일                                                                                                                                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 문서 · 명령 | `document/types.ts` · `document/validation.ts` · `transactions/transaction.ts` (`setNodePlacement`) · `commands/fields.ts` · `commands/structure.ts` (붙여넣기) · `commands/components.ts`                             |
| 해석        | `resolution/resolver.ts` · `resolution/fieldSource.ts`                                                                                                                                                                 |
| runtime     | `runtime/compositionRoot.ts` (`itemLayout` · `styleOf` · record 비교) · `runtime/domBinding.runtime.ts` · `runtime/boxModel.ts` · `runtime/presence.ts`                                                                |
| Builder     | `catalogRuntime/position.ts` · `canvasGesture.ts` · `canvasSpacing.ts` · `gridAutoRows.ts` · `effectiveStyle.ts` · `panels/styles/catalog/catalogStylesHost.ts` · `workspace/canvas/catalog/CatalogGridTrackLayer.tsx` |

- **소비자마다 술어를 배정한다** (리뷰 r1 M1). 작성일 기준 초안이며, Phase 0 에서 줄마다 확인해 고정한다.

| 쓰는 곳                                                                                                                                                                                                   | 술어                                          | 이유                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `canvasGesture.ts` beginMove (`:482-505`) · absolute drag (`:1333`)                                                                                                                                       | 저작 위치 (`isAuthoredAbsolute`)              | rule 부품 이동 거부를 유지 — 바깥 흐름 ∧ 저작 아님이면 `false`                                                                                               |
| `catalogStylesHost.ts:748` (Left · Top = 위치 오프셋) · `position.ts`                                                                                                                                     | 저작 위치                                     | Position 절 편집 대상                                                                                                                                        |
| `commands/structure.ts` 붙여넣기 · `commands/components.ts`                                                                                                                                               | 저작 위치                                     | 저작 inset 을 옮겨 적는다                                                                                                                                    |
| `canvasSpacing.ts:57` · `gridAutoRows.ts:76` · `CatalogGridTrackLayer.tsx:215` · `canvasGesture.ts:793` (grid snap) · `:1914` (형제 비킴) · `catalogStylesHost.ts:372` · `:928` · `:963` (grid 흐름 자식) | 바깥 흐름 (`isOutOfFlow`)                     | 흐름에서 빠지는 상자는 rule 부품이어도 빠진다. 이 자리들은 지금도 `placement absolute ∨ layout.position absolute` 라 resolved 판정 하나로 바꿔도 동작이 같다 |
| `boxModel.ts` · `domBinding.runtime.ts` · `compositionRoot.ts` · `presence.ts`                                                                                                                            | 해당 없음 — 술어 대신 layout 값 그대로 직렬화 | 위치 경로가 하나가 되므로 분기 자체를 지운다                                                                                                                 |

흐름 표면은 작성일 실측으로 전부 `placement absolute ∨ layout.position absolute` 를 같이 본다 — `isOutOfFlow` 로 바꿔도 동작이 같다. 단 `gridAutoRows.ts:76` 은 breakpoint 별 값 (`layoutValue(node, breakpoint, "position")`) 을 읽으므로 `isOutOfFlow` 도 breakpoint 인자를 받는다. Phase 0 에서 줄마다 다시 확인한다.

- oracle fixture 를 쓴다 (`apps/builder/tests/parity/` browser): 위 §2 표 9 행 × 가로 · 세로. 입력 차원 = **자식 자체의** padding 12 · border 2 · 부모 padding · `%` · `max-width` · 음수 오프셋 · 부모 < 자식 · breakpoint 축소 (부모 폭이 자식 아래로).
- Rust 테스트 초안 (RED 예상): `absolute_fit_content_margin_auto_centers` (F10) · `absolute_fit_content_padded_center_keeps_border_box` (F14) · `absolute_margin_auto_negative_free_inline_starts` (F13).

### Phase 1 — 엔진: absolute 의 키워드 크기 · 음수 여유 (G1)

> 사용자 결정 4 확정 (넘쳐도 가운데 → A4). G0 go 일 때의 내용이다.

| 파일                                                            | 변경                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/engine/src/tree.rs` `place_absolute_children` (A4)    | absolute 자기 정렬: 양쪽 inset ∧ `justify-self` (가로) · `align-self` (세로) 가 `normal` · `stretch` · `auto` 아님 → auto 크기는 fit-content (기존 shrink-to-fit 경로 `absolute_shrink_to_fit_width` 재사용), 위치는 inset 영역 안 정렬. `unsafe center` = 음수 여유도 반. `styleOf` 는 `alignSelf` · `justifySelf` 를 이미 item 필드로 보낸다 (`compositionRoot.ts:1267-1268`) — absolute 노드에도 가는지 Phase 0 에서 확인 |
| `packages/engine/src/tree.rs` `place_absolute_children`         | 판정 둘을 나눈다 (리뷰 r1 H2). ① `size_fixed_w/h` = 명시 길이 ∨ `fit-content` · `min-content` · `max-content` — `resolve_abs_axis` 의 `has_explicit_size` 와 `stretch_w` · `stretch_h` (`:2899-2915`) 에만 쓴다. ② 기존 `has_w/h` (명시 길이) — padding · border 가산 · leaf layout 읽기 (`:2838-2851`) 는 그대로 이 판정을 쓴다. 키워드 크기의 solve 반환은 content-box 라서 ② 의 가산을 거쳐 border-box 가 된다            |
| `packages/engine/src/tree.rs` `resolve_abs_axis` (`:7459-7469`) | 양쪽 margin auto · 음수 여유: 가로 축은 시작 margin 0 (LTR), 세로 축은 같은 값으로 나눈다 (리뷰 r1 H1). 축 구분 인자를 하나 더한다                                                                                                                                                                                                                                                                                           |

- 테스트:
  - Rust: A4 Center × Fixed · Hug (auto) · fit-content · max-content, **자식 padding 12 · border 2** (88 · x 156), 넘침 (x −50 · 세로도), 오프셋 ±20 · margin auto 음수 여유 가로 · 세로 (F13)
  - 회귀: auto 는 계속 늘어나야 한다 · 명시 길이 Center (`absolute_margin_auto_centers`) · 기존 shrink-to-fit (`absolute_auto_width_*`) 그대로
  - oracle browser 0 px (Chrome 이 정한 축별 넘침 결과를 기준으로)
  - 수리 원복 시 RED (판정 하나로 합친 변이 → F14 케이스 RED)
- `pnpm wasm:build:engine` 뒤 parity 를 다시 돌린다.

### Phase 2 — 저장 통일 (G2)

- **술어 둘** 을 둔다 (shared `catalog/runtime`, 리뷰 r1 M1):
  - `isOutOfFlow(node)` = resolved `layout.position === "absolute"`
  - `isAuthoredAbsolute(node)` = `authoredLayout?.position === "absolute"` (`resolver.ts:1339` — base + breakpoint 층의 저작 값)
  - 소비자의 `placement?.kind === "absolute"` 를 Phase 0 배정표대로 바꾼다.
- **compositionRoot**:
  - `itemLayout` 의 `!node.placement` 조건과 placement → inset 변환 (`:1085`) 을 지운다.
  - inset · margin 은 기존 `styleOf` 직렬화 (`px()`) 를 그대로 탄다.
- **domBinding**: placement → left/top 분기를 지운다. layout 의 position · inset · margin 이 생성 style 로 간다.
- **boxModel**: `model.position` 을 layout inset 에서 읽는다 (Spacing 다이어그램).
- **presence** `:283`: `node.placement ||` 를 지운다 (`layout.position` 조건만 남음).
- **문서 · 명령**:
  - `NodePlacement` 타입 · `NodeEntry.placement` · 검증 `:1272` · `setNodePlacement` op 을 지운다.
  - 붙여넣기 · 컴포넌트 명령은 layout 쓰기로 바꾼다.
- **검증**: 노드 layout 의 `justifySelf` · `alignSelf` 가 `unsafe center` 를 받는다 (`validation.ts:160` 키워드 목록 확장 — 이 두 키만, 다른 정렬 키 불변). DOM 은 layout 값을 그대로 CSS 로 낸다.
- **사용자 결정 1** 적용: `LIBRARY_CONTRACT_VERSION` 41 → 42 (옛 개발용 프로젝트 전부 거부).
- **정적 게이트**: `nodePlacementRemoved.static.test.ts` — src 의 `NodePlacement` · `node.placement` · `setNodePlacement` 0.
- **unit** (리뷰 r1 M1): ListBoxItem 안 Icon (`slot=icon`, rule absolute) beginMove = `false` 유지 · 저작 absolute frame beginMove = `true` · rule 부품은 Position 절 편집 대상 아님.

### Phase 3 — Canvas 조작

| 파일                                        | 변경                                                                                                                                                                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalogRuntime/canvasGesture.ts`           | absolute drag (`:1333`) 가 §2 읽기 규칙으로 제약을 읽고, 이동량을 그 제약의 inset 에 쓴다. Right → `insetRight −= dx` · Center → offset `+= dx` · Left+Right → 양쪽 같이. `%` 칸은 containing block 비율로 바꾼다 |
| `catalogRuntime/position.ts`                | `catalogPlacementEditCommand` 를 제약 쓰기 명령으로 교체한다 (`positionConstraint.ts` 사용). `cssPx` 전용 제한을 없앤다                                                                                           |
| `catalogRuntime/positionConstraint.ts` (새) | 읽기 (`readConstraint(layout, box)`) · 쓰기 (`writeConstraint(next, currentBox, cb)` → layout writes). 「바꿔도 그 자리」 계산 · 늘이기의 폭 auto · 가운데의 `fit-content` 를 여기서 한다                         |

- 쓰기는 기존 layout 쓰기 경로라 현재 breakpoint 층에 들어간다.

### Phase 4 — 패널 UI (G3)

| 파일                                                 | 변경                                                                                                                                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `panels/styles/sections/TransformSection.tsx`        | `PositionSection` 을 혼합 방식으로 다시 짠다. Relative · Absolute 글자 토글 (Sticky · Fixed 비활성) · pin 상자 88 px (4 변 + 십자선) · 변 옆 T · R · B · L 칸 (`PropertyUnitInput`, `px` · `%`) · 빠른 버튼 3 · 결과 문장 |
| `panels/styles/sections/PositionPinBox.tsx` (새)     | pin 상자 — RAC `ToggleButton` 6 (변 4 · 가운데 2), `aria-pressed` · `aria-label`                                                                                                                                          |
| `components/styles/inspector-layout.css` 또는 새 CSS | 칸 배치 grid (`1fr 88px 1fr` × `28px 88px 28px`) · 점선 `auto` 칸 · 미리보기 선 — 토큰 (`--accent` · `--fg-muted` · `--border`) 만                                                                                        |
| `panels/styles/catalog/catalogStylesHost.ts`         | `applyAbsolute` → layout 쓰기 · 제약 읽기 값을 패널에 제공                                                                                                                                                                |
| i18n `translations.ts`                               | 칸 이름 · 결과 문장 · 비활성 안내 (`Not allowed yet`)                                                                                                                                                                     |

- **패널 규칙**: 본문 Decision 3 그대로.
  - 축 비지 않음.
  - 빈 칸 입력 = 그 변으로 바꿈 + 반대 변 해제 미리보기.
  - 늘이기 = pin 상자 · `Fill` 만.
- **unit**:
  - 제약 왕복 — 4 제약 × `px` · `%` × 2 축
  - 칸 입력 바꿈
  - 축 비지 않음
  - 바꿔도 그 자리 (상자 rect 불변)
  - relative 칸 활성 범위 — Left · Top 만, Right · Bottom · pin 상자 비활성 (사용자 결정 3)
  - 가운데 축의 Spacing margin 칸 = `auto · Center` 잠금 · 다른 축 margin 은 편집 가능 (사용자 결정 2)

### Phase 5 — live · 대칭 · 문서 (G4 · G5 · G6)

- **live (Chrome MCP, 저장된 인증 세션)**:
  - 시안 H-A ~ H-E 재현
  - 각 제약으로 Canvas drag 뒤 제약 유지
  - Tablet breakpoint 에서 drag → base 층 불변
  - Compare Mode Preview 위치 일치
  - 정리는 삭제 명령으로 한다 (undo 금지)
- `/cross-check` absolute 노드 6 제약.
- `pnpm gate:perf-ratchet` drag run · 번들 게이트.
- CHANGELOG: Changed (Position 절) · Breaking (contract 42 — 옛 개발용 프로젝트 거부).
- 규칙 문서 갱신: `.claude/rules/layout-engine.md` §position:absolute 의 「노드 `placement` 는 부모 좌표」 문장 → layout inset.

### Phase 6 — Sticky (사용자 결정 5, 2026-10-20)

- 검증: 노드 `layout.position` 에 `sticky` (`validation.ts` `layoutValueChoices` — library 용 별도 표는 같은 표로 합침). `fixed` 는 계속 거부. contract 42 그대로 (추가만).
- DOM: `catalogNodeLayoutCss` 가 저작 `sticky` 를 싣는다. 엔진 입력 (`itemLayout`) 은 ADR-267 부터 이미 보낸다.
- 명령: `CatalogPositionChange` 에 `sticky` (진입 — Top 0, 다른 inset · `unsafe center` 정리) · `stickyInset` (한 변, 빈 칸 · `auto` = 해제). 쓸 것이 없으면 `null` (오류 표시 없음 — 같은 경로의 「Left+Right 아닌 칸 비우기」 가 `target-missing` 을 띄우던 것도 함께 바로잡음).
- 패널: Sticky 버튼 활성 · 네 칸 각자 · pin 상자 · Center · Fill 비활성 · 요약 줄. Relative · Absolute 는 종전 명령 (`applyAbsolute`).
- Canvas 그리기 순서: z-index 없는 sticky 상자 = positioned layer (`sortChildElementsByZIndex` — 같은 z 안에서 흐름 형제 뒤). 그리기 층 (z-index · sticky) 이 바뀐 record 는 `paint-order` 로 다시 묶는다.
- 게이트: unit (검증 · 명령 · 패널 · 엔진 constraints + DOM · 그리기 순서 · 묶인 장면 편집) + 원복 RED 6 + live (Canvas = Preview, 스크롤 150).

### Phase 7 — Fixed (사용자 결정 6, 2026-10-20)

- 엔진: `fixed_count` (0 이면 건너뜀) · `compute_layout` 끝 `place_fixed_boxes` — page root (compute root 의 직계 자식) 원점 + `set_viewport` 크기, `place_absolutes_in(…, cb_borders = false)` 로 viewport 모드 (크기 · `%` · inset · 자기 정렬 · static 위치 · shift 로 직계 부모 기준 기록).
- 검증 · `itemLayout` · DOM: `fixed` (contract 42 그대로). 술어: `catalogIsOutOfFlow` 에 fixed, `catalogIsAuthoredFixed` · `catalogIsAuthoredPlaced` 추가 — 부모가 containing block 인 표면 (DOM 의 positioned 부모 · 정렬 · 분배) 은 absolute 전용 그대로. `layoutIsAbsolute` (복사 · 원본 복원의 위치 이동) · 복제는 fixed 포함.
- Canvas: `isFixed` (canvasBinding) · `renderCommands` 의 page 층 (`FixedLayer` — 조상 clip · 스크롤 밖, 담은 page 자식 뒤, page clip, `unscrollOwnerId` 로 page 스크롤 되돌림) · page 스크롤 때 fixed 는 옮기지 않음 (`applyScrollDelta`). page 없이 하는 부분 재기록은 fixed 가 top layer 라 기존 `top-layer` 거부로 다시 묶인다 (따로 둔 플래그는 중복이라 걷어냄 — 원복해도 GREEN 으로 확인).
- 명령 · 패널 · 제스처: `catalogPlacementFrame` (absolute = 부모 padding box · fixed = page viewport) · `applyAbsolute(…, "fixed")` · Fixed 버튼 (Absolute 의 pin · 칸) · Canvas 끌기 `viewportOf`.
- 함께 수리: breakpoint 층 Left+Right 의 폭 지우기 `mask` → `set null` (`SIZING_MASK_FORBIDDEN`).

## 4. 사용자 결정 — 확정 2026-10-19

| 결정                      | 답                                                                                                              | 적용 Phase |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------- |
| 1 옛 문서 placement       | contract 42 · 전부 거부 (「모두 거부해도 상관없다」)                                                            | 2          |
| 2 가운데 축 margin 칸     | Figma · Framer 방식 — 그 축 margin 칸 잠금 (`auto · Center`)                                                    | 4          |
| 3 relative Right · Bottom | 비활성 (「비활성이 사용자 혼란을 막지 않을까」)                                                                 | 4          |
| 5 Sticky (2026-10-20)     | 허용 — ADR-267 결정 1 을 sticky 에 한해 뒤집음 (「sticky 허용으로 진행해」)                                     | 6          |
| 6 Fixed (2026-10-20)      | 허용 · viewport = page body 영역, 스크롤에 안 움직임 (「body영역을 viewport 영역으로 봐야하지않나」 · 「진행」) | 7          |

- **Phase 4 Spacing 절 연동** (결정 2):
  - `SpacingSection.tsx` 는 선택 노드의 제약을 읽어, 가운데 축의 margin 두 칸을 잠금 표시한다 (값 `auto`, 안내 「Center — Position 에서 변경」).
  - margin 쓰기 명령도 같은 조건에서 거부한다. 패널만 막고 명령은 열어 두지 않는다 — Canvas spacing 손잡이 · 붙여넣기 스타일 경로가 같은 명령을 쓰기 때문이다.

## 5. 기록

### Phase 0 — 2026-10-19 (G0 go)

- **A4 go/no-go** (Playwright, 측정 조건 headless · DPR 1): absolute + 양쪽 inset + `justify-self` / `align-self` 를 Chromium 156.0.8078.4 · WebKit 27.2 에서 `getBoundingClientRect` 로 쟀다. 경우 9 × 부모 display 3 = 27.
  - `unsafe center`: 두 브라우저 27 / 27 이 손계산 (§2 표) 과 같다 — 넘침 Fixed 200 in 100 → −50 · 넘침 Hug 200 × 150 → (−50, −25) · 넘침 + 오프셋 10 → −40 · Hug padding 12 · border 2 → 88 × 48 at (156, 126).
  - 대조군 `center` (접두 없음): 넘침 9 건이 (0, 0) — 원래 containing block 안으로 당긴다 (오프셋 10 이어도 inset 영역 시작 10 이 아니라 0). 나머지 18 건은 같음.
  - 판정 **go** — §2 표 · Phase 1 · 2 그대로.
- **F 사실 재확인**: F1 · F3 · F5 · F6 · F11 · F16 줄 일치. `styleOf` `itemLayout` 은 `alignSelf` · `justifySelf` 를 absolute 노드에도 보낸다 (`compositionRoot.ts` `ITEM_LAYOUT_FIELDS`). catalog rule 의 absolute 부품 17 곳 중 자기 정렬을 같이 주는 곳 0 — 엔진이 정렬을 읽기 시작해도 rule 경로 동작 무변경.
- **소비자 실측 (M3 보강)** — src 24 파일 (작성일 17):

| 묶음            | 파일                                                                                                                                                                                                                                                                                                            |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 문서 · 명령 (7) | `document/types.ts` · `document/validation.ts` · `document/clone.ts` · `transactions/transaction.ts` · `commands/fields.ts` · `commands/structure.ts` · `commands/components.ts`                                                                                                                                |
| 해석 (2)        | `resolution/resolver.ts` · `resolution/fieldSource.ts`                                                                                                                                                                                                                                                          |
| runtime (5)     | `runtime/compositionRoot.ts` · `runtime/domBinding.runtime.ts` (`:373` · `:2643` · `:2669` · `:3079`) · `runtime/boxModel.ts` · `runtime/presence.ts` · `runtime/fillLayout.ts`                                                                                                                                 |
| Builder (10)    | `catalogRuntime/position.ts` · `canvasGesture.ts` · `canvasSpacing.ts` · `gridAutoRows.ts` · `effectiveStyle.ts` · `aiHost.ts` · `shortcuts.ts` (정렬 · 분배) · `styleDirty.ts` · `panels/styles/catalog/catalogStylesHost.ts` (`:453` · `:587` · `:656` · `:748` · `:1164` 추가) · `CatalogGridTrackLayer.tsx` |

- 술어 배정 추가분: `shortcuts.ts` 정렬 · 분배 = 저작 위치 · `aiHost.ts` · `effectiveStyle.ts` · `styleDirty.ts` = 술어 없음 (placement 를 style 로 합치던 분기 삭제 — layout inset 이 이미 style) · `clone.ts` · `fillLayout.ts` = 분기 삭제 (`fillLayout` 의 `position: absolute` 는 layout 값에 이미 있음).
- 흐름 표면 5 곳 (`canvasSpacing:57` · `gridAutoRows:76` · `CatalogGridTrackLayer:215` · `canvasGesture:793` · `:1914` · `catalogStylesHost:372` · `:928` · `:963`) 은 줄마다 `placement ∨ layout.position` 을 같이 본다 — 배정표 그대로.
- page `placement` (`PagePlacement` · `canvasPage.ts` · `pagePlacementEdit.ts`) · Tooltip · Toast `placement` prop · paste `CopyPlacement` 입력은 노드 placement 가 아니다 — 대상 밖.

### Phase 1 — 2026-10-19 (G1)

- `packages/engine/src/tree.rs`:
  - `parse_abs_self_align` (새) — `unsafe` / `safe` 접두 · center · start 계열 · end 계열. `auto` · `normal` · `stretch` 는 `None` (늘이기).
  - `place_absolutes_in` — `align_x/y` 는 그 축 양쪽 inset 일 때만. `size_fixed_w/h` = 명시 길이 ∨ `min/max/fit-content` ∨ 자기 정렬 → `resolve_abs_axis` 와 늘이기 재solve 판정에만. padding · border 가산 · leaf layout 읽기는 `has_w/h` 그대로.
  - `absolute_shrink_to_fit_width` — 양쪽 inset 이어도 `justify-self` 가 정렬이면 inset 영역 폭으로 fit-content.
  - `resolve_abs_axis` — ④ 자기 정렬 (auto margin 이 먼저 흡수) · `unsafe` 아니고 넘치면 margin box 를 containing block 안으로 (시작 쪽 우선) · 양쪽 margin auto 음수 여유: 가로 시작 0 · 세로 반씩.
- 검증:
  - Chrome oracle `apps/builder/tests/parity/absoluteSelfAlign.browser.test.ts` 19 / 19 (수정 전 17 RED · 회귀 2 GREEN). F13 은 Chrome 이 가로 0 · 세로 −50 으로 정했다.
  - Rust 4 새 테스트 + 전체 538 PASS. 변이 (`has_w` 에 자기 정렬을 합침) → `absolute_unsafe_center_hug_padded_keeps_border_box` RED (60 · x 170).
  - parity 869 중 868 PASS. 실패 1 (`adr248CatalogGeometryDelta` case 2 — `subtreeNodeVisits` 4 기대 · 1 실제) 은 HEAD 엔진으로 되돌려도 같다 — 이번 변경 무관, 별도 기록.

### Phase 2 — 2026-10-19 (G2)

- **삭제**: `NodePlacement` · `NodeEntry.placement` · 검증 · `setNodePlacement` op · `WholeFieldValue.placement` · resolver / fieldSource / record 의 `placement` · `CatalogRecordPreview.placement` · `boxModel.position` · `catalogPlacementStyle` · `catalogPlacementEditCommand` · styleDirty `PLACEMENT_KEYS`.
- **새 파일**: `packages/shared/src/catalog/runtime/positioning.ts` (술어 둘) · `document/absoluteLayout.ts` (붙여넣기 · 복제 · 원본 복원이 geometry 없이 inset 을 옮김 — `shiftAbsoluteLayout`).
- **compositionRoot** `itemLayout` 의 `!node.placement` 조건 · `box.position` → inset 변환 삭제, record 비교는 `authoredLayout`. **domBinding** placement 분기 삭제 — authored layout (position · inset · 자기 정렬) 이 inline CSS. containing block 판정은 `catalogIsAuthoredAbsolute`.
- **검증**: `alignSelf` · `justifySelf` 가 `unsafe center` 를 받는다 (이 두 키만). `LIBRARY_CONTRACT_VERSION` 42.
- **Position 토글 Off**: 현재 breakpoint 의 `position` 만 지우고 (desktop remove · breakpoint mask) inset 은 남긴다 — 기존 `TransformSection` 테스트 계약 (「disables absolute positioning without clearing offsets」), in-flow 에선 inset 이 무효이고 Relative 의 Left · Top 이 다시 읽는다. Center 의 `unsafe center` 는 지운다 (in-flow 에선 flex · grid item 정렬이 된다). 흐름 컨테이너로 drop 은 모든 층의 위치 키를 지운다 (`catalogClearPositionCommands`).
- **사후 보고 (scope)**: src 24 파일 (작성일 17, 1.4 배) · 테스트 이관 shared 5 · builder 13 · browser 3 파일 (작성일 6 → 21, 3.5 배 — contract 리터럴 41 → 42 일괄 40 곳 포함). 새 결정 없음 — Phase 0 inventory 보강 (M3).
- **검증**:
  - 정적 게이트 `nodePlacementRemoved.static.test.ts` — 원복 (src 한 줄에 `record.placement`) → RED.
  - Canvas ↔ DOM `tests/parity/adr275PositionParity.browser.test.ts` 8 제약 (Left · Right · Left+Right · Center Fixed · Center +20 · Center Hug · `%` · Center 넘침) — 손계산 oracle = DOM = 엔진. DOM 의 position 직렬화 원복 → 8 RED.
  - `adr275PositionPredicates.test.ts` — ListBoxItem icon (rule absolute) = 바깥 흐름 ∧ 저작 아님, 저작 frame = 둘 다.
  - unit builder 6,095 · shared 1,718 · parity 878 · G3 94 PASS. 실패 3 은 HEAD 에서도 같다 (`resolveContainerStylesFallback` Disclosure — `affebfb69` 규칙 표 변경 · `adr248CatalogGeometryDelta` case 2 · G3 palette 14 legs — HEAD worktree 로 같은 14 legs 확인).

### Phase 3 — 2026-10-19

- `catalogRuntime/positionConstraint.ts` (새): `catalogReadPositionConstraint` (§2 읽기 규칙) · `catalogPositionLayoutWrites` (그려진 상자 → 제약의 inset, `%` 변은 `%` 유지, px margin 은 inset 밖, 버리는 변은 desktop remove · breakpoint mask) · `catalogClearPositionCommands`.
- 쓰는 곳: Canvas drag (`absoluteMoveCommand` — 제자리 · page body 로 이동 · 흐름 drop), resize (늘인 축은 폭을 쓰지 않음, 끝 고정이면 끝 inset 이 따라감), Ctrl drag (`placeAbsoluteCommand`), Alt 복사 (`pasteNodes` offset), 정렬 · 분배 (`shortcuts.ts` — 부모 geometry 는 끝 · 가운데 · `%` 제약일 때만 읽는다, 행동 바 geometry 1 회 계약 유지), Position 토글 On.
- **엔진 결함 수리 (진행 중 발견)**: in-flow 자식 없는 auto 크기 부모는 leaf 경로라 자기 solve 에서 폭 0 이고 used 크기는 부모 (block 채움 · flex stretch) 가 정한다. absolute 자식은 그 0 으로 놓였다 (Right 30 → x −90 · Chrome 310, Center 도 0 기준). `tree.rs` `resettle_leaf_absolutes` — compute 끝에 used 크기가 다르면 absolute 자식을 다시 놓는다 (얕은 노드부터, `position: static` 명시 부모 제외 — 그 자식은 positioned 조상이 놓는다). Chrome oracle 2 (폭 auto block · flex 가 늘인 부모) · 원복 RED 2 · Rust `absolute_child_of_auto_width_leaf_uses_the_used_width`.
- **검증**: `adr275PositionConstraint.test.ts` 20 (§2 표 · margin · 넘침 · mask · 4 제약 × px · `%` 왕복) · gesture 3 (Right · Center · Left+Right drag 가 제약 유지) · gesture 42 · Rust 538 → 539.

### Phase 4 — 2026-10-20 (G3)

- **패널** (`panels/styles/sections/TransformSection.tsx` `PositionControls` · `PositionPinBox.tsx` · `inspector-layout.css`):
  - 모드 seg (`PropertySegment` — `disabledValues` · `disabledHint` 추가): Relative · Absolute, Sticky · Fixed 비활성 「Not allowed yet」. rule 이 놓은 부품 (저작 아님 ∧ resolved absolute) 은 전부 비활성 + 「Placed by its component」.
  - pin 상자 64 px (작성일 88 — 실제 패널 폭 ~190 px 에서 칸이 40 px 로 줄어 축소, 사후 보고) · 변 4 + 가운데 2 · 눌림 = accent + 굵기 (색만으로 구별하지 않음). 축 규칙 `catalogNextAxisConstraint` (마지막 pin 은 남음 · 반대 변 누름 = Left+Right).
  - 칸: `px` · `%` (작성 전 `vw` · `vh` 는 저장 불가였다). 가운데 축의 시작 칸 = 오프셋 (라벨 Center X / Y).
  - 빠른 버튼 Center X · Center Y · Fill, 결과 문장 (`aria-live`).
- **명령** `catalogRuntime/position.ts` `catalogPositionChangeCommand` + host `applyPosition`. Relative 에 들어갈 때 입력한 변 외 inset 을 지운다 — live 에서 Absolute → Relative 뒤 남은 Top −48 이 오프셋으로 되살아난 것을 찾아 수리.
- **사용자 결정 2**: Spacing 의 가운데 축 margin 칸 잠금 (`BoxModelEditor` `lockedMarginSides`) · styles host 의 margin 쓰기 거부 (Canvas spacing · 스타일 붙여넣기 같은 경로).
- **목록 동기화**: `POSITION_PROPS` · `TRANSFORM_PROPS` · `PANEL_STYLE_PROPS` · `SECTION_EDITABLE_RESPONSIVE_PROPS` 에 right · bottom (AI manifest 의 Heading props 도 따라 늘어남 — `adr254HeadingOrigin` 기대값 갱신).
- **검증**: `phase4ePosition` ADR-275 4 (바꿔도 그 자리 · 빈 칸 입력 · Left+Right 폭 · Fill · margin 거부 · 축 비지 않음) · `TransformSection.test` 10 (단위 px · % · Relative 범위 · 모드 버튼) · type-check 0 · unit builder 6,099 · shared 1,718.

### Phase 5 — 2026-10-20 (G4 · G5 · G6)

- G4 live: 본문 Live Exercise 표 (10 시나리오). 진행 중 수리 1 (Relative 진입 inset 정리).
- G5: ratchet 은 dirty 트리면 HEAD worktree 를 잰다 — 커밋 뒤 pre-push 판정.
- G6: 사용자 패널 확인 대기 (시안 `.pen` 이 열려 있지 않아 ADR Decision 3 명세로 구현).
- 테스트 프로젝트 `adr275-live` 는 사용자 IndexedDB 에 남아 있다 (삭제는 사용자 판단).

### Phase 6 — 2026-10-20 (사용자 결정 5 — sticky)

- 원복 RED: 검증 키워드 (nodeAuthoring 1 · sticky e2e 2) · DOM 직렬화 (e2e 1) · positioned layer (그리기 순서 2) · 패널 비활성 목록 (TransformSection 1) · 진입 inset 정리 (position 1) · `paint-order` 다시 묶기 (e2e 1).
- 회귀: shared 1718 · builder catalogRuntime + panels/styles + workspace/canvas 3819 PASS (실패 1 = `resolveContainerStylesFallback` Disclosure — 기존 실패) · type-check PASS.
- live: 본문 Live Exercise 둘째 표. 진행 중 결함 1 — 묶인 장면에서 sticky 로 바꾼 상자가 제자리 재기록만 돼 항목 아래 그려짐 → `paint-order` 다시 묶기 (같은 경로의 z-index 편집도 함께 해결).
- 남은 것: Fixed (ADR-267 결정 2 — Canvas viewport 기준 · 엔진 구현).

### Phase 7 — 2026-10-20 (사용자 결정 6 — fixed)

- Chrome oracle `fixedPosition` 5 (390 × 844 iframe — 조상 padding · border · 위치 · `%` · 화면보다 긴 page · Center · Hug · static 위치 · absolute 안 · 스크롤 상자 안) · Rust `fixed_is_placed_in_the_page_viewport`.
- 원복 RED: 엔진 패스 (Rust 1 · oracle 4/5 — 남은 1 은 static 위치라 패스와 무관) · 검증 · `itemLayout` · DOM · page 층 · 스크롤 건너뛰기 (스크롤 때 재기록 0 단언) · `isFixed` · 기준 상자 · 끌기 · 패널 · breakpoint 폭 `null`.
- 회귀: shared 1718 · builder 3827 (실패 1 = Disclosure 기존) · parity 884 (실패 1 = `adr248CatalogGeometryDelta` case 2 기존) · Rust 540 · type-check PASS.
- live: 본문 Live Exercise 셋째 표. 진행 중 결함 1 (breakpoint Left+Right 폭 `mask`).
- 알려진 동작 (Absolute 와 같음): 흐름에서 폭 auto 로 늘어나던 상자는 Absolute · Fixed 로 바꾸면 내용 폭으로 줄어든다 (빈 frame 은 0). 이번 범위 밖.

### 패널 정리 — 2026-10-20 (사용자 결정 7)

- 변 칸 legend 제거 (`labelMode="icon"` 아이콘 없이 — 접근 이름 유지) · `Center X` · `Center Y` 버튼 제거 · `Fill` 을 아이콘 칸으로 (`actions-position-fill`).
- 2 열 폭에 맞춤: pin 상자 64 → 48, Top · Bottom 칸 폭 = Left · Right 칸 폭, 모드 버튼 폭은 글자 폭에서 나눔 (「Absolute」 잘림 해소).
- 원복 RED: legend 단언 (TransformSection). unit: Fill 버튼 → `{ kind: "fill" }` · Sticky 에서 Fill 없음 · Center X 버튼 없음.
- live (Desktop, 패널 233): 칸 4 = 63 · legend 0 · 모드 글자 잘림 0 · Fill 아이콘 x 가 Size · Spacing 아이콘 칸과 같음.

### 도식 크기 통일 — 2026-10-20 (사용자 결정 8)

- 토큰 `--inspector-diagram-height` (`.section`, Alignment 판 높이 식) — Spacing 상자 · Position pin 상자가 같이 쓴다. 위 「pin 상자 48」 은 이것으로 바뀌었다.
- Spacing (`BoxModelEditor`): `.spacing-controls` 행 템플릿 — Padding · Margin `PropertyUnitInput` (네 변 한 값, 다르면 `Mixed` placeholder · `preserveEmptyValueOnUnitChange` 로 빈 값을 0 으로 그리지 않음) + 도식 (5 × 5 격자, 안 글자 2xs, 고리 이름 글자 제거) + link.
- Position: 상자 = 한 열 폭 × 도식 높이, 도식 줄 3 열 전체 · `Fill` 은 모드 줄 아이콘 칸. pin 안 된 칸의 점선은 outline (border 면 칸 높이 30).
- 원복 RED: `preserveEmptyValueOnUnitChange` 제거 → Mixed 칸이 「0」 (`SpacingSection.test.tsx`).
- live (Desktop, 패널 233): Padding · Margin 칸 87 × 47 = Display · Space · 도식 87 × 84 = Alignment 판 · pin 상자 87 × 84 · 좌우 칸 61 (입력 29, 「auto」 다 보임) · Fill 자리 x = Spacing link x. Padding 12 입력 → 네 변 12 · 도식 위 변 4 → Padding 칸 Mixed · 0 입력으로 원래 값 복원.

### Spacing 도식 = padding 만 — 2026-10-20 (사용자 결정 9)

- `BoxModelEditor` 도식에서 margin 고리 · margin 변 입력 · 고리 테두리를 뺐다. 격자 = Alignment 판 (`repeat(3, var(--spacing-xl))` · gap 4 · padding 2xs · `space-between` · 같은 표면 토큰). 가운데 = 12 내용 상자 표시 (pin 상자의 가운데 표시와 같은 어법).
- Margin 변 잠금 안내 문구 (`styles.position.centerMarginLocked`) 는 쓰는 곳이 없어 지웠다.
- 테스트: `SpacingSection.test.tsx` 에 margin 변 입력 없음 단언 · `spacingBoxModelCommit.test.tsx` 의 「값 변화 없는 blur 는 쓰지 않음」 대상을 Margin 변 입력 → Margin 칸으로.
- live (Desktop): 도식 87 × 84 · x · gap · padding · 배경 · outline · 그림자 · radius 가 Alignment 판과 같음 (computed style 대조). 오른쪽 변 6 입력 → 그 변만 6 · Padding 칸 Mixed → Padding 칸 0 으로 복원.

### Padding = Layout 절 · Spacing 절 제거 — 2026-10-20 (사용자 결정 10)

- 새 `sections/PaddingFields.tsx` (Layout 절, `fieldset.properties-aria.layout-padding` + legend 「Padding」 (Gap legend 와 같은 18) 안에 `fieldset-row` — 펼침 버튼은 늘 첫 줄 아이콘 칸 `actions-padding`). 가로 · 세로 = 두 변 한 편집 (`updateStylesImmediate` 한 step). 아이콘 칸 라벨 (`labelMode="icon"`): ↔ `MoveHorizontal` · ↕ `MoveVertical` · 변 `Panel{Left,Top,Right,Bottom}` · 펼침 `SquareDashed`. i18n 7 키 (`styles.layout.padding*`).
- `StylesPanel` Layout 탭에서 `SpacingSection` 제거. `SpacingSection.tsx` · `BoxModelEditor.{tsx,css}` · `spacingBoxModelCommit.test.tsx` 파일은 삭제 승인 대기로 남겨 둠 (렌더 경로 0). `--inspector-diagram-height` 는 Position pin 상자만 쓴다.
- 원복 RED 2: 가로 칸이 두 변을 쓰지 않으면 · 두 변이 달라도 펼치지 않으면 (`PaddingFields.test.tsx`). `DesignPanel.test` 의 Layout 탭 표지를 Spacing → Position 으로.
- live (Desktop): Padding 줄 = Gap 아래 8 · 칸 87 × 28 · 펼침 버튼 x = Layout 아이콘 칸 · 펼침 → 2 줄 (Left · Top / Right · Bottom) · Left 10 → 접으면 가로 Mixed · 가로 0 으로 복원 · Spacing 절 없음 (`layout · transform · position`).
