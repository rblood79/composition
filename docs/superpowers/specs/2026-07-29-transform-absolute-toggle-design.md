# Transform Absolute Toggle Design

## Goal

Style Panel의 `Transform` section에서 `Left`, `Top` 오른쪽의 기존
`fieldset-actions actions-position` 버튼을 `position: absolute` 활성화 상태를
직접 편집하는 토글 버튼으로 사용한다.

## UI Contract

- 기존 `More position options` 일반 버튼을 `SwatchIconToggleButton`으로 교체한다.
- 아이콘은 Lucide `LayoutFreeform`을 사용한다.
- 설치본 `lucide-react@0.575.0`에는 `LayoutFreeform` export가 없으므로 공식
  Lucide SVG path를 로컬 icon component로 격리한다.
- accessible name은 `Absolute position`이다.
- `style.position === "absolute"`이면 토글이 선택 상태다.
- React Aria `ToggleButton`의 `isSelected`/`onChange` 계약을 사용한다.
- 시각 상태는 `Box Shadow`의 `Inset shadow`와 동일한
  `SwatchIconToggleButton` CSS를 재사용한다.

## Mutation Contract

- 토글을 켤 때 직계 부모가 `display: flex` 또는 `display: inline-flex`이면
  mutation 직전의 element/parent scene bounds를 읽는다.
- element의 현재 scene 좌표에서 parent scene 좌표를 뺀 값을 `left`/`top` px
  offset으로 변환하고, `updateStylesImmediate({ position, left, top })`으로 한 번에
  저장한다. flex flow에서 빠진 뒤에도 토글 직전의 시각적 x/y가 유지되어야 한다.
- flex 부모가 아니거나 element/parent scene bounds를 읽을 수 없으면 기존처럼
  `updateStyleImmediate("position", "absolute")`만 호출한다.
- 토글을 끄면 `updateStyleImmediate("position", "")`를 호출해 inline 선언을
  제거하고 기본 flow로 복귀한다.
- 토글을 끌 때 `left`와 `top`은 변경하거나 제거하지 않는다. 다시 켤 때 flex
  자식이면 그 시점의 현재 위치로 `left`/`top`을 다시 캡처한다.
- 현재 선택 요소와 active breakpoint의 write routing, history, persistence,
  layout invalidation은 기존 `updateSelectedStyle`/`updateSelectedStyles` 경로에
  맡긴다.
- `position`을 `SECTION_EDITABLE_RESPONSIVE_PROPS`에 포함해 Transform의
  responsive eligibility SSOT를 동기화한다.
- `position`을 Transform reset/dirty 속성 목록에 포함한다.

## Read Contract

`useTransformValues`가 `position` tier를 제공하고 `TransformSection`은 inline 값을
우선해 현재 토글 상태를 계산한다. 현재 catalog factory에 absolute/fixed 기본값이
없으므로 fallback은 `static`으로 표시한다.

## Scope

- `right`, `bottom`, `relative`, `fixed`, 부모 containing block 자동 변경은 추가하지
  않는다.
- `Left`/`Top` 입력 UI는 그대로 유지한다.
- 좌표 자동 캡처는 `flex`/`inline-flex` 직계 부모에만 적용하고 block/grid 부모의
  활성화 동작은 변경하지 않는다.
- 기존 layout engine, Canvas, Preview의 absolute 처리 코드는 변경하지 않는다.

## Verification

- flex 자식의 비활성 상태에서 클릭하면 현재 scene x/y가 parent-local
  `left`/`top`으로 변환되어 `position: absolute`와 함께 batch 저장되는 회귀 테스트
- flex 자식의 bounds가 없으면 `position: absolute`만 저장되는 fallback 테스트
- 활성 상태에서 클릭하면 `position`이 제거되는 회귀 테스트
- `aria-pressed`가 현재 style과 동기화되는지 확인
- Transform reset/dirty 목록에 `position`이 포함되는지 확인
- focused Vitest, type-check, guard, cross-check, 실제 Builder 토글 검증
