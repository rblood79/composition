# ADR-045 Breakdown: S2 Property Editor 정합성 정렬

이 문서는 ADR-045의 구현 메모를 관리한다. 결정 자체는 [ADR-045](../completed/045-s2-property-editor-alignment.md)에 있고, 여기에는 컴포넌트별 실행 후보와 계약 확장 후보만 기록한다.

## 목적

- Property Editor에서 즉시 정렬 가능한 항목과 별도 계약 확장이 필요한 항목을 분리한다.
- 구현 범위를 작은 변경 묶음으로 나누기 위한 작업 메모를 유지한다.
- ADR 본문에 넣지 않는 파일 경계와 QA 체크 항목을 관리한다.

## 1. 즉시 정렬 후보

아래 항목은 현재 코드 계약에 이미 존재하거나, 작은 범위의 동기화로 정렬 가능한 후보다.

### Link

- 현재 계약 확인:
  - `target`
  - `rel`
  - `isQuiet`
  - `staticColor`
- 상태:
  - 구현 완료
- 메모:
  - 기존 editor에는 `target`, `rel`, `isQuiet`, `staticColor` 일부가 빠져 있었고, 1차 파동에서 정렬했다.
  - `variant`는 현재 `"primary" | "secondary"` 계약을 유지한다.
  - S2 문서에 없는 `overBackground` 같은 확장은 이번 범위에서 제외한다.

### Dialog

- 현재 계약 확인:
  - `isDismissable`
  - `role`
- 상태:
  - 구현 완료
- 메모:
  - 1차 파동에서 `isDismissable`, `role`을 editor에 노출했다.
  - S2 문서상 `size`가 존재하지만, 현재 builder unified type에는 없다.
  - `size`는 즉시 정렬 항목이 아니라 계약 확장 후보로 분류한다.

### Form

- 현재 계약 확인:
  - `action`
  - `method`
  - `encType`
  - `target`
  - `autoFocus`
  - `restoreFocus`
  - `validationBehavior`
- 상태:
  - 정렬 완료
- 메모:
  - 기존 `Form` 계약은 이미 editor에 노출되어 있었다.
  - 다만 `method: dialog` 옵션이 현재 builder 계약 밖에 있어 제거했다.
  - S2 문서상 `labelPosition`, `labelAlign`, `necessityIndicator`, `isEmphasized`, `size`는 ADR-046 보류 범위다.

## 2. 계약 확장 후보

아래 항목은 S2 문서에는 존재하지만, 현재 composition 계약에 없거나 경로가 불완전하다.

### ColorField

- 상태:
  - ADR-046 1차 반영 완료
- 이번에 계약으로 승격한 항목:
  - `variant`
  - `size`
  - `isInvalid`
  - `autoFocus`
  - `name`
  - `form`
  - `validationBehavior`
  - `necessityIndicator`
  - `labelPosition`
  - `channel`
  - `colorSpace`
- 보류:
  - `labelAlign`
- 메모:
  - 이 항목은 더 이상 ADR-045의 순수 editor 정렬 대상이 아니다.
  - 후속 작업은 ADR-046 하위에서만 진행한다.

### Tabs

- 상태:
  - ADR-046 1차 반영 완료
- 이번에 계약으로 확정한 항목:
  - `density`
- 제외:
  - `isQuiet`
  - `isEmphasized`
- 메모:
  - `density`는 builder unified type, `TabsEditor`, preview renderer까지 반영했다.
  - 후속 작업은 canvas/WebGL 검증과 추가 시각 모드 검토다.

### Tooltip

- 후보:
  - `containerPadding`
  - `crossOffset`
  - `shouldFlip`
  - `trigger`
- 제외:
  - `variant`
  - `showIcon`
- 메모:
  - 현재 composition Tooltip 계약은 `placement`, `offset` 정도만 노출한다.
  - `variant`, `showIcon`은 S2 Tooltip 문서 근거가 부족하므로 이번 범위에서 제거한다.

### Popover

- 후보:
  - `crossOffset`
  - `shouldFlip`
  - `containerPadding`
  - `size`
- 제외:
  - `isNonModal`
- 메모:
  - `trigger`는 styling hook 성격이 강하므로 builder에서 직접 노출할지 별도 판단이 필요하다.

### Breadcrumbs

- 후보:
  - `size`
  - item 단위 `target`
  - item 단위 `rel`
- 제외:
  - `showRoot`
  - `isMultiline`
- 메모:
  - S2 문서 기준으로 `showRoot`, `isMultiline` 근거는 확인되지 않았다.

### Menu

- 후보:
  - trigger 쪽 `align`
  - trigger 쪽 `direction`
  - trigger 쪽 `shouldFlip`
  - trigger 쪽 `trigger`
  - menu 쪽 `size`
- 제외:
  - `closeOnSelect`
- 메모:
  - 현재 composition는 `Menu`와 trigger 계약이 분리되어 있지 않아, editor surface를 어디에 둘지 먼저 정해야 한다.

## 3. 공통 정렬 후보

아래 항목은 여러 field 계열 컴포넌트에 공통으로 적용 가능하지만, 반드시 현재 계약 존재 여부를 먼저 확인한다.

- `validationBehavior`
- `isInvalid`
- `labelPosition`
- `staticColor`
- `buildRequiredUpdate` 유틸 통합

## 4. 실행 원칙

- 한 PR에서 계약 없는 prop까지 무리하게 확장하지 않는다.
- editor 추가와 renderer 반영은 한 묶음으로 검증한다.
- `pnpm run type-check`, `pnpm run lint`를 기본 게이트로 사용한다.
- 수동 점검은 최소한 다음을 포함한다.
  - editor에서 값 변경 가능
  - preview 또는 publish 경로에서 값 반영 확인
  - reload 후 값 유지 확인

## 5. 1차 구현 범위

ADR-045의 첫 구현 파동은 "기존 계약이 이미 존재하는데 editor에 노출되지 않는 갭"만 다룬다.

### 상태

- 구현 완료

### 대상 파일

- `apps/builder/src/builder/panels/properties/editors/LinkEditor.tsx`
- `apps/builder/src/builder/panels/properties/editors/DialogEditor.tsx`
- `apps/builder/src/builder/panels/properties/editors/editorUtils.ts`

### 추가할 항목

- `LinkEditor.tsx`
  - `target`
  - `rel`
  - `isQuiet`
  - `staticColor`
- `DialogEditor.tsx`
  - `isDismissable`
  - `role`
- `editorUtils.ts`
  - `STATIC_COLOR_OPTIONS`
  - `LINK_TARGET_OPTIONS`

### 추가 정렬 반영

- `FormEditor.tsx`
  - `method`에서 계약 밖 옵션인 `dialog` 제거
  - `target`, `validationBehavior`는 공용 옵션 상수를 재사용하도록 정리

## 6. 남은 ADR-045 범위

현재 시점에서 ADR-045 범위의 순수 editor 정렬 작업은 모두 종료됐다.

### 다음 단계

- 후속 작업은 모두 ADR-046 또는 ADR-041 범위다.

### ADR-045 범위 밖

- `ColorField`
  - ADR-046에서 처리
- `Tabs`
  - ADR-046에서 처리
- `Tooltip`, `Popover`, `Breadcrumbs`, `Menu`
  - 현재는 계약 확장 검토 단계이며, ADR-045의 순수 정렬 파동에 포함하지 않는다.
