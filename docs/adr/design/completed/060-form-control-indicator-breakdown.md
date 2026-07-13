# ADR-060 Breakdown: Form Control Indicator 스키마 확장

> 상위 ADR: [060-form-control-indicator-schema.md](../../completed/060-form-control-indicator-schema.md)

## 스키마 확장 설계

### `ComponentSpec.sizes.*.indicator` 필드 타입

```ts
// packages/specs/src/types/spec.types.ts (확장)

export interface SizeSpec {
  height: number;
  paddingX: number;
  paddingY: number;
  fontSize?: string | TokenRef;
  gap?: number;
  borderRadius?: string | TokenRef;

  /**
   * Form control indicator 치수 (ADR-060)
   * archetype === "toggle-indicator" | "slider" 인 컴포넌트 전용
   */
  indicator?: IndicatorSpec;
}

export interface IndicatorSpec {
  /** Checkbox box, Radio outer circle */
  boxSize?: number;
  /** Checkbox radius, Radio radius */
  boxRadius?: number;
  /** Radio inner dot, Switch thumb dot */
  dotSize?: number;

  /** Switch/Slider track width */
  trackWidth?: number;
  /** Switch/Slider track height */
  trackHeight?: number;
  /** Switch/Slider thumb size */
  thumbSize?: number;
}
```

### Archetype 별 유효 필드

| Archetype          | 해당 컴포넌트            | 유효 필드                                           |
| ------------------ | ------------------------ | --------------------------------------------------- |
| `toggle-indicator` | Checkbox                 | `boxSize`, `boxRadius`                              |
| `toggle-indicator` | Radio                    | `boxSize`, `boxRadius`, `dotSize`                   |
| `toggle-indicator` | Switch                   | `trackWidth`, `trackHeight`, `thumbSize`, `dotSize` |
| `slider`           | Slider                   | `trackHeight`, `thumbSize`                          |
| `slider`           | SliderTrack, SliderThumb | 부모 Slider의 `indicator` 상속                      |

### 런타임 타입 가드

```ts
// packages/specs/src/runtime/indicatorResolver.ts (신설)

export function getCheckboxIndicator(spec: ComponentSpec, sizeName: string) {
  const size = spec.sizes?.[sizeName] ?? spec.sizes?.md;
  const box = size?.indicator?.boxSize ?? 20;
  const radius = size?.indicator?.boxRadius ?? 4;
  return { box, radius };
}

export function getSliderIndicator(spec: ComponentSpec, sizeName: string) {
  const size = spec.sizes?.[sizeName] ?? spec.sizes?.md;
  const trackHeight = size?.indicator?.trackHeight ?? 8;
  const thumbSize = size?.indicator?.thumbSize ?? 18;
  return { trackHeight, thumbSize };
}
```

## 파일 인벤토리

### Pre-Phase 0 수정 대상

| 파일                                                     | 변경 내용                                                 |
| -------------------------------------------------------- | --------------------------------------------------------- |
| `packages/specs/src/types/spec.types.ts`                 | `SizeSpec.indicator` 필드 추가, `IndicatorSpec` 타입 신설 |
| `packages/specs/src/runtime/indicatorResolver.ts` (신설) | archetype 별 타입 가드 헬퍼                               |
| `packages/specs/src/runtime/CSSGenerator.ts`             | `indicator` 필드 → CSS 변수 파생 규칙                     |
| `packages/specs/src/components/index.ts:76-125`          | 4개 `*_DIMENSIONS` export 제거 대상                       |

### Phase 1 — Checkbox

| 파일                                                 | 변경 내용                                                                                 |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `packages/specs/src/components/Checkbox.spec.ts`     | L69-76 `CHECKBOX_BOX_SIZES` 제거, L107-109 `size.indicator` 주입, L200 shapes() 참조 변경 |
| `packages/shared/src/components/styles/Checkbox.css` | 리터럴 `16px/20px/24px` → `var(--checkbox-indicator-box-size)` 교체                       |

### Phase 2 — Radio

| 파일                                              | 변경 내용                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------ |
| `packages/specs/src/components/Radio.spec.ts`     | L65-73 `RADIO_DIMENSIONS` 제거, `size.indicator` 주입, L210 shapes() 참조 변경 |
| `packages/shared/src/components/styles/Radio.css` | 동일 패턴                                                                      |

### Phase 3 — Switch

| 파일                                               | 변경 내용                                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `packages/specs/src/components/Switch.spec.ts`     | L43-56 `SWITCH_DIMENSIONS` 제거, `size.indicator`에 trackWidth/trackHeight/thumbSize, L176 shapes() 참조 변경 |
| `packages/shared/src/components/styles/Switch.css` | 동일 패턴                                                                                                     |

### Phase 4 — Slider + SliderTrack + SliderThumb

| 파일                                                | 변경 내용                                                                               |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `packages/specs/src/components/Slider.spec.ts`      | L86-93 `SLIDER_DIMENSIONS` 제거, `size.indicator.trackHeight/thumbSize`, L393 참조 변경 |
| `packages/specs/src/components/SliderTrack.spec.ts` | L12 import 제거, L139 참조 변경 → 부모 Slider 상속 경로 확보                            |
| `packages/specs/src/components/SliderThumb.spec.ts` | L28 주석 + 독립 값 제거, 부모 Slider 상속                                               |
| `packages/shared/src/components/styles/Slider.css`  | 리터럴 → CSS 변수 교체                                                                  |

### Phase 5 — 완전 정리

- `packages/specs/src/components/index.ts` L76, L89, L101, L125 export 라인 삭제
- 전체 grep `CHECKBOX_BOX_SIZES|RADIO_DIMENSIONS|SWITCH_DIMENSIONS|SLIDER_DIMENSIONS` → 0건

## 작업 순서

### Pre-Phase 0 — 타입 확장

1. `spec.types.ts`에 `IndicatorSpec` 타입 + `SizeSpec.indicator` optional 필드 추가
2. `indicatorResolver.ts` 신설 (archetype 별 타입 가드)
3. `pnpm type-check` — 기존 spec 파일 전부 컴파일 통과 확인 (indicator는 optional이므로 기존 spec 무수정)
4. CSSGenerator에 `indicator` 필드 처리 로직 추가 (Phase 1에서 실제 사용)
5. 단위 테스트: `indicatorResolver.test.ts` 신설

### Phase 1 — Checkbox 시험대

1. `Checkbox.spec.ts`의 `sizes.sm/md/lg`에 `indicator: { boxSize: 16/20/24, boxRadius: 4/4/6 }` 주입
2. shapes() 함수에서 `const boxDims = CHECKBOX_BOX_SIZES[sizeName]` → `getCheckboxIndicator(spec, sizeName)` 교체
3. `CHECKBOX_BOX_SIZES` 상수 삭제
4. `index.ts:76` export 라인 삭제
5. CSS 자동 생성 규칙 확장: `indicator.boxSize` → `--checkbox-indicator-box-size` 변수 생성
6. `Checkbox.css`에서 리터럴 `16px/20px/24px` → `var(--checkbox-indicator-box-size)` 교체
7. Storybook + Skia screenshot diff

### Phase 2 — Radio

- Checkbox 패턴 복제
- 추가 필드: `dotSize` (inner dot)
- shapes() 함수 2곳 참조 변경 (outer circle + inner dot)

### Phase 3 — Switch

- `trackWidth`, `trackHeight`, `thumbSize`, `dotSize` 4개 필드 활용
- track 비율 유지 (Switch 32:16, 40:20, 48:24)
- thumb position 계산 로직 검증 (`trackWidth - thumbSize - padding`)

### Phase 4 — Slider 3자 관계

1. `Slider.spec.ts`에 `indicator.trackHeight/thumbSize` 주입
2. `SliderTrack.spec.ts`에서 부모 Slider spec 조회 헬퍼 사용:
   ```ts
   // SliderTrack은 자식 spec이므로 부모 Slider의 indicator를 상속
   const parentSlider = registry.getSpec("Slider");
   const sliderIndicator = getSliderIndicator(parentSlider, sizeName);
   ```
3. `SliderThumb.spec.ts` 동일 패턴
4. 3개 spec의 독립 수치 소멸 확인

### Phase 5 — 정리

1. `index.ts` 4개 export 라인 삭제
2. 매직 테이블 상수 완전 삭제 (Phase 1~4에서 각각 삭제 완료 상태 재확인)
3. grep `_DIMENSIONS|BOX_SIZES` 0건 확인
4. `pnpm type-check` + Storybook 전수 통과

## CSS 변수 네이밍 규약

| Spec 필드               | CSS 변수                               |
| ----------------------- | -------------------------------------- |
| `indicator.boxSize`     | `--{component}-indicator-box-size`     |
| `indicator.boxRadius`   | `--{component}-indicator-box-radius`   |
| `indicator.dotSize`     | `--{component}-indicator-dot-size`     |
| `indicator.trackWidth`  | `--{component}-indicator-track-width`  |
| `indicator.trackHeight` | `--{component}-indicator-track-height` |
| `indicator.thumbSize`   | `--{component}-indicator-thumb-size`   |

예: Checkbox md size → `--checkbox-indicator-box-size: 20px; --checkbox-indicator-box-radius: 4px;`

## 회귀 진단 절차

### 단위 1: Skia shapes() 출력

- Checkbox shapes() 호출 시 반환되는 box width/height/radius 값이 Phase 1 전후 동일
- screenshot diff ≤1px

### 단위 2: CSS 변수 생성

- `generated/Checkbox.css`에 `--checkbox-indicator-box-size: 20px` 등 변수 존재
- `Checkbox.css` 수동 override에서 변수 소비 확인

### 단위 3: ADR-048 Propagation

- Checkbox 부모에서 size="lg" 전파 시 indicator도 lg (boxSize: 24) 반영
- ADR-048 Phase 5 테스트 suite 실행

### 단위 4: Label size delegation 무회귀

- `LABEL_DELEGATION_PARENT_TAGS`의 Checkbox/Radio/Switch 포함 상태 유지
- Label fontSize가 부모 size에 따라 올바르게 주입

## 체크리스트 (각 Phase 완료 시)

### Pre-Phase 0

- [ ] `IndicatorSpec` 타입 정의
- [ ] `SizeSpec.indicator` optional 필드 추가
- [ ] `indicatorResolver.ts` 신설
- [ ] 기존 spec 파일 `pnpm type-check` 통과 (수정 없이)
- [ ] CSSGenerator에 indicator 처리 로직 추가
- [ ] 단위 테스트 통과

### Phase 1 (Checkbox)

- [ ] `CHECKBOX_BOX_SIZES` 상수 삭제
- [ ] `spec.sizes.*.indicator` 주입 완료
- [ ] `index.ts:76` export 삭제
- [ ] CSS 변수 `--checkbox-indicator-box-size` 생성 확인
- [ ] `Checkbox.css` 리터럴 제거
- [ ] Storybook screenshot diff ≤1px
- [ ] Skia 렌더링 ≤1px
- [ ] ADR-048 propagation 무회귀
- [ ] Label delegation 무회귀

### Phase 2~4

- Phase 1 체크리스트 복제 + archetype 고유 필드 검증

### Phase 5

- [ ] 4개 export 완전 제거
- [ ] `grep CHECKBOX_BOX_SIZES` 0건
- [ ] `grep RADIO_DIMENSIONS` 0건
- [ ] `grep SWITCH_DIMENSIONS` 0건
- [ ] `grep SLIDER_DIMENSIONS` 0건
- [ ] `pnpm type-check` 통과
- [ ] `pnpm build:specs` 통과

## 롤백 전략

- Phase N 실패 시: 해당 컴포넌트의 `*_DIMENSIONS` 상수 복원, `spec.sizes.*.indicator` 제거, `index.ts` export 복원
- Pre-Phase 0 실패 시: 타입 확장 revert, 후속 Phase 차단
- Phase 4 (Slider 3자) 실패 시: SliderTrack/SliderThumb의 독립 값 복원, 부모 상속 경로 보류
