# ADR-061 Breakdown: Focus Ring 토큰화

> 상위 ADR: [061-focus-ring-tokenization.md](../../completed/061-focus-ring-tokenization.md)

## 토큰 스키마 설계

### CSS 변수 (신설)

```css
/* packages/shared/src/components/styles/theme/focus-ring.css (신설) */

:root {
  /* Default focus ring */
  --focus-ring-width: 2px;
  --focus-ring-style: solid;
  --focus-ring-color: var(--accent);
  --focus-ring-offset: 2px;

  /* Inset variant (Slider thumb 등) */
  --focus-ring-inset-width: 2px;
  --focus-ring-inset-offset: -2px; /* 음수 offset = inset */
}
```

### TokenRef 타입 확장

```ts
// packages/specs/src/types/spec.types.ts (확장)

export type FocusRingVariant = "default" | "inset";

export interface FocusRingStateSpec {
  // 기존 리터럴 outline/outlineOffset 제거
  // TokenRef 형태로 치환
  focusRing?: TokenRef; // "{focus.ring.default}" | "{focus.ring.inset}"
}

// 기존
export interface StateSpec {
  focusVisible?: {
    outline?: string; // ❌ 리터럴
    outlineOffset?: string; // ❌ 리터럴
    // ... + focusRing?: TokenRef 추가
    focusRing?: TokenRef; // ✅ 토큰 참조
  };
}
```

### tokenResolver 확장

```ts
// packages/specs/src/runtime/tokenResolver.ts (확장)

const FOCUS_RING_TOKENS: Record<string, { outline: string; offset: string }> = {
  "focus.ring.default": {
    outline:
      "var(--focus-ring-width) var(--focus-ring-style) var(--focus-ring-color)",
    offset: "var(--focus-ring-offset)",
  },
  "focus.ring.inset": {
    outline:
      "var(--focus-ring-inset-width) var(--focus-ring-style) var(--focus-ring-color)",
    offset: "var(--focus-ring-inset-offset)",
  },
};

export function resolveFocusRingToken(ref: TokenRef): {
  outline: string;
  outlineOffset: string;
} {
  const key = ref.replace(/[{}]/g, "");
  const token = FOCUS_RING_TOKENS[key];
  if (!token) throw new Error(`Unknown focus ring token: ${ref}`);
  return { outline: token.outline, outlineOffset: token.offset };
}
```

### CSS Generator 출력 예시

```css
/* 전환 전 */
.react-aria-Button[data-focus-visible] {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* 전환 후 */
.react-aria-Button[data-focus-visible] {
  outline: var(--focus-ring-width) var(--focus-ring-style)
    var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}
```

## 파일 인벤토리

### Pre-Phase 0 수정 대상

| 파일                                                                | 변경 내용                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------- |
| `packages/shared/src/components/styles/theme/focus-ring.css` (신설) | 4+2개 CSS 변수 정의                                     |
| `packages/shared/src/components/styles/theme/index.css`             | `focus-ring.css` import 추가                            |
| `packages/specs/src/types/spec.types.ts`                            | `StateSpec.focusVisible.focusRing?: TokenRef` 필드 추가 |
| `packages/specs/src/runtime/tokenResolver.ts`                       | `resolveFocusRingToken` 추가, `FOCUS_RING_TOKENS` 상수  |
| `packages/specs/src/runtime/CSSGenerator.ts`                        | focus ring TokenRef 처리 분기 추가                      |

### Phase 1 — 시험대 5개

| Spec 파일                                         | 위치                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| `packages/specs/src/components/Button.spec.ts`    | `states.focusVisible.outline` 리터럴 → `focusRing: "{focus.ring.default}"` |
| `packages/specs/src/components/TextField.spec.ts` | 동일                                                                       |
| `packages/specs/src/components/Checkbox.spec.ts`  | 동일                                                                       |
| `packages/specs/src/components/Radio.spec.ts`     | 동일                                                                       |
| `packages/specs/src/components/Link.spec.ts`      | 동일                                                                       |

### Phase 2 — Field 계열 12개

NumberField, SearchField, ColorField, DateField, TimeField, TextArea, Select, ComboBox, DatePicker, DateRangePicker, ColorPicker, Slider

### Phase 3 — 잔존 33개

Tag, Tab, Panel, Card, Calendar, Disclosure, ColorArea, ColorSlider, ColorWheel, ColorSwatch, ColorSwatchPicker, CheckboxGroup, RadioGroup, Pagination, Tree, Table, ButtonGroup, Nav, ToggleButton, ToggleButtonGroup, DateSegment, FileTrigger, DropZone, TagGroup, SelectTrigger, Switch, SliderThumb, Toolbar, Breadcrumb, Breadcrumbs, Input, MaskedFrame, List, ListBox, Switcher, DisclosureGroup

### Phase 5 — Inset variant 도입

| 파일                                                | 적용 이유                                                 |
| --------------------------------------------------- | --------------------------------------------------------- |
| `packages/specs/src/components/SliderThumb.spec.ts` | Thumb 내부 focus ring (외부 outline은 컨테이너 경계 침범) |
| `packages/specs/src/components/Switch.spec.ts`      | Thumb 내부 focus ring                                     |
| `packages/specs/src/components/ColorSwatch.spec.ts` | Swatch 경계 내부 focus ring                               |

## 작업 순서

### Pre-Phase 0 — 토큰 인프라

1. `focus-ring.css` 신설, 4+2개 CSS 변수 정의
2. `theme/index.css`에 import 추가
3. `spec.types.ts`에 `StateSpec.focusVisible.focusRing?: TokenRef` 추가 (기존 outline/outlineOffset은 일단 유지 — 하위 호환)
4. `tokenResolver.ts`에 `resolveFocusRingToken` + `FOCUS_RING_TOKENS` 상수
5. `CSSGenerator.ts`에서 `state.focusVisible.focusRing` 감지 시 TokenRef 해석 → CSS 출력
6. 단위 테스트: `tokenResolver.test.ts`에 focus ring 케이스 추가
7. 샘플 spec (예: Button) 전환 없이 CSS 변수 기반 샘플 출력 확인

### Phase 1 — 시험대 5개

1. Button.spec.ts:
   - `focusVisible.outline`, `focusVisible.outlineOffset` 리터럴 제거
   - `focusVisible.focusRing: "{focus.ring.default}"` 추가
2. TextField/Checkbox/Radio/Link 동일 패턴 적용
3. `pnpm build:specs` → generated CSS 확인
4. Storybook 5개 컴포넌트 focus-visible 상태 screenshot diff 실행
5. CSS 변수 해석 결과가 기존 리터럴과 동일한 outline/offset 값인지 확인
6. Dark mode 전환 + accent override 테스트

### Phase 2 — Field 계열 12개

- Phase 1 패턴 복제
- 일괄 전환 가능 (구조 동일)
- `pnpm build:specs` + type-check + screenshot diff

### Phase 3 — 잔존 33개

- 3개 서브 그룹으로 나누어 전환:
  - 3a: Form controls (CheckboxGroup, RadioGroup, ButtonGroup, ToggleButton, ToggleButtonGroup, Switch, SliderThumb, Tag, TagGroup)
  - 3b: Navigation/Layout (Tab, Panel, Card, Disclosure, DisclosureGroup, Pagination, Tree, Table, Toolbar, Breadcrumb, Breadcrumbs, Nav, Switcher, List, ListBox)
  - 3c: Color picker 계열 (Calendar, ColorArea, ColorSlider, ColorWheel, ColorSwatch, ColorSwatchPicker, DateSegment, FileTrigger, DropZone, SelectTrigger, Input, MaskedFrame)
- 각 서브 그룹 완료 시 grep 확인

### Phase 4 — 검증 + 리터럴 필드 제거

1. `grep "outline: \"2px solid var(--accent)\""` 0건 확인
2. `grep "outlineOffset: \"2px\""` (spec 파일 범위) 0건 확인
3. `spec.types.ts`의 `StateSpec.focusVisible.outline/outlineOffset` 필드 deprecated 표시 또는 제거
4. ESLint rule `no-focus-ring-literal` 신설 (선택)

### Phase 5 — Inset variant

1. `{focus.ring.inset}` 토큰 활성화 (Pre-Phase 0에서 이미 정의됨)
2. SliderThumb, Switch (thumb), ColorSwatch 전환
3. 외관 검증 — inset ring이 컨테이너 내부에 정확히 렌더링

## CSS 변수 충돌 조사

Pre-Phase 0 시작 전 확인:

```bash
grep -r "\-\-focus\-ring\-" packages/shared/src/components/styles/
grep -r "\-\-focus\-" packages/shared/src/components/styles/
```

충돌 시 prefix 변경 (예: `--composition-focus-ring-width`).

## 회귀 진단 절차

### 단위 1: Screenshot diff

- Storybook + Playwright visual regression
- 각 컴포넌트의 `focusVisible` 상태 (Tab key로 포커스 후 캡처)
- threshold: 픽셀 완전 일치 (focus ring은 outline 렌더링이라 sub-pixel 이슈 없음)

### 단위 2: Dark mode

- Light/Dark 전환 후 focus ring 색상 변경 확인
- `--accent` 값이 dark mode에서 조정된 경우 focus ring도 따라 변경

### 단위 3: per-element accent override (ADR-021)

- 특정 element에 `style: { "--accent": "red" }` 주입
- focus-visible 시 focus ring 색상이 red 반영

### 단위 4: Skia 경로

- CanvasKit renderer가 focus ring 렌더링 시 동일 TokenRef 경유 확인
- `canvas-rendering.md` §Dark Mode Token 규칙 준수

## 체크리스트

### Pre-Phase 0

- [ ] `focus-ring.css` 신설
- [ ] CSS 변수 4+2개 정의
- [ ] theme/index.css import 추가
- [ ] `StateSpec.focusVisible.focusRing` 필드 타입 정의
- [ ] `FOCUS_RING_TOKENS` 상수 정의
- [ ] `resolveFocusRingToken` 헬퍼 구현
- [ ] CSSGenerator 분기 추가
- [ ] 단위 테스트 통과
- [ ] 기존 spec 파일 `pnpm type-check` 통과 (수정 없이)

### Phase 1 (시험대 5개)

- [ ] Button.spec.ts 전환
- [ ] TextField.spec.ts 전환
- [ ] Checkbox.spec.ts 전환
- [ ] Radio.spec.ts 전환
- [ ] Link.spec.ts 전환
- [ ] 5개 screenshot diff 픽셀 완전 일치
- [ ] Dark mode 전환 정상
- [ ] Skia 렌더링 무회귀

### Phase 2 (Field 12개)

- [ ] 12개 전환 + screenshot diff 통과

### Phase 3 (잔존 33개)

- [ ] 3a/3b/3c 서브 그룹 전환 + grep 확인

### Phase 4

- [ ] `grep "outline: \"2px solid var(--accent)\""` 0건
- [ ] `grep "outlineOffset: \"2px\""` (spec 범위) 0건
- [ ] `StateSpec.focusVisible.outline` 필드 deprecated 또는 제거

### Phase 5 (Inset variant)

- [ ] SliderThumb inset focus ring 렌더링 정확
- [ ] Switch inset focus ring 정확
- [ ] ColorSwatch inset focus ring 정확

## 롤백 전략

- Phase N 실패 시: 해당 spec의 `focusRing: TokenRef`를 원래 리터럴(`outline`, `outlineOffset`)로 복원
- Pre-Phase 0 실패 시: CSS 변수 제거, `StateSpec` 타입 revert
- Phase 4 (필드 제거) 실패 시: `outline/outlineOffset` 필드 유지
- Phase 5 (inset) 실패 시: 해당 컴포넌트만 개별 리터럴로 롤백 (나머지 default variant 유지)
