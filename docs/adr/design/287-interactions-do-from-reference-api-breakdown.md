# ADR-287 breakdown — Interactions 의 Do 를 레퍼런스 API 표에서 유도

> 본문: [287-interactions-do-from-reference-api.md](../287-interactions-do-from-reference-api.md). 조사: [INTERACTIONS_CAPABILITY_AUDIT_2026-10.md](../../explanation/research/INTERACTIONS_CAPABILITY_AUDIT_2026-10.md). 착수는 사용자 `/execute-adr 287` — ADR-286 과 순서 제약 없음.

## 0. 전제 lock-in (fork 4 질문 — 분리가 아니라 확인)

1. base / 응용: ADR-280 (개념 유도 등록부) 이 base, 이 ADR 은 그 위의 **유도 층 추가** — 280 을 바꾸지 않고 `CAPABILITY_REGISTRY` 합성 순서만 (개념 ⊕ 유도 ⊕ 공통).
2. schema 직교: 문서 스키마 무변경 (`capabilityId` 문자열). ADR-286 (데이터 entry) 과 겹치는 필드 없음.
3. 선행 전제 reverse: ADR-280 의 「등록표는 손으로 쓰지 않는다」 는 그대로 — 유도 층도 손 입력 0. 사용자 원칙 10-22 「새 어휘 금지」 는 10-27 결정으로 「레퍼런스 API 표 전체」 로 넓어졌다 (본문 Status).
4. 판독: Phase 당 1 + 수리 1. 전제는 사용자 원문 (본문 Status) 으로 확정 — 재질문 없음.

## 1. Phase 0 — inventory · RED (G0)

### 1a. 팔레트 69 type × prop 분류 (조사 §3 · §4 를 유도 규칙으로 다시 자른 것 — 착수 때 `accepts` 실측으로 확정)

| 분류                                                       | type                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 유도 대상 prop (예)                                                                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| 상태 컴포넌트 39 (개념 등록 있음 — 유도는 개념 밖 prop 만) | Autocomplete · Calendar · CardView · Checkbox · CheckboxGroup · Color 4 · ComboBox · ContextualHelp · Date 3 · Disclosure · DisclosureGroup · Form · GridList · ListBox · Menu · NumberField · Popover · RadioGroup · RangeCalendar · SearchField · Select · Slider · Switch · Table · Tabs · TagGroup · TextArea · TextField · TimeField · ToggleButton · ToggleButtonGroup · Tooltip · Tree · frame                                                              | 개념이 안 가진 표시 prop — `label` · `description` · `placeholder` · `isIndeterminate` (Checkbox) · `variant` · `size` 등 |
| 표시 컴포넌트 — 값 (number)                                | Meter · ProgressBar · ProgressCircle · Icon (`strokeWidth`)                                                                                                                                                                                                                                                                                                                                                                                                        | `value` · `minValue` · `maxValue`                                                                                         |
| 표시 — 글자 (string)                                       | Text · Keyboard · Badge · StatusLight · Button · Link · FileTrigger (`children`) · Meter · ProgressBar (`label` · `valueLabel`) · Avatar (`src` · `alt` · `initials`) · DropZone (`label` · `description` · `replaceMessage`) · Link (`href`) · Card (`href`)                                                                                                                                                                                                      | 「<prop> 정하기」 text                                                                                                    |
| 표시 — boolean                                             | ProgressBar · ProgressCircle (`isIndeterminate`) · Skeleton (`isLoading`) · Button (`isPending`) · Card (`isSelected`) · Badge (`isDot` · `isPulsing`) · DropZone (`isFilled`) · Link (`isQuiet` · `isStandalone`) · Avatar (`isOverBackground`) · FileTrigger (`allowsMultiple` · `acceptDirectory`) · FileUpload (`autoProceed` · `showPreview`)                                                                                                                 | 켜기 · 끄기 · 전환                                                                                                        |
| 표시 — enum / variant / size                               | Badge · StatusLight · InlineAlert · Button · Link · Card · Meter (`variant`) · 전부 (`size`) · Meter · ProgressBar · ProgressCircle · Separator · Link · Button (`staticColor`) · Meter · ProgressBar (`labelPosition`) · Badge · InlineAlert · Button (`fillStyle`) · ButtonGroup · IllustratedMessage · Separator · Toolbar (`orientation`) · ButtonGroup (`align`) · Badge (`overflowMode`) · Button (`type`) · FileTrigger (`defaultCamera`) · Dialog (`role`) | 「<prop> 정하기」 choice                                                                                                  |
| 표시 — icon · number-format                                | Icon (`iconName`) · Meter · ProgressBar (`formatOptions`)                                                                                                                                                                                                                                                                                                                                                                                                          | icon picker · 사용자 결정 1 의 제외 후보 (`formatOptions` 는 객체 — 제외)                                                 |
| composition 전용 (표 없음 — accepts 만)                    | Chart (56) · FileUpload (8) · Nav · Pagination                                                                                                                                                                                                                                                                                                                                                                                                                     | 사용자 결정: Chart 는 유도하되 표 대조 건너뜀 / 제외                                                                      |
| 유도 0                                                     | Section · Slot · Nav · Pagination (accepts 에 쓸 수 있는 prop 0) · Image (accepts 0 — `src` 는 `visual`)                                                                                                                                                                                                                                                                                                                                                           | — (Image 는 **사용자 결정 4** — `src` 의 자리 실측 뒤 visual 축 유도 여부 · 분모 25 → 26)                                 |

제외 규칙 (코드 `EXCLUDED_PROP_PATTERNS`): `on*` · `dataBinding` · `items` · `children` 이 ReactNode 인 것 · `items-manager` · `binding` · `id` · `slot` · `aria-*` · `className` · `style` · `styles` · `UNSAFE_*` · 객체 타입 (`formatOptions` · `styles`). `isDisabled` · `isReadOnly` · `isRequired` 는 사용자 결정 1.

### 1b. RED 3 (`it.fails` — 기대 동작 부재 확인)

| #   | 입력                                                                                                                                                                                    | 지금                                                                                                                       | 기대                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| ①a  | Meter 선택 → Interactions 패널 Do 목록 (`exposedCapabilities`)                                                                                                                          | 공통 3 뿐 — `value` Do 미등록                                                                                              | `setValue` (값 정하기) 가 목록에 있음                                                                                 |
| ①b  | Meter record 에 runtime `label` override 쓰기 (`setRuntimeProps`) — 대조군: `value: 50` 은 지금도 `aria-valuenow="50"` (리뷰 Round 1 probe, `withOverride` 가 record prop 을 이미 병합) | 자식 Label 은 `Storage` 유지 — template `children: "{label}"` 은 문서 projection 에서 해소돼 record-local 병합이 닿지 않음 | 자식 Label 글자 = override 값                                                                                         |
| ②   | 같은 문서 → 코드 보기                                                                                                                                                                   | 암묵 상태 `meterValue` 가 `useState('')` (string) 이거나 없음                                                              | `let [meterValue, setMeterValue] = useState(40)` · `<Meter value={meterValue}>` · `onPress={() => setMeterValue(50)}` |
| ③   | Meter 선택 → 「변수로 정하기」 후보                                                                                                                                                     | `label` 만                                                                                                                 | `value` · `minValue` · `maxValue` · `label` · `valueLabel` · `variant` …                                              |

- 레퍼런스 표 파서 (테스트 안): RAC 53 · S2 70 파일의 `## API` 표 행을 읽어 type 별 prop · 타입 · 「(controlled)」 를 낸다 — 오류 0 · 행 수 보고 · 못 읽는 파일 명단.
- 실측 항목: template binding `"{prop}"` 을 해소하는 자리 전수 (문서 projection · materializer — `templateBinding.ts` 호출 지점) 와 composite 별 template-bound 표시 prop 목록 (Meter · ProgressBar `label` · `valueLabel`, DropZone, IllustratedMessage …) · `choice` 해소 목록이 빈 type × prop (`deriveOptions` 가 `undefined`) · RAC 표의 `DOMProps` 전역 속성 행 수 (보류 목록 초기값) · Builder initial 착수 값 (`adr201-bundle-gate.mjs`).

## 2. Phase 1 — 유도 층 (G1)

- `packages/shared/src/interactions/referenceCapabilities.ts` — `deriveReferenceCapabilities(type, accepts, conceptProps)` → `Record<string, CapabilityDef>`: 규칙은 본문 Decision 2 (kind → Do · param kind `number` · `text` · `choice` · `icon` · boolean 3 종). `choice` 의 목록은 `deriveOptions(contract, rule, node, key)` (`outputs/editFields.ts:191`) 로 — `variant` · `size` 는 `accepts.options` 가 없고 rule 의 `variants` · `sizes` 가 정본 (H1). 유도 층은 패널 · dispatcher 가 쓸 수 있게 `options` 를 `(rule, node) => string[]` 해소 함수로 들고 다닌다 (accepts 에 복사하지 않음). 목록이 비면 Do 생략. id 는 `set<Prop>` · `<prop>On` · `<prop>Off` · `toggle<Prop>` (개념 id 와 충돌 시 개념이 이김 — 유도 생략).
- `capabilityRegistry.ts` — `CAPABILITY_REGISTRY` 합성: `deriveRegistry(specs)` 결과 위에 팔레트 type 마다 유도 결과를 병합 (개념의 `prop` 집합 제외). `resolveCapabilities` · `isCapabilityTarget` 무변경.
- `CapabilityParam.kind` 에 `choice` (`options: readonly string[]`) · `icon` 추가.
- 정적 게이트 `__tests__/referenceCapabilities.static.test.ts`: (a) 표 행 ↔ Do (b) Do prop ⊆ 표 ∪ `d2Provenance` (c) 표시 25 type Do ≥ 1 (Image 는 사용자 결정 4) (d) 개념 중복 0 (e) 설치 d.ts 이름 (`keyof *Props` 대조 — `d2S2Alignment` 의 oracle 재사용) (f) `choice` 목록 비어 있지 않음 · 값이 표의 literal union 안 (g) 보류 목록 `DEFERRED_REFERENCE_PROPS` 수 보고 · 늘면 RED. 비교 모집단 = RAC ∪ S2 − 제외 패턴 (DOM 전역 속성 `dir` · `hidden` · `lang` · `translate` · `role` · `tabIndex` · `data-*` 포함) − 보류 (M5). 파서가 못 읽는 파일은 RED 로 남긴다. 원복 RED: 유도 층을 빈 함수로 → (c) RED.

## 3. Phase 2 — 실행 · 패널 (G2)

- record 자신의 prop: 무변경 — `withOverride` (`domBinding.runtime.ts:2933`, `domBinding.components.tsx:428`) 가 이미 non-style override 전부를 병합한다 (H2 정정).
- **template-bound 표시 prop 전달 (R1)**: `catalogPreviewInteractions.ts:849` `setRuntimeProps` 가 수신자 record 만 `touch` 하므로, 자식 template 이 `"{prop}"` 로 읽는 키가 override 에 있으면 (Phase 0 실측 목록) 문서 projection 의 template binding 해소에 runtime override 를 넘기고 (`templateBinding.ts` 해소 입력에 override 층 — 저장값 무변경) 의존 자식을 함께 `touch` 한다. Canvas 는 작성 값.
- guard 계약 (M4): `constraints.ts` `declaredRefusal` 의 `isDisabled` 분기를 둘로 — `"isDisabled"` (자기 + 조상, 지금과 같음) · 새 토큰 `"inherited:isDisabled"` (조상만). 상태 관리 Do (자기 `isDisabled` 3 — 사용자 결정 1) 는 `guards: ["inherited:isDisabled"]`. `guards: []` 는 조상 검사까지 우회하므로 쓰지 않는다 (Round 2 probe). dispatcher · `exposure` 는 같은 함수라 변경 자리 1. 단위: own=true · inherited 없음 → 통과, inherited=true → 거절, 입력 Do (`"isDisabled"`) 는 own=true 도 거절 (회귀).
- Canvas: 무변경 (작성 값).
- 패널: `ParamField.tsx` 에 `choice` (PropertySelect · options) · `icon` (아이콘 picker — Design 패널의 것 재사용) 입력. `CapabilityPicker` 목록을 묶음 (표시 · 선택 · 값 — RAC Menu section) 으로 (R6). 라벨: `labels.ts` 가 사전 → 없으면 `t("interactions.setProp", { prop })` (사용자 결정 2).
- i18n: `capabilities.setProp` · `propOn` · `propOff` · `toggleProp` 4 키 (KO/EN) + 사전에 있는 이름은 그대로.
- live (별도 dev 서버): Button → Meter `value` · **Meter `label` (자식 Label)** · ProgressBar `isIndeterminate` 켜기 · ProgressCircle `value` · Badge `variant` (choice = rule variants) · Text `children` → Preview 변화 · Canvas 무변화 · 콘솔 0 · 패널 choice 입력 · (사용자 결정 1 채택 시) Button → Button `isDisabled` 켜기 → 끄기.

## 4. Phase 3 — 코드 보기 · 「변수로 정하기」 (G3)

- `packages/shared/src/codeView/generate.ts:452~480` — 암묵 `capability:` 상태의 `valueType` 을 Do 의 param kind 에서 (`number` · `boolean` · `string`), 기본값 = 대상 노드의 작성 prop 값 (없으면 kind 기본). 이름 규칙 `<노드><Prop>` 그대로.
- 역변환 — `catalogRuntime/codeViewViews.ts` `dosOf`: `set<Node><Prop>(값)` 호출 → capability Do (`set<Prop>` 유도 id · 값 리터럴 → `params.value`). boolean 은 `true` · `false` · `!x` → On · Off · toggle.
- `vocabulary.ts` 에 한 행 (form `let [<node><Prop>, set…] = useState(v)` + `<Tag prop={<node><Prop>}>`, emit `capabilityState`, read `dosOf`, unit `rule Do (표시 prop)`).
- 골든 `codeView/__fixtures__/meter-button` (Meter + Button + 규칙 2) — `adr284CodeView.test.tsx` `roundTrip` 에 추가, golden 5 코드 동일.
- 「변수로 정하기」 — `propFollow.ts` `catalogPropFollowProps` 입력을 binding `accepts` (`getCatalogEntry(type).binding.props.accepts`) 로, 종류 `number` · `enum`/`variant` (equals) · `icon` 추가 · `CatalogPropFollowSection` 값 칸 kind 별 입력. 역변환: `<Meter value={progress}>` (명명 변수) → prop follow number.
- **동적 enum 의 저장 계약 (R7 · H3)**: `document/graph.ts:1565` `validatePropChoices` (와 `library.ts:142` `instanceContract` 의 상속 경로) — `propChoices` 키에 `PropVar` 가 오면 변수 `valueType === "string"` 이면 통과, 그 밖은 지금대로 `PROP_CHOICE_MISMATCH`. runtime: `domBinding` 이 변수 값을 해소한 뒤 `propChoices` 밖이면 작성 값으로 되돌리고 `console.warn` 1 (type · prop · 값). 테스트: string 변수 `positive` → Meter `variant` 연결 `workspace.execute` 통과 · 저장 → 재열기 · 코드 역변환 · `bogus` 값 → 작성 variant 유지 + warn 1 · 원복 RED.

## 5. Phase 4 — gap B · 번들 · 문서 (G4)

- gap B (사용자 결정 3): `constraints.ts` `declaredRefusal` 의 `selectionMode` guard 를 op 무관으로 (또는 안내) + `exposure` 정적 테스트.
- 번들: `adr201-bundle-gate.mjs` — Builder initial Δ ≤ +2,000 B gz · Preview Δ 0. 초과 시 유도 층을 패널 chunk 로 (R5).
- `pnpm docs:stale-symbols` 0.
- 문서: ADR-280 Status 에 「2026-10-27 ADR-287 로 유도 층 추가」 주석 · ADR-285 어휘표 (breakdown §8) 에 행 추가 · `.claude/rules/state-management.md` §6 「등록표는 손으로 쓰지 않는다」 문단에 유도 층 한 줄 · `project-interactions-expose-rac-surface-not-new-vocabulary` 메모리에 10-27 결정 주석 · README · CHANGELOG.
- G5: 사용자 Builder 확인 (Button → Meter · ProgressBar · ProgressCircle + 1) → Implemented (`completed/` 이동).

## 6. 추정 규모

| 영역                                                                                        | 파일 (추정) |
| ------------------------------------------------------------------------------------------- | ----------- |
| shared interactions (유도 층 · param kind · 게이트)                                         | 4           |
| shared catalog runtime (template-bound prop 전달 · propChoices 동적 참조 · runtime 값 판정) | 3 ~ 4       |
| builder 패널 (ParamField · CapabilityPicker · labels · i18n)                                | 4           |
| 코드 보기 (generate · dosOf · vocabulary · 골든)                                            | 4           |
| propFollow + 섹션                                                                           | 2           |
| gap B + 테스트                                                                              | 2           |
| 문서 · 메모리                                                                               | 6           |
| **합계**                                                                                    | **~26**     |

## 7. 사용자 결정 4 (본문 표) — 묻는 시점

| 결정                                                                                                                         | 시점                             |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 1 노드 자신의 `isDisabled` · `isReadOnly` · `isRequired` 유도 (채택 시 `guards: ["inherited:isDisabled"]` — M4) · Chart 포함 | Phase 1 착수 (제외 규칙 확정 전) |
| 2 유도 Do 라벨                                                                                                               | Phase 2 패널 착수                |
| 3 gap B                                                                                                                      | Phase 4 착수                     |
| 4 Image `src` (visual 축) 유도 — 분모 25 → 26                                                                                | Phase 0 실측 뒤                  |

## 8. 기록

- 2026-10-28 리뷰 Round 1 반영 (착수 전): H1 choice 목록 = `deriveOptions` · H2 R1 전제 정정 (record override 는 이미 병합, 빠진 것은 template-bound 자식 전달 — RED ① 을 ①a · ①b 로) · H3 R7 신설 (propChoices 동적 참조 저장 정책 + runtime 값 판정) · M4 상태 관리 Do guard 분리 · M5 비교 모집단 (RAC ∪ S2 − 제외 − 보류 · 보류 ratchet) · 분모 25 · 사용자 결정 4 (Image). Round 2 (수리 검증, HIGH 0 · MEDIUM 1): M4 부분 수리 — `guards: []` 가 조상 검사도 우회 → guard 토큰 분리 (`"inherited:isDisabled"`) 로 정정. 리뷰 probe 7/7 + Round 2 1/1: `.agent/runs/2026-10-28-review-adr287/` (local).

(착수 뒤 phase 마다.)
