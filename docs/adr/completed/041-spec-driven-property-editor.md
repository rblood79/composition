# ADR-041: Spec-Driven Property Editor — Spec 기반 프로퍼티 에디터 자동 생성

## Status

Accepted

## Date

2026-03-13 (2026-03-16 코드베이스 실측 + 설계 리뷰 반영, 2026-03-26 Phase 0~1 + 배치 1/2/3 + B/C 하이브리드 11개, 2026-03-27 Phase 2~4 전체 완료, 2026-03-29 S2 섹션 재분류 + PropertySizeToggle 수정 + Disclosure p 래퍼 제거)

## Decision Makers

composition Team

## Related ADRs

- [ADR-036](036-spec-first-single-source.md): Spec-First Single Source (CSS 자동 생성)
- [ADR-045](045-s2-property-editor-alignment.md): 기존 계약과 Property Editor surface 정렬
- [ADR-046](046-s2-contract-expansion-form-colorfield-tabs.md): 자동 생성 전 계약 확정
- [ADR-048](048-declarative-props-propagation.md): S2 Context 기반 선언적 Props Propagation — ChildSyncField를 PropagationSpec으로 대체(supersede). ChildSyncField는 미구현 상태에서 직행 전환

---

## Context

### 문제: 103개 에디터 파일의 반복 코드

현재 컴포넌트별 프로퍼티 에디터가 **103개의 개별 파일**로 존재한다.

```
apps/builder/src/builder/panels/properties/editors/
├── ButtonEditor.tsx        (variant/size/fillStyle/icon/disabled/pending...)
├── BadgeEditor.tsx         (variant/size/fill/children...)
├── SwitchEditor.tsx        (size/children/disabled/selected...)
├── TextFieldEditor.tsx     (size/label/placeholder/type/disabled/readonly...)
├── CardEditor.tsx          (variant/size/density/orientation/selectable...)
├── SelectEditor.tsx        (variant/size/placeholder/disabled...)
└── ... (97개 더)
```

이 파일들의 **80% 이상이 동일한 패턴을 반복**한다:

```typescript
// 모든 에디터가 반복하는 패턴
<PropertySelect label="Variant"
  options={[{ value: "accent", label: "Accent" }, ...]}  // ← Spec.variants에 이미 있음
/>
<PropertySizeToggle scale="5" />                          // ← Spec.sizes 키 개수
<PropertySwitch label="Disabled" />                       // ← Props의 boolean 필드
```

### 핵심 문제: Spec ↔ Editor 이중 정의

| 데이터        | Spec 정의                                                   | Editor 하드코딩                        |
| ------------- | ----------------------------------------------------------- | -------------------------------------- |
| variant 옵션  | `ButtonSpec.variants = { accent, primary, secondary, ... }` | `options={[{ value: "accent" }, ...]}` |
| size 옵션     | `ButtonSpec.sizes = { xs, sm, md, lg, xl }`                 | `scale="5"`                            |
| 기본값        | `ButtonSpec.defaultVariant = "primary"`                     | `currentProps.variant \|\| "primary"`  |
| boolean props | `ButtonProps.isDisabled?: boolean`                          | `PropertySwitch label="Disabled"`      |

ADR-036이 **Spec → CSS** 동기화를 해결했다면, 이 ADR은 **Spec → Editor UI** 동기화를 해결한다.

### 변경 비용

- **새 variant 추가**: Spec + Editor 2곳 수정 (Editor에서 options 배열에 추가해야 함)
- **새 컴포넌트 추가**: Spec + CSS + Editor + Metadata 4곳 생성
- **prop 이름 변경**: Spec + Editor 2곳 수정

### Hard Constraints

1. **기존 PropertyEditorProps 인터페이스 유지** — `{ elementId, currentProps, onUpdate }`
2. **성능 패턴 보존** — memo, useCallback, useMemo 최적화 유지
3. **커스텀 에디터 지원** — Table, ColorPicker 등 특수 에디터는 수동 유지 가능
4. **Deep child sync 지원** — Card, Switch 등 자식 동기화 패턴 유지

### ADR-046 선행 계약 기준

ADR-041은 미확정 prop를 자동 생성 대상으로 포함하지 않는다. 자동 생성기는 **이미 제품 계약이 닫힌 prop surface만 입력으로 사용**한다.

현재 ADR-046 기준으로 자동 생성 입력에 포함 가능한 항목은 다음과 같다.

- `Tabs.density`
- `ColorField.variant`
- `ColorField.size`
- `ColorField.isInvalid`
- `ColorField.autoFocus`
- `ColorField.name`
- `ColorField.form`
- `ColorField.validationBehavior`
- `ColorField.necessityIndicator`
- `ColorField.labelPosition`
- `ColorField.labelAlign`
- `ColorField.channel`
- `ColorField.colorSpace`
- `Form.labelPosition`
- `Form.labelAlign`
- `Form.necessityIndicator`

반대로 아래 항목은 ADR-046에서 아직 보류 상태이므로 ADR-041 자동 생성 입력에 포함하지 않는다.

- `Form.size`
- `Form.isEmphasized`

---

## Alternatives Considered

### 대안 A: 현행 유지 (103개 개별 에디터)

- 위험: 기술(L) / 유지보수(**H**) / 마이그레이션(L)
- 장점: 변경 없음, 에디터별 완전한 자유도
- 단점: 103개 파일 반복 코드, Spec ↔ Editor 이중 정의 영구 지속

### 대안 B: PropertySchema를 Spec에 추가 (채택)

- 위험: 기술(M) / 유지보수(**L**) / 마이그레이션(M)
- `ComponentSpec.properties`에 에디터 구조를 선언적으로 정의
- `GenericPropertyEditor`가 schema에서 동적으로 UI 생성
- 장점: Spec 단일 소스, 새 컴포넌트 추가 시 Editor 파일 불필요
- 단점: Schema 설계 투자, 커스텀 위젯 확장 체계 필요

### 대안 C: Props 인터페이스에서 자동 추론 (리플렉션)

- 위험: 기술(**H**) / 유지보수(L) / 마이그레이션(**H**)
- TypeScript 타입에서 런타임에 UI 자동 생성
- 단점: TS 타입은 런타임에 사라짐, 별도 스키마 생성 빌드 스텝 필요, 섹션 구조/레이블 등 메타 정보 부재

### Risk Threshold Check

| 대안  | 기술  | 유지보수 | 마이그레이션 | 판정        |
| ----- | ----- | -------- | ------------ | ----------- |
| A     | L     | **H**    | L            | 장기 부적합 |
| **B** | M     | **L**    | M            | **채택**    |
| C     | **H** | L        | **H**        | 과잉 복잡   |

---

## Decision

**ComponentSpec에 `properties` 필드를 추가하여 프로퍼티 에디터 UI를 선언적으로 정의하고, GenericPropertyEditor가 이를 동적으로 렌더링한다.**

### Rationale

> 103개 에디터 중 80% 이상이 5가지 필드 타입(variant, size, boolean, enum, string)의 조합이다. 이 패턴은 Spec의 `variants`/`sizes` + Props 인터페이스에서 완전히 유도 가능하다. 나머지 20%의 커스텀 로직(deep child sync, 조건부 표시, 특수 위젯)은 schema의 확장 필드로 처리한다.

> ADR-045/046 이후에는 자동 생성기가 “문서에는 있는데 아직 제품 계약이 닫히지 않은 prop”를 추측하지 않는다. 생성기는 확정된 `unified.types.ts` + shared component API + renderer 경로를 전제로 동작한다.

**ADR-036과의 관계 — Spec이 4중 단일 소스로 확장:**

```
ComponentSpec (단일 소스)
  ├── shapes()        → Skia 캔버스 렌더링
  ├── variants/sizes  → CSS 자동 생성 (ADR-036)
  ├── properties      → 프로퍼티 에디터 자동 생성 (ADR-041)
  └── react/pixi      → DOM/PixiJS 속성
```

---

## Design

### PropertySchema 타입

```typescript
interface ComponentSpec<Props> {
  // ... 기존 (name, variants, sizes, states, render)
  properties?: PropertySchema;
}

interface PropertySchema {
  sections: SectionDef[];
}

interface SectionDef {
  title: string; // "Content", "Appearance", "State", "Locale" (S2 표준)
  fields: FieldDef[];
  visibleWhen?: VisibilityCondition; // 섹션 전체 조건부 표시
}

/** S2 기준 표준 섹션 타이틀 */
const SECTION_TITLES = {
  CONTENT: "Content", // customId, label, description, placeholder, children, icon
  APPEARANCE: "Appearance", // size, variant, fillStyle, orientation, density
  STATE: "State", // isDisabled, isReadOnly, isRequired, isInvalid, isSelected, defaultValue, autoFocus, selectionMode, name, validationBehavior, min/max
  LOCALE: "Locale", // locale, calendarSystem, hourCycle (조건부)
} as const;
```

> **Built-in CustomId**: GenericPropertyEditor는 첫 번째 "Content" 섹션 상단에 `PropertyCustomId`를 자동 삽입한다. Content 섹션이 없으면 자체 생성한다. `PropertyCustomId`의 placeholder는 `spec.name.toLowerCase() + "_1"` (예: `"button_1"`, `"badge_1"`)로 자동 생성한다.

### FieldDef 공통 속성

모든 FieldDef 타입은 아래 공통 속성을 상속한다:

```typescript
interface BaseFieldDef {
  key: string; // prop 키
  label?: string; // UI 레이블 (미지정 시 key에서 유추)
  icon?: LucideIcon; // Lucide 아이콘 컴포넌트 참조 (예: Type, PointerOff)
  visibleWhen?: VisibilityCondition;
  /** true 시 빈 문자열("")을 undefined로 변환하여 전달. 기본값: false.
   *  string/enum/number 등 여러 필드 타입에서 공통으로 사용. */
  emptyToUndefined?: boolean;
  /** 단일 값 업데이트가 아니라 여러 prop를 함께 갱신해야 할 때 사용.
   *  예: ColorField "Required" → isRequired + necessityIndicator 동시 갱신 */
  derivedUpdateFn?: (
    value: unknown,
    currentProps: Record<string, unknown>,
  ) => Record<string, unknown>;
}
```

> **icon 필드**: Spec은 이미 `shapes()` 함수를 포함하는 런타임 객체이므로, Lucide 컴포넌트를 직접 참조해도 문제 없다. 실제 에디터에서 사용하는 아이콘은 ~30종 미만이며, Spec에서 import하는 아이콘만 번들에 포함되어 tree-shaking이 보존된다. 문자열 기반 `resolveIcon()` 레지스트리는 불필요하다.
>
> **lucide-react 의존 추가 필수**: 현재 `packages/specs/package.json`에 `lucide-react` 의존이 없다. Phase 0에서 `peerDependencies`에 `lucide-react`를 추가해야 한다. `peerDependencies`로 지정하면 `apps/builder`의 기존 lucide-react를 공유하므로 번들 중복이 없다.

### FieldDef 유니온 타입

```typescript
type FieldDef =
  | VariantField
  | SizeField
  | BooleanField
  | EnumField
  | StringField
  | NumberField
  | IconField
  | CustomField
  | ChildrenManagerField;
// ChildSyncField → ADR-048 PropagationSpec으로 대체 (미구현 상태에서 직행 전환)

// variant — Spec.variants에서 옵션 자동 추출
interface VariantField extends Omit<BaseFieldDef, "key"> {
  type: "variant";
  key?: string; // 기본값: "variant" — 대부분의 에디터에서 동일하므로 생략 가능
}

// size — Spec.sizes에서 scale 자동 결정
interface SizeField extends Omit<BaseFieldDef, "key"> {
  type: "size";
  key?: string; // 기본값: "size" — 대부분의 에디터에서 동일하므로 생략 가능
}

// boolean — PropertySwitch
interface BooleanField extends BaseFieldDef {
  type: "boolean";
}

// enum — PropertySelect
interface EnumField extends BaseFieldDef {
  type: "enum";
  options: Array<{ value: string; label: string }>;
  /** 값 변환 함수명. "number" 시 선택값을 Number()로 변환. */
  valueTransform?: "number";
}

// string — PropertyInput
interface StringField extends BaseFieldDef {
  type: "string";
  placeholder?: string;
  multiline?: boolean;
}

// number — PropertyInput type="number"
interface NumberField extends BaseFieldDef {
  type: "number";
  min?: number;
  max?: number;
  step?: number;
}

// icon — PropertyIconPicker
interface IconField extends BaseFieldDef {
  type: "icon";
  /** clear 시 함께 undefined로 리셋할 추가 prop 키 목록 (예: ["iconPosition", "iconStrokeWidth"]) */
  clearKeys?: string[];
}

// custom — 수동 컴포넌트 직접 참조 (문자열 레지스트리 불필요)
interface CustomField extends BaseFieldDef {
  type: "custom";
  /** React 컴포넌트 직접 참조. Spec은 런타임 객체이므로 icon과 동일하게 직접 import 가능.
   *  전수 조사에서 커스텀 위젯 사용이 0개이므로 당장 사용되지 않으나, 확장 시 타입 안전성 보장. */
  component: React.ComponentType<CustomFieldComponentProps>;
}

// ⚠️ childSync — ADR-048 PropagationSpec으로 대체됨 (Superseded)
// 미구현 상태에서 직행 전환. 부모→자식 prop 전파는 propagationRegistry.ts에서 선언적으로 처리.
// interface ChildSyncField { ... } → 삭제됨

// children-manager — 자식 항목 CRUD 관리 (ListBox, Select, TagGroup, Breadcrumbs 등)
interface ChildrenManagerField {
  type: "children-manager";
  childTag: string; // 관리 대상 자식 태그 (예: "ListBoxItem", "MenuItem")
  fields: FieldDef[]; // 각 자식 항목의 편집 필드
}

// custom 필드 컴포넌트 Props
interface CustomFieldComponentProps {
  value: unknown;
  onChange: (value: unknown) => void;
  fieldDef: CustomField;
}

// 파생 값 계산 함수 타입
interface DerivedUpdateContext {
  parentProps: Record<string, unknown>;
  value: unknown;
  elementId: string;
  /** Store의 childrenMap — Record<string, Element[]> 형태 (Store 실제 타입과 일치) */
  childrenMap: Record<string, Element[]>;
  /** Store의 elementsMap — Record<string, Element> 형태 (Store 실제 타입과 일치) */
  elementsMap: Record<string, Element>;
}

/** ChildUpdate 확장 — deep merge 지원 */
interface ChildUpdate {
  childTag: string;
  propKey: string;
  value: unknown;
  /** "shallow": 1-depth 병합 (기본값). "deep": 중첩 객체 재귀 병합. */
  merge?: "shallow" | "deep";
}

type DerivedUpdateFn = (context: DerivedUpdateContext) => ChildUpdate[];

// 조건부 표시
interface VisibilityCondition {
  /** 참조할 prop 키. props 기반 조건(isNotEmpty/equals/notEquals/oneOf) 사용 시 필수.
   *  parentTag/parentTagNot 단독 사용 시 생략 가능. */
  key?: string;
  isNotEmpty?: boolean; // truthy 체크 (key 필수)
  equals?: unknown; // 특정 값 비교 (key 필수)
  notEquals?: unknown; // (key 필수)
  /** OR 조건: 배열 내 값 중 하나와 일치하면 표시. (key 필수)
   *  예: ButtonEditor Form 섹션 — `{ key: "type", oneOf: ["submit", "reset"] }` */
  oneOf?: unknown[];
  /** 부모 태그 기반 조건. 지정 시 부모의 tag가 일치할 때만 표시.
   *  예: CheckboxEditor — 부모가 CheckboxGroup이면 Design 섹션 숨김.
   *  `parentTagNot: "CheckboxGroup"` → 부모가 CheckboxGroup이 아닐 때만 표시.
   *
   *  **Store 접근 필요**: parentTag/parentTagNot 평가 시 elementsMap에서 부모 조회가 필요하므로,
   *  evaluateVisibility()는 내부에서 useStore.getState()를 호출한다.
   *  React 렌더 함수 내에서 호출하는 것은 안전하지만, 이 함수는 순수 함수가 아님에 유의. */
  parentTag?: string;
  parentTagNot?: string;
}
```

### derivedUpdateFn — Spec 내 함수 직접 참조

`ChildSyncField.childSync.derivedUpdateFn`은 **Spec 내에서 함수를 직접 참조**한다. Spec은 `shapes()` 등 런타임 함수를 이미 포함하는 객체이므로, 문자열 레지스트리 없이 함수를 직접 포함할 수 있다. 이로써 `registerDerivedUpdate` 인프라가 불필요하며, 타입 안전성이 보장된다.

```typescript
// DerivedUpdateFn, DerivedUpdateContext, ChildUpdate 타입은 위 FieldDef 유니온 타입 섹션에서 정의

// 예시: TextField size → Label fontSize + Input size 동기화
// TextFieldSpec 내부에서 직접 정의
const textFieldSizeSync: DerivedUpdateFn = (ctx) => {
  const LABEL_FONT_SIZE: Record<string, number> = { sm: 12, md: 14, lg: 16 };
  return [
    {
      childTag: "Label",
      propKey: "style",
      value: { fontSize: LABEL_FONT_SIZE[ctx.value as string] ?? 14 },
      merge: "shallow",
    },
    {
      childTag: "Input",
      propKey: "size",
      value: ctx.value,
    },
  ];
};

// TextFieldSpec.properties에서 사용:
// { key: "size", type: "childSync", uiType: "size",
//   childSync: { path: ["Input"], propKey: "size", derivedUpdateFn: textFieldSizeSync } }
```

### 적용 예시: ButtonSpec

> **실제 ButtonEditor 섹션 구조 미러링**: Content, Design, Icon, Behavior, Link, Form 6개 섹션.
> Form 섹션은 `oneOf` 조건 사용 (`type === "submit" || type === "reset"`).

```typescript
export const ButtonSpec: ComponentSpec<ButtonProps> = {
  name: "Button",
  variants: { accent: {...}, primary: {...}, secondary: {...}, negative: {...} },
  sizes: { xs: {...}, sm: {...}, md: {...}, lg: {...}, xl: {...} },
  // ...

  properties: {
    sections: [
      {
        title: "Content",
        fields: [
          { key: "children", type: "string", label: "Text", placeholder: "Button text" },
        ],
      },
      {
        title: "Appearance",
        fields: [
          { type: "variant" },
          { key: "fillStyle", type: "enum", label: "Fill Style",
            options: [{ value: "fill", label: "Fill" }, { value: "outline", label: "Outline" }] },
          { type: "size" },
        ],
      },
      {
        title: "Icon",
        fields: [
          { key: "iconName", type: "icon", clearKeys: ["iconPosition", "iconStrokeWidth"] },
          { key: "iconPosition", type: "enum", label: "Position",
            options: [{ value: "start", label: "Start" }, { value: "end", label: "End" }],
            visibleWhen: { key: "iconName", isNotEmpty: true } },
          { key: "iconStrokeWidth", type: "number", label: "Stroke Width",
            min: 0.5, max: 4, step: 0.5,
            visibleWhen: { key: "iconName", isNotEmpty: true } },
        ],
      },
      {
        title: "State",
        fields: [
          { key: "type", type: "enum", label: "Type",
            options: [
              { value: "button", label: "Button" },
              { value: "submit", label: "Submit" },
              { value: "reset", label: "Reset" },
            ] },
          { key: "autoFocus", type: "boolean", label: "Auto Focus" },
          { key: "isPending", type: "boolean", label: "Loading" },
          { key: "isDisabled", type: "boolean", label: "Disabled" },
        ],
      },
      {
        title: "Link",
        fields: [
          { key: "href", type: "string", label: "URL", placeholder: "https://..." },
          { key: "target", type: "enum", label: "Target",
            options: [{ value: "_self", label: "Self" }, { value: "_blank", label: "Blank" }],
            visibleWhen: { key: "href", isNotEmpty: true } },
          { key: "rel", type: "string", label: "Rel",
            visibleWhen: { key: "href", isNotEmpty: true } },
        ],
      },
      {
        title: "Form",
        // oneOf: submit 또는 reset일 때만 Form 섹션 표시
        visibleWhen: { key: "type", oneOf: ["submit", "reset"] },
        fields: [
          { key: "form", type: "string", label: "Form", emptyToUndefined: true },
          { key: "name", type: "string", label: "Name", emptyToUndefined: true },
          { key: "value", type: "string", label: "Value", emptyToUndefined: true },
          { key: "formAction", type: "string", label: "Form Action",
            visibleWhen: { key: "type", equals: "submit" } },
          { key: "formMethod", type: "enum", label: "Form Method",
            options: [{ value: "get", label: "GET" }, { value: "post", label: "POST" }],
            visibleWhen: { key: "type", equals: "submit" } },
          { key: "formNoValidate", type: "boolean", label: "No Validate",
            visibleWhen: { key: "type", equals: "submit" } },
          { key: "formTarget", type: "enum", label: "Form Target",
            options: [{ value: "_self", label: "Self" }, { value: "_blank", label: "Blank" }],
            visibleWhen: { key: "type", equals: "submit" } },
        ],
      },
    ],
  },
};
```

### 적용 예시: SwitchSpec (childSync)

> **실제 SwitchEditor 섹션 구조 미러링**: State(isSelected/isRequired/isInvalid) + Behavior(autoFocus/isDisabled/isReadOnly) 분리.

```typescript
export const SwitchSpec: ComponentSpec<SwitchProps> = {
  // ...
  properties: {
    sections: [
      {
        title: "Content",
        fields: [
          {
            key: "children",
            type: "childSync",
            label: "Label",
            childSync: { path: ["Label"], propKey: "children" },
          },
        ],
      },
      {
        title: "Appearance",
        fields: [
          { key: "isEmphasized", type: "boolean", label: "Emphasized" },
          { type: "size" }, // key 생략 → 기본값 "size"
        ],
      },
      {
        title: "State",
        fields: [
          { key: "isSelected", type: "boolean", label: "Selected" },
          { key: "isRequired", type: "boolean", label: "Required" },
          { key: "isInvalid", type: "boolean", label: "Invalid" },
        ],
      },
      {
        title: "State",
        fields: [
          { key: "autoFocus", type: "boolean", label: "Auto Focus" },
          { key: "isDisabled", type: "boolean", label: "Disabled" },
          { key: "isReadOnly", type: "boolean", label: "Read Only" },
        ],
      },
      {
        title: "State",
        fields: [
          {
            key: "name",
            type: "string",
            label: "Name",
            emptyToUndefined: true,
          },
          {
            key: "value",
            type: "string",
            label: "Value",
            emptyToUndefined: true,
          },
          {
            key: "form",
            type: "string",
            label: "Form ID",
            emptyToUndefined: true,
          },
        ],
      },
    ],
  },
};
```

### GenericPropertyEditor 구현

```typescript
/** VariantField/SizeField의 key 기본값 해석 */
function resolveFieldKey(field: FieldDef): string {
  if ('key' in field && field.key) return field.key;
  if (field.type === "variant") return "variant";
  if (field.type === "size") return "size";
  throw new Error(`FieldDef requires 'key' for type "${field.type}"`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Spec의 Props 제네릭은 에디터에서 사용하지 않음
interface GenericPropertyEditorProps extends PropertyEditorProps {
  spec: ComponentSpec<Record<string, unknown>>;
  /** 하이브리드 패턴: 수동 섹션 제외.
   *  오타 방지는 Spec 정의 시 sections 배열에서 title을 상수로 추출하여 활용.
   *  예: const SECTION_TITLES = ["Content", "Appearance", "State"] as const;
   *      excludeSections={["Content"]} */
  excludeSections?: string[];
}

function GenericPropertyEditor({
  elementId, currentProps, onUpdate, spec, excludeSections,
}: GenericPropertyEditorProps) {
  const { buildChildUpdates } = useSyncChildProp(elementId);
  const { buildGrandchildUpdates } = useSyncGrandchildProp(elementId);

  // currentProps를 ref로 캡처 — handleFieldChange의 deps에서 제거하여 핸들러 안정성 보장
  const currentPropsRef = useRef(currentProps);
  currentPropsRef.current = currentProps;

  const handleFieldChange = useCallback((field: FieldDef, value: unknown) => {
    // emptyToUndefined 처리
    const finalValue = (field.emptyToUndefined && value === "")
      ? undefined : value;

    // valueTransform 처리
    const transformedValue = ('valueTransform' in field && field.valueTransform === "number")
      ? (finalValue != null ? Number(finalValue) : undefined) : finalValue;

    const resolvedKey = resolveFieldKey(field);
    const updatedProps: Record<string, unknown> = { [resolvedKey]: transformedValue };

    // icon clearKeys 처리
    if (field.type === "icon" && transformedValue === undefined && field.clearKeys) {
      for (const clearKey of field.clearKeys) {
        updatedProps[clearKey] = undefined;
      }
    }

    // childSync 처리 (childSync는 ChildSyncField의 required 프로퍼티)
    if (field.type === "childSync") {
      const { path, propKey, derivedUpdateFn, fallbackToDirectChild } = field.childSync;
      const isDeep = path.length > 1;

      // 1단계: path 기반 직계/손자 자식 업데이트 생성
      let batchUpdates: BatchPropsUpdate[];
      if (isDeep) {
        batchUpdates = buildGrandchildUpdates([{
          parentTag: path[0],
          childTag: path[path.length - 1],
          propKey,
          value: String(transformedValue ?? ""),
        }]);
        // fallbackToDirectChild: wrapper가 없으면 직계 자식에서 직접 찾기
        if (batchUpdates.length === 0 && fallbackToDirectChild) {
          batchUpdates = buildChildUpdates([{
            childTag: path[path.length - 1],
            propKey,
            value: String(transformedValue ?? ""),
          }]);
        }
      } else {
        batchUpdates = buildChildUpdates([{
          childTag: path[0],
          propKey,
          value: String(transformedValue ?? ""),
        }]);
      }

      // 2단계: derivedUpdateFn → ChildUpdate[] → BatchPropsUpdate[] 변환
      // currentPropsRef로 최신 props 참조 (stale closure 방지)
      if (derivedUpdateFn) {
        const { elementsMap, childrenMap } = useStore.getState();
        const derivedChildUpdates = derivedUpdateFn({
          parentProps: currentPropsRef.current,
          value: transformedValue,
          elementId,
          childrenMap,
          elementsMap,
        });
        // ChildUpdate → BatchPropsUpdate 변환 (resolveChildUpdates)
        batchUpdates.push(
          ...resolveChildUpdates(derivedChildUpdates, elementId, childrenMap, elementsMap)
        );
      }

      useStore.getState().updateSelectedPropertiesWithChildren(updatedProps, batchUpdates);
    } else {
      onUpdate(updatedProps);
    }
  }, [onUpdate, buildChildUpdates, buildGrandchildUpdates, elementId]);

  // --- 성능 최적화: 필드별 onChange 핸들러 캐싱 ---
  // **재생성 조건**: spec 변경(모듈 상수이므로 사실상 없음) 또는 handleFieldChange 변경
  // (elementId 변경 시 발생 — 다른 요소 선택). 동일 요소 내 prop 변경만으로는 재생성 안 됨.
  const fieldHandlers = useMemo(() => {
    const map = new Map<string, (v: unknown) => void>();
    for (const section of spec.properties!.sections) {
      for (const field of section.fields) {
        // VariantField/SizeField는 key 생략 가능 → 기본값 적용
        const resolvedKey = resolveFieldKey(field);
        map.set(resolvedKey, (v: unknown) => handleFieldChange(field, v));
      }
    }
    return map;
  }, [spec, handleFieldChange]);

  // excludeSections 필터링
  const visibleSections = useMemo(() => {
    const excluded = new Set(excludeSections);
    return spec.properties!.sections
      .filter(s => !excluded.has(s.title));
  }, [spec, excludeSections]);

  return (
    <>
      {/* CustomId는 첫 번째 Content 섹션 상단에 자동 삽입 */}

      {/* Schema 기반 섹션 렌더링 — 섹션별 memo로 격리 */}
      {visibleSections
        .filter(section => evaluateVisibility(section.visibleWhen, currentProps, elementId))
        .map(section => (
          <MemoizedSection
            key={section.title}
            section={section}
            spec={spec}
            currentProps={currentProps}
            fieldHandlers={fieldHandlers}
            elementId={elementId}
          />
        ))}
    </>
  );
}
```

### MemoizedSection (성능 격리)

각 섹션을 `memo`로 격리하여, **variant 변경 시 Behavior 섹션이 리렌더되지 않도록** 한다.

```typescript
const MemoizedSection = memo(function MemoizedSection({
  section, spec, currentProps, fieldHandlers, elementId,
}: MemoizedSectionProps) {
  return (
    <PropertySection title={section.title}>
      {section.fields
        .filter(field => evaluateVisibility(field.visibleWhen, currentProps, elementId))
        .map(field => {
          const key = resolveFieldKey(field);
          return (
            <SpecField
              key={key}
              field={field}
              spec={spec}
              value={currentProps[key]}
              onChange={fieldHandlers.get(key)!}
            />
          );
        })}
    </PropertySection>
  );
}, (prev, next) => {
  // 섹션의 관련 필드 값 + visibleWhen 참조 키 비교 — 다른 섹션 변경에 무반응
  return prev.section === next.section
    && prev.spec === next.spec
    && prev.fieldHandlers === next.fieldHandlers
    && prev.elementId === next.elementId
    && collectRelevantKeys(prev.section).every(key =>
      prev.currentProps[key] === next.currentProps[key]
    );
});

/** 섹션의 필드 값 키 + visibleWhen이 참조하는 키를 모두 수집.
 *  섹션 경계를 넘는 visibleWhen(예: Form 섹션이 Behavior의 "type"에 의존)도 감지. */
function collectRelevantKeys(section: SectionDef): string[] {
  const keys = new Set<string>();
  // 섹션 자체의 visibleWhen 키
  if (section.visibleWhen?.key) keys.add(section.visibleWhen.key);
  for (const field of section.fields) {
    // 필드 값 키
    keys.add(resolveFieldKey(field));
    // 필드의 visibleWhen이 참조하는 키 (다른 섹션의 prop일 수 있음)
    if (field.visibleWhen?.key) keys.add(field.visibleWhen.key);
  }
  return [...keys];
}
```

> **성능 보장**: `handleFieldChange`의 deps에서 `currentProps`를 제거하고 `currentPropsRef`로 대체. 이로써 `fieldHandlers` Map은 `spec` + `elementId` 변경 시에만 재생성되며, `MemoizedSection`의 커스텀 비교에서 `fieldHandlers` 참조가 안정적으로 유지된다. 커스텀 비교는 `collectRelevantKeys()`로 필드 값 키 + visibleWhen 참조 키를 모두 수집하여, 섹션 경계를 넘는 visibleWhen 조건도 올바르게 감지한다. 기존 에디터의 (1) 개별 `useCallback` + (2) 섹션별 `useMemo`와 동등한 최적화를 달성한다. Gate G5("리렌더 횟수 ≤ 기존 에디터") 통과 가능.

### SpecField 렌더링

```typescript
const SpecField = memo(function SpecField({ field, spec, value, onChange }: SpecFieldProps) {
  // field.icon은 LucideIcon 컴포넌트 직접 참조 — 별도 해석 불필요

  switch (field.type) {
    case "variant":
      return (
        <PropertySelect
          label={field.label ?? "Variant"}
          icon={field.icon}
          value={String(value ?? spec.defaultVariant)}
          onChange={onChange}
          options={Object.keys(spec.variants).map(k => ({ value: k, label: capitalize(k) }))}
        />
      );

    case "size": {
      const sizeKeys = Object.keys(spec.sizes);
      return (
        <PropertySizeToggle
          label={field.label ?? "Size"}
          value={String(value ?? spec.defaultSize)}
          onChange={onChange}
          scale={String(sizeKeys.length) as "3" | "5"}
          options={sizeKeys.map(k => ({ id: k, label: k.toUpperCase() }))}
        />
      );
    }

    case "boolean":
      return (
        <PropertySwitch
          label={field.label ?? inferLabel(field.key)}
          icon={field.icon}
          isSelected={Boolean(value)}
          onChange={onChange}
        />
      );

    case "enum":
      return (
        <PropertySelect
          label={field.label ?? inferLabel(field.key)}
          icon={field.icon}
          value={String(value ?? field.options[0]?.value)}
          onChange={onChange}
          options={field.options}
        />
      );

    case "string":
      return (
        <PropertyInput
          label={field.label ?? inferLabel(field.key)}
          icon={field.icon}
          value={String(value ?? "")}
          onChange={onChange}
          placeholder={field.placeholder}
          multiline={field.multiline}
        />
      );

    case "childSync": {
      // childSync는 UI 상으로는 string(PropertyInput) 또는 size(PropertySizeToggle)
      // 값 변환/자식 동기화는 handleFieldChange에서 처리
      if (field.uiType === "size") {
        const sizeKeys = Object.keys(spec.sizes);
        return (
          <PropertySizeToggle
            label={field.label ?? "Size"}
            value={String(value ?? spec.defaultSize)}
            onChange={onChange}
            scale={String(sizeKeys.length) as "3" | "5"}
            options={sizeKeys.map(k => ({ id: k, label: k.toUpperCase() }))}
          />
        );
      }
      return (
        <PropertyInput
          label={field.label ?? inferLabel(field.key)}
          icon={field.icon}
          value={String(value ?? "")}
          onChange={onChange}
          placeholder={field.placeholder}
          multiline={field.multiline}
        />
      );
    }

    case "number":
      return (
        <PropertyInput
          label={field.label ?? inferLabel(field.key)}
          icon={field.icon}
          value={value ?? field.min ?? 0}
          onChange={(v) => onChange(Number(v))}
          type="number"
          min={field.min}
          max={field.max}
          step={field.step}
        />
      );

    case "icon":
      // onClear는 단순히 onChange(undefined)만 호출.
      // clearKeys 처리는 handleFieldChange에서 field.type === "icon" && value === undefined 분기가 담당.
      // onClear에서 별도 reset 객체를 만들면 이중 처리됨.
      return (
        <PropertyIconPicker
          label={field.label ?? "Icon"}
          value={value}
          onChange={onChange}
          onClear={() => onChange(undefined)}
        />
      );

    case "custom":
      // field.component는 React.ComponentType 직접 참조 — 레지스트리 조회 불필요
      return <CustomFieldRenderer component={field.component} value={value} onChange={onChange} fieldDef={field} />;
  }
});
```

### resolveChildUpdates — ChildUpdate → BatchPropsUpdate 변환

`derivedUpdateFn`이 반환하는 `ChildUpdate[]`는 `childTag` 기반이지만, `updateSelectedPropertiesWithChildren`은 `BatchPropsUpdate[]`(`elementId` 기반)을 받는다. 이 변환 유틸이 gap을 연결한다.

```typescript
/** ChildUpdate(childTag 기반) → BatchPropsUpdate(elementId 기반) 변환.
 *  childrenMap에서 childTag로 자식을 찾고, propKey/value를 기존 props에 merge. */
function resolveChildUpdates(
  childUpdates: ChildUpdate[],
  parentElementId: string,
  childrenMap: Record<string, Element[]>,
  elementsMap: Record<string, Element>,
): BatchPropsUpdate[] {
  const children = childrenMap[parentElementId];
  if (!children) return [];

  const results: BatchPropsUpdate[] = [];
  for (const update of childUpdates) {
    const child = children.find((c) => c.tag === update.childTag);
    if (!child) continue;

    let mergedProps: Record<string, unknown>;
    if (update.merge === "deep") {
      // deep merge: 중첩 객체 재귀 병합 (style 객체 등)
      const existing = elementsMap[child.id]?.props ?? {};
      mergedProps = {
        ...existing,
        [update.propKey]: deepMerge(
          (existing as Record<string, unknown>)[update.propKey],
          update.value,
        ),
      };
    } else {
      // shallow (기본값): 1-depth 병합
      const existing = elementsMap[child.id]?.props ?? {};
      mergedProps = { ...existing, [update.propKey]: update.value };
    }

    results.push({
      elementId: child.id,
      props: mergedProps as ComponentElementProps,
    });
  }
  return results;
}
```

### inferLabel — key에서 UI 레이블 자동 생성

```typescript
/** prop key에서 사람이 읽을 수 있는 레이블 생성.
 *  "isDisabled" → "Disabled", "fillStyle" → "Fill Style",
 *  "autoFocus" → "Auto Focus", "href" → "Href" */
function inferLabel(key: string): string {
  // "is" 접두사 제거 (isDisabled → Disabled)
  const stripped =
    key.startsWith("is") && key.length > 2 && key[2] === key[2].toUpperCase()
      ? key.slice(2)
      : key;
  // camelCase → "Title Case With Spaces"
  return stripped
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}
```

### TAG_SPEC_MAP 공유 (선행 작업)

현재 `TAG_SPEC_MAP`과 `getSpecForTag()`는 `ElementSprite.tsx` 내부 모듈 스코프 함수이다. registry.ts에서 사용하려면 공유 모듈로 분리해야 한다.

```typescript
// apps/builder/src/builder/workspace/canvas/sprites/specRegistry.ts (신규)
import { ButtonSpec, BadgeSpec, ... } from "@composition/specs";
import type { ComponentSpec } from "@composition/specs";

/** tag → ComponentSpec 매핑. ElementSprite + registry 양쪽에서 사용. */
export const TAG_SPEC_MAP: Record<string, ComponentSpec<Record<string, unknown>>> = {
  Button: ButtonSpec,
  // ... 기존 ElementSprite.tsx의 TAG_SPEC_MAP 이동
};

export function getSpecForTag(tag: string): ComponentSpec<Record<string, unknown>> | null {
  return TAG_SPEC_MAP[tag] ?? null;
}
```

`ElementSprite.tsx`의 기존 `TAG_SPEC_MAP`은 `specRegistry.ts`에서 import로 대체한다.

### 에디터 레지스트리 변경

```typescript
// registry.ts — 최종 형태 (Spec properties 우선, 등급 C는 기존 에디터 폴백)
import { getSpecForTag } from "../workspace/canvas/sprites/specRegistry";

export async function getEditor(type: string) {
  // 1단계: Spec.properties 확인 → GenericPropertyEditor (등급 A/B)
  const spec = getSpecForTag(type);
  if (spec?.properties) {
    return (props: PropertyEditorProps) => (
      <GenericPropertyEditor {...props} spec={spec} />
    );
  }

  // 2단계: 기존 커스텀 에디터 (lazy import, 등급 C)
  const metadata = getComponentMeta(type);
  if (metadata?.inspector.hasCustomEditor) {
    return importEditor(metadata.inspector.editorName);
  }

  return null;
}
```

---

## Gates

| 게이트 | 조건                                                                                      | 위험 등급 |
| ------ | ----------------------------------------------------------------------------------------- | --------- |
| G0     | PropertySchema 타입 추가 후 `pnpm type-check` 통과                                        | L         |
| G1     | ButtonSpec에 properties 추가 → GenericPropertyEditor 렌더링 → 기존 ButtonEditor와 동일 UI | M         |
| G2     | 등급 A (단순 에디터) 10개 전환 후 기능 동일 확인                                          | M         |
| G3a    | 단순 childSync: SwitchSpec properties → Label 자식 동기화 정상                            | M         |
| G3b    | derivedUpdateFn: TextFieldSpec size 변경 → Label fontSize + Input size 동시 갱신 정상     | H         |
| G3c    | 2-depth childSync: CardSpec → CardHeader/Heading 동기화 + fallbackToDirectChild 정상      | H         |
| G4     | visibleWhen: iconPosition이 iconName 존재 시에만 표시 + parentTagNot + oneOf 조건 동작    | L         |
| G5     | 성능: GenericPropertyEditor의 리렌더 횟수 ≤ 기존 에디터 (currentPropsRef 패턴 검증)       | M         |

---

## Implementation

### Phase 0-pre: 103개 에디터 전수 조사 (코드베이스 실측 2026-03-16)

에디터 디렉토리 전수 조사 결과, **103개** 에디터 파일이 존재하며 아래와 같이 분류된다.

**등급 분류 요약**:

|     등급     |  개수  | 비율  | 조건                                                                     |                 전환 대상                 |
| :----------: | :----: | :---: | ------------------------------------------------------------------------ | :---------------------------------------: |
| **A (단순)** | **75** | 72.8% | Select/Switch/Input/Size/Icon + parentTagNot 조건만 사용, childSync 없음 |         ✅ GenericPropertyEditor          |
| **B (중간)** | **8**  | 7.8%  | childSync(부모→자식 동기화) 또는 복합 visibleWhen (컬렉션 관리 없음)     | ✅ GenericPropertyEditor + ChildSyncField |
| **C (복잡)** | **20** | 19.4% | Collection 동적 관리, DataBinding, 중첩 객체 프로퍼티, Table 특수 UI     |               ❌ 수동 유지                |

> **등급 A에 parentTagNot 포함 근거**: CheckboxEditor/RadioEditor/ToggleButtonEditor는 부모 태그 기반으로 섹션을 숨기는 패턴만 사용하며, 이는 `VisibilityCondition.parentTagNot`으로 완전히 표현 가능하다. childSync나 컬렉션 관리가 없으므로 등급 A에 잔류한다.

**등급 B 대상 (8개 — childSync 또는 복합 visibleWhen)**:

| 에디터                | 줄수 | 전환 근거                                                            |
| --------------------- | :--: | -------------------------------------------------------------------- |
| ButtonEditor.tsx      | 544  | 복합 visibleWhen (Icon/Link/Form 섹션 조건부)                        |
| CardEditor.tsx        | 541  | childSync: CardHeader → Heading, Description                         |
| TextFieldEditor.tsx   | 539  | childSync + derivedUpdateFn: Label, Description, ErrorMessage, Input |
| CheckboxEditor.tsx    | 352  | childSync: Label                                                     |
| SwitchEditor.tsx      | 325  | childSync: Label                                                     |
| SliderEditor.tsx      | 247  | childSync: Label                                                     |
| SearchFieldEditor.tsx | 203  | childSync: Label, Description, Input placeholder                     |
| RadioEditor.tsx       | 124  | childSync: Label                                                     |

> **ButtonEditor 재분류 근거**: 컬렉션 관리/DataBinding 없음. Icon + Link + Form 속성은 모두 PropertyInput/Select/Switch/IconPicker + visibleWhen 조합으로 표현 가능하며, FieldDef의 기존 타입으로 완전히 커버된다.
>
> **NumberFieldEditor → 등급 C 재분류 근거**: `formatOptions` 중첩 객체 프로퍼티를 `updateFormatOption()` 헬퍼로 개별 키 갱신하며, `formatStyle` 값에 따라 currency/unit 필드가 조건부 표시되는 등 FieldDef로 표현 불가능한 중첩 객체 패턴을 사용한다.

**등급 C 대상 (20개 — 수동 유지)**:

| 에디터                      | 줄수 | 수동 유지 이유                      |
| --------------------------- | :--: | ----------------------------------- |
| TableEditor.tsx             | 832  | 행/열 동적 추가/삭제, DataBinding   |
| ListBoxEditor.tsx           | 788  | ListBoxItem 컬렉션 관리             |
| SelectEditor.tsx            | 703  | SelectItem 컬렉션 + DataBinding     |
| ComboBoxEditor.tsx          | 685  | ComboBoxItem 컬렉션 + DataBinding   |
| RadioGroupEditor.tsx        | 604  | Radio 옵션 동적 관리                |
| NumberFieldEditor.tsx       | 299  | formatOptions 중첩 객체 + 조건부 UI |
| TagGroupEditor.tsx          | 469  | Tag 항목 동적 관리                  |
| TabsEditor.tsx              | 467  | Tab panel 동적 관리                 |
| CheckboxGroupEditor.tsx     | 444  | Checkbox 항목 동적 관리             |
| GridListEditor.tsx          | 433  | GridListItem + DataBinding          |
| ToggleButtonGroupEditor.tsx | 425  | ToggleButton 항목 관리              |
| TableHeaderEditor.tsx       | 358  | Table header 컬럼 정의              |
| ListBoxItemEditor.tsx       | 303  | ListBoxItem 세부 속성               |
| TreeEditor.tsx              | 253  | Tree 재귀 구조 관리                 |
| TreeItemEditor.tsx          | 189  | TreeItem 세부 속성                  |
| SlotEditor.tsx              | 175  | 복합 상태 로직                      |
| ColumnEditor.tsx            | 164  | Table 컬럼 정의                     |
| TableBodyEditor.tsx         | 155  | Table body 관리                     |
| RowEditor.tsx               | 145  | Table row 관리                      |
| CellEditor.tsx              | 130  | Table cell 관리                     |

### Phase 의존성 그래프

```
Phase 0-pre (103개 에디터 전수 조사)  [완료]
  ↓
Phase 0 (PropertySchema 타입 정의)  [Gate G0]
  ↓
Phase 1 (GenericPropertyEditor + SpecField + CustomFieldRenderer)  [Gate G1]
  ↓
Phase 2 (등급 A 에디터 전환 — 75개)  [Gate G2]
  ↓
Phase 3 (등급 B 에디터 전환 — childSync/visibleWhen 8개)  [Gate G3a, G3b, G3c, G4]
  ↓
Phase 4 (기존 에디터 파일 정리 + 롤백 체계)  [Gate G5]
```

### Phase 0: PropertySchema 타입 정의 + 선행 인프라

**타입 정의**:

- `packages/specs/src/types/spec.types.ts`에 PropertySchema, SectionDef, FieldDef 타입 추가
- ComponentSpec 인터페이스에 `properties?: PropertySchema` 필드 추가
- `packages/specs/package.json`에 `peerDependencies: { "lucide-react": "*" }` 추가 (icon 필드용)

**선행 인프라** (Phase 1 구현 전 필수):

- `specRegistry.ts` 신규: `TAG_SPEC_MAP` + `getSpecForTag()` — `ElementSprite.tsx`에서 분리하여 공유
- `useSyncGrandchildProp` 훅 확장: `fallbackToDirectChild` 옵션 추가 (CardEditor 2-depth 지원)
  - 기존 인터페이스 `GrandchildPropSync`에 `fallbackToDirectChild?: boolean` 필드 추가
  - wrapper(parentTag)가 없을 때 직계 자식에서 childTag 직접 탐색하는 분기 추가
- `resolveChildUpdates` 유틸 신규: `ChildUpdate[]` → `BatchPropsUpdate[]` 변환 (derivedUpdateFn용)
- `inferLabel` 유틸 신규: prop key → UI 레이블 자동 생성
- `evaluateVisibility`에 `oneOf` 조건 평가 추가

### Phase 1: GenericPropertyEditor 구현

- `GenericPropertyEditor.tsx` — schema 기반 동적 렌더링
- `SpecField.tsx` — 필드 타입별 UI 매핑 (variant, size, boolean, enum, string, number, icon)
- `evaluateVisibility()` — 조건부 표시 평가 (props 기반 + parentTag/parentTagNot/oneOf 기반)
- `CustomFieldRenderer.tsx` — 커스텀 위젯 직접 렌더링 (컴포넌트 참조 기반, 레지스트리 불필요)
- `collectRelevantKeys()` — MemoizedSection 비교용 키 수집 (필드 값 + visibleWhen 참조 키)
- 성능 최적화: 필드별 onChange를 useCallback으로 메모이제이션

### Phase 2: 등급 A 에디터 전환 (75개)

variant + size + boolean + enum + string만으로 구성된 단순 에디터를 우선 전환.

#### 1차 자동 생성 대상 묶음

1차는 **ADR-046으로 계약이 닫힌 항목 + 등급 A 단순 에디터**만 포함한다. 기준은 다음과 같다.

- `Spec.properties`만으로 표현 가능할 것
- 컬렉션 관리가 없을 것
- childSync가 없을 것
- 복합 UI 모드 전환이 없을 것
- 현재 계약이 `unified.types.ts` + shared component API + renderer 경로에서 이미 닫혀 있을 것

**1차 대상 (12개)**:

- `Form`
- `ColorField`
- `Dialog`
- `Popover`
- `Toast`
- `Tooltip`
- `Link`
- `Badge`
- `Separator`
- `StatusLight`
- `Meter`
- `ProgressBar`

**1차 배치 순서**:

1. 배치 1
   - `Badge`
   - `Separator`
   - `StatusLight`
   - `Meter`
   - `ProgressBar`
2. 배치 2
   - `Link`
   - `Tooltip`
   - `Dialog`
   - `Popover`
   - `Toast`
3. 배치 3
   - `Form`
   - `ColorField`

**배치 기준**:

- 배치 1: 가장 단순한 leaf 에디터
- 배치 2: overlay/interaction 성격이 있지만 컬렉션/childSync가 없는 에디터
- 배치 3: ADR-046 확정 계약을 직접 소비하는 에디터

**선정 이유**:

- `Form`, `ColorField`는 ADR-046에서 자동 생성 입력 계약이 확정됐다.
- 나머지 10개는 등급 A이며 컬렉션/childSync 없이 `variant`, `size`, `boolean`, `enum`, `string` 조합으로 닫힌다.
- 모두 개별 leaf 성격이 강해서 전환 실패 시 registry 분기만 되돌리면 즉시 롤백 가능하다.

**1차 제외 항목**:

- `Tabs`
  - ADR-046에서 `density` 계약은 닫혔지만, 에디터 자체는 tab/panel 동적 관리가 있어 등급 C다.
- `Button`
  - 등급 B이며 `Icon`/`Link`/`Form` 섹션의 복합 visibleWhen이 있다.
- `TextField`, `SearchField`
  - 등급 B이며 childSync가 필요하다.
- `NumberField`
  - 중첩 `formatOptions` 객체 때문에 등급 C다.

**1차 완료 기준**:

- 위 12개 컴포넌트에 `Spec.properties` 추가
- registry에서 GenericPropertyEditor 경로로 전환
- 기존 수동 에디터와 동작/노출 surface가 동일함을 확인
- ADR-046에서 닫은 계약(`Form`, `ColorField`)이 손실 없이 자동 생성 경로로 표현됨을 확인

**2026-03-28 현재 상태 — Phase 0~4 전체 완료**:

- Phase 2 확장 완료
  - 69개 컴포넌트 Spec에 `properties` 추가, specRegistry 69개 등록
  - 등급 A 순수 generic (afterSections 없음): Avatar, AvatarGroup, ButtonGroup, CardView, ColorArea, ColorPicker, ColorSlider, ColorSwatch, ColorSwatchPicker, ColorWheel, Disclosure, DisclosureGroup, DropZone, FileTrigger, Group, IllustratedMessage, Image, Nav, ProgressCircle, Toolbar, Calendar, RangeCalendar, DateField, DatePicker, DateRangePicker, TimeField, ToggleButton, ToggleButtonGroup, InlineAlert, Panel, TextArea, Icon, Badge, Separator, StatusLight, Meter, ProgressBar, Link, Tooltip, Dialog, Popover, Toast, Form, ColorField
  - parentTagNot 조건부: Checkbox (CheckboxGroup 내 Design 숨김), ToggleButton (ToggleButtonGroup 내 Design 숨김)
- Phase 3 완료 — Grade B 전환
  - **Spec Generic 완전 전환 (2026-03-27~28)**: Button, TextField, CheckboxGroup, RadioGroup, ComboBox, Select, TagGroup, Tree, Checkbox, Radio, Switch, Card, NumberField, SearchField — 수동 에디터 삭제, Spec properties + propagation으로 모든 필드 자동화
  - **ListBox, GridList**: `string-array` 필드 타입 추가 → Filtering 섹션 Spec 자동화 → 완전 자동 전환 (2026-03-28)
  - **Hybrid 잔존 2개**:
    - Tabs: Hybrid 유지 (Tab+Panel 쌍 생성 — 구조상 children-manager 불가)
    - Slider: Hybrid — Content/Design/NumberFormatting/Range/Behavior/Form은 Spec 자동화, afterSections에 Range Mode(Thumb 생성/삭제 + 배열 value)만 잔존 (739줄→211줄, 72% 감소)
  - icon field 타입 SpecField 구현 — PropertyIconPicker 연동, clearKeys 지원
  - Icon: size field에 derivedUpdateFn 추가 (size→style.fontSize 동시 업데이트)
- Phase 4 완료 — 수동 에디터 파일 정리
  - 삭제된 수동 에디터: **64개** (12개 배치1-3 + 22개 Phase 4 + 2개 propagation 전환 + 28개 Spec Generic 완전 전환)
    - 배치1-3: Badge, Separator, StatusLight, Meter, ProgressBar, Link, Tooltip, Dialog, Popover, Toast, Form, ColorField
    - Phase 4: Avatar, AvatarGroup, ButtonGroup, CardView, ColorArea, ColorPicker, ColorSlider, ColorSwatch, ColorSwatchPicker, ColorWheel, Disclosure, DisclosureGroup, DropZone, FileTrigger, Group, IllustratedMessage, Image, Nav, ProgressCircle, Toolbar, ToggleButton, Icon
    - Propagation 전환: Calendar, RangeCalendar (수동 childSync → propagation 엔진 교체)
    - **Spec Generic 완전 전환 (2026-03-27)**: Button, TextField, CheckboxGroup, RadioGroup, ComboBox, Select, TagGroup, Tree
    - **Dead code 에디터 정리 (2026-03-28)**: Checkbox, Radio, Switch, Card, NumberField (Spec properties + propagation으로 완전 자동화되어 에디터 파일 불필요)
    - **Hybrid CRUD → children-manager 전환 (2026-03-27)**: ComboBox, Select, ListBox, GridList, TagGroup, Tree (수동 아이템 CRUD → Spec `children-manager` 필드로 대체)
    - **Propagation 규칙 추가 (2026-03-27)**: ComboBox(label→Label, placeholder→ComboBoxInput), Select(label→Label, placeholder→SelectValue), TagGroup(label→Label) — 수동 child prop sync/size cascading 코드 제거
  - editors/index.ts export 정리
  - **Filtering 자동화 (2026-03-28)**: `string-array` 필드 타입 신규 → ListBox/GridList Filtering 섹션 Spec 전환, 에디터 삭제
  - **수동 에디터 일괄 자동화 (2026-03-28)**: ActionMenu, Autocomplete, TableView, Field, Accordion, Modal, TailSwatch, Menu — properties-only Spec 생성 + specRegistry 등록, 에디터 8개 삭제
  - **Breadcrumbs/Slot 자동화 (2026-03-28)**: Breadcrumbs(children-manager), Slot(name/description/required) — Spec properties 추가, 에디터 2개 삭제
  - **PropertyNumberInput (2026-03-28)**: React Aria NumberField 기반 숫자 전용 입력 컴포넌트 — SpecField `number` 타입이 PropertyInput→PropertyNumberInput으로 교체, -/+ 스테퍼 버튼 포함
  - 남은 수동 에디터: ~4개 (hybrid afterSections 2개 + Grade C 수동 2개)
  - RangeCalendar Spec 신규 생성: CalendarSpec 기반 spread + propagation 8규칙 + properties 3섹션
  - propagationRegistry: 21개 → **22개** (RangeCalendar 추가)
- 버그 수정
  - GenericPropertyEditor `renderAfterSections`: `typeof === "function"` → `createElement(renderAfterSections, props)` 패치 — `React.memo()` 반환값은 object이므로 typeof 체크 실패. createElement으로 교체하여 memo 래핑된 afterSections 정상 렌더링
- 검증
  - `pnpm build:specs` — 92 CSS 생성 정상
  - `pnpm type-check` — 에러 0개
  - Avatar (Grade A) 브라우저 검증 — Content/Design/Behavior 자동 생성 정상
  - Checkbox (Grade B hybrid) 브라우저 검증 — generic + afterSections Content 렌더링 정상

**컴포넌트 패널 기준 에디터 유형 비교표 (73개)**:

> 자동 = GenericPropertyEditor (Spec properties), Hybrid = 자동 + afterSections, 수동 = 기존 에디터 fallback
> ¹ specRegistry 우선이므로 GenericPropertyEditor가 사용됨. 에디터 파일은 존재하지만 로드되지 않음

| #   | 카테고리    | 컴포넌트           | 에디터 유형 |
| --- | ----------- | ------------------ | :---------: |
| 1   | Buttons     | Button             |    자동     |
| 2   | Buttons     | ToggleButton       |    자동     |
| 3   | Buttons     | ToggleButtonGroup  |   자동 ¹    |
| 4   | Buttons     | Toolbar            |    자동     |
| 5   | Buttons     | ButtonGroup        |    자동     |
| 6   | Buttons     | ActionMenu         |    자동     |
| 7   | Forms       | TextField          |    자동     |
| 8   | Forms       | NumberField        |    자동     |
| 9   | Forms       | SearchField        |    자동     |
| 10  | Forms       | Checkbox           |    자동     |
| 11  | Forms       | CheckboxGroup      |    자동     |
| 12  | Forms       | Radio              |    자동     |
| 13  | Forms       | RadioGroup         |    자동     |
| 14  | Forms       | Select             |    자동     |
| 15  | Forms       | ComboBox           |    자동     |
| 16  | Forms       | Switch             |    자동     |
| 17  | Forms       | Slider             |   Hybrid    |
| 18  | Forms       | TailSwatch         |    자동     |
| 19  | Forms       | FileTrigger        |    자동     |
| 20  | Forms       | DropZone           |    자동     |
| 21  | Forms       | Autocomplete       |    자동     |
| 22  | Forms       | Form               |    자동     |
| 23  | Color       | ColorPicker        |    자동     |
| 24  | Color       | ColorField         |    자동     |
| 25  | Color       | ColorArea          |    자동     |
| 26  | Color       | ColorSlider        |    자동     |
| 27  | Color       | ColorWheel         |    자동     |
| 28  | Color       | ColorSwatch        |    자동     |
| 29  | Color       | ColorSwatchPicker  |    자동     |
| 30  | Collections | Menu               |    자동     |
| 31  | Collections | Table              |    수동     |
| 32  | Collections | ListBox            |    자동     |
| 33  | Collections | GridList           |    자동     |
| 34  | Collections | Tree               |    자동     |
| 35  | Collections | TagGroup           |    자동     |
| 36  | Collections | CardView           |    자동     |
| 37  | Collections | TableView          |    자동     |
| 38  | Collections | DataTable          |    수동     |
| 39  | Collections | Field              |    자동     |
| 40  | Content     | ProgressBar        |    자동     |
| 41  | Content     | Meter              |    자동     |
| 42  | Content     | Badge              |    자동     |
| 43  | Content     | Icon               |    자동     |
| 44  | Content     | Toast              |    자동     |
| 45  | Content     | Separator          |    자동     |
| 46  | Content     | Avatar             |    자동     |
| 47  | Content     | AvatarGroup        |    자동     |
| 48  | Content     | StatusLight        |    자동     |
| 49  | Content     | InlineAlert        |   자동 ¹    |
| 50  | Content     | ProgressCircle     |    자동     |
| 51  | Content     | Image              |    자동     |
| 52  | Content     | IllustratedMessage |    자동     |
| 53  | Layout      | Link               |    자동     |
| 54  | Layout      | Panel              |   자동 ¹    |
| 55  | Layout      | Card               |    자동     |
| 56  | Layout      | Tabs               |   Hybrid    |
| 57  | Layout      | Breadcrumbs        |    자동     |
| 58  | Layout      | Group              |    자동     |
| 59  | Layout      | Disclosure         |    자동     |
| 60  | Layout      | DisclosureGroup    |    자동     |
| 61  | Layout      | Nav                |    자동     |
| 62  | Layout      | Slot               |    자동     |
| 63  | Layout      | Accordion          |    자동     |
| 64  | Overlays    | Tooltip            |    자동     |
| 65  | Overlays    | Dialog             |    자동     |
| 66  | Overlays    | Modal              |    자동     |
| 67  | Overlays    | Popover            |    자동     |
| 68  | Date & Time | Calendar           |    자동     |
| 69  | Date & Time | DatePicker         |   자동 ¹    |
| 70  | Date & Time | DateRangePicker    |   자동 ¹    |
| 71  | Date & Time | TimeField          |   자동 ¹    |
| 72  | Date & Time | DateField          |   자동 ¹    |
| 73  | Date & Time | RangeCalendar      |    자동     |

| 유형       |  개수  | 비율  |
| ---------- | :----: | :---: |
| **자동**   | **69** | 94.5% |
| **Hybrid** | **2**  | 2.7%  |
| **수동**   | **2**  | 2.7%  |
| **합계**   | **73** | 100%  |

**2026-03-26 현재 상태**:

- Phase 0 인프라 완료
  - `ComponentSpec.properties` 타입 추가
  - `specRegistry` 추가
- Phase 1 골격 완료
  - `GenericPropertyEditor`
  - `SpecField`
  - `evaluateVisibility`
  - `inferLabel`
  - registry 분기 연결
- 배치 1 전환 완료
  - `Badge`
  - `Separator`
  - `StatusLight`
  - `Meter`
  - `ProgressBar`
- 배치 2 전환 완료
  - `Link`
  - `Tooltip`
  - `Dialog`
  - `Popover`
  - `Toast`
- 배치 3 전환 완료
  - `Form`
  - `ColorField`
- 등급 B/C 하이브리드 진행
  - `Button`
  - `SearchField`
  - `TextField`
  - `NumberField`
  - `Select`
  - `ComboBox`
  - `GridList`
  - `ListBox`
  - `TagGroup`
  - `Tabs`
  - `Tree`
- 수동 editor 삭제 누적
  - `Badge`
  - `Separator`
  - `StatusLight`
  - `Meter`
  - `ProgressBar`
  - `Link`
  - `Popover`
  - `Tooltip`
  - `Dialog`
  - `Toast`
  - `Form`
  - `ColorField`
- `Meter`, `ProgressBar`, `Link`, `Form`, `ColorField`는 수동 editor와 generic surface를 교차 점검해 동일함을 확인
- ChildSyncField 현황
  - 타입 정의 완료 (`spec.types.ts`: `ChildSyncConfig`, `ChildSyncField`)
  - SpecField.tsx에서 `type: "childSync"` 처리: **미구현** (default case에서 null 반환)
  - 어떤 Spec에서도 `type: "childSync"` 필드 사용 사례 없음
  - 하이브리드 에디터에서 `useSyncChildProp` 훅으로 수동 처리 중
  - **ADR-048에서 ChildSyncField를 PropagationSpec으로 대체(supersede) 결정** — ChildSyncField는 구현하지 않고, PropagationSpec 엔진이 4경로(Inspector/Skia/Layout/implicitStyles) 통합 전파를 직접 수행. ChildSyncField 타입 정의는 제거 예정
- icon 필드: SpecField.tsx에서 미구현 (Button 하이브리드에서 수동 처리 중)
- 남은 범위
  - 나머지 등급 B/C 하이브리드 전환
  - ChildSyncField → PropagationSpec 대체 (ADR-048)
  - ChildSyncField 타입 정의 제거
  - icon 필드 타입 SpecField 구현

**전환 방법 (안전한 롤백)**:

```
1. {Component}Spec에 properties 추가
2. registry.ts에서 Spec properties 우선 확인 분기 추가
3. 기존 {Component}Editor.tsx와 동작 비교 (시각 검증)
4. 검증 통과 → metadata에서 hasCustomEditor: false 변경
5. 실패 시 → registry.ts 분기만 되돌리면 즉시 롤백
6. 최종 확인 후 기존 에디터 파일 삭제
```

**배치 순서** (기준: 필드 타입 단순성 → 사용 빈도 역순 → 의존 컴포넌트 없는 leaf부터):

| 배치 | 대상 수 | 대표 에디터                                                                                                                                                     |
| :--: | :-----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1   |   ~15   | Badge, Separator, StatusLight, Avatar, Skeleton, Tooltip, Meter, ProgressBar, ProgressCircle, Icon, ColorSwatch, Breadcrumbs, Link, InlineAlert, ContextualHelp |
|  2   |   ~20   | Disclosure, Form, Panel, Group, Pagination, Popover, Dialog, Toast, Calendar, DateField, TimeField                                                              |
|  3   |   ~20   | ColorSlider, ColorArea, ColorWheel, ColorField, ScrollBox, DropZone, FileTrigger, MaskedFrame, Nav                                                              |
|  4   |   ~20   | 나머지 단순 에디터                                                                                                                                              |

### Phase 3: 등급 B 에디터 전환 (8개)

childSync 또는 복합 visibleWhen이 필요한 에디터.

> **변경**: ChildSyncField는 미구현 상태에서 ADR-048의 PropagationSpec으로 대체(supersede). ChildSyncField 타입/구현 없이, PropagationSpec 엔진이 부모→자식 전파를 4경로(Inspector/Skia/Layout/implicitStyles) 통합으로 직접 수행.

**전환 대상**:

| 에디터            | 전환 근거                                                            | 예시 properties                                                                               |
| ----------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| ButtonEditor      | 복합 visibleWhen (Icon/Link/Form 조건부)                             | `visibleWhen: { key: "type", oneOf: ["submit", "reset"] }` (Form 섹션) 등                     |
| SwitchEditor      | childSync: Label                                                     | `{ key: "children", type: "childSync", childSync: { path: ["Label"], propKey: "children" } }` |
| CheckboxEditor    | childSync: Label                                                     | 동일 패턴                                                                                     |
| RadioEditor       | childSync: Label                                                     | 동일 패턴                                                                                     |
| SliderEditor      | childSync: Label                                                     | 동일 패턴                                                                                     |
| TextFieldEditor   | childSync + derivedUpdateFn: Label, Description, ErrorMessage, Input | 3개 childSync 필드 + size→fontSize 파생 값                                                    |
| SearchFieldEditor | childSync: Label, Description, Input placeholder                     | 3개 childSync 필드                                                                            |
| CardEditor        | childSync: Heading + Description (2-depth + fallbackToDirectChild)   | `{ path: ["CardHeader", "Heading"], ..., fallbackToDirectChild: true }`                       |

### Phase 4: 기존 에디터 파일 정리 + 에디터 레지스트리 전환 전략

#### 에디터 레지스트리 전환 전략

**공존 기간 관리**: 위 "에디터 레지스트리 변경" 섹션의 registry.ts 코드가 전환 기간에도 그대로 적용된다. Spec에 `properties`가 있으면 GenericPropertyEditor, 없으면 기존 lazy import로 폴백하므로 점진적 전환이 가능하다.

**롤백 전략**:

| 상황                            | 조치                                                                     | 영향 범위    |
| ------------------------------- | ------------------------------------------------------------------------ | ------------ |
| 개별 에디터 동작 오류           | Spec에서 `properties` 필드 제거 → registry가 기존 에디터로 폴백          | 1개 컴포넌트 |
| GenericPropertyEditor 근본 결함 | registry.ts에서 Spec properties 분기 주석 처리 → 모든 에디터가 기존 방식 | 전체         |
| childSync 오류                  | 해당 Spec의 childSync 필드만 제거 → 일반 string 필드로 폴백              | 1개 필드     |

**최종 정리**:

- 전환 완료된 에디터 파일은 `editors/_deprecated/`로 이동 (즉시 삭제 금지)
- 2주간 운영 검증 후 삭제
- 수동 에디터 잔존: 등급 C 20개

### 적용 예시: SelectEditor (등급 C — 하이브리드 접근)

등급 C 에디터도 **Design/Behavior 섹션은 GenericPropertyEditor**, **Content 섹션(컬렉션 관리)만 수동 유지**하는 하이브리드가 가능하다:

```typescript
// SelectEditor.tsx — 하이브리드 예시
function SelectEditor({ elementId, currentProps, onUpdate }: Props) {
  return (
    <>
      {/* Content 섹션: 수동 유지 (SelectItem 컬렉션 동적 관리) */}
      <PropertySection title="Content">
        <SelectItemManager elementId={elementId} />
      </PropertySection>

      {/* Design/Behavior 섹션: Spec properties에서 자동 생성 */}
      <GenericPropertyEditor
        elementId={elementId}
        currentProps={currentProps}
        onUpdate={onUpdate}
        spec={SelectSpec}
        excludeSections={["Content"]} // Content 섹션 제외
      />
    </>
  );
}
```

이 하이브리드 패턴으로 등급 C 20개 에디터 중 **UI 모드 전환이 없는 에디터**(약 50%)는 Design/Behavior 섹션을 자동 생성하여 **30~50% 코드를 절감**할 수 있다. 단, SelectEditor처럼 선택 상태에 따라 전체 UI가 전환되는 에디터는 하이브리드 적용 효과가 제한적이다.

### 적용 예시: CardEditor (등급 B — 중첩 childSync)

```typescript
// CardSpec.properties
properties: {
  sections: [
    {
      title: "Content",
      fields: [
        {
          key: "heading",
          type: "childSync",
          label: "Heading",
          childSync: {
            path: ["CardHeader", "Heading"],
            propKey: "children",
            fallbackToDirectChild: true,
          },
        },
        {
          key: "description",
          type: "childSync",
          label: "Description",
          multiline: true,
          childSync: {
            path: ["CardHeader", "Description"],
            propKey: "children",
            fallbackToDirectChild: true,
          },
        },
      ],
    },
    {
      title: "Appearance",
      fields: [
        { type: "variant" },
        { type: "size" },
        {
          key: "orientation",
          type: "enum",
          label: "Orientation",
          options: [
            { value: "vertical", label: "Vertical" },
            { value: "horizontal", label: "Horizontal" },
          ],
        },
      ],
    },
    {
      title: "State",
      fields: [
        { key: "isDisabled", type: "boolean", label: "Disabled" },
        { key: "isSelectable", type: "boolean", label: "Selectable" },
      ],
    },
  ],
}
```

---

## Metrics / Verification

| 메트릭           |      Baseline (실측)       | Phase 2 (A 전환) | Phase 3 (B 전환) |     Phase 4 (실측)     |
| ---------------- | :------------------------: | :--------------: | :--------------: | :--------------------: |
| 개별 에디터 파일 |         **103개**          |      ~28개       |    ~**20개**     | **~4개** (hybrid+수동) |
| 자동 생성 에디터 |            0개             |       75개       |       83개       |    **69개** (spec)     |
| 삭제된 에디터    |            0개             |       12개       |       12개       |        **64개**        |
| hybrid 에디터    |            0개             |       0개        |       7개        |        **2개**         |
| specRegistry     |            0개             |       12개       |       23개       |        **69개**        |
| propagation      |            0개             |       0개        |       21개       |        **22개**        |
| 신규 컴포넌트 시 | 4개 (Spec+CSS+Editor+Meta) |       3개        | **1개** (Spec만) |        **1개**         |
| variant 추가 시  |     2곳 (Spec+Editor)      |       1곳        | **1곳** (Spec만) |        **1곳**         |

> **산정 기준**: 103개 전체 에디터 중 GenericPropertyEditor 전환 대상 83개(등급 A 75 + 등급 B 8). 등급 C 20개는 수동 유지 (UI 모드 전환이 없는 에디터에 한해 하이브리드 적용 시 코드량 30~50% 감소 가능).

검증:

- [ ] `pnpm type-check` — PropertySchema 타입 에러 0건
- [ ] GenericPropertyEditor 렌더링 성능: React DevTools Profiler로 기존 대비 리렌더 횟수 동등 확인
- [ ] 전환된 에디터: 모든 필드 변경 → Canvas + Preview 동시 반영
- [ ] childSync: 부모 prop 변경 → 자식 prop 동기화 정상 (Switch Label, Card Heading)
- [ ] visibleWhen: 조건부 필드 표시/숨김 정상 (Button iconPosition → iconName 의존)
- [ ] Undo/Redo: 히스토리 기록 정상 (GenericPropertyEditor의 onUpdate 경로)
- [ ] 롤백: Spec properties 제거 → 기존 에디터로 즉시 복원 확인

---

## Consequences

### Positive

1. **Spec 4중 단일 소스**: Skia 렌더링 + CSS(ADR-036) + Editor UI + DOM 속성
2. **에디터 파일 80.6% 자동화**: 103개 → 83개 자동 + 20개 수동 (하이브리드로 코드량 추가 감소 가능)
3. **새 컴포넌트 추가 비용 감소**: Spec 1개 파일에 properties 추가하면 에디터 자동 생성
4. **variant/size 추가 시 자동 반영**: Spec.variants에 키 추가 → 에디터 옵션 자동 확장
5. **일관된 UI**: 모든 에디터가 동일한 섹션 구조/스타일 보장
6. **등급 C 하이브리드**: UI 모드 전환이 없는 수동 에디터의 Design/Behavior 섹션은 자동 생성 가능 → 코드량 30~50% 절감

### Negative

1. **PropertySchema 설계 투자**: FieldDef 유니온 9개 타입 + visibility(parentTag 포함) + childSync + derivedUpdateFn 구현 (단, 문자열 레지스트리 제거로 인프라 코드 감소)
2. **CustomField 확장 시 Spec import 체인**: 컴포넌트 직접 참조이므로 Spec → 커스텀 위젯 import 경로 관리 필요 (현재 사용 0개이므로 당장 영향 없음)
3. **기존 에디터 마이그레이션 작업**: 83개 Spec에 properties 추가 (등급 A는 기계적 작업)
4. **디버깅 간접성**: 에디터 문제 시 Schema → GenericEditor → SpecField 체인 추적
5. **등급 C 하이브리드 복잡성**: 일부 섹션만 자동 + 나머지 수동 → 하이브리드 경계 관리 필요

---

## References

- `apps/builder/src/builder/panels/properties/editors/` — 기존 103개 에디터
- `apps/builder/src/builder/inspector/editors/registry.ts` — 에디터 동적 로딩
- `apps/builder/src/builder/components/property/` — PropertyInput/Select/Switch/SizeToggle
- `packages/specs/src/types/spec.types.ts` — ComponentSpec 타입 정의
- `packages/shared/src/components/metadata.ts` — 컴포넌트 메타데이터
- [ADR-036](036-spec-first-single-source.md) — Spec-First Single Source (CSS 자동 생성)
