# ADR-923 Phase 5 후속 — FieldError 상태 투영 (2026-09-03)

> 대상: [ADR-923](../completed/923-layout-vocabulary-closure.md) breakdown "Phase 5 후속" 3항 (HC2 r31m1 `fieldErrorStates`). 실행 Claude, 착수 지시 사용자 (Codex 의 "1번 단독 착수 · 5-심볼 조건 추가" 판단을 코드로 검증한 뒤). 새 ADR 없이 breakdown 항목으로 수리 — `create-adr` 는 사용자 전용. 착수 전 확정 사실: [phase5 evidence §5·§9](923-phase5-cutover.md), 리뷰 r16m1 (description/errorMessage 축 관찰), r31m1 (같은 상태 짝).

## 0. 요약

- **범위**: `FIELD_VISIBLE_CHILD_TAGS` 가 FieldError 를 허용하는 field 5 — TextField · TextArea · NumberField · DateField · TimeField. Description 축 (후속 목록 9번) 은 제외 (factory 에 Description 자식 없음 · 기존 문서 호환 — 별도 결정).
- **증상**: parent `isInvalid:true` 에서 DOM 은 RAC `FieldError` 가 `<span>` (display:block, 글자 = parent `errorMessage`) 을 렌더하는데 Canvas 는 factory inline `display:none` 그대로 — HC2 `투영필요(후속)` 1.
- **root cause 3겹** (수리 중 실측으로 드러난 순서):
  1. parent `isInvalid`/`errorMessage` → FieldError 자식 투영 규칙이 없다 (`propagationRegistry` 에는 r16m1 의 label 축만).
  2. 규칙을 넣어도 layout batch 는 `none` 그대로 — `fullTreeLayout` 의 read-time propagation (`resolvePropagatedProps`) 이 부모 단계의 `effectiveGetChildElements` 래퍼에만 걸려 부모 **측정** 에만 쓰였다. post-order 라 자식은 부모보다 먼저 elementsMap 원본으로 batch 에 오르고, 3.6 implicit 패치는 `applyImplicitStyles` 가 바꾼 style 만 옮긴다. 또 `asStyle` patch 는 `{style:{display}}` 만 담아 얕은 spread 가 자식 style 전체를 바꾼다 (fontSize 소실).
  3. (**round 2 에서 전제 정정 — §5-1 feh1**) 글자 있는 FieldError 높이 Canvas 24 vs DOM 21 (TextField·TextArea) / 18 (Number·Date·TimeField): production 트리 (팔레트 creation) 의 FieldError 는 `style:{display:"none"}` 뿐 — factory 정의의 `fontSize:12` 가 creation 경로에서 벗겨져 기본 16 → 16×1.5. DOM 의 원천은 parent rule `structure.composition.delegation[]` 의 `.react-aria-FieldError` 항목 (size 별 `--tf-hint-size: var(--text-sm)` → generated CSS `--error-font-size` bridge → base.css `.react-aria-FieldError { font-size: var(--error-font-size, var(--text-xs)) }`): TextField md 14 · NumberField/DateField/TimeField md 12. FieldError 자체 rule 은 md 12 (text-xs) 라 자체 rule 만 읽어도 TextField 가 갈린다. TextArea 는 root class 가 `react-aria-TextField` 라 (D1, `TextArea.tsx` 머리말) TextField.css 의 규칙을 받고 자기 rule 에는 FieldError 항목이 0.
- **수리** (Rust 무변경):
  - `propagationRegistry.ts` — `fieldErrorStatePropagationRules` 2 규칙 (`errorMessage → FieldError.children` override · `isInvalid → FieldError style.display` asStyle + transform `v ? "block" : "none"`) 을 5 field 배열에 spread. parent 에 `isInvalid` 키가 없으면 규칙이 걸리지 않아 factory `none` 유지 (legacy 문서 migration 불요). 가시성 게이트는 RAC 와 같이 `isInvalid` 만 — `errorMessage` 는 글자만.
  - `fullTreeLayout.ts` — `traversePostOrder` 진입 직후 자식 자신에게 `resolvePropagatedProps` 적용 (Skia `applyParentPropagationProps` 와 같은 방향), `asStyle` patch 는 자식 style 위에 깊게 병합 (부모 래퍼 경로도 같은 병합으로 정정). FieldError 이면 delegation 값 주입 (**round 2·3 정정**: 인라인 `style.fontSize` 가 있어도 delegation 이 이기고, 인라인 `style.lineHeight` 는 걷어낸다 — §5-1 feh1 · §6 fe2h1).
  - `packages/shared/src/catalog/resolvers/resolveDelegatedChildFontSize.ts` (신설, `@composition/shared` export) — parent rule delegation 의 childSelector 항목에서 size 별 `-size` 변수 (`bridges["--error-font-size"]` 가 가리키는 것 우선) 를 `var(--text-*)` → typography 토큰 px 로. 직접 항목 없을 때만 alias (`textarea → TextField`). layout·Skia (`buildSpecNodeData` FieldError 분기) 가 같은 값을 읽는다 (**round 2 정정**: 인라인 우선 아님 — delegation 우선, §5-1 feh1).
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
- **catalog ↔ CSS 관찰** (round 2 정정 — §5-1 feh3): FieldError 자체 rule 은 `lineHeight: text-xs--line-height (16)` 을 선언하고 catalog 파생 `generated/FieldError.css` 도 그것을 emit 하지만 **그 파일이 `styles/index.css` 의 import 66개에 없다** — 활성 bundle 에는 `.react-aria-FieldError` 줄 높이 규칙이 없어 DOM 은 root `1.5` 를 상속한다. layout 은 fs×1.5 fallback 이라 우연히 맞았지만 **Skia 는 rule 의 16 을 실제로 소비**했다 (round 1 의 "Canvas 는 DOM 을 따른다" 는 layout 만 본 서술). round 2 에서 Skia 도 root 상속 비율을 쓰도록 수리.

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

## 5. Codex 판독 round 2 (2026-09-03) — HIGH 3 · MEDIUM 1 · LOW 1 전부 수리

round 1 의 정상 게이트·원복 (a)~(d) 는 판독에서 그대로 재현됐다. 아래 3건은 **round 1 이 사실로 적은 전제가 틀렸던** 것이고, 전부 코드·live 로 확증한 뒤 수리했다.

### 5-1. 판독이 뒤집은 사실

| id       | round 1 이 적은 전제                                                    | 실제                                                                                                                                                                                                                                                                           |
| -------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **feh1** | "production 트리 FieldError 에는 fontSize 가 없다"                      | factory 5곳 + Form origin 1곳이 인라인 `fontSize: 12` 를 심는다 (`FormComponents.ts` ×3 · `DateColorComponents.ts` ×2 · `formTemplateOrigins.ts`). 신규 트리에서 그 값이 사라진 이유는 feh2 의 얕은 병합이었다 — 즉 feh2 를 고치면 인라인 12 가 되살아나 resolver 를 우회한다. |
| **feh2** | (미인지)                                                                | `asStyle` patch 를 store 쓰기 경로가 props 최상위 **얕은** 병합으로 처리해 자식 style 전체가 `{display}` 로 갈린다 (`batchUpdateElementProps` `{...element.props, ...props}`). 사용자가 준 fontSize·color·width 손실 경로.                                                     |
| **feh3** | "catalog rule 의 lineHeight 16 은 DOM 이 안 읽으니 Canvas 도 안 읽는다" | layout 은 fs×1.5 fallback 이라 맞았지만 **Skia 는 `size.lineHeight` 로 16 을 실제 소비**한다 (browser 실측 skia 14/16 vs dom 14/21).                                                                                                                                           |

### 5-2. live 재실측 — feh1 은 harness 한정이 아니었다 (Chrome MCP, 프로젝트 123 Home)

publish DOM 의 `.react-aria-FieldError` 에는 **`data-element-id` 가 없다** — Preview/publish 는 canonical FieldError 자식이 아니라 **RAC 자체 FieldError** 를 그린다. 자식에 얹은 인라인 style 은 DOM 에 도달할 채널이 아예 없다 (실측: 자식에 `color: rgb(0,128,0)` · `width: 123px` · `fontSize: 12` 를 줘도 publish 는 negative 색 · 88.2px · 14px/21px).

| 상태                                      | Canvas (Skia rect)            | publish DOM                         |
| ----------------------------------------- | ----------------------------- | ----------------------------------- |
| 신규 트리 (인라인 없음)                   | FieldError 89×21 @y62 · TF 83 | 14px/21px · h 21 · y 63 · TF 84     |
| 옛 문서 재현 (자식 `fontSize:12`) 수리 전 | 76×18 @y62 · TF 80            | 14px/21px · h 21 · TF 84 (**갈림**) |
| 같은 트리, 수리 후                        | 89×21 @y62 · TF 83            | 같음 (일치)                         |

→ 옛 저장 문서는 **양쪽이 12 로 같아지는 게 아니라** Canvas 만 12 로 갈린다. 그래서 처방은 문서 migration 이 아니라 **read 경로에서 delegation 이 인라인을 이기게** 하는 것이다 (저장 데이터 무변경 — 사용자 문서를 조용히 고치지 않는다).

### 5-3. 수리

- `propagationEngine.ts` `buildPropagationUpdates` — `asStyle` patch 를 만들 때 대상 자식의 현재 `style` 을 씨로 깔고 그 위에 덮는다. Inspector 쓰기와 `applyFactoryPropagation` 이 같은 함수를 쓰므로 두 경로가 한 번에 닫힌다 (feh2).
- factory·origin 6곳의 인라인 `fontSize: 12` 삭제 — 글자 크기는 parent rule delegation 이 정본 (feh1 원천, D3).
- `fullTreeLayout.ts` · `buildSpecNodeData.ts` — FieldError 의 delegation 값이 **인라인 `style.fontSize` 를 이긴다** (DOM 에 인라인 채널이 없으므로). delegation 이 없을 때만 인라인/자체 rule (feh1 옛 문서).
- `resolveDelegatedChildFontSize.ts` — `ROOT_INHERITED_LINE_HEIGHT_RATIO = 1.5` + `resolveInheritedLineHeight(fontSize)` 추가 (`:root { line-height: 1.5 }` = `styles/theme/shared-tokens.css:23`). Skia 는 FieldError 의 sizeSpec `lineHeight` 를 이 값으로 덮는다 — 인라인 `style.lineHeight` 가 있으면 그것이 우선 (feh3).

### 5-4. 게이트 (round 1 대비 신설 5)

| 게이트                                                              | 무엇을 고정                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| bridge `factory 전제 — 인라인 fontSize 없음`                        | 저작 6곳 중 factory 5 (feh1 원천 재발)                              |
| `formTemplateOrigins.test` `FieldError 자식에 인라인 fontSize 없음` | Form origin (feh1 원천 재발)                                        |
| bridge `propagation 쓰기 — 자식의 기존 style 키 보존`               | Inspector + factory 두 경로 (feh2)                                  |
| bridge `Skia — delegation 글자 크기 + root 상속 줄 높이`            | Skia 소비 (feh3 · fem1) + 인라인보다 delegation 우선 (feh1 옛 문서) |
| browser `글자 metric` · `옛 문서 — 인라인 12 가 있어도 DOM 과 같다` | 5 field 의 DOM computed ↔ Skia text shape, 신규·옛 문서 두 형태     |

원복 RED (전부 재현 확인 후 원상복구):

round 2 시점의 원복 수치는 **(h) 를 넣기 전 상태에서 잰 것**이라 (f)·(g) 가 실제와 달랐다 — round 3 §6-4 의 재측정 표가 정본이다 (fe2m2).

검증: type-check · builder unit **5193** (655 파일) · focused `adr923*` **129** · full parity **1073** (기존 GridListItem/Tooltip 2 FAIL) · 브라우저 FieldError 5. builder 전량 실행 시 `ContextualActionBar.keyboard.test.tsx` 의 teardown `window is not defined` 2건이 보고되나 단독 실행은 4 PASS — 병렬 teardown flake, 본 변경과 무관 (해당 파일 무수정).

### 5-5. 잔여 (기록만)

- catalog `generated/FieldError.css` 가 `styles/index.css` 에 import 되지 않는다 (생성물 93 vs import 66). FieldError 만의 문제가 아닐 수 있다 — 미import 생성 CSS 전수 판정은 별도 작업.
- Preview/publish 가 canonical FieldError 자식의 style 을 전혀 소비하지 않는다 (RAC 자체 렌더). 이 자식은 Canvas 측 mirror 에 가깝다 — 편집 surface 로서의 위상 판정은 별도.
- 옛 저장 문서의 인라인 `fontSize: 12` 는 그대로 남는다 (read 경로가 무시). 데이터 정리가 필요하면 별도 승인 후.

## 6. Codex 판독 round 3 (2026-09-03) — HIGH 1 · MEDIUM 2 · LOW 1 전부 수리

### 6-1. fe2h1 — 인라인 `lineHeight` 도 같은 소유권 (HIGH)

round 2 는 fontSize 에만 "RAC-owned DOM" 판정을 적용하고 줄 높이는 인라인 우선으로 남겨 뒀다. 자식의 인라인 `lineHeight` 역시 DOM 에 도달할 채널이 없으므로 (Typography 패널로 실제 작성 가능) Canvas 만 갈린다 — 판독 probe `lineHeight:"10px"` 에서 Canvas 10px vs DOM 21px.

- Skia: `delegated != null` 이면 sizeSpec `lineHeight` 를 상속값으로 덮고, **raw style 의 `lineHeight` 도 걷어낸다** — "Text style overrides"(Phase A) 가 raw style 을 다시 읽어 spec 값을 덮기 때문 (숫자는 배율 해석: 10 → 14×10 = **140**, 실측).
- layout: 값을 주입하지 않고 **인라인을 걷어내기만** 한다. 빈 FieldError (invalid + 메시지 없음) 는 DOM 이 줄 상자를 만들지 않아 높이 0 이고, 측정 기본 (내용 있을 때만 fs×1.5) 이 그 계약과 같다 — 21px 을 명시 주입했더니 `invalid-empty` 가 Canvas 21 vs DOM 0 으로 깨졌다 (실측 후 철회).

### 6-2. fe2m1 — 보존은 생산자가 아니라 소비처에서 (MEDIUM)

round 2 는 `buildPropagationUpdates` 가 자식의 현재 style **전체를 복사**해 보존했는데, 그 복사본은 `sanitizePropsPatch` 를 다시 지나 `backgroundColor`/`backgroundImage`/`backgroundSize` 가 patch 로 간주돼 지워진다 (fill v2 파생 키). live 에서도 `updateElementProps` 로 준 `backgroundColor` 가 store 에 남지 않는 것을 확인했다.

- patch 는 **바꾸는 키만** 담고 (`{style:{display}}`), 생산자는 `PropagationUpdate.mergeStyle = true` 로 "부분 patch" 임을 표시한다.
- 소비처가 병합한다: store 는 `BatchPropsUpdate.mergeStyle` → `applyBatchStylePatch(현재 props, patch, mergeStyle)`, factory 는 `applyFactoryPropagation` 안에서 깊은 병합.
- 기본 (플래그 없음) 은 통째 교체를 유지 — Inspector 의 style 키 **삭제** 가 그 의미에 의존한다.

### 6-3. fe2l1 — §0 서술 동기화 (LOW)

§0 의 "인라인 `style.fontSize` 우선" · "lineHeight 는 주입하지 않음" 두 줄을 현재 계약 (delegation 우선 · 인라인 lineHeight 제거) 으로 정정.

### 6-4. 원복 RED — 전량 재측정 (fe2m2 정정)

node 5 파일 26건 (bridge 9 · formTemplateOrigins 8 · applyBatchStylePatch 3 · ADR-187 Phase 0 baseline · editorMutationEffectRegistry) · browser 5 기준. 각 원복 후 원상복구 + 재통과 확인.

| 원복                                       | node (26) | browser (5) |
| ------------------------------------------ | --------- | ----------- |
| (a) 규칙 5 field spread 제거               | 5 FAIL    | 5 FAIL      |
| (b) layout 자식 visit propagation 차단     | —         | 5 FAIL      |
| (c) layout FieldError delegation 주입 차단 | —         | 3 FAIL      |
| (d) 5-심볼 등재 제거                       | 3 FAIL    | —           |
| (e) `applyBatchStylePatch` 병합 무력화     | 1 FAIL    | —           |
| (f) factory·origin 인라인 12 복원          | 2 FAIL    | **5 PASS**  |
| (g) Skia lineHeight 덮기 제거              | 1 FAIL    | 2 FAIL      |
| (h) 인라인 fontSize 우선 복원              | 1 FAIL    | 1 FAIL      |
| (i) 인라인 lineHeight 걷어내기 제거        | 1 FAIL    | 1 FAIL      |

**(f) 의 browser 5 PASS 가 정상이다** (fe2m2): read 경로가 인라인을 이미 무시하므로 최종 동작은 변하지 않는다 — 저작 지점의 재발은 정적 source 게이트 (bridge `factory 전제` · formTemplateOrigins) 가 유일한 감시자다. round 2 표의 "browser 3 FAIL" 은 (h) 도입 전에 잰 값이었다.

### 6-5. 검증 · live

type-check · builder unit **5196** (656 파일) · focused `adr923*` **129** · full parity **1073** (기존 2 FAIL) · smoke 84.

live (Chrome MCP, 프로젝트 123 Home — 팔레트 TextField 신규 생성):

| 확인                                                     | 결과                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 자식 style 에 `fontSize:12 · lineHeight:10 · color` 주입 | Skia 89×21 @y62 · TF 83 (10 도 140 도 아님) ↔ publish 14px/21px · h 21 · TF 84 |
| Inspector Invalid OFF → ON                               | 자식 style `display` 만 바뀌고 `fontSize·lineHeight·color` 보존                |
| `updateElementProps` 로 준 `backgroundColor`             | store 에 남지 않음 — sanitizer 가 fill 파생 키를 지운다 (fe2m1 의 근거)        |

콘솔 0, 요소 정리 완료.

## 7. Codex 판독 round 4 (2026-09-03) — MEDIUM 1 수리 (HIGH 0 · LOW 0)

round 3 의 코드·수치·원복 (a)~(i) 는 판독에서 전부 VERIFIED 됐다. 열린 항목은 게이트 하나뿐이다.

### 7-1. fe3m1 — transport seam 을 실행하는 게이트가 없었다 (MEDIUM)

round 3 은 생산자 (`buildPropagationUpdates` 가 `mergeStyle` 을 붙인다) 와 최종 소비 helper (`applyBatchStylePatch` 가 병합한다) 를 각각 단위로 고정했지만, **그 사이 구간**을 실행하는 테스트가 없었다: Inspector 화면의 매핑 → `updateSelectedPropertiesWithChildren` → `sanitizeInspectorProps` → `batchUpdateElementProps` → `sanitizePropsPatch`. 중간에서 플래그가 빠져도 신설 3건은 통과한다.

특히 그 매핑이 `PropertiesPanel.tsx` 안의 **인라인 한 줄**이었다 — 화면 코드가 매핑을 다시 쓰면 어떤 단위 테스트도 그 누락을 보지 못한다.

수리 두 겹:

- 매핑을 `toBatchPropsUpdates` (propagationEngine) 단일 지점으로 뽑고 `PropertiesPanel` 이 그것을 호출한다. 인라인 재작성이 되살아나면 정적 게이트가 잡는다.
- `adr923PropagationTransport.test.ts` 신설 (3건) — mock 이 아닌 실제 체인을 돌린다: canonical document 를 얹은 store 에 TextField > {Label, FieldError} 를 두고, FieldError 자식에 `display:none · fontSize:13 · color · backgroundColor` (fill 파생 키) 를 저작한 뒤 `isInvalid: true` 로 `buildPropagationUpdates` → `toBatchPropsUpdates` → inspector slice → 실제 `batchUpdateElementProps` 를 통과시킨다. 단언은 **세 곳** — store `elementsMap` · canonical document (persist 대상) · history `nextProps` (undo/redo 가 복원하는 값) 에서 `display` 만 `block` 으로 바뀌고 나머지 3키가 그대로 남는가.

두 번째 테스트는 같은 체인에 `mergeStyle` 을 뺀 매핑을 주입해 자식 style 이 `{display:"block"}` 으로 통째 교체되는 것을 대조로 고정한다 — 계약을 양방향으로 잠근다.

### 7-2. 원복 RED — 전량 재측정 (node 26 → 29)

신설 게이트가 (a)·(e) 의 반응을 바꾸므로 round 3 표를 그대로 두지 않고 다시 쟀다. 각 원복 후 원상복구 + 재통과 확인.

| 원복                                       | node (29) | browser (5) |
| ------------------------------------------ | --------- | ----------- |
| (a) 규칙 5 field spread 제거               | 7 FAIL    | 5 FAIL      |
| (b) layout 자식 visit propagation 차단     | —         | 5 FAIL      |
| (c) layout FieldError delegation 주입 차단 | —         | 3 FAIL      |
| (d) 5-심볼 등재 제거                       | 3 FAIL    | —           |
| (e) `applyBatchStylePatch` 병합 무력화     | 2 FAIL    | —           |
| (f) factory·origin 인라인 12 복원          | 2 FAIL    | 5 PASS      |
| (g) Skia lineHeight 덮기 제거              | 1 FAIL    | 2 FAIL      |
| (h) 인라인 fontSize 우선 복원              | 1 FAIL    | 1 FAIL      |
| (i) 인라인 lineHeight 걷어내기 제거        | 1 FAIL    | 1 FAIL      |
| (j) `toBatchPropsUpdates` 가 플래그 누락   | 1 FAIL    | 5 PASS      |
| (k) Panel 이 매핑을 인라인 재작성          | 1 FAIL    | 5 PASS      |

(a) 가 5 → 7 로, (e) 가 1 → 2 로 늘어난 만큼이 신설 게이트의 실제 담당 범위다. (j)·(k) 의 browser 5 PASS 는 (f) 와 같은 성격 — transport 는 Inspector 쓰기 경로라 layout·Skia read 경로 (browser parity) 와 교차하지 않는다.

### 7-3. 남은 한계 (게이트가 덮지 않는 것)

- `adr923PropagationTransport.test.ts` 는 store 슬라이스를 실제로 돌리지만 **React 렌더는 돌리지 않는다** — `PropertiesPanel` 의 UI 이벤트 → `changedProps` 조립까지는 정적 게이트 (매핑 함수 사용 여부) 로만 잠근다.
- 그 밖 `BatchPropsUpdate` 를 만드는 writer 는 이 seam 을 지나지 않는다 (mergeStyle 미사용 = 통째 교체가 정본).

### 7-4. 검증 · live

type-check · builder unit **5199** (657 파일) · focused `adr923*` **129** · full parity **1073** (기존 2 FAIL) · smoke 84.

live (Chrome MCP, 프로젝트 123 Home — 팔레트 TextField 신규 생성):

| 확인                                                                | 결과                                                                              |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 팔레트 TextField 신규 생성 직후 FieldError 자식 props               | `{children:"", style:{display:"none"}}` — 인라인 `fontSize` 0 (round 2 삭제 유지) |
| 자식에 `fontSize:13 · color · lineHeight:10 · backgroundColor` 주입 | 앞 3키만 저장, `backgroundColor` 는 sanitizer 가 제거 (fe2m1 근거 재확인)         |
| 패널 Invalid 스위치 ON (실제 UI → 새 매핑 함수 경유)                | 자식 `display` 만 `block`, `fontSize:13 · color · lineHeight:10` 그대로 보존      |
| 이어서 Error Message 입력 "Required field"                          | 자식 `children` 갱신 + 나머지 style 4키 유지, Skia 87×21 @y62 · TextField 83      |

인라인 `fontSize:13 · lineHeight:10` 을 준 채로도 Canvas 가 21px 줄 (delegation 14 × 1.5) 을 쓴다 — round 3 계약 그대로다. 콘솔 오류 0, 생성 요소 정리 완료 (55 → 51).

## 8. Codex 판독 round 5 (2026-09-03) — MEDIUM 1 · LOW 1 수리

### 8-1. fe4m1 — 테스트가 패널 호출자를 거치지 않았다 (MEDIUM)

round 4 의 `adr923PropagationTransport.test.ts` 는 helper → inspector slice → batch 체인을 실제로 돌렸지만 **transport 함수를 직접 주입**했다. 패널이 helper 를 호출만 하고 반환값을 버린 채 원본 `childUpdates` 를 넘기는 변형에서도 3/3 PASS 였다 (판독 반례). 정적 게이트도 helper 호출 문자열의 존재와 특정 삼항식의 부재만 봤다 — 반환값의 데이터 흐름은 고정하지 않았다.

수리 — 패널 콜백 안의 store 호출 흐름 전체를 React 밖으로 뽑았다:

- `panels/properties/semanticUpdateDispatch.ts` 의 `dispatchSemanticUpdateWithPropagation({ changedProps, propagationElement, childrenMap, elementsMap, actions })` 가 "규칙이 걸리면 `buildPropagationUpdates` → `toBatchPropsUpdates` → `actions.updateSelectedPropertiesWithChildren`, 아니면 `actions.updateSelectedProperties`" 를 전부 담는다. `PropertiesPanel.handleSemanticUpdate` 는 선택 요소·ref 해소·자식 지도만 마련해 `actions: state` (`useStore.getState()`) 로 넘긴다.
- 테스트는 **그 함수 자체**를 실제 inspector slice 위에서 돌린다 (5건): with-children 경로 (store · canonical · history `nextProps` 세 곳 보존 + 부모 자신의 변경) · 규칙 미매칭 → plain 경로 (자식 무변경) · `mergeStyle` 없이 slice 직접 호출 시 통째 교체 (계약 대조) · **AST 게이트** (`typescript` 로 `PropertiesPanel.tsx` 를 파싱해 `handleSemanticUpdate` 의 `useCallback` 본문에서 `dispatchSemanticUpdateWithPropagation` 호출이 정확히 1회, 인자 객체에 5 키가 있고 `actions` 의 initializer 가 `state`, `state` 는 `useStore.getState()`, 그리고 `updateSelectedProperties*` / `batchUpdateElementProps` 직접 호출 0) · 단일 호출자 게이트 (`apps/builder/src` production 파일에서 `toBatchPropsUpdates(` 호출자는 dispatch 뿐, dispatch 안에서 그 반환값이 액션 인자로 직접 들어가는 형태를 정규식으로 고정).

판독 반례 (helper 호출 후 반환값을 버리고 원본 전달) 를 원복 (l) 로 다시 쟀다 — **동작은 무변경** (`PropagationUpdate` 가 이미 `mergeStyle` 을 실어 store 계약과 구조가 같다), 단일 호출자 게이트만 1 FAIL. 즉 그 반례는 결함이 아니라 drift 였고, 실제 결함 형태 (m: dispatch 안에서 플래그를 떨어뜨리는 인라인 매핑) 는 기능 테스트 + 단일 호출자 게이트 2 FAIL 로 잡힌다.

### 8-2. fe4l1 — `toBatchPropsUpdates` 반환 타입 (LOW)

`<T extends {...}>` + `as unknown as T` 는 만들지 않은 필수 필드를 가진 타입도 반환한다고 선언할 수 있었다. `elementUpdate` 는 `propagationEngine` 을 import 하지 않으므로 (판독 확인) `import type { BatchPropsUpdate }` 로 반환 타입을 store 계약에 직접 묶었다 — 제네릭·캐스트 삭제.

### 8-3. 원복 RED — 전량 재측정 (node 29 → 31)

| 원복                                           | node (31) | browser (5) |
| ---------------------------------------------- | --------- | ----------- |
| (a) 규칙 5 field spread 제거                   | 6 FAIL    | 5 FAIL      |
| (b) layout 자식 visit propagation 차단         | —         | 5 FAIL      |
| (c) layout FieldError delegation 주입 차단     | —         | 3 FAIL      |
| (d) 5-심볼 등재 제거                           | 3 FAIL    | —           |
| (e) `applyBatchStylePatch` 병합 무력화         | 2 FAIL    | —           |
| (f) factory·origin 인라인 12 복원              | 2 FAIL    | 5 PASS      |
| (g) Skia lineHeight 덮기 제거                  | 1 FAIL    | 2 FAIL      |
| (h) 인라인 fontSize 우선 복원                  | 1 FAIL    | 1 FAIL      |
| (i) 인라인 lineHeight 걷어내기 제거            | 1 FAIL    | 1 FAIL      |
| (j) `toBatchPropsUpdates` 가 플래그 누락       | 1 FAIL    | 5 PASS      |
| (k) Panel 이 dispatch 우회 + 플래그 누락 매핑  | 1 FAIL    | 5 PASS      |
| (l) dispatch 가 helper 반환값 버리고 원본 전달 | 1 FAIL    | —           |
| (m) dispatch 안 인라인 매핑이 플래그 누락      | 2 FAIL    | —           |

(a) 가 7 → 6 인 이유: round 4 의 대조 테스트 (transport 주입) 가 dispatch 기반 plain-경로 테스트로 바뀌어 규칙 부재에 반응하지 않는다 — 기능 테스트 1건 + bridge 5 = 6. (k) 는 AST 게이트, (j)·(m) 은 기능 테스트가 잡는다. (l) 은 위 8-1 의 판정대로 단일 호출자 게이트만.

### 8-4. 남은 한계

- 기능 테스트는 `dispatchSemanticUpdateWithPropagation` 을 실행하지만 **패널의 React 콜백 (`handleSemanticUpdate`) 자체는 실행하지 않는다** — 선택 요소·ref 인스턴스 해소·자식 지도 조립은 AST 게이트 (호출 형태) 로만 잠근다.
- instance 경로 (`buildInstanceDescendantPatches` → `COMPONENT_DESCENDANTS_MIRROR_FIELD`) 는 `mergePropsWithStyleDeep` 로 깊게 병합해 `mergeStyle` 이 필요 없다 (판독 확인) — 단 instance 자식 style 전용 게이트는 없다.

### 8-5. 검증 · live

type-check · builder unit **5201** (657 파일) · focused `adr923*` **129** · full parity **1073** (기존 2 FAIL) · smoke 84.

live (Chrome MCP, 프로젝트 e16b69c6 Home — 팔레트 TextField 신규 생성, 자식에 `fontSize:13 · color · lineHeight:10` 주입): 패널 Invalid 스위치 ON → 자식 `display` 만 `block`, 3키 보존 · Error Message "Required field" 입력 → 자식 `children` 갱신 + style 보존, Skia 87×21 @y62 · TextField 83. 이 경로가 새 `dispatchSemanticUpdateWithPropagation` 을 거친다. 콘솔 오류 0, 요소 정리 (185 → 181).

## 9. 종결 — 후속 목록 1번 (FieldError 상태 투영) 닫힘 (2026-09-03, 실행자 선언)

동작은 round 3 (`3ba137b1a`) 에서 확정됐다. 근거: 원복 RED (a)~(i) 전량 · live 3회 (round 1 · 3 · 4, 세 번째는 dispatch 경로) · 게이트 13 (bridge 9 · origin 8 · batchStylePatch 3 · transport 5 · browser 5 를 포함해 node 31 + browser 5). round 4 (`4c4fc41f3`) · round 5 (`80e28940f`) 는 동작 변경 0 인 게이트 보강이었고, round 5 의 원복 (l) 이 판독 반례가 동작 무변경임을 실증했다.

round 6 판독은 열지 않는다. 사용자 지적 (2026-09-03) 으로 판독 루프의 커버리지 ratchet 패턴을 확정했고, 그 규칙을 `.claude/rules/review-loop-closure.md` 로 명문화했다 — phase · 후속 항목의 닫힘은 실행자가 선언하고, production 재현 없는 커버리지 지적은 LOW deferred 다.

잔여 (§5-5) 는 이 항목 밖의 별도 작업으로 남긴다: (1) canonical FieldError 자식의 편집 surface 위상 (SSOT 경계 판정 — 착수 전 결정 지점 질문) · (2) `generated/*.css` 미import 전수 (생성물 93 vs import 66) · (3) 옛 문서 인라인 `fontSize:12` 정리 (별도 승인). Description 축 (§4 후속 9번) 은 (1) 판정 뒤.
