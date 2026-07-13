# ADR-903 Breakdown: ref/descendants + slot 기본 composition 포맷 전환 계획

> 본 문서는 [ADR-903](../completed/903-ref-descendants-slot-composition-format-migration-plan.md)의 구현 상세입니다.

## 목표

기존 `Element/Page/Layout` 하이브리드 구조를 즉시 폐기하지 않고, **문서-네이티브 composition/component 포맷**과 **단일 resolved-tree resolver**를 먼저 도입한 뒤 점진적으로 저장 포맷과 편집 semantics를 전환한다.

핵심 원칙:

1. **canonical source format**: 일반 object tree + `reusable: true` + `type:"ref"` + path-based `descendants` + 컨테이너 `slot`
2. **stable identity**: runtime UUID가 아닌 문서-정본 `id` / `id path`
3. **single resolver**: `ref resolve -> descendants apply -> slot contract validate -> resolved tree`
4. **legacy adapter**: 기존 flat `elements` / `pages` / `layouts`는 전환 기간 동안 read-through adapter로 유지
5. **ADR-063 비침범**: resolved tree 아래의 렌더 체인(RAC/RSP/Spec)은 그대로 유지

## Phase 구성

| Phase | 목표                                        | 결과물                                                                     |
| ----- | ------------------------------------------- | -------------------------------------------------------------------------- |
| P0    | canonical format / resolver 계약 고정       | JSON schema 초안, TypeScript 타입, reusable/ref/descendants/slot 문법 정의 |
| P1    | legacy → canonical adapter 도입             | flat `Element/Page/Layout`를 canonical doc tree로 투영하는 adapter         |
| P2    | Preview / Skia 공통 resolved tree 입력화    | 두 renderer가 동일 resolver 결과를 소비                                    |
| P3    | frameset/layout/template를 새 포맷으로 흡수 | layout shell / template / slot assignment를 canonical format으로 통일      |
| P4    | 편집 semantics 전환                         | copy/paste, duplicate, delete, detach, undo/redo, component/slot authoring |
| P5    | persistence / import-export 전환            | DB 저장/로드, serializer, import/export, migration                         |

## Canonical 포맷 초안

### 0. Document root (pencil `.pen` 정합 메타 필드)

```json
{
  "version": "composition-1.0",
  "themes": {
    "mode": ["light", "dark"],
    "tint": ["blue", "purple", "green"]
  },
  "variables": {
    "primary": { "type": "color", "value": "#3B82F6" },
    "spacing-md": { "type": "number", "value": 16 }
  },
  "imports": {
    "basic-kit": "./kits/basic.pen",
    "icons": "@composition/icon-kit"
  },
  "children": [
    /* page, reusable frame, component master 등 canonical nodes */
  ]
}
```

- `version` : 문서 포맷 버전. breaking change 시 major 증가 (`"composition-2.0"`). read-through adapter 는 version 검사 후 migration 경로 선택
- `themes` : theme 축 선언 (ADR-021 Tint/Dark 시스템 투영). 각 엔티티는 `theme?` 필드로 축별 override 가능
- `variables` : 문서 variable 정의 (ADR-022 TokenRef + composition Spec preset 통합). 모든 `NumberOrVariable` / `StringOrVariable` / `ColorOrVariable` 필드에서 `{ $var: "primary" }` 형태 참조
- `imports` : **참조형 import hook** — 외부 `.pen` 또는 canonical 문서 파일을 URL/path 로 참조. import 된 reusable node id 는 `"<importKey>:<nodeId>"` 형식으로 `ref` 참조 가능. **P0 에는 타입 스텁만 land, 실제 resolver/fetch 는 Phase 5 이후 연기**. composition 기존 `kitLoader.ts`/`kitExporter.ts` 는 참조형이 아니라 복사-적용 (snapshot JSON + `localId → new UUID` 재발급) 이므로 `imports` 로 재매핑하지 않음 — **DesignKit 은 별도 migration track** (R7 참조)

### 1. 재사용 가능한 컴포넌트 정의

```json
{
  "id": "round-button",
  "type": "frame",
  "reusable": true,
  "name": "Round Button",
  "fill": "#333333",
  "clip": true,
  "children": [
    {
      "id": "label",
      "type": "text",
      "content": "Submit",
      "fill": "#FFFFFF"
    }
  ]
}
```

### 2. ref 인스턴스 + descendants 오버라이드

```json
{
  "id": "danger-button",
  "type": "ref",
  "ref": "round-button",
  "fill": "#D92D20",
  "descendants": {
    "label": {
      "content": "Delete",
      "fill": "#FFFFFF"
    }
  }
}
```

### 3. slot 선언이 있는 레이아웃/컨테이너

```json
{
  "id": "app-shell",
  "type": "frame",
  "reusable": true,
  "name": "App Shell Layout",
  "clip": true,
  "children": [
    {
      "id": "header",
      "type": "ref",
      "ref": "header-shell"
    },
    {
      "id": "left",
      "type": "ref",
      "ref": "left-nav"
    },
    {
      "id": "main",
      "type": "frame",
      "placeholder": true,
      "slot": ["dashboard-hero", "table-card", "icon-button"]
    }
  ]
}
```

- `clip: true` (Frame 전용) — children 이 frame 경계를 넘으면 clip. composition 의 `overflow: hidden` 과 매핑
- `placeholder: true` (Frame 전용) — 빈 frame UI hint. slot 이 채워지지 않았을 때 시각적 플레이스홀더 렌더

### 4. page/layout 인스턴스에서 slot 영역 채우기

```json
{
  "id": "dashboard-page",
  "type": "ref",
  "ref": "app-shell",
  "descendants": {
    "header/title": {
      "content": "Dashboard"
    },
    "main": {
      "children": [
        {
          "id": "hero",
          "type": "ref",
          "ref": "dashboard-hero"
        },
        {
          "id": "table",
          "type": "ref",
          "ref": "table-card"
        }
      ]
    }
  }
}
```

### canonical 규칙

- **필드명은 pencil.dev 공식 `.pen` schema 와 정확히 동일** — `type` / `reusable` / `ref` / `descendants` / `slot` / `id` / `children`. 매핑 레이어 없음.
- **legacy `Element.tag` → canonical `Element.type` 직접 rename (단일화)**. composition 의 `tag` 필드(2025-03-20 origin, RAC/RSP 비의존 자체 설계)는 의미상 pencil `type` 과 동일한 "노드 discriminator" 였으므로 이름만 교체. 값 공간(`"Button"`, `"Card"`, `"Calendar"`, ..., + `"ref"`, `"frame"`, `"text"` 등 primitive)은 그대로 보존. 규모: 1031 참조 / 154 파일 (2026-04-22 실측) rename.
- **`type` 식별자의 scope 분리**: canonical node 의 `type` 과 기존 `DataBinding.type` (`"collection" \| "value" \| "field"`) / `FieldDefinition.type` (`FieldType`) 은 **객체 경로가 다른 별개 필드**로 병존. rename 하지 않는다. 이유: 두 필드는 `element.dataBinding.type` / `fieldDef.type` 처럼 각각 격리된 scope 에서만 접근되고, canonical `element.type` 과 구조적 혼선이 없음.
- 일반 노드는 `frame`, `text`, `rectangle`, `Button` 등 실제 object tree 타입을 `type` 필드에 그대로 가진다.
- `reusable: true`는 해당 노드를 재사용 가능한 컴포넌트/레이아웃 원본으로 승격한다.
- `type:"ref"`는 reusable node 인스턴스다. 인스턴스 자신의 루트 속성은 원본 위에 override된다.
- **id 형식 제약 (pencil.dev 공식)**: 모든 노드 `id`는 **slash (`/`) 문자를 포함할 수 없다**. `descendants` key 의 slash 는 경로 구분자로만 해석된다. 즉 `"ok-button/label"` 은 "ok-button 노드의 label 자식"이며, `id` 자체에 `/` 가 있으면 parsing 모호성 발생. pencil.dev `.pen` format 규정과 동일.
- `descendants` key는 runtime UUID가 아니라 stable `id path`다. 예: `label`, `ok-button/label`, `header/title`
- `descendants[path]` 값은 세 가지 분기 모드를 지원하며, **세 모드는 상호 배제** — 분기 기준은 key 조합이다:
  - **(A) 속성 patch 모드** — `id`/`type`/`children` 키가 **전부 없을 때**. 제공된 속성만 원본 위에 merge. pencil.dev 공식: _"only the customized properties are present. The `id`, `type` and `children` properties must not be specified"_
  - **(B) node replacement 모드** — `type` 키가 **존재**할 때. 해당 경로 노드를 완전히 새 노드 서브트리로 교체. `id`/`children` 등 새 노드 완전 형태 필수.
  - **(C) children replacement 모드** — `children` 배열만 존재하고 `type` 이 **없을 때**. 부모 노드는 유지, children 배열만 교체. slot 채우기가 이 모드를 사용한다.
  - 3 모드 중 복수 조건 충족 시 resolver 는 **error** 처리 (silent merge 금지) — validation 단계에서 발견.
- `slot`은 별도 특수 노드가 아니라 일반 컨테이너의 schema 속성이다. 타입은 pencil.dev 공식 규정대로 `slot?: false | string[]` — `false` 또는 **추천 reusable component ID 배열**. 배열 각 원소는 "이 slot 에 삽입 가능한 reusable 후보" 로 에디터가 원클릭 삽입 UI 를 제공할 수 있다.
- slot 채우기는 canonical format에서 `descendants[slotPath].children` 교체(모드 C)로 표현한다.
- legacy `slot_name` 기반 데이터는 adapter 단계에서 canonical descendants children replacement로 정규화한다.

### type vocabulary policy (pencil 공식 schema 와의 관계)

pencil 은 primitive-centric (`rectangle`/`ellipse`/`text`/`path` 등 저수준 도형), composition 은 component-centric (`Button`/`Card`/`TextField` 등 고수준) 이다. canonical `Element.type` 값 공간 정책:

- **허용 값**: composition Component 116 (`Button`, `Card`, `Calendar`, ...) + pencil 공용 구조 타입 3 (`ref`, `frame`, `group`) = 총 119 literal
- **pencil primitive 10 (`rectangle`/`ellipse`/`line`/`polygon`/`path`/`text`/`note`/`prompt`/`context`/`icon_font`)** 은 canonical 노드 값으로 **직접 등장하지 않음**
- **import adapter 규칙** (pencil `.pen` → composition canonical):
  - `rectangle` / `frame` (primitive) → composition `frame` 로 매핑, Fill/Stroke/cornerRadius 는 Spec 정합 style 로 normalize
  - `text` → composition `Text` component
  - `icon_font` → composition `Icon` component (ADR-019 정합, iconFontFamily → icon library 매핑)
  - `ellipse` / `line` / `polygon` / `path` → `frame` + 해당 시각 속성 fallback (primitive geometry 는 composition 에 직접 표현 없음)
  - `note` / `prompt` / `context` → `metadata.type` 에 저장, 시각 렌더는 주석 형태
  - `group` → composition `frame` (group 은 composition 에 별도 타입 없음, frame 으로 통합)
- **export adapter 규칙** (composition canonical → pencil `.pen`):
  - `frame` → `frame` 그대로
  - `ref` → `ref` 그대로
  - composition component (`Button`, `Card`, ...) → 해당 component 의 Spec 을 primitive 트리로 expand (Button = frame + text + icon, Card = frame + 내부 section 등)
  - 원본 composition vocabulary 복원은 `metadata.compositionType` 에 저장 (roundtrip 가능성 확보)
- **1:1 호환 아님**: composition canonical 은 pencil primitive 편집 도구가 아니다. 목적은 (a) 필드명/구조 정합 (b) adapter 경유 import/export 가능성. primitive-level 편집은 composition 범위 외 — D3 (Spec) 가 시각 표현 소유

### document-level 메타 필드 매핑 (composition 기존 시스템 → canonical)

| composition 기존 시스템                                        | canonical 문서 root 필드                 | 매핑 규칙                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 포맷 버전 (현재 없음)                                          | `version: string`                        | 초기값 `"composition-1.0"`. breaking change 시 major 증가. read-through adapter 가 version 검사 후 migration 경로 선택                                                                                                                                                                                                                                         |
| ADR-021 Theme 시스템 (Tint color system + dark mode)           | `themes: {[key]: string[]}`              | `themes.mode: ["light", "dark"]` + `themes.tint: ["blue", "purple", ...]` (기존 Tint 프리셋). 엔티티 level `theme?: {mode: "dark", tint: "blue"}` override 지원                                                                                                                                                                                                |
| ADR-022 Spec TokenRef + `{color.accent}` / `{spacing.md}` 참조 | `variables: {[key]: VariableDefinition}` | TokenRef 를 canonical `variables` 정의로 투영. 필드에서 `{ $var: "color-accent" }` 형태 참조. 기존 CSS 변수(`--accent`, `--bg-raised` 등) 는 resolver 가 `variables` 에서 자동 emit                                                                                                                                                                            |
| Element.variableBindings (line 105)                            | 엔티티 내 `NumberOrVariable` 참조        | `variableBindings: ["$--primary"]` → 해당 필드 값을 `{ $var: "primary" }` 로 inline 표현. variableBindings 배열 필드 해체                                                                                                                                                                                                                                      |
| (직접 매핑 없음) — 외부 `.pen` 참조형 hook                     | `imports: {[key]: string}`               | `imports: { "shared-kit": "./shared.pen" }` + `ref: "shared-kit:round-button"` 형태. **P0 타입 스텁만**, resolver 는 Phase 5 이후 연기. DesignKit `kitLoader.ts:259` (localId → new UUID 재발급) / `kitExporter.ts:33` (snapshot JSON export) 은 **복사-적용 파이프라인이라 `imports` 와 의미 다름** — 별도 migration track 유지, 본 ADR canonical 전환과 독립 |

### Frame 전용 컨테이너 필드 3종

| 필드           | 타입                | composition 기존 매핑             | 비고                                                                        |
| -------------- | ------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| `slot?`        | `false \| string[]` | `tag="Slot"` + `slot_name` 시스템 | 이미 정의 완료 (위 canonical 규칙)                                          |
| `clip?`        | `BooleanOrVariable` | style `overflow: hidden`          | `true` 일 때 children 이 frame 경계를 넘으면 clip. Skia 경로도 동일         |
| `placeholder?` | `boolean`           | 없음 (신규)                       | 빈 frame 시각 hint. slot 이 미채워졌을 때 editor/canvas placeholder UI 렌더 |

### 엔티티 공통 필드 `name` / `metadata`

- **`name?: string`** — 모든 노드의 사용자 표시 이름. composition 기존 `componentName` (reusable 전용) 은 `name` 으로 통합 rename. 일반 노드도 `name` 사용 허용
- **`metadata?: { type: string; [key]: any }`** — extensibility hook. export adapter 가 `metadata.compositionType` 에 원본 composition component 이름 저장하여 roundtrip 지원. 미래 plugin 이나 외부 도구 annotation 용

## 현재 필드 → canonical 구조 변환

> 표에는 **의미/구조가 바뀌는 필드**만 담는다. 단순 key rename (예: `tag` → `type` 값 보존 rename) 은 위 canonical 규칙에 이미 선언되어 있고 표 행에 들어가지 않는다. 매핑 레이어를 유지하려는 게 아니라 **일회성 구조 전환** 규칙이다.

| legacy 구조                            | canonical 구조                                        | 변환 성격                                          |
| -------------------------------------- | ----------------------------------------------------- | -------------------------------------------------- |
| `componentRole: "master"`              | 일반 노드 + `reusable: true`                          | 메타필드 → 문서 내부 reusable root 승격            |
| `componentRole: "instance" + masterId` | `type: "ref"`, `ref: <master-id>`                     | instance 상태 모델 → 문법 승격                     |
| `overrides`                            | ref root-level 속성 override                          | root patch → 인스턴스 자신의 속성                  |
| `descendants`                          | `descendants[idPath]`                                 | key 의미 재정의 (runtime UUID → stable id path)    |
| `tag="Slot"` + `slot_name`             | slot 선언 컨테이너 + `descendants[slotPath].children` | 특수 노드 → 1급 schema 속성 + children replacement |
| `Page.layout_id`                       | page root `type:"ref"` to reusable layout shell       | 소속 필드 → 문서적 직접 표현                       |
| `layout_id` 소속 element               | reusable layout component subtree                     | 소속 필드 → 구조적 트리                            |
| `parent_id/order_num`                  | canonical tree order                                  | flat index → 문서 순서. runtime 캐시로 파생 가능   |

## 세부 작업

### P0. 타입 / 계약 고정

#### 신규

| 경로                                                      | 역할                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------- |
| `packages/shared/src/types/composition-document.types.ts` | canonical document / reusable / ref / descendants / slot 타입 |
| `docs/adr/design/903-...-breakdown.md`                    | phase / mapping / test strategy 문서                          |

#### 수정

| 경로                                             | 변경                                                          |
| ------------------------------------------------ | ------------------------------------------------------------- |
| `packages/shared/src/types/element.types.ts`     | legacy 필드에 canonical 대응 주석 추가, deprecation 계획 명시 |
| `apps/builder/src/types/builder/layout.types.ts` | legacy `Slot`/`layout_id` 의미를 adapter 문맥으로 축소        |

#### 산출물

- canonical JSON 예제 4종
  - reusable component
  - ref instance with descendants override
  - slot-declared layout shell
  - page instance with slot content fill
- resolver 순서 확정 (`ref resolve → descendants apply → slot contract validate → resolved tree`)
- source `id` 생성/보존 규칙 확정 (slash 금지 제약 포함)
- descendants path 규칙 확정 (3 모드 상호배제 judging 규칙 포함)
- **pencil schema 정합 메타 필드 6건 land** (옵션 B 선택 결과) — 위 "document-level 메타 필드 매핑" 및 "Frame 전용 컨테이너 필드 3종" 테이블을 P0 타입으로 실제 TypeScript 선언:
  - **document root**: `CompositionDocument` 인터페이스 — `version: string` (초기값 `"composition-1.0"`) + `themes?: Record<string, string[]>` + `variables?: Record<string, VariableDefinition>` + `imports?: Record<string, string>` + `children: CanonicalNode[]`
  - **Frame 전용**: `FrameNode` 인터페이스 — `clip?: BooleanOrVariable` + `placeholder?: boolean` + `slot?: false | string[]` 3 필드
  - **엔티티 공통**: `CanonicalNode` 베이스 — `name?: string` + `metadata?: { type: string; [k: string]: unknown }` 추가 (composition 기존 `componentName` 은 `name` 으로 rename)
  - **vocabulary policy 타입**: `ComponentTag` literal union 에 `"ref" | "frame" | "group"` 3 pencil 구조 타입 포함 + pencil primitive 10종은 제외 (값으로 등장 금지)
  - **pencil import/export adapter 규칙** — `pencilPrimitiveToComponent(primitive)` / `componentToPencilTree(node)` 양방향 함수 시그니처 고정. 각 primitive 의 매핑 룰 1:1 명시 (rectangle→frame, text→Text, icon_font→Icon, note/prompt/context→metadata 저장, ellipse/line/polygon/path→frame fallback, group→frame 병합)
  - **migration hook**: `migrate(doc, fromVersion, toVersion)` 함수 스텁. `version` 검사 후 step-wise migration 체인 등록 지점 확보 (실제 migration 코드는 추후 breaking change 시점에 추가)
- **type discriminator 안전장치 (R5 대응)** — `tag → type` 단일 rename 에 따른 `FieldDefinition.type` / `DataBinding.type` 과의 구조적 혼동 방지. 다음 3건을 P0 타입/계약으로 고정:
  - **`ComponentTag` literal union 정의** — `Element.type` 의 값 공간을 116개 component literal + canonical primitive(`"ref"`, `"frame"`, `"text"`, `"rectangle"`, ...)로 좁힌 TypeScript literal union 으로 선언. 예: `type ComponentTag = "Button" | "Card" | "Calendar" | ... | "ref" | "frame" | "text"`. `FieldType` (`"string" | "number" | "boolean" | "date" | "image" | "url" | "email"`) 과 값 공간 교집합 0건 실측 확증 → compile-time disjoint 보장
  - **`isCanonicalNode(obj): obj is Element` runtime type guard** — `type`(ComponentTag) + `id`(slash-free string) + (optional `children`/`reusable`/`ref`/`descendants`/`slot`) 조합 체크. canonical tree walker 는 반드시 이 guard 경유 (`if (!isCanonicalNode(child)) continue`). `FieldDefinition` / `DataBinding` 이 tree walker 에 섞여 들어오더라도 node 오판 차단
  - **scope 분리 ADR 주석** — `packages/shared/src/types/composition-document.types.ts` 상단 주석에 "`element.type` vs `element.props.columnMapping.*.type` vs `element.dataBinding.type` 3단계 nesting scope 격리, 서로 rename 하지 않음" 명문화
- **resolver 캐시 계약** — 성능 등급 LOW 주장의 전제. 다음 항목을 타입/계약으로 고정:
  - **캐시 키**: `(docVersion, rootRefId, descendantsFingerprint, slotBindingFingerprint)` 조합. descendantsFingerprint 는 `descendants` 객체의 stable hash (key 정렬 + deep-equal 기반)
  - **invalidation 단위**: ref root 를 루트로 하는 **subtree** 단위. 하나의 descendants path override 변경 시 해당 ref instance 의 resolved subtree 만 dirty. 형제 ref instance 는 cache hit 유지
  - **parent propagation 규칙**: subtree dirty 가 조상 ref instance 로 전파되는 경우는 "자식 ref 가 다른 reusable 로 교체" 또는 "slot children 배열 구조 변경" 뿐. 속성 patch 는 subtree 내부에만 dirty
  - **캐시 life-cycle**: Preview iframe 과 Skia sprite 양쪽이 **공통 resolver 의 동일 캐시 인스턴스** 를 공유 (cross-renderer reuse) — Gate G2 (a) 의 전제
  - 캐시 미스 시 resolver 비용 상한(P50/P99) 을 P0 산출물에 숫자로 박제 (후속 Phase 에서 regression gate 로 사용)

### P1. Legacy adapter

#### 목표

현 저장소의 flat records를 canonical doc tree로 투영하는 adapter를 만든다. 이 단계에서는 **저장 포맷 미변경**.

#### 대상 파일

| 경로                                                   | 변경                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `apps/builder/src/preview/utils/layoutResolver.ts`     | legacy-specific 코드 분리, adapter 입력으로 전환 준비                                      |
| `apps/builder/src/utils/component/instanceResolver.ts` | root instance merge / descendants merge 로직을 canonical resolver에서 재사용 가능하게 분리 |
| `apps/builder/src/builder/stores/elements.ts`          | canonical adapter selector 추가                                                            |
| `packages/shared/src/types/element.types.ts`           | legacy adapter input/output 타입 선언                                                      |

#### adapter 책임

- `elements[]`, `pages[]`, `layouts[]` → canonical document tree
- **`element.tag` → `element.type` 단일 rename** (값 보존). adapter 입력 시점에 1회 정규화. 1031 참조 / 154 파일 (2026-04-22 실측) 규모지만 **대부분 읽기 경로** — 쓰기 경로는 store action + DB 저장 + import/export 로 좁아짐. rename 은 장기적으로 코드베이스 전체에 반영 (경로 β 아닌 경로 α: `DataBinding.type` / `FieldDefinition.type` 은 불변)
- `componentRole/masterId` → `reusable` / `ref`
- `tag="Slot"` + `slot_name` → slot-declared container + `descendants[slotPath].children` (Slot 특수 케이스만 의미 변환, 나머지 tag 값은 위 단일 rename 에 흡수)
- `Page.layout_id` → page root `ref`
- `parent_id/order_num` → tree order
- 기존 UUID 기반 descendants는 임시 path map으로 투영

### P2. 공통 resolver

#### 목표

Preview와 Skia가 **같은 resolved tree**를 consume하게 만든다.

#### 대상 파일

| 경로                                                                      | 변경                                                                                                                                                                                                      |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/builder/src/preview/utils/layoutResolver.ts`                        | canonical resolver consumer로 교체                                                                                                                                                                        |
| `apps/builder/src/builder/workspace/canvas/sprites/useResolvedElement.ts` | element 단건 merge 대신 resolved tree/path consumer로 축소                                                                                                                                                |
| `apps/builder/src/builder/main/BuilderCore.tsx`                           | Preview/Builder 공통 resolved tree 전달 경계 정리                                                                                                                                                         |
| `apps/builder/src/preview/App.tsx`                                        | **신규** — hybrid 분기 12건 전원 canonical resolver 경유로 치환. 대상: `slot_name` 매핑 로직 (line 578-599, `pe.props.slot_name \|\| "content"` fallback 포함) + `layout_id` 분기 (line 130-144, 707-738) |
| `apps/builder/src/preview/types/index.ts`                                 | **신규** — `layout_id/slot_name` 타입 필드 (line 21-22) 를 canonical resolver 출력 타입 기준으로 재선언 또는 adapter 전용 타입으로 격하                                                                   |

#### 원칙

- Preview 전용 resolver 신규 개발 금지
- Skia 전용 instance resolver 신규 개발 금지
- canonical resolver 결과만 renderer 입력으로 허용
- slot 관련 validation은 resolver 내부에서 수행하되, slot content materialization은 descendants children replacement 결과를 기준으로 한다
- **preview/App.tsx hybrid 분기 0 보장** — P2 완료 시 `grep -c "layout_id\|slot_name" apps/builder/src/preview/App.tsx` = 0 또는 adapter-only 참조만 잔존 (Gate G2 (c) 측정 근거)

### P3. frameset/layout/template 흡수

> **Sub-breakdown**: 정량 분포 (403 ref / 59 files) 기반 6 sub-phase 분할 + 의존 그래프 + 회귀 검증 매트릭스는 [903-phase3-frameset-breakdown.md](903-phase3-frameset-breakdown.md) 참조. 본 섹션은 high-level overview 만 유지.

#### 목표

기존 frameset/layout/template 시스템을 canonical composition/component format의 사례로 변환한다.

#### 대상 파일

| 경로                                                                         | 변경                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/builder/src/builder/templates/layoutTemplates.ts`                      | layout shell 정의를 reusable + slot-declared doc tree로 전환                                                                                                                                                                                          |
| `apps/builder/src/types/builder/layout.types.ts`                             | legacy `Slot` 설명을 adapter 문맥으로 축소                                                                                                                                                                                                            |
| `apps/builder/src/builder/panels/properties/editors/LayoutPresetSelector/**` | slot 생성/매핑 UI를 slot authoring UI로 전환 (`ExistingSlotDialog` 포함)                                                                                                                                                                              |
| `apps/builder/src/builder/panels/nodes/LayoutsTab/LayoutsTab.tsx`            | **신규** — CSS 시대 "Layout 생성" UI 를 **Reusable Frame authoring UI** 로 재설계. `createLayout` → `createReusableFrame` (canonical `{type:"frame", reusable:true, children, slot}` 노드 생성), "Layout 목록" → "Reusable Frame 목록" 으로 탭 재명명 |
| `apps/builder/src/builder/panels/nodes/NodesPanel.tsx`                       | **신규** — LayoutsTab 탭 라벨/아이콘을 frame 메타포로 재정렬. Layers/Pages/Frames 3 탭 체계                                                                                                                                                           |
| `apps/builder/src/builder/panels/properties/editors/LayoutBodyEditor.tsx`    | **신규** — `layout_id` 기반 body 편집 → canonical `ref` 인스턴스 편집. `element.layout_id` 조회 → `element.type === "ref"` 이면 `ref` 타깃 reusable frame 편집 UI                                                                                     |
| `apps/builder/src/builder/panels/properties/editors/LayoutSlugEditor.tsx`    | **신규** — layout slug(URL path) 개념을 reusable frame 의 `id` 또는 metadata 로 이관                                                                                                                                                                  |
| `apps/builder/src/builder/panels/properties/editors/ElementSlotSelector.tsx` | **신규** — `slot_name` 문자열 입력 UI → canonical `slot` 속성(추천 reusable ID 배열) 편집 UI                                                                                                                                                          |
| `apps/builder/src/builder/stores/useLayoutsStore.ts` (또는 동등 경로)        | **신규** — `layouts[]` 별도 store 해체 → canonical document tree 내부 `reusable: true` 노드 조회 selector 로 대체. read-through 기간 adapter 유지 가능                                                                                                |

#### 완료 기준

- header/left/main 형태의 layout shell이 `reusable + ref + slot`으로 표현됨
- page는 layout shell의 `ref` 인스턴스로 표현됨
- main slot 채우기는 `descendants["main"].children` 패턴으로 정착함
- frameset 전용 엔진/특수 규칙 삭제 가능 상태
- template export/import가 canonical format을 기준으로 동작
- **NodesPanel 의 "Layouts" 탭이 "Frames" 탭 (또는 reusable frame authoring 전용 UI) 으로 재설계**되어 canonical `{type:"frame", reusable:true}` 노드를 직접 생성/편집. `useLayoutsStore` 의 별도 `layouts[]` 저장 해체 — canonical document tree 내부 reusable 노드 단일 소스
- `LayoutBodyEditor` / `LayoutSlugEditor` / `LayoutPresetSelector` / `ElementSlotSelector` 가 `layout_id/slot_name` 문자열이 아닌 canonical `ref`/`slot`/`descendants` 를 직접 조작
- **측정 기준 (repo-wide)**: `grep -rnE "createLayout|useLayoutsStore|currentLayoutId|fetchLayouts|layout_id" apps/builder/src/ --include='*.ts' --include='*.tsx' | wc -l` = 0 또는 `apps/builder/src/adapters/legacy-layout/**` 디렉터리 한정 shim 참조만 잔존 (Gate G3 (c)(e) 측정 근거). **2026-04-22 baseline = 355 ref**. panel 내부뿐 아니라 `main/BuilderCore.tsx` / `hooks/useIframeMessenger.ts` / `workspace/canvas/BuilderCanvas.tsx` / `components/dialog/AddPageDialog.tsx` / `panels/properties/editors/PageLayoutSelector.tsx` / `stores/layouts.ts` / `stores/utils/layoutActions.ts` / `workspace/canvas/skia/workflowEdges.ts` / preview 경로 전부 포함

### P4. 편집 semantics 전환

#### 목표

편집 연산을 canonical semantics에 맞춘다.

#### 대상 파일

| 경로                                                                      | 변경                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/builder/src/builder/stores/utils/instanceActions.ts`                | create/detach semantics를 `ref` 기준으로 **재구현** (UI 연결 아님). 기존 `detachInstance` (line 80) 은 props 병합 + 메타필드 제거만 수행, **subtree materialize 미구현** (line 121 주석 "props 변환만 → 구조 불변" 확증) + descendants 는 `instanceResolver.ts:81` 에서 child ID (runtime UUID) 기반. canonical 전환 시 (a) subtree 실제 복제 + 새 id 재발급 (b) path-based descendants 적용 (c) UI 액션 연결 (d) undo payload 확장 — 새 semantics 전체 재작성. **신규** `resetDescendantsOverride(instanceId, path?)` 구현 (현재 0건) |
| `apps/builder/src/builder/utils/multiElementCopy.ts`                      | id remap / descendants path remap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `apps/builder/src/builder/stores/history/**`                              | undo/redo payload를 canonical 연산 기준으로 정리. detach / reset override 모두 undo 복구 가능하도록 history entry 스키마 확장                                                                                                                                                                                                                                                                                                                                                                                                          |
| `apps/builder/src/builder/panels/designKit/**`                            | master/instance UI를 reusable/ref UI로 재해석. 원본 카탈로그에 `componentName` + reusable 시각 마커 + "이 원본을 사용하는 인스턴스 N개" 배지                                                                                                                                                                                                                                                                                                                                                                                           |
| `apps/builder/src/builder/panels/nodes/LayersSection.tsx`                 | **신규** — LayerTree 항목에 reusable/ref/override 3종 시각 마커 추가 (아이콘 + 색상 + 라벨). 현재 role 표시 0건 상태                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `apps/builder/src/builder/panels/properties/PropertiesPanel.tsx`          | **신규** — 인스턴스 선택 시 "원본으로 이동" 버튼 + override 된 필드별 "원본으로 복원" 버튼 제공. override dot 마커 표시                                                                                                                                                                                                                                                                                                                                                                                                                |
| `apps/builder/src/builder/workspace/canvas/**` (Skia overlay / hit layer) | **신규** — canvas 선택 시 reusable/ref/override badge overlay 렌더링. hover 시 원본 미리보기 툴팁                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `apps/builder/src/builder/panels/nodes/NodesPanel*.tsx` + context menu    | **신규** — 우클릭 메뉴 "Detach instance" / "Reset overrides" / "원본으로 이동" / "이 원본의 인스턴스 보기" 액션 + 단축키 바인딩                                                                                                                                                                                                                                                                                                                                                                                                        |

#### 핵심 규칙

- duplicate: 새로운 runtime id + 새로운 source `id` scope remap
- delete: slot/ref-aware validation
- detach: `ref` 해제 후 subtree materialize. **경고 다이얼로그** 필수 — "원본 연결 해제 후 원본 변경이 반영되지 않음" 고지
- copy/paste: descendants key, slot binding, source `id` collision 처리
- component authoring: 일반 노드를 `reusable:true`로 승격하는 명시적 연산
- slot authoring: 컨테이너에 `slot` 메타데이터와 추천 reusable IDs를 편집하는 UI 제공
- **reset override**: `descendants[path]` 삭제 후 원본 값 상속. 필드 단위 / path 단위 / instance 전체 3 단계 granularity 지원
- **원본 편집 전파 미리보기**: 원본 (`reusable: true`) 수정 시 "N 개 인스턴스에 반영됨. 인스턴스별 override 는 보존" 다이얼로그 또는 canvas preview 로 영향 범위 표시 강제

#### UI/UX 시각 마커 규격 (R6 대응)

원본/인스턴스/override 3종 상태를 **1-glance 로 구분 가능**해야 한다. 구체 디자인은 D3 (Spec) 경계 안에서 결정 — 본 ADR 은 **상태 노출 의무**만 규정:

| 상태                 | 판정 조건                                             | 최소 시각 마커                                                     | 액션 연결                      |
| -------------------- | ----------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------ |
| reusable 원본        | `node.reusable === true`                              | LayerTree 아이콘 + 라벨(`componentName`) + DesignKit 카탈로그 등록 | "이 원본의 인스턴스 N개 보기"  |
| ref 인스턴스         | `node.type === "ref"`                                 | LayerTree link 아이콘 + "→ {ref}" 라벨 + canvas overlay badge      | "원본으로 이동" + detach       |
| descendants override | 부모 ref instance 에서 `descendants[pathToNode]` 존재 | Properties 패널 dot 마커 + LayerTree subtle 색상 변화              | 필드/path 단위 "원본으로 복원" |

- 마커 디자인은 기존 token 시스템 (`--accent` / `--fg-muted` 등) 사용. 신규 토큰 도입 지양
- 성능 고려: LayerTree 는 수백 노드 렌더링 가능 — 마커 판정은 `isReusable(node) / isRef(node) / hasOverride(node, parentInstance)` 3 함수로 O(1) 조회
- canvas overlay 는 선택 중인 노드 + 부모 ref chain 에만 렌더링 (전체 tree 아님)

### P5. persistence / import-export 전환

#### 목표

canonical format을 저장 정본으로 승격한다.

#### 대상 파일

| 경로                                           | 변경                                            |
| ---------------------------------------------- | ----------------------------------------------- |
| `apps/builder/src/lib/db/indexedDB/adapter.ts` | canonical 문서 저장 스키마 또는 serializer 도입 |
| `apps/builder/src/services/save/**`            | save/load를 canonical 기준으로 전환             |

> **DesignKit (`kitLoader.ts` / `kitExporter.ts`) 제외** — Risk R7 + Hard Constraint #10 `imports` 결정에 따라 DesignKit 복사-적용 파이프라인은 본 ADR 의 persistence/import-export 전환 **대상이 아님**. 별도 migration track 으로 존치되며, 향후 참조형 `imports` 모델과 통합 여부는 별도 ADR 에서 결정. 본 Phase 5 범위에서는 kitLoader/kitExporter 본체를 건드리지 않고 canonical format 과 공존. DesignKit 이 canonical document tree 에 복사 삽입되는 시점에만 `metadata.importedFrom: "designkit:<kit-id>"` 주입.

#### 전환 원칙

- read-through 먼저, write-through 나중
- shadow serializer 기간 운영 가능
- destructive migration 금지
- **`tag` → `type` 컬럼 전환 (DB 스키마)**: Supabase/IndexedDB 양쪽의 elements 레코드 `tag` 컬럼을 `type` 으로 rename. read-through 단계에서는 양 컬럼 호환 SELECT (`coalesce(type, tag) AS type`), write-through 단계에서 `type` 단일 column 으로 정착. 기존 프로젝트는 `ALTER TABLE ... RENAME COLUMN tag TO type` 또는 shadow column + 백필 후 swap
- `tag` / `type` 혼재 기간에는 adapter 가 **input canonicalization** 을 일방향 (`tag → type`) 수행. 역방향(`type → tag`) 은 legacy 구버전 클라이언트 호환 목적이 없으므로 제공하지 않음

## 테스트 전략

### 단위 테스트

- canonical resolver
  - ref nesting
  - descendants override precedence
  - descendants path override (`ok-button/label`)
  - descendant node replacement (`descendants[path].type`)
  - descendants children replacement on slot container
  - slot suggestion/contract validation
- id/path remap
  - duplicate
  - copy/paste
  - detach

### 통합 테스트

- Preview와 Skia가 같은 resolved tree snapshot을 받는지 비교
- layout template 적용 후 동일 slot fill 결과 비교
- legacy project load → canonical adapter → save roundtrip
- reusable component authoring → ref instance 생성 → descendants override roundtrip

### 회귀 체크리스트

- [ ] 기존 layout preset 페이지가 그대로 열린다
- [ ] 기존 component instance가 시각적으로 동일하다
- [ ] `ok-button/label` 같은 nested descendants override가 유지된다
- [ ] slot 영역의 `children` 교체가 Preview와 Skia에서 동일하게 materialize 된다
- [ ] detach 후 일반 subtree로 정상 materialize 된다
- [ ] undo/redo가 ref/slot 변경을 안정적으로 복원한다
- [ ] import/export 결과가 source `id` 충돌 없이 재로드된다

## 비목표

- ADR-063의 D1/D2/D3 체인 수정
- RAC DOM 구조 변경
- RSP props 계약 재설계
- Spec 시각 토큰/shape 규칙 변경
- Builder/Preview 렌더러 전면 재작성

## 마이그레이션 전략 메모

- **절대 금지**: P0 이전에 DB 스키마부터 바꾸기
- **권장 순서**: canonical type → adapter → resolver → renderer consumer → editor operations → persistence
- **운영 전략**: feature flag 또는 adapter 선택자로 rollback 가능성 유지

## 정량 Gate 측정 명령 (재현 가능 baseline)

모든 정량 Gate 수치는 **아래 fenced code block 명령을 그대로 실행한 결과**로 정의한다. Phase 완료 판정 시 같은 명령을 재실행하여 0 또는 adapter-only 잔존 여부 확인. 명령 교체 금지 — 명령이 바뀌면 Gate 수치 재합의 필요.

> 명령은 **repo root** 에서 실행한다. markdown 표 대신 fenced code block 으로 박제한 이유: inline code 표 안에서 pipe (`|`) 가 markdown 구분자로 해석되거나 escape 처리로 정규식이 깨져 `exit 1` 발생 위험 방지 (Codex Round 11 지적).

### M1. `tag` 참조 — Context 표 / G5 (b)

baseline 2026-04-22: **1031 ref**

```bash
grep -rnE '\.tag\b|tag:\s*("|'"'"')' apps/builder/src/ packages/shared/src/ \
  --include='*.ts' --include='*.tsx' | wc -l
```

### M2. `layout_id` 참조 — Context 표 / G5 (b)

baseline 2026-04-22: **258 ref**

```bash
grep -rn 'layout_id' apps/builder/src/ packages/shared/src/ \
  --include='*.ts' --include='*.tsx' | wc -l
```

### M3. hybrid 개별 필드 5종 (`masterId` / `componentRole` / `slot_name` / `overrides` / `descendants`)

baseline 2026-04-22: 55 / 41 / 25 / 23 / 39 ref

```bash
for field in masterId componentRole slot_name overrides descendants; do
  n=$(grep -rn "$field" apps/builder/src/ packages/shared/src/ \
    --include='*.ts' --include='*.tsx' | wc -l | tr -d ' ')
  echo "$field: $n"
done
```

### M4. hybrid 6필드 참조 파일 수

baseline 2026-04-22 Round 12 재측정: **76 파일 (unique, hybrid 6 필드만)**. 최초 기록 53 은 오류 — Codex Round 12 지적으로 정정

```bash
grep -rlE 'layout_id|masterId|componentRole|slot_name|overrides|descendants' \
  apps/builder/src/ packages/shared/src/ \
  --include='*.ts' --include='*.tsx' | wc -l
```

### M4b. tag + hybrid 6 합집합 파일 수 (Context "hybrid 전체 unique 파일" 기준)

baseline 2026-04-22 Round 12 재측정: **184 파일 (unique)**. 최초 기록 154 는 tag 단독 파일 수를 합집합으로 오기재한 것 — Codex Round 12 계기로 정정

```bash
grep -rlE '\.tag\b|tag:\s*("|'"'"')|layout_id|masterId|componentRole|slot_name|overrides|descendants' \
  apps/builder/src/ packages/shared/src/ \
  --include='*.ts' --include='*.tsx' | wc -l
```

### M4c. tag 단독 참조 파일 수 (Context 표 `tag` 행의 "154 파일" 근거)

baseline 2026-04-22 Round 12 재측정: **154 파일 (tag 만)**

```bash
grep -rlE '\.tag\b|tag:\s*("|'"'"')' \
  apps/builder/src/ packages/shared/src/ \
  --include='*.ts' --include='*.tsx' | wc -l
```

### M5. `preview/App.tsx` hybrid 분기 — G2 (c)

baseline 2026-04-22: **12 건**

```bash
grep -cE 'slot_name|layout_id' apps/builder/src/preview/App.tsx
```

### M6. `layoutTemplates.ts` Slot 선언 — G5 (d)

baseline 2026-04-22: **28 건**

```bash
grep -cE 'tag: "Slot"|slot_name' \
  apps/builder/src/builder/templates/layoutTemplates.ts
```

### M7. repo-wide legacy layout API — G3 (c)(e), G5 (f)

baseline 2026-04-22: **355 ref**. Phase 3 완료 시 adapter-only, Phase 5 G5 완료 시 0 또는 `adapters/legacy-layout/**` shim 한정.

```bash
grep -rnE 'useLayoutsStore|currentLayoutId|fetchLayouts|layout_id' \
  apps/builder/src/ \
  --include='*.ts' --include='*.tsx' | wc -l
```

### M8. `useLayoutsStore` 참조 — G3 (e)

baseline 2026-04-22: **38 ref**

```bash
grep -rn 'useLayoutsStore' apps/builder/src/ \
  --include='*.ts' --include='*.tsx' | wc -l
```

### 집계 원칙

- `grep -r` 기반 (rg 사용 시 결과 수치 달라질 수 있음 — Codex Round 9 에서 rg vs grep 차이 실측 확인됨)
- `--include='*.ts' --include='*.tsx'` 확장자 필터 고정 — `.md`/`.json`/`.css` 는 제외
- `| wc -l` 로 행 수 카운트. macOS 공백 제거는 `| wc -l | tr -d ' '` 로 append — 수치 자체는 동일
- M1 의 `'"'"'` 는 bash single-quote 내부에 single-quote 를 넣기 위한 관용 표현 (quote 종료 + escaped quote + quote 재시작). 복사 시 그대로 유지
- Phase 완료 판정 시 **fenced code block 그대로 복사 실행**, 결과를 adapter-only 잔존 파일 경로와 함께 PR description 에 기록
- baseline 재측정 시 본 표 업데이트 + Gate 조건 수치 동기화
- Phase 완료 판정 시 **명령 그대로 재실행**, 결과를 adapter-only 잔존 파일 경로와 함께 PR description 에 기록
