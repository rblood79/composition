# ADR-281 Design Breakdown — 패널 어휘 · 조상 상속 · instance 규칙 상속 · Form 제출 목적지

> 본문: [281-interactions-panel-vocabulary-inheritance-form-destination.md](../281-interactions-panel-vocabulary-inheritance-form-destination.md). 실측 기준 main `34ce5f554` + ADR-280 작업 트리 (2026-10-22).

## 0. fork 4 질문 lock-in (ADR-280 ↔ 281)

1. **base / 응용**: ADR-280 (base) 이 등록표의 모양 (`deriveRegistry` 출력 — `events` · `hiddenEvents` · `capabilities{prop, guards, op, param}`) 과 실행이 RAC 에 닿는 조건을 정했다. 이 ADR (응용) 은 그 등록표를 **패널 · 상속 · instance · Form** 에서 소비한다. 의존 방향 158 → 248 · 250 · 256 → 280 → **281**. 반대 방향 (281 이 등록표의 기존 키를 바꾸는 것) 은 없다 — 더하는 것은 개념의 선택 필드 (`args` · `group`) 와 `deriveRegistry` 출력의 선택 키 둘 (`eventArgs` · `groups`) 뿐이고, 280 의 스냅샷 테스트는 기존 키만 보므로 그대로 GREEN 이어야 한다 (review round 1 LOW).
2. **schema 직교성**: 280 은 스키마 0. 281 은 `DescendantPatchFields.interactions` 한 필드 (address 층의 specialization — 248 · 262 의 patch 모델 후속) 와 binding `accepts` (D2). `InteractionEntry` 의 규칙 모양은 둘 다 안 건드린다.
3. **선행 ADR 전제 reverse 검증**: 280 의 「When owner ≠ Do 수신자」 (Decision 3) · 「controlled 는 첫 render 부터」 (Decision 4) · 「guard 는 dispatcher 쓰기에만」 (Decision 8) 을 그대로 쓴다. 이 ADR 의 조상 상속은 guard 의 `inherited` 입력을 넓힐 뿐 순서를 바꾸지 않는다 — grep 으로 `getConstraintContext` 소비자가 `catalogPreviewInteractions.ts` 하나임을 확인 (2026-10-22).
4. **판독 라운드에 전제 검증을 미루지 않음**: 위 1 ~ 3 은 사용자 결정 Q4 (ADR 2 개 · 280 이 base) 로 2026-10-22 에 확정됐다 (280 Status). 이 ADR 의 리뷰는 본문 정합만 본다.

## 1. Phase 0 — inventory freeze · RED · probe

### 1a. 패널 어휘 inventory (실측 2026-10-22)

| 항목           | 지금                                                                                                                                          | 이 ADR 뒤                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| When 선택지    | `resolveTriggers(type)` → `events` 평평한 목록 (`TriggerPicker.tsx:25-37`)                                                                    | 개념 그룹 (`ConceptUse.concept.id` 순서) · 조건 불충족 그룹 숨김 · 숨은 이벤트 토글         |
| 숨은 이벤트    | `hiddenEvents` 소비자 0 (`deriveRegistry.ts:58-81`) — press 보조 (`onPressStart` …) · hover 3 · focus 보조 · keyboard 2 · 항목 owner callback | 토글 「RAC 전체 보기」 — keyboard 제외 (Q3) · 항목 owner callback 은 항목 노드에서 (280)    |
| 라벨           | `labels.ts:16-30` 손 목록 13 · 폴백 = RAC 원문                                                                                                | 개념 단위 키 `interactions.trigger.<concept>.<event>` — 정적 테스트가 55 type 전수 확인     |
| 조건           | 개념 `conditions` → `guards` (dispatcher 만, `constraints.ts:60-102`)                                                                         | 패널도 같은 `guards` 로 선언값 판정 (`isDisabled` · `isReadOnly` · `selectionMode`)         |
| 값 칸          | `ParamField.tsx:31-41` 텍스트 하나 · `!event` 는 손으로                                                                                       | 소스 「리터럴 / 이벤트 인자」 · 인자 목록 = 개념 `args`                                     |
| 이벤트 인자 표 | `bindings.ts:113-126` `EVENT_ARG_NAMES` 12 callback (손 표)                                                                                   | 개념 파일 `args` 로 이동 · `bindings.ts` 는 등록표에서 읽음 · `onSubmit: ["formData"]` 추가 |
| Do 대상        | 같은 페이지 노드 · page 루트는 목록에 있되 기본 제외 (`interactions.ts:119-145` · `:247`)                                                     | 유지 · page 루트가 상속 prop capability 를 갖는다                                           |

### 1b. 조상 상속 inventory

- 설치 RAC export: `Provider` · `useContextProps` (`react-aria-components/dist/types/index.d.ts:16`), `I18nProvider` (`:76`), `RouterProvider` (`:75`). S2 `Provider` (`@react-spectrum/s2/dist/types/src/Provider.d.ts:10-36`) — `locale` · `router` · `colorScheme` · `background` · `styles` · `elementType`. v3 `Provider` 의 `isDisabled` · `isReadOnly` · `isRequired` 캐스케이드는 S2 에 없다 (연구 §4-f) → D2 3 단계 `v3` 출처.
- 받는 쪽: `XContext` export 전수 중 props 타입에 `isDisabled` / `isReadOnly` / `isRequired` 가 있는 것 — Phase 0 에서 d.ts 로 세고 `providerContexts.ts` 표로 고정 (`satisfies` — `RAC_PROVIDER_CHECK`). 추정 30 ± (Button · ToggleButton · Checkbox · CheckboxGroup · RadioGroup · Switch · TextField · TextArea · NumberField · SearchField · Select · ComboBox · Slider · DateField · TimeField · DatePicker · DateRangePicker · Calendar · RangeCalendar · ColorField · ColorArea · ColorSlider · ColorWheel · ListBox · GridList · Table · Tree · TagGroup · Tabs · Menu · Link · Disclosure · DisclosureGroup · Form …).
- composition 지금: `body` `accepts: {}` (`Body.binding.ts:26`) · `frame` DOM `div` (`domBinding.runtime.ts:652`) · 파생값 경로 `presence.ts` `derivedProps` (field 부품 `isDisabled` · `isInvalid` · `isQuiet`) · `CATALOG_SIZE_PROPAGATION` (`resolver.ts`).
- dispatcher: `getConstraintContext(id).inherited` 는 지금 `catalogToggleGroupOf` (그룹 4) 만 (`catalogPreviewInteractions.ts`).
- theme: `theme.ts:54` `activeThemeId ?? themeIds[0]` · `:164-174` colorMode · 세션 `applyTheme` (`catalogPreviewSession.ts:63-66`).

### 1c. instance 규칙 상속 inventory

- 실행: `recordsOfOwner` (`catalogPreviewInteractions.ts:38-54`) — address 없는 규칙 = source 의 모든 record · address 있는 규칙 = instancePath 꼬리 일치 record.
- 패널: `catalogInteractionsOf` (`interactions.ts:66-88`) — `ownerId` + `sameOwnerAddress` 일치만.
- 저장 층: `DescendantPatchFields` (`types.ts:473-488`) — `props` · `visual` · `sizing` · `stateRules` · `enabled` · `displayState` · `layout` · `fills` · `fillSizing` · `responsive` · `visibility`. ADR-262 전수 표 19 행 (`262 breakdown §1`) · `pushInstanceOverrides` · `resetInstance` · `resetOverrideField`.
- contract: `LIBRARY_CONTRACT_VERSION` 46 (ADR-279) → 47.

### 1d. Form 목적지 inventory

- opcode: `types.ts:879` `{ opcode: "callEndpoint"; endpointId: DataEndpointId }` · 검증 `validation.ts:1437-1439` · library 허용 `library.ts:236` · Preview 변환 0 (`catalogPreviewInteractions.ts:57`).
- 실행기: `catalogPreviewDataServices` (`catalogPreviewSession.ts:47-56`) → `createCollectionEndpointExecutor(endpoints)` → `ApiEndpointService.executeApiEndpoint(endpointId, signal)` (`collection.types.ts:195-202`) — body 인자 없음. `ApiEndpointDefinition` (`:104-125`) `method` · `headers` · `bodyType` · `bodyTemplate` (문자열).
- Form: `delegatedDom.runtime.ts:2950-2975` `onSubmit` (280 Decision 9 preventDefault 조건) · FormData 처리 0 (grep) · `EVENT_ARG_NAMES` 에 `onSubmit` 없음.
- dispatcher: `DispatchDeps` 에 `callEndpoint` 없음 · `writeState` 는 있음 (`dispatcher.ts:205-221`).

### 1e. RED (`it.fails` — 280 하니스 재사용)

| #   | 반례                                                                                                                            | 위치                            | 지금                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------- |
| ①   | 원본 Button 의 `onPress → toast` 규칙 · instance 두 개 · 패널 `catalogInteractionsOf(instance)` = 0 인데 두 instance 모두 toast | builder `adr281Phase0.test.tsx` | RED (보이지 않는 규칙이 실행) |
| ②   | `selectionMode: "none"` ListBox 를 대상으로 `resolveCapabilities` 에 `selectItem` 이 있고 패널 선택지에 보임                    | builder 패널 테스트             | RED (노출 → 실행 시 report)   |
| ③   | `callEndpoint` 규칙이 `CatalogPreviewInteractions` 의 index 에 0 건                                                             | builder `adr281Phase0.test.tsx` | RED                           |
| ④   | page 루트 `isDisabled: true` 선언 · 자손 Button `onPress → toast` → 누르면 toast                                                | builder `adr281Phase0.test.tsx` | RED (page 루트는 accepts 0)   |

### 1f. 설치본 probe 6 (제품 코드 변경 0 — `adr281RacProbe.test.tsx`)

| P   | 질문                                                                                       | 기록할 것                                               |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| P1  | 루트 `Provider [ButtonContext, {isDisabled}]` 안 Select 의 trigger Button 은 disabled 인가 | RAC 안쪽 context 공급이 이기는지 (예상: Select 가 이김) |
| P2  | 루트 `Provider [CheckboxContext, {isDisabled}]` 안 CheckboxGroup 의 Checkbox               | 그룹 context 우선 여부                                  |
| P3  | 루트 Provider 안 Dialog slot Button (`slot="close"`)                                       | slot context 와 합쳐지는지                              |
| P4  | 루트 `isDisabled: true` · 자식 자기 `isDisabled: false`                                    | `useContextProps` — 자식이 이김 (문서화)                |
| P5  | 중첩 `I18nProvider` (page 루트 ko · field en)                                              | 가까운 것이 이김                                        |
| P6  | S2 `Provider colorScheme` 없이 RAC 만 — `data-*` 색 모드 속성은 누가 주는가                | composition 은 theme 의 colorMode → `applyTheme` 만     |

G0 통과 조건 — RED 4 재현 (안 나면 표에서 내림) · probe 6 기록 · §1a ~ §1d 표 freeze.

## 2. Phase 1 — 패널 어휘 (G1)

- shared `concepts/types.ts`: `InteractionConcept` 에 선택 필드 `args?: Readonly<Record<string, readonly string[]>>` · `group?: string` (기본 = 개념 id). `bindings.ts` 의 `EVENT_ARG_NAMES` 삭제 → 등록표 (`ComponentCapability.eventArgs`) 에서 읽음 — `deriveRegistry` 출력에 `eventArgs` · `groups` 추가 (선택 필드 — 280 스냅샷 테스트는 기존 키만 본다).
- shared `interactions/exposure.ts` (새 파일 1): `exposedTriggers(type, declaredProps)` · `exposedCapabilities(type, declaredProps)` — `guards` 와 선언값으로 지금 RAC 가 받는 것만 · 숨은 이벤트 `hiddenTriggers(type)` (keyboard 제외) · 규칙이 쓰는 이름은 항상 포함.
- builder `panels/interactions/`:
  - `TriggerPicker.tsx` — 그룹 (`PropertySelect` 의 section) · 토글 「RAC 전체 보기」 (행 로컬 state).
  - `ValueSourceField.tsx` (새 파일) — 「리터럴 / 이벤트 인자」 소스 + 인자 `PropertySelect` (When 의 `eventArgs`) · 저장은 `"!event.<arg>"` 문자열.
  - `labels.ts` — `TRIGGER_LABEL_KEYS` 삭제 · `triggerLabelKey(concept, event)`.
  - `CatalogRuleRow.tsx` — 조건 불충족 표식 (`slot="description"` 문구 — ADR-163 필드 상태 문구 규칙).
  - i18n: `interactions.trigger.<concept>.<event>` 키 전수 · `capabilityLabelKeys.static.test.ts` 가 55 type 의 event · capability 키를 번역과 대조.
- 테스트: 패널 role 쿼리 (그룹 · 토글 · 소스) · 규칙 수 불변 (숨김은 표식만) · keyboard 정적 0.

## 3. Phase 2 — 조상 상속 (G2)

- shared `interactions/providerContexts.ts` (새 파일): `PROVIDER_CONTEXTS = [[ButtonContext, ["isDisabled"]], …] satisfies …` + `RAC_PROVIDER_CHECK` (각 context 의 props 타입에 그 prop 이 있어야 컴파일).
- binding `accepts`: `Body.binding.ts` · frame (`domBinding.runtime.ts:652` → 전용 binding 또는 `accepts` 확장) 에 `isDisabled` · `isReadOnly` · `isRequired` · `locale` · `colorScheme` (사용자 결정 1 로 frame 포함 여부). `d2Provenance.ts` — `isDisabled` · `isReadOnly` · `isRequired`: `v3` · `colorScheme`: S2 `Provider` 라 게이트 통과 (S2 타입 대조는 `Provider` props) — 정확한 적용 형식은 게이트 코드 확인 뒤.
- spec: `componentInteractionSpecs.ts` 에 `body` · `frame` 의 개념 (toggle 류 — `inheritedDisabled` 등 **새 개념이 아니라** 기존 `toggle` 개념을 prop 이름만 바꾼 variant: `isDisabled` · `isReadOnly` · `isRequired`, `valueText` 의 `locale`, `colorScheme` 은 `singleSelectionValue` 류 2 값). 280 G1 「유도 ⊇ 손 등록표」 는 추가만이라 GREEN.
- DOM: `delegatedDom.runtime.ts` body · frame render 가 상속 prop 이 하나라도 있으면 `Provider` (RAC) + `I18nProvider` (locale) 로 감싼다 — `ForwardingI18nProvider` (280) 와 같은 핸들러 전달 형태.
- Canvas: resolver `derivedProps.isDisabled` 를 조상 상속값으로 확장 (`presence.ts` — 가까운 조상 선언값 · 자기 값 우선).
- dispatcher: `getConstraintContext(id).inherited` 에 조상 상속값 합침 (`catalogPreviewInteractions.ts`) — 그룹 context 와 같은 자리.
- colorScheme: override 변경 → 세션 `applyTheme({...state, colorMode})` (`catalogPreviewSession.ts`).
- 테스트: `adr281Inheritance.test.tsx` — G2 항목 · 원복 RED 2.

## 4. Phase 3 — instance 규칙 상속 (G3)

- `types.ts`: `DescendantPatchFields.interactions?` · `LIBRARY_CONTRACT_VERSION` 47 · `validation.ts` exact 키 · `library.ts` 사용자 결정 2 기본안.
- shared `interactions/effectiveInteractions.ts` (새 파일): `effectiveInteractionsOf(graph, ownerId, address)` — 원본 규칙 (address 없음) 에 그 address 의 `interactions` 를 적용 (off 제외 · 대체). `recordsOfOwner` 와 `catalogInteractionsOf` 가 같이 읽음 (grep 게이트 — 두 곳 외 호출 0).
- Builder `catalogRuntime/interactions.ts`: `catalogInheritedInteractionsOf(instance)` · 명령 `catalogInteractionOverrideCommand` (끄기 · 바꾸기 · 되돌리기).
- 패널: `CatalogInheritedRuleRow.tsx` (새 파일) — 요약 · 끄기 토글 · 「이 instance 에서 바꾸기」 (address 있는 자기 규칙 생성 + 매핑).
- ADR-262: `pushInstanceOverrides` (바꾼 규칙 → 원본 규칙 action 교체 · 매핑 제거) · `resetInstance` (필드 제거) · 전수 표 +1 행 (`262 breakdown §1`).
- 순서 주의 (R6): contract bump 커밋 전에 280 · 279 · 278 G5 상태를 사용자에게 알린다.

## 5. Phase 4 — Form 제출 목적지 (G4)

- `concepts/form.ts`: `args: { onSubmit: ["formData"] }` · `bindings.ts`: `onSubmit` 인자 정규화 (`FormEvent.currentTarget` → `Object.fromEntries(new FormData(form))`, 같은 `name` 여러 값은 배열).
- **저장 (h1)**: `types.ts:879` `{ opcode: "callEndpoint"; endpointId: DataEndpointId; body?: Scalar }` · `validation.ts:1437-1439` `exact(action, ["opcode", "endpointId", "body"])` + `if (action.body !== undefined) scalar(action.body, "entry.action.body")` (capability `value` 의 `:1451-1457` 과 같은 분기 — `scalar` 는 `undefined` 를 거부한다, round 2) · `library.ts:236` 허용 목록 그대로 (opcode 무변경) · `interactionRule.types.ts` Preview 규칙 `{ kind: "callEndpoint"; endpointId; body?: unknown }` · `catalogPreviewInteractions.ts` `ruleOf` 가 `body` 를 실음 (「no Preview path yet」 삭제) · contract 47 은 Phase 3 커밋이 올렸으므로 여기서는 검증 키만.
- **실행 (h2)**: `executeCollectionEndpoint.ts` — fetch 조립 (URL · headers · method · timeout signal) 을 `buildEndpointRequest(endpoint, signal)` 로 나누고, 새 `submitCollectionEndpoint(endpoint, body, signal)` 이 그것을 써서 **fetch 1 · pending 공유 0** (`createCollectionEndpointExecutor` 의 `pending` map 은 조회 전용 그대로). body 는 `JSON.stringify` · headers 에 `content-type` 이 없으면 `application/json` 추가 · `GET` · `HEAD` 는 throw (dispatcher 가 report). `ApiEndpointService.submitApiEndpoint?: (endpointId, body, signal?) => Promise<unknown>` (`collection.types.ts:195-202`) · `catalogPreviewDataServices` (`catalogPreviewSession.ts:47-56`) 가 공급 · `collectionSnapshot.ts:117` (publish) 도 같은 함수. dispatcher: `DispatchDeps.callEndpoint(endpointId, body)` · 값 해소는 280 Decision 8 ① 그대로 (`!event.formData` · 리터럴).
- **응답 (h3)**: `submitCollectionEndpoint` 의 성공 = `response.ok`. 본문은 `204` · `Content-Length: 0` · 빈 텍스트 · JSON 아닌 `Content-Type` 이면 `undefined`, JSON 이면 파싱값 (파싱 실패도 성공 — 서버 처리는 끝났다, `report` 로 남김). `!ok` · 네트워크 · timeout → reject → `report` + toast (사용자 결정 3 기본안). `responseMapping` 은 조회 전용 — 제출은 적용하지 않는다.
- 패널: `CatalogRuleRow.tsx` Do 「endpoint 호출」 선택지 (`CHOICES` 에 `callEndpoint` — endpoint 가 1 개 이상일 때) · endpoint `PropertySelect` · body 값 칸 (Phase 1 의 소스 칸 — `!event.formData` 또는 리터럴) · `catalogDefaultAction("callEndpoint")`.
- 테스트: `adr281Form.test.tsx` — fetch 스텁 (URL · method · headers · body 기록) · 저장 (body 있는 · 없는 규칙 통과 · body 없는 문서 재열기 · 다른 키 거부) · 두 경로 · **동시 제출 2 Form → fetch 2** (조회 `executeApiEndpoint` 2 회 → fetch 1 대조군) · **응답 4** (`204` · 빈 본문 · `text/plain` · `500`) · 빈 필수 field · `GET` report · action 대조군 (280 Form 5 유지) · 원복 RED 4 (`scalar` 무조건 포함).

## 6. Phase 5 — live · 번들 · 문서 (G5)

- Chrome MCP: 별도 dev 서버 (사용자 5173 무관) · Preview + Publish 각 1 회 · endpoint 는 로컬 스텁 서버.
- 번들 게이트 `adr201-bundle-gate.mjs`.
- 문서: `.claude/rules/state-management.md` §6 (+ 상속 · instance 규칙 · callEndpoint 줄) · ADR-262 전수 표 참조 · ADR-158 Status (패널 재구성) · `docs/adr/README.md` · CHANGELOG · `pnpm docs:stale-symbols`.

## 7. 파일 변경 추정

| 영역                | 파일                                                                                                                                                                                                                                                                                                                                                                                      | 추정 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--: |
| shared interactions | `concepts/types.ts` · 개념 파일 (args) 12 · `bindings.ts` · `deriveRegistry.ts` · `capabilityRegistry.ts` · `exposure.ts` · `providerContexts.ts` · `effectiveInteractions.ts` · `dispatcher.ts` · `interactionRule.types.ts`                                                                                                                                                             | ~21  |
| shared catalog      | `document/types.ts` · `validation.ts` · `library.ts` · `d2Provenance.ts` · `bindings/Body.binding.ts` · `componentInteractionSpecs.ts` · `runtime/delegatedDom.runtime.ts` · `domBinding.runtime.ts` · `catalogPreviewInteractions.ts` · `catalogPreviewSession.ts` · `presence.ts` · `executeCollectionEndpoint.ts` · `collectionSnapshot.ts` · `types/collection.types.ts` · 262 명령 2 | ~16  |
| builder             | `panels/interactions/` 4 + 새 2 · `catalogRuntime/interactions.ts` · i18n 2                                                                                                                                                                                                                                                                                                               |  ~9  |
| 테스트              | shared 3 · builder 5                                                                                                                                                                                                                                                                                                                                                                      |  ~8  |
| 문서                | ADR · breakdown · README · CHANGELOG · 규칙 1 · 262 breakdown · 158                                                                                                                                                                                                                                                                                                                       |  7   |

합계 ~61 (1.5 배 이상 벌어지면 Phase 0 inventory 보강으로 흡수 — adr-writing M3).

## 8. 기록

- **2026-10-22 review round 1 (codex)** — HIGH 3 (`callEndpoint` body 저장 필드 없음 · 조회 실행기 endpoint id 공유로 동시 제출 유실 · `204` 를 `response.json()` 이 reject) 을 코드로 확인 → 본문 Decision 5 를 저장 · 실행 · 응답 세 층으로, R8 (HIGH) + G4 반례 · 원복 RED 3, §5 를 그에 맞춤. LOW (등록표 출력 모양 문구) 는 §0 · 본문 제약 문구로 정리.
- **2026-10-22 review round 2 (codex 수리 검증)** — h2 · h3 해소 확인. HIGH 1: `scalar(action.body)` 무조건 호출이 body 없는 규칙을 거부 (`validation.ts:326-330`) → `body !== undefined` 분기로 §5 · 본문 Decision 5 · G4 (재열기 · 원복 RED 4) 수정. LOW (contract 47 순서 · 문구) deferred.

- **2026-10-22 Phase 0 (G0 통과)** — probe 6 · RED 4 는 본문 Status 참조. 실측 보강 2: `CATALOG_ACTION_OPCODES` (`executionVocabulary.ts`) 에 `callEndpoint` 없음 → ③ 은 저장부터 거부 (Phase 4 범위에 vocabulary 한 줄 추가) · library `triggerIds` 는 `events` 만 (Phase 1 범위에 숨은 이벤트 추가 — keyboard 제외). P3 결과로 `providerContexts.ts` · dispatcher `inherited` 는 Dialog · Select 경계를 넘지 않는다 (RAC 가 안쪽에서 context 를 공급).
- **2026-10-22 Phase 1 (G1 통과)** — 본문 Status 참조. 계획과 다른 점: ① `EVENT_ARG_NAMES` 를 개념으로 옮기며 이름은 그대로 (`keys` · `value` · `isOpen` …) — 같은 callback 을 개념마다 다른 이름으로 부를 수 있게 `eventArgNames` 는 목록의 목록. ② `CatalogRuleRow` 의 표식은 `<p>` (Events 패널은 ADR-163 보류 예외 — `afterControl` 슬롯이 없는 요약 행). ③ 숨은 이벤트를 저장하려면 library `triggerIds` 에 넣어야 했다 (Phase 0 보강).
- **2026-10-22 Phase 2 (G2 통과)** — 본문 Status 참조. 계획과 다른 점: ① `providerContexts.ts` 는 RAC context 값을 import 하므로 `interactions/` 가 아니라 `catalog/runtime/` (Preview DOM · Canvas presence · dispatcher 옆) — 행은 catalog type 으로 키를 두어 Canvas · guard 가 같은 표를 읽음. ② 상속 flag 는 OR (palette 원본의 `false` 기본값 — P4 를 그대로 따르면 상속이 어디에도 닿지 않음). ③ colorScheme 은 `editorHidden` (작성 값이 아니라 Do 전용 — Canvas 대칭). ④ Dialog · Select 경계 (P1 · P3) 는 RAC 가 DOM 에서 처리하고, guard 는 대상 type 이 받는 flag 만 (`CATALOG_INHERITED_RECEIVERS`) 본다.
- **2026-10-22 Phase 3 (G3 통과)** — 본문 Status 참조. 계획과 다른 점: ① `effectiveInteractions.ts` 는 `interactions/` 가 아니라 `catalog/resolution/` (문서 타입 · address 를 읽음). ② 참조 무결성 검사는 두지 않음 — 원본 규칙 삭제 · 대체 규칙 삭제로 남은 키는 읽을 때 무시 (원본 실행 = 자연스러운 되돌림). ③ `resetOverrideField` (Component 절의 한 줄 Reset) 에는 넣지 않음 — 패널의 스위치 · 대체 규칙 삭제가 같은 일을 함.
- **2026-10-22 Phase 4 (G4 통과)** — 본문 Status 참조. 계획과 다른 점: ① dispatcher 의 `callEndpoint` dep 은 시작 여부만 동기로 돌려주고 응답 실패의 report + toast 는 Preview runtime 이 비동기로 (dispatcher 는 순수 동기 함수) — `GET` endpoint 도 같은 비동기 report 경로 (fetch 0). ② Preview 규칙의 `endpointId` 는 `data:endpoint:` 접두를 뗀 project endpoint id (data service 의 키).
- **2026-10-22 Phase 5 (G5 통과 — Publish 갈래는 기존 결함)** — 본문 Status 참조. 계획과 다른 점: ① Publish 탭은 `s2PropAlignment` 의 동결 문서 변경 (`INVALID_CATALOG_SNAPSHOT`, Form 포함 프로젝트 전부 · ADR-281 이전) 으로 열리지 않아 Preview (Compare Mode) 만 실물 확인 → 같은 날 사용자 「같이 고쳐」 로 수리: `migrateWrites` 가 같은 값으로 바뀌는 쓰기 (TextField `type: "email"`) 를 건드리지 않는다. RED 2 (`s2TextFieldType` · publish `bodyDomPresentation` — 원복 시 실사용과 같은 `INVALID_CATALOG_SNAPSHOT`) · live: 「ADR281 live」 Preview 버튼 → publish 탭이 Form 을 그리고 (email 입력 `type=email`) Save 제출이 스텁에 `POST` JSON 으로 도착. ② palette Form 의 필드 `name` 이 비어 있고 Save 가 `type="button"` — `!event.formData` 를 쓰려면 작성자가 필드 name 과 Save 의 submit 규칙을 둔다 (후속 후보: palette Form 기본 name · Save `type="submit"`). ③ 번들 Builder 여유 199 B.
- **2026-10-22 G6 준비 (사용자 확인 대기)** — 확인용 프로젝트 파일 `docs/how-to/samples/adr281-g6-check.composition.json` (네 축을 심은 것 · 헤더 가져오기로 연다 · Form 은 `apps/builder/scripts/adr281-endpoint-stub.mjs` 가 받는다). 만드는 중 결함 3 을 찾아 수리: ① page 루트 · frame 의 「전체 전환」 토글이 값 없는 prop 에 `"none"` 을 씀 (`dispatcher.ts` — `style.` 이 아닌 prop 은 boolean 상태) ② Publish 세션에 `applyTheme` 이 없어 colorScheme 규칙 무반응 (`apps/publish/src/catalogSession.ts`) ③ 프로젝트 파일 가져오기에서 `callEndpoint` · 같은 이름 변수의 `setState` 참조가 끊김 (`importDataParts` 가 참조 표 · `remapCatalogDataRefs`). ①② 는 Publish 탭 live 로 다시 확인, ③ 은 실제 샘플 파일 가져오기 테스트 (`samplesImport.test.ts`, 원복 RED).
