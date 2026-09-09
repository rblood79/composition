# ADR-046 Breakdown: Form, ColorField, Tabs 계약 확장

이 문서는 [ADR-046](../completed/046-s2-contract-expansion-form-colorfield-tabs.md)의 구현 전 검토 메모다.

## 목표

- `Form`, `ColorField`, `Tabs`에 대해 자동 생성기 입력으로 사용할 제품 계약 후보를 정리한다.
- 채택 후보와 보류 후보를 나눈다.

## 1. Form

### 현재 계약

- `action`
- `method`
- `encType`
- `target`
- `autoFocus`
- `restoreFocus`
- `validationBehavior`

### S2 기반 확장 후보

- `labelPosition`
- `labelAlign`
- `necessityIndicator`
- `isEmphasized`
- `size`

### 검토 포인트

- 이 값들이 자식 field에 어떻게 전파되는지 규칙이 필요하다.
- 전파 규칙이 없으면 editor만 늘어나고 실제 렌더는 무의미해질 수 있다.

### 2026-03-26 1차 결정

- `labelPosition`, `labelAlign`, `necessityIndicator`는 **채택**한다.
- 근거:
  - S2 문서 근거 존재
  - preview `renderForm` + child field fallback 경로 구현 완료
  - canvas/WebGL `ElementSprite` fallback 경로 구현 완료
  - `labelAlign`의 경우 shared CSS + preview renderer + canvas layout/spec 경로 구현 완료
- 반영 범위:
  - builder unified type
  - `FormEditor`
  - shared `Form` API
- 후순위 후보:
  - `isEmphasized`
  - `size`

## 2. ColorField

### 현재 계약

- `label`
- `description`
- `errorMessage`
- `value`
- `defaultValue`
- `isDisabled`
- `isReadOnly`
- `isRequired`
- `channel`
- `colorSpace`

### S2 기반 확장 후보

- `name`
- `form`
- `autoFocus`
- `validationBehavior`
- `labelPosition`
- `labelAlign`
- `necessityIndicator`
- `size`

### 정리 대상

- 현재 editor에 있는 `variant`, `size`, `isInvalid`, `necessityIndicator`는 타입 계약과 불일치 가능성이 있다.
- 구현 전에 "editor가 먼저 만든 임시 surface"를 걷어내거나 정식 계약으로 승격할지 결정해야 한다.

### 2026-03-26 1차 결정

- 아래 항목은 **계약으로 승격**한다.
  - `variant`
  - `size`
  - `isInvalid`
  - `autoFocus`
  - `name`
  - `form`
  - `validationBehavior`
  - `necessityIndicator`
  - `labelPosition`
  - `labelAlign`
  - `channel`
  - `colorSpace`
- 근거:
  - S2 문서 근거 존재
  - shared `ColorField` 또는 Aria `ColorFieldProps` 경로에서 수용 가능
  - builder type + preview renderer로 같은 변경 세트 안에서 닫을 수 있음
- 구현 반영:
  - builder unified type
  - `ColorFieldEditor`
  - shared `ColorField`
  - preview renderer (`renderColorField`)

## 3. Tabs

### 현재 계약

- `selectedKey`
- `defaultSelectedKey`
- `orientation`

### 확장 후보

- `density`

### 제외 후보

- `isQuiet`
- `isEmphasized`

### 검토 포인트

- `density`는 shared 타입과 S2 문서 양쪽 근거가 있어 우선순위가 높다.
- 나머지 시각 모드 prop는 현재 채택 근거가 약하다.

### 2026-03-26 1차 결정

- `density`를 첫 계약 확정 항목으로 채택한다.
- 반영 범위:
  - builder unified types
  - `TabsEditor`
  - preview renderer (`renderTabs`)
- 보류 범위:
  - canvas/WebGL 시각 차이 검증
  - `isQuiet`, `isEmphasized` 같은 추가 시각 모드

## 4. 현재 반영 상태

### 구현 완료

- `Tabs.density`
  - builder unified type
  - `TabsEditor`
  - preview renderer (`renderTabs`)
- `ColorField`
  - builder unified type
  - `ColorFieldEditor`
  - shared `ColorField`
  - preview renderer (`renderColorField`)
  - canvas/spec label 정렬 경로
- `Form.labelPosition`
  - builder unified type
  - `FormEditor`
  - preview/canvas fallback 경로
- `Form.labelAlign`
  - builder unified type
  - `FormEditor`
  - shared CSS
  - preview/canvas 반영 경로
- `Form.necessityIndicator`
  - builder unified type
  - `FormEditor`
  - preview/canvas fallback 경로

## 5. 실행 순서

1. ADR-045 범위의 정렬 작업 수행
2. ADR-046에서 `Form`, `ColorField`, `Tabs` 계약 확정
3. ADR-041 자동 생성 설계에 반영

## 6. Form 후속 설계 초안

`Form` 상위 계약을 채택하려면 preview, canvas, spec 경로가 같은 의미를 공유해야 한다.

### 초기 기준 상태

- preview
  - `Form` 전용 renderer가 없었다.
  - field 계열(`TextField`, `NumberField`, `SearchField`, `ColorField`)은 각자 개별 props만 봤다.
- canvas/WebGL
  - `PixiForm`은 hit area 중심 컨테이너였다.
  - 상위 `Form` 계약이 자식 field 시각에 전파되지 않았다.
- specs
  - `FormSpec`은 컨테이너 시각만 정의했다.
  - `labelPosition`, `labelAlign`, `necessityIndicator` 같은 상위 field 계약은 없었다.

### 1단계: Preview 전파 경로 도입

- `packages/shared/src/renderers/FormRenderers.tsx`
  - `renderForm` 추가
- `packages/shared/src/renderers/index.ts`
  - `Form`를 rendererMap에 등록
- 동작
  - shared `Form` 컴포넌트로 감싼 뒤 자식을 `renderElement`로 렌더
  - 이 단계에서는 기존 `Form` 계약(`action`, `method`, `encType`, `target`, `autoFocus`, `restoreFocus`, `validationBehavior`)만 전달
- 상태
  - 구현 완료

### 2단계: Effective Form Contract 도입

- child field renderer가 부모 체인에서 가장 가까운 `Form`을 찾아 fallback 규칙을 적용한다.
- 목적
  - child field가 자기 own prop이 없을 때만 parent `Form` 값을 상속받게 한다.
- 1차 전파 후보
  - `labelPosition`
  - `necessityIndicator`
- 상태
  - preview 기준 구현 완료
  - 적용 대상:
    - `TextField`
    - `NumberField`
    - `SearchField`
    - `ColorField`

### 전파 규칙

- child own prop 우선
- parent `Form` prop fallback
- 둘 다 없으면 component default 사용

### 구현 순서

1. preview `renderForm` 추가
2. `TextField`, `NumberField`, `SearchField`, `ColorField`에 fallback 규칙 적용
3. canvas/WebGL에 동일 의미의 상속 규칙 추가
4. 그 후에만 `Form.labelPosition`, `Form.necessityIndicator` 채택 여부 재판단

### 현재 남은 작업

- 후순위 후보
  - `Form.isEmphasized`
  - `Form.size`

### 2026-03-26 구현 반영

- canvas/WebGL
  - `ElementSprite`에서 가장 가까운 부모 `Form`의
    - `labelPosition`
    - `necessityIndicator`
      를 `TextField`, `NumberField`, `SearchField`, `ColorField`에 fallback으로 주입
  - child own prop이 있으면 parent fallback을 덮어쓰지 않는다

### 검증 상태

- `type-check`
  - 통과
- `ElementSprite.tsx` 단일 eslint
  - 실패
  - 원인:
    - 파일 기존 unused symbol 다수
    - 기존 giant `useMemo` 블록의 `preserve-manual-memoization` 규칙 위반
  - 이번 변경으로 추가된 신규 eslint 오류는 없다

## 7. Form.labelAlign 구현 메모

### 해결한 문제

- side-label 레이아웃에 공통 라벨 컬럼 폭이 없던 문제를 shared CSS와 canvas layout 양쪽에서 보강했다.
- `Label.spec.ts`는 이미 `style.textAlign`을 읽고 있었기 때문에, canvas/spec 쪽은 주입 경로만 추가했다.

### 구현 가능 조건

- `Form`이 side-label 모드에서 공통 라벨 컬럼 폭을 제공해야 한다.
- child field는 그 폭을 사용해
  - label 영역 폭 고정
  - label 내부 `text-align` 적용
    을 함께 수행해야 한다.

### 제안 경로

1. shared `Form`
   - `data-label-align`
   - `--form-label-width`
   - `--form-label-align`
     같은 공통 CSS 변수/속성을 제공
2. shared field CSS
   - `TextField`
   - `NumberField`
   - `SearchField`
   - `ColorField`
     의 `data-label-position="side"` 경로를 단순 flex가 아니라
   - 고정 label column
   - flexible control column
     구조로 전환
3. canvas layout engine
   - `implicitStyles.ts`에서 side-label field의 Label child 폭을 동일 규칙으로 계산
4. canvas/spec
   - Label text 정렬을 `start | end | center`로 반영

### 채택 조건

- preview/shared CSS에서 실제 정렬 차이가 보일 것
- canvas/WebGL layout에서도 같은 의미로 동작할 것
- canvas/spec에서 `Label` text 정렬이 같은 값 집합으로 반영될 것

### 2026-03-26 진행 상태

- shared `Form`
  - `data-label-align` 추가
  - `--form-label-width`, `--form-label-align`, `--form-field-gap` 추가
- shared field CSS
  - `TextField`
  - `NumberField`
  - `SearchField`
  - `ColorField`
    의 side-label 경로를 grid 기반 label column 구조로 전환
- preview renderer
  - `renderForm`이 `labelAlign`을 `Form`에 전달하도록 반영

### 2026-03-26 canvas 진행 상태

- canvas/layout
  - `implicitStyles.ts`에서 side-label field에 대해
    - Label 고정 폭
    - control flex
    - FieldError/Description 들여쓰기
      규칙을 반영
  - 적용 대상:
    - `TextField`
    - `NumberField`
    - `SearchField`
    - `Select/ComboBox` 계열 side-label wrapper
- canvas/spec
  - `ElementSprite`에서 `Form.labelAlign`을 `Label.style.textAlign`으로 주입
  - `Label.spec.ts`가 이를 `left | center | right` 정렬로 렌더

## 8. Form.size 결정 메모

### 2026-03-26 결정

- `Form.size`는 **이번 단계에서 채택하지 않는다**.

### 보류 이유

- S2 `Form`은 `S | M | L | XL` 축을 사용한다.
- 현재 composition field 계열은 공통으로 `xs | sm | md | lg | xl` 축을 사용한다.
- 하지만 composition 내부도 단일 축이 아니다.
  - `TextField`, `NumberField`, `SearchField`, `ColorField`는 주로 `xs | sm | md | lg | xl`
  - `Checkbox`, `Radio`, `Switch`, `Tooltip`, `Separator` 같은 계열은 `sm | md | lg`
- 즉 `Form.size`를 상위 계약으로 도입하면
  - S2 `Form` 축 → composition 5단계 축 매핑
  - S2 `Form` 축 → composition 3단계 축 매핑
    두 종류를 동시에 정의해야 한다.
- shared component, preview renderer, canvas layout, spec이 모두 현재 개별 축을 전제로 작성돼 있다.
- 이 상태에서 `Form.size`를 바로 도입하면 최소한 아래 중 하나를 먼저 정해야 한다.
  - `Form.size`를 composition size 축으로 재정의할지
  - S2 축을 유지하고 field 축으로 변환할지
  - 둘 다 유지하되 mapping layer를 둘지

### 현재 코드 상태

- preview/canvas에서 `labelPosition`, `labelAlign`, `necessityIndicator`는 parent `Form` fallback 경로가 있다.
- 반면 `size`는 `Form`에서 field로 전파하는 경로가 없다.
- WebGL `ElementSprite`의 size delegation도 현재 `Form`을 부모 태그로 포함하지 않는다.
- shared `Form` API와 `FormEditor`에도 아직 `size` surface가 없다.

### 채택 전 선행 조건

1. `Form.size`의 canonical value set 결정
2. 5단계 field 계열과 3단계 field 계열 각각에 대한 mapping 규칙 문서화
3. preview renderer와 canvas/WebGL에서 동일한 fallback 규칙 구현
4. spec/layout 엔진이 같은 size 의미를 사용하도록 정합성 확인
5. `FormEditor`와 shared `Form` API에 surface를 노출할지 최종 결정

## 9. Form.isEmphasized 결정 메모

### 2026-03-26 결정

- `Form.isEmphasized`는 **이번 단계에서 채택하지 않는다**.

### 보류 이유

- S2 문서에는 `Form.isEmphasized`가 존재하지만, 현재 composition field 계열에는 공통된 "emphasized" 의미가 없다.
- 현재 코드 기준으로 `isEmphasized`를 직접 지원하는 것은 주로
  - `Checkbox`
  - `CheckboxGroup`
  - `RadioGroup`
  - `Switch`
  - `Slider`
  - `ToggleButton`
  - `ToggleButtonGroup`
    같은 선택/토글 계열이다.
- 반면 이번 ADR에서 핵심으로 다루는 field 계열은 주로
  - `TextField`
  - `NumberField`
  - `SearchField`
  - `ColorField`
    이고, 이들은 `variant` 중심으로 시각 모드를 표현한다.
- 따라서 `Form.isEmphasized`를 상위 fallback으로 넣으면 다음 문제가 생긴다.
  - 어떤 자식 컴포넌트에 적용되는지 일관되지 않다.
  - `variant` 기반 field와 의미가 충돌한다.
  - preview/canvas/spec에서 공통 해석 규칙을 만들기 어렵다.

### 현재 코드 상태

- preview/canvas에 `Form` → child field 경로로 닫힌 것은
  - `labelPosition`
  - `labelAlign`
  - `necessityIndicator`
    이다.
- `isEmphasized`는 현재 `Form`에서 field 계열로 전파하는 경로가 없다.
- 현재 `isEmphasized`를 직접 지원하는 구현 경로는 주로
  - `Checkbox`
  - `CheckboxGroup`
  - `RadioGroup`
  - `Switch`
  - `Slider`
  - `ToggleButton`
  - `ToggleButtonGroup`
    에 한정된다.
- 반면 `FormEditor`, shared `Form` API, preview `renderForm`에는 `isEmphasized` surface가 없다.

### 채택 전 선행 조건

1. `Form.isEmphasized`가 적용될 자식 컴포넌트 집합을 명확히 정의
2. `variant` 기반 field와의 관계를 규정
3. preview/shared/canvas/spec에서 동일한 시각 의미를 구현

### 보류 조건

- `isEmphasized`, `size`
  - 상위 컨테이너 계약인지 field 시각 프리셋인지 의미가 아직 불명확하다.

## 10. ADR-046 최종 보류 항목

### 현재 보류 항목

- `Form.size`
- `Form.isEmphasized`

### 공통 판단 기준

- 두 항목 모두 단순 editor surface 추가 문제가 아니다.
- 둘 다 `Form` 상위 계약으로 채택하려면
  - 자식 적용 대상 집합 정의
  - preview/shared/canvas/spec의 공통 의미 정의
  - fallback 규칙 구현
    이 먼저 필요하다.

### ADR-041로 넘길 수 있는 상태

- `Tabs.density`
- `ColorField` 1차 계약 세트
- `Form.labelPosition`
- `Form.labelAlign`
- `Form.necessityIndicator`

위 항목은 자동 생성 입력 계약으로 사용할 수 있다.
