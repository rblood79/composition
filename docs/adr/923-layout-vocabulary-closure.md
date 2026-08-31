# ADR-923: 레이아웃 어휘 닫기 — TS IFC 시뮬레이션 제거·엔진 block/inline 경로 직결(A) + 미구현 레이아웃 의미 ingress 정규화(B)

## Status

Proposed — 2026-08-31

> 번호: 사용자 요청 922 는 `922-photoshop-style-panel-layout-coordinator` 가 이미 사용 중 → 900 밴드(인프라/렌더링 트랙, ADR-916 계열) 최대 + 1 = 923. 사용자 명시 요청으로 900 밴드 사용.

## Context

**Domain: D3 시각 스타일** (layout flow 는 D3 — `.claude/rules/ssot-hierarchy.md` §3). D1/D2 변경 없음. Spec/Generator 확장 ADR 아님 — catalog CSS 생성기는 손대지 않는다.

### 발견 경위

ADR-198 (D3 픽셀 패리티 게이트) 가 두 프로덕션 leg 을 처음 맞댄 결과 catalog 파일럿에서 배치 발산이 났다 (`0aa52b68a`): block 부모 안의 **명시 폭 block 형제**가 Chrome 에서는 제 줄을 차지하는데 Skia 에서는 inline-block 형제와 같은 줄에 남는다. 원인을 추적하니 어댑터가 아니라 **어댑터의 전제**가 문제였다.

### 실측 사실 (2026-08-31)

1. **전제가 낡았다.** `taffyDisplayAdapter.ts:20` "=== Taffy 시뮬레이션 규칙 ===", `:521` "Taffy는 inline formatting context를 지원하지 않으므로". Taffy 는 ADR-916 endgame 7/7 (`dd5a6e403`, 2026-07-06) 로 **완전 제거**됐고 (`composition-engine/Cargo.toml:5` "taffy dependency 부재가 본 crate 의 존재 이유"), 비테스트 14 파일이 Taffy 식별자를 아직 쓴다.
2. **전제가 실제 엔진에 대해 거짓이다.** `packages/composition-engine/src/block.rs:141-215` 는 inline-block 자식의 line box 를 **자체 구현**한다 — wrap 판정, `flush_line_box`, `vertical_align`/`baseline`/`line_height` 필드 (WPT 유래 `block_layout.rs` 승계, ADR-916 1-C).
3. **TS 치환이 엔진 구현을 가린다.** `fullTreeLayout.ts:1156 toTaffyDisplay` → block 부모에 inline-level 자식이 하나라도 있으면 `INLINE_BLOCK_PARENT_CONFIG` (flex row wrap) → `TaffyBlockEngine.ts:118 result.display = "flex"` → `tree.rs:3598 classify_container_display("flex") → Flex`. `solve_block` 의 inline-block 경로 (`tree.rs:4607` display code 1) 는 live 빌더에서 **도달 불가** — cargo test 만 지나간다.
4. **엔진 안에서도 절반만 배선됐다.** `tree.rs:4590` 은 `vertical_align/baseline/line_height` 를 "미소비" 로 선언한다.
5. **이중 선언.** `utils.ts:4400 INLINE_BLOCK_TAGS` 손 목록이 catalog `COMPONENT_RULES_TABLE` 의 display 와 별개 원천이고, TS `parseDisplay/classifyChildDisplay/blockifyDisplay` 는 `display.rs` 에 이미 이식된 것과 두 벌이다.
6. **ingress 는 열려 있다.** 팔레트 factory 가 `display:"block"` 을 11곳(3파일)에 넣고, Style 패널 `DISPLAY_OPTIONS` 가 block/inline/inline-block 을 노출하며, pencil import 와 AI 생성이 있다. 반면 hydration migration chain(`adapters/canonical/index.ts:334-343`) 이라는 단일 chokepoint 선례가 이미 있다.

ADR-198 의 발산은 이 그림자 안에서 났다: `needsBlockChildFullWidth` 는 block.rs 가 이미 하는 일의 **JS 재구현**이고, Chrome 과 갈린 건 그 재구현이다. 같은 부류의 치환이 어댑터 헤더에 4개 더 선언돼 있다 (순수 inline → block 격상, width:100% 보정, vertical-align → alignItems 근사, intrinsic width 주입).

### 문제 정의

정합의 근본 구조는 두 가지뿐이다. (A) Chrome 을 진실로 두고 캔버스가 흉내낸다 — 작업량이 무한하다. (B) 문서 모델을 진실로 두고 캔버스와 Chrome 이 **같은 문서를 같은 의미로** 소비한다 — 작업량은 "빌더가 허용한 어휘 × 소비자 정확성" 으로 유한하다. 이 저장소는 뼈대가 (B) 다 (canonical document ADR-142, catalog D3 SSOT, ADR-916 자체 엔진, ADR-156 Chrome 차등 oracle). 어댑터의 시뮬레이션 층만 (A) 의 잔재로 남아 있다.

**Hard Constraints**:

1. **치환 0 (측정 가능)**: 어댑터가 문서의 display class 와 다른 class 를 엔진에 넘기는 경우는 substitution registry 에 선언된 항목뿐이어야 한다 — registry 밖 발생 = 게이트 실패. 현재 미선언 치환 수: 8 (breakdown §2.1).
2. **Chrome 차등 증명 선행**: 한 번도 live 로 돌지 않은 엔진 경로(block.rs line box) 를 켜기 전에 ADR-156 방식(실 Chrome `getBoundingClientRect`) 차등 케이스 ≥ 12 가 위치·크기 ≤ 1px 로 통과해야 한다. 허용치 확대 금지.
3. **ADR-198 규율 승계**: 예산·fixture 무변경. `KNOWN_LAYERS` ratchet 은 수리 결과로만 갱신.
4. **성능**: 5k fixture `computeLayout` p95 가 baseline 대비 +5% 이내.
5. **단일 ingress**: 정규화는 진입로마다가 아니라 hydration migration chain 한 곳에서. 멱등.
6. **D1/D2 무변경**: DOM/ARIA·props·canonical 스키마 변경 0.

**Soft Constraints**:

- block.rs line box 는 cargo test 로만 검증됐다 — live 동작 미지.
- ADR-198 Phase 6(대표 매트릭스) 미착수 — 본 ADR 의 차등 케이스가 그 입력이 된다.
- 단일 개발자 리뷰 용량 — Phase 를 commit 단위로 잘게.
- 기존 문서의 배치가 바뀐다(Chrome 쪽으로). 사용자 체감은 "Preview 와 캔버스가 같아짐".

## Alternatives Considered

### 대안 A: TS 시뮬레이션 정교화 (line-break 삽입 또는 익명 블록 그룹화)

- 설명: 어댑터의 flex-row-wrap 시뮬레이션을 유지하고, block 형제 앞뒤에 줄바꿈 항목을 넣거나(외과적) 연속 inline 형제를 익명 블록으로 묶는다(구조적). 발견된 결함만 고친다.
- 근거: CSS 2.1 §9.2.1.1 익명 블록 박스가 바로 이 구조다. Dropflow(`packages/layout-flow` 원본) 의 `classifyChild` 가 같은 접근. 다만 이는 **레이아웃 엔진 안에서** 하는 일이지 엔진 앞단 JS 에서 하는 일이 아니다.
- 위험:
  - 기술: MEDIUM — flex 로 IFC 를 근사하는 한계(line-height strut, baseline 정렬, 줄 간 margin) 는 남는다.
  - 성능: LOW — 변경 없음.
  - 유지보수: **HIGH** — 같은 의미를 JS(어댑터) 와 Rust(block.rs) 두 곳이 구현. 한쪽 수정이 다른 쪽과 갈리는 구조를 고착. ADR-916 이 없앤 이중화를 되살린다.
  - 마이그레이션: LOW — 문서 무변경.

### 대안 B: 어휘에서 제거 + ingress 전면 정규화 (block+inline-level → 문서에 flex 기록)

- 설명: block 컨테이너에 inline-level 자식이 들어오면 입력 시점에 컨테이너를 `display:flex; flexWrap:wrap; alignItems:baseline` 으로 **문서에** 기록한다. Chrome 도 같은 flex 를 받으므로 갈릴 자리가 없다. 시뮬레이션이 "엔진의 비밀" 에서 "문서의 값" 이 된다.
- 근거: Figma auto-layout / Framer 의 방식 — 자기 레이아웃 모델(닫힌 어휘)을 CSS 로 내보내며 CSS 를 흉내내지 않는다. pen.dev 도 동형.
- 위험:
  - 기술: LOW — 엔진 flex 경로는 검증됨.
  - 성능: LOW.
  - 유지보수: MEDIUM — 정규화 규칙이 "CSS 의미와 다른 빌더 의미" 를 영구화. `display:block` 을 고른 사용자의 의도(줄 단위 블록 흐름)를 flex 로 바꾼다.
  - 마이그레이션: **HIGH** — 기존 문서의 block 컨테이너 전부 재직렬화(factory 11곳 포함), 배치가 Chrome 의 원래 결과와 **멀어지는** 방향. 엔진이 이미 구현한 것을 버린다.

### 대안 C: 갈래 분리 — 엔진 구현분은 직결(A), 미구현분만 정규화/선언(B)

- 설명: 상위 정책 "엔진이 구현한 의미만 문서에 존재하고, 치환은 몰래 하지 않는다" 를 두 갈래로 집행한다. **A 직결**: TS IFC 시뮬레이션·width:100% 보정·leaf 고정·vertical-align 근사를 제거하고 block.rs line box 를 쓴다; `tree.rs` 미소비 3 필드를 배선한다; 켜기 전 Chrome 차등으로 증명한다. **B 어휘 닫기**: 순수 `display:inline` 요소는 ingress 에서 `inline-block` 으로 정규화(문서 값), float/writing-mode/다단은 노출 차단 + import strip, grid 미구현 4종은 선언된 치환 + 차등 케이스로 수치 고정. 손 목록 `INLINE_BLOCK_TAGS` 는 catalog 파생으로, Taffy 명명은 개명.
- 근거: Blink LayoutNG / Servo 는 block flow 안의 inline-block 을 line box 로 배치한다 — block.rs 가 승계한 WPT 파생 커널이 그 모델. Taffy 와 Yoga 는 inline 레이아웃을 명시적으로 범위 밖에 둔다 — 시뮬레이션은 그 제약의 산물이었고 제약은 ADR-916 으로 사라졌다. ADR-156 이 도입한 실 Chrome 차등 oracle 이 "켜기 전 증명" 수단이다.
- 위험:
  - 기술: MEDIUM — block.rs line box 가 live 미검증. 차등 케이스로 선행 증명 (HC2).
  - 성능: MEDIUM — block 경로의 프레임당 비용을 flex 경로와 비교한 적 없음. baseline 대비 게이트 (HC4).
  - 유지보수: LOW — 의미 구현이 Rust 한 곳, 선언이 catalog 한 곳, 정규화가 chain 한 곳.
  - 마이그레이션: MEDIUM — block+inline-block 문서의 배치가 Chrome 쪽으로 1회 이동. 스키마 변경 0, migration 은 S4 정규화 1건(멱등).

### 대안 D: 엔진에 완전한 IFC 구현 (순수 inline box · 텍스트 run 과 요소 혼합 · float)

- 설명: Dropflow 전체를 Rust 로 이식해 CSS 2.1 §9.4.2 IFC 를 완전히 구현한다.
- 근거: Dropflow / Servo Layout 2020.
- 위험:
  - 기술: **HIGH** — 텍스트 shaping 과 line breaking 을 엔진이 떠안음. 지금은 Skia Paragraph 가 담당.
  - 성능: MEDIUM.
  - 유지보수: **HIGH** — 코드량 수천 줄, 리뷰 용량 초과 (ADR-916 R 표 동일 사유).
  - 마이그레이션: LOW.

### Risk Threshold Check

| 대안 | 기술  | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ----- | ---- | -------- | ------------ | :--------: |
| A    | M     | L    | **H**    | L            |     1      |
| B    | L     | L    | M        | **H**        |     1      |
| C    | M     | M    | L        | M            |     0      |
| D    | **H** | M    | **H**    | L            |     2      |

루프 판정: HIGH 0 인 대안(C) 이 존재 → 새 대안 추가 불요. CRITICAL 없음.

## Decision

**대안 C: 갈래 분리 — 엔진 구현분 직결(A) + 미구현분 정규화/선언(B)** 를 선택한다.

선택 근거:

1. 유일하게 4축 HIGH 0. 잔존 MEDIUM 셋(live 미검증 경로 / block 경로 비용 / 배치 이동) 은 전부 **켜기 전 측정**으로 관리 가능하다 — ADR-156 차등 oracle 과 ADR-198 픽셀 게이트가 이미 있어 새 계측 인프라가 필요 없다.
2. 의미 구현을 Rust 한 곳으로 모으는 것이 ADR-916 의 결정("단일 엔진") 을 완성하는 일이다. 어댑터가 엔진 앞에서 의미를 다시 쓰는 구조는 ADR-916 이 없앤 이중화의 잔재다.
3. 배치 이동 방향이 Chrome(=Preview=publish) 쪽이다. 사용자가 실제로 배포받는 결과로 캔버스가 수렴하므로 "기존 문서가 달라진다" 는 비용이 "패널·캔버스·Preview 가 같아진다" 는 이득과 같은 사건이다.
4. B 갈래를 남기는 이유: 엔진이 진짜로 구현하지 않은 의미(순수 inline 요소, float, grid 4종) 에 대해 "몰래 치환" 을 금지하려면 선언 장치가 필요하다. 그것이 없으면 이번 부류의 발산이 다른 항목에서 재발한다.

기각 사유:

- **대안 A 기각**: 엔진이 이미 갖고 있는 line box 를 JS 로 또 만든다. 이번 발산의 원인이 바로 그 JS 재구현이었다. 유지보수 HIGH 를 영구화.
- **대안 B 기각**: 구현된 기능을 버리고 문서 의미를 CSS 에서 멀어지게 바꾼다. 마이그레이션 HIGH 이면서 얻는 것이 C 의 부분집합. 단, B 의 원리(닫힌 어휘 + 문서 값) 는 C 의 B 갈래로 흡수 — 엔진 미구현 항목에만 적용.
- **대안 D 기각**: 텍스트 흐름은 Skia Paragraph 가 이미 담당하고 요소 단위 inline 혼합은 제품 요구가 아니다. 범위·리뷰 용량 초과. 필요해지면 별도 ADR.

> 구현 상세: [923-layout-vocabulary-closure-breakdown.md](design/923-layout-vocabulary-closure-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                     |  심각도  | 대응                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | block.rs line box 가 live 로 돈 적이 없다 — 켜는 순간 미지의 결함이 사용자 문서에 노출. 경로: `block.rs:141-215` / `tree.rs:4590,4607` / `fullTreeLayout.ts:1156` / `TaffyBlockEngine.ts:118`                                                                                            | **HIGH** | G1: 켜기 전 Chrome 차등 케이스 ≥12 통과. 실패 케이스는 Phase 2 에서 엔진 수리 후 재실행. cutover 는 단일 commit(즉시 revert)                          |
| R2  | 기존 문서 배치 이동 — block 컨테이너 + inline-level 자식 문서 전부. 경로: `factories/definitions/{DateColor,Form,Overlay}Components.ts` (`display:"block"` 11곳) / `styleOptions.ts:68 DISPLAY_OPTIONS` / `adapters/canonical/index.ts:334` migration chain. 로컬 프로젝트 영향 % 미측정 | **HIGH** | G2: Phase 0 에서 "영향 % / 평균 재직렬화 파일 수" 수식화. 이동 방향이 Chrome 쪽임을 ADR-198 픽셀 게이트로 증명(L1 pass). CHANGELOG 사용자-가시 엔트리 |
| R3  | block 경로 프레임당 비용이 flex 경로보다 클 수 있음 — 5k 문서에서 p95 회귀                                                                                                                                                                                                               |   MED    | G3: baseline 대비 +5% 이내. 초과 시 block.rs 프로파일 후 수리, 예산 완화 금지                                                                         |
| R4  | 이중 선언 drift — `INLINE_BLOCK_TAGS` 손 목록 ↔ catalog display, TS 분류 함수 ↔ `display.rs`                                                                                                                                                                                             |   MED    | G4: catalog 파생 집합과 손 목록 diff 0 확인 후 손 목록 삭제. 남는 TS 함수는 display.rs 와 table test 로 묶음                                          |
| R5  | ingress 우회 — pencil import / AI 생성 / 직접 store 쓰기가 hydration chain 을 안 지나면 S4 정규화가 새지 않음                                                                                                                                                                            |   MED    | Phase 0 실측으로 경로 확정. 정규화는 chain 한 곳(HC5), 우회 경로가 있으면 chain 을 지나도록 배선                                                      |
| R6  | 선언 누락 — registry 에 없는 치환이 새로 생기면 같은 부류 재발                                                                                                                                                                                                                           |   MED    | G5: registry 밖 class 변경을 게이트 테스트가 잡음. 새 치환은 registry 등록 + 차등 케이스 없이는 머지 불가                                             |
| R7  | ADR-198 ratchet 상호작용 — catalog `KNOWN_LAYERS` 를 수리 전에 손대면 게이트 vacuous                                                                                                                                                                                                     |   LOW    | HC3. ratchet 은 Phase 3 결과로만 갱신                                                                                                                 |
| R8  | tree.rs 3 필드 배선이 inline 자식 없는 block 컨테이너의 기존 결과를 바꿀 수 있음                                                                                                                                                                                                         |   LOW    | Phase 2 에서 cargo golden + ADR-156 기존 케이스 전량 회귀. 변화가 있으면 Chrome 값으로만 판정                                                         |
| R9  | Taffy 명명 잔재가 후속 작업을 잘못 이끎 (본 세션에서 실제로 발생)                                                                                                                                                                                                                        |   LOW    | Phase 6 개명 + 헤더 재작성. 개명은 동작 무변경 commit 으로 분리                                                                                       |

## Gates

| Gate | 시점                        | 통과 조건                                                                                                                                                                                          | 실패 시 대안                                                                                                                                  |
| ---- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| G0   | Phase 0 종료                | substitution registry 8항목 코드화(동작 변경 0) · BC 정량(영향 % / 평균 파일 수 / factory 11곳 자식 분류) · layout p50/p95 baseline · import/AI 경로 hydration 통과 여부 실측                      | 미측정 항목이 있으면 Phase 1 진입 금지                                                                                                        |
| G1   | Phase 1 종료 · Phase 3 종료 | (전반) 어댑터 우회로 엔진 block 경로에 Chrome 차등 케이스 ≥12, 위치·크기 ≤1px, 허용치 무변경. (후반) cutover 후 같은 케이스가 프로덕션 경로로 통과 + ADR-198 `blockInlineProbe` 4 변형 두 leg 일치 | 실패 케이스를 엔진 결함으로 기록 → Phase 2 수리 → 재실행. 2회 후에도 실패면 해당 케이스를 registry 의 "선언된 치환" 으로 강등하고 사용자 판단 |
| G2   | Phase 3 종료                | ADR-198 catalog-state-paint L1 pass(예산 무변경) · CHANGELOG 엔트리 · Phase 0 영향 % 가 breakdown §6 에 기록                                                                                       | L1 실패면 cutover commit revert, 원인 규명 후 재시도                                                                                          |
| G3   | Phase 3 종료                | 5k fixture p95 ≤ baseline +5%                                                                                                                                                                      | block.rs 프로파일 → 수리. 예산 완화 금지                                                                                                      |
| G4   | Phase 4 종료                | catalog 파생 inline-level 집합 == 구 `INLINE_BLOCK_TAGS` (diff 0) 확인 후 손 목록 삭제 · 남는 TS 분류 함수 ↔ display.rs table test 통과                                                            | diff 가 있으면 어느 쪽이 catalog 정본과 맞는지 판정 후 정합, 손 목록 유지 금지                                                                |
| G5   | Phase 5 종료                | registry 밖 display class 변경 0 (게이트 테스트) · S4 migration 멱등 · S7 노출 차단 + import strip · S8 4항목 각 1 차등 케이스로 현재 격차 수치 고정                                               | 미선언 치환 발견 시 등록 없이는 머지 불가                                                                                                     |
| G6   | Implemented 승격            | `### Live Exercise` — 실제 빌더에서 block 컨테이너 + Button 2개 + 폭 명시 div 를 만들어 Canvas·Preview·패널 값 일치 확인 (Chrome MCP 또는 사용자 confirm)                                          | 승격 보류                                                                                                                                     |

### Live Exercise

(Implemented 승격 시 기재 — 시나리오 · 결과 · 날짜 · Chrome MCP/사용자 confirm 구분)

## Consequences

### Positive

- `taffyDisplayAdapter.ts`(개명 후 `displayAdapter.ts`) 가 "CSS → 엔진 style 번역" 만 남고 의미 재작성이 사라진다. block 컨테이너 배치의 정본이 `block.rs` 한 곳이 된다.
- ADR-198 catalog 발산이 예산 변경 없이 닫힌다. `crossLeg.browser.test.ts` 의 `KNOWN_LAYERS["catalog-state-paint"]` 가 L1 pass 로 갱신된다.
- 이번 부류("엔진이 문서에 없는 의미를 몰래 만든다") 가 registry + 게이트 테스트로 구조적으로 차단된다 — 순수 inline / float / grid 4종이 선언 상태로 드러난다.
- 패널 → 캔버스 → Preview 가 같은 문서를 같은 의미로 읽으므로, 패널에 엔진 사용값을 병기하는 후속 작업의 전제가 갖춰진다 (compare 모드 없이).
- Taffy 명명 14 파일이 정리돼 ADR-916 endgame 의 "주석 정리" 가 실제로 끝난다.

### Negative

- block 컨테이너 + inline-block 자식을 가진 기존 문서의 배치가 1회 바뀐다 (Chrome 쪽으로). 영향 % 는 Phase 0 에서 수식화, CHANGELOG 에 사용자-가시로 기록.
- `display:inline` 을 요소에 직접 쓰던 문서는 hydration 시 `inline-block` 으로 정규화된다 — 패널에서 `inline` 선택지가 사라진다.
- Phase 2 가 `tree.rs`/`cascade.rs`/`style.rs` 의 `NodeStyle` 을 넓힌다 — Rust 변경이라 리뷰 부담이 있고, ADR-916 golden 을 Chrome 값으로 갱신해야 할 수 있다.
- 개명 commit 이 14 파일의 import 를 건드려 blame 이 한 번 끊긴다 (동작 무변경 commit 으로 격리).
