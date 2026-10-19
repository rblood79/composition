# ADR-275: Position 절 — Figma 규칙 + Framer 칸 배치, 저장은 layout inset

## Status

Proposed — 2026-10-19

- 사용자 요청: `/create-adr 혼합방식 으로 position 설계` (2026-10-19)
- 방향을 정한 사용자 원문 (같은 세션, 시안 캔버스 `Position 절 시안` 위에서):
  - 「pin to parent 는 Flamer,Figma 모두 12시,3시,6시,9시 방향 만 선택하게한다 (top,right,bottom,left)」
  - 가운데 표현 질문에 「1」 — 가운데는 Figma 십자선처럼 **별도 선택**
  - 「ux는 figma 중심에 framer방식을 차용 하는것이고 ui는 사용하기편한 디자인으로 보여줘」
  - 「Right 로 바꾸는 쪽으로 고쳐줘」 — 빈 칸에 입력하면 그 변으로 **바꾼다** (반대 변을 푼다)
- 사용자가 이미 답한 확인 항목 (create-adr 질문, 2026-10-19):
  - 저장 모델 = **layout inset 으로 통일** (`placement` 삭제)
  - 가운데 저장 = **양쪽 inset + margin auto**
- 사용자 결정 3건 답 (2026-10-19, 아래 Decision 「사용자 결정 3건 — 확정」): 1 전부 거부 · 2 Figma · Framer 방식 · 3 relative Right · Bottom 비활성
- 시안: 혼합 방식 보드 H-A ~ H-E (pin top·left · 가로 늘이기 · 가운데 · 빈 칸 입력 · relative) + 컴포넌트 `HybridPanel`

## Context

**Domain**: D3 (시각 스타일) — 위치는 Canvas (엔진 + Skia) 와 Preview/Publish (DOM + CSS) 가 같은 값 (`position` · `inset*` · `margin`) 에서 같은 상자를 내야 하는 대칭 문제다. D1 은 건드리지 않는다 (RAC DOM 그대로). D2 도 아니다 — 컴포넌트 prop 이 아니라 모든 노드의 layout 필드다. 패널 UI 는 Builder 표면이라 SSOT 경계 밖이다.

### 문제

1. **패널이 표현하는 것과 문서가 저장하는 것이 다르다.** Position 절은 Left · Top 입력이 단위 `px · % · vw` 를 내보이지만 (`TransformSection.tsx` Position 행), 쓰기 명령은 px 가 아니면 거부한다 (`catalogRuntime/position.ts` `catalogPlacementEditCommand` → `cssPx` → `CatalogStyleValueError`).
2. **오른쪽 · 아래 기준, 늘이기, 가운데, breakpoint 별 위치를 저장할 곳이 없다.** 저장 형식은 `NodePlacement { kind: "absolute"; x; y }` 하나다 (px, 부모 padding box 기준).
3. **위치 경로가 둘이다.** 저작 absolute 는 `node.placement`, 규칙이 놓는 sub-part 는 `layout.position` + `inset*` 이다 (`compositionRoot.ts:1294` 주석). 노드 layout 쪽은 검증 · breakpoint · 엔진이 이미 다 받는다.

### 코드 사실 (2026-10-19 실측)

| #   | 사실                                                                                                                                                                                                                                                        | 위치                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| F1  | `NodePlacement` = `kind · x · y` (px) · `NodeEntry.placement?`                                                                                                                                                                                              | `packages/shared/src/catalog/document/types.ts:391` · `:770`                                              |
| F2  | breakpoint 층 `NodeResponsiveLayer` = `visual · layout · sizing · fillSizing` — placement 없음                                                                                                                                                              | `types.ts:532`                                                                                            |
| F3  | 노드 layout 검증: `position` = `static · relative · absolute` · `insetLeft/Top/Right/Bottom` = 길이 또는 `%` · `margin*` = 길이 또는 `auto`                                                                                                                 | `document/validation.ts:199-207` · `:216-219`                                                             |
| F4  | 노드 placement 검증                                                                                                                                                                                                                                         | `validation.ts:1272`                                                                                      |
| F5  | 엔진 입력: `layout.position` 은 placement 가 **없을 때만** 쓰고, placement 는 `insetLeft = x px` 로 바꾼다                                                                                                                                                  | `runtime/compositionRoot.ts:1294-1301` · `:1085`                                                          |
| F6  | DOM: placement → `position:absolute; left; top`                                                                                                                                                                                                             | `runtime/domBinding.runtime.ts:2643-2648`                                                                 |
| F7  | Canvas drag 가 placement 를 쓴다 · 붙여넣기 · 컴포넌트 명령도 placement 를 만든다                                                                                                                                                                           | `catalogRuntime/canvasGesture.ts:1333` · `commands/structure.ts:1296-1305` · `commands/components.ts:216` |
| F8  | 노드 placement 를 읽는 src 파일 **17** · 테스트 파일 **6** (transaction `setNodePlacement` · resolver · fieldSource · boxModel · presence · canvasSpacing · gridAutoRows · CatalogGridTrackLayer · catalogStylesHost · effectiveStyle …)                    | `grep NodePlacement\|node.placement\|record.placement\|setNodePlacement`                                  |
| F9  | 엔진 absolute 축: 양쪽 inset + auto 크기 = 늘이기 · 명시 크기 + 양쪽 margin auto = 가운데 (`absolute_margin_auto_centers`)                                                                                                                                  | `packages/engine/src/tree.rs:7422-7462` `resolve_abs_axis` · 테스트 `:11611`                              |
| F10 | **명시 크기 판정이 `fit-content` 를 크기로 보지 않는다** — `has_w = resolve_dimension_opt(width)` 이고 이 함수는 음수를 `None` 으로 버리는데 `fit-content` 는 센티넬 `-2` 다. 그래서 Hug (`fit-content`) 상자에 양쪽 inset 을 주면 가운데가 아니라 늘어난다 | `tree.rs:2818` · `:7359-7368` · `style.rs:26`                                                             |
| F11 | `LIBRARY_CONTRACT_VERSION = 41`                                                                                                                                                                                                                             | `types.ts:111`                                                                                            |
| F12 | 방향키는 Reorder 다 (위치 이동 없음) · absolute drag 는 macOS Ctrl                                                                                                                                                                                          | `catalogRuntime/shortcuts.ts:465-501` · `CatalogCanvas.tsx:1342`                                          |

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
- **ADR-267 결정 1** (sticky · fixed 저작 허용 안 함) · **ADR-164** (fixed 의도적 미지원) 은 유지된다. 패널은 두 값을 비활성으로 보여 주기만 한다.
- **ADR-224** (Fill sizing) 와는 늘이기의 폭 처리 (아래 Decision 4) 에서 만난다.

### 제약

- **Hard**:
  - Canvas ↔ Preview 상자 일치 (`/cross-check`).
  - 엔진 입력의 직렬화기는 `styleOf` 하나다 · TS 에서 absolute 배치 보정 재도입 금지 (`.claude/rules/layout-engine.md` §position:absolute).
  - drag 60Hz floor · pre-push ratchet (`pnpm gate:perf-ratchet`).
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

| 안                                            | 내용                                                                         | 위험                                                                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **A1 양쪽 inset + margin auto** (사용자 선택) | `insetLeft = o` · `insetRight = −o` · `marginLeft/Right = auto` (o = 오프셋) | 그 축의 margin 칸을 가운데가 점유 (MEDIUM) · Hug 는 F10 수리 필요 (HIGH → Phase 1)                                     |
| A2 `left: 50%` + `translate: −50%`            | 오프셋 = `calc(50% + o)`                                                     | translate 는 paint-only 라 엔진 상자 ≠ 보이는 상자 → hit · snap · 선택 상자가 어긋남 (HIGH) · 사용자 transform 과 충돌 |
| A3 새 키 `centerX` / `centerY`                | 가운데를 별도 필드로                                                         | CSS 밖 어휘 → 두 소비자 매핑 (대안 C 와 같은 문제, HIGH)                                                               |

### Risk Threshold Check

| 대안 | HIGH+                        | 판정                                                         |
| ---- | ---------------------------- | ------------------------------------------------------------ |
| A    | 없음 (A1 의 HIGH 는 Phase 1) | 채택 가능 — F10 은 CSS 표준 의미론이라 엔진 수리가 기본 경로 |
| B    | 유지보수 1                   | 회피 대안 = A (경로 하나)                                    |
| C    | 기술 1 · 유지보수 1          | ADR-026 기각 사유 재현 — 기각                                |

루프 1회로 A 가 HIGH 0 이다.

## Decision

**대안 A + 가운데 A1** 을 택한다. 저장은 CSS inset 그대로 두고, 패널은 Figma 규칙을 따르되 칸 배치는 Framer 를 빌린다.

1. **저장** — 저작 absolute = `layout.position: "absolute"` + `inset*`.
   - `placement` 는 타입 · 검증 · `setNodePlacement` op · 소비자에서 지운다.
   - 바깥 흐름 판정은 공용 술어 하나로 모은다 (지금은 `placement?.kind === "absolute"` 가 F8 의 여러 파일에 흩어져 있다).
   - 쓰기는 기존 layout 쓰기 경로라 현재 breakpoint 층에 들어간다.
2. **제약 ↔ CSS 대응** (축마다, 세로도 같음)

   | 패널 제약  | 저장                                                            |
   | ---------- | --------------------------------------------------------------- |
   | Left       | `insetLeft = v` · `insetRight` 없음                             |
   | Right      | `insetRight = v` · `insetLeft` 없음                             |
   | Left+Right | `insetLeft` · `insetRight` 둘 다 · 폭 = auto (늘이기)           |
   | Center     | `insetLeft = o` · `insetRight = −o` · `marginLeft/Right = auto` |

   가운데 판정 = 양쪽 margin `auto` ∧ 양쪽 inset 있음 ∧ `left = −right`. 축이 비면 Left / Top 으로 읽는다.

3. **패널 UX (혼합 방식)**
   - **position**: Relative · Absolute 글자 버튼. Sticky · Fixed 는 비활성 표시만 한다 (ADR-267 결정 1).
   - **pin**: 4 변 + 축마다 가운데 십자선.
     - 가운데를 켜면 그 축의 변 pin 이 풀린다.
     - 축은 비지 않는다 — 마지막 pin 을 풀면 Left / Top 으로 돌아간다. 요소가 저절로 가운데로 가지 않는다.
   - **칸 배치**: T · R · B · L 칸이 pin 상자의 같은 변 옆에 붙는다.
     - pin 안 된 칸은 점선 테두리와 `auto` 로 보인다.
     - 그 칸에 값을 넣으면 그 변으로 **바뀐다** — 반대 변은 풀린다 (사용자 결정 「Right 로 바꾸는 쪽」).
     - 늘이기는 칸이 아니라 pin 상자에서만 한다 — 양쪽 선을 누르거나 `Fill`.
   - **빠른 버튼**: `Center X` · `Center Y` · `Fill` (네 변 0).
   - **결과 문장**: 칸 아래 한 줄로 지금 제약의 뜻을 보여 준다. 입력 중에는 입력한 뒤의 결과를 미리 보여 준다.
   - **단위**: 칸마다 `px` · `%` (F3 이 이미 받는다).
   - **relative**: Left · Top 만 오프셋으로 쓰고, Right · Bottom 칸과 pin 상자는 비활성 (결정 3).
   - **바꿔도 그 자리에** (Figma 와 같음): pin 이나 가운데를 바꿀 때 지금 보이는 상자 위치에서 새 inset 을 계산해 쓴다.
4. **늘이기의 폭** — Left+Right 로 바꾸면 그 축의 Fixed 폭을 지워 auto 로 둔다. 그대로 두면 CSS 가 over-constrained 로 오른쪽 값을 버린다. 가운데로 바꿀 때 그 축이 auto (Hug 아님) 면 `fit-content` 를 쓴다. 그렇지 않으면 늘어난다.
5. **Canvas drag** — absolute 노드를 끌면 제약을 지킨다.
   - Right 기준이면 `insetRight` 를 바꾼다.
   - 가운데면 오프셋을 바꾼다.
   - 늘이기면 양쪽을 같은 양만큼 바꾼다.
   - `%` 칸은 containing block 비율로 바꿔 단위를 유지한다.
6. **F10 엔진 수리** — absolute 의 명시 크기 판정이 `fit-content` · `min-content` · `max-content` 를 크기로 본다. CSS 표준 의미론이므로 엔진에서 고친다. TS 보정은 금지다.

**위험 수용 근거**:

- 대안 A 의 잔존 위험은 둘이다. 소비자 교체는 정적 게이트로 0 을 확인하고, F10 은 Chrome oracle 로 닫는다. 둘 다 Gate 로 막는다.
- 옛 문서 손실은 개발 단계 정책 (전환 코드 금지) 안의 일이다. 사용자가 전부 거부를 수용했다 (결정 1).

**기각 사유**:

- **B**: 위치 경로 둘을 영구히 유지하고, breakpoint · `%` · 두 직렬화를 placement 용으로 새로 만들어야 한다. 이미 있는 layout 경로를 두고 같은 것을 하나 더 만드는 일이다.
- **C**: CSS 밖 어휘 층이다. ADR-026 이 같은 사유로 기각했고, scale 은 CSS 대응이 없다.
- **A2**: translate 가 paint-only (`PAINT_ONLY_VISUAL_KEYS` 의 transform 계열) 라서 엔진 상자와 보이는 상자가 갈린다. 그러면 hit · snap · 선택 상자가 어긋난다.
- **A3**: 대안 C 와 같은 매핑 문제다.

> 구현 상세: [275-position-section-figma-rules-framer-fields-layout-insets-breakdown.md](design/275-position-section-figma-rules-framer-fields-layout-insets-breakdown.md)

### 사용자 결정 3건 — 확정 2026-10-19

1. **옛 문서의 `placement`** → `LIBRARY_CONTRACT_VERSION` 41 → 42. 옛 개발용 프로젝트는 전부 거부한다 (ADR-251 선례). 사용자 원문: 「모두 거부해도 상관없다」.
2. **가운데 축의 margin 칸** → Figma · Framer 방식. 사용자 원문: 「figma,framer 방식을 따르겠다」.
   - 두 도구에는 위치가 지정된 레이어의 margin 이 없다. 위치는 Position 절 (제약 + 오프셋) 에서만 바꾼다.
   - 그래서 가운데 축의 Spacing margin 칸은 `auto · Center` 로 잠그고 편집을 받지 않는다. 옮기려면 Position 절의 오프셋을 바꾸고, 가운데를 풀려면 pin 을 바꾼다.
   - 가운데가 아닌 축의 margin 은 종전대로 편집할 수 있다.
3. **relative 의 Right · Bottom** → 비활성 (시안 그대로). 사용자 원문: 「비활성이 사용자 혼란을 막지 않을까」.
   - 근거를 바로잡아 적는다. CSS 에서 relative 의 `right` 는 동작한다 (`right: 10px` = 왼쪽으로 10 이동). 다만 `left` 와 같이 있으면 `left` 가 이기고, 동작해도 `left` 의 부호만 바꾼 것과 같다.
   - 축당 칸 하나 (Left · Top) 로 같은 표현을 다 할 수 있으므로, 둘째 칸을 열어 두면 「어느 칸이 이기나」 라는 혼란만 남는다.

## Risks

| ID  | 위험                                                                                                                           | 심각도 | 대응                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | :----: | ---------------------------------------------------------------- |
| R1  | Hug (`fit-content`) 상자의 가운데가 엔진에선 늘어나고 DOM 에선 가운데 → Canvas ≠ Preview (F10)                                 |  HIGH  | G1 — Chrome oracle + Rust 테스트 먼저, 패널이 가운데를 쓰기 전에 |
| R2  | 소비자 17 파일 중 하나가 옛 술어를 남겨 absolute 노드가 그 표면에서 흐름에 낀다 (grid auto 행 · spacing 손잡이 · track 레이어) |  HIGH  | G2 — 노드 placement 참조 0 정적 게이트 + 소비자별 unit           |
| R3  | 제약 대응 왕복 오류 (읽기 → 쓰기 → 읽기가 다른 제약)                                                                           |  MED   | G3 — 축당 4 제약 × 2 단위 × 2 축 왕복 unit                       |
| R4  | 가운데가 margin 칸을 점유 — Spacing 편집과 충돌                                                                                |  MED   | 결정 2 — 그 축 margin 칸 잠금 · G3 unit                          |
| R5  | drag 가 inset · 단위 변환을 더해 프레임 비용 증가                                                                              |  MED   | G5 — ratchet drag run A 초과 0                                   |
| R6  | 옛 개발용 문서가 열리지 않거나 absolute 노드를 잃는다                                                                          |  MED   | 결정 1 (contract 42 · 전부 거부 수용) · CHANGELOG Breaking 기재  |
| R7  | breakpoint 에서 끈 위치가 base 층에 들어간다                                                                                   |  LOW   | G4 live 에 breakpoint drag 1 시나리오                            |

## Gates

| Gate | 시점       | 통과 조건                                                                                                                                                          | 실패 시 대안                                                    |
| ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| G0   | Phase 0 끝 | 노드 placement 소비자 목록 고정 (src 17 · test 6 — 늘면 목록 보강, M3) · oracle 케이스 작성 (Left · Right · Left+Right · Center × Fixed / Hug · `%` · 음수 오프셋) | 목록 보강 후 재측정                                             |
| G1   | Phase 1 끝 | 엔진 = Chrome (oracle browser test, Center × Hug 포함) · Rust 테스트 · 수리 원복 시 RED                                                                            | 엔진 수리 막히면 가운데를 Fixed 폭에만 허용하고 사용자에게 보고 |
| G2   | Phase 2 끝 | 노드 placement 참조 0 (정적 테스트) · 저장 검증이 `placement` 를 거부 · catalog parity (Canvas ↔ DOM) 6 제약 케이스 0 px                                           | 남은 소비자 수리                                                |
| G3   | Phase 4 끝 | 제약 대응 왕복 unit · 입력 칸 = 그 변으로 바꿈 · 축 비지 않음 · 바꿔도 그 자리                                                                                     | 대응 함수 수리                                                  |
| G4   | Phase 5    | 실제 builder (Chrome MCP) 에서 시안 5 상태 재현 · 각 제약으로 drag 뒤 제약 유지 · breakpoint drag · Compare Mode Preview 위치 일치 · `/cross-check`                | 해당 단계로 되돌림                                              |
| G5   | push 전    | pre-push `gate:perf-ratchet` drag run A 초과 0 · 번들 ADR-201 상한 안                                                                                              | 비용 원인 수리 · 상향은 사용자 승인                             |
| G6   | Phase 5    | 사용자가 패널 UI 확인 (사용자 판정)                                                                                                                                | 지적 반영 후 재확인                                             |

측정 조건 (`.claude/rules/measurement-validity.md` §1):

- **G1 · G2 oracle** = 실제 Chrome `getBoundingClientRect`. 엔진 자기 출력은 기준이 될 수 없다.
- **fixture 입력 차원**: padding · border · `%` · min/max · 음수 오프셋을 포함한다.
- **G5**
  - 대상: ratchet 고정 입력 + 사용자 프로젝트 1개
  - 불리 케이스: absolute 자식이 많은 부모에서 Right · Center 기준으로 drag
  - 대조군: 변경 전 커밋과 교대 3 쌍
  - 조건 기록: DPR · visibilityState

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- 위치 경로가 하나가 된다 — 저작 노드와 sub-part 가 같은 `layout` 입력을 엔진 · DOM 에 보낸다.
- 오른쪽 · 아래 기준, 늘이기, 가운데, `%`, breakpoint 별 위치가 저장된다. 패널이 보여 주는 단위와 저장되는 단위가 같아진다.
- 엔진 absolute 의 intrinsic 키워드 크기가 CSS 와 같아진다 (F10) — 패널과 무관한 rule 경로에도 이득이다.

### Negative

- 옛 개발용 프로젝트는 contract 42 에서 열리지 않는다 (결정 1).
- 가운데 축은 margin 을 쓸 수 없다 — Spacing 칸 잠금 (결정 2).
- 17 파일 소비자 교체 — Phase 2 한 커밋 단위가 커진다 (breakdown 에서 소비자 묶음별로 나눈다).
