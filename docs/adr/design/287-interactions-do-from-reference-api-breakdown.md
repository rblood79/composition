# ADR-287 breakdown — Interactions 의 Do 를 레퍼런스 API 표에서 유도

> 본문: [287-interactions-do-from-reference-api.md](../completed/287-interactions-do-from-reference-api.md). 조사: [INTERACTIONS_CAPABILITY_AUDIT_2026-10.md](../../explanation/research/INTERACTIONS_CAPABILITY_AUDIT_2026-10.md). 착수는 사용자 `/execute-adr 287` — ADR-286 과 순서 제약 없음.

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

- **2026-10-28 Phase 0 닫힘 (G0)** — `/execute-adr 287` 로 Accepted. 사용자 결정 4 = 기각 · 결정 1 = 유도 (상태 3 + Chart).
  - RED 4 (`apps/builder/src/preview/catalog/__tests__/adr287Phase0.test.tsx`, `it.fails` — 표지를 떼고 돌려 실패 이유 확인): ①a `exposedCapabilities("Meter")` = `show · hide · toggle` · ①b `label` override 뒤 Meter 글자 `Storage75%` 그대로 (대조군 `value: 50` → `aria-valuenow="50"` PASS) · ② 코드 보기가 `<Meter value={40} />` + `// (setValue: not a capability of this component)` · ③ 「변수로 정하기」 후보 `[label]` 뿐. 대조군 3 PASS.
  - 표 파서 (`packages/shared/src/interactions/__tests__/support/referenceApiTables.ts` · 테스트 `referenceApiTables.test.ts`): RAC 53 · S2 70 파일, 오류 0, 행 10,673 · 3,012. 3 열 표 (`| Parameter | Type | Description |`) 를 같이 읽는다. API 절에 행이 없는 파일 — RAC `Toast` · S2 `IllustratedMessage` · `LabeledValue` · `icons` (스냅샷이 제목만 실음 — 게이트가 명단으로 고정).
  - 표가 없는 팔레트 type (RAC · S2 어느 쪽에도 그 이름의 표 없음): Text · Keyboard · Icon · Section · Nav · Pagination · FileUpload · Chart · IllustratedMessage (S2 스냅샷 빈 절) — G1 (a) 대조 밖, (b) 는 D2 게이트 (`d2S2Alignment` — 설치 d.ts) 가 accepts 를 이미 묶는다. Separator 는 S2 `Divider` (별칭 — `d2S2Alignment` 의 `S2_ALIAS` 와 같은 표).
  - template binding 해소 자리 = resolver `bindTemplateValue` 2 곳 (`resolution/resolver.ts:1325` 소유 fork · `:1849` template 자리) — 둘 다 문서 projection. 옛 `catalog/templateBinding.ts` 는 export 만 남음 (호출 0). 표시 composite 의 template-bound prop: Meter `label` → Label · `valueText` → MeterValue, ProgressBar 같음, Button · ToggleButton `label` → Text · `icon` → Icon, InlineAlert · IllustratedMessage `title` · `description`, Disclosure `title`, AvatarGroup `label`, field 가족 `label` · `description` · `errorMessage` · `placeholder` (49 정의 — 덤프 `.agent/runs/2026-10-28-adr287/inv2.txt` local).
  - choice 해소 목록 (`deriveOptions`, node = type 만) 이 빈 것: RadioGroup `value` (자식 Radio 없을 때 — 실제 노드는 자식으로 채워짐) · Tabs `defaultSelectedKey`. 본문이 빈 예로 든 Badge · StatusLight `variant` 는 rule variants 가 있어 비지 않는다 (정정).
  - Image (사용자 결정 4 판단 재료): catalog entry · binding 없음 (`paletteItems.ts` `PALETTE_ONLY` overlay) · `src` 는 노드 `props.src` (DOM `imageElementProps` · Canvas `ruleShapes.ts` `imageShape`). → 기각, 분모 25.
  - capability id 집합은 library `execution.capabilityIds` 가 `CAPABILITY_REGISTRY` 에서 유도 (`document/executionVocabulary.ts`) — 유도 Do id 는 손 등록 없이 문서 검증을 통과한다 (Phase 1 확인 항목).
  - 번들 기준 revision = `72ddca08f` (Phase 4 에서 별도 worktree 로 before 빌드 — 메모리 `feedback-baseline-build-separate-worktree-original-deps`).

- **2026-10-28 Phase 1 닫힘 (G1)**
  - 유도 범위: `componentCatalog` 의 primitive binding 146 type 전부 (팔레트 목록은 builder 에 있어 shared 등록부가 못 읽는다 — type 이 아니라 prop 규칙으로 거른다). 제외 이름 `EXCLUDED_PROP_PATTERNS` (`on*` · `aria-*` · `data-*` · `UNSAFE_*` · `default*` · `id` · `slot` · `name` · `className` · `style` · `styles` · `autoFocus` · `dataBinding` · `loadingState`) — `default*` · `autoFocus` 는 RAC 가 mount 때 한 번 읽어 runtime 쓰기가 무효라 뺐다. 컬렉션 항목 (`COLLECTION_ITEM_OWNERS` — Card 제외) 의 `isSelected` 는 owner 의 선택 (ADR-280) 이라 유도하지 않는다.
  - 결과: 유도 Do 1,074 (Meter 12 · Button 12 · Badge 13 · TextField 40 · Chart 57). 표시 25 전부 Do ≥ 1 · Meter `setValue` = `{ prop: "value", value: "!param", param: number }`.
  - G1 게이트 (`packages/shared/src/interactions/__tests__/referenceCapabilities.static.test.ts`): (a) 비교 모집단 = RAC 표 ∪ S2 표 (`S2_NAME` 별칭 — `d2S2Alignment` 와 같은 표) − 제외 이름 − React `HTMLAttributes` (HTML 전역 · RDFa · microdata 51 — RAC 표가 DOM 요소마다 전부 싣는다) − 보류 `DEFERRED_REFERENCE_PROPS` 386 (`__tests__/support/deferredReferenceProps.ts` — 사유 3: accepts 밖 372 · 값 종류 8 (`formatOptions` · Column 폭 · `visibleDuration`) · 숨김 6 (`validationBehavior`)). 수 386 은 고정 — 새 표 행은 RED, Do 를 얻은 보류 행도 RED. (b) 유도 prop ⊆ 표 ∪ `d2Provenance` — S2 `TextArea.md` 는 표가 HTML textarea 속성이라 (`label` 없음, 설치 d.ts 는 `TextFieldProps`) `SNAPSHOT_TABLE_DEFECTS` 로 명시. (c) 표시 25. (d) choice 목록 비지 않음 · 표 literal 안 — 밖인 13 (rule sizes `XS` 11 · Breadcrumbs `S` · GridList `waterfall`) 은 D2 게이트가 안 보는 기존 D3 단계라 `CHOICE_EXTENSIONS` 로 고정. (e) 개념과 같은 prop 0. M4 guard 단위 2.
  - 원복 RED: `deriveReferenceCapabilities` 가 빈 결과 → (a) · (c) · (d) · M4 4 RED (복원 cmp 일치).
  - 회귀 조정 (ADR-280 · 281 불변식을 개념 Do 범위로): `deriveRegistry.test.ts` racRef · guards, `capabilityRegistry.test.ts` FileTrigger · DropZone, `capabilityBindingReach.test.ts` (도달 행렬은 개념 Do — 유도 Do 의 도달은 Phase 2 G2), `capabilityLabelKeys.static.test.ts` (spec 58 type 직접 계수 · formatted message 해소).
  - Phase 0 RED ①a → GREEN (`it`).

- **2026-10-28 Phase 2 닫힘 (G2)** — 사용자 결정 2 = prop 이름 삽입.
  - R1 자리 실측: template binding 해소는 resolver `bindTemplateValue` (문서 projection) 한 곳이라 runtime 값을 그 해소에 넘기는 대신 Preview 의 runtime override 층에서 같은 바인딩을 따라 part record 에 값을 쓴다 (`packages/shared/src/catalog/runtime/catalogPreviewInteractions.ts` `forwardTemplateBound` — 수신자 `collapsedSourceIds` 의 library template 나무만 · 통째 `"{key}"` 만, 섞인 글자 템플릿은 대상 밖). resolver · materializer 무변경 — Gate 「자리가 둘 이상이면 목록 추가」 해당 없음.
  - Button · ToggleButton `children` → `label` (`referenceCapabilities.ts` `STORED_AS`, `CapabilityDef.referenceProp` 로 G1 (b) 는 레퍼런스 이름으로 대조). 전수 probe: `setChildren` 을 가진 23 type 중 덧붙던 것은 이 둘뿐 (나머지는 글자 교체 · 부품 type 은 단독 배치 불가).
  - 패널: `labels.ts` `capabilityLabel` (`t(labelKey, { prop })`) · `capabilityChoices` (`deriveOptions` + `resolveComponentRule`) — `CapabilityPicker` · `CatalogEventRow` 3 자리. `ValueField` 에 `choices` (PropertySelect) · `kind: "icon"` (PropertyIconPicker). R6 묶음 (표시 · 선택 · 값 section) 은 하지 않았다 — 순서는 「공통 3 · 개념 · 유도」 (`resolveCapabilities` 병합 순서 그대로), Meter 15 · TextField 43 항목은 PropertySelect 목록 스크롤 (LOW deferred).
  - 테스트: `apps/builder/src/preview/catalog/__tests__/adr287Reach.test.tsx` 10 (Meter value · label · ProgressBar isIndeterminate · ProgressCircle value · Badge variant · Button / ToggleButton children · Text children · 자기 isDisabled 켜기→끄기 · frame `disableAll` 아래 끄기 거절 + 경고) · `panels/interactions/__tests__/adr287PanelDo.test.tsx` 3 · Phase 0 ①b → GREEN. R1 원복 RED (`forwardTemplateBound` 호출 제거) → Meter label 1 RED.
  - Live 는 본문 Status 참조. live 결함 1 (요약 `[object Object]` — 지역 함수가 import 를 가림) 수리.

- **2026-10-28 Phase 3 닫힘 (G3)**
  - 생성기 (`packages/shared/src/codeView/generate.ts`): 암묵 상태 `valueType` = boolean (리터럴 · `!self` 값의 Do) · number (param number) · string (그 밖), 시작값 = 작성 prop ?? binding `accepts.default` ?? 종류 기본. 같은 (노드, prop) 의 작성 속성 생략. `CodeViewSymbols.states` (이름 → 노드 · prop).
  - 역변환 (`apps/builder/src/builder/catalogRuntime/codeViewEdit.ts`): `capabilityAt` (named 변수의 `capabilityOf` 를 노드 · prop 기준으로 일반화 — 암묵 상태만 `!param` Do 로 값을 읽는다; named 변수는 지금처럼 setState) · `planVariables` 가 `symbols.states` 이름의 상태 줄을 건너뜀 (strict 가 그 줄을 새 page 변수로 만들어 setter 가 setState 로 읽히던 것 — 디버그 실측).
  - 골든 파일 대신 인라인 단언: `codeView/__fixtures__/generated/` 는 `code-view-equivalence.mjs` 가 reference fixture 와 짝으로 대조하는 수용 집합 5 라 짝 없는 6 번째를 두지 않았다 — G3 의 「새 골든」 은 `adr284CodeView.test.tsx` 「ADR-287 G3」 3 (코드 문자열 + strict 왕복 + setter 편집 한 step).
  - 「변수로 정하기」 (`propFollow.ts`): `CatalogPropFollowType` + `number` · `choice`, 후보 병합 (정의 accepts 의 boolean · string · key 목록 → binding accepts 의 D2 kind, 제외 이름은 유도 층과 같은 `isExcludedProp`). UI (`CatalogPropFollowSection.tsx`) 의 prop 선택지 = 모든 빈 prop + `catalogPropFollowMoved`. 값 조건 (`when`) 은 boolean prop 만 — number · choice 는 변수 자체 (PropVar).
  - R7: `graph.ts` `validatePropChoices` (instance · override · definition defaults 세 호출 자리 공통) · `compositionRoot.ts` `withinChoices` (Canvas 와 Preview 가 같은 root 를 쓴다 — 두 consumer 에 같이). 경고는 record · key · 값 마다 1 회.
  - 테스트: `apps/builder/src/preview/catalog/__tests__/adr287Follow.test.tsx` 5 · `adr284CodeView.test.tsx` 14 (기존 11 + G3 3) · Phase 0 6/6 GREEN.

- **2026-10-28 Phase 4 닫힘 (G4)** — 사용자 결정 3 = 선택 Do 3 모두 숨김 + 안내.
  - gap B 자리: 패널 노출 판정 (`packages/shared/src/interactions/exposure.ts` `hiddenBySelectionMode` — `exposedCapabilities` 가 쓴다, `selectionDoHidden` — 안내 여부) · 안내 `CapabilityPicker.tsx` (`interactions-target-notice`, i18n `interactions.selectionModeOff` KO · EN). `declaredRefusal` (dispatcher 첫 검사) 은 그대로 추가만 막는다.
  - 실측 정정: 처음 구현 (op 무관 거절) 이 `adr284Phase6Repair.test.tsx` 「Edit turns selection on … Edit again clears」 를 RED 로 — ios-list 의 Cancel 은 `selectionMode` 를 변수로 `none` 으로 바꾼 뒤 `clearSelection` 을 실행한다 (RAC 가 받는 상태 초기화). 결정 3 은 패널 표면의 결정이라 실행 판정과 분리했다. 숨김의 대상 = `selectionMode` guard 를 가진 Do (목록 6 종 + Tree · ToggleButtonGroup 에서 같은 3 개).
  - 겹친 판정 하나 정리: `groupRefusal` 의 `selectionMode` 조건은 그대로 (When 그룹).
  - 테스트: `adr287PanelDo.test.tsx` 11 (Phase 2 의 3 + 목록 6 종 each 6 + 쓰는 이름 유지 1 + 안내 1 — 6 종의 selection guard Do 가 정확히 3 개인지 단언). 원복 RED (bash + trap 복원 + cmp): `hiddenBySelectionMode` 무력화 7 RED · 안내 분기 제거 1 RED. 회귀: shared 1,877 · builder unit 6,847 PASS (실패 1 = `chromeIsland.static`, HEAD 기존 · 이 ADR 무관).
  - 번들 측정 (별도 worktree × 2 — 메모리 `feedback-baseline-build-separate-worktree-original-deps`): 기준을 `72ddca08f` 에서 HEAD `2a3640ac9` 로 — 그 사이 커밋 (페이지 헤더 Code 토글) 이 이 ADR 밖이라 Δ 를 이 patch 만으로 잰다. after worktree = HEAD + `git diff HEAD` (이 ADR 의 코드 파일 · 새 파일, 문서 · task-state 제외 — dirty 31). engine wasm 은 `packages/engine` 무변경 확인 뒤 main 산출물 복사. 결과 Builder +2,079 · Preview +1,004 (파일별: Preview = shared chunk +1,035 · Builder = shared +1,035 · locales +434 · compositionRoot +213 · graph +52 · `PropertyIconPicker` 분리 chunk +3,676 ↔ main −747 · `useCatalogCommandRunner` 흡수 −2,194 ↔ theme +3,980). `adr201-bundle-gate.mjs` 는 after dist 에 Vite manifest 가 없어 돌지 않았다 (빌드 설정이 manifest 를 쓰지 않음 — upload chunk 위치 조건은 이 ADR 무관). G4 정정 = 사용자 결정 (본문 Gates).
  - `/review` 판독 1 (HIGH 0) 의 LOW 가설 1 수리: R1 `forwardTemplateBound` 가 `setRuntimeProps` 마다 수신자 하위 record 를 전부 훑었다 (바운드 행이 많은 목록의 선택 변경 · field 의 글자 입력마다). 판독이 제안한 「`own` 자식으로만 내려가기」 는 효과가 없다 — 바운드 행 record 의 `sourceId` 가 Row template 이라 `own` 이다. 수리 = template 나무에서 쓰인 key 를 통째 `{key}` 로 묶는 part 를 먼저 찾고, 없으면 record 를 걷지 않는다 (걷기는 전과 같이 모든 단계 — 중첩 instance 의 slot 채움은 다른 원본 record 아래의 own template 노드일 수 있다). 결정적 카운트 게이트 `adr287Reach.test.tsx` 「forwarding walks only when a part binds the written key」: ListBox 선택 한 번의 `domInputs.get` = 3 (수신자 자신 — 항목 수 무관) · 대조군 Meter `label` 은 part 까지 걷는다. 원복 RED: 조기 종료 제거 → 36 (항목 3 개 ListBox). 동작 변경 0 (같은 part 에 같은 값) — live 생략, Preview 경로 테스트 (`adr287Reach` 12 · Phase 0 · Follow · ios-list) 통과.
  - 문서: ADR-280 Status 대조 줄 · ADR-285 breakdown §8 어휘표 후속 · `.claude/rules/state-management.md` §6 (유도 Do 층 · 패널 숨김 예외) · README · CHANGELOG · 메모리 `project-interactions-do-from-reference-api`.

- **2026-10-28 G5 닫힘 · Implemented** — 사용자 「확인 했다」. 본문 `### Live Exercise` 5 (Chrome MCP 4 · 사용자 1) → `git mv` `completed/` · 링크 (본문의 `reviews/` · `design/` · `completed/280` · 조사 문서, 이 breakdown 머리말) · README (공지 · 열려 있는 것 · 순서 표 · 완료 표 307 · 열림 2 · 합계 309) · CHANGELOG · 메모리. `reviews/287.md` 의 옛 경로 인용은 판독 당시 기록이라 두었다.

(착수 뒤 phase 마다.)
