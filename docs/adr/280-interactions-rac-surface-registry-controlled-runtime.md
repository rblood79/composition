# ADR-280: Interactions base — RAC 표면에서 유도하는 등록표와 Preview/Publish controlled 배관

## Status

Proposed — 2026-10-22

- 사용자 요청: `/create-adr` (2026-10-22) — 같은 날 `/deep-research` 「컴포넌트마다 API 에 맞게 고유의 인터렉션 조건에 맞게 RAC · RSC 레퍼런스 md 파일들 체크 후 재사용 가능한 RAC · RSC 근본 개념에 맞게 인터렉션을 재설계」 의 연구 기록 [INTERACTION_REDESIGN_RAC_S2_2026-10](../explanation/research/INTERACTION_REDESIGN_RAC_S2_2026-10.md) 에서 출발.
- 방향을 정한 사용자 원문 (2026-10-22):
  - 「rac, rsc 컴퍼넌트 자체가 이미 react 를 쉽게 사용하도록 만들어둔 컴퍼넌트 아닌가」
  - 「이미 제공하는 기능들을 ui/ux 형태로 쉽게 전달해주는 것」 — 빌더의 Interactions 는 RAC · S2 가 이미 제공하는 callback · controlled prop 표면을 그대로 고르게 하는 것이지 새 어휘가 아니다 (메모리 `project-interactions-expose-rac-surface-not-new-vocabulary`).
- 사용자가 이미 답한 확인 항목 (AskUserQuestion 2026-10-22, 연구 §6 — 결정 지점 ③ · ④ · ①):
  - **Q1 = 예**: Preview/Publish runtime 이 RAC 의 controlled prop (`isOpen` · `selectedKeys` · `value` …) 을 외부에서 공급하는 것은 D1 「관찰 · 소비만」 **안**이다 (Disclosure · Table 정렬의 ADR-250 선례). deferred 13 전부 해제 대상, remount 는 제거 방향.
  - **Q2 = 허용**: 「한 규칙 = 한 줄 · 조건부 없음」 을 유지한 채 RAC callback 의 인자를 규칙 변수 `!event.<arg>` 로 Do 에 넘긴다. 이 ADR 은 dispatcher 의 소스 1 개 (실행 층) 만 더하고 패널 노출은 ADR B.
  - **Q3 = 지금은 제외**: keyboard (`onKeyDown` · `onKeyUp`) 는 등록표에 두되 When 선택지 노출 0.
  - **Q4 = ADR 2 개**: **이 ADR 이 base (A)** — RAC 표면 등록표 유도 + Preview/Publish 배관 + 독립 oracle 게이트. **ADR B (응용, 이 ADR 의존)** — 패널 어휘 · `!event` 패널 노출 · 조상 → 자손 상속 (RAC Provider) · 원본 → instance 규칙 상속 · Form 제출 목적지 · Publish 확인. B 는 A 의 등록표 모양이 확정된 뒤 별도 `/create-adr`.
- 같은 날 병렬 세션의 웹 deep-research [RAC_S2_CONCEPT_MODULE_DEEP_RESEARCH_2026-10](../explanation/research/RAC_S2_CONCEPT_MODULE_DEEP_RESEARCH_2026-10.md) (27 출처 · 25 claim 3-표결) 이 이 ADR 의 두 곳을 바로잡았다 — ① uncontrolled → controlled 전환은 첫 render 부터 controlled 로 고정해야 한다 (react-stately `useControlledState` 는 `value !== undefined` 만으로 판정, 전환 경고는 dev 전용 — mittwald/flow #3027 · PR #3078) · `selectedKeys` 가 있으면 `defaultSelectedKeys` 는 초기값으로도 쓰이지 않는다 (`useMultipleSelectionState.mjs:40`) → Decision 4 · R2. ② Do 축 `open` 의 수신자는 RAC 수준에서 overlay 본체 (`<Modal isOpen>` 단독 렌더가 공식 controlled 패턴 — RSP DialogContainer 선례) 이고 trigger 는 When 축 (`onOpenChange`) 의 소유자다 → Decision 3 을 「When owner ≠ Do 수신자일 수 있다」 로 고쳤다.
- fork 4 질문 lock-in: [breakdown §0](design/280-interactions-rac-surface-registry-controlled-runtime-breakdown.md). 이 ADR 은 [ADR-158](completed/158-interactions-rules-capability-registry.md) 의 **Phase 1 (등록표) · Phase 3 (Preview 실행) 의 개정**이다 — 158 의 스키마 (`InteractionEntry` · 한 줄 규칙 · 앱 액션 2) · 패널 모듈 · G1 (근거 없는 등재 금지) 은 그대로 두고, 등록표의 **만드는 방법** 과 **실행이 RAC 에 닿는 조건** 을 바꾼다.

## Context

### 도메인

- **D2 (Props/API) 중심** — When 축 (callback 이름) 과 Do 축 (controlled prop 이름) 의 어휘. 정본 순서는 S2 1.8.1 → design-data → v3 → 확장 (`d2Provenance.ts`), S2 가 지운 RAC 이벤트는 `rac` 출처.
- **D1 (DOM/접근성)** — RAC 컴포넌트를 그대로 그리고 DOM · ARIA · 키보드 동작을 바꾸지 않는다. controlled prop 을 **외부에서 공급** 하는 것은 RAC 의 정상 사용법이고 D1 안이다 (사용자 결정 Q1). 요소 없는 trigger 노드 (MenuTrigger · DialogTrigger · TooltipTrigger · ContextualHelp) 는 RAC 컴포넌트의 prop 으로 받는다.
- **D3 무관** — 시각 값을 갖지 않는다. 상호작용 render-prop 상태는 catalog rule 의 `data-*` 선택자가 소비한다 (ADR-256 Decision 7).
- 생성기 질문 (반복 패턴 #2): 해당 없음 — spec · CSS generator 확장이 아니다.

### 현재 (실측 2026-10-22, 연구 §4 — main `c3be6f5b8`)

1. **등록표가 손으로 쓰였고 낡았다**: `packages/shared/src/interactions/capabilityRegistry.ts:138-450` 은 2026-07 (ADR-248 catalog cutover · ADR-256 구조 재편 이전) 에 쓴 28 type 등재 · 13 deferred 다. catalog 의 상호작용 가능 type 약 40 종 (CheckboxGroup · ToggleButtonGroup · TextArea · Color 조작기 · Date/Time 가족 · MenuTrigger · DialogTrigger · TooltipTrigger · Breadcrumbs · Autocomplete …) 이 없다.
2. **등재된 capability 가 닿지 않는 것이 있다**: ListBox · GridList 의 `selectItem` · `clearSelection` 은 `defaultSelectedKeys` 를 patch 하지만, binding 은 항목 집계 `catalogCollectionSelectedKeys` 만 읽는다 (`delegatedDom.runtime.ts:304-337` · `:1328-1343` · `:1366-1377`) — record override (`withOverride`, `domBinding.runtime.ts:2748-2766`) 는 소비되지 않는다. 정적 게이트 `capabilityBindingReach.test.ts:46-62` 는 delegating renderer 를 제외해 이것을 잡지 못한다.
3. **trigger owner 가 틀린 등재 4**: Menu · Modal · Popover 의 `onOpenChange` / `open` / `close` 와 Tooltip 은 ADR-256 뒤 MenuTrigger · DialogTrigger · 가족별 trigger · TooltipTrigger 소유다 (설치 RAC `Menu.d.ts` `MenuProps` 에 `onOpenChange` 없음 — `MenuTriggerProps` 에만; `presence.ts:70-89` · `MenuTrigger.binding.ts:12-13`).
4. **래퍼가 핸들러를 버린다**: `withRuntime` 은 binding 이 돌려준 top element 하나에 `cloneElement` 로 핸들러를 얹는다 (`domBinding.runtime.ts:2768-2786`). `withI18n` (`I18nProvider`, `delegatedDom.runtime.ts:806-820`) · markerWrap `div` (`:1094-1099`) · `CalendarPickerSelect` 는 `catalogForwardHandlers` 를 쓰지 않아 locale 있는 Slider · Date 가족의 When 규칙과 ADR-214 observer 가 조용히 유실된다. 전달하는 래퍼는 `CatalogStateFrame` · `RacSlotScope` · `SelfToggleButton` · `GroupToggleFrame` · `TagGroupRun` 뿐.
5. **deferred 13 의 실태**: TextField · NumberField · SearchField 는 `defaultValue` + key 에 값 포함 (b) 라 지금도 반영 가능, Switch 는 key 고정 (c), Select · ComboBox · DatePicker · Calendar · Table 선택은 상태 prop 미전달 (c), DisclosureGroup 은 자식 경유 controlled, Popover · Menu · Tooltip 은 owner 이동 대상 (연구 §4-b 표).
6. **remount 표기 8 중 4 만 참**: ListBox · GridList 는 미도달, Disclosure 는 이미 controlled (ADR-250), 나머지는 `${id}:${value}` key (연구 §4-c).
7. **실행 경로는 shared 하나**: 규칙 → `buildInteractionIndex` → `createElementHandlers` (`bindings.ts:30-91`) → `executeInteractionRule` (`dispatcher.ts`) → capability 는 `setRuntimeProps` 의 record override (`catalogPreviewInteractions.ts:363-393`, ADR-250 `declaredAt` 규칙). Publish 는 같은 `CatalogPreviewInteractions` 를 소비 (`domView.runtime.ts:69-84` → `apps/publish/src/App.tsx`). `resolveValue` 의 소스는 `!param` · `!self` · 리터럴 셋 (`dispatcher.ts:85-109`).
8. **독립 oracle 이 없다**: 「규칙이 RAC 를 실제로 움직였다」 는 지금 Chrome MCP live 로만 본다. RAC 가 제공하는 `@react-aria/test-utils` (Select · ComboBox · Table · Menu · Tree 등 tester 12, 로컬 reference `react-aria/references/testing/`) 는 설치돼 있지 않다 (npm 1.0.0-rc.1).

### 제약

- **Hard — D1**: 설치 `react-aria-components` 1.22.1 이 절대 권위. 등록표의 callback · prop 이름은 설치 d.ts 에 **컴파일 시** 존재해야 한다 (`satisfies` — ADR-201 Phase 3 `FILE_TRIGGER_EVENTS` 선례). RAC 가 안 주는 callback 합성 금지 · 닫힌 overlay 본체를 owner 로 등재 금지 (DOM 부재, `domBinding.runtime.ts:1517-1535`) · `isReadOnly` · `isDisabled` · `disallowEmptySelection` 이 막는 변경을 override 로 우회 금지.
- **Hard — D2**: patch prop · callback 이름은 binding `accepts` 와 S2 표면 (`d2S2Alignment.static.test.ts`) 에 맞춘다. 커스텀 prop (`selectedItem` · `onCommit`) 신설 0.
- **Hard — 스키마**: `InteractionEntry` (`document/types.ts:865-887`) 와 `InteractionRule` (`interactionRule.types.ts`) 무변경. 한 규칙 = 한 줄 · 조건부 · debounce · 다중 액션 · 템플릿 없음 (ADR-158 §Decision). `!event.<arg>` 는 `CapabilityAction.params.value` 의 **값 표기** 하나 (문자열 `"!event.keys"`) 로 들어가 스키마 필드가 늘지 않는다.
- **Hard — runtime only**: capability 와 컴포넌트 자체 상태는 record override 에만 쓰고 문서 · Builder · Canvas 는 보지 않는다 (ADR-250 Decision B). 문서 선언값이 바뀌면 그 키의 override 를 버린다 (R2 `declaredAt`).
- **Hard — ADR-214 R6**: 이름 붙인 RAC 상태 변수의 **관찰** 은 prop 주입 0 그대로다. controlled 공급은 capability · 컴포넌트 자체 상태의 override 경로이지 변수 경로가 아니다 — 두 경로가 같은 개념 표를 읽되 섞이지 않는다.
- **Hard — Publish 동일**: 변경은 `packages/shared/src/interactions` · `catalog/runtime` 에서 끝나고 Preview 전용 분기 0 (ADR-158 R5). Preview 초기 번들 상한 (ADR-201 §재승인 320,000 B gz) 안.
- **Hard — 성능**: 등록표 유도는 모듈 로드 1 회 (상수 동결) · 핸들러 색인은 문서당 1 회 · 규칙 없는 record 는 `NO_HANDLERS` 동결 객체 유지 · 조건 평가를 runtime 핫패스에 넣지 않는다. pre-push ratchet (ADR-246) 안.
- **Hard — 마이그레이션 코드 금지** (사용자 지시 2026-10-14): owner 가 바뀌는 규칙 (Menu · Modal · Popover 노드에 걸린 open/close) 의 저장값 전환 코드 0 — 실행 시 「capability 미등재」 로 report (조용한 no-op 아님, `catalogPreviewInteractions.ts` `report`) 하고 사용자가 다시 건다. 문서 schema · contract 무변경.
- **Soft**: ADR-158 G4 (interactions 모듈 ≤ 15 파일) 는 shared 쪽 개념 파일을 제외한 패널 모듈 기준으로 유지. 등록표 유도 코드는 `packages/shared/src/interactions/concepts/` 아래 개념당 1 파일 + spec 1 + derive 1.

## Alternatives Considered

### 대안 A: 손 등록표 유지 + 결함 수리만

- 설명: `CAPABILITY_REGISTRY` 를 지금 모양대로 두고 owner 4 건 이동 · 미등재 40 type 손 추가 · deferred 13 해제 · 래퍼 전달 · 집계보다 override 우선 규칙을 넣는다.
- 근거: 변경 표면이 작고 (등록표 1 파일 + binding 수 곳), 개념 코드가 없다.
- 위험: 기술 LOW / 성능 LOW / 유지보수 **HIGH** (66 type × 평균 3 callback · 2 prop 을 손으로 — 지금 낡은 상태가 생긴 경로 그대로. ADR-256 처럼 노드 구조가 바뀌면 또 어긋나고 그것을 잡는 게이트가 없다. racRef 가 문자열이라 d.ts 와 대조되지 않음) / 마이그레이션 LOW.
- 기각: 사용자 원칙 「RAC 표면을 그대로 전달」 을 지키는 유일한 길은 표면 **그 자체** 에서 등록표를 만드는 것이다. 손으로 옮겨 적는 한 「그대로」 를 보증할 수 없다.

### 대안 B: RAC 표면에서 유도하는 등록표 + controlled 배관 + 독립 oracle 게이트 (채택)

- 설명:
  1. **개념 표** (`concepts/*.ts`) — RAC 문서의 절 구조 (press · hover · focus · keyboard · toggle · value · valueCommit · inputValue · singleSelection · multiSelection · expansion · open · action · clear · remove · sort · resize · loadMore · dragDrop · form · dismiss · focusedDate …, 연구 §2) 를 하나씩 `{events, state: {prop, defaultProp, callback, valueType}, conditions}` 로 적고 각 선언을 설치 d.ts 타입에 `satisfies` 로 고정한다 (`PressEvents` · `MultipleSelection` · `Expandable` · `OverlayTriggerProps` · `ValueBase<T>` …).
  2. **컴포넌트 spec** (`componentInteractionSpecs.ts`) — catalog type 마다 `{concepts: [{concept, owner: self|trigger|group|item, variant?}], s2Exceptions?, imperative?}` 만 적는다. 이것이 유일한 손 입력이다.
  3. **`deriveRegistry(concepts, specs)`** 가 현 `CAPABILITY_REGISTRY` 모양 (`events` · `capabilities{prop,value,racRef,param,remount}` · `deferred`) 을 만든다 — 소비자 (`resolveCapabilities` · `resolveTriggers` · dispatcher · 패널 · `IMPLICIT_STATE_SOURCES`) 는 무변경. Phase 1 게이트가 「유도 결과 ⊇ 현 손 등록표 (키 · events · capability 이름 · prop)」 를 단언한 뒤 손 객체를 지운다. `IMPLICIT_STATE_SOURCES` (`state/implicitState.ts:20-37`) 도 같은 표에서 유도 (관찰 전용 유지).
  4. **배관** — (i) 상태 prop 을 controlled 로: `X = override[prop] ?? 문서값` · `onXChange → setRuntimeProps({[prop]: v})`, key 는 `node.id` 고정 (Disclosure 의 현 형태 `delegatedDom.runtime.ts:2521-2527`). 대상 = deferred 13 + remount 8 (연구 §4-b · §4-c). (ii) **집계보다 override 우선**: `catalogCollectionSelectedKeys` 류 항목 집계는 문서 선언 기본값으로만, record override 에 그 prop 이 있으면 override. (iii) 래퍼 3 (`withI18n` · markerWrap · `CalendarPickerSelect`) 이 `catalogForwardHandlers` 로 전달. (iv) owner 이동 — Menu/Modal/Popover/Tooltip 의 open 개념을 trigger 노드 spec 으로 (요소 없는 trigger 는 binding 이 RAC prop 으로 직접 받음 — `MenuTrigger.tsx:23-36` 이 이미 그 형태). (v) dispatcher `resolveValue` 에 `!event.<arg>` 소스 — 핸들러가 받은 callback 인자를 `DispatchContext.event` 로 넘기고 Selection(`"all"` | Set) 은 배열로 정규화 (ADR-214 `normalizeImplicitStateValue` 재사용).
  5. **게이트** — `capabilityBindingReach` 를 delegating renderer 까지 (binding 이 그 prop 을 실제로 RAC 에 넘기는지 render 결과로 검사) · `@react-aria/test-utils` devDependency 로 Preview 하니스에서 「규칙 실행 → RAC tester 가 관측한 상태 변화」 를 단언.
- 근거: RAC 자신이 react-stately 의 상태 hook (`useToggleState` · `useMultipleSelectionState` · `useOverlayTriggerState` · `useControlledState`) 단위로 조립돼 있다 — 개념 표는 그 단위를 옮겨 적은 것이라 새 추상화가 아니다 (사용자 원칙 2026-10-22). ADR-201 Phase 3 이 `satisfies` 로 callback 실존을 컴파일 시 증명한 선례. 연구 §4 가 결함 위치를 file:line 으로 확정했다.
- 위험: 기술 **MEDIUM** (d.ts 제네릭 (`ValueBase<T>`) 을 `satisfies` 로 고정하려면 variant 별 인스턴스화 필요 · 요소 없는 trigger 의 ownerId 재렌더 단위 · RAC context 가 소유하는 상태 (picker 안 ListBox · 그룹 안 toggle) 와 controlled 공급의 우선순위) / 성능 LOW (유도 1 회 · 핫패스 무변경) / 유지보수 LOW (손 입력 = spec 1 파일 · 구조 변경 시 d.ts satisfies 와 reach 게이트가 RED) / 마이그레이션 LOW (스키마 0 · 옛 owner 규칙은 report).

### 대안 C: Preview 가 모든 RAC 상태를 자기 store 로 소유 (전면 controlled store)

- 설명: Preview/Publish 에 상태 store 를 두고 모든 RAC 컴포넌트를 항상 controlled 로 그린다 (Redux 식). 규칙 · 변수 · capability 가 전부 그 store 를 쓴다.
- 위험: 기술 **HIGH** (RAC context 가 소유하는 상태 — Select 안 ListBox · ToggleButtonGroup 안 ToggleButton · Tabs 안 Tab · Form validation — 를 밖에서 소유하면 RAC 의 조립 계약과 충돌하고 D1 을 건드린다; ADR-214 R6 가 경고한 「controlled 전환 유혹」 의 극단) / 성능 MEDIUM (모든 입력이 store round-trip) / 유지보수 MEDIUM / 마이그레이션 LOW.
- 기각: 사용자 원칙과 반대 — RAC 가 이미 가진 상태를 다시 만든다. 필요한 것은 「규칙이 쓴 값이 RAC 에 닿기」 이지 상태 소유가 아니다.

### Risk Threshold Check

| 대안  | HIGH+ 항목    | 판정                                |
| ----- | ------------- | ----------------------------------- |
| A     | 유지보수 H    | 기각 — HIGH 회피 대안 B 존재        |
| **B** | 없음 (기술 M) | 통과                                |
| C     | 기술 H        | 기각 — D1 충돌 · 사용자 원칙과 반대 |

B 가 HIGH 0 — 추가 루프 불요.

## Decision

**대안 B 채택.**

> 구현 상세: [280-interactions-rac-surface-registry-controlled-runtime-breakdown.md](design/280-interactions-rac-surface-registry-controlled-runtime-breakdown.md)

1. **등록표는 RAC 표면에서 유도한다.** 손 입력은 컴포넌트 spec (`concepts · owner · variant · s2Exceptions · imperative`) 하나. 개념 선언은 설치 d.ts 에 `satisfies` — 설치본이 바뀌면 type-check 가 RED.
2. **When 선택지 = 그 개념의 RAC callback 그대로, Do = 그 개념의 controlled prop 쓰기 4 원형** (`set(param)` · `toggle` · `clear` · 집합 조작 `selectItem/deselectItem/expand/collapse`). Form `submit` · `reset` 만 imperative 특례 (현행). keyboard 개념은 유도하되 `exposed: false` (Q3). S2 가 지운 RAC 이벤트 (hover 3 · `onClick` · keyboard) 는 `rac` 출처로 유도하되 기본 숨김 표식 — 패널 정책은 ADR B.
3. **When owner 와 Do 수신자를 따로 둔다.** When owner = RAC 가 그 callback 을 선언한 노드 — open 의 `onOpenChange` 는 Menu 가족은 MenuTrigger (RAC `MenuProps` 에 없음), Dialog 가족은 DialogTrigger 또는 Modal, Tooltip 은 TooltipTrigger 또는 Tooltip (RAC 는 둘 다 `OverlayTriggerProps`). Do 수신자 = `isOpen` 을 **binding `accepts` 가 선언한 노드** (D2 정렬 결과 — 지금 DialogTrigger · MenuTrigger · TooltipTrigger · ContextualHelp · Modal 단독) 이고, RAC 수준에서는 overlay 본체가 controlled 를 받는 것이 공식 패턴이므로 (병렬 연구 §3-6) 닫힌 본체도 `isOpen` 을 받을 수 있게 **렌더는 유지하고 `isOpen` 만 공급** 한다 (`presence` 의 「닫힌 overlay DOM 부재」 는 Canvas 규칙이지 Preview 의 제약이 아니다 — Phase 0 probe 로 가족별 확정, R3). 요소 없는 노드의 자식 항목 (picker 안 ListBox · 그룹 안 toggle · Tab) 은 상태 개념의 owner 가 아니다 (press · hover · focus 만).
4. **controlled 는 첫 render 부터 · 소유 모드 고정.** deferred 13 · remount 8 을 controlled 로 바꾸되 (`remount` 표기 삭제) `X = override ?? 선언값 ?? 개념의 빈 값` 으로 **항상 정의된 값** 을 넘긴다 — `undefined` 를 넘겨 uncontrolled 로 떨어지는 render 가 한 번도 없어야 한다 (react-stately 는 `value !== undefined` 로 판정하고 전환 경고는 dev 전용 — 병렬 연구 §3-4). `default*` 와 controlled prop 을 같이 넘기지 않는다 (`selectedKeys` 가 있으면 `defaultSelectedKeys` 는 초기값으로도 안 쓰인다 — §3-5). 항목 집계 (`catalogCollectionSelectedKeys` · Radio · Tab) 는 그 **초기 controlled 값** 이 되고, override 가 있으면 override. 소유자가 바뀌는 경우 (record 자체가 바뀌는 origin → instance 파생 등) 만 `key` 로 remount. 문서 선언값 변경 시 override 폐기 (ADR-250 R2) 유지.
5. **래퍼는 핸들러를 전달한다.** `withI18n` · markerWrap · `CalendarPickerSelect` 가 `catalogForwardHandlers`. 새 래퍼를 만들면 게이트가 잡는다 (G2).
6. **`!event.<arg>` 는 실행 층만.** dispatcher 소스 1 추가 · `DispatchContext.event` · Selection 정규화. 패널에서 고르는 UI 는 ADR B.
7. **독립 oracle**: `@react-aria/test-utils` 를 builder devDependency 로 넣고 Preview 하니스 (browser vitest) 에서 규칙 → tester 관측 상태로 단언. live Chrome MCP 는 그 위의 1 회 확인.
8. **ADR B 로 이관** (이 ADR 범위 밖): 패널 어휘 · 그룹 표시 · `!event` 선택 UI · S2 예외 토글 · 조상 → 자손 상속 (RAC Provider) · 원본 → instance 규칙 상속 표시 · override · Form 제출 목적지 (`callEndpoint` 실행 경로) · theme/colorScheme 전환 · Publish 번들 확인.

**위험 수용 근거**: 기술 M 은 Phase 0 RED 가 범위를 고정하고 (G0), 제네릭 satisfies 는 variant 별 인스턴스화 (breakdown §2) 로, RAC context 우선순위는 Phase 0 설치본 probe (Modal `isOpen` prop vs `DialogTrigger` context · picker ListBox) 로 사실을 먼저 잰다 (R3).

**기각 사유**: A — 「그대로」 를 보증하는 수단이 없어 재발 경로 유지. C — RAC 상태 재소유로 D1 충돌 · 사용자 원칙 반대.

### 사용자 결정 7 건 (execute-adr 가 그 항목에 닿을 때 묻는다 — 4 결정 지점 밖)

| #   | 항목                                                                                                                                                                                                           | 권고                                                                                                                                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 집계 vs override 우선순위를 두는 함수 — `catalogCollectionSelectedKeys` 안인가 `withOverride` 뒤 공용 술어인가                                                                                                 | 공용 술어 `catalogRuntimeStateOf(record, prop)` 하나 (집계 · Radio · Tab · DisclosureGroup 이 같이 읽음)                                                                                                                                                  |
| 2   | open 의 Do 수신자 — trigger 노드 (현 accepts · D2) 인가 overlay 본체 (RAC 공식 controlled · 병렬 연구 I6) 인가, 가족별 (Dialog · Menu · Tooltip · Popover · ContextualHelp) · 요소 없는 trigger 의 재렌더 단위 | Phase 0 probe 결과를 따른다. 기본안: Menu · Tooltip 은 trigger (RAC · S2 모두 trigger 가 선언), Dialog 는 Modal 본체 + DialogTrigger 둘 다 받되 본체 우선, Popover 는 본체 (`PopoverProps.isOpen`) — 요소 없는 trigger 는 record 구독 + binding prop 전달 |
| 3   | imperative 특례 집합                                                                                                                                                                                           | Form `submit` · `reset` 만 (focus 는 ADR B 이후 필요 실증 시)                                                                                                                                                                                             |
| 4   | S2 예외 (hover 3 · `onClick` · keyboard) 의 등록표 처리                                                                                                                                                        | `rac` 출처 유도 + `exposed: false` 표식 (패널 정책은 B)                                                                                                                                                                                                   |
| 5   | runtime override 수명                                                                                                                                                                                          | ADR-250 그대로 세션 유지 · page 진입 리셋 없음 (변경은 B 에서 변수 scope 와 함께)                                                                                                                                                                         |
| 6   | `@react-aria/test-utils` 1.0.0-rc.1 설치 범위                                                                                                                                                                  | builder devDependency · browser vitest 하니스 전용 (production 번들 0)                                                                                                                                                                                    |
| 7   | Do 대상 = 같은 페이지 노드 (`catalogCapabilityTargets(pageId)`) 경계                                                                                                                                           | 유지 (page 루트 · 전역 overlay 는 B 에서 다시 판단)                                                                                                                                                                                                       |

## Risks

| ID  | 위험                                                                                                                                                         | 심각도 | 대응                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 유도 등록표가 현 손 등록표와 어긋나 기존 규칙이 실행되지 않음                                                                                                |  MED   | G1 동치 게이트 — 유도 결과 ⊇ 현 등록표 (키 · events · capability 이름 · prop). 빠지는 것은 owner 이동 4 뿐이고 그 목록을 게이트가 명시 허용                                                                                                                 |
| R2  | controlled 전환이 사용자 입력을 되돌리지 못하거나 (onXChange 미연결) render 사이에 uncontrolled ↔ controlled 가 바뀜 (production 침묵 결함 — 병렬 연구 §3-4) |  MED   | 공용 helper 하나 (`X = override ?? 선언값 ?? 빈 값` · `onXChange → setRuntimeProps` · default\* 동시 전달 금지) · G2 reach 게이트가 render 결과로 prop · callback 둘 다 확인 · dev 모드 콘솔 「changed from uncontrolled to controlled」 0 을 하니스가 단언 |
| R3  | open 의 Do 수신자 (trigger vs 본체) 와 RAC context 우선순위 미검증 (Modal `isOpen` prop vs DialogTrigger context · picker 안 ListBox · 닫힌 본체 렌더 여부)  |  MED   | Phase 0 설치본 probe 로 가족별 확정 — 수신자는 binding `accepts` 의 `isOpen` 이 있는 노드, context 가 이기는 자리는 spec 에서 그 노드로 (Decision 3). 병렬 연구 I6 (본체) 와 D2 (trigger accepts) 가 갈리는 가족은 사용자 결정 2 에서 함께 묻는다           |
| R4  | 래퍼 전달 누락 재발 (새 래퍼가 핸들러를 버림)                                                                                                                |  LOW   | G2 — 모든 binding render 결과에 대해 「When 핸들러가 RAC 요소 prop 에 도달」 검사 (delegating 포함)                                                                                                                                                         |
| R5  | `!event.<arg>` 가 조건부 실행의 뒷문이 됨                                                                                                                    |  LOW   | 값 소스일 뿐 분기 없음 — 스키마 무변경 · dispatcher 에 비교 연산 0 (grep 게이트)                                                                                                                                                                            |
| R6  | test-utils rc 버전의 API 변동                                                                                                                                |  LOW   | devDependency 고정 · 하니스 1 파일에 격리                                                                                                                                                                                                                   |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점    | 통과 조건                                                                                                                                                                                                                                                                                                 | 실패 시 대안                                                                   |
| ---- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| G0   | Phase 0 | inventory freeze (연구 §3 매트릭스 → breakdown §1 표 · catalog type 전수) · RED 3 재현 테스트 (ListBox capability 미도달 · withI18n When 유실 · Menu owner 미등재) · RAC context 우선순위 probe 결과 기록 · 측정 조건 명시                                                                                | RED 가 안 나는 항목은 결함 아님 — 표에서 내리고 사유 기록                      |
| G1   | Phase 1 | `pnpm type-check` 0 (개념 선언 `satisfies` 전부) · 유도 등록표 ⊇ 현 손 등록표 (owner 이동 4 제외 목록 명시) · `capabilityRegistry.test` G1 통과 · `d2S2Alignment` 통과 · `IMPLICIT_STATE_SOURCES` 유도 결과 = 현 표                                                                                       | 어긋나는 항목은 spec 수정 — 개념 선언을 손 등록표에 맞추지 않는다              |
| G2   | Phase 2 | deferred 0 · `remount` 표기 0 · key 에 상태값 포함 0 (grep) · reach 게이트가 delegating renderer 포함 전 등재 capability 에 GREEN (Phase 0 RED 3 → GREEN) · 래퍼 전달 게이트 GREEN · 원복 RED (전환한 binding 마다 1) · shared · builder 관련 스위트 통과 · pre-push ratchet 상한 안                      | 전환 실패 binding 은 spec 에서 `deferred` 로 남기고 사유 — 등재 금지 (G1 취지) |
| G3   | Phase 3 | test-utils 하니스: 규칙 5 종 (Button press → Select `value` · ListBox `onSelectionChange(keys)` → 다른 ListBox `selectItem(!event.keys)` · MenuTrigger `open` · DatePicker `setValue` · Table `sort`) 이 tester 관측 상태로 PASS · 같은 5 종 Preview Chrome MCP live 1 회 · Publish (`apps/publish`) 동일 | 실패 원인 수정 전 Phase 4 진입 금지                                            |
| G4   | Phase 4 | 문서 — `.claude/rules/state-management.md` §6 · 연구 보고서 §5 표현 조정 (「개념 = RAC 문서 절 구조」) · ADR-158 「Superseded-in-part by 280」 · CHANGELOG · README · `pnpm docs:stale-symbols` exit 0 · Preview 초기 번들 ≤ 320,000 B gz                                                                 | 번들 초과 시 개념 표 lazy 분리                                                 |
| G5   | 종결    | 사용자 Builder 확인 (G3 의 5 규칙을 사용자 프로젝트에서) → Implemented                                                                                                                                                                                                                                    | 지적 수리 뒤 재확인                                                            |

### Live Exercise

(Implemented 승격 시 기재 — G3 · G5 의 시나리오 · 결과 · 날짜 · Chrome MCP / 사용자 confirm 구분.)

## Consequences

### Positive

- 「RAC 표면 그대로」 가 보증된다 — 등록표의 모든 이름이 설치 d.ts 에 컴파일 시 묶이고, 노드 구조가 바뀌면 spec 의 owner 한 줄만 바뀐다.
- 미등재 40 type 이 spec 한 줄씩으로 들어오고 deferred 13 이 사라진다 — ADR-158 이 「빌더 최초의 실작동 이벤트 체인」 을 4 종 시연으로 열었다면, 이 ADR 은 그 체인을 catalog 전 컴포넌트로 넓힌다.
- 변수 관찰 (ADR-214) 과 capability 가 같은 표를 읽어 prop ↔ callback 이 어긋날 수 없다.
- 「동작했다」 의 oracle 이 RAC 자신의 tester 로 독립된다 (measurement-validity Q5).

### Negative

- Menu · Modal · Popover 노드에 걸어 둔 옛 open/close 규칙은 실행 시 report 되고 사용자가 trigger 에 다시 건다 (개발 단계 · 변환 0).
- 개념 파일 20 여 개가 shared 에 늘어난다 (소비자 코드는 무변경).
- 패널은 이 ADR 뒤에도 옛 어휘로 보인다 — 사용자 가시 변화는 「고른 것이 실제로 동작」 이고, 선택지 확장은 ADR B.
