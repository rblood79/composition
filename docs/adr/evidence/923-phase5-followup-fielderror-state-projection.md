# ADR-923 Phase 5 후속 — FieldError 상태 투영 (2026-09-03)

> 대상: [ADR-923](../completed/923-layout-vocabulary-closure.md) breakdown "Phase 5 후속" 3항 (HC2 r31m1 `fieldErrorStates`). 실행 Claude, 착수 지시 사용자 (Codex 의 "1번 단독 착수 · 5-심볼 조건 추가" 판단을 코드로 검증한 뒤). 새 ADR 없이 breakdown 항목으로 수리 — `create-adr` 는 사용자 전용. 착수 전 확정 사실: [phase5 evidence §5·§9](923-phase5-cutover.md), 리뷰 r16m1 (description/errorMessage 축 관찰), r31m1 (같은 상태 짝).

## 0. 요약

- **범위**: `FIELD_VISIBLE_CHILD_TAGS` 가 FieldError 를 허용하는 field 5 — TextField · TextArea · NumberField · DateField · TimeField. Description 축 (후속 목록 9번) 은 제외 (factory 에 Description 자식 없음 · 기존 문서 호환 — 별도 결정).
- **증상**: parent `isInvalid:true` 에서 DOM 은 RAC `FieldError` 가 `<span>` (display:block, 글자 = parent `errorMessage`) 을 렌더하는데 Canvas 는 factory inline `display:none` 그대로 — HC2 `투영필요(후속)` 1.
- **root cause 3겹** (수리 중 실측으로 드러난 순서):
  1. parent `isInvalid`/`errorMessage` → FieldError 자식 투영 규칙이 없다 (`propagationRegistry` 에는 r16m1 의 label 축만).
  2. 규칙을 넣어도 layout batch 는 `none` 그대로 — `fullTreeLayout` 의 read-time propagation (`resolvePropagatedProps`) 이 부모 단계의 `effectiveGetChildElements` 래퍼에만 걸려 부모 **측정** 에만 쓰였다. post-order 라 자식은 부모보다 먼저 elementsMap 원본으로 batch 에 오르고, 3.6 implicit 패치는 `applyImplicitStyles` 가 바꾼 style 만 옮긴다. 또 `asStyle` patch 는 `{style:{display}}` 만 담아 얕은 spread 가 자식 style 전체를 바꾼다 (fontSize 소실).
  3. 글자 있는 FieldError 높이 Canvas 24 vs DOM 21 (TextField·TextArea) / 18 (Number·Date·TimeField): production 트리 (팔레트 creation) 의 FieldError 는 `style:{display:"none"}` 뿐 — factory 정의의 `fontSize:12` 가 creation 경로에서 벗겨져 기본 16 → 16×1.5. DOM 의 원천은 parent rule `structure.composition.delegation[]` 의 `.react-aria-FieldError` 항목 (size 별 `--tf-hint-size: var(--text-sm)` → generated CSS `--error-font-size` bridge → base.css `.react-aria-FieldError { font-size: var(--error-font-size, var(--text-xs)) }`): TextField md 14 · NumberField/DateField/TimeField md 12. FieldError 자체 rule 은 md 12 (text-xs) 라 자체 rule 만 읽어도 TextField 가 갈린다. TextArea 는 root class 가 `react-aria-TextField` 라 (D1, `TextArea.tsx` 머리말) TextField.css 의 규칙을 받고 자기 rule 에는 FieldError 항목이 0.
- **수리** (Rust 무변경):
  - `propagationRegistry.ts` — `fieldErrorStatePropagationRules` 2 규칙 (`errorMessage → FieldError.children` override · `isInvalid → FieldError style.display` asStyle + transform `v ? "block" : "none"`) 을 5 field 배열에 spread. parent 에 `isInvalid` 키가 없으면 규칙이 걸리지 않아 factory `none` 유지 (legacy 문서 migration 불요). 가시성 게이트는 RAC 와 같이 `isInvalid` 만 — `errorMessage` 는 글자만.
  - `fullTreeLayout.ts` — `traversePostOrder` 진입 직후 자식 자신에게 `resolvePropagatedProps` 적용 (Skia `applyParentPropagationProps` 와 같은 방향), `asStyle` patch 는 자식 style 위에 깊게 병합 (부모 래퍼 경로도 같은 병합으로 정정). FieldError 이면 `style.fontSize` 부재 시 delegation 값 주입 (lineHeight 는 주입하지 않음 — DOM 이 root `line-height: 1.5` 를 상속하고 Canvas 기본 fs×1.5 가 같은 값).
  - `packages/shared/src/catalog/resolvers/resolveDelegatedChildFontSize.ts` (신설, `@composition/shared` export) — parent rule delegation 의 childSelector 항목에서 size 별 `-size` 변수 (`bridges["--error-font-size"]` 가 가리키는 것 우선) 를 `var(--text-*)` → typography 토큰 px 로. 직접 항목 없을 때만 alias (`textarea → TextField`). layout·Skia (`buildSpecNodeData` FieldError 분기, 인라인 `style.fontSize` 우선) 가 같은 값을 읽는다.
  - `editorMutationEffectRegistry.ts` — `isInvalid` · `errorMessage` 를 `LAYOUT_AFFECTING_PROP_SOURCE` (계층 A) · `LAYOUT_PROP_CACHE_SOURCE` (계층 B) · `CONTENT_BOX_PROP_KEYS` 에 등재. ADR-187 Phase 0 fixture (`187-phase-0-invalidation-baseline.json`) 동기화. Inspector 는 자식 store 에 쓰므로 (`children`·`style.display`) 자식 키로도 재계산되지만, Inspector 아닌 writer (AI · import · canonical patch) 가 parent 만 바꾸는 경로가 이 등재로 닫힌다. r21m1 TagGroup 슬롯 가시성 (`isTagGroupSlotChildVisible`, parent `errorMessage` 소비) 도 같은 등재로 재계산 (코드상 — TagGroup live 재현은 하지 않음).

## 1. 실측 — 5 field × 4 상태, DOM vs pipeline (400px, `adr923FieldErrorStateProjection.browser.test.ts`)

상태: `valid-empty` (isInvalid:false · "") · `valid-text` (false · "required") · `invalid-empty` (true · "") · `invalid-text` (true · "required"). parent top-level props 만 바꾸고 자식 FieldError 노드는 손대지 않는다 (Inspector 아닌 writer 경로 = read-time propagation 만으로 같은 답).

| family      | state         | DOM FieldError (display / h / y) | DOM root h | Canvas 수리 전 (batch display / root h) | Canvas 수리 후 (display / h / y / root h) |
| ----------- | ------------- | -------------------------------- | ---------- | --------------------------------------- | ----------------------------------------- |
| TextField   | valid-\*      | (없음)                           | 56         | none / 56                               | none / 0 / – / 56                         |
| TextField   | invalid-empty | block / 0 / 62                   | 62         | none / 56                               | block / 0 / 62 / 62                       |
| TextField   | invalid-text  | block / 21 / 62                  | 83         | none / 56 (규칙 후 24 / 86)             | block / 21 / 62 / 83                      |
| TextArea    | valid-\*      | (없음)                           | 96         | none / 106                              | none / 0 / – / 106                        |
| TextArea    | invalid-empty | block / 0 / 102                  | 102        | none / 106                              | block / 0 / 112 / 112                     |
| TextArea    | invalid-text  | block / 21 / 102                 | 123        | none / 106 (규칙 후 24 / 136)           | block / 21 / 112 / 133                    |
| NumberField | invalid-empty | block / 0 / 62                   | 62         | none / 56                               | block / 0 / 62 / 62                       |
| NumberField | invalid-text  | block / 18 / 62                  | 80         | none / 56 (규칙 후 24 / 86)             | block / 18 / 62 / 80                      |
| DateField   | invalid-text  | block / 18 / 62                  | 80         | none / 56 (규칙 후 24 / 86)             | block / 18 / 62 / 80                      |
| TimeField   | invalid-text  | block / 18 / 62                  | 80         | none / 56 (규칙 후 24 / 86)             | block / 18 / 62 / 80                      |

- DOM computed: TextField·TextArea FieldError `font 14px / lh 21px` (root 14/21) · NumberField `12/18` (root 14/21) · DateField·TimeField `12/18` (root 16/24) → line-height 는 root `1.5` 상속, font-size 는 parent delegation.
- `invalid-empty`: RAC 는 children `""` 를 null 로 보지 않아 빈 `span:block` 이 남는다 (높이 0, column gap 6 만 증가). Canvas 도 빈 글자 leaf 높이 0 + gap.
- **TextArea 본체 격차 (범위 밖, 기록)**: valid 상태 root 높이 Canvas 106 vs DOM 96 — FieldError 와 무관한 기존 격차 (Label 20 + gap 6 + textarea). 이 테스트는 FieldError 배치를 "valid 상태 root 높이 기준 offset (= gap)" 과 "root 높이 증분 (Δ = gap + FieldError)" 으로 격리해 잰다 (TextArea Δ 6 / 27 양쪽 동일). 본체 격차는 후속 목록에 둔다.
- **catalog ↔ CSS 관찰**: FieldError 자체 rule 은 `lineHeight: text-xs--line-height (16)` 을 선언하지만 FieldError CSS 에는 line-height 가 없어 DOM 은 root 1.5 를 상속한다 — Canvas 는 DOM 을 따른다 (rule 의 lineHeight 미소비). rule 정본 정정 여부는 별도 판단.

## 2. 게이트

| 게이트                                                         | 내용                                                                                                                                                                                                                                                                | 결과          |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `src/builder/utils/adr923FieldErrorStateBridge.test.ts`        | factory 전제 (5 family FieldError `""`+`none`) · read-time patch (block/none/부재) · Inspector 쓰기 (`buildPropagationUpdates` → 자식 `style.display` / `children`) · delegation font-size (md 14/14/12/12/12 · xs 10 · lg 16 · Button undefined) · 5-심볼 A/B 등재 | 6 PASS        |
| `tests/parity/adr923FieldErrorStateProjection.browser.test.ts` | 상자 유무 (DOM 은 isInvalid 만) · display block + 높이 ≤1px + y offset (valid root 높이 기준) ≤1px · Δroot (gap + FieldError) ≤1px — 5 × 4                                                                                                                          | 3 PASS        |
| `tests/parity/adr923Hc2DisplayJudgment.browser.test.ts`        | `fieldErrorStates.invalid` canvas `block` · FieldError verdict `일치(outer)` · 7 범주 분포 `일치(outer)` 14 · `투영필요(후속)` 키 소멸                                                                                                                              | 3 PASS (반전) |
| `performance/editorPresentationPhase0Baseline.static.test.ts`  | ADR-187 fixture 5 view 정확 순서 (isInvalid·errorMessage 추가)                                                                                                                                                                                                      | PASS          |
| 회귀                                                           | type-check · builder unit 5189 (656 파일) · focused adr923 10 파일 127 · full parity 1071 (기존 GridListItem/Tooltip 2 FAIL · skipped 2) · Rust 무변경 (cargo 생략)                                                                                                 | PASS          |

**원복 RED** (편집 역적용 → 실행 → 원본 복사로 복귀, 파일 4개 grep 으로 복귀 확인):

| 원복                                                              | RED                                                           |
| ----------------------------------------------------------------- | ------------------------------------------------------------- |
| (a) 5 배열의 `...fieldErrorStatePropagationRules` 제거            | bridge 3 FAIL (read-time 2 · Inspector 쓰기) + browser 3 FAIL |
| (b) 자식 visit propagation 차단 (`propagationParent = undefined`) | browser 3 FAIL (상자 유무부터)                                |
| (c) fontSize delegation 주입 차단 (`feParent = undefined`)        | browser 2 FAIL (높이 24 vs 21/18 · Δroot)                     |
| (d) `isInvalid`·`errorMessage` 등재 제거 (registry 3 곳)          | bridge 1 (5-심볼) + Phase 0 fixture 1 FAIL                    |

## 3. Live Exercise (2026-09-03, Chrome MCP, localhost:5173 프로젝트 "123" Page 3 — 작업 트리 = 이 커밋)

1. 팔레트 검색 "text field" → 클릭: TextField (Label 63×20 · Input 390×30 @y26 · FieldError `{children:"", style:{display:"none"}}` rect 0) root 390×56 — production 트리에 fontSize 없음 확인.
2. **Inspector 아닌 writer** — `updateElementProps(tf, { isInvalid:true, errorMessage:"Required field" })`: Skia FieldError 87×21 @(0,62), TextField 56 → 83, 빨간 "Required field" 그려짐; 자식 store 는 `{children:"", style:{display:"none"}}` 그대로 (read-time 투영만으로 동작).
3. **Inspector** — Properties 패널 State 절 "Invalid" 스위치 OFF: `isInvalid:false`, FieldError rect 0, TextField 56, 자식 store `style.display:"none"` 기록 (`buildPropagationUpdates`). ON: 83/21, 자식 `display:"block"`. "Error Message" 입력 "Please fill in this field" + Return: 자식 `children` 갱신, FieldError 폭 87 → 130, Canvas 글자 갱신.
4. **publish DOM** (헤더 눈 아이콘 → `#page-b0dbc864…`, `[data-element-id]` 로 조회): FieldError `span` display block · `font-size 14px / line-height 21px` · 높이 21 · 폭 129.8 (Skia 130) · y 63 (Skia 62 — Input 31 vs 30 의 기존 1px) · root 84 (Skia 83) · 색 negative.
5. 콘솔 에러 0. 정리: TextField + 자식 3 삭제 → Page 3 `body · AvatarGroup · Avatar ×3` 원복.

## 4. 후속 (착수 금지 — 기록만)

- TextArea 본체 높이 Canvas 106 vs DOM 96 (Label/gap/textarea 합산 — FieldError 무관 기존 격차).
- Description 축 (후속 9번): factory 에 Description 자식 없음 · `description` 키는 체인에 이미 등재 · 자식 생성 + 기존 문서 호환이 핵심 — 사용자 결정 별도.
- catalog FieldError rule `lineHeight` (16) vs DOM 상속 1.5 — rule 정본 정정 여부.
- TagGroup errorMessage 체인 등재 효과의 live 재현 (코드상 성립, 미확인).
