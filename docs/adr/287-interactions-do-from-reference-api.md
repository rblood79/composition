# ADR-287: Interactions 의 Do 를 레퍼런스 API 표에서 유도 — 컴포넌트마다 고유 기능이 나온다

## Status

Proposed — 2026-10-27 · 리뷰 Round 1 반영 2026-10-28 ([reviews/287.md](reviews/287.md) — HIGH 3 · MEDIUM 2: choice 의 선택지 출처 (H1) · composite template-bound prop 의 override 전달 (H2 — R1 전제 정정: `value` override 는 이미 DOM 에 닿는다) · 동적 enum 참조의 저장 검증 (H3 → R7) · 자기 `isDisabled` Do 의 guard 분리 (M4) · G1 비교 모집단 · 분모 25 + Image (M5 → 사용자 결정 4))

- 사용자 요청: `/create-adr` (2026-10-27) — 「Interactions Do 를 레퍼런스 API 표에서 유도」.
- 방향을 정한 사용자 원문 (2026-10-27):
  - 「interaction 패널 질문이다. 버튼에 이벤트에 meter 에 value 값을 변경할 수가 없다. 기능 누락인가」
  - 「meter 하나만 문제가 아니라 유사 컴포넌트인 progress bar, progress circle 도 동일하다, 또한 다른 컴포넌트들도 대부분 show, hide, toggle visibility 밖에 안 보인다. 전수 조사 진행하고 레퍼런스 체크 후 각 컴포넌트의 고유 기능이 나와야 한다」
  - 조사 뒤 선택지 (변수 경유 · Do 등록 · 조합) 에: 「**새 어휘 금지에 묶일 필요는 없다. 레퍼런스에서 제공하는 api 대로, 권장하는 패턴대로 제공하는 것이 가장 좋지 않을까?** https://react-aria.adobe.com/Meter.md, 마크다운도 각각 컴포넌트마다 제공된다」
- 전수 조사: [INTERACTIONS_CAPABILITY_AUDIT_2026-10.md](../explanation/research/INTERACTIONS_CAPABILITY_AUDIT_2026-10.md) — 팔레트 69 type 의 등록 · 패널 노출 · RAC 1.22.1 / S2 1.8.1 타입 대조 · 5174 live.
- 바뀌는 선행 원칙: [ADR-280](completed/280-interactions-rac-surface-registry-controlled-runtime.md) · 사용자 원칙 2026-10-22 「Interactions = RAC 표면을 UI 로 전달, 새 어휘 금지」 의 「표면」 을 **상태 prop 만이 아니라 레퍼런스 API 표 전체** (controlled prop · 표시 값 · 이벤트) 로 읽는다. 개념 파일 (`concepts/*.ts`) 과 spec (`componentInteractionSpecs.ts`) 의 등록은 그대로 두고 그 위에 유도 층을 더한다 — 메모리 `project-interactions-do-from-reference-api`.
- ADR-285 (Implemented 2026-10-27) 와의 관계: 코드 보기의 닫힌 어휘에 한 형태 (규칙이 쓰는 표시 prop = 암묵 `useState` 변수 — 생성기에 이미 있는 `capability:` 상태의 값 종류 확장) 만 더한다. 사용자가 「286 뒤 한 번에」 로 정한 코드 편집 범위 확장 ADR 과는 별도 — 이 ADR 은 Interactions 패널의 Do 가 주제다. ADR-286 과 데이터 모델이 겹치지 않아 순서 제약이 없다.
- 리뷰: 사용자 요청 시 `review-adr` → `reviews/287.md`.

> 구현 상세: [design/287-interactions-do-from-reference-api-breakdown.md](design/287-interactions-do-from-reference-api-breakdown.md)

## Context

### 도메인

D2 (Props/API) 의 소비 — 레퍼런스 API 표 (RAC `react-aria.adobe.com/<Component>.md` · S2) 가 정본인 prop 을 Interactions 의 Do 로 낸다. D1 (RAC DOM · 동작) 은 관찰만 — Do 는 RAC 의 controlled prop 을 밖에서 쓰는 것이고 RAC 안을 바꾸지 않는다. D3 (시각) 은 무관 — Canvas 는 작성 값을 그린다 (설계된 비대칭, ADR-281).

### 현재 (실측 2026-10-27, main `25e2290be`)

- **Do 등록부는 개념 + spec 에서 유도된다** (ADR-280): `packages/shared/src/interactions/concepts/*.ts` (21 파일 — RAC 문서 절 하나 = 개념 하나, 이름마다 설치 d.ts `satisfies`) × `componentInteractionSpecs.ts` (59 항목, 유일한 손 입력) → `deriveRegistry` → `CAPABILITY_REGISTRY`. 공통 3 (`show` · `hide` · `toggle` — `prop: "style.display"`) 은 `COMMON_CAPABILITIES` 가 모든 type 에 병합한다 (`capabilityRegistry.ts:128`).
- **패널 = 등록부**: Interactions 의 Capability 목록은 `exposedCapabilities(type, 노드 prop)` (`exposure.ts:102`) 이고, 5174 live 에서 SearchField = 공통 3 + Set value · Clear value, ListBox = + Select · Deselect · Clear selection 으로 등록부와 일치했다.
- **팔레트 69 type 중 30 이 등록 0** (공통 3 만): Meter · ProgressBar · ProgressCircle · Badge · StatusLight · Text · Keyboard · Icon · Image · Avatar · AvatarGroup · InlineAlert · Skeleton · Card · Button · Link · ButtonGroup · Breadcrumbs · DropZone · FileTrigger · FileUpload · Chart · Dialog · IllustratedMessage · Separator · Toolbar · Nav · Pagination · Section · Slot. 전부 표시 컴포넌트 — RAC · S2 에 setter 가 없다. 상태 컴포넌트 39 는 RAC 상태 prop (`X` · `defaultX` · `onXChange`) 과 1:1 로 등록돼 있고 빠진 상태는 없다 (조사 §3).
- **레퍼런스 API 표는 로컬에 있다**: `.claude/skills/react-aria/references/components/*.md` (RAC 53) · `.claude/skills/react-spectrum/references/components/*.md` (S2 71 — 70 에 `## API`) 의 표 한 행 = ``| `value` | `number | undefined` | 0 | The current value (controlled). |`` — prop · 타입 (literal union 포함) · 기본값 · 설명 (「(controlled)」 표지). Meter 는 `value` (controlled) · `minValue` · `maxValue` · `formatOptions` · `valueLabel`, 이벤트 없음.
- **catalog binding `accepts` 는 그 표와 이미 정렬돼 있다** (D2 게이트 `d2S2Alignment.static.test.ts`, 2026-10-14): Meter 11 (`value:number` · `minValue` · `maxValue` · `label` · `formatOptions` · `variant` · `size` · `showValueLabel` · `labelPosition` · `staticColor` · `valueLabel`), ProgressBar 11, ProgressCircle 6, Badge 8, StatusLight 4, Text 2 … (조사 §4). composition 전용 (Chart 56 · FileUpload 8 · Nav · Pagination) 은 표가 없고 accepts 만 있다.
- **실행 경로는 이미 generic 이다**: dispatcher 의 capability 는 「어떤 prop 을 무엇으로」 를 `CapabilityDef.prop` · `value` (`!param` · `!self` · 리터럴) 로 들고 대상 record 의 runtime override 에 patch 한다 (`dispatcher.ts:14~17` · `:505`) — 공통 3 의 `style.display` 와 같은 길. 단 DOM 이 override 를 읽는 자리는 상태 prop (`catalogControlledProps` — `runtimeStateProps.ts:67`) 과 몇 개 (`overrideOf(id)?.inputValue` — `domBinding.runtime.ts:900`) 로 한정돼 있다고 처음 적었으나, 리뷰 Round 1 probe (2026-10-28) 가 정정했다 — record 의 RAC props 합성 `withOverride` (`domBinding.runtime.ts:2933`, `domBinding.components.tsx:428` 에서 호출) 는 **이미 non-style override 전부를 record props 에 병합**하고, Meter `value: 50` 은 jsdom Preview 의 `aria-valuenow="50"` 에 닿는다. 닿지 않는 것은 **composite 의 template-bound 표시 prop** — Meter `label` 은 자식 Label 의 `children: "{label}"` (`reusableOriginLibrary.ts:5228`) 이 문서 projection 에서 해소되므로 record-local 병합이 자식에 전달되지 않고 (`setRuntimeProps` 는 수신자만 `touch` — `catalogPreviewInteractions.ts:849`), 자식은 `Storage` 를 유지한다 (Phase 0 RED ①b).
- **코드 보기는 capability Do 의 암묵 상태를 이미 만든다**: 변수가 없는 prop 을 쓰는 capability 는 `<노드>Prop` 이름의 `useState` 로 환원된다 (`generate.ts:452~480` — `capability:${nodeId}\u0000${prop}`). 값 종류가 `string[]` · `boolean` · `string` 셋뿐이라 number · enum 이 없다.
- **변수 경로도 막혀 있다**: 「변수로 정하기」 (`catalogPropFollowProps`, `propFollow.ts:93`) 는 `boolean` · `string` · key 목록 prop 만 받고, 입력이 원본 **정의** 의 `accepts` (template 이 묶은 prop — Meter 는 `label` 하나, `reusableOriginLibrary.ts:1023`) 라 `value` 가 후보에 없다. binding 의 D2 `accepts` 가 아니다.
- **목록 6 종의 비일관** (gap B): ListBox · GridList · Table · Menu · TagGroup · CardView 의 팔레트 기본값 `selectionMode: none` 에서 `selectItem` 만 거절 (`constraints.ts:82` — `op === "add"` 만) 하고 `deselectItem` · `clearSelection` 은 보인다.
- **패널 입력**: `ParamField.tsx` 의 param kind 는 `itemKey` · `value` · `text` · `number` — enum (값 목록) 입력이 없다. Do 라벨은 `translations.ts` `capabilities.*` 사전 (KO/EN).

### 사용자와 인계 상황

- 사용자는 비개발자다 (메모리 `user-non-developer-list-first-mental-model`) — 「버튼을 누르면 Meter 값이 바뀐다」 는 기능 이름 하나 = 동작 하나여야 한다. 변수를 먼저 만들고 prop 을 묶고 Set state 를 고르는 3 단계는 그 원칙에 어긋난다.
- 사용자 결정 10-27: 「새 어휘 금지에 묶일 필요는 없다 … 레퍼런스에서 제공하는 api 대로, 권장하는 패턴대로」 — Do 의 정본은 레퍼런스 API 표이고, 코드 보기는 RAC 권장 패턴 (`useState` + controlled prop) 으로 환원한다.

### 제약

- Do 는 **레퍼런스에 있는 prop** 만 — composition 이 지어낸 prop 은 없다 (D2 정본 순서 · `d2Provenance.ts` 의 확장만 예외). 설치 d.ts 와 이름이 다르면 컴파일이 막힌다 (`RAC_SURFACE_CHECK` 와 같은 급).
- 문서 스키마 무변경 — `InteractionAction { opcode: "capability", capabilityId }` 는 문자열 id 라 유도된 Do 가 그대로 들어간다. contract bump 없음.
- 문서 밖 실행 상태: Do 가 쓰는 값은 Preview · Publish 의 runtime override 다 (ADR-281 결정 3 · H1). Canvas 는 작성 값.
- Builder initial gzip Δ ≤ +2,000 B (등록부는 shared 의 initial 공용 chunk 다 — ADR-201 상한 안).
- 코드 보기 왕복 (ADR-285 strict 게이트) 깨지지 않음 — golden 5 코드 동일 · 새 골든 1 (Meter + Button).
- 마이그레이션 코드 없음 (개발 단계).

## Alternatives Considered

### 대안 A: 손 등록 확장 — 표시 컴포넌트마다 spec 에 개념을 더한다

- 설명: 지금 방식 그대로. `concepts/displayValue.ts` (value · minValue · maxValue) · `displayText.ts` (children) · `displayVariant.ts` … 를 만들고 `componentInteractionSpecs.ts` 에 30 줄을 손으로 적는다.
- 근거: ADR-280 의 구조 유지 — 개념 하나 = RAC 문서 절 하나.
- 위험: 기술(L) / 성능(L) / 유지보수(**H** — 표시 prop 은 「절」 이 아니라 표의 행이라 개념 단위가 맞지 않고, 30 type × 평균 6 prop 을 손으로 적으면 레퍼런스 표와 어긋나도 아무것도 막지 않는다 — 지금 30 이 빠진 이유가 그것) / 마이그레이션(L).

### 대안 B: 레퍼런스 마크다운의 `## API` 표를 파싱해 생성 모듈로

- 설명: `.claude/skills/*/references/components/*.md` 의 표를 스크립트가 읽어 `generated/referenceCapabilities.ts` 를 만든다. 쓸 수 있는 prop 행 하나 = Do 하나.
- 근거: 사용자 원문 「마크다운도 각각 컴포넌트마다 제공된다」 — 표가 곧 고유 기능 목록.
- 위험: 기술(**M** — skill 스냅샷의 표 포맷 · 타입 문자열 (`number | undefined` · literal union · `ReactNode`) 파싱이 설치 버전과 어긋날 수 있고, composition 전용 Chart · FileUpload · Nav · Pagination 은 표가 없다) / 성능(L) / 유지보수(M — 생성물 + 파서 둘을 관리, D2 정본 (binding `accepts`) 과 **두 번째 정본** 이 생긴다 — ssot-hierarchy §6 의 consumer-to-consumer 위반과 같은 모양) / 마이그레이션(L).

### 대안 C: binding `accepts` (D2) 에서 유도하고, 레퍼런스 API 표가 게이트의 oracle (채택)

- 설명: 유도 입력은 이미 S2 · RAC 타입과 정렬된 catalog binding `accepts` (D2 정본 — kind · enum 값 · 기본값이 있다). 유도 규칙 (Decision 2) 으로 type 마다 Do 를 만들어 `CAPABILITY_REGISTRY` 에 **개념 등록 뒤에** 병합한다 (같은 prop 은 개념이 이김). 정적 게이트가 레퍼런스 마크다운의 `## API` 표를 읽어 「표에 있는 쓸 수 있는 prop 마다 Do 가 있다 · Do 는 표에 있는 prop 만」 을 대조한다 — 표는 **oracle**, 정본은 하나 (accepts). composition 전용 type 은 accepts 만으로 유도되고 표 대조는 건너뛴다 (명단 고정).
- 근거: D2 정본 순서 (ssot-hierarchy §D2 — S2 → design-data → v3 → 확장) 를 그대로 타고, `d2S2Alignment` 가 accepts 를 설치 타입과 이미 묶어 두었다. 사용자의 「api 대로」 는 게이트가 보증한다.
- 위험: 기술(L) / 성능(L — 등록부 +~250 Do, 초기 chunk +≤2 KB gz) / 유지보수(L — 손 입력 0, 표가 바뀌면 게이트가 RED) / 마이그레이션(L — 스키마 무변경).

### 대안 D: 변수 경유만 — 「변수로 정하기」 를 넓히고 Do 는 Set state 로

- 설명: Do 를 늘리지 않고 prop 바인딩 (number · enum) + Set state 로 해결 (조사 §6 의 1).
- 위험: 기술(L) / 성능(L) / 유지보수(L) / 마이그레이션(L) — 그러나 **사용자 결정으로 기각** (「새 어휘 금지에 묶일 필요 없다 … api 대로」) · 비개발자 3 단계 문제. 단 「변수로 정하기」 의 종류 확장 자체는 C 에 포함한다 — 코드 보기 `<Meter value={x}>` 의 역변환 (ADR-285 어휘 `prop={x}`) 이 number 변수를 받아야 한다.

### Risk Threshold Check

| 대안                           | HIGH+      | 판정                                |
| ------------------------------ | ---------- | ----------------------------------- |
| A 손 등록                      | 유지보수 H | 기각 — 표와 어긋나도 막지 않음      |
| B 표 파싱 생성                 | — (M 2)    | 기각 — D2 정본이 둘                 |
| **C accepts 유도 + 표 oracle** | **0**      | 채택                                |
| D 변수 경유만                  | 0          | 사용자 기각 (종류 확장은 C 에 흡수) |

루프 불요 — 채택 대안 HIGH 0.

## Decision

**대안 C.** Interactions 의 Do 는 레퍼런스 API 표에 있는 prop 마다 하나씩 나오고, 유도는 D2 정본 (binding `accepts`) 에서, 정합은 레퍼런스 표를 oracle 로 한 정적 게이트가 보증한다.

1. **유도 층** — `packages/shared/src/interactions/referenceCapabilities.ts`: type 의 binding `accepts` 에서 쓸 수 있는 prop 을 골라 `CapabilityDef` 를 만든다. `CAPABILITY_REGISTRY` = 개념 유도 (ADR-280) ⊕ 유도 층 (개념이 가진 prop 은 유도하지 않음 — TextField `value` 는 개념의 `setValue` 그대로) ⊕ 공통 3.
2. **유도 규칙** (prop kind → Do):
   - `number` · `string` · `number-format` · `icon` → 「<prop> 정하기」 1 (`prop`, `value: "!param"`, param kind = number · text · icon) — Meter `value` · `minValue` · `maxValue` · `valueLabel`, Text `children`, Icon `iconName`.
   - `boolean` → 켜기 · 끄기 · 전환 3 (`value: true` · `false` · `"!self"`) — ProgressBar `isIndeterminate`, Skeleton `isLoading`, Button `isPending`, Card `isSelected`.
   - `enum` · `variant` · `size` · `fillStyle` (값 목록) → 「<prop> 정하기」 1, param kind = `choice` — 목록은 **catalog 의 기존 선택지 해소 계약** `deriveOptions(contract, rule, node, key)` (`outputs/editFields.ts:191`): `enum` 은 `accepts.options`, `variant` · `size` 는 rule 의 `variants` · `sizes` 키 (`types.ts:212` — variant · size 는 `options` 를 두지 않는다. Badge `variant` · Meter `size` 의 `options` 는 `undefined` — 리뷰 Round 1 probe), RadioGroup `value` 는 자식 Radio. accepts 에 D3 선택지를 중복 저장하지 않는다. 목록이 빈 prop 은 Do 를 내지 않고 G1 이 수를 보고한다 — Badge `variant`, StatusLight `variant`.
   - 제외: 이벤트 (`on*` — When), 데이터 (`dataBinding` · `items` · `children` 이 ReactNode 인 것 · `seriesConfig` 같은 `items-manager`), 식별 (`id` · `slot` · `aria-*` · `className` · `style` · `styles` · `UNSAFE_*`), `isDisabled` · `isReadOnly` · `isRequired` (ADR-281 의 조상 상속 capability 가 담당 — 노드 자신의 것은 유도 — **사용자 결정 1**).
3. **실행** — dispatcher 의 generic prop patch 는 무변경, 제약 판정 (`declaredRefusal`) 은 아래 guard 계약으로 바뀐다. record 자신의 prop 은 `withOverride` 가 이미 병합한다 (Context 「현재」 — `value` · `variant` · `isIndeterminate` 는 추가 없이 닿는다). 더하는 것은 **composite 의 template-bound 표시 prop 전달**: 수신자 record 의 override 중 자식 template 이 `"{prop}"` 로 읽는 키 (Meter · ProgressBar `label` · `valueLabel`, DropZone `label` · `description` …) 를 문서 projection 의 template binding 해소에 넘기고 그 자식을 무효화한다 (`setRuntimeProps` 의 `touch` 를 의존 자식까지 — 문서 저장값은 바꾸지 않는다). Canvas 는 작성 값 (설계된 비대칭 유지). **guard 계약 (M4)**: `declaredRefusal` (`constraints.ts:72`) 은 지금 `guards.includes("isDisabled")` 한 분기에서 자기 `props.isDisabled` 와 조상 `inherited.isDisabled` 를 함께 검사한다 — 자기 상태 검사와 조상 검사를 **guard 토큰으로 분리**한다: `"isDisabled"` = 둘 다 (입력 Do — 지금과 같음), 새 토큰 `"inherited:isDisabled"` = 조상만. 상태 자체를 관리하는 Do (사용자 결정 1 의 자기 `isDisabled` 켜기 · 끄기 · 전환) 는 `guards: ["inherited:isDisabled"]` — 자기 `isDisabled: true` 수신자에 `false` 를 쓰는 해제는 통과하고, frame `disableAll` 아래의 쓰기는 거절한다 (`guards: []` 는 조상 검사까지 우회해 틀리다 — 리뷰 Round 2 probe). dispatcher (`dispatcher.ts:746`) 와 패널 (`exposure.ts:112`) 은 같은 함수를 쓰므로 한 자리 변경으로 둘 다 맞는다.
4. **패널** — `ParamField` 에 `choice` kind (값 목록) 추가. Do 목록은 「공통 3 · 개념 Do · 유도 Do」 순, 라벨은 사전에 있으면 사전 (`capabilities.setValue` = 「값 정하기」), 없으면 prop 이름에서 (「minValue 정하기」 — **사용자 결정 2**).
5. **코드 보기 (RAC 권장 패턴)** — 생성기의 암묵 `capability:` 상태에 값 종류 number · enum(string) 을 더하고 기본값 = 작성 prop 값 (`<Meter value={meterValue}>` + `let [meterValue, setMeterValue] = useState(40)` + `onPress={() => setMeterValue(80)}`). 역변환 (`dosOf` — setter 호출 → capability Do) 은 같은 이름 규칙으로 읽는다. ADR-285 어휘표에 「규칙이 쓰는 표시 prop = 암묵 변수」 한 행 (emit `capabilityState` · read `dosOf`).
6. **「변수로 정하기」** — 입력을 원본 정의 `accepts` 에서 binding `accepts` (D2) 로 바꾸고 number · enum · icon 종류를 받는다 (값 조건 · 비교는 number 는 그대로, enum 은 `equals` 만). 코드 `<Meter value={progress}>` 의 역변환이 이것을 쓴다. **저장 계약 (H3)**: `validatePropChoices` (`document/graph.ts:1565`) 는 `propChoices` 키의 whole-template 바인딩을 같은 accepts 의 원본 prop 일 때만 통과시키고 변수 참조 (`PropVar`) 는 리터럴 `choices.includes` 로 판정한다 — 기본값 `positive` 인 string 변수를 Meter `variant` 에 연결하는 `catalogPropFollowCommand` 가 `workspace.execute` 에서 `PROP_CHOICE_MISMATCH` 로 거절된다 (number `value` 는 같은 길에서 통과 — 리뷰 Round 1 probe). 정책: 저장은 `PropVar` 의 변수 `valueType` 이 `string` 이면 통과 (`instanceContract` 가 원본 root 의 `propChoices` 를 상속하는 `library.ts:142` 도 같은 판정) · runtime 은 해소한 값이 허용 집합 밖이면 **작성 값으로 되돌리고** `console.warn` 1 (DOM 이 모르는 variant 를 그리지 않음) · 코드 역변환은 변수 이름 그대로. G3 가 저장 · 재열기 · 역변환 · 집합 밖 값을 잰다.
7. **gap B** — `selectionMode: none` 에서 `deselectItem` · `clearSelection` 도 함께 거절 (op 무관) 또는 selectItem 을 고르면 `selectionMode` 를 `single` 로 올리는 안내 — **사용자 결정 3**.
8. **게이트** — 정적 테스트 `referenceCapabilities.static.test.ts`. **비교 모집단 (M5)**: type 의 oracle 행 = RAC 표 ∪ S2 표 (둘 다 있으면 합집합 — RAC 가 동작 · 상태, S2 가 시각 prop) − 제외 패턴 − **명시 보류 목록**. 표 전체와 accepts 는 동등하지 않다 — RAC 표는 `DOMProps` · `GlobalDOMAttributes` (`dir` · `hidden` · `lang` · `translate` · `role` · `tabIndex` …) 를 싣지만 accepts 에는 없고 (`d2S2Alignment.static.test.ts:196` 은 accepts ⊆ API 만 검사), accepts 를 넓히는 것은 이 ADR 밖이다. 그래서 (a) 모집단의 행마다 그 type 에 Do 가 있거나 보류 목록 (`DEFERRED_REFERENCE_PROPS` — type × prop × 사유, 코드) 에 있다 — DOM 전역 속성은 제외 패턴, 그 밖의 빠진 행은 보류 목록에 사유와 함께 (게이트 메시지에 수를 보고 · 수가 늘면 RED — ratchet) (b) 유도 Do 의 prop 은 전부 표 또는 `d2Provenance.ts` 에 있다 (c) 표시 컴포넌트 30 중 Nav · Pagination · Section · Slot (accepts 에 쓸 수 있는 prop 0) 과 Image (accepts 0 — `src` 는 `visual` 축, **사용자 결정 4**) 를 뺀 **25** 가 Do ≥ 1 (d) `choice` Do 의 해소 목록이 비어 있지 않고 값이 표의 literal union 안이다 (H1). 표 파서는 테스트 안 (생성물 없음) — 못 읽는 파일은 RED 로 남기고 파서를 고친다, 명단에서 빼지 않는다 (의미적 누락이 통과하면 안 된다).

**위험 수용 근거**: 유도 Do 의 수가 많아져도 (추정 +250) 패널은 type 하나의 목록만 보이고 (평균 8), 등록부는 lazy 아님이지만 CapabilityDef 는 작은 객체라 initial Δ 는 상한 안이다 (G4 가 잰다). record 자신의 override 는 `withOverride` 가 이미 병합하므로 (상태 prop 은 `catalogControlledProps` 가 먼저) 새 합성 자리는 없고, 더하는 것은 template-bound prop 의 자식 전달 한 경로뿐이다 (R1). 동적 enum 참조는 저장에서 변수 type 으로, runtime 에서 값으로 두 번 판정해 모르는 variant 가 DOM 에 가지 않는다 (R7).

**기각 사유**: A — 손 입력 30 은 지금 빠진 원인의 반복. B — D2 정본이 둘이 된다 (accepts 와 생성물). D — 사용자 결정.

### 사용자 결정 4 건 (execute-adr 가 그 항목에 닿을 때 묻는다 — 4 결정 지점 밖)

1. **노드 자신의 `isDisabled` · `isReadOnly` · `isRequired` 를 유도하는가** — 권고: 유도 (레퍼런스 표에 있음 · frame 의 `disableAll` 은 조상 상속이라 다른 것). **채택 시 (M4)**: 자기 `isDisabled` 켜기 · 끄기 · 전환은 `guards: ["inherited:isDisabled"]` (Decision 3 의 guard 계약) — 공통 `"isDisabled"` 를 그대로 붙이면 `isDisabled: true` 인 대상의 해제 · 전환도 거절되고 (`constraints.ts:72`) 처음부터 disabled 인 대상은 패널에서 해제 Do 가 숨으며, 반대로 guard 를 비우면 조상 검사까지 우회한다 (Round 2). 조상 `inherited.isDisabled` 는 새 토큰이 거절 (frame `disableAll` 이 이긴다 — 해제는 frame 에서). 기각 시 제외 목록에 두고 이 가지를 기록한다.
2. **유도 Do 의 라벨** — 권고: 사전에 있는 이름 (「값 정하기」 · 「켜기」) 은 사전, 없는 prop 은 「<prop> 정하기」 (KO/EN 같은 문구에 prop 이름 삽입 — i18n 키 폭증 없음). 대안: 30 type × prop 전부 사전화.
3. **gap B** — 권고: `selectionMode: none` 이면 선택 Do 3 을 전부 숨김 (일관) + 패널 안내 「선택 모드를 켜면 나옵니다」.
4. **Image 의 `src`** — accepts 0 이라 유도 Do 가 없다 (`src` 는 `visual` 축). 권고: Phase 0 에서 `src` 의 자리를 실측해 「이미지 정하기」 (URL text) Do 를 visual 축에서 유도 — 채택 시 (c) 의 분모 25 → 26. 기각 시 Image 는 공통 3 만 (분모 25 유지).

## Risks

| ID  | 위험                                                                                                                                                                                                                |  심각도  | 대응                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | composite 의 template-bound 표시 prop (Meter · ProgressBar `label` …) 의 override 가 자식에 닿지 않아 Do 가 조용히 무효 (record 자신의 prop 은 `withOverride` 가 이미 병합 — `value` 는 닿는다, 리뷰 Round 1 probe) | **HIGH** | Phase 0 RED ①a (Meter Do 미등록 — 패널 부재) · ①b (`label` override → 자식 Label 그대로 `Storage`) → Phase 2 에서 template binding 전달 + 의존 자식 무효화 · G2 live 에 `label` 포함 |
| R7  | 동적 enum 참조 (string 변수 → `variant`) 가 `validatePropChoices` 의 리터럴 판정에 막혀 저장 불가 (`PROP_CHOICE_MISMATCH`) 하거나, 허용 집합 밖 값이 DOM 에 간다                                                    | **HIGH** | Decision 6 정책 (저장 = 변수 type · runtime = 값 → 작성 값 + warn) · G3 저장 · 재열기 · 역변환 · 집합 밖 값                                                                          |
| R8  | 레퍼런스 표 ↔ accepts 비동등 (RAC `DOMProps` 전역 속성 · S2 에만 있는 축) 으로 G1 (a) 가 통과 불가하거나 vacuous                                                                                                    |   MED    | 비교 모집단 고정 (Decision 8) · 보류 목록 ratchet (늘면 RED) · 파서 실패 파일 제외 금지                                                                                              |
| R2  | 코드 보기 왕복이 깨짐 — 암묵 상태 이름 · 값 종류가 역변환과 어긋나 strict 게이트 RED                                                                                                                                |   MED    | 골든 1 (Meter + Button) 을 `roundTrip` 에 추가 · 이름 규칙 하나 (`<노드><Prop>`) 를 생성 · 역변환이 같이 읽음                                                                        |
| R3  | 유도 Do 가 개념 Do 와 같은 prop 을 중복 등록 (TextField `value`)                                                                                                                                                    |   MED    | 유도 층이 개념의 `prop` 집합을 빼고 만든다 + 정적 단언 (중복 0)                                                                                                                      |
| R4  | 레퍼런스 표 파서의 false RED (표 포맷 · `ReactNode` 타입 · 제네릭) 로 게이트가 흔들림                                                                                                                               |   MED    | 파서는 행 정규식 하나 · 제외 규칙은 코드 (`EXCLUDED_PROP_PATTERNS`) · 스냅샷 버전은 skill `MANIFEST.md` 에 고정 · RED 시 표 행을 그대로 메시지에                                     |
| R5  | Builder initial +Δ (등록부 ~250 Do)                                                                                                                                                                                 |   LOW    | G4 ≤ +2,000 B gz — 넘으면 유도 층을 lazy (패널 chunk) 로 옮기고 dispatcher 는 `resolveCapabilities` 를 Preview 세션에서                                                              |
| R6  | 패널 Do 목록이 길어져 (Meter 11) 비개발자가 고르기 어려움                                                                                                                                                           |   LOW    | 목록을 「표시 · 선택 · 값」 묶음으로 (RAC Menu section) — Phase 3                                                                                                                    |

## Gates

측정 5-질문 (measurement-validity): G1 의 oracle 은 레퍼런스 표 (코드 밖) 라 유도 층이 자기 자신을 재지 않는다 · G2 는 Preview DOM 의 실제 속성 (`aria-valuenow`) 을 읽는다 · G4 는 `adr201-bundle-gate.mjs` 방식 (production 빌드) · 모든 게이트는 pre-push 또는 수동 실행.

| Gate | 시점    | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 실패 시 대안                                                                                                                           |
| ---- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| G0   | Phase 0 | inventory (breakdown §1 — 69 type × accepts prop 분류: 유도 · 개념 · 제외) · RED 3 (`it.fails`): ①a Meter 등록에 `value` Do 없음 (패널 `exposedCapabilities` 부재 — 미등록과 DOM 소비를 분리) · ①b Meter `label` override 가 자식 Label 에 닿지 않음 (`Storage` 유지 — `value` override 는 지금도 `aria-valuenow="50"`, 대조군) ② 코드 보기가 그 규칙을 `setMeterValue(50)` 으로 내지 않음 (지금은 `string` 상태 `""`) ③ 「변수로 정하기」 후보에 Meter `value` 없음 · 레퍼런스 표 파서가 RAC 53 · S2 70 을 오류 0 으로 읽음 (행 수 보고)                                                                             | 파서가 표를 못 읽는 파일은 RED 로 남기고 파서를 고친다 — 명단에서 빼지 않는다 (M5)                                                     |
| G1   | Phase 1 | 정적: 비교 모집단 (RAC ∪ S2 − 제외 − 보류) 의 행 ↔ Do (a · b · c 분모 25 · d choice 목록 비어 있지 않음 · literal 안) · 보류 목록 수 보고 (늘면 RED) · 개념과 중복 0 · 설치 d.ts 이름 검사 (`satisfies` 급) · 원복 RED (유도 층 제거 → Meter Do 0)                                                                                                                                                                                                                                                                                                                                                                    | 표와 accepts 가 다른 prop 은 보류 목록에 사유와 함께 — accepts 수리는 D2 게이트 (`d2S2Alignment`) 쪽, 이 ADR 이 accepts 를 고치지 않음 |
| G2   | Phase 2 | R1 RED ①a · ①b → GREEN · live (별도 dev 서버): Button → Meter `value` · **Meter `label` (자식 Label 글자가 바뀜)** · ProgressBar `isIndeterminate` 켜기 · Badge `variant` 정하기 (choice 목록 = rule variants) · Text `children` 정하기 → Preview 에서 바뀜 · Canvas 무변화 · 콘솔 오류 0 · 패널 `choice` 입력 · 사용자 결정 1 채택 시 Button → 다른 Button `isDisabled` 켜기 → 끄기 (자기 해제 통과) **그리고** `disableAll` frame 안의 Button 에 끄기 → 거절 (조상 검사 보존) · 정적: `declaredRefusal(["inherited:isDisabled"], {isDisabled: true}, {isDisabled: true})` 거절 · `(…, {isDisabled: true}, {})` 통과 | template binding 전달 자리가 둘 이상 (projection · materializer) 이면 Phase 2 에 그 자리 목록 추가 (사후 보고)                         |
| G3   | Phase 3 | 코드 보기: golden 5 코드 동일 · 새 골든 (Meter + Button) 왕복 · `<Meter value={progress}>` 역변환 → prop follow (number) · strict 게이트 GREEN · 「변수로 정하기」 number · enum 입력 live 1 · **R7**: string 변수 (`positive`) → Meter `variant` 연결이 `workspace.execute` 를 통과 · 저장 → 재열기 → 코드 역변환 PASS · 변수를 `bogus` 로 바꾸면 Preview 는 작성 variant 유지 + warn 1 · 원복 RED (`PROP_CHOICE_MISMATCH`)                                                                                                                                                                                          | —                                                                                                                                      |
| G4   | Phase 4 | Builder initial Δ ≤ +2,000 B gz · Preview Δ 0 · gap B (사용자 결정 3) · `docs:stale-symbols` 0 · 문서 (ADR-280 Status 주석 · ADR-285 어휘표 행 · `state-management.md` §6 · README · CHANGELOG · 메모리)                                                                                                                                                                                                                                                                                                                                                                                                              | 번들 초과 → R5 대안                                                                                                                    |
| G5   | 종결    | 사용자 Builder 확인 — 보고한 사례 (Button → Meter 값) + ProgressBar · ProgressCircle + 다른 표시 컴포넌트 1 → Implemented                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 지적 수리 뒤 재확인                                                                                                                    |

### Live Exercise

(Implemented 승격 시 기재 — 별도 dev 서버 · Chrome MCP / 사용자 confirm 구분.)

## Consequences

### Positive

- 표시 컴포넌트 25 (+ Image 는 사용자 결정 4) 에 고유 Do 가 생긴다 — 사용자 보고 (Meter · ProgressBar · ProgressCircle) 가 레퍼런스 API 그대로 닫힌다.
- 등록이 손 입력에서 유도로 — 레퍼런스 표가 바뀌면 게이트가 알린다.
- 코드 보기가 RAC 권장 패턴 (`useState` + controlled prop) 을 내고 다시 읽는다 — 비개발자는 Do 하나, 코드는 레퍼런스 모양.
- 「변수로 정하기」 가 number · enum 까지 — 조건 · 값 바인딩의 빈 자리가 메워진다.

### Negative

- 등록부 크기 +~250 Do (initial +≤2 KB) · 패널 목록이 길어진다 (묶음으로 완화).
- composite 의 template-bound prop 에 runtime override 를 전달하는 경로가 하나 더 — 문서 projection 의 template binding 해소가 runtime 값을 읽게 되므로 저장값 · projection · runtime 의 경계 (저장값 무변경) 를 지켜야 한다.
- `propChoices` 검증이 변수 참조를 통과시키므로 허용 집합 밖 값의 판정이 runtime 으로 옮겨 간다 (작성 값 + warn).
- i18n 사전 밖 라벨 (prop 이름 삽입) 은 영어 prop 이름이 KO UI 에 드러난다 (사용자 결정 2).
