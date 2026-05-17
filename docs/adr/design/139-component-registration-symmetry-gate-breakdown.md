# ADR-139 구현 상세 — 컴포넌트 등록·대칭 build-time gate

> 본 문서는 [ADR-139](../completed/139-component-registration-symmetry-gate.md) 의
> 구현 상세다. ADR 본문은 Context / Alternatives / Decision / Risks / Gates 만 담는다.

## 1. ADR 분리 점검

ADR-139 는 기존 ADR 에서 분리된 것이 아니다. `.claude/rules/ssot-hierarchy.md
§4-1` 이 명시한 미완 과제("build-time 자동화: 미완성. 향후 과제")를 새로
작성한 것이다.

`sweep-2026-05-16.json` 전수 audit 이 식별한 4개 근본 원인 중 T4 에 해당한다:

- T1. 고정-부품 compound 모델 (ProgressBar/Meter/Switcher/Calendar)
- T2. Collection items-SSOT 잔여 (List/Tree/TableView)
- T3. Prop-naming SSOT (showValue/showValueLabel 등)
- **T4. 등록·대칭 build-time gate 부재 ← 본 ADR**

T1~T3 은 T4 와 직교한다 — 각각 별도 ADR/작업으로 다룬다. 본 ADR 은 T4 단독이며
선행 ADR 의 전제를 승계하지 않으므로 ADR 분리 4 질문은 해당 없음.

**선례·인접 인프라**:

- `packages/shared/src/renderers/__tests__/rendererStyleContract.test.ts`
  (ADR-907 Layer C) — 11 렌더러 root style props 를 runtime 검증. 본 gate 가
  동일 패턴을 registration 완결성으로 확장.
- ADR-080/081 — primitives→consumer 3경로 drift 감지 인프라. token _값_ drift
  대상이라 본 ADR 의 _등록_ 완결성과 scope 가 다름 (중복 아님).

## 2. Phase 0 — Inventory

목표: gate 가 검증할 대상을 확정한다.

### 2-1. Canonical 컴포넌트 목록 SSOT 결정

후보:

- (a) `BASE_TAG_SPEC_MAP` keys (`packages/specs`) — runtime Record, `Object.keys`
  로 즉시 enumerate 가능.
- (b) `packages/specs/src/components/*.spec.ts` 파일 glob — `composition-vocabulary.ts`
  주석이 "실측 `*.spec.ts` 파일명 기준 118개" 라 명시. glob 으로 build 시
  enumerate 가능.
- (c) `ComponentTag` union type — `packages/shared/src/types/composition-vocabulary.ts`
  의 **순수 TypeScript `type` alias union**. 런타임 값이 없어 `Object.keys` 로
  enumerate 불가 — ts-morph / TS compiler API 가 별도로 필요.

Phase 0 산출물: 3 후보 비교 + 단일 SSOT 선정 근거 기록. 잠정 권장 **(b)** —
런타임 도구 없이 glob 만으로 enumerate 가능하고, spec 파일 존재가 곧 컴포넌트
정의이므로 SSOT 의미상 자연스럽다. (c) 채택 시 ts-morph 의존 추가 비용을 Phase 0
에서 별도 평가한다.

### 2-2. 레지스트리 목록·형태 확정

각 레지스트리의 (파일 경로, 자료구조, 키 추출 방법) 표 작성:

| 레지스트리                           | 위치                                | 자료구조   | 키 추출           |
| ------------------------------------ | ----------------------------------- | ---------- | ----------------- |
| `rendererMap`                        | `packages/shared`                   | Record     | `Object.keys`     |
| `BASE_TAG_SPEC_MAP` / `TAG_SPEC_MAP` | `packages/specs`                    | Map/Record | keys              |
| `TAG_SPEC_MAP` (builder merged)      | `apps/builder` `sprites/tagSpecMap` | Record     | keys              |
| `COMPLEX_COMPONENT_TAGS`             | `apps/builder`                      | Set        | iterate           |
| `getDefaultProps`                    | `apps/builder`                      | Record/Map | keys              |
| `ComponentFactory` creators          | `apps/builder`                      | Record     | keys              |
| `styles/index.css`                   | `packages/shared`                   | CSS 텍스트 | `@import` 줄 파싱 |

**builder merged `TAG_SPEC_MAP` (HIGH — codex round 2)**: `apps/builder/.../sprites/tagSpecMap.ts`
가 `packages/specs` 정본을 `BUILDER_ALIAS_MAP`(8 alias)과 병합한 별도 map 을
export 하며 `getSpecForTag()` / `StoreRenderBridge` / Skia 경로가 직접 소비한다.
`packages/specs` 정본이 맞아도 alias layer drift 는 Builder 경로만 깨뜨리므로
별도 검증 항목으로 포함한다.

**CSS registry 검증 한계 (MED — codex round 2)**: `styles/index.css` 는 spec
generated CSS 와 수동 CSS 가 혼재한다(Leaf=generated, Container/Composite=manual).
`@import` 존재 여부만으로는 `skipCSSGeneration` 의도 / manual-only / generated-
but-unmatched 케이스를 구분하지 못한다. Phase 0 에서 컴포넌트별 (a) generated
대상인가 (b) manual-only 의도인가를 spec 의 `skipCSSGeneration` 플래그 기준으로
분류하고, gate 는 "generated 대상인데 import 누락" 만 FAIL 로 판정한다.

### 2-3. 현 미등록 전수 분류 → baseline 작성

baseline 은 레지스트리 **실제 diff** (불변식 A/B 의 expected − actual) 로 산출한다.
`sweep-2026-05-16.json` 은 4 근본 원인의 _증상_ audit 이라 baseline source 로
부적합 (등록 누락 외 prop-naming / compound 모델 이슈 혼재 + 일부 오진).
실행 결과는 §2.5-3 draft 표, 정밀 `componentRegistrationBaseline.json` 은 Phase 1
contract test 첫 실행 산물 (§2.5-6).

### 2-4. 의도적 예외 식별 → exception map

- `Header` — React renderer 의도적 부재 (CSS 자동생성 전용 설계 가능성, Phase 0
  에서 확정)
- `ColorWheel` 등 — 팔레트 미등재 의도 (복합 factory 자식 전용)
- `Group` — RAC ARIA Group, ADR-130 frame 단일화로 factory create 미등록 의도

각 예외 항목에 사유 1줄 + 근거 ADR/rule 링크 주석 (R2 대응).

**Gate G0**: 4 산출물 (canonical list SSOT 결정 / 레지스트리 표 / baseline /
exception map) 작성 완료.

## 2.5. Phase 0 실행 결과 (2026-05-17)

### 2.5-1. 레지스트리 actual enumeration

| 레지스트리                            | 위치                                                 |         actual 키 수 |
| ------------------------------------- | ---------------------------------------------------- | -------------------: |
| `universe` (spec glob)                | `packages/specs/src/components/*.spec.ts`            |                  119 |
| `rendererMap`                         | `packages/shared/src/renderers/index.ts`             |                   95 |
| `BASE_TAG_SPEC_MAP`                   | `packages/specs/src/runtime/tagToElement.ts`         |                  104 |
| `TAG_SPEC_MAP` (확장)                 | = BASE ∪ `childSpecs` 9 (`expandChildSpecs`)         |                  113 |
| `TAG_SPEC_MAP` (builder merged)       | `apps/builder/.../sprites/tagSpecMap.ts` (+ alias 9) |                  122 |
| `COMPLEX_COMPONENT_TAGS`              | `apps/builder/src/builder/factories/constants.ts`    |                   53 |
| `ComponentFactory.creators`           | `apps/builder/.../factories/ComponentFactory.ts`     |                   60 |
| `getDefaultProps` (`defaultPropsMap`) | `apps/builder/src/types/builder/unified.types.ts`    |                   79 |
| `styles/index.css` `@import`          | `packages/shared/.../styles/index.css`               | 35 (인프라 CSS 혼재) |

`childSpecs` 자동 확장 9개: CardContent, CardFooter, CardHeader, CheckboxItems,
GridListItem, Header, ListBoxItem, RadioItems, TagList.

### 2.5-2. 모델 확정 — placeable anchor 불변식

canonical 목록 모델 = **레지스트리별 expected set** (사용자 결정 2026-05-16).
순환 정의를 피하기 위해 expected set 을 두 불변식으로 고정한다:

- **불변식 A**: 모든 `universe` (spec 파일) 는 `TAG_SPEC_MAP` (확장) 에 존재해야
  한다 — 미등록 시 Skia `getSpecForTag()=null`. casing (`Frame`↔`frame`) 반영.
- **불변식 B**: 모든 `placeable` (`ComponentFactory.creators` 60) 는
  `rendererMap` + `TAG_SPEC_MAP` + `getDefaultProps` 에 존재해야 한다 — placeable
  = 사용자가 실제 배치 가능한 컴포넌트, 3 소비 레지스트리 전부 필요.

`COMPLEX_COMPONENT_TAGS` 는 완결성 레지스트리가 아니라 curated 분류 → 불변식
대상에서 제외 (sanity-check 만: 모든 COMPLEX 항목이 placeable 인지). `styles/
index.css` 는 `skipCSSGeneration` 분류 필요 → Phase 1 에서 조건부 판정.

### 2.5-3. draft baseline — 현 미등록 (regex enumeration 기준)

| 불변식 | 레지스트리        | 미등록 | 항목                                                                                                                                                                                                                                             |
| ------ | ----------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A      | `TAG_SPEC_MAP`    |      7 | Accordion · Autocomplete · Field · Image · MenuItem · Modal · TailSwatch                                                                                                                                                                         |
| B      | `rendererMap`     |      5 | ColorPicker · List · Switcher · TextArea · frame                                                                                                                                                                                                 |
| B      | `TAG_SPEC_MAP`    |      4 | Accordion · DataTable · Image · Navigation                                                                                                                                                                                                       |
| B      | `getDefaultProps` |     19 | Accordion · Avatar · AvatarGroup · ButtonGroup · CardView · ColorSwatchPicker · DataTable · IllustratedMessage · List · Navigation · Pagination · ProgressCircle · RangeCalendar · StatusLight · Switcher · TableView · TextArea · Toast · frame |

불변식 A 7건 1차 분류:

- **real drift 후보** — Accordion (placeable+rendered, Skia spec 미등록) / Field
  / Modal / TailSwatch (rendererMap 존재, TAG_SPEC_MAP 미등록)
- **intended 후보** — Image (`IMAGE_TAGS` ImageSprite 특수 경로)
- **Phase 1 확인** — Autocomplete (어디에도 미등록 — unwired 컴포넌트 여부) /
  MenuItem (ADR-068 Menu items SSOT — 별도 소비 경로 여부)

### 2.5-4. exception 후보

- `Image` — `IMAGE_TAGS` (`Image`/`Avatar`/`Logo`/`Thumbnail`) ImageSprite 경로,
  TAG_SPEC_MAP 미등록 의도 (`tagSpecMap.ts` `IMAGE_TAGS`)
- `DataTable` / `Navigation` — spec 파일 없는 creator (각각 Table / Nav alias) →
  불변식 A 대상 아님, B 의 TAG_SPEC_MAP 검사에서 alias 해소 필요
- `rendererMap` 의 spec 없는 키 10개 — CardPreview · Cell · Column · DataTable ·
  DisclosureContent · Navigation · Row · TableBody · TableHeader · TreeItem
  (Table/Tree 내부 부품 — 독립 spec 없이 부모 renderer 가 처리, 의도)
- `frame` (lowercase) — `Frame.spec.ts` 의 canonical 타입 키 (ADR-130), casing
  정합 처리 대상이지 누락 아님

### 2.5-5. Phase 1 test 위치 결정

contract test 는 `packages/shared` 의 `rendererMap` 과 `apps/builder` 의
`ComponentFactory`/`getDefaultProps`/`COMPLEX_COMPONENT_TAGS` 를 **동시 import**
해야 한다. 패키지 의존 방향 (`specs ← shared ← builder`) 상 `packages/shared`
test 는 `apps/builder` 를 import 할 수 없다 → **test 위치는 `apps/builder` 로
확정** (7 레지스트리 전부 import 가능한 유일 패키지). breakdown §3 의 위치 미정은
본 결정으로 해소.

### 2.5-6. baseline.json 산출 시점

위 draft baseline 은 source 파일 **regex enumeration** 기준이라 runtime
`expandChildSpecs` / builder merge / alias 해소를 완전 반영하지 못한다.
machine-readable `componentRegistrationBaseline.json` 은 **Phase 1 contract test
첫 실행 산물** 로 확정한다 (test 가 실제 모듈을 import → 정확한 expected/actual
diff). Phase 0 의 baseline 은 본 §2.5-3 draft 표로 갈음 (G0 충족).

**Gate G0 판정**: canonical 모델 확정 (2.5-2) / 레지스트리 표 (2.5-1) / draft
baseline (2.5-3) / exception 후보 (2.5-4) — 4 산출물 완료. Phase 1 진입 가능.

## 3. Phase 1 — Contract test

`componentRegistrationContract.test.ts` 작성.

- 위치: **`apps/builder` 내** (§2.5-5 결정 — 7 레지스트리 전부 import 가능한
  유일 패키지. `packages/shared` test 는 패키지 경계상 `apps/builder` import 불가).
- 매트릭스: 불변식 A (universe × TAG_SPEC_MAP) + 불변식 B (placeable × {rendererMap,
  TAG_SPEC_MAP, getDefaultProps}). 각 `(컴포넌트, 레지스트리)` 쌍 존재 여부 assert.
- 첫 실행 시 미등록 쌍 → `componentRegistrationBaseline.json` 으로 capture (§2.5-6).
- 판정: baseline 에 있으면 skip(known debt) / exception 에 있으면 skip(intended)
  / 둘 다 아니면 FAIL.

**Gate G1**: contract test 가 현 코드에서 PASS (baseline + exception 으로 현
미등록 수용). 신규 누락을 주입한 negative fixture 가 FAIL 하는지 확인.

### 3.1. Phase 1 실행 결과 (2026-05-17)

- `apps/builder/src/builder/factories/__tests__/componentRegistrationContract.test.ts`
  작성 — 8 test (sanity / 불변식 A / 불변식 B ×3 / builder merged 정합 /
  negative fixture / baseline staleness), **8/8 PASS** (Gate G1 충족).
- baseline / exception 데이터 — 같은 `__tests__/` 디렉토리에 JSON:
  - `componentRegistrationException.json` — intended 1건 (`Image`/TAG_SPEC_MAP,
    IMAGE_TAGS 경로)
  - `componentRegistrationBaseline.json` — known debt: TAG_SPEC_MAP 8 /
    rendererMap 5 / getDefaultProps 19. §2.5-3 draft 와 실측 일치.
- 레지스트리 노출 (gate enumerate 용 최소 변경):
  - `ComponentFactory.getRegisteredTypes()` — `private static creators` read-only
    접근자 신규.
  - `unified.types.ts` — 함수 내부 `defaultPropsMap` → module-scope
    `export const DEFAULT_PROPS_MAP` 승격 (`getDefaultProps` 동작 불변).
- `apps/builder/.type-errors-baseline.txt` 550→547 — `getRegisteredTypes` 추가로
  인한 line-shift 1건 정합 + 사전 stale 3건 정리. 신규 type 에러 0.
- negative fixture: 가짜 미등록 주입 시 `unexpectedMissing` 이 검출 — gate 차단력
  확인.

## 4. Phase 2 — CI 편입

- `package.json` script 추가 (예: `test:registration-contract`).
- 기존 게이트 (Stop hook type-check / `codex:preflight`) 와 동급으로 편입.

**Gate G2**: CI/preflight 에서 gate 실행 + FAIL 시 차단 확인.

### 4.1. Phase 2 실행 결과 (2026-05-17)

- root `package.json` script `test:registration-contract` 추가 — contract test 를
  단독 실행 (`pnpm -F @composition/builder exec vitest run …`).
- `scripts/codex/registration-gate.sh` 신규 — `type-check-gate.sh` 와 동일 패턴.
  `codex_changed_files` 에 `.ts/.tsx` 변경이 있을 때만 contract test 실행, 없으면
  스킵. contract test FAIL 시 비-0 종료 → 게이트 차단.
- `codex:registration` script + `codex:preflight` 체인 편입 — `codex:guard →
codex:format → codex:typecheck → codex:registration` 순. `codex:typecheck` 와
  **동급**.
- **Stop hook 편입은 미수행**: `.claude/hooks/` 는 `protect-files.sh` 보호
  디렉토리(인프라 보호 의도)라 Stop hook 직접 편집 불가. Gate G2 가 요구하는
  "CI/preflight 에서 gate 실행" 은 `codex:preflight` 편입으로 충족. breakdown §4
  의 "Stop hook type-check" 는 게이트 tier 의 reference 이지 편집 대상이 아니다.
- 검증: `pnpm test:registration-contract` → 8/8 PASS. `registration-gate.sh` 단독
  실행 → TS 변경 없을 때 스킵(exit 0) 확인. FAIL 차단력은 Phase 1 negative
  fixture(`__Adr139FakeUnregistered__`) 가 입증.

**Gate G2 판정**: `test:registration-contract` script + `codex:preflight` 편입 +
TS-변경 게이팅 — 완료. Phase 3 진입 가능.

## 5. Phase 3 — Baseline ratchet

R1(baseline 정체) 을 실효 차단하려면 ratchet 이 "안내" 가 아니라 **FAIL** 이어야
한다 (codex round 2 MED-1):

- **감소 시 FAIL**: `currentMissing < baselineMissing` 이면 contract test FAIL.
  메시지로 `pnpm test:registration-contract --update-baseline` 류 재측정 명령을
  안내 → baseline 파일을 줄어든 값으로 갱신해야 통과. baseline 이 줄어든 채
  방치되는 경로를 차단한다.
- **append 시 FAIL**: 신규 컴포넌트가 baseline 에 추가되려 하면 FAIL — 신규
  컴포넌트는 baseline 진입 불가, 반드시 전 레지스트리 등록 후 병합.

**Gate G3**: ratchet 동작 확인 — (1) 누락 1건 수정 후 baseline 미갱신 시 FAIL +
재측정 명령 안내 출력, (2) baseline append 시 FAIL.

### 5.1. Phase 3 실행 결과 (2026-05-17)

- `componentRegistrationContract.test.ts` 에 ratchet 추가 — `BASELINE_RATCHET`
  const (`{ rendererMap: 5, TAG_SPEC_MAP: 8, getDefaultProps: 19 }`) + `ratchetVerdict()`
  helper + 2 test (real ratchet / negative fixture). 총 **10/10 PASS**.
- ratchet 기준 = `baseline.json` 의 레지스트리별 항목 수가 `BASELINE_RATCHET` 와
  **정확히 일치** (`===`). `BASELINE_RATCHET` 은 test 코드(리뷰 대상)에 두어,
  데이터 파일 `baseline.json` 단독 편집(append 우회)이 반드시 리뷰되는 코드
  편집을 동반하게 한다. ratchet 은 줄어들 수만 있다.
- **append FAIL**: `baseline.json` 항목 수 > ratchet → "신규 누락은 baseline
  진입 불가" FAIL.
- **감소 FAIL**: 누락 해소로 항목 제거 시 항목 수 < ratchet → "BASELINE_RATCHET
  를 N 으로 낮춰 재측정" FAIL. 더불어 staleness test 가 해소된 항목의 제거를
  강제하므로, baseline.json 정리 + ratchet 하향이 lockstep 으로 묶인다.
- **`--update-baseline` flag 미구현**: breakdown §5 가 "류" 로 제시한 재측정 CLI
  플래그는 도입하지 않았다. vitest 커스텀 플래그 배선 대신, FAIL 메시지가 편집
  대상(`baseline.json` / `BASELINE_RATCHET` const)과 목표값을 직접 안내한다 —
  codex round 2 MED-1 이 요구한 것은 "FAIL 강제" 이고, Gate G3 (1) 의 "재측정
  명령 안내" 는 이 메시지로 충족.
- **Gate G3 검증**: `baseline.json` 일시 변조로 (1) append (fake 항목 주입) →
  `rendererMap: baseline 6건 > ratchet 5건` FAIL exit 1, (2) 감소 (ColorPicker
  제거) → `rendererMap: baseline 4건 < ratchet 5건 … 재측정` FAIL — 양쪽 확인 후
  revert, 10/10 PASS 복귀.

**Gate G3 판정**: append FAIL + 감소 FAIL + 재측정 안내 — 완료.

## 6. 신규 레지스트리 추가 체크리스트 (R3 대응)

새 레지스트리를 파이프라인에 추가할 때:

1. 레지스트리 목록 표(§2-2)에 추가.
2. contract test 매트릭스에 컬럼 추가.
3. baseline 재측정.

## 7. Risks → Gate 매핑

| Risk               | Gate | 통과 조건                                       |
| ------------------ | ---- | ----------------------------------------------- |
| R1 (baseline 정체) | G3   | ratchet — append 시 FAIL + 감소 시 FAIL(재측정) |
| R2 (예외 stale)    | G0   | exception map 항목마다 사유 + 링크 주석 의무    |
| R3 (gate 유지보수) | §6   | 신규 레지스트리 추가 체크리스트                 |

## 8. 검증 체크리스트

- [x] Phase 0-3 각 Gate(G0~G3) 통과 — G0 §2.5 / G1 §3.1 / G2 §4.1 / G3 §5.1
- [x] `pnpm type-check` PASS — apps/builder baseline 547 유지, 신규 위반 0
- [x] 기존 test 회귀 없음 — contract test 10/10 PASS, factories `factoryOwnership`
      1-fail 은 pre-existing (git stash 검증)
- [x] README ADR-139 Implemented 갱신 + CHANGELOG `Infrastructure` 항목

전 Phase 완결 — ADR-139 Status `Implemented` 승격 (2026-05-17). ADR 본문은
`docs/adr/completed/` 로 이동.

## 9. Baseline 운영 기록

gate land 이후 baseline 32건의 점진 해소·재분류 기록. baseline = 해소 대상
debt, exception = 영구 정당. 잘못 baseline 에 든 항목을 exception 으로 재분류하는
것도 정당한 debt 감소다 (false-debt 제거).

### 9.1. 2026-05-17 — baseline triage + 3건 exception 재분류

25개 컴포넌트 전수 triage (실제 모듈 import 진단으로 7 레지스트리 권위 매트릭스
확보). baseline TAG_SPEC_MAP 8건 중 3건이 **실제 debt 가 아니라 의도된 구조적
누락** 으로 확인되어 exception 으로 재분류:

| 컴포넌트   | 재분류 사유 (코드 근거)                                                                       |
| ---------- | --------------------------------------------------------------------------------------------- |
| MenuItem   | `Menu.props.items[]` 데이터 — 독립 element/tag 아님 (ADR-068 Menu items SSOT)                 |
| Navigation | creators alias — `createNavDefinition` 이 `type:"Nav"` 생성, `Navigation` 타입 element 미존재 |
| DataTable  | 비시각적 데이터 관리 컴포넌트 (`createDataTableDefinition` 주석) — Skia spec shapes 불필요    |

결과: baseline TAG_SPEC_MAP 8→5, `BASELINE_RATCHET.TAG_SPEC_MAP` 8→5, exception
TAG_SPEC_MAP 1→4. contract test 10/10 유지 (재분류는 런타임 무변경).

잔존 baseline 29건 = 실제 debt 로 확정, 후속 해소 대상:

- **TAG_SPEC_MAP 5** — Accordion / Field / Modal / TailSwatch 는 placeable/팔레트
  노출 element 인데 `BASE_TAG_SPEC_MAP` 미등록 (Skia `getSpecForTag`=null). 각
  등록 시 spec shapes 반영 → `/cross-check` 필요. Autocomplete 는 unwired (제품
  결정: wiring vs spec 제거).
- **rendererMap 5** — ColorPicker / List / Switcher / TextArea / frame. 모두
  placeable 인데 renderer 미등록 (composite 는 통상 renderer 보유 → 이례적).
  frame 은 generic div fallback 으로 정상일 가능성, 나머지는 renderer 추가 검토.
- **getDefaultProps 19** — placeable 인데 `DEFAULT_PROPS_MAP` 미등록 → factory
  `{}` fallback. `getDefaultProps` 의 실제 소비 경로 (creator-backed vs generic)
  확인 후 일괄 처리.

### 9.2. 2026-05-17 — baseline 전수 소진 (29→0)

§9.1 의 잔존 29건을 한 건씩 조사·해소. baseline 전 레지스트리 빈 객체 도달,
`BASELINE_RATCHET` 전부 0. 이후 신규 등록 누락은 contract test 가 즉시 FAIL.

| 카테고리           | 처리                                                                                                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TAG_SPEC_MAP 5     | Accordion / Modal / Field / TailSwatch / Autocomplete — `BASE_TAG_SPEC_MAP` 등록. 5건 모두 `render.shapes:()=>[]` empty-shapes spec — Skia 경로 box→spec 전환이 canonical `frame` 과 동일 (cross-check 확증)          |
| rendererMap 5      | ColorPicker / List / Switcher / TextArea / frame — per-component triage 결과 5건 전부 container 컴포넌트, Preview spec-fallback (`<div class="react-aria-{Type}">{children}</div>`) 이 정확한 렌더 → exception 재분류 |
| getDefaultProps 19 | real-debt 16 → `createDefault*Props` 등록 (factory definition parent props 정합) / false-debt 2 (Navigation alias, DataTable 동적 id) → exception. (Accordion 1건은 TAG_SPEC 와 함께 §선행 처리)                      |

**cross-check**: TAG_SPEC_MAP 등록 5건은 empty-shapes spec 이라 Skia 경로가
`buildBoxNodeData` → `buildSpecNodeData` 로 전환되나, 결과가 canonical 컨테이너
`frame` 과 픽셀 동일 (Chrome MCP 로 Accordion + Field/Modal/TailSwatch + frame
나란히 배치 확증, `applyInlineBorderOverlay` longhand border / transparent fill).
getDefaultProps·rendererMap 처리는 생성·reset 로직 / 분류 변경이라 렌더 무변경.

**누적 추이**: 32 (triage 후 29) → Accordion 27 → Field/Modal/TailSwatch 24 →
getDefaultProps 6 → rendererMap 1 → Autocomplete 0.

commits: `667a65eb2` (Accordion) / `1941d6028` (Field·Modal·TailSwatch) /
`7e2b419f8` (getDefaultProps 18) / `ae19900d1` (rendererMap 5) /
`f63eba6c4` (Autocomplete).
