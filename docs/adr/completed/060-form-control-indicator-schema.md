# ADR-060: Form Control Indicator 스키마 확장 — 매직 테이블 해체

> **SSOT domain**: D3 (시각 스타일). Checkbox/Radio/Switch/Slider의 indicator 수치를 `spec.sizes.*.indicator`로 SSOT 단일화. D3 내부 정리. 정본: [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md), charter: [ADR-063](063-ssot-chain-charter.md).

## Status

Implemented — 2026-04-13

- **Pre-Phase 0** (스키마 인프라): Implemented — `SizeSpec.indicator?: IndicatorSpec` 필드 + `IndicatorSpec` 타입 + `indicatorResolver.ts` (`getCheckboxIndicator`/`getRadioIndicator`/`getSwitchIndicator`/`getSliderIndicator`) 신설
- **Phase 1** (Checkbox): Implemented — `CHECKBOX_BOX_SIZES` 삭제, `spec.sizes.*.indicator { boxSize, boxRadius }` 주입, shapes() 참조 변경
- **Phase 2** (Radio): Implemented — `RADIO_DIMENSIONS` 삭제, `indicator { boxSize, dotSize }` 주입
- **Phase 3** (Switch): Implemented — `SWITCH_DIMENSIONS` 삭제, `indicator { trackWidth, trackHeight, thumbSize, thumbOffset }` 주입
- **Phase 4** (Slider 3자): Implemented — `SLIDER_DIMENSIONS` + `SLIDER_TRACK_DIMENSIONS` + `SLIDER_THUMB_SIZES` **3개 매직 테이블 모두 삭제**. SliderTrack/SliderThumb는 부모 `SliderSpec.sizes.*.indicator`를 `getSliderIndicator()` 헬퍼로 조회 (공유 상수 중복 소멸)
- **Phase 5** (정리): Implemented — `components/index.ts` + `specs/index.ts`에서 6개 export 제거. Slider.css 주석의 stale reference 갱신

**범위 확장**: 원래 계획 4개 매직 테이블이었으나, Slider 계열의 `SLIDER_TRACK_DIMENSIONS`와 `SLIDER_THUMB_SIZES`(중복 테이블)도 발견되어 **6개 모두 해체**.

**최종 수치**: 6개 매직 테이블 소멸, indicator 필드 18개 spec size 엔트리, type-check + build 통과.

## 원칙

본 ADR의 원칙 선언은 [ADR-057 §원칙](./057-text-spec-first-migration.md#원칙--spec-ssot--symmetric-consumers-adr-036-준수)을 그대로 상속한다.

핵심:

- **Spec이 SSOT**, CSS/Skia는 대등한 consumer
- **ADR-060의 본질**: Checkbox/Radio/Switch/Slider의 "indicator(지시자)" 크기가 `spec.sizes` 외부의 매직 상수 테이블(`CHECKBOX_BOX_SIZES` 등)에 저장되어, Skia/CSS가 각자 다른 source에서 읽는 상황을 해체한다. ADR-058의 `getTextPresetFontSize` 5-point patch와 동형의 위반 패턴이다.

## Context

Form control 컴포넌트는 "클릭 영역(container)"과 "시각적 지시자(indicator)"가 분리된 구조를 가진다:

- **Checkbox**: `<label>` 컨테이너 + 체크박스 박스 (16/20/24px) + Label 텍스트
- **Radio**: `<label>` 컨테이너 + 원형 indicator (16/20/24px) + dot (6/8/10px) + Label
- **Switch**: `<label>` 컨테이너 + track (32/40/48px × 16/20/24px) + thumb + Label
- **Slider**: 컨테이너 + track (4/8/12/16px 높이) + thumb (14/18/22/26px)

현재 각 컴포넌트의 `spec.sizes`는 **컨테이너 관점의 height/paddingX가 0으로 채워져** 있고, 실제 indicator 치수는 별도 상수 테이블에서 조회된다. Skia renderer는 이 테이블을 직접 import하며, CSS는 수동 작성으로 또 다른 값을 사용한다.

### 실측 증거 (2026-04-11)

| 컴포넌트        | 매직 테이블 위치                                                        | `spec.sizes` 상태                                | Skia 조회 위치                                        |
| --------------- | ----------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------- |
| **Checkbox**    | `Checkbox.spec.ts:69-76` `CHECKBOX_BOX_SIZES`                           | `height: 0, paddingX: 0, paddingY: 0` (L107-109) | `Checkbox.spec.ts:200` `CHECKBOX_BOX_SIZES[sizeName]` |
| **Radio**       | `Radio.spec.ts:65-73` `RADIO_DIMENSIONS`                                | `height: 0, paddingX: 0, paddingY: 0`            | `Radio.spec.ts:210` `RADIO_DIMENSIONS[sizeName]`      |
| **Switch**      | `Switch.spec.ts:43-56` `SWITCH_DIMENSIONS`                              | `height: 0, paddingX: 0, paddingY: 0`            | `Switch.spec.ts:176` `SWITCH_DIMENSIONS[sizeName]`    |
| **Slider**      | `Slider.spec.ts:86-93` `SLIDER_DIMENSIONS`                              | 일부 비어있음                                    | `Slider.spec.ts:393` `SLIDER_DIMENSIONS[sizeName]`    |
| **SliderTrack** | `SliderTrack.spec.ts:139` `SLIDER_DIMENSIONS` import                    | (import만)                                       | 직접 import                                           |
| **SliderThumb** | `SliderThumb.spec.ts:28` 독립 주석 (`SLIDER_DIMENSIONS.thumbSize 동기`) | 수동 복제                                        | 독립 값                                               |

**결과**:

1. `spec.sizes`가 indicator 크기를 **표현하지 못함** — 컨테이너 기준 스키마로 고정
2. `packages/specs/src/components/index.ts:76-125`에서 4개 테이블을 **별도 export**하여 외부 모듈이 직접 import
3. CSS (`Checkbox.css`, `Radio.css`, `Switch.css`, `Slider.css`)는 이 상수를 참조하지 못하고 **독립 리터럴 값** 사용 → 수치 동기화 수동

### Text 케이스와의 동형성 (ADR-058 참조)

| 축                  | Text `getTextPresetFontSize`               | Form Control `*_DIMENSIONS`                       |
| ------------------- | ------------------------------------------ | ------------------------------------------------- |
| 스키마 밖 헬퍼 소스 | `packages/shared/src/utils/textPresets.ts` | `{Component}.spec.ts` 상단 상수                   |
| 분산 호출 횟수      | 5곳 (buildTextNodeData + 4 layout 유틸)    | 4 spec × 각 shapes() + CSS 파일 + index.ts export |
| `spec.sizes` 역할   | 빈 `shapes: () => []`                      | 빈 `height: 0, paddingX: 0`                       |
| 증상                | size prop 변경 미반영                      | size 변경 시 CSS/Skia 수치 오차                   |
| 해결 패턴           | spec 경로로 흡수                           | spec.sizes 스키마 확장                            |

### Hard Constraints

1. **Preview DOM 구조 불변** — `<label>` + React Aria hooks 생성 DOM 보존
2. **ADR-048 S2 선언적 Props Propagation 호환** — size prop 전파 경로 무회귀
3. **Label size delegation 무회귀** — `LABEL_DELEGATION_PARENT_TAGS` (layout-engine.md) 경로 보존
4. **외관 ≤1px** — 전환 전후 Screenshot diff
5. **매직 테이블 export 제거** — `index.ts:76-125`의 4개 export 완전 소멸
6. **타입 안정성** — `spec.sizes.*.indicator` 필드가 Checkbox/Radio/Switch/Slider 아닌 컴포넌트에는 주입되지 않도록 타입 분기

### Soft Constraints

- 향후 `Toggle`, `ColorSwatch`, `ProgressCircle` 등 indicator 계열 추가 시 동일 스키마 재사용
- `SliderThumb`/`SliderTrack`의 독립 spec에서도 부모 Slider의 indicator 값 참조 가능

## 의존성

- **ADR-048** (선행 완료): S2 선언적 Props Propagation — size 전파 인프라가 확립된 상태
- **ADR-042** (선행 완료): Spec Container Dimension Injection — `_containerWidth`/`_containerHeight` 주입 경로 이해 전제
- **ADR-058** (참조 패턴): Text 5-point patch 해체 사례
- **ADR-059** (병행 권장): Composite skipCSSGeneration 해체 — Checkbox/Radio/Switch의 `skipCSSGeneration` 상태 공동 처리
- **ADR-056** (시너지): Base Typography SSOT — Label 크기 주입 지점 일원화

## Alternatives Considered

### 대안 A: 현상 유지 (매직 테이블 유지)

- 설명: 4개 `*_DIMENSIONS` 상수 테이블 유지, `index.ts` export 유지, CSS는 수동 리터럴 계속 사용
- 근거: 최소 변경
- 위험:
  - 기술: L
  - 성능: L
  - 유지보수: **H** — CSS ↔ 상수 테이블 수동 동기화, 새 size variant (예: `xl`) 추가 시 4곳 이상 동시 수정
  - 마이그레이션: L

### 대안 B: `spec.sizes.*.indicator` 필드 추가 (본 제안)

- 설명: `ComponentSpec.sizes.md.indicator: { boxSize: 20, boxRadius: 4, dotSize?: 8, trackWidth?: 40, thumbSize?: 18 }` 형태로 스키마 확장. Archetype `toggle-indicator`/`slider` 전용 필드로 타입 분기
- 근거:
  - 단일 SSOT — spec.sizes 하위로 통합
  - archetype 타입 분기로 타입 안정성 확보
  - CSS Generator가 자동으로 CSS 변수 (`--checkbox-box-size` 등) 생성 가능
- 위험:
  - 기술: M — `ComponentSpec` 타입 확장 + archetype 별 필드 타입 분기
  - 성능: L
  - 유지보수: L
  - 마이그레이션: M — 4개 컴포넌트 전환, 상수 테이블 import 사용처 제거

### 대안 C: 별도 `spec.indicator` 필드 신설 (sizes와 병렬)

- 설명: `spec.indicator.md = { boxSize: 20, ... }` 형태로 sizes와 별개 필드 도입
- 근거: size 관점의 분리 명확
- 위험:
  - 기술: M
  - 성능: L
  - 유지보수: M — sizes와 indicator 2개 source를 synchronized 유지해야 함 (size 변경 시 indicator도 변경 필요)
  - 마이그레이션: M

### 대안 D: Archetype-specific 스키마 + 전용 helper

- 설명: `ToggleIndicatorArchetype.schema.indicator` 별도 정의, 컴포넌트 spec은 archetype에서 상속
- 근거: archetype 재사용성 극대
- 위험:
  - 기술: **H** — archetype 상속 메커니즘 신규 구현 (현재 archetype은 마커 역할)
  - 성능: L
  - 유지보수: L
  - 마이그레이션: **H** — archetype 시스템 재설계 필요

### 대안 E: 매직 테이블을 design token으로 이동

- 설명: `CHECKBOX_BOX_SIZES`를 `packages/specs/src/tokens/indicators.ts` 같은 토큰 파일로 이동, 각 spec은 `{indicator.checkbox.md.boxSize}` 형태로 TokenRef 참조
- 근거: 토큰 시스템 일관성
- 위험:
  - 기술: M — TokenRef resolver 확장 (현재는 color/typography만 지원)
  - 성능: L
  - 유지보수: M — indicator 토큰이 size variant와 1:1 매칭되어야 하는 제약
  - 마이그레이션: M

### Risk Threshold Check

| 대안                            | 기술  | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ------------------------------- | ----- | ---- | -------- | ------------ | :--------: |
| A (현상 유지)                   | L     | L    | **H**    | L            |     1      |
| B (**sizes.\*.indicator 필드**) | M     | L    | L        | M            |     0      |
| C (별도 spec.indicator)         | M     | L    | M        | M            |     0      |
| D (Archetype-specific 스키마)   | **H** | L    | L        | **H**        |     2      |
| E (design token 이동)           | M     | L    | M        | M            |     0      |

루프 판정: 대안 A는 유지보수 H 1개(수동 동기화 영속화). 대안 D는 2개로 배제. 대안 B/C/E 중 선택.

**선택 기준**: 단일 source 원칙 + 타입 안정성 + 최소 스키마 변경.

## Decision

**대안 B: `spec.sizes.*.indicator` 필드 추가 + archetype 별 타입 분기**를 선택한다.

기각 사유:

- **대안 A**: 매직 테이블 영속화는 근본 해결 아님
- **대안 C**: 두 source(sizes + indicator) 유지 → "SSOT 단일화 목표 미달성"
- **대안 D**: archetype 시스템 재설계는 본 ADR 범위 초과
- **대안 E**: Color/Typography와 달리 indicator 수치는 컴포넌트 고유 → 토큰 파일로 추상화하면 재사용성 낮고 오히려 분산 증가

### 실행 구조 (요약)

- **Pre-Phase 0** (Phase 1~4 선행): `ComponentSpec.sizes` 타입 확장 — `indicator?: { boxSize?: number, boxRadius?: number, dotSize?: number, trackWidth?: number, trackHeight?: number, thumbSize?: number }` 선택적 필드 추가. Archetype `toggle-indicator`/`slider` 타입 가드 정의
- **Phase 1** — **Checkbox 시험대** — `CHECKBOX_BOX_SIZES`를 `spec.sizes.*.indicator`로 병합. Skia shapes()가 `size.indicator.boxSize` 참조. `index.ts` export 제거. CSS 자동 생성 규칙에 `--checkbox-box-size` 추가
- **Phase 2** — **Radio 전환** — `RADIO_DIMENSIONS` 해체. Checkbox 패턴 복제
- **Phase 3** — **Switch 전환** — `SWITCH_DIMENSIONS` 해체. `trackWidth/trackHeight/thumbSize` 3개 필드 활용
- **Phase 4** — **Slider + SliderTrack + SliderThumb 전환** — `SLIDER_DIMENSIONS` 해체 + 3개 하위 spec의 독립 참조 해제
- **Phase 5** — **index.ts export 4개 제거 + 매직 테이블 상수 완전 삭제** + 잔존 import grep 0건 확인

> 구현 상세: [060-form-control-indicator-breakdown.md](../design/completed/060-form-control-indicator-breakdown.md)

## Gates

잔존 HIGH 위험 없음. Pre-Phase 0 타입 확장이 기존 컴포넌트에 영향을 주지 않는 것이 최대 관심사.

| Gate                       | 시점             | 통과 조건                                                                                                                                  | 실패 시 대안                  |
| -------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| 타입 확장 무회귀           | Pre-Phase 0 완료 | 기존 59개 이상 `skipCSSGeneration` 컴포넌트의 `pnpm type-check` 무회귀, `spec.sizes` 구조 기존 spec 파일 수정 없이 컴파일 통과             | 타입 확장 롤백, 스키마 재검토 |
| Checkbox 전환              | Phase 1 완료     | `CHECKBOX_BOX_SIZES` grep 0건, `spec.sizes.md.indicator.boxSize === 20`, Skia 렌더링 ≤1px, CSS 자동 생성 결과에 `--checkbox-box-size` 포함 | Phase 1 롤백, 상수 복원       |
| Radio 전환                 | Phase 2 완료     | `RADIO_DIMENSIONS` grep 0건, dot size 정확, Skia ≤1px                                                                                      | Phase 2 롤백                  |
| Switch 전환                | Phase 3 완료     | `SWITCH_DIMENSIONS` grep 0건, track/thumb 비율 정확, Skia ≤1px                                                                             | Phase 3 롤백                  |
| Slider 전환                | Phase 4 완료     | `SLIDER_DIMENSIONS` grep 0건, trackHeight/thumbSize 정확, SliderThumb/SliderTrack 하위 spec도 `size.indicator` 경유, Skia ≤1px             | Phase 4 롤백                  |
| index.ts export 제거       | Phase 5 완료     | `index.ts:76-125`에서 4개 export 제거 확인, 외부 모듈에서 `CHECKBOX_BOX_SIZES` 등 import 0건                                               | export 복원 후 사용처 재조사  |
| ADR-048 propagation 무회귀 | 각 Phase 완료    | size prop 전파 시 indicator 값이 정확하게 반영 (ADR-048 Phase 5 테스트 통과)                                                               | propagation 경로 분리 유지    |
| Label delegation 무회귀    | 각 Phase 완료    | `LABEL_DELEGATION_PARENT_TAGS`에 Checkbox/Radio/Switch 포함 상태 유지, DFS injection 무회귀 (layout-engine.md §Label size delegation)      | layout-engine 경로 분리 유지  |

## Consequences

### Positive

- **SSOT 단일화** — indicator 크기가 spec.sizes 하위로 통합
- **매직 테이블 4개 소멸** — `CHECKBOX_BOX_SIZES`, `RADIO_DIMENSIONS`, `SWITCH_DIMENSIONS`, `SLIDER_DIMENSIONS` 완전 제거
- **index.ts 정리** — 4개 external export 제거로 public API 축소
- **CSS 자동 생성 가능** — ADR-059 CSSGenerator 확장과 시너지로 `--checkbox-box-size` 등 CSS 변수 자동 파생
- **새 Form control 추가 비용 감소** — 신규 indicator 컴포넌트는 `spec.sizes.*.indicator` 필드로 바로 선언
- **SliderThumb/SliderTrack 독립성 개선** — 부모 Slider의 indicator 참조 경로 명확화
- **타입 안정성 향상** — archetype 별 타입 분기로 잘못된 컴포넌트에 indicator 필드 주입 방지
- **ADR-048 propagation 안정화** — size 전파 시 indicator 값도 자동 전파

### Negative

- **스키마 확장 부담** — `ComponentSpec.sizes` 타입 정의 파일 수정 + 전체 spec 파일 타입 체크 전파
- **Pre-Phase 0 타입 분기 복잡도** — archetype 별 optional 필드 타입 가드 작성
- **CSS 변수 네이밍 규약 신설** — `--{component}-indicator-{field}` 형식 확정 필요
- **마이그레이션 4 Phase** — 중단 시 부분 통합 상태 유지
- **SliderThumb/SliderTrack 3자 관계** — Slider 부모 spec을 parent로 참조하는 패턴이 필요할 수 있음 (현재는 단순 import)

### 후속 작업

- **ProgressCircle/ColorSwatch indicator 편입** — 동일 스키마로 확장
- **ADR-036 재승격 준비** — ADR-058 + ADR-059 + ADR-060 + ADR-061 완료 시 ADR-036 "Fully Implemented" 재평가
- **Checkbox/Radio/Switch composition CSS 자동화** — ADR-059 Phase 4에서 Checkbox/Radio/Switch의 composition.delegation 자동 생성 시 본 ADR의 indicator 필드 활용
