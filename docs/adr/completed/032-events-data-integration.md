# ADR-032 v2: Events Platform 재설계 - Capability, Effect, Recipe 기반 데이터 통합

## Status

Deprecated — 2026-05-13 (Replaced by [ADR-133](133-events-panel-simplification.md) + ADR-131 partial supersede)

### land 영역 (ADR-131 / ADR-132 / ADR-133 흡수)

- **events / actions root collection schema** — [ADR-131](../131-events-data-actions-first-class-collections.md) Phase 1-4 가 `CompositionDocument.events` / `actions` root field + `SerializedEvent` / `SerializedAction` 타입 land. v2 §1 (TriggerRegistry) + §2 (EffectRegistry 의 일부) 영역 partial supersede 완결
- **dataBinding ↔ collections rename** — [ADR-132](../132-usecollectiondata-useasynclist-alignment.md) 가 `data_tables` → `collections` rename + `useCollectionData` `useAsyncList` 정통 정합 land
- **canonical schema UI 표면 정합** — [ADR-133](133-events-panel-simplification.md) D2/D3/D4 가 EventsPanel canonical primary 전환 + ActionsPanel 흡수

### 미land 영역 (ADR-134 응용 이관)

- **TriggerRegistry** (payload schema 정의) — 현 `EVENT_REGISTRY` 가 1차 대용, payload schema 부재
- **EffectRegistry** (validate + run 단일화) — 현 `actionMetadata.ts` + `eventEngine.ts` 2분리 유지
- **CapabilityRegistry** (`pressable` / `selectable` / `editable` / `submittable` / `openable` / `collection` / `filterable` / `data-bound` 자동 추론) — 현 `COMPONENT_RECOMMENDED_EVENTS` 컴포넌트별 하드코딩 유지
- **RecipeRegistry** (추천 ↔ Quick Connect ↔ 템플릿 통합) — 현 18 templates 데이터 / 추천 chips 가 1차 대용
- **BindingRef AST** (stable id 기반 참조 system) — 현 `Element.dataBinding` + `collections` rename 으로 partial 정합, AST 자체 미land
- **Condition DSL 완전 AST** — ADR-133 D6 가 1단계 placeholder (`{kind:"comparison" \| "raw", left?, op?, right?, expression?}`) 만 lock-in, 완전 DSL 미land
- **EventHandler.source provenance** (`manual` / `recipe` + `recipeId` + `version` + `generatedAt`)

## Date

2026-03-12

## Decision Makers

composition Team

## Related ADRs

- [ADR-010](010-events-panel.md): Events Panel Smart Recommendations
- [ADR-013](013-quick-connect-data-binding.md): Quick Connect Data Binding

---

## Executive Summary

이벤트 패널을 단순 UI 리팩터링이 아니라 **이벤트 플랫폼 재설계**로 다룬다.

기존 v1 초안은 `ACTION_SPEC`과 `COMPONENT_EVENT_SPEC` 중심으로
중복 제거와 추천 자동화를 해결하려 했다. 방향은 맞지만,
이 구조만으로는 다음 문제가 남는다.

1. 폼 메타데이터와 실제 런타임 실행이 분리된다.
2. 컴포넌트별 스펙이 계속 증가해 유지보수 비용이 높아진다.
3. Quick Connect가 "데이터 연결"과 "이벤트 생성"을 느슨하게 결합한다.
4. 조건식과 데이터 참조가 문자열 기반이라 검증, 마이그레이션, 리네임에 약하다.

따라서 v2에서는 이벤트 시스템을 아래 4개 레지스트리로 재구성한다.

1. `TriggerRegistry`: 어떤 이벤트가 실제로 지원되는지 정의
2. `EffectRegistry`: 액션의 폼, 검증, 기본값, 런타임 실행을 단일 정의
3. `CapabilityRegistry`: 각 컴포넌트가 가지는 인터랙션 능력을 선언
4. `RecipeRegistry`: 추천 이벤트, Quick Connect, 템플릿 생성을 선언적으로 정의

핵심 변화는 이것이다.

| 현재                                  | v2                                           |
| ------------------------------------- | -------------------------------------------- |
| 컴포넌트별 추천 이벤트 수동 매핑      | capability 기반 추천 파생                    |
| 액션 메타데이터와 실행 코드 분리      | `EffectSpec`에서 UI + 검증 + 실행 통합       |
| Quick Connect 후 핸들러 즉시 생성     | recipe 적용으로 생성 이유와 재생성 경로 보존 |
| `tableName`, `fieldName` 문자열 참조  | stable id 기반 `BindingRef` 참조             |
| JS 문자열 조건식                      | 제한된 DSL 또는 AST 기반 조건                |
| 단일 거대 `EventsPanel`에서 혼합 편집 | 목적별 섹션과 단계형 UX로 재구성             |

---

## Context

### 현재 시스템의 구조적 문제

현행 이벤트 시스템은 다음과 같은 분산 구조를 가진다.

- 이벤트 타입 레지스트리: [events.registry.ts](/Users/admin/work/composition/apps/builder/src/types/events/events.registry.ts)
- 패널 타입 정의: [eventTypes.ts](/Users/admin/work/composition/apps/builder/src/builder/panels/events/types/eventTypes.ts)
- 액션 메타데이터: [actionMetadata.ts](/Users/admin/work/composition/apps/builder/src/builder/panels/events/data/actionMetadata.ts)
- 이벤트 추천 데이터: `eventCategories.ts`
- 패널 측 실행 보조기: [eventExecutor.ts](/Users/admin/work/composition/apps/builder/src/builder/panels/events/execution/eventExecutor.ts)
- 실제 런타임 실행기: [eventEngine.ts](/Users/admin/work/composition/apps/builder/src/utils/events/eventEngine.ts)

이 상태에서 확인된 핵심 문제는 다음과 같다.

### 문제 1: UI 정의와 런타임 정의가 분리되어 있다

`actionMetadata.ts`는 폼 렌더링을 위해 액션 필드를 정의하지만,
실제 실행은 `eventEngine.ts`에서 별도 핸들러 맵으로 처리한다.

결과:

- 새 액션 추가 시 여러 파일을 동시에 수정해야 한다.
- UI에 노출되지만 런타임에서 의미가 다른 액션이 생길 수 있다.
- 기본값, 검증 규칙, 실행 semantics가 한곳에 모이지 않는다.

### 문제 2: 컴포넌트별 추천 구조는 규모가 커질수록 비싸다

`Button`, `ListBox`, `Select`, `ComboBox`, `Table`, `Tabs` 등
컴포넌트별로 추천 이벤트를 직접 들고 가면,
실제로는 같은 계열의 상호작용을 반복 정의하게 된다.

예:

- `Button`, `Link`, `Card`는 모두 `pressable`
- `Select`, `ComboBox`, `ListBox`, `Table`, `Tree`는 모두 `selectable`
- `Dialog`, `Popover`, `Select`, `ComboBox`는 모두 `openable`

즉 추천 로직의 실제 기준은 "컴포넌트 타입"보다 "상호작용 capability"에 가깝다.

### 문제 3: 데이터 연결이 이벤트 시스템의 1급 개념이 아니다

ADR-013은 Quick Connect를 통해 data binding을 제안하지만,
이벤트 시스템은 여전히 부가 기능처럼 데이터 관련 액션을 붙이는 구조다.

이 상태에서는 다음이 어렵다.

- 데이터 연결 후 자동 이벤트 생성의 출처 추적
- 스키마 변경 시 영향 분석
- recipe 재적용
- 수동 수정과 자동 생성의 구분

### 문제 4: 문자열 기반 조건식과 참조는 취약하다

현재 [conditionEvaluator.ts](/Users/admin/work/composition/apps/builder/src/builder/panels/events/execution/conditionEvaluator.ts)는
JavaScript 문자열을 평가하는 구조다.

이 접근의 문제:

- 안전성 검증이 취약하다.
- AST 수준의 정적 분석이 불가능하다.
- 참조 rename, schema migration, autocomplete가 어렵다.
- 런타임 오류를 에디터 단계에서 막기 어렵다.

추가로 현재 구현에는 비동기 결과를 동기 boolean으로 다루는 버그 위험도 있다.

### 문제 5: alias와 이중 타입이 아키텍처 복잡도를 키운다

[events.registry.ts](/Users/admin/work/composition/apps/builder/src/types/events/events.registry.ts)는
camelCase와 snake_case alias를 함께 허용한다.
패널 타입 정의도 별도로 존재한다.

결과:

- 타입 어서션 증가
- 마이그레이션 비용 증가
- 런타임/에디터 불일치 가능성 증가

### 문제 6: 현재 Events Panel UX가 너무 어렵고 복잡하다

현재 [EventsPanel.tsx](/Users/admin/work/composition/apps/builder/src/builder/panels/events/EventsPanel.tsx)는
추천, 핸들러 목록, 블록 편집, 액션 추가, 디버깅, Quick Connect 성격의 안내가
한 화면 안에서 뒤섞여 있다.

사용자 관점의 문제:

- "무엇부터 해야 하는지"가 보이지 않는다.
- 이벤트를 추가한 뒤 다음 액션을 어떻게 이어야 하는지 흐름이 약하다.
- 추천과 수동 편집이 같은 위계에 있어 초보자에게 부담이 크다.
- 데이터가 연결된 상태와 아닌 상태의 차이가 직관적으로 드러나지 않는다.
- 깨진 바인딩, 자동 생성 핸들러, 수동 핸들러를 구별하기 어렵다.

즉 현재 패널은 기능은 많지만,
"설정 UI"가 아니라 "내부 구조를 직접 노출한 편집기"에 가깝다.

---

## Decision

이벤트 시스템을 다음 4층 구조로 재설계한다.

### 1. TriggerRegistry

실제로 지원되는 이벤트와 payload schema를 정의한다.

```ts
interface TriggerSpec<TPayload = unknown> {
  event: EventType;
  label: string;
  category: "mouse" | "form" | "keyboard" | "interaction";
  payloadSchema: TPayload;
  capabilities: Capability[];
}
```

역할:

- 지원 이벤트의 단일 소스
- 이벤트 picker의 데이터 소스
- 런타임 payload shape의 기준

### 2. EffectRegistry

기존 `ACTION_SPEC`를 확장해,
액션의 폼 정의와 실행 semantics를 하나로 합친다.

```ts
interface EffectSpec<TConfig = unknown> {
  type: ActionType;
  label: string;
  category: EffectCategory;
  icon: string;
  fields: EffectFieldSpec[];
  defaults: TConfig;
  validate: (config: TConfig) => ValidationResult[];
  run: (config: TConfig, ctx: RuntimeContext) => Promise<EffectResult>;
}
```

역할:

- DynamicActionEditor 생성
- action picker 카테고리 생성
- 기본값 주입
- config 검증
- 실제 실행

이 결정으로 `actionMetadata.ts`와 `eventEngine.ts`의 분리를 제거한다.

### 3. CapabilityRegistry

각 컴포넌트가 직접 어떤 이벤트를 추천받는지가 아니라,
어떤 capability를 가지는지 선언한다.

```ts
type Capability =
  | "pressable"
  | "editable"
  | "submittable"
  | "selectable"
  | "openable"
  | "collection"
  | "filterable"
  | "data-bound";

interface ComponentCapabilitySpec {
  componentType: string;
  capabilities: Capability[];
}
```

예:

- `Button` -> `["pressable"]`
- `TextField` -> `["editable"]`
- `Form` -> `["submittable"]`
- `ListBox` -> `["selectable", "collection"]`
- `ComboBox` -> `["editable", "selectable", "openable", "filterable", "collection"]`

이 결정으로 추천 이벤트의 대부분은 capability 규칙에서 자동 파생된다.

### 4. RecipeRegistry

추천 이벤트, Quick Connect, 템플릿 생성을 모두 recipe로 통합한다.

```ts
interface RecipeSpec {
  id: string;
  label: string;
  when: {
    capabilities?: Capability[];
    hasDataBinding?: boolean;
    componentTypes?: string[];
  };
  priority: number;
  build: (ctx: RecipeContext) => EventHandlerDraft[];
}
```

recipe는 다음 역할을 담당한다.

- 추천 chip 생성
- Quick Connect 직후 자동 핸들러 생성
- 템플릿 추천
- "왜 이 이벤트가 생겼는가"에 대한 provenance 보존

---

## Proposed Model

### Event Handler 저장 구조

기존 JSON 구조와의 호환은 유지하되,
자동 생성 provenance를 담는 메타데이터를 추가한다.

```ts
interface EventHandler {
  id: string;
  event: EventType;
  actions: EventAction[];
  elseActions?: EventAction[];
  enabled?: boolean;
  condition?: ConditionNode;
  source?: {
    kind: "manual" | "recipe";
    recipeId?: string;
    version?: number;
    generatedAt?: string;
  };
}
```

핵심:

- 수동 생성과 자동 생성을 구분한다.
- recipe 기반 핸들러를 추적할 수 있다.
- 미래에 "recipe 재적용"이나 "업데이트 권고"를 지원할 수 있다.

### Action Config 참조 모델

문자열 기반 `tableName`, `fieldName`, `storePath`를 줄이고
stable ref 기반 `BindingRef`를 사용한다.

```ts
type BindingRef =
  | { kind: "static"; value: unknown }
  | { kind: "state"; path: string }
  | { kind: "variable"; variableId: string }
  | { kind: "element"; elementId: string; field?: string }
  | { kind: "data"; sourceId: string; field: string };
```

효과:

- 리네임 내성 강화
- schema 변경 감지 가능
- autocomplete/validation 가능

### Condition Model

조건은 JS 문자열이 아니라 제한된 DSL 또는 AST로 전환한다.

```ts
type ConditionNode =
  | {
      type: "comparison";
      left: BindingRef;
      op: "==" | "!=" | ">" | "<";
      right: BindingRef;
    }
  | { type: "and"; children: ConditionNode[] }
  | { type: "or"; children: ConditionNode[] }
  | { type: "not"; child: ConditionNode };
```

이 결정은 다음을 보장한다.

- 문자열 eval 제거
- 정적 검증 가능
- 시각적 편집기와 1:1 매핑
- schema rename 대응 가능

---

## Architecture

### Registry Layer

이 레이어는 선언적 SSOT를 담당한다.

- `triggerRegistry.ts`
- `effectRegistry.ts`
- `componentCapabilityRegistry.ts`
- `recipeRegistry.ts`

### Editor Layer

이 레이어는 레지스트리에서 UI를 파생한다.

- `DynamicActionEditor`
- `EventTypePicker`
- `ActionTypePicker`
- `RecommendedEventsSection`
- `QuickConnectPreview`

원칙:

- UI는 최대한 registry를 렌더링만 한다.
- 카테고리, 기본값, 설명, 추천은 하드코딩하지 않는다.

### Events Panel Renovation

`EventsPanel`은 단순히 기존 컴포넌트를 쪼개는 수준이 아니라,
사용자 목표 중심의 단계형 패널로 전면 재구성한다.

핵심 원칙:

- 처음 진입한 사용자는 "추천 recipe 적용"부터 시작할 수 있어야 한다.
- 숙련 사용자는 바로 handler/effect 편집으로 내려갈 수 있어야 한다.
- 데이터 연결 상태, 자동 생성 상태, 진단 상태가 항상 눈에 보여야 한다.
- 패널은 하나의 거대한 편집기가 아니라 여러 목적별 섹션의 조합이어야 한다.

목표 구조:

1. `PanelHeader`
2. `ConnectionStatusSection`
3. `RecommendedRecipesSection`
4. `HandlersListSection`
5. `HandlerEditorSection`
6. `DiagnosticsSection`
7. `PreviewSection`

각 섹션의 역할:

- `ConnectionStatusSection`: 현재 데이터 연결, 변수 연결, recipe 적용 상태 요약
- `RecommendedRecipesSection`: 추천 이벤트가 아니라 추천 recipe를 먼저 제안
- `HandlersListSection`: 생성된 핸들러를 manual/recipe/broken 상태와 함께 목록화
- `HandlerEditorSection`: WHEN/IF/THEN/ELSE 블록 편집 전담
- `DiagnosticsSection`: broken binding, invalid condition, drift 경고 표시
- `PreviewSection`: 생성될 동작 또는 recipe 결과 미리보기

편집 흐름:

1. 연결 상태 확인
2. 추천 recipe 적용 또는 빈 handler 생성
3. handler 선택
4. 조건/효과 편집
5. diagnostics 확인
6. 필요 시 recipe 재적용 또는 수동 override

이 구조에서 [EventsPanel.tsx](/Users/admin/work/composition/apps/builder/src/builder/panels/events/EventsPanel.tsx)는
상태 조합과 섹션 배치만 담당하는 얇은 shell이 된다.

### Runtime Layer

이 레이어는 실행만 담당한다.

- `EffectRunner`
- `ConditionRunner`
- `EventDispatcher`
- `RuntimeContext`

원칙:

- 런타임은 effect spec을 기준으로 실행한다.
- 패널 전용 실행기와 실제 실행기를 이중 유지하지 않는다.

### Integration Layer

이 레이어는 data binding과 이벤트 시스템을 연결한다.

- `QuickConnectService`
- `RecipeApplicationService`
- `BindingDiagnosticsService`

---

## Detailed Decisions

### D1. Action 중심이 아니라 Effect 중심으로 용어를 정리한다

`Action`은 UI 개념으로 남기되, 아키텍처 문서와 레지스트리에서는 `Effect`를 사용한다.

이유:

- 이벤트의 결과를 더 정확히 설명한다.
- 폼 정의와 실제 side effect를 함께 다룰 수 있다.
- 런타임 레이어 이름을 일관되게 만들 수 있다.

### D2. ComponentEventSpec는 Capability + Recipe로 분해한다

v1의 `COMPONENT_EVENT_SPEC`는 이해하기 쉽지만,
컴포넌트 개수가 늘수록 같은 내용을 반복한다.

따라서 v2에서는:

- 컴포넌트는 capability만 선언
- 추천과 자동 생성은 recipe가 담당

예:

```ts
// Button
capabilities: ["pressable"]

// Recipe
when: { capabilities: ["pressable"] }
build: () => [{ event: "onPress", actions: [...] }]
```

### D3. Quick Connect는 "이벤트 생성"이 아니라 "recipe 적용"이다

Quick Connect 후 생성된 핸들러는 단순 산출물이 아니라
특정 recipe의 결과물로 간주한다.

이유:

- 다시 생성 가능
- 업데이트 가능
- 생성 이유 설명 가능
- 충돌 처리 전략 설계 가능

예:

- "List selection sync" recipe
- "Search filter binding" recipe
- "Form submit to API" recipe

### D4. 추천 시스템은 capability와 data shape를 함께 본다

추천은 더 이상 `componentType -> events[]` 단순 맵이 아니다.

입력:

- component capabilities
- binding 존재 여부
- data source kind
- selection mode
- form context

출력:

- 추천 이벤트
- 추천 effect 조합
- 추천 recipe

### D5. Diagnostics를 1급 기능으로 둔다

데이터 통합이 강해질수록 오류는 "실행 시점"이 아니라 "설정 시점"에 보여야 한다.

따라서 다음 진단을 지원한다.

- 삭제된 DataTable 참조
- 존재하지 않는 variable 참조
- schema에 없는 field 참조
- 지원되지 않는 event/effect 조합
- recipe drift 경고

### D6. 추천 중심 패널에서 작업 흐름 중심 패널로 전환한다

현재 패널은 "무엇을 편집할 수 있는가"는 많이 보여주지만
"지금 무엇을 해야 하는가"는 잘 안내하지 못한다.

따라서 v2 패널은 다음 우선순위를 따른다.

1. 연결 상태와 추천을 먼저 보여준다.
2. 생성된 핸들러 목록을 두 번째로 보여준다.
3. 상세 블록 편집은 선택된 핸들러에만 집중해서 보여준다.
4. 오류와 수리 제안은 별도 diagnostics 영역에서 즉시 보여준다.

즉 정보 구조를 "기능별 나열"에서 "작업 흐름"으로 바꾼다.

---

## Example Flows

### Flow A: Button 이벤트 추가

1. `Button`의 capability는 `pressable`
2. 추천 시스템은 `pressable` recipe를 조회
3. `onPress -> navigate/showModal` 후보를 제안
4. 사용자가 선택하면 recipe 기반 handler 초안 생성

### Flow B: ListBox Quick Connect

1. 사용자가 ListBox에 DataTable 연결
2. `collection + selectable + data-bound` capability 만족
3. recipe registry에서 selection sync recipe와 detail open recipe를 계산
4. 핸들러 생성
5. 각 핸들러에 `source.kind = "recipe"`와 `recipeId` 기록

### Flow C: Data schema 변경

1. DataTable 필드가 변경됨
2. diagnostics가 `BindingRef.kind = "data"` 참조를 스캔
3. 영향받는 effect와 handler를 표시
4. 자동 수정 가능 후보를 제안

---

## Migration Strategy

### Phase 0: Registry 정합성 확보

목표:

- `EventType`, `ActionType`를 registry 단일 소스로 정리
- snake_case alias 제거
- 경로/타입 불일치 제거

작업:

1. `events.registry.ts`를 canonical type source로 고정
2. 패널 타입 파일은 registry re-export 중심으로 축소
3. unsupported event 노출 제거

### Phase 1: Events Panel Information Architecture 개편

목표:

- 현재의 거대한 단일 패널을 목적별 섹션 구조로 해체
- 추천, 연결 상태, 편집, 진단의 정보 위계를 재정의

작업:

1. `EventsPanel.tsx`를 shell 역할로 축소
2. `ConnectionStatusSection`, `RecommendedRecipesSection`, `HandlersListSection`, `HandlerEditorSection`, `DiagnosticsSection`, `PreviewSection` 분리
3. 수동 핸들러와 recipe 생성 핸들러 상태 배지 정의
4. 데이터 연결 유무에 따른 empty state / next step UX 정의

### Phase 2: EffectRegistry 도입

목표:

- `actionMetadata.ts`와 action editor 중복 제거
- 실행과 폼 정의 통합

작업:

1. `EffectSpec` 타입 정의
2. 기존 액션을 effect registry로 이전
3. `DynamicActionEditor` 구축
4. action picker를 effect registry 기반으로 전환

### Phase 3: Runtime 통합

목표:

- 패널 실행기와 런타임 실행기의 역할 정리

작업:

1. `eventExecutor.ts`를 orchestration 또는 diagnostics 용도로 축소
2. 실제 실행은 `EffectRunner`로 통합
3. `eventEngine.ts`의 actionHandlers를 registry 기반 실행으로 전환

### Phase 4: CapabilityRegistry + RecipeRegistry 도입

목표:

- 추천과 Quick Connect를 declarative rule로 통합

작업:

1. component capability 선언
2. 추천 recipe 정의
3. Quick Connect에 recipe 적용 연결
4. 추천 UI를 recipe 기반으로 교체

### Phase 5: BindingRef / Condition DSL 전환

목표:

- 문자열 참조와 JS 조건식 제거

작업:

1. 신규 생성 데이터는 AST/BindingRef로 저장
2. 구형 문자열 포맷은 read 시 변환
3. 저장 시 canonical 포맷 유지

### Phase 6: Diagnostics / Repair UX

목표:

- 데이터 변화에 강한 유지보수 UX 구축

작업:

1. diagnostics service 추가
2. broken binding indicator 추가
3. recipe drift 경고 추가
4. auto-fix 제안 추가

---

## Consequences

### Positive

1. 액션 UI, 검증, 실행이 하나의 정의로 모인다.
2. 컴포넌트별 추천 중복이 줄고 capability 재사용이 가능해진다.
3. Quick Connect가 일회성 생성이 아니라 재적용 가능한 recipe 시스템이 된다.
4. 데이터 리네임, 스키마 변경, 삭제에 더 강해진다.
5. 이벤트 패널이 단순 편집 UI를 넘어 이벤트 플랫폼의 관리 콘솔이 된다.
6. 현재보다 훨씬 덜 복잡한 단계형 패널 UX를 제공할 수 있다.

### Negative

1. v1보다 추상화 수준이 높아 초기 이해 비용이 증가한다.
2. Condition DSL과 BindingRef 마이그레이션 작업이 필요하다.
3. Effect registry 전환 전까지는 과도기 코드가 일시적으로 생긴다.
4. 패널 정보 구조를 다시 잡는 과정에서 UI 리그레션 점검이 필요하다.

### Tradeoff

이 결정은 "빠른 파일 수 감소"보다 "장기적 플랫폼 일관성"에 더 무게를 둔다.
초기 투자 비용은 더 크지만, 이벤트/데이터/추천/자동화가 모두 같은 모델 위에 올라간다.

---

## Gates

### G0. Canonical Types

- `EventType`, `ActionType`의 canonical source가 1곳이다.
- snake_case alias가 신규 저장 데이터에 남지 않는다.
- UI에 노출되는 이벤트/액션이 런타임 지원 집합과 일치한다.

### G1. Events Panel Renovation

- `EventsPanel`이 shell + section 구조로 분리된다.
- 첫 진입 사용자가 다음 행동을 1단계 안에서 이해할 수 있는 empty state를 가진다.
- manual / recipe / broken 상태가 목록에서 즉시 구분된다.

### G2. Effect Registry

- 1개 effect 추가 시 registry 1개 항목 추가만으로 picker와 editor에 노출된다.
- effect config 검증이 registry 기반으로 동작한다.
- 런타임 실행도 같은 registry를 참조한다.

### G3. Capability / Recipe

- 추천 이벤트가 하드코딩 컴포넌트 맵 없이 계산된다.
- Quick Connect 결과물에 `recipeId`가 기록된다.
- recipe 기반 재생성 또는 update suggestion이 가능하다.

### G4. Binding / Diagnostics

- broken data reference를 저장 직후 감지할 수 있다.
- schema rename 시 영향 범위를 계산할 수 있다.
- 조건식이 eval 없이 동작한다.

---

## Rejected Alternatives

### A. 기존 구조 위에 `COMPONENT_EVENT_SPEC`만 추가

기각 이유:

- 폼과 실행의 분리를 해결하지 못한다.
- 추천 데이터가 늘어날수록 컴포넌트별 중복이 다시 쌓인다.

### B. AI 생성 중심으로 바로 이동

기각 이유:

- deterministic registry 없이 AI를 올리면 결과 품질과 디버깅 가능성이 떨어진다.
- 먼저 canonical model이 필요하다.

### C. 현행 구조를 소규모 리팩터링만 수행

기각 이유:

- 현재 문제는 파일 수가 아니라 모델 분리 실패다.
- 작은 정리만으로는 Quick Connect와 data integration을 안정적으로 묶기 어렵다.

---

## Implementation Notes

문서와 실제 저장소 경로는 아래 기준으로 맞춘다.

- `apps/builder/src/builder/panels/events/...`
- `apps/builder/src/types/events/...`
- `apps/builder/src/utils/events/...`

향후 세부 구현 ADR 또는 task breakdown 문서에서는
반드시 실제 경로 기준으로 체크리스트를 작성한다.

---

## References

- [ADR-010](010-events-panel.md)
- [ADR-013](013-quick-connect-data-binding.md)
- [react-aria skill](/Users/admin/work/composition/.agents/skills/react-aria/SKILL.md)
- [events.registry.ts](/Users/admin/work/composition/apps/builder/src/types/events/events.registry.ts)
- [eventTypes.ts](/Users/admin/work/composition/apps/builder/src/builder/panels/events/types/eventTypes.ts)
- [actionMetadata.ts](/Users/admin/work/composition/apps/builder/src/builder/panels/events/data/actionMetadata.ts)
- [eventExecutor.ts](/Users/admin/work/composition/apps/builder/src/builder/panels/events/execution/eventExecutor.ts)
- [eventEngine.ts](/Users/admin/work/composition/apps/builder/src/utils/events/eventEngine.ts)
