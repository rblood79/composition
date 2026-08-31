# ADR-923 Implementation Breakdown: 레이아웃 어휘 닫기 — TS IFC 시뮬레이션 제거·엔진 block/inline 경로 직결(A) + 미구현 레이아웃 의미 ingress 정규화(B)

> 본 문서는 ADR-923 의 구현 상세 정본이다. ADR 본문은 결정·위험·게이트만 담고, Phase / 파일 경계 / 체크리스트 / 측정 절차는 여기에만 둔다.

## 1. 문제 정의와 범위

### 1.1 결정 경계

ADR-923 은 **레이아웃 어댑터가 문서에 없는 의미를 만들어내는 자리**를 없앤다. 두 갈래로 실행한다.

- **A. 직결** — 엔진(`packages/composition-engine`)이 이미 구현한 의미는 TS 치환을 걷어내고 엔진 경로로 보낸다. 지금 확인된 대상은 block 컨테이너 안의 inline-block 자식(line box).
- **B. 어휘 닫기** — 엔진이 구현하지 않은 의미는 (1) ingress 정규화로 문서에서 그 상태를 없애거나, (2) 이름 붙인 치환 + Chrome 차등 케이스로 선언한다. 선언되지 않은 치환은 게이트 실패다.

바꾸지 않는 것: canonical 스키마, catalog `COMPONENT_RULES_TABLE` 의 시각 값, Preview/publish 의 CSS 생성, D1 DOM/ARIA, D2 props.

### 1.2 Domain

| Domain         | ADR-923 영향                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 DOM/접근성  | 없음. Preview 는 기존 runtime 그대로.                                                                                                             |
| D2 Props/API   | 없음. 새 prop 없음. 패널 `DISPLAY_OPTIONS` 는 노출 항목만 조정 가능(값 자체는 CSS 표준).                                                          |
| D3 시각 스타일 | **layout flow 는 D3** (ssot-hierarchy.md §3 "layout flow (flex-direction 등) → D3"). Skia consumer 의 배치 결과를 catalog·문서와 일치시키는 변경. |

### 1.3 No-fork lock-in (adr-writing.md 4 질문)

1. **base/응용 분류**: ADR-923 은 ADR-916(자체 엔진, Implemented) 의 소비자이고 ADR-198(픽셀 게이트, Accepted) 의 소비자다. 둘의 선행 ADR 이 아니다. ADR-198 Phase 6 매트릭스는 ADR-923 의 검증 수단을 재사용하지만 ADR-923 을 기다리지 않는다.
2. **스키마 직교성**: 지속 스키마 변경 0. Phase 5 의 ingress 정규화는 기존 hydration migration chain(`adapters/canonical/index.ts:334-343`) 에 멱등 migration 1개를 추가하는 것으로, 스키마가 아니라 값 정규화다.
3. **의존 방향 반전 점검**: "TS 어댑터가 엔진 제약을 보완한다" 는 ADR-009 시절 전제(Taffy 시대) 였고, ADR-916 endgame(`dd5a6e403`, 2026-07-06) 이후 엔진이 block/inline 을 자체 구현하므로 **어댑터 → 엔진 의존은 더 이상 없다**. 본 ADR 은 그 반전을 코드에 반영하는 것이지 새 반전을 만드는 것이 아니다.
4. **조기 관점 점검**: scope 는 §1.1 로 동결. 순수 inline 텍스트 흐름(rich text 안의 inline 요소) 은 Text/Paragraph 노드의 Skia Paragraph 소관이라 본 ADR 밖이다. 완전한 IFC(대안 D) 는 기각.

## 2. 실측 인벤토리 (2026-08-31, 코드 0 변경)

### 2.1 치환이 일어나는 자리 (substitution registry seed)

| #   | 자리                                                                                        | 치환 내용                                                                        | 엔진 구현 여부                                                                                                             | 갈래 |
| --- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | :--: |
| S1  | `taffyDisplayAdapter.ts:526-536` `toTaffyDisplay`                                           | block 부모 + inline-level 자식 → `INLINE_BLOCK_PARENT_CONFIG` (flex row wrap)    | **구현됨** — `block.rs:141-215` inline-block line box                                                                      |  A   |
| S2  | `taffyDisplayAdapter.ts:436-440` `needsBlockChildFullWidth` + `fullTreeLayout.ts:2386` §5.5 | S1 안의 block 형제에 width:100% 보정 (명시 폭이면 미보정 → ADR-198 catalog 발산) | S1 제거 시 소멸 — block.rs 가 auto→stretch 처리                                                                            |  A   |
| S3  | `taffyDisplayAdapter.ts:250-254` `INLINE_BLOCK_LEAF_CONFIG`                                 | inline-block 자신 → block leaf + flexGrow/Shrink 0                               | S1 제거 시 소멸 — tree.rs:4607 이 display code 1 로 전달                                                                   |  A   |
| S4  | `taffyDisplayAdapter.ts:521-523`                                                            | 순수 `display:inline` 요소 → block 격상                                          | **미구현** — block.rs display code 는 0/1/2 뿐, inline box 없음                                                            |  B   |
| S5  | `utils.ts:4397-4400` intrinsic width 주입 (`INLINE_BLOCK_TAGS`)                             | fit-content 에뮬레이트 — block 처리 시 100% 확장 방지                            | 부분 — block.rs 는 `FIT_CONTENT` 센티넬을 받음(tree.rs:4614). 주입 자체는 content 측정이라 유지 대상, **분류 원천만** 교체 |  A′  |
| S6  | `taffyDisplayAdapter.ts` 규칙 4 `resolveInlineBlockAlignItems`                              | vertical-align → flex alignItems 근사                                            | **구현됨** — block.rs `vertical_align/baseline/line_height` 필드, 단 tree.rs:4590 "미소비"                                 |  A   |
| S7  | float / clear / writing-mode / 다단                                                         | (치환 없음 — 조용히 무시)                                                        | **미구현** (ADR-916 1-C 명시)                                                                                              |  B   |
| S8  | grid subgrid / intrinsic track / dense / baseline                                           | (치환 없음 — 폴백 0 또는 무시)                                                   | **미구현** (ADR-916 1-B 명시)                                                                                              |  B   |

### 2.2 가려진 엔진 경로 (A 의 근거)

```
fullTreeLayout.ts:1156   toTaffyDisplay(display, childDisplays, childElements)
  → block 부모 + inline-level 자식 ⇒ INLINE_BLOCK_PARENT_CONFIG
TaffyBlockEngine.ts:118  result.display = taffyConfig.taffyDisplay   // "flex"
tree.rs:3598             classify_container_display("flex") → Flex → solve_flex
```

`solve_block` 의 inline-block 경로(`tree.rs:4607` display code 1) 는 "block 부모 + inline-block 자식 + 어댑터 미개입" 일 때만 도달하는데, 어댑터는 inline-level 자식이 하나라도 있으면 항상 개입한다 → **live 빌더에서 도달 불가**. cargo test(`block.rs` 19 + golden) 만 지나간다. `tree.rs:4590` 은 `vertical_align/baseline/line_height` 를 미소비로 선언.

### 2.3 이중 선언

- `utils.ts:4400` `INLINE_BLOCK_TAGS` — 손으로 관리하는 타입 집합(button/badge/chip/checkbox/…/disclosureheader). catalog `COMPONENT_RULES_TABLE` 의 display 와 별개 원천.
- `taffyDisplayAdapter.ts` 의 `parseDisplay/classifyChildDisplay/blockifyDisplay/isInlineLevel` — `display.rs` 에 이미 이식(ADR-916 2-A). 두 벌.

### 2.4 ingress (문서에 display 가 들어오는 길)

| 경로              | 실측                                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 팔레트 factory    | `factories/definitions/{DateColor,Form,Overlay}Components.ts` 에 `display:"block"` **11곳**(3파일). frame 은 `display:flex; flexDirection:column`(live 실측)                     |
| Style 패널        | `styleOptions.ts:68-74` `DISPLAY_OPTIONS` = block/flex/inline/inline-block/inline-flex/grid/none. `LayoutSection.tsx:280` block 토글                                             |
| import (pencil)   | `adapters/pencil/*` — display 매핑 여부 Phase 0 에서 실측                                                                                                                        |
| AI assistant 생성 | ADR-134 계열 — 생성 문서가 hydration chain 을 지나는지 Phase 0 에서 실측                                                                                                         |
| 기존 직렬화 문서  | `adapters/canonical/index.ts:334-343` migration chain(`migrateCircleLeafInlineSize(migrateFieldInlineLayout(migrateCheckboxRadioItemsStructure(…)))`) — **단일 chokepoint 선례** |

### 2.5 낡은 명명

비테스트 **14 파일**이 Taffy 식별자 사용(`TaffyBlockEngine.ts`, `TaffyFlexEngine.ts`, `TaffyGridEngine.ts`, `TaffyStyle`, `toTaffyDisplay`, `taffyDisplayAdapter.ts`, `persistentTaffyTree.ts` …). 헤더 `:20 "=== Taffy 시뮬레이션 규칙 ==="`, `:521 "Taffy는 inline formatting context를 지원하지 않으므로"`. ADR-916 endgame 7/7 이 "주석 정리" 를 선언했으나 잔존.

## 3. Phase 분해

각 Phase 는 독립 commit 가능 상태로 끝난다. HIGH 위험이 귀속된 Phase 는 **3 (cutover)** 하나다.

### Phase 0 — inventory freeze + baseline (G0)

- [ ] §2.1 registry 를 `apps/builder/src/builder/workspace/canvas/layout/engines/substitutionRegistry.ts` 로 코드화 — 항목마다 `{ id, where, engineSupport: "native"|"none"|"partial", track: "A"|"B", differentialCase?: string }`. 이 시점에는 **선언만**, 동작 변경 0.
- [ ] BC 정량 — (a) factory 11곳의 block 컨테이너가 inline-level 자식을 갖는지 (자식 type ∈ `INLINE_BLOCK_TAGS`) 정적 집계, (b) 로컬 프로젝트 문서 스캔 스크립트(`scripts/adr-923/scan-block-inline.mjs`): "block 컨테이너 + inline-level 자식" 노드 수 / 전체 컨테이너 수 = **영향 %**, 평균 재직렬화 파일 수. 결과를 본 문서 §6 에 기록.
- [ ] 성능 baseline — 5k fixture(메모리 `project-frame-drop-map-5k-baseline`) 로 `computeLayout` p50/p95 측정, block 컨테이너 비율 기록.
- [ ] pencil import / AI 생성 경로가 hydration chain 을 지나는지 실측(§2.4 두 칸 채움).
- [ ] ADR-156 차등 하니스(`tests/parity/**`, `@vitest/browser`) 가 "어댑터 우회 + 엔진 직접 호출" 모드를 지원하는지 확인 — 없으면 Phase 1 에서 추가.

### Phase 1 — 엔진 block/inline 경로의 Chrome 차등 증명 (G1 전반)

- [ ] 차등 케이스 ≥ 12 (Chrome `getBoundingClientRect` ground truth, ADR-156 방식): inline-block 2개 한 줄 / wrap / **명시 폭 block 형제**(ADR-198 catalog 재현) / auto 폭 block 형제 / vertical-align top·middle·bottom·baseline / line-height 명시 / 자식 margin / empty block 형제 / 부모 padding.
- [ ] 케이스를 **어댑터 우회**로 엔진 block 경로에 직접 넣어 실행(테스트 전용 진입점 — 프로덕션 seam 아님). 실패 케이스는 block.rs / tree.rs 결함으로 기록 → Phase 2 에서 수리.
- [ ] 통과 기준: 위치 ≤ 1px, 크기 ≤ 1px (ADR-156 §3 허용치 그대로 — 넓히지 않는다).

### Phase 2 — tree.rs 미소비 필드 배선 + 결함 수리

- [ ] `tree.rs write_block_item` 에 `vertical_align / baseline / line_height` 실제 값 전달 (`NodeStyle` 확장 — cascade.rs/style.rs). baseline 은 leaf 측정값(텍스트 first-line) 이 있으면 그것, 없으면 bottom.
- [ ] TS: `verticalAlign`, `lineHeight` 를 엔진 style 로 통과(`TaffyBlockEngine.ts` → 개명 전이라도 필드 추가).
- [ ] Phase 1 실패 케이스 수리. cargo test + golden 갱신은 **Chrome 값으로만**.
- [ ] G1 전반 재실행 → 전부 통과.

### Phase 3 — cutover: TS IFC 시뮬레이션 제거 (G1 후반 · G2 · G3) — **HIGH 귀속 Phase**

- [ ] `toTaffyDisplay`: block 부모는 자식 분류와 무관하게 `{ taffyDisplay: "block" }` 반환. `INLINE_BLOCK_PARENT_CONFIG`, `INLINE_BLOCK_LEAF_CONFIG`, `resolveInlineBlockAlignItems`, `isInlineBlockSimulationParent`, `needsBlockChildFullWidth` 삭제.
- [ ] `fullTreeLayout.ts` §5.5 width:100% 보정 블록 삭제. `:1154-1156` 주석 재작성.
- [ ] inline-block 자식은 `display:"inline-block"` 을 그대로 엔진에 전달(tree.rs:4607 이 code 1 로 읽음).
- [ ] ADR-198 `crossLeg.browser.test.ts` catalog-state-paint: `KNOWN_LAYERS` 를 **결과로만** 갱신 (L1 fail → pass 기대). 예산 무변경.
- [ ] ADR-198 `blockInlineProbe.browser.test.ts` 4 변형 전부 두 leg 일치.
- [ ] 성능: Phase 0 baseline 대비 p95 ≤ +5% (G3).
- [ ] 회귀: builder/shared/specs vitest 전량 + `pnpm gate:visual-parity` full.
- [ ] 이 Phase 는 **단일 commit** — 실패 시 그 commit 만 revert. 런타임 플래그 도입 금지(메모리 `project-pixijs-removal-residue-gates-always-false`).

### Phase 4 — 단일 선언 (G4)

- [ ] `INLINE_BLOCK_TAGS` 손 목록 → catalog 파생: `packages/shared/src/catalog` 에서 rule 의 `containerStyles.display`(또는 leaf 기본 display) 가 inline-level 인 type 집합을 생성 시점에 뽑는 `inlineLevelTypes` export. 손 목록과의 diff 를 테스트로 고정한 뒤 손 목록 삭제.
- [ ] catalog 미등록 native 3종(frame/group/slot) 은 spec 의 `element`/display 로 분류.
- [ ] TS `parseDisplay/classifyChildDisplay/blockifyDisplay/isInlineLevel` 중 엔진 호출 전에 필요한 것(intrinsic size 주입 게이트) 만 남기고, 나머지는 `display.rs` 결과를 신뢰 — 남기는 함수는 `display.rs` 와 동일 입력·출력 table test 로 묶는다.

### Phase 5 — B: 미구현 의미의 ingress 정규화 / 선언된 치환 (G5)

항목별 판정(§2.1 S4/S7/S8):

- [ ] **S4 순수 inline 요소**: 요소 단위 `display:inline` 은 문서에서 `inline-block` 으로 정규화 — hydration chain 에 `migrateInlineElementDisplay` 멱등 migration 추가 + 패널 `DISPLAY_OPTIONS` 에서 `inline` 제거 + factory/import 경로 동일 정규화. Preview CSS 도 같은 값을 받으므로 두 leg 이 같은 의미를 본다. (텍스트 안 inline 은 Text/Paragraph 소관 — 대상 아님.)
- [ ] **S7 float/clear/writing-mode/다단**: 패널 노출 없음 확인. import 에서 들어오면 strip + 경고 로그(정규화). registry 에 `engineSupport:"none", track:"B", normalized:true` 기록.
- [ ] **S8 grid 미구현 4종**: 정규화 불가(의미 손실) → **선언된 치환**으로 registry 등록 + 각 1 차등 케이스(현재 폴백이 Chrome 과 얼마나 다른지 수치 고정 — ratchet). 구현은 별도 ADR.
- [ ] 게이트 테스트: 어댑터가 문서 display class 와 다른 class 를 엔진에 넘기는 경우가 registry 항목 밖에서 발생하면 실패 (`substitutionRegistry.test.ts`).

### Phase 6 — 명명 정리 + 문서

- [ ] Taffy 식별자 14 파일 개명: `taffyDisplayAdapter.ts → displayAdapter.ts`, `TaffyBlockEngine.ts → blockStyleAdapter.ts`, `TaffyStyle → EngineStyle`, `toTaffyDisplay → toEngineDisplay` 등. import 갱신, 테스트 파일 동반.
- [ ] 헤더 재작성: "시뮬레이션 규칙" 절 삭제 → "번역 규칙 + substitution registry 참조" 로.
- [ ] `docs/CHANGELOG.md` 엔트리(사용자-가시: block 컨테이너 안 inline-block 배치가 Chrome 과 일치), ADR-198 breakdown 의 catalog 발산 항목 종결 표기, ADR-916 완료 문서에 "명명 잔재 ADR-923 으로 정리" 각주.
- [ ] `### Live Exercise` 절 작성 후 Implemented 승격.

## 4. 파일 변경표

| 파일                                                                                       | Phase | 변경                                                   |
| ------------------------------------------------------------------------------------------ | :---: | ------------------------------------------------------ |
| `apps/builder/src/builder/workspace/canvas/layout/engines/substitutionRegistry.ts` (신규)  |  0·5  | 치환 선언 + 게이트 테스트 대상                         |
| `scripts/adr-923/scan-block-inline.mjs` (신규)                                             |   0   | BC 정량 스캔                                           |
| `apps/builder/tests/parity/**` (ADR-156 하니스)                                            |  1·2  | block+inline-block 차등 케이스 ≥12, 어댑터 우회 진입점 |
| `packages/composition-engine/src/tree.rs`                                                  |   2   | `write_block_item` 3 필드 실전달, `NodeStyle` 확장     |
| `packages/composition-engine/src/{cascade,style}.rs`                                       |   2   | verticalAlign/lineHeight/baseline 수용                 |
| `packages/composition-engine/src/block.rs`                                                 |   2   | Phase 1 실패 케이스 수리 (있을 때만)                   |
| `…/engines/taffyDisplayAdapter.ts`                                                         |  3·6  | IFC 시뮬레이션 제거 → 번역만; 개명                     |
| `…/engines/fullTreeLayout.ts`                                                              |   3   | §5.5 보정 삭제, `:1154` 주석                           |
| `…/engines/TaffyBlockEngine.ts`                                                            | 2·3·6 | 필드 통과; 개명                                        |
| `…/engines/utils.ts`                                                                       |   4   | `INLINE_BLOCK_TAGS` 삭제 → catalog 파생 import         |
| `packages/shared/src/catalog/**` (`inlineLevelTypes` export)                               |   4   | 생성 시점 파생                                         |
| `apps/builder/src/adapters/canonical/inlineElementDisplayMigration.ts` (신규) + `index.ts` |   5   | S4 정규화 migration, chain 편입                        |
| `apps/builder/src/builder/panels/styles/constants/styleOptions.ts`                         |   5   | `DISPLAY_OPTIONS` 에서 `inline` 제거                   |
| `apps/builder/src/adapters/pencil/**`                                                      |   5   | display 정규화 (Phase 0 실측 결과에 따라)              |
| `apps/builder/tests/visual-parity/compare/{crossLeg,blockInlineProbe}.browser.test.ts`     |   3   | ratchet 결과 갱신 (예산 무변경)                        |
| `docs/CHANGELOG.md`, ADR-198 breakdown, ADR-916 완료 문서                                  |   6   | 문서                                                   |

## 5. 검증 계획

| 검증               | 도구                                                                                         | 기준                                                            |
| ------------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 엔진 기하 ≡ Chrome | ADR-156 차등 하니스 (`@vitest/browser` + Playwright Chromium)                                | 케이스 ≥12, 위치·크기 ≤1px, 허용치 무변경                       |
| 두 leg 픽셀        | ADR-198 `pnpm gate:visual-parity` full                                                       | catalog-state-paint L1 pass, 예산 무변경, KNOWN_* 결과로만 갱신 |
| 성능               | Phase 0 baseline 스크립트 재실행                                                             | p95 ≤ +5%                                                       |
| 단일 선언          | `inlineLevelTypes` vs 구 `INLINE_BLOCK_TAGS` diff 테스트 → 삭제 후 catalog 변경 시 자동 추종 | diff 0 (삭제 직전), 이후 손 목록 부재                           |
| 치환 선언 완전성   | `substitutionRegistry.test.ts`                                                               | registry 밖 class 변경 0                                        |
| 회귀               | builder / shared / specs / engine cargo test                                                 | 전량 PASS, 실패 시 원인 기록 후 수리 (fixture 변경 금지)        |
| live               | 실제 빌더 Chrome MCP: block 컨테이너 + Button 2개 + 폭 명시 div                              | Canvas 와 Preview 배치 일치, 패널 값과 화면 일치                |

## 6. Phase 0 측정 결과 (착수 시 채움)

- 영향 %: `[TODO]`
- 평균 재직렬화 파일 수: `[TODO]`
- factory 11곳 중 inline-level 자식 보유: `[TODO]`
- layout p50/p95 baseline: `[TODO]`
- import / AI 경로 hydration 통과 여부: `[TODO]`

## 7. 롤백

- Phase 3 은 단일 commit — revert 로 즉시 원복. 다른 Phase 는 동작 변경이 없거나(0·1·6) 추가만(2·4·5) 이라 개별 revert 가능.
- migration(Phase 5) 은 멱등이고 값 정규화뿐이라 스키마 롤백 불필요. 정규화 전 값이 필요하면 revert 후 재hydration.

## 8. 별도 ADR 로 넘기는 것

- grid 미구현 4종 구현 (S8) — 본 ADR 은 선언·수치 고정까지.
- 완전한 IFC(순수 inline box, 텍스트 run 과 요소 혼합, float) — 대안 D, 기각.
- ADR-198 Phase 6 대표 매트릭스 — ADR-198 소관. 본 ADR 의 차등 케이스가 그 매트릭스의 "CSS 의미" 패밀리 입력이 된다.
