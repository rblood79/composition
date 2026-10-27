# ADR-275: Position 절 — Figma 규칙 + Framer 칸 배치, 저장은 layout inset

## Status

Implemented — 2026-10-27 (사용자 Builder 확인 「adr도 모두 확인은 했다」 — G6 사용자 패널 확인 통과) · Accepted — 2026-10-19 (사용자 `/execute-adr 275` + 리뷰 round 1 종결 — pending 0 · HIGH 전부 fixed)

> **2026-10-27 현재 코드 대조** (사용자 「adr 275 ~ 283 도 체크해」 — 아래 본문은 그때의 결정 기록이고, 뒤 커밋 · ADR 로 바뀐 사실은 여기가 정본):
>
> - G5 ratchet: A 등급 상한 올림 `1526e969a` (9 건, 사용자 승인 · 만료 2027-04-20) · `45aba38aa` (select get root). 번들 측정 기록은 없다. ratchet 은 `219c1a3dc` (2026-10-24) 뒤 push 에서 기본으로 돌지 않는다 — 수동 `pnpm gate:perf-ratchet` 또는 `PERF_RATCHET=1 git push`. 본문의 「pre-push ratchet」 은 이 뜻으로 읽는다.
> - Position 모드 4 (Relative · Absolute · Sticky · Fixed) 는 전부 저작 가능하다 (사용자 결정 5 · 6 — Phase 6 · 7). 비활성은 rule 이 놓은 부품뿐 (`TransformSection.tsx` `disabledValues = rulePlaced ? […] : []`). 「Sticky · Fixed 는 비활성 표시만」 · 「ADR-267 결정 1 유지」 는 Phase 6 · 7 전의 기록.
> - 판정 술어는 넷이다 — `catalogIsOutOfFlow` · `catalogIsAuthoredAbsolute` + Phase 7 의 `catalogIsAuthoredFixed` · `catalogIsAuthoredPlaced` (`runtime/positioning.ts`).
> - Spacing 절은 결정 10 으로 제거됐다 (`SpacingSection` · `BoxModelEditor` · 테스트 — 사용자 승인 뒤 `d216be0d8`). 가운데 축 margin 잠금은 명령 거부로만 남는다 (`catalogStylesHost.ts`).
> - 사용자 확인 2026-10-27 「adr도 모두 확인은 했다」 → Implemented (G6 사용자 패널 확인).

> **Phase 0 종결 2026-10-19 (G0 go)**: A4 `unsafe center` 가 Chromium 156 · WebKit 27.2 에서 27 / 27 가운데 (부모 block · flex · grid × Fixed · Hug · Hug padding 12 · border 2 · 넘침 Fixed · 넘침 Hug · 넘침 + 오프셋 · 부모 padding · `%` 오프셋). 대조군 `safe center` 는 넘침 9 건이 x = 0 (containing block 안으로) — fixture 가 두 정렬을 구별한다. 소비자 실측 src 24 (작성일 17, 1.4 배 — 추가 7: `clone.ts` · `fillLayout.ts` · `aiHost.ts` · `shortcuts.ts` 정렬 · 분배 · `styleDirty.ts` · `domBinding` 3 줄 · `catalogStylesHost` 4 줄) — breakdown §5.
>
> **Phase 1 종결 2026-10-19 (G1)**: 엔진이 absolute 자기 정렬을 읽는다 (`parse_abs_self_align` · `resolve_abs_axis` ④) · 늘이기 제외 판정 (`size_fixed_*` = 명시 길이 ∨ 키워드 ∨ 자기 정렬) 과 padding · border 가산 판정 (`has_*`) 분리 · 양쪽 margin auto 음수 여유는 가로 시작 0 / 세로 반씩. Chrome oracle `absoluteSelfAlign` 19 / 19 · Rust 538 · 판정 하나로 합친 변이 → RED (60 · x 170, 리뷰 예측 그대로) · parity 868 PASS (실패 1 = `adr248CatalogGeometryDelta` case 2 `subtreeNodeVisits` — HEAD 엔진에서도 같은 실패, 이번 변경 무관).

> **Phase 2 종결 2026-10-19 (G2)**: 노드 `placement` 삭제 — 타입 · 검증 · `setNodePlacement` op · 소비자 src 24 파일. 저작 absolute = `layout.position` + `inset*` (+ `unsafe center`). 술어 둘 (`runtime/positioning.ts` — `catalogIsOutOfFlow` · `catalogIsAuthoredAbsolute`). contract 41 → 42. 정적 게이트 `nodePlacementRemoved` (원복 RED) · Canvas ↔ DOM parity 8 제약 = 손계산 0 px (DOM position 직렬화 원복 → 8 RED) · rule 부품 (ListBoxItem icon) = 바깥 흐름 ∧ 저작 아님. Position 토글 Off 는 `position` 만 지우고 inset 은 남긴다 (기존 TransformSection 계약).
>
> **Phase 3 종결 2026-10-19**: Canvas drag · resize · 정렬 · 분배 · Alt 복사 · 붙여넣기가 제약을 지켜 inset 을 쓴다 (`catalogRuntime/positionConstraint.ts` — 읽기 §2 · 쓰기 `%` 단위 유지 · 버리는 변은 desktop remove / breakpoint mask). 늘인 축의 resize 는 폭을 쓰지 않는다. 진행 중 엔진 결함 1 발견 · 수리: in-flow 자식 없는 auto 크기 부모 (부모 block · flex 가 크기를 정함) 의 absolute 자식이 containing block 0 기준으로 놓였다 (Right 30 → x −90, Chrome 310) — `resettle_leaf_absolutes` (Chrome oracle 2 · 원복 RED 2 · Rust 1).

> **Phase 4 종결 2026-10-20 (G3)**: Position 절 혼합 방식 — Relative · Absolute (Sticky · Fixed 비활성) · pin 상자 (변 4 + 가운데 2, RAC `ToggleButton`) · 변 옆 T · R · B · L 칸 (`px` · `%`, pin 안 된 칸은 점선 `auto`) · Center X · Center Y · Fill · 결과 문장. 명령 `catalogPositionChangeCommand` (바꿔도 그 자리 · 빈 칸 입력 = 그 변으로 · Left+Right 는 폭 auto, 해제 시 그린 폭 고정 · Relative 진입 때 남은 inset 정리). 가운데 축 margin 잠금 (Spacing 칸 + 명령 거부, 사용자 결정 2). unit G3 7 · 제약 20 · TransformSection 10.
>
> **Phase 5 live 2026-10-20 (G4)**: 실제 builder (Chrome MCP, dev 5173, 새 프로젝트 `adr275-live`) — 아래 Live Exercise. G5 (ratchet · 번들) — ratchet 은 커밋 뒤 실행해 A 등급 상한을 올렸다 (`1526e969a` 9 건 · `45aba38aa`, 사용자 승인 · 만료 2027-04-20), 번들 측정 기록은 없다. G6 (사용자 패널 확인) 대기.

> **Phase 6 종결 2026-10-20 (사용자 결정 5 — sticky 허용)**: 노드 `layout.position` 이 `sticky` 를 받는다 (검증 · contract 42 그대로 — 추가만이라 옛 문서 무변경). Position 절 Sticky 버튼 활성 — 네 칸이 각자 「스크롤할 때 붙는 거리」 (빈 칸 = auto), pin 상자 · 가운데 비활성, 진입 때 Top 0 + 지난 absolute inset · `unsafe center` 정리. DOM 은 `position: sticky` + inset, Canvas 는 ADR-267 constraints 그대로 + **positioned layer** (z-index 없는 sticky 상자는 흐름 형제 위에 그린다 — CSS 2 부록 E). live 에서 결함 1 발견 · 수리: sticky (· z-index) 로 바뀐 상자가 제자리에만 재기록돼 항목 아래 그려졌다 → 그리기 층이 바뀌면 다시 묶는다 (`paint-order`). Fixed 는 그대로 비활성 (ADR-267 결정 1 · 2). 원복 RED 6 · unit 신규 10.

> **Phase 7 종결 2026-10-20 (사용자 결정 6 — fixed 허용 · viewport = page body 영역)**: 노드 `layout.position` 이 `fixed` 를 받는다 (contract 42 그대로). viewport = page root 의 border-box 원점 + breakpoint 화면 크기 (page 가 저작 높이로 길어도 스크롤 0 의 화면 하나 — Preview iframe 과 같다). 엔진은 정상 배치 뒤 fixed 상자를 viewport 기준으로 다시 놓는다 (`place_fixed_boxes` — 흐름 부모 ≠ containing block 일반형 `place_absolutes_in` 의 viewport 모드). Canvas 는 fixed 상자를 그 page 층에서 그린다 — 조상의 clip · 스크롤 밖, 그 상자를 담은 page 자식 바로 뒤 (트리 순서), page 스크롤만큼 되돌려 화면에 고정 (`unscrollOwnerId`). 패널 Fixed 버튼 활성 (Absolute 의 pin · 칸 그대로, 결과 문장 「In the screen」), 명령 · Canvas 끌기의 기준 상자 = viewport (`catalogPlacementFrame` · `viewportOf`). Chrome oracle 5 (390 × 844 iframe) · Rust 1 · 원복 RED 10. live 에서 결함 1 수리: breakpoint 층의 Left+Right 가 폭을 `mask` 로 지워 문서가 거부했다 (`SIZING_MASK_FORBIDDEN` — Absolute 에도 같던 Phase 4 결함) → `set null`.

- 사용자 요청: `/create-adr 혼합방식 으로 position 설계` (2026-10-19)
- 방향을 정한 사용자 원문 (같은 세션, 시안 캔버스 `Position 절 시안` 위에서):
  - 「pin to parent 는 Flamer,Figma 모두 12시,3시,6시,9시 방향 만 선택하게한다 (top,right,bottom,left)」
  - 가운데 표현 질문에 「1」 — 가운데는 Figma 십자선처럼 **별도 선택**
  - 「ux는 figma 중심에 framer방식을 차용 하는것이고 ui는 사용하기편한 디자인으로 보여줘」
  - 「Right 로 바꾸는 쪽으로 고쳐줘」 — 빈 칸에 입력하면 그 변으로 **바꾼다** (반대 변을 푼다)
- 사용자가 이미 답한 확인 항목 (create-adr 질문, 2026-10-19):
  - 저장 모델 = **layout inset 으로 통일** (`placement` 삭제)
  - 가운데 저장 = **양쪽 inset + margin auto** → 사용자 결정 4 (아래) 로 **대체됨** — 이 표현은 넘칠 때 가운데를 지키지 못한다
- 사용자 결정 3건 답 (2026-10-19, 아래 Decision 「사용자 결정 3건 — 확정」): 1 전부 거부 · 2 Figma · Framer 방식 · 3 relative Right · Bottom 비활성
- 리뷰 round 1 (codex, 2026-10-19 — HIGH 2 · MEDIUM 1) 반영: F13 ~ F15 · Decision 1 · 2 · 6 · R1 · R2 · R8 · G0 ~ G2
- 사용자 결정 4 (2026-10-19): 「figma,framer 처럼 가운데」 — 부모보다 넓어도 가운데. 그래서 가운데 표현을 A1 (margin auto) 에서 **A4 (absolute 자기 정렬 `unsafe center`)** 로 바꿨다. Framer 근거: `centerX` = 레이어 중심의 부모 대비 % (개발자 문서 — 데이터 모델 기준, 출력 CSS 는 미확인)
- 시안: 혼합 방식 보드 H-A ~ H-E (pin top·left · 가로 늘이기 · 가운데 · 빈 칸 입력 · relative) + 컴포넌트 `HybridPanel`

## Context

**Domain**: D3 (시각 스타일) — 위치는 Canvas (엔진 + Skia) 와 Preview/Publish (DOM + CSS) 가 같은 값 (`position` · `inset*` · `margin`) 에서 같은 상자를 내야 하는 대칭 문제다. D1 은 건드리지 않는다 (RAC DOM 그대로). D2 도 아니다 — 컴포넌트 prop 이 아니라 모든 노드의 layout 필드다. 패널 UI 는 Builder 표면이라 SSOT 경계 밖이다.

### 문제

1. **패널이 표현하는 것과 문서가 저장하는 것이 다르다.** Position 절은 Left · Top 입력이 단위 `px · % · vw` 를 내보이지만 (`TransformSection.tsx` Position 행), 쓰기 명령은 px 가 아니면 거부한다 (`catalogRuntime/position.ts` `catalogPlacementEditCommand` → `cssPx` → `CatalogStyleValueError`).
2. **오른쪽 · 아래 기준, 늘이기, 가운데, breakpoint 별 위치를 저장할 곳이 없다.** 저장 형식은 `NodePlacement { kind: "absolute"; x; y }` 하나다 (px, 부모 padding box 기준).
3. **위치 경로가 둘이다.** 저작 absolute 는 `node.placement`, 규칙이 놓는 sub-part 는 `layout.position` + `inset*` 이다 (`compositionRoot.ts:1294` 주석). 노드 layout 쪽은 검증 · breakpoint · 엔진이 이미 다 받는다.

### 코드 사실 (2026-10-19 실측)

| #   | 사실                                                                                                                                                                                                                                                                | 위치                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| F1  | `NodePlacement` = `kind · x · y` (px) · `NodeEntry.placement?`                                                                                                                                                                                                      | `packages/shared/src/catalog/document/types.ts:391` · `:770`                                                     |
| F2  | breakpoint 층 `NodeResponsiveLayer` = `visual · layout · sizing · fillSizing` — placement 없음                                                                                                                                                                      | `types.ts:532`                                                                                                   |
| F3  | 노드 layout 검증: `position` = `static · relative · absolute` · `insetLeft/Top/Right/Bottom` = 길이 또는 `%` · `margin*` = 길이 또는 `auto`                                                                                                                         | `document/validation.ts:199-207` · `:216-219`                                                                    |
| F4  | 노드 placement 검증                                                                                                                                                                                                                                                 | `validation.ts:1272`                                                                                             |
| F5  | 엔진 입력: `layout.position` 은 placement 가 **없을 때만** 쓰고, placement 는 `insetLeft = x px` 로 바꾼다                                                                                                                                                          | `runtime/compositionRoot.ts:1294-1301` · `:1085`                                                                 |
| F6  | DOM: placement → `position:absolute; left; top`                                                                                                                                                                                                                     | `runtime/domBinding.runtime.ts:2643-2648`                                                                        |
| F7  | Canvas drag 가 placement 를 쓴다 · 붙여넣기 · 컴포넌트 명령도 placement 를 만든다                                                                                                                                                                                   | `catalogRuntime/canvasGesture.ts:1333` · `commands/structure.ts:1296-1305` · `commands/components.ts:216`        |
| F8  | 노드 placement 를 읽는 src 파일 **17** · 테스트 파일 **6** (transaction `setNodePlacement` · resolver · fieldSource · boxModel · presence · canvasSpacing · gridAutoRows · CatalogGridTrackLayer · catalogStylesHost · effectiveStyle …)                            | `grep NodePlacement\|node.placement\|record.placement\|setNodePlacement`                                         |
| F9  | 엔진 absolute 축: 양쪽 inset + auto 크기 = 늘이기 · 명시 크기 + 양쪽 margin auto = 가운데 (`absolute_margin_auto_centers`)                                                                                                                                          | `packages/engine/src/tree.rs:7422-7462` `resolve_abs_axis` · 테스트 `:11611`                                     |
| F10 | **명시 크기 판정이 `fit-content` 를 크기로 보지 않는다** — `has_w = resolve_dimension_opt(width)` 이고 이 함수는 음수를 `None` 으로 버리는데 `fit-content` 는 센티넬 `-2` 다. 그래서 Hug (`fit-content`) 상자에 양쪽 inset 을 주면 가운데가 아니라 늘어난다         | `tree.rs:2818` · `:7359-7368` · `style.rs:26`                                                                    |
| F11 | `LIBRARY_CONTRACT_VERSION = 41`                                                                                                                                                                                                                                     | `types.ts:111`                                                                                                   |
| F12 | 방향키는 Reorder 다 (위치 이동 없음) · absolute drag 는 macOS Ctrl                                                                                                                                                                                                  | `catalogRuntime/shortcuts.ts:465-501` · `CatalogCanvas.tsx:1342`                                                 |
| F13 | (리뷰 r1 H1) 양쪽 margin auto 의 여유가 **음수** 일 때 엔진은 `free / 2` (음수 margin) 로 가운데에 놓는다. CSS 는 가로 축에서 시작 margin 을 0 으로 두어 왼쪽 inset 에 붙인다 (CSS 2 §10.3.7 · css-position-3 §4.2). 부모 100 · 자식 200 → 엔진 x = −50 · CSS x = 0 | `tree.rs:7459-7469`                                                                                              |
| F14 | (리뷰 r1 H2) `has_w` · `has_h` 는 두 뜻으로 쓰인다 — ① stretch 제외 (`resolve_abs_axis` 의 `has_explicit_size`) ② solve 반환이 content-box 라 padding · border 를 더할지 (컨테이너) / leaf layout 을 읽을지. `fit-content` 컨테이너의 solve 반환은 content-box 다   | `tree.rs:2838-2851` · `:2899-2905` · `:2153-2163` · `:2503-2512`                                                 |
| F15 | (리뷰 r1 M1) resolved `layout` 은 rule (definition · part) 값과 저작 값을 합친 것이다. 저작 값만 모은 `authoredLayout` 이 따로 있다. rule 이 `position: absolute` 를 주는 부품 (ListBoxItem icon) 은 저작 placement 가 없어 Canvas 이동을 거부한다                  | `resolution/resolver.ts:1203-1211` · `:1339` · `document/manualBoxRules.ts:980-990` · `canvasGesture.ts:482-505` |
| F16 | (사용자 결정 4 · A4) 엔진 absolute 배치는 `justify-self` · `align-self` 를 읽지 않는다 · 노드 layout 검증의 정렬 키워드에 `unsafe` 접두가 없다                                                                                                                      | `tree.rs` `place_absolute_children` (`:2722` ~) · `document/validation.ts:160` `alignKeywords`                   |

F10 의 CSS 쪽 근거는 이렇다. CSS 2.1 §10.3.7 의 늘이기는 `width: auto` 일 때만이다. `fit-content` 는 auto 가 아니라서 크기가 먼저 정해지고, 남는 공간은 auto margin 이 나눈다. Chrome 결과는 Phase 0 oracle 로 확정한다.

### 외부 근거 (같은 세션 `/deep-research` — Figma Plugin API · Framer 문서)

- **Figma**
  - 축마다 constraint `MIN · MAX · CENTER · STRETCH · SCALE` 중 하나다. 축은 비지 않는다.
  - pin 위젯은 4 변 + 가운데 십자선이다.
  - auto layout 안에서는 `layoutPositioning: ABSOLUTE` ("Ignore auto layout") 일 때만 constraint 가 적용된다.
  - Plugin API 기본값 ≠ UI 기본값이라, UI 동작은 help 문서로 확인했다 (메모리 `feedback-figma-plugin-api-default-is-not-ui-default`).
- **Framer**
  - `position: relative · absolute · fixed · sticky` 가 있고, pin 은 relative 가 아닐 때만 적용된다.
  - 한 축에 pin 이 없으면 `centerX` / `centerY` % 로 가운데에 놓인다.
  - offset 입력은 변 옆에 있다.
- **혼합 방식이 각각에서 가져온 것**
  - Figma: 축이 비지 않는 규칙, 가운데의 직접 선택.
  - Framer: 변 옆 입력, relative 에서 pin 비활성.

### 선행 결정과의 관계

- **ADR-026** 은 Figma 제약 전용 레이어를 기각했다 (대안 A, HIGH 2). 이 ADR 은 레이어를 만들지 않는다. 제약은 **어느 inset 이 있는가** 에서 읽어 내는 보기이고, 저장은 CSS 그대로다. ADR-026 의 결정은 유지된다.
- **ADR-267 결정 1** (sticky · fixed 저작 허용 안 함) · **ADR-164** (fixed 의도적 미지원) 은 사용자 결정 5 · 6 (Phase 6 · 7) 로 닫혔다 — sticky · fixed 둘 다 저작한다. 패널이 비활성으로 두는 것은 rule 이 놓은 부품뿐이다.
- **ADR-224** (Fill sizing) 와는 늘이기의 폭 처리 (아래 Decision 4) 에서 만난다.

### 제약

- **Hard**:
  - Canvas ↔ Preview 상자 일치 (`/cross-check`).
  - 엔진 입력의 직렬화기는 `styleOf` 하나다 · TS 에서 absolute 배치 보정 재도입 금지 (`.claude/rules/layout-engine.md` §position:absolute).
  - drag 60Hz floor · ratchet (`pnpm gate:perf-ratchet` — 수동 실행, push 는 `PERF_RATCHET=1` 일 때만 · `219c1a3dc`).
  - initial 번들 Builder ≤ 1,390,000 B gzip (ADR-201 재승인).
- **Soft**:
  - 개발 단계라 옛 문서 전환 코드를 넣지 않는다 (사용자 지시 2026-10-14).
  - 패널 폭 280 안에서 칸 배치를 끝낸다 (시안 실측).

## Alternatives Considered

### 대안 A: layout inset 통일 — `placement` 삭제 (사용자 선택)

- **설명**: 저작 absolute 도 sub-part 와 같은 `layout.position` + `inset*` (+ 가운데는 `margin*: auto`) 으로 저장한다. `placement` 타입 · 검증 · transaction op · 소비자를 지우고, 바깥 흐름 판정은 `layout.position === "absolute"` 술어 하나로 모은다.
  - 제약 (Left / Right / Left+Right / Center) 은 저장하지 않는다. 있는 inset 에서 읽어 낸다.
  - breakpoint 별 위치와 `%` 는 기존 layout 쓰기 경로가 이미 처리한다 (F2 · F3).
- **위험**: 기술 MEDIUM (F10 엔진 결함 · 17 파일 소비자 교체) / 성능 LOW (drag 명령 수 불변) / 유지보수 LOW (경로 하나로 줄어듦) / 마이그레이션 MEDIUM (옛 문서의 placement 는 전환 없이 무효 — 개발 단계 정책)

### 대안 B: `placement` 넓히기

- **설명**: `placement` 에 `pins: {top,right,bottom,left}` · `center: {x,y}` · 값 · 단위를 더한다. 소비자는 그대로 두고 해석만 바꾼다.
- **위험**: 기술 LOW / 성능 LOW / 유지보수 **HIGH** (위치 경로 둘 유지 + breakpoint 층 (F2) · `%` 검증 · 엔진 직렬화 · DOM 직렬화를 placement 용으로 따로 만들어야 함) / 마이그레이션 LOW

### 대안 C: Figma 제약 필드를 저장하고 CSS 로 매핑

- **설명**: 노드에 `constraints: { horizontal: "left"|"right"|"leftRight"|"center"|"scale", vertical: … }` 를 저장하고, 두 소비자가 CSS 로 바꾼다.
- **위험**: 기술 **HIGH** (scale 은 CSS 대응이 없다 · 두 소비자 각자 매핑) / 성능 LOW / 유지보수 **HIGH** (ADR-026 대안 A 의 기각 사유와 같다 — CSS 와 다른 어휘 층) / 마이그레이션 MEDIUM

### 가운데 표현 (대안 A 안의 하위 선택)

| 안                                                                                                   | 내용                                                                                    | 위험                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1 양쪽 inset + margin auto (처음 사용자 선택 → 결정 4 로 대체)                                      | `insetLeft = o` · `insetRight = −o` · `marginLeft/Right = auto` (o = 오프셋)            | 넘치면 가로가 왼쪽에 붙는다 (F13 — CSS 2 §10.3.7) · Hug 는 `fit-content` 쓰기 + F10 수리 필요 · margin 칸 점유 (HIGH — 결정 4 위반)                                                                                                  |
| A2 `left: 50%` + `translate: −50%`                                                                   | 오프셋 = `calc(50% + o)`                                                                | translate 는 paint-only 라 엔진 상자 ≠ 보이는 상자 → hit · snap · 선택 상자가 어긋남 (HIGH) · 사용자 transform 과 충돌                                                                                                               |
| A3 새 키 `centerX` / `centerY`                                                                       | 가운데를 별도 필드로                                                                    | CSS 밖 어휘 → 두 소비자 매핑 (대안 C 와 같은 문제, HIGH)                                                                                                                                                                             |
| **A4 inset + `justifySelf` / `alignSelf: unsafe center`** (css-align-3 의 absolute 상자 정렬 — 채택) | `insetLeft = o` · `insetRight = −o` · `justifySelf: unsafe center` (세로는 `alignSelf`) | 넘쳐도 가운데 (`unsafe`) · auto 크기는 정렬이 stretch 가 아니면 fit-content 라 Hug 그대로 · margin 칸 비점유. 대신 엔진이 absolute 자기 정렬을 읽지 않는다 (구현 필요) · Chrome · WebKit 지원은 측정 선행 (Phase 0 go/no-go, C 등급) |

A1 의 넘침 (리뷰 r1 H1 · F13): 자식이 부모보다 넓으면 CSS 에서 가로는 왼쪽 inset 에 붙는다. Figma · Framer 는 넘쳐도 가운데이고, 사용자가 그쪽을 골랐다 (결정 4). 그래서 A4 를 채택한다. A4 가 Phase 0 go/no-go 에서 떨어지면 (Chrome 또는 WebKit 이 absolute 자기 정렬을 다르게 그림) 대체안은 A5 다 — Fixed 폭만 `insetLeft: calc(50% − w/2 + o)` 로 넘침 가운데를 지키고, Hug 는 A1 로 둔다. 이 경우 Hug 의 넘침은 Figma 와 다르므로 사용자에게 보고한다.

### Risk Threshold Check

| 대안 | HIGH+                                                                | 판정                                                                              |
| ---- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| A    | 없음 (A4 의 HIGH 는 Phase 0 go/no-go · Phase 1 엔진 구현으로 닫는다) | 채택 가능 — absolute 자기 정렬 · F10 은 CSS 표준 의미론이라 엔진 구현이 기본 경로 |
| B    | 유지보수 1                                                           | 회피 대안 = A (경로 하나)                                                         |
| C    | 기술 1 · 유지보수 1                                                  | ADR-026 기각 사유 재현 — 기각                                                     |

루프 1회로 A 가 HIGH 0 이다.

## Decision

**대안 A + 가운데 A4** 를 택한다 (가운데는 사용자 결정 4 로 A1 에서 바뀜). 저장은 CSS inset 그대로 두고, 패널은 Figma 규칙을 따르되 칸 배치는 Framer 를 빌린다.

1. **저장** — 저작 absolute = `layout.position: "absolute"` + `inset*`.
   - `placement` 는 타입 · 검증 · `setNodePlacement` op · 소비자에서 지운다.
   - 판정은 **술어** 로 나눈다 — 둘로 시작해 Phase 7 의 fixed 술어 둘 (`catalogIsAuthoredFixed` · `catalogIsAuthoredPlaced`) 을 더해 넷 (리뷰 r1 M1 · F15). 지금은 `placement?.kind === "absolute"` 가 F8 의 여러 파일에 흩어져 있고, 이 한 조건이 두 뜻을 같이 졌다.
     - **바깥 흐름** (`isOutOfFlow`) = resolved `layout.position === "absolute"`. 흐름 표면이 쓴다 (grid auto 행 · spacing 손잡이 · track 레이어 · 흐름 drop).
     - **저작 위치** (`isAuthoredAbsolute`) = `authoredLayout.position === "absolute"`. 편집 표면이 쓴다 (Canvas 이동 · Position 절 · 붙여넣기 위치).
     - rule 이 놓은 부품 (바깥 흐름 ∧ 저작 아님) 은 지금처럼 Canvas 이동을 거부한다.
   - 쓰기는 기존 layout 쓰기 경로라 현재 breakpoint 층에 들어간다.
2. **제약 ↔ CSS 대응** (축마다, 세로도 같음)

   | 패널 제약  | 저장                                                                                  |
   | ---------- | ------------------------------------------------------------------------------------- |
   | Left       | `insetLeft = v` · `insetRight` 없음                                                   |
   | Right      | `insetRight = v` · `insetLeft` 없음                                                   |
   | Left+Right | `insetLeft` · `insetRight` 둘 다 · 폭 = auto (늘이기)                                 |
   | Center     | `insetLeft = o` · `insetRight = −o` · `justifySelf: unsafe center` (세로 `alignSelf`) |

   가운데 판정 = `justifySelf` (세로 `alignSelf`) 가 `unsafe center` ∧ 양쪽 inset 있음 ∧ `left = −right`. 축이 비면 Left / Top 으로 읽는다.

   **가운데의 넘침 계약** (리뷰 r1 H1 · 사용자 결정 4): 자식이 부모보다 넓어도 가운데 — Figma · Framer 와 같다. `unsafe` 는 넘칠 때 시작 쪽으로 물러나지 않게 한다 (css-align-3 overflow alignment). Hug 는 정렬이 stretch 가 아니므로 CSS 가 auto 크기를 fit-content 로 풀어 따로 `fit-content` 를 쓰지 않는다.

3. **패널 UX (혼합 방식)**
   - **position**: Relative · Absolute · Sticky · Fixed 글자 버튼 (Sticky · Fixed 는 사용자 결정 5 · 6 — Phase 6 · 7 에서 활성). rule 이 놓은 부품은 넷 다 비활성.
   - **pin**: 4 변 + 축마다 가운데 십자선.
     - 가운데를 켜면 그 축의 변 pin 이 풀린다.
     - 축은 비지 않는다 — 마지막 pin 을 풀면 Left / Top 으로 돌아간다. 요소가 저절로 가운데로 가지 않는다.
   - **칸 배치**: T · R · B · L 칸이 pin 상자의 같은 변 옆에 붙는다.
     - pin 안 된 칸은 점선 테두리와 `auto` 로 보인다.
     - 그 칸에 값을 넣으면 그 변으로 **바뀐다** — 반대 변은 풀린다 (사용자 결정 「Right 로 바꾸는 쪽」).
     - 늘이기는 칸이 아니라 pin 상자에서만 한다 — 양쪽 선을 누르거나 `Fill`.
   - **Fill** (네 변 0): 절 오른쪽 아이콘 칸 (Layout · Spacing 과 같은 열) 의 버튼 하나. 가운데는 pin 상자의 십자선이 한다 — 사용자 결정 7.
   - **결과 문장**: 칸 아래 한 줄로 지금 제약의 뜻을 보여 준다. 입력 중에는 입력한 뒤의 결과를 미리 보여 준다.
   - **단위**: 칸마다 `px` · `%` (F3 이 이미 받는다).
   - **relative**: Left · Top 만 오프셋으로 쓰고, Right · Bottom 칸과 pin 상자는 비활성 (결정 3).
   - **바꿔도 그 자리에** (Figma 와 같음): pin 이나 가운데를 바꿀 때 지금 보이는 상자 위치에서 새 inset 을 계산해 쓴다.
4. **늘이기의 폭** — Left+Right 로 바꾸면 그 축의 Fixed 폭을 지워 auto 로 둔다. 그대로 두면 CSS 가 over-constrained 로 오른쪽 값을 버린다. 가운데로 바꿀 때는 폭을 건드리지 않는다 — A4 의 자기 정렬이 auto 를 fit-content 로 푼다. 가운데를 풀 때 `justifySelf` / `alignSelf` 를 지운다.
5. **Canvas drag** — absolute 노드를 끌면 제약을 지킨다.
   - Right 기준이면 `insetRight` 를 바꾼다.
   - 가운데면 오프셋을 바꾼다.
   - 늘이기면 양쪽을 같은 양만큼 바꾼다.
   - `%` 칸은 containing block 비율로 바꿔 단위를 유지한다.
6. **엔진 (A4 · F10 · F13 · F14)** — CSS 표준 의미론이므로 엔진에서 구현 · 수리한다. TS 보정은 금지다.
   - **absolute 자기 정렬 구현** (A4): 양쪽 inset 이 있고 `justify-self` (가로) · `align-self` (세로) 가 `normal` · `stretch` · `auto` 가 아니면, auto 크기는 fit-content 로 풀고 inset 이 만든 영역 안에 정렬한다. `unsafe center` 는 음수 여유도 반으로 나눈다. 값이 없으면 지금 동작 그대로 (stretch).
   - **stretch 제외와 상자 기준을 나눈다** (리뷰 r1 H2). 새 판정 「크기가 정해졌는가」 = 명시 길이 ∨ `fit-content` · `min-content` · `max-content` ∨ (A4) 자기 정렬이 stretch 아님. 이 판정은 `resolve_abs_axis` 의 stretch 제외와 늘이기 재solve 판정 (`stretch_w` · `stretch_h`) 에만 쓴다.
   - padding · border 를 더할지 / leaf layout 을 읽을지는 지금처럼 **명시 길이** 기준이다. 키워드 크기의 solve 반환은 content-box 이므로 border-box 로 복원한 값이 used 크기다.
   - 음수 여유의 margin auto 는 가로 축에서 시작 margin 0 (LTR — 엔진은 `direction` 미지원), 세로 축은 같은 값으로 나눈다 (F13 — Chrome oracle 로 축마다 확정). 가운데 경로에서는 빠졌지만 같은 함수의 CSS 불일치라 함께 맞춘다.

**위험 수용 근거**:

- 대안 A 의 잔존 위험은 둘이다. 소비자 교체는 정적 게이트로 0 을 확인하고, F10 은 Chrome oracle 로 닫는다. 둘 다 Gate 로 막는다.
- 옛 문서 손실은 개발 단계 정책 (전환 코드 금지) 안의 일이다. 사용자가 전부 거부를 수용했다 (결정 1).

**기각 사유**:

- **B**: 위치 경로 둘을 영구히 유지하고, breakpoint · `%` · 두 직렬화를 placement 용으로 새로 만들어야 한다. 이미 있는 layout 경로를 두고 같은 것을 하나 더 만드는 일이다.
- **C**: CSS 밖 어휘 층이다. ADR-026 이 같은 사유로 기각했고, scale 은 CSS 대응이 없다.
- **A2**: translate 가 paint-only (`PAINT_ONLY_VISUAL_KEYS` 의 transform 계열) 라서 엔진 상자와 보이는 상자가 갈린다. 그러면 hit · snap · 선택 상자가 어긋난다.
- **A3**: 대안 C 와 같은 매핑 문제다.

> 구현 상세: [275-position-section-figma-rules-framer-fields-layout-insets-breakdown.md](../design/275-position-section-figma-rules-framer-fields-layout-insets-breakdown.md)

### 사용자 결정 3건 — 확정 2026-10-19

1. **옛 문서의 `placement`** → `LIBRARY_CONTRACT_VERSION` 41 → 42. 옛 개발용 프로젝트는 전부 거부한다 (ADR-251 선례). 사용자 원문: 「모두 거부해도 상관없다」.
2. **가운데 축의 margin 칸** → Figma · Framer 방식. 사용자 원문: 「figma,framer 방식을 따르겠다」.
   - 두 도구에는 위치가 지정된 레이어의 margin 이 없다. 위치는 Position 절 (제약 + 오프셋) 에서만 바꾼다.
   - 그래서 가운데 축의 Spacing margin 칸은 `Center` 로 잠그고 (값 0) 편집을 받지 않는다. 옮기려면 Position 절의 오프셋을 바꾸고, 가운데를 풀려면 pin 을 바꾼다.
   - 가운데가 아닌 축의 margin 은 종전대로 편집할 수 있다.
3. **relative 의 Right · Bottom** → 비활성 (시안 그대로). 사용자 원문: 「비활성이 사용자 혼란을 막지 않을까」.
   - 근거를 바로잡아 적는다. CSS 에서 relative 의 `right` 는 동작한다 (`right: 10px` = 왼쪽으로 10 이동). 다만 `left` 와 같이 있으면 `left` 가 이기고, 동작해도 `left` 의 부호만 바꾼 것과 같다.
   - 축당 칸 하나 (Left · Top) 로 같은 표현을 다 할 수 있으므로, 둘째 칸을 열어 두면 「어느 칸이 이기나」 라는 혼란만 남는다.

### 사용자 결정 4 — 확정 2026-10-19

4. **가운데 상자가 부모보다 넓을 때** → **넘쳐도 가운데** (Figma · Framer 와 같음). 사용자 원문: 「figma,framer 처럼 가운데」.
   - 그래서 가운데 표현을 A1 에서 A4 로 바꿨다 (위 「가운데 표현」 표). 처음의 「양쪽 inset + margin auto」 선택은 이 결정으로 대체됐다.
   - 결정 2 (가운데 축 margin 칸 잠금) 는 그대로 둔다. A4 는 margin 을 쓰지 않지만, margin 은 정렬되는 상자 크기에 들어가 가운데를 밀어낸다. Figma · Framer 처럼 위치는 Position 절에서만 바꾼다.

### 사용자 결정 5 — 확정 2026-10-20

5. **Sticky 허용** → ADR-267 사용자 결정 1 (「허용 안 함」, 2026-10-17) 을 sticky 에 한해 뒤집는다. 사용자 원문: 「sticky 허용으로 진행해」.
   - 엔진 · Canvas 는 ADR-267 에서 이미 sticky 를 그린다 (rule 부품만 쓰던 경로). 남은 일은 검증 · DOM · 패널 · 그리기 순서였다 (Phase 6).
   - contract 는 42 그대로다. 42 는 아직 커밋 전이고, 값 하나를 더 받는 것이라 옛 문서가 바뀌지 않는다.
   - Fixed 는 그대로 막는다 — Canvas 의 viewport 기준 (ADR-267 결정 2) 과 엔진 구현이 먼저다.

### 사용자 결정 6 — 확정 2026-10-20

6. **Fixed 허용 · Canvas viewport = page body 영역** → ADR-267 사용자 결정 1 · 2 를 fixed 에 대해 정한다. 사용자 원문: 「body영역을 viewport 영역으로 봐야하지않나」 · 「진행」.
   - viewport = page root 바깥 상자의 원점 + breakpoint 화면 크기. body 의 padding · border 와 무관하다 (CSS 의 viewport 기준).
   - page 를 스크롤해도 움직이지 않는다 (sticky 와 다른 점).
   - page 가 저작 높이로 화면보다 길면 viewport 는 스크롤 0 의 화면 하나다 (Preview iframe 과 같다).
   - 미지원: transform · filter 조상 (CSS 는 그 조상을 containing block 으로 삼는다) — 저작 입력이 없다.

### 사용자 결정 7 — 확정 2026-10-20

7. **Position 절 정리** — 사용자 원문: 「top,left,right,bottom fieldset-legend 는 없어도 될듯」 · 「Center X · Center Y 는 빼, position section 이 layout,spacing과 다르게 영역 전체를 모두 사용중이다 우측 한칸 액션버튼 영역에 fill 을 배치하자」.
   - 변 칸 4 의 legend 를 없앤다. 변은 pin 상자 둘레의 자리로 읽고, 접근 이름은 칸에 남긴다.
   - `Center X` · `Center Y` 버튼을 없앤다 — pin 상자 십자선과 같은 명령이다.
   - 절의 열은 다른 절과 같은 행 템플릿 (칸 2 열 + 아이콘 칸 1 열). `Fill` 은 아이콘 칸의 버튼 (Absolute · Fixed 일 때).

### 사용자 결정 8 — 확정 2026-10-20

8. **4방향 도식 크기 = Alignment 판** — 사용자 원문: 「가장 문제점이 spacing,position 의 ui 디자인이다. layout은 사용성 크기가 안정적이지만 spacing,position 은 패턴을 벗어나있다」 · 「spacing, position 도식을 유지하고 layout 의 도식은 4방향이면 Alignment 크기를 벗어 나지 않아야 일관성이 생긴다」. 배치 선택: Spacing 「왼쪽 = 네 변 한 값」 · Position 「도식 둘레 배치 유지」.
   - 도식 크기 = 행 템플릿의 한 열 폭 × `--inspector-diagram-height` (Alignment 판 높이 84 와 같은 식).
   - Spacing: Layout 의 「Display · Space + Alignment」 짜임 — 왼쪽 열 Padding · Margin 칸 (네 변이 같으면 그 값, 다르면 비워 두고 Mixed · 입력하면 네 변에 한 번에), 오른쪽 열 상자 도식 (변별 값 편집), 아이콘 칸 link. 잠긴 margin 변 (가운데 축, 결정 2) 은 한 값 계산과 쓰기에서 빠진다.
   - Position: 칸이 상자를 둘러싸는 배치 그대로, 상자만 Alignment 크기. 도식 줄은 아이콘 칸까지 써서 좌우 칸이 「auto PX」 를 담고, `Fill` 은 모드 줄의 아이콘 칸.

### 사용자 결정 9 — 확정 2026-10-20

9. **Spacing 도식 = padding 만** — 사용자 원문: 「spacing에 도식에 외부 margin은 제거 하고 내부 padding만 남기자 크기는 Alignment 와 동일하게 간격도 동일하게」 (앞선 질문 「figma 에서 margin 은 지원하지않는건가」 · 「framer 는 margin이 있나」 — 둘 다 레이어 margin 이 없고 부모 padding · gap 으로 간격을 정한다).
   - 도식은 Alignment 판과 같은 3 × 3 격자 (칸 xl · 간격 4 · 안 여백 2xs · 표면 · 테두리 · 그림자 동일) — 위 · 왼 · 오른 · 아래 칸에 padding 변 값, 가운데는 내용 상자 표시.
   - margin 은 왼쪽 열 Margin 칸 (네 변 한 값) 으로만 편집한다. margin 변별 편집 칸은 없다. 가운데 축 margin 잠금 (결정 2) 은 Margin 칸이 그 변을 읽지도 쓰지도 않는 것으로 남는다.

### 사용자 결정 10 — 확정 2026-10-20 (결정 8 의 Spacing 부분 · 결정 9 를 대체)

10. **Padding = Layout 절 안, Figma 구성 · margin 편집 UI 제거** — 사용자 원문: 「figma의 padding 을 확인시 layout 에 위치, 기본 left-right / top-bottom / 확장버튼 · left / top / 확장버튼 · right / bottom 으로 구성된다」. 선택: 도식 「도식 제거」 · Margin 「Margin UI 제거」.

- Layout 절 Wrap · Gap 아래 `PaddingFields`: 「↔ 가로 (Left · Right) · ↕ 세로 (Top · Bottom) · 펼침」, 펼치면 「Left · Top · 펼침」 / 「Right · Bottom」. 두 변이 다르면 펼친 채 시작하고, 접힌 칸은 비워 두고 Mixed. Canvas spacing 세션 (ADR-222) 이 편집 중인 변은 세션 값을 보이고 잠긴다.
- Spacing 절 (Padding · Margin 칸 + 도식) 을 Layout 탭에서 뺐다. margin 은 패널에서 편집하지 않는다 — 문서의 값은 그대로 그려지고 Layout 절 reset 이 지운다. 가운데 축 margin 잠금 (결정 2) 은 명령 거부로 남는다.
- Canvas padding 드래그의 4변 연동 (`boxModelLink`) 을 켜던 link 버튼이 없어져 연동은 꺼진 채다.

## Risks

| ID  | 위험                                                                                                                                                                                                                             | 심각도 | 대응                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------ |
| R1  | Hug 가운데가 엔진에선 늘어나고 DOM 에선 가운데 — 엔진이 absolute 자기 정렬을 읽지 않는다 (A4) · `fit-content` 를 크기로 안 본다 (F10) · 수리가 stretch 제외와 상자 기준을 한 bool 로 바꾸면 padding · border 만큼 줄어든다 (F14) |  HIGH  | G1 — Chrome oracle (자식 padding 12 · border 2 를 준 Center × Hug 포함) + Rust 테스트, 패널이 가운데를 쓰기 전에   |
| R2  | 소비자 17 파일 중 하나가 옛 술어를 남겨 absolute 노드가 그 표면에서 흐름에 낀다 (grid auto 행 · spacing 손잡이 · track 레이어) · 또는 편집 표면이 바깥 흐름 술어를 써서 rule 이 놓은 부품을 끌 수 있게 된다 (F15)                |  HIGH  | G2 — 노드 placement 참조 0 정적 게이트 + 소비자마다 술어 배정 표 (breakdown) + rule 부품 drag 거부 unit            |
| R3  | 제약 대응 왕복 오류 (읽기 → 쓰기 → 읽기가 다른 제약)                                                                                                                                                                             |  MED   | G3 — 축당 4 제약 × 2 단위 × 2 축 왕복 unit                                                                         |
| R4  | 가운데 축 margin 이 정렬 상자를 밀어 가운데가 어긋남 — Spacing 편집과 충돌                                                                                                                                                       |  MED   | 결정 2 — 그 축 margin 칸 잠금 · G3 unit                                                                            |
| R5  | drag 가 inset · 단위 변환을 더해 프레임 비용 증가                                                                                                                                                                                |  MED   | G5 — ratchet drag run A 초과 0                                                                                     |
| R6  | 옛 개발용 문서가 열리지 않거나 absolute 노드를 잃는다                                                                                                                                                                            |  MED   | 결정 1 (contract 42 · 전부 거부 수용) · CHANGELOG Breaking 기재                                                    |
| R7  | breakpoint 에서 끈 위치가 base 층에 들어간다                                                                                                                                                                                     |  LOW   | G4 live 에 breakpoint drag 1 시나리오                                                                              |
| R8  | 가운데 상자가 부모보다 넓을 때 Canvas 와 Preview 가 갈린다 — breakpoint 축소만으로 생긴다 (F13 · 결정 4)                                                                                                                         |  HIGH  | G1 — 부모 < 자식 입력 (가로 · 세로) 에서 엔진 = Chrome (`unsafe center` → 가운데)                                  |
| R9  | Preview 브라우저 (Chrome · WebKit — 사용자 대상) 가 absolute 의 `justify-self` / `align-self` 를 지원하지 않거나 다르게 그린다                                                                                                   |  HIGH  | G0 go/no-go — 두 브라우저에서 넘침 · Hug · 오프셋 · flex / grid 부모 4 경우 일치. no-go 면 A5 대체안 + 사용자 보고 |

## Gates

| Gate | 시점       | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 실패 시 대안                                                    |
| ---- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| G0   | Phase 0 끝 | **A4 go/no-go**: Chrome · WebKit 에서 absolute + 양쪽 inset + `justify-self` / `align-self: unsafe center` 가 넘침 · Hug · 오프셋 · flex / grid 부모에서 가운데 (`getBoundingClientRect`) — 실패 시 A5 대체안으로 바꾸고 사용자 보고 · 노드 placement 소비자 목록 고정 (src 17 · test 6 — 늘면 목록 보강, M3) 과 소비자마다 술어 배정 (바깥 흐름 / 저작 위치) · oracle 케이스 작성 (Left · Right · Left+Right · Center × Fixed / Hug · `%` · 음수 오프셋 · 자식 padding · border · 부모 < 자식 · breakpoint 축소) | 목록 보강 후 재측정                                             |
| G1   | Phase 1 끝 | 엔진 = Chrome (oracle browser test — Center × Hug 에 자식 padding · border 포함, 부모 < 자식 가로 · 세로) · Rust 테스트 · 수리 원복 시 RED · 기존 auto stretch · 명시 크기 회귀 0                                                                                                                                                                                                                                                                                                                                 | 엔진 수리 막히면 가운데를 Fixed 폭에만 허용하고 사용자에게 보고 |
| G2   | Phase 2 끝 | 노드 placement 참조 0 (정적 테스트) · 저장 검증이 `placement` 를 거부 · catalog parity (Canvas ↔ DOM) 6 제약 케이스 0 px · rule 부품 (ListBoxItem icon) Canvas drag 거부 유지 · 저작 absolute drag 허용                                                                                                                                                                                                                                                                                                           | 남은 소비자 수리                                                |
| G3   | Phase 4 끝 | 제약 대응 왕복 unit · 입력 칸 = 그 변으로 바꿈 · 축 비지 않음 · 바꿔도 그 자리                                                                                                                                                                                                                                                                                                                                                                                                                                    | 대응 함수 수리                                                  |
| G4   | Phase 5    | 실제 builder (Chrome MCP) 에서 시안 5 상태 재현 · 각 제약으로 drag 뒤 제약 유지 · breakpoint drag · Compare Mode Preview 위치 일치 · `/cross-check`                                                                                                                                                                                                                                                                                                                                                               | 해당 단계로 되돌림                                              |
| G5   | push 전    | `gate:perf-ratchet` (수동 · `PERF_RATCHET=1` push) drag run A 초과 0 · 번들 ADR-201 상한 안                                                                                                                                                                                                                                                                                                                                                                                                                       | 비용 원인 수리 · 상향은 사용자 승인                             |
| G6   | Phase 5    | 사용자가 패널 UI 확인 (사용자 판정)                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 지적 반영 후 재확인                                             |

측정 조건 (`.claude/rules/measurement-validity.md` §1):

- **G1 · G2 oracle** = 실제 Chrome `getBoundingClientRect`. 엔진 자기 출력은 기준이 될 수 없다.
- **fixture 입력 차원**: padding · border · `%` · min/max · 음수 오프셋을 포함한다.
- **G5**
  - 대상: ratchet 고정 입력 + 사용자 프로젝트 1개
  - 불리 케이스: absolute 자식이 많은 부모에서 Right · Center 기준으로 drag
  - 대조군: 변경 전 커밋과 교대 3 쌍
  - 조건 기록: DPR · visibilityState

### Live Exercise

**사용자 확인 — 2026-10-27** · 사용자 본인 Builder 「adr도 모두 확인은 했다」 — G6 사용자 패널 확인 PASS → Implemented. G5 번들 측정 기록은 없다 (ratchet 은 상한 올림 `1526e969a` · `45aba38aa`).

2026-10-20 · Chrome MCP (dev 5173 · DPR 1 · visible 탭) · 새 프로젝트 `adr275-live` (contract 42) — Host frame 600 × 400 (border 2) 안 Box 120 × 60 · Flow 80 × 40:

| 시나리오                                   | 결과                                                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Position 절 Absolute 클릭                  | 그 자리 (Left 0 · Top 0), 형제 앞으로 · history `Absolute position`                                                        |
| pin 상자 Right 누름 (Left 고정 상자)       | Left+Right — 폭 고정 제거 · 상자 그대로 (x 2 · 폭 120)                                                                     |
| Host 안 Box 를 Canvas 에서 끔 (Left+Right) | Left 0 → 121 · Right 476 → 355 (같은 양) · 폭 120                                                                          |
| Center X · Center Y 버튼                   | 그 자리 (x 123) · 오프셋 −117 / −48 = 손계산 · 폭 120 다시 고정 · Spacing margin 4 칸 잠금                                 |
| Compare Mode Preview                       | Canvas = Preview (123, 122, 120 × 60) · inline `place-self: unsafe center`                                                 |
| 폭 800 (부모보다 넓음 — 사용자 결정 4)     | Canvas = Preview = x −217 (넘쳐도 가운데)                                                                                  |
| 점선 Right 칸에 30 입력                    | 축이 Right 로 바뀜 (Left · `justify-self` 해제) · x 448 = 손계산 · Canvas = Preview · 가로 margin 잠금 해제                |
| Tablet 에서 끌기 (R7)                      | tablet 층에만 기록 · base 불변 · Canvas = Preview (364, 206)                                                               |
| Relative 클릭 · Left 15 입력               | 흐름으로 (y 42) · Right · Bottom 비활성 · `position: relative` + Left 15 만 (남은 inset 정리 — live 에서 찾아 수리) · x 17 |
| 새로고침                                   | base · tablet 층 그대로 (저장) · 콘솔 오류 0                                                                               |

Phase 6 (sticky) — 같은 프로젝트, Mobile, 스크롤 frame 280 × 200 (`overflow: scroll`, flex column) 안 머리 30 + 항목 80 × 4:

| 시나리오                                | 결과                                                                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Position 절 Sticky 클릭                 | mobile 층에 `position: sticky` + Top 0 · 네 칸 활성 (Top 0, 나머지 점선 auto) · 요약 「Sticks when scrolled — Top 0px」 |
| Canvas 에서 스크롤 frame 굴림 (수리 전) | 머리 bounds 는 위에 붙었으나 항목 아래 그려져 보이지 않음 — 결함 (그리기 순서가 재기록되지 않음)                        |
| Relative → Sticky 다시 (수리 뒤)        | 머리가 위에 붙어 항목 위에 그려짐                                                                                       |
| 끝까지 스크롤 (150) — Canvas · Preview  | 둘 다 머리 0–30 · 초록 10 · 보라 80 · 빨강 80 · Preview `position: sticky` · `top: 0px` · 머리 top 0                    |
| 정리                                    | 시드 frame 을 삭제 명령으로 제거 (undo 아님)                                                                            |

Phase 7 (fixed) — 같은 프로젝트, Mobile (390 × 844), 높이 1500 frame 안 section (margin-top 200 · padding 20 · `overflow: hidden` · 높이 300) 안 bar (높이 50):

| 시나리오                            | 결과                                                                                                                          |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Position 절 Fixed 클릭              | 그 자리 유지 — mobile 층에 `fixed` + Left 20 · Top 220 (viewport 기준 — section 위치 + padding) · 결과 문장 「In the screen」 |
| Right · Bottom 칸에 0               | 축이 Right · Bottom 으로 · bar 가 section (y 200–500, overflow hidden) 밖 viewport 아래 (y 794) 에 그려짐                     |
| pin Left 누름 (Left+Right, 수리 전) | 변화 없음 + 오류 토스트 — breakpoint 층의 폭 `mask` 를 문서가 거부 (결함)                                                     |
| pin Left · Left 칸 0 (수리 뒤)      | Left+Right — 폭 390 · (0, 794, 390 × 50)                                                                                      |
| Canvas 에서 body 300 스크롤         | section y 200 → −100 · bar 는 794 그대로 (화면 아래에 그려짐)                                                                 |
| Compare Mode Preview                | iframe 390 × 844 · `position: fixed` · bar (0, 794, 390 × 50) · 문서 300 스크롤 뒤에도 (0, 794) — Canvas = Preview            |
| 새로고침                            | mobile 층 그대로 · 콘솔 오류 0                                                                                                |
| 정리                                | 시드 frame 을 삭제 명령으로 제거                                                                                              |

## Consequences

### Positive

- 위치 경로가 하나가 된다 — 저작 노드와 sub-part 가 같은 `layout` 입력을 엔진 · DOM 에 보낸다.
- 오른쪽 · 아래 기준, 늘이기, 가운데, `%`, breakpoint 별 위치가 저장된다. 패널이 보여 주는 단위와 저장되는 단위가 같아진다.
- 엔진 absolute 의 intrinsic 키워드 크기가 CSS 와 같아진다 (F10) — 패널과 무관한 rule 경로에도 이득이다.

### Negative

- 옛 개발용 프로젝트는 contract 42 에서 열리지 않는다 (결정 1).
- 가운데 축은 margin 을 쓸 수 없다 — 명령이 거부한다 (결정 2 · Spacing 절은 결정 10 으로 삭제 `d216be0d8`).
- 17 파일 소비자 교체 — Phase 2 한 커밋 단위가 커진다 (breakdown 에서 소비자 묶음별로 나눈다).
