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

## 4. 사용자 결정 — 확정 2026-10-19

| 결정                      | 답                                                           | 적용 Phase |
| ------------------------- | ------------------------------------------------------------ | ---------- |
| 1 옛 문서 placement       | contract 42 · 전부 거부 (「모두 거부해도 상관없다」)         | 2          |
| 2 가운데 축 margin 칸     | Figma · Framer 방식 — 그 축 margin 칸 잠금 (`auto · Center`) | 4          |
| 3 relative Right · Bottom | 비활성 (「비활성이 사용자 혼란을 막지 않을까」)              | 4          |

- **Phase 4 Spacing 절 연동** (결정 2):
  - `SpacingSection.tsx` 는 선택 노드의 제약을 읽어, 가운데 축의 margin 두 칸을 잠금 표시한다 (값 `auto`, 안내 「Center — Position 에서 변경」).
  - margin 쓰기 명령도 같은 조건에서 거부한다. 패널만 막고 명령은 열어 두지 않는다 — Canvas spacing 손잡이 · 붙여넣기 스타일 경로가 같은 명령을 쓰기 때문이다.
