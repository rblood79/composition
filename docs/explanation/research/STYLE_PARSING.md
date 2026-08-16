# 스타일 패널 파싱 최적화 리서치

## 요약

현재 시스템은 JavaScript 객체 기반 + WebGL(PixiJS) 렌더링이므로 CSS 파싱 라이브러리(Lightning CSS, CSSTree, PostCSS)는 **부적합**합니다.
대신 **구조적 최적화(StyleValues 분할)**로 성능을 개선합니다.

### 핵심 전략

1. **StyleValues 섹션별 분할**: 28개 → 4~11개씩 분리, 75% 재계산 감소
2. **colord 도입**: 색상 파싱/변환 안정화 (1.7KB)
3. **점진적 마이그레이션**: 기존 코드 호환성 유지

> **참고**: 현재 빌더는 WebGL(PixiJS) 기반이므로 CSS Typed OM은 적용 불가

---

## 1. 현재 시스템 분석

### 1.1 현재 아키텍처

```
요소 선택 → useSelectedElementData() → mapElementToSelectedElement()
                                              ↓
                                    SelectedElement {
                                      style: CSSProperties (inline)
                                      computedStyle: CSSProperties
                                    }
                                              ↓
                                    useStyleValues() → StyleValues (28개 속성)
                                              ↓
                          ┌─────────────┼─────────────┐
                          ↓             ↓             ↓
                  TransformSection  LayoutSection  AppearanceSection ...
```

### 1.2 현재 병목 지점

1. **선택 시 전체 StyleValues 재계산**: 28개 속성 매번 추출
2. **LayoutSection 9개 속성 비교**: padding/margin 4방향씩
3. **WebGL 캔버스 ↔ 스타일 패널 동기화**: 양방향 데이터 흐름
4. **styleConverter.ts 변환 비용**: CSS 속성 → PixiJS 속성 변환

---

## 2. 라이브러리 평가

### 2.1 Lightning CSS (Rust/WASM)

| 항목       | 내용                           |
| ---------- | ------------------------------ |
| **개발사** | Parcel 팀 (Devon Govett)       |
| **언어**   | Rust → WASM 바인딩             |
| **크기**   | ~800KB (WASM 번들)             |
| **사용처** | Next.js, Astro, Vite 공식 지원 |
| **적합도** | ❌ 부적합                      |

**부적합 이유**:

- CSS 문자열 기반, 객체→문자열 변환 오버헤드
- WASM 로딩 지연 (~100ms)

### 2.2 CSSTree (JavaScript)

| 항목       | 내용                         |
| ---------- | ---------------------------- |
| **개발사** | Yandex 출신 (Roman Dvornov)  |
| **언어**   | 순수 JavaScript              |
| **크기**   | ~50KB (minified)             |
| **사용처** | CSSO, stylelint, css-modules |
| **적합도** | ⚠️ 제한적                    |

**특징**:

- mdn-data 기반 W3C 스펙 준수
- 모듈별 import 가능 (parser, walker, lexer)
- 값 파싱: `parse('red 1px solid', { context: 'value' })`
- 속성 매칭: `lexer.matchProperty('border', ast)`

**활용 가능 영역**: shorthand 파싱에만 유용

### 2.3 PostCSS (JavaScript)

| 항목          | 내용                     |
| ------------- | ------------------------ |
| **개발사**    | Evil Martians            |
| **크기**      | ~30KB (core only)        |
| **사용처**    | Tailwind, Autoprefixer   |
| **현재 상태** | 이미 빌드 타임에 사용 중 |
| **적합도**    | ❌ 현상유지              |

**현재 package.json**:

```json
{
  "postcss": "8.5.6",
  "@tailwindcss/postcss": "4.1.17",
  "postcss-import": "16.1.1",
  "postcss-nested": "7.0.2",
  "autoprefixer": "10.4.22"
}
```

### 2.4 CSS Typed OM (브라우저 네이티브)

| 항목       | 내용                |
| ---------- | ------------------- |
| **표준**   | W3C CSS Houdini     |
| **크기**   | 0KB (브라우저 내장) |
| **적합도** | ✅ 권장             |

**브라우저 지원**:
| 브라우저 | 지원 | 버전 |
|---------|------|------|
| Chrome | ✅ | 66+ (2018) |
| Safari | ✅ | 16.4+ (2023) |
| Firefox | ❌ | 미지원 |

**핵심 API**:

```typescript
// 읽기 - 구조화된 값으로 반환
const styleMap = element.computedStyleMap();
const width = styleMap.get("width"); // CSSUnitValue { value: 100, unit: 'px' }

// 쓰기 - 타입 안전한 설정
element.attributeStyleMap.set("width", CSS.px(200));
```

**장점**:

- 파싱 비용 제로
- 타입 안전성

**현재 시스템 적용 한계**:

- 현재 빌더는 WebGL(PixiJS) 기반으로 DOM이 없음
- CSS Typed OM은 DOM 요소에서만 사용 가능
- 따라서 **구조적 최적화(StyleValues 분할)가 더 적합**

---

## 3. 업계 리서치 결과

### 3.1 Webstudio (오픈소스 Webflow 대안)

- **GitHub**: [webstudio-is/webstudio](https://github.com/webstudio-is/webstudio)
- **핵심 패키지**:
  - `@webstudio-is/css-data`: mdn-data에서 CSS 속성 정보 생성
  - `@webstudio-is/css-engine`: CSS 렌더링 엔진
- **접근 방식**:
  - Atomic CSS (속성당 하나의 룰) → CSS 파일 크기 160KB→16KB 감소
  - CSS 붙여넣기 시 스타일 패널 필드로 자동 파싱
  - 색상 출처 표시 (Token, inherited, default 구분)

### 3.2 Colord (색상 라이브러리)

- **GitHub**: [omgovich/colord](https://github.com/omgovich/colord)
- **크기**: 1.7KB gzipped
- **용도**: CSS Color Level 스펙 준수 파싱
- **사용처**: cssnano, Leva (React GUI 패널)

```typescript
import { colord } from "colord";
colord("#ff0000").toHsl(); // { h: 0, s: 100, l: 50 }
```

### 3.3 Culori (고급 색상 라이브러리)

- **사이트**: [culorijs.org](https://culorijs.org/)
- **특징**: CSS Colors Level 4 전체 지원, 색상 보간/혼합

### 3.4 업계 패턴 정리

| 영역                | 일반적 접근              | 라이브러리                       |
| ------------------- | ------------------------ | -------------------------------- |
| **CSS 문자열 파싱** | AST 기반                 | CSSTree, PostCSS                 |
| **CSS 속성 데이터** | MDN 데이터               | mdn-data, @webstudio-is/css-data |
| **색상 파싱/변환**  | 전용 라이브러리          | colord (경량), culori (풀스펙)   |
| **단위 파싱**       | CSS Typed OM 또는 정규식 | 브라우저 네이티브                |
| **스타일 동기화**   | 객체 기반 상태 관리      | Zustand, Jotai                   |

### 3.5 현재 시스템과의 비교

| 항목                | Webstudio       | 현재 시스템 (composition) |
| ------------------- | --------------- | ------------------------- |
| **데이터 형태**     | 객체 기반       | ✅ 동일 (JavaScript 객체) |
| **CSS 파싱**        | CSSTree 사용    | ❌ 직접 파싱              |
| **색상 처리**       | 전용 라이브러리 | ❌ 수동 변환              |
| **속성 메타데이터** | mdn-data 기반   | ❌ 수동 매핑              |
| **Atomic CSS**      | O               | ❌ 미적용                 |

---

## 4. 권장 최적화 전략

### 4.1 Phase 1: StyleValues 섹션별 분할

**목표**: 28개 속성을 한 번에 계산하는 `useStyleValues()` 대신, 섹션별 분리된 훅으로 **75% 재계산 감소**

**섹션별 속성 분리**:

| Section        | 속성                                                                                                                                   | 개수 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Transform**  | width, height, top, left                                                                                                               | 4개  |
| **Layout**     | display, flexDirection, alignItems, justifyContent, gap, padding*, margin*, flexWrap                                                   | 15개 |
| **Appearance** | backgroundColor, borderColor, borderWidth, borderRadius, borderStyle                                                                   | 5개  |
| **Typography** | fontFamily, fontSize, fontWeight, fontStyle, lineHeight, letterSpacing, color, textAlign, textDecoration, textTransform, verticalAlign | 11개 |

**신규 훅 구조**:

```typescript
export function useTransformValues(
  selectedElement,
): TransformStyleValues | null;
export function useLayoutValues(selectedElement): LayoutStyleValues | null;
export function useAppearanceValues(
  selectedElement,
): AppearanceStyleValues | null;
export function useTypographyValues(
  selectedElement,
): TypographyStyleValues | null;
```

### 4.2 Phase 2: 추가 최적화 (선택적)

현재 빌더는 WebGL(PixiJS) 기반이므로 CSS Typed OM은 적용 불가.
대신 다음 최적화를 검토:

1. **colord 도입** - 색상 파싱/변환 안정화
2. **css-tree 부분 도입** - shorthand 파싱 정확도 향상
3. **Web Worker 오프로딩** - 대규모 요소 처리 시 메인 스레드 부하 감소

### 4.3 권장 라이브러리 도입

**즉시 도입 가능**:

1. **colord** (1.7KB) - 색상 파싱/변환
2. **css-tree** 부분 사용 - shorthand 파싱

**중장기 검토**: 3. **mdn-data** - CSS 속성 메타데이터

---

## 5. 예상 성능 개선

| 최적화           | 개선율 | 설명                  |
| ---------------- | ------ | --------------------- |
| StyleValues 분할 | ~75%   | 재계산 속성 수 감소   |
| 리렌더링 범위    | ~75%   | 영향받는 섹션 수 감소 |
| colord 도입      | -      | 색상 파싱 안정성 향상 |

**시나리오별 개선**:

| 시나리오             | Before                             | After                                    | 개선     |
| -------------------- | ---------------------------------- | ---------------------------------------- | -------- |
| width 변경           | 28개 속성 재계산, 4개 Section 비교 | 4개 속성 재계산, TransformSection만 비교 | 86% 감소 |
| backgroundColor 변경 | 28개 속성 재계산                   | 5개 속성 재계산                          | 82% 감소 |
| fontSize 변경        | 28개 속성 재계산                   | 11개 속성 재계산                         | 61% 감소 |

---

## 6. 결론

### 핵심 발견

1. **CSS 파싱 라이브러리는 부적합**: 현재 시스템은 JavaScript 객체 기반이므로 문자열 파싱 엔진은 오히려 오버헤드 증가

2. **CSS Typed OM은 적용 불가**: 현재 빌더는 WebGL(PixiJS) 기반으로 DOM이 없음

3. **구조적 최적화가 가장 효과적**:
   - StyleValues 섹션별 분할 (75% 성능 개선)
   - colord 도입 (색상 파싱 안정화)
   - Web Worker 오프로딩 (장기)

### 권장 조합

```
[빌드 타임] PostCSS (현재 유지) - Tailwind 컴파일
     ↓
[런타임 - Store] JavaScript 객체 직접 조작 (현재 유지)
     ↓
[런타임 - 최적화] StyleValues 분할 + colord 도입
     ↓
[WebGL Canvas] PixiJS Graphics로 스타일 렌더링
```

---

## 7. 추가 리서치 결과 (2025년 12월)

### 7.1 Fine-Grained Reactivity (Signals)

**개요**: React의 Virtual DOM 기반 리렌더링을 우회하여, 상태 변경 시 해당 값을 사용하는 DOM 노드만 직접 업데이트

| 라이브러리                | 크기 | 특징                             | 적합도        |
| ------------------------- | ---- | -------------------------------- | ------------- |
| **@preact/signals-react** | ~2KB | React 통합, Fine-grained updates | ⚠️ 검토 필요  |
| **Jotai**                 | ~4KB | Atomic State, 자동 구독 최적화   | ✅ 권장       |
| **SolidJS Signals**       | -    | 네이티브 지원, 최고 성능         | ❌ React 아님 |

**Signals vs Virtual DOM**:

- Signals: 값 기반 구독 → 해당 값 사용 컴포넌트만 업데이트
- Virtual DOM: 컴포넌트 기반 → 전체 컴포넌트 리렌더링 후 diff

**현재 시스템 적용 가능성**:

- Zustand → Jotai 마이그레이션으로 속성별 atomic 구독 가능
- 기존 계획의 "섹션별 분할"보다 더 세밀한 "속성별 구독" 가능

### 7.2 Object Pool & Flyweight Pattern

**Object Pool Pattern**:

- 객체 생성/파괴 비용이 높은 경우 재사용
- **Netflix**: HTTP 요청 객체 풀링으로 40% 메모리 감소
- **Uber**: Thrift 서비스 풀링으로 10x 처리량 증가

**Flyweight Pattern**:

- 공유 가능한 불변 데이터(intrinsic)와 컨텍스트별 데이터(extrinsic) 분리
- StyleValues에서 CSS 속성 메타데이터는 Flyweight로 공유 가능

**현재 시스템 적용**:

```typescript
// Object Pool 예시 - StyleValues 객체 재사용
class StyleValuesPool {
  private pool: StyleValues[] = [];

  acquire(): StyleValues {
    return this.pool.pop() ?? createEmptyStyleValues();
  }

  release(obj: StyleValues): void {
    resetStyleValues(obj); // 초기화 후 풀에 반환
    this.pool.push(obj);
  }
}
```

### 7.3 useSyncExternalStore + Selector 최적화

**핵심 발견**:

- `useSyncExternalStoreWithSelector`로 primitive 값만 선택 시 자동 최적화
- Zustand v4+에서는 selector 메모이제이션 불필요
- 중첩 객체 선택 시 `Object.is` 비교로 불필요한 리렌더링 발생

**Best Practice**:

```typescript
// BAD - 매번 새 객체 생성
const style = useStore((state) => ({
  width: state.style.width,
  height: state.style.height,
}));

// GOOD - primitive 값 개별 구독
const width = useStore((state) => state.style.width);
const height = useStore((state) => state.style.height);
```

### 7.4 OffscreenCanvas + Web Worker

**성능 개선 효과**:

- 메인 스레드 부하 감소로 UI 반응성 향상
- 저사양 기기에서도 60fps 유지 가능
- OffscreenCanvas로 WebGL 렌더링을 Worker로 이전

**적용 시나리오**:

- 대규모 요소(100+) 처리 시 스타일 계산 Worker로 오프로드
- SharedArrayBuffer로 메인 스레드 ↔ Worker 데이터 공유 (50%+ 지연시간 감소)

**브라우저 지원**:
| 브라우저 | OffscreenCanvas | SharedArrayBuffer |
|---------|-----------------|-------------------|
| Chrome | ✅ 69+ | ✅ (COOP/COEP 필요) |
| Safari | ✅ 16.4+ | ✅ (COOP/COEP 필요) |
| Firefox | ✅ 105+ | ✅ (COOP/COEP 필요) |

### 7.5 PixiJS 저사양 최적화 기법

**렌더러 설정**:

```typescript
const app = new PIXI.Application({
  antialias: false, // 저사양 기기용
  useContextAlpha: false, // 성능 향상
  legacy: true, // 구형 GPU 지원
  resolution: 0.5, // 저해상도 렌더링
});
```

**텍스처 최적화**:

- Spritesheet 사용으로 배칭 극대화 (최대 16개 텍스처 동시 배칭)
- `@0.5x.png` 저해상도 텍스처 자동 스케일
- `cacheAsBitmap = true`로 정적 요소 캐싱

**메모리 관리**:

- 텍스처 GC 자동 관리 또는 수동 `destroy()` 호출
- 300개 이상 Graphics 객체 → Sprite 변환 권장
- 이벤트 리스너 명시적 정리로 메모리 누수 방지

### 7.6 Incremental DOM vs Virtual DOM

**Incremental DOM**:

- 중간 가상 트리 없이 기존 DOM 직접 수정
- 메모리 사용량 감소 (모바일/저사양 기기에 유리)
- Angular Ivy에서 사용, Tree-shaking 최적화

**Virtual DOM**:

- 중간 가상 트리 생성 후 diff
- 메모리 사용량 증가, 속도는 일반적으로 더 빠름

**현재 시스템에서의 적용**:

- WebGL(PixiJS) 기반이므로 DOM 렌더링 전략은 직접 해당 없음
- React 스타일 패널에는 Virtual DOM 유지하되, 리렌더링 최소화에 집중

---

## 8. 상세 실행 계획 (Detailed Implementation Plan)

### 8.1 개요

기존 리서치 결과와 추가 최적화 기법을 통합하여 **6단계 Phase**로 재구성합니다.
각 Phase는 독립적으로 완료 가능하며, 이전 Phase의 성과를 기반으로 점진적 개선을 달성합니다.

### 8.2 Phase 로드맵 요약

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Phase 0: 준비 (Foundation)                                                  │
│  벤치마크 기준선 설정 + 측정 인프라 구축                                      │
│  예상 소요: 1-2일 | 성능 개선: 0% (측정 기반 마련)                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  Phase 1: Quick Wins (즉시 적용)                                             │
│  Selector 최적화 + useTransition + colord 도입                               │
│  예상 소요: 3-5일 | 누적 성능 개선: 30-50%                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  Phase 2: 구조적 최적화 (Structural)                                         │
│  StyleValues 섹션별 분할 + Lazy Hook Execution                               │
│  예상 소요: 1-2주 | 누적 성능 개선: 70-80%                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  Phase 3: 고급 상태 관리 (Advanced State)                                    │
│  Jotai Atomic State + Immer Structural Sharing                              │
│  예상 소요: 1-2주 | 누적 성능 개선: 85-90%                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  Phase 4: 메모리 최적화 (Memory)                                             │
│  Object Pool Pattern + GC 최적화                                             │
│  예상 소요: 3-5일 | 메모리 사용량: 40-50% 감소                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  Phase 5: 장기 최적화 (Long-term)                                            │
│  Web Worker + PixiJS v8 WebGPU + React Compiler                             │
│  예상 소요: 2-4주 | 대규모 요소 처리 성능: 200-300% 향상                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Phase 0: 준비 단계 (Foundation)

### 9.1 목표

최적화 효과를 정량적으로 측정하기 위한 **벤치마크 기준선**과 **측정 인프라** 구축

### 9.2 세부 작업

#### 9.2.1 React DevTools Profiler 설정

```typescript
// src/utils/performanceMarkers.ts
export const PERF_MARKERS = {
  STYLE_VALUES_CALC: "style-values-calculation",
  SECTION_RENDER: "section-render",
  CANVAS_SYNC: "canvas-sync",
} as const;

export function measureStyleCalculation<T>(fn: () => T): T {
  performance.mark(`${PERF_MARKERS.STYLE_VALUES_CALC}-start`);
  const result = fn();
  performance.mark(`${PERF_MARKERS.STYLE_VALUES_CALC}-end`);
  performance.measure(
    PERF_MARKERS.STYLE_VALUES_CALC,
    `${PERF_MARKERS.STYLE_VALUES_CALC}-start`,
    `${PERF_MARKERS.STYLE_VALUES_CALC}-end`,
  );
  return result;
}
```

#### 9.2.2 벤치마크 스크립트 작성

```typescript
// scripts/benchmark-style-panel.ts
interface BenchmarkResult {
  rerenderCount: number;
  avgCalculationTime: number;
  memoryUsage: number;
  gcFrequency: number;
}

export async function runStylePanelBenchmark(): Promise<BenchmarkResult> {
  const scenarios = [
    { name: "single-element-select", elements: 1 },
    { name: "multi-element-select", elements: 10 },
    { name: "rapid-style-change", changes: 100 },
    { name: "section-toggle", toggles: 50 },
  ];

  // 각 시나리오별 측정 실행
  // ...
}
```

#### 9.2.3 기준선 메트릭 수집

| 메트릭           | 측정 방법               | 목표 기준      |
| ---------------- | ----------------------- | -------------- |
| 리렌더링 횟수    | React DevTools Profiler | 현재 값 기록   |
| 스타일 계산 시간 | Performance.measure()   | < 16ms (60fps) |
| 메모리 사용량    | Chrome DevTools Memory  | 현재 값 기록   |
| GC 빈도          | Performance Observer    | 현재 값 기록   |
| FPS              | requestAnimationFrame   | > 55fps        |

### 9.3 기대 효과

| 항목      | 효과                                          |
| --------- | --------------------------------------------- |
| 성능 개선 | 0% (측정 기반 마련)                           |
| 가치      | 이후 모든 Phase의 효과를 정량적으로 검증 가능 |

### 9.4 체크리스트

- [ ] Performance markers 유틸리티 생성 (`src/utils/performanceMarkers.ts`)
- [ ] 벤치마크 스크립트 작성 (`scripts/benchmark-style-panel.ts`)
- [ ] 기준선 메트릭 수집 및 문서화
- [ ] CI/CD에 성능 회귀 테스트 추가 (선택)
- [ ] 벤치마크 결과 기록 템플릿 생성

---

## 10. Phase 1: Quick Wins (즉시 적용)

### 10.1 목표

**최소 변경으로 최대 효과** - 기존 코드 구조를 유지하면서 즉각적인 성능 개선 달성

### 10.2 세부 작업

#### 10.2.1 Selector Primitive 구독 최적화

**변경 범위**: 최소
**예상 개선**: 30-40% 불필요 리렌더링 감소

```typescript
// ❌ Before: 전체 객체 구독 (매번 새 참조 생성)
const styleValues = useStyleValues(selectedElement);
const { width, height } = styleValues;

// ✅ After: primitive 값 개별 구독
const width = useStyleStore((s) => s.selectedElement?.computedStyle?.width);
const height = useStyleStore((s) => s.selectedElement?.computedStyle?.height);

// ✅ After: 여러 값이 필요한 경우 shallow 비교
import { shallow } from "zustand/shallow";

const { width, height } = useStyleStore(
  (s) => ({
    width: s.selectedElement?.computedStyle?.width,
    height: s.selectedElement?.computedStyle?.height,
  }),
  shallow,
);
```

**적용 대상 파일**:

- `src/components/panels/style/TransformSection.tsx`
- `src/components/panels/style/LayoutSection.tsx`
- `src/components/panels/style/AppearanceSection.tsx`
- `src/components/panels/style/TypographySection.tsx`

#### 10.2.2 useTransition/useDeferredValue 적용

**변경 범위**: 최소
**예상 개선**: UI 반응성 50% 향상 (체감 성능)

```typescript
// src/components/panels/style/StylePanel.tsx
import { useTransition, useDeferredValue } from 'react';

function StylePanel() {
  const [isPending, startTransition] = useTransition();

  const handleStyleChange = useCallback((property: string, value: string) => {
    // 긴급: 입력 필드 즉시 업데이트
    setLocalValue(value);

    // 지연: 캔버스 업데이트는 낮은 우선순위
    startTransition(() => {
      updateElementStyle(property, value);
    });
  }, []);

  return (
    <div className={isPending ? 'opacity-70' : ''}>
      {/* 스타일 섹션들 */}
    </div>
  );
}

// useDeferredValue로 무거운 연산 지연 (setTimeout 디바운스 대체)
function StyleInput({ value, onChange }: StyleInputProps) {
  const deferredValue = useDeferredValue(value);

  // deferredValue로 무거운 연산 수행
  const computedPreview = useMemo(() =>
    calculatePreview(deferredValue),
    [deferredValue]
  );

  return <input value={value} onChange={onChange} />;
}
```

#### 10.2.3 colord 라이브러리 도입

**변경 범위**: 중간
**크기 추가**: 1.7KB gzipped

```bash
pnpm add colord
```

```typescript
// src/utils/colorUtils.ts
import { colord, extend } from "colord";
import namesPlugin from "colord/plugins/names";
import hwbPlugin from "colord/plugins/hwb";

// CSS Color Level 4 지원을 위한 플러그인 확장
extend([namesPlugin, hwbPlugin]);

export function parseColor(value: string) {
  const color = colord(value);
  if (!color.isValid()) {
    return null;
  }

  return {
    hex: color.toHex(),
    rgb: color.toRgb(),
    hsl: color.toHsl(),
    alpha: color.alpha(),
    isLight: color.isLight(),
  };
}

export function formatColor(
  color: ReturnType<typeof parseColor>,
  format: "hex" | "rgb" | "hsl",
): string {
  if (!color) return "";

  switch (format) {
    case "hex":
      return color.hex;
    case "rgb":
      return `rgb(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b})`;
    case "hsl":
      return `hsl(${color.hsl.h}, ${color.hsl.s}%, ${color.hsl.l}%)`;
  }
}
```

#### 10.2.4 프레임 동기화 기반 업데이트 최적화

> **⚠️ 주의**: `setTimeout` 기반 디바운스는 **불완전한 타이밍에 의존**하므로 지양합니다.
> 대신 `requestAnimationFrame` 또는 `requestIdleCallback` 기반 방식을 사용합니다.

**변경 범위**: 최소
**예상 개선**: 재계산 빈도 60-70% 감소 + 프레임 드롭 방지

**왜 setTimeout 디바운스를 피해야 하는가?**

- `setTimeout`은 최소 지연 시간을 보장하지 않음 (브라우저 스로틀링, 백그라운드 탭)
- 렌더링 사이클과 동기화되지 않아 프레임 드롭 발생 가능
- 고정 지연 시간은 기기 성능과 무관하게 적용됨

```typescript
// src/hooks/useRAFThrottle.ts
import { useRef, useCallback } from "react";

/**
 * requestAnimationFrame 기반 스로틀
 * - 렌더링 사이클에 동기화되어 프레임 드롭 방지
 * - 브라우저가 준비될 때만 실행
 */
export function useRAFThrottle<T extends (...args: any[]) => void>(
  callback: T,
): T {
  const rafRef = useRef<number | null>(null);
  const lastArgsRef = useRef<Parameters<T> | null>(null);

  const throttledFn = useCallback(
    (...args: Parameters<T>) => {
      lastArgsRef.current = args;

      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          if (lastArgsRef.current) {
            callback(...lastArgsRef.current);
          }
          rafRef.current = null;
        });
      }
    },
    [callback],
  ) as T;

  return throttledFn;
}

// src/hooks/useIdleCallback.ts
/**
 * requestIdleCallback 기반 지연 업데이트
 * - 메인 스레드가 유휴 상태일 때만 실행
 * - 무거운 계산에 적합 (스타일 재계산, 캔버스 동기화)
 */
export function useIdleCallback<T extends (...args: any[]) => void>(
  callback: T,
  options: IdleRequestOptions = { timeout: 100 },
): T {
  const idleRef = useRef<number | null>(null);
  const lastArgsRef = useRef<Parameters<T> | null>(null);

  const idleFn = useCallback(
    (...args: Parameters<T>) => {
      lastArgsRef.current = args;

      if (idleRef.current !== null) {
        cancelIdleCallback(idleRef.current);
      }

      idleRef.current = requestIdleCallback(() => {
        if (lastArgsRef.current) {
          callback(...lastArgsRef.current);
        }
        idleRef.current = null;
      }, options);
    },
    [callback, options.timeout],
  ) as T;

  return idleFn;
}

// src/hooks/useStyleUpdate.ts
/**
 * 스타일 업데이트 통합 훅
 * - 입력 UI: 즉시 반영 (로컬 상태)
 * - 캔버스 동기화: RAF 스로틀
 * - 스토어 업데이트: Idle callback
 */
export function useStyleUpdate(
  updateFn: (property: string, value: string) => void,
) {
  // 캔버스 동기화는 프레임에 맞춰 실행
  const rafUpdate = useRAFThrottle(updateFn);

  // 스토어 업데이트는 유휴 시간에 실행
  const idleUpdate = useIdleCallback(updateFn);

  return {
    immediateUpdate: updateFn, // blur, enter 시 즉시 적용
    rafUpdate, // 드래그, 슬라이더 시 프레임 동기화
    idleUpdate, // 타이핑 시 유휴 상태에서 처리
  };
}
```

**Scheduler API (실험적 - 향후 도입 검토)**:

```typescript
// 브라우저 Scheduler API 사용 (Chrome 94+)
// 우선순위 기반 태스크 스케줄링
if ("scheduler" in window) {
  scheduler.postTask(
    () => {
      updateElementStyle(property, value);
    },
    { priority: "user-blocking" },
  ); // 'user-blocking' | 'user-visible' | 'background'
}
```

### 10.3 기대 효과

| 항목                         | Before    | After                | 개선율      |
| ---------------------------- | --------- | -------------------- | ----------- |
| 리렌더링 횟수 (속성 변경 시) | ~20회     | ~8회                 | 60% 감소    |
| 입력 반응 시간               | ~50ms     | ~10ms                | 80% 향상    |
| 스타일 계산 빈도             | 매 입력   | RAF/Idle 동기화      | 70% 감소    |
| 프레임 드롭                  | 발생 가능 | 프레임 동기화로 방지 | 90% 감소    |
| 색상 파싱 오류               | 발생 가능 | 0                    | 100% 안정화 |

### 10.4 체크리스트

#### Selector 최적화

- [ ] TransformSection selector를 primitive 값으로 변경
- [ ] LayoutSection selector를 primitive 값으로 변경
- [ ] AppearanceSection selector를 primitive 값으로 변경
- [ ] TypographySection selector를 primitive 값으로 변경
- [ ] shallow 비교 필요한 곳에 `zustand/shallow` 적용

#### useTransition 적용

- [ ] StylePanel에 useTransition 추가
- [ ] 캔버스 업데이트를 startTransition으로 래핑
- [ ] isPending 상태에 따른 UI 피드백 추가
- [ ] useDeferredValue로 미리보기 최적화

#### colord 도입

- [ ] colord 패키지 설치
- [ ] colorUtils.ts 유틸리티 생성
- [ ] 기존 색상 파싱 코드를 colord로 마이그레이션
- [ ] ColorPicker 컴포넌트 업데이트

#### 프레임 동기화 업데이트

- [ ] `useRAFThrottle` 훅 구현 (requestAnimationFrame 기반)
- [ ] `useIdleCallback` 훅 구현 (requestIdleCallback 기반)
- [ ] `useStyleUpdate` 통합 훅 구현
- [ ] 드래그/슬라이더에 RAF 스로틀 적용
- [ ] 타이핑 입력에 Idle callback 적용
- [ ] Scheduler API polyfill 검토 (선택적)

---

## 11. Phase 2: 구조적 최적화 (Structural)

### 11.1 목표

**StyleValues 28개 속성**을 섹션별로 분할하여 **불필요한 재계산 75% 감소**

### 11.2 세부 작업

#### 11.2.1 섹션별 타입 정의

```typescript
// src/types/styleValues.ts

// Transform 섹션 (4개 속성)
export interface TransformStyleValues {
  width: StyleValue;
  height: StyleValue;
  top: StyleValue;
  left: StyleValue;
}

// Layout 섹션 (15개 속성)
export interface LayoutStyleValues {
  display: StyleValue;
  flexDirection: StyleValue;
  flexWrap: StyleValue;
  alignItems: StyleValue;
  justifyContent: StyleValue;
  gap: StyleValue;
  paddingTop: StyleValue;
  paddingRight: StyleValue;
  paddingBottom: StyleValue;
  paddingLeft: StyleValue;
  marginTop: StyleValue;
  marginRight: StyleValue;
  marginBottom: StyleValue;
  marginLeft: StyleValue;
  overflow: StyleValue;
}

// Appearance 섹션 (5개 속성)
export interface AppearanceStyleValues {
  backgroundColor: StyleValue;
  borderColor: StyleValue;
  borderWidth: StyleValue;
  borderRadius: StyleValue;
  borderStyle: StyleValue;
  opacity: StyleValue;
  boxShadow: StyleValue;
}

// Typography 섹션 (11개 속성)
export interface TypographyStyleValues {
  fontFamily: StyleValue;
  fontSize: StyleValue;
  fontWeight: StyleValue;
  fontStyle: StyleValue;
  lineHeight: StyleValue;
  letterSpacing: StyleValue;
  color: StyleValue;
  textAlign: StyleValue;
  textDecoration: StyleValue;
  textTransform: StyleValue;
  verticalAlign: StyleValue;
}
```

#### 11.2.2 섹션별 훅 구현

```typescript
// src/hooks/style/useTransformValues.ts
import { useShallow } from "zustand/react/shallow";

const TRANSFORM_PROPERTIES = ["width", "height", "top", "left"] as const;

export function useTransformValues(): TransformStyleValues | null {
  const element = useStyleStore((s) => s.selectedElement);

  return useStyleStore(
    useShallow((s) => {
      if (!s.selectedElement) return null;

      const { style, computedStyle } = s.selectedElement;

      return {
        width: extractStyleValue("width", style, computedStyle),
        height: extractStyleValue("height", style, computedStyle),
        top: extractStyleValue("top", style, computedStyle),
        left: extractStyleValue("left", style, computedStyle),
      };
    }),
  );
}

// src/hooks/style/useLayoutValues.ts
export function useLayoutValues(): LayoutStyleValues | null {
  // 유사한 구현...
}

// src/hooks/style/useAppearanceValues.ts
export function useAppearanceValues(): AppearanceStyleValues | null {
  // 유사한 구현...
}

// src/hooks/style/useTypographyValues.ts
export function useTypographyValues(): TypographyStyleValues | null {
  // 유사한 구현...
}

// src/hooks/style/index.ts (하위 호환성 유지)
export function useStyleValues(): StyleValues | null {
  const transform = useTransformValues();
  const layout = useLayoutValues();
  const appearance = useAppearanceValues();
  const typography = useTypographyValues();

  if (!transform && !layout && !appearance && !typography) {
    return null;
  }

  return {
    ...transform,
    ...layout,
    ...appearance,
    ...typography,
  };
}
```

#### 11.2.3 Lazy Hook Execution 패턴

```typescript
// src/components/panels/style/sections/TransformSection.tsx

interface TransformSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
}

// 접힌 상태에서는 훅 호출을 건너뛰기 위해 컴포넌트 분리
export function TransformSection({ isExpanded, onToggle }: TransformSectionProps) {
  return (
    <SectionWrapper title="Transform" isExpanded={isExpanded} onToggle={onToggle}>
      {isExpanded && <TransformSectionContent />}
    </SectionWrapper>
  );
}

// 실제 훅 호출은 Content 컴포넌트에서만 발생
function TransformSectionContent() {
  const values = useTransformValues();

  if (!values) return null;

  return (
    <>
      <DimensionInput label="Width" value={values.width} property="width" />
      <DimensionInput label="Height" value={values.height} property="height" />
      <PositionInput label="Top" value={values.top} property="top" />
      <PositionInput label="Left" value={values.left} property="left" />
    </>
  );
}
```

#### 11.2.4 Shorthand Property 확장 (CSSTree 부분 도입)

```typescript
// src/utils/shorthandExpander.ts
import { parse, walk } from "css-tree";

interface ExpandedPadding {
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
}

export function expandPadding(value: string): ExpandedPadding {
  const parts = value.trim().split(/\s+/);

  switch (parts.length) {
    case 1:
      return {
        paddingTop: parts[0],
        paddingRight: parts[0],
        paddingBottom: parts[0],
        paddingLeft: parts[0],
      };
    case 2:
      return {
        paddingTop: parts[0],
        paddingRight: parts[1],
        paddingBottom: parts[0],
        paddingLeft: parts[1],
      };
    case 3:
      return {
        paddingTop: parts[0],
        paddingRight: parts[1],
        paddingBottom: parts[2],
        paddingLeft: parts[1],
      };
    case 4:
      return {
        paddingTop: parts[0],
        paddingRight: parts[1],
        paddingBottom: parts[2],
        paddingLeft: parts[3],
      };
    default:
      return {
        paddingTop: "0",
        paddingRight: "0",
        paddingBottom: "0",
        paddingLeft: "0",
      };
  }
}

// margin, border-radius 등 유사하게 구현
```

### 11.3 기대 효과

| 시나리오             | Before            | After            | 개선율       |
| -------------------- | ----------------- | ---------------- | ------------ |
| width 변경           | 28개 속성 재계산  | 4개 속성 재계산  | 86% 감소     |
| backgroundColor 변경 | 28개 속성 재계산  | 7개 속성 재계산  | 75% 감소     |
| fontSize 변경        | 28개 속성 재계산  | 11개 속성 재계산 | 61% 감소     |
| 섹션 접힘 시         | 모든 섹션 훅 실행 | 해당 섹션만 실행 | 75% 감소     |
| **평균**             | 28개              | 7개              | **75% 감소** |

### 11.4 체크리스트

#### 타입 정의

- [ ] `TransformStyleValues` 인터페이스 정의
- [ ] `LayoutStyleValues` 인터페이스 정의
- [ ] `AppearanceStyleValues` 인터페이스 정의
- [ ] `TypographyStyleValues` 인터페이스 정의
- [ ] 기존 `StyleValues`를 Union 타입으로 재정의

#### 섹션별 훅

- [ ] `useTransformValues` 훅 구현
- [ ] `useLayoutValues` 훅 구현
- [ ] `useAppearanceValues` 훅 구현
- [ ] `useTypographyValues` 훅 구현
- [ ] 하위 호환성을 위한 `useStyleValues` 래퍼 유지
- [ ] 각 훅에 대한 단위 테스트 작성

#### Lazy Hook Execution

- [ ] SectionWrapper 컴포넌트 생성
- [ ] TransformSection 분리 (wrapper + content)
- [ ] LayoutSection 분리
- [ ] AppearanceSection 분리
- [ ] TypographySection 분리

#### Shorthand 확장

- [ ] `expandPadding` 함수 구현
- [ ] `expandMargin` 함수 구현
- [ ] `expandBorderRadius` 함수 구현
- [ ] `expandBorder` 함수 구현

---

## 12. Phase 3: 고급 상태 관리 (Advanced State) ✅ 완료 (2025-12-21)

### 12.1 목표

**속성 레벨 Fine-grained Reactivity**로 섹션 분할보다 더 세밀한 구독 최적화

### 12.2 실제 구현 내용

#### 12.2.1 Jotai Atomic State 구현

**파일 구조:**

```
src/builder/panels/styles/
├── atoms/
│   ├── styleAtoms.ts      # 35+ atoms 정의
│   └── index.ts           # exports
├── hooks/
│   ├── useZustandJotaiBridge.ts      # Zustand → Jotai 동기화
│   ├── useTransformValuesJotai.ts    # Transform 섹션용
│   ├── useLayoutValuesJotai.ts       # Layout 섹션용
│   ├── useAppearanceValuesJotai.ts   # Appearance 섹션용
│   └── useTypographyValuesJotai.ts   # Typography 섹션용
└── sections/
    ├── TransformSection.tsx   # Jotai 마이그레이션 완료
    ├── LayoutSection.tsx      # Jotai 마이그레이션 완료
    ├── AppearanceSection.tsx  # Jotai 마이그레이션 완료
    └── TypographySection.tsx  # Jotai 마이그레이션 완료
```

**핵심 코드 - atoms/styleAtoms.ts:**

```typescript
import { atom } from "jotai";
import { selectAtom } from "jotai/utils";

// 기본 atom - Zustand에서 동기화됨
export const selectedElementAtom = atom<SelectedElementData | null>(null);

// selectAtom + equality 체크로 불필요한 리렌더 방지
export const widthAtom = selectAtom(
  selectedElementAtom,
  (element) => element?.style?.width ?? "auto",
  (a, b) => a === b, // equality 체크
);

// 그룹 atoms - 섹션별 값 묶음
export const transformValuesAtom = selectAtom(
  selectedElementAtom,
  (element) => ({
    width: String(element?.style?.width ?? "auto"),
    height: String(element?.style?.height ?? "auto"),
    top: String(element?.style?.top ?? "auto"),
    left: String(element?.style?.left ?? "auto"),
  }),
  (a, b) => {
    if (a === null && b === null) return true;
    if (a === null || b === null) return false;
    return (
      a.width === b.width &&
      a.height === b.height &&
      a.top === b.top &&
      a.left === b.left
    );
  },
);

// StylesPanel용 atoms
export const hasSelectedElementAtom = selectAtom(
  selectedElementAtom,
  (element) => element !== null,
  (a, b) => a === b,
);

export const modifiedCountAtom = selectAtom(
  selectedElementAtom,
  (element) => Object.keys(element?.style ?? {}).length,
  (a, b) => a === b,
);
```

#### 12.2.2 Zustand → Jotai 브릿지 구현

**실제 구현 - hooks/useZustandJotaiBridge.ts:**

```typescript
import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { selectedElementAtom } from '../atoms/styleAtoms';
import { useStore } from '../../../stores';

// Zustand 스토어에서 선택된 요소 데이터 빌드
function buildSelectedElement(state: StoreState): SelectedElementData | null {
  if (!state.selectedElementId || !state.selectedElementProps) return null;
  return {
    id: state.selectedElementId,
    style: state.selectedElementProps.style ?? {},
    computedStyle: state.selectedElementProps.computedStyle ?? {},
  };
}

export function useZustandJotaiBridge(): void {
  const setSelectedElement = useSetAtom(selectedElementAtom);

  useEffect(() => {
    // 초기값 설정
    const state = useStore.getState();
    setSelectedElement(buildSelectedElement(state));

    // Zustand 구독으로 Jotai 동기화
    const unsubscribe = useStore.subscribe((state, prevState) => {
      if (
        state.selectedElementId !== prevState.selectedElementId ||
        state.selectedElementProps !== prevState.selectedElementProps
      ) {
        setSelectedElement(buildSelectedElement(state));
      }
    });

    return unsubscribe;
  }, [setSelectedElement]);
}

// StylesPanel에서 사용
function JotaiBridge() {
  useZustandJotaiBridge();
  return null;
}

export function StylesPanel({ isActive }: PanelProps) {
  if (!isActive) return null;
  return (
    <>
      <JotaiBridge />
      <StylesPanelContent />
    </>
  );
}
```

#### 12.2.3 Immer Structural Sharing

```typescript
// src/store/styleStore.ts
import { produce } from "immer";

export const useStyleStore = create<StyleStore>((set) => ({
  selectedElement: null,

  updateStyle: (property: string, value: string) =>
    set(
      produce((state) => {
        if (state.selectedElement?.style) {
          state.selectedElement.style[property] = value;
          // Immer가 변경되지 않은 속성의 참조를 유지
          // → 해당 속성을 구독하는 컴포넌트만 리렌더링
        }
      }),
    ),
}));
```

#### 12.2.4 컴포넌트 마이그레이션

```typescript
// src/components/panels/style/inputs/WidthInput.tsx
import { useAtomValue } from 'jotai';
import { widthAtom } from '@/store/atoms/styleAtoms';

export function WidthInput() {
  // width만 변경되면 이 컴포넌트만 리렌더링
  const width = useAtomValue(widthAtom);

  return (
    <DimensionInput
      label="Width"
      value={width}
      onChange={(value) => updateStyle('width', value)}
    />
  );
}
```

### 12.3 실제 결과

| 항목              | Phase 2 이후            | Phase 3 이후            | 실제 개선              |
| ----------------- | ----------------------- | ----------------------- | ---------------------- |
| 구독 단위         | 섹션 (4-15개 속성)      | selectAtom + equality   | 동일 값이면 리렌더 0회 |
| 교차 선택 시      | 매번 리렌더 (150-200ms) | 값 동일하면 리렌더 없음 | **100% 감소**          |
| filter="all" 모드 | Zustand 구독            | Jotai atom 구독         | Zustand 구독 제거      |
| 스타일 값 변경 시 | 전체 섹션 리렌더        | 해당 섹션만 리렌더      | 75% 감소               |

**핵심 성과:**

- 동일한 스타일을 가진 요소 간 교차 선택 시 **handler violation 발생하지 않음**
- selectAtom의 equality 체크로 값이 동일하면 atom 구독자에게 알림 안 함
- PropertyColor의 `key={value}` 패턴과 시너지 - 값이 동일하면 key 변경 없음 → 재마운트 없음

### 12.4 체크리스트

#### Jotai 설정

- [ ] jotai 패키지 설치 (`pnpm add jotai`)
- [ ] Provider 설정 (루트 컴포넌트)
- [ ] 기본 atoms 정의 (`selectedElementAtom`, `computedStyleAtom`)

#### 속성별 atoms

- [ ] Transform 속성 atoms (width, height, top, left)
- [ ] Layout 속성 atoms (15개)
- [ ] Appearance 속성 atoms (7개)
- [ ] Typography 속성 atoms (11개)

#### 마이그레이션

- [ ] Zustand ↔ Jotai bridge 구현
- [ ] TransformSection을 Jotai로 마이그레이션
- [ ] LayoutSection을 Jotai로 마이그레이션
- [ ] AppearanceSection을 Jotai로 마이그레이션
- [ ] TypographySection을 Jotai로 마이그레이션
- [ ] 기존 Zustand 코드 정리 (완료 후)

#### Immer 통합

- [ ] immer 패키지 설치 (`pnpm add immer`)
- [ ] Zustand store에 immer middleware 적용
- [ ] 상태 업데이트 로직 리팩토링

---

## 13. Phase 4: 메모리 최적화 (Memory)

### 13.1 목표

**Object Pool Pattern**과 **GC 최적화**로 메모리 사용량 40-50% 감소

### 13.2 세부 작업

#### 13.2.1 StyleValues Object Pool

```typescript
// src/utils/objectPool.ts

interface PoolConfig {
  initialSize: number;
  maxSize: number;
}

class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;
  private maxSize: number;

  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    config: PoolConfig = { initialSize: 10, maxSize: 100 },
  ) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = config.maxSize;

    // 초기 풀 생성
    for (let i = 0; i < config.initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire(): T {
    return this.pool.pop() ?? this.factory();
  }

  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      this.reset(obj);
      this.pool.push(obj);
    }
  }

  get size(): number {
    return this.pool.length;
  }
}

// StyleValues 전용 풀
export const styleValuesPool = new ObjectPool<StyleValues>(
  () => createEmptyStyleValues(),
  (obj) => {
    Object.keys(obj).forEach((key) => {
      (obj as any)[key] = undefined;
    });
  },
  { initialSize: 20, maxSize: 200 },
);
```

#### 13.2.2 사용 패턴

```typescript
// src/hooks/style/useTransformValues.ts
import { styleValuesPool } from "@/utils/objectPool";

export function useTransformValues(): TransformStyleValues | null {
  const prevValuesRef = useRef<TransformStyleValues | null>(null);

  const values = useMemo(() => {
    const element = store.getState().selectedElement;
    if (!element) return null;

    // 풀에서 객체 획득
    const newValues = styleValuesPool.acquire() as TransformStyleValues;

    // 값 할당
    newValues.width = extractStyleValue("width", element);
    newValues.height = extractStyleValue("height", element);
    newValues.top = extractStyleValue("top", element);
    newValues.left = extractStyleValue("left", element);

    return newValues;
  }, [element]);

  // 이전 값 반환
  useEffect(() => {
    return () => {
      if (prevValuesRef.current) {
        styleValuesPool.release(prevValuesRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (prevValuesRef.current && prevValuesRef.current !== values) {
      styleValuesPool.release(prevValuesRef.current);
    }
    prevValuesRef.current = values;
  }, [values]);

  return values;
}
```

#### 13.2.3 PixiJS 메모리 최적화

```typescript
// src/canvas/memoryManager.ts
import { Ticker, Assets } from "pixi.js";

class CanvasMemoryManager {
  private gcInterval = 30000; // 30초
  private lastGC = Date.now();

  constructor(app: Application) {
    // 주기적 GC
    Ticker.shared.add(() => {
      if (Date.now() - this.lastGC > this.gcInterval) {
        this.runGC();
        this.lastGC = Date.now();
      }
    });
  }

  runGC(): void {
    // 미사용 텍스처 정리
    Assets.cache.reset();

    // Graphics 객체 캐시 정리
    this.cleanupGraphicsCache();
  }

  private cleanupGraphicsCache(): void {
    // 구현...
  }
}
```

#### 13.2.4 메모리 모니터링

```typescript
// src/utils/memoryMonitor.ts

export function setupMemoryMonitor() {
  if (process.env.NODE_ENV !== "development") return;

  const logMemory = () => {
    if ("memory" in performance) {
      const memory = (performance as any).memory;
      console.log("[Memory]", {
        usedJSHeapSize: formatBytes(memory.usedJSHeapSize),
        totalJSHeapSize: formatBytes(memory.totalJSHeapSize),
        jsHeapSizeLimit: formatBytes(memory.jsHeapSizeLimit),
      });
    }
  };

  // 30초마다 로깅
  setInterval(logMemory, 30000);
}
```

### 13.3 기대 효과

| 항목                     | Before    | After         | 개선율      |
| ------------------------ | --------- | ------------- | ----------- |
| StyleValues 객체 생성    | 매번 new  | 풀에서 재사용 | GC 50% 감소 |
| 메모리 사용량 (100 요소) | ~50MB     | ~30MB         | 40% 감소    |
| GC Pause 시간            | ~50ms     | ~20ms         | 60% 감소    |
| 텍스처 메모리 누수       | 발생 가능 | 주기적 정리   | 누수 방지   |

### 13.4 체크리스트

#### Object Pool

- [ ] `ObjectPool` 제네릭 클래스 구현
- [ ] `styleValuesPool` 인스턴스 생성
- [ ] 각 섹션 훅에 풀 적용
- [ ] 릴리스 로직 정확성 검증

#### PixiJS 메모리

- [ ] `CanvasMemoryManager` 구현
- [ ] 텍스처 캐시 정리 로직
- [ ] Graphics 객체 재사용 패턴 적용
- [ ] 이벤트 리스너 정리 확인

#### 모니터링

- [ ] 메모리 모니터 유틸리티 구현
- [ ] 개발 환경에서 메모리 로깅 활성화
- [ ] 메모리 회귀 테스트 추가 (선택)

---

## 14. Phase 5: 장기 최적화 (Long-term)

### 14.1 목표

**대규모 요소 처리**와 **최신 기술 도입**으로 미래 확장성 확보

### 14.2 세부 작업

#### 14.2.1 Web Worker 스타일 계산

```typescript
// src/workers/styleCalculator.worker.ts
import { computeStyleValues } from "../utils/styleComputation";

interface WorkerMessage {
  type: "COMPUTE_STYLES";
  elements: SerializedElement[];
}

interface WorkerResponse {
  type: "STYLES_COMPUTED";
  results: StyleValues[];
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, elements } = e.data;

  if (type === "COMPUTE_STYLES") {
    const results = elements.map(computeStyleValues);

    self.postMessage({
      type: "STYLES_COMPUTED",
      results,
    } as WorkerResponse);
  }
};

// src/hooks/useWorkerStyleCalculation.ts
export function useWorkerStyleCalculation(
  elements: SelectedElement[],
  enabled = elements.length > 50,
) {
  const workerRef = useRef<Worker | null>(null);
  const [results, setResults] = useState<StyleValues[]>([]);

  useEffect(() => {
    if (!enabled) return;

    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../workers/styleCalculator.worker.ts", import.meta.url),
      );
    }

    const worker = workerRef.current;

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.type === "STYLES_COMPUTED") {
        setResults(e.data.results);
      }
    };

    worker.postMessage({
      type: "COMPUTE_STYLES",
      elements: elements.map(serializeElement),
    });

    return () => worker.terminate();
  }, [elements, enabled]);

  return results;
}
```

#### 14.2.2 PixiJS v8 WebGPU 업그레이드

```typescript
// src/canvas/renderer.ts
import { Application, autoDetectRenderer } from "pixi.js";

export async function initializeRenderer(canvas: HTMLCanvasElement) {
  // WebGPU 우선, WebGL2 fallback, WebGL1 최종 fallback
  const app = new Application();

  await app.init({
    canvas,
    preference: "webgpu",
    fallbackPreference: "webgl2",
    antialias: true,
    resolution: window.devicePixelRatio,
  });

  console.log(`[Renderer] Using: ${app.renderer.type}`);
  // 'webgpu' | 'webgl2' | 'webgl'

  return app;
}

// 렌더러 타입에 따른 최적화 분기
export function getOptimalBatchSize(rendererType: string): number {
  switch (rendererType) {
    case "webgpu":
      return 10000;
    case "webgl2":
      return 5000;
    default:
      return 2000;
  }
}
```

#### 14.2.3 React Compiler 도입 (React 19)

```typescript
// babel.config.js 또는 vite.config.ts
// React Compiler 플러그인 설정

// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          // React Compiler 활성화 시
          // ['babel-plugin-react-compiler', {}],
        ],
      },
    }),
  ],
});

// 컴포넌트에서 수동 메모이제이션 제거 가능
// Before (React 18)
const MemoizedComponent = React.memo(({ value }) => {
  const computed = useMemo(() => expensiveCalc(value), [value]);
  const handler = useCallback(() => doSomething(value), [value]);
  return <div onClick={handler}>{computed}</div>;
});

// After (React 19 + Compiler)
function Component({ value }) {
  const computed = expensiveCalc(value);  // 자동 메모이제이션
  const handler = () => doSomething(value); // 자동 메모이제이션
  return <div onClick={handler}>{computed}</div>;
}
```

#### 14.2.4 SharedArrayBuffer 도입 (선택적)

```typescript
// 서버 헤더 설정 필요
// Cross-Origin-Opener-Policy: same-origin
// Cross-Origin-Embedder-Policy: require-corp

// src/workers/sharedStyleBuffer.ts
export function createSharedStyleBuffer(elementCount: number) {
  // 요소당 28개 속성 × 4바이트 (float32)
  const bytesPerElement = 28 * 4;
  const buffer = new SharedArrayBuffer(elementCount * bytesPerElement);
  const view = new Float32Array(buffer);

  return {
    buffer,
    view,
    getElementOffset: (index: number) => index * 28,
  };
}
```

### 14.3 기대 효과

| 항목                              | Before             | After             | 개선율          |
| --------------------------------- | ------------------ | ----------------- | --------------- |
| 100+ 요소 스타일 계산             | 메인 스레드 블로킹 | Worker에서 비동기 | UI 블로킹 0%    |
| WebGPU 렌더링 (지원 시)           | WebGL              | WebGPU            | 30-50% 빠름     |
| React 메모이제이션 보일러플레이트 | 수동               | 자동              | 코드량 50% 감소 |
| Worker ↔ 메인 데이터 전송         | postMessage 복사   | SharedArrayBuffer | 90% 지연 감소   |

### 14.4 체크리스트

#### Web Worker

- [ ] `styleCalculator.worker.ts` 구현
- [ ] `useWorkerStyleCalculation` 훅 구현
- [ ] 50+ 요소 선택 시 자동 전환 로직
- [ ] Worker 에러 핸들링 및 fallback

#### PixiJS v8

- [ ] PixiJS v8로 업그레이드
- [ ] WebGPU 렌더러 초기화 로직
- [ ] 렌더러 타입별 최적화 분기
- [ ] 브라우저 호환성 테스트

#### React Compiler

- [ ] React 19 업그레이드 대기
- [ ] babel-plugin-react-compiler 설정
- [ ] 기존 useMemo/useCallback 점진적 제거
- [ ] 성능 비교 벤치마크

#### SharedArrayBuffer (선택)

- [ ] 서버 COOP/COEP 헤더 설정
- [ ] SharedArrayBuffer 기반 데이터 구조 설계
- [ ] Atomics를 활용한 동기화 로직
- [ ] 브라우저 지원 fallback

---

## 15. 저사양 환경 특화 최적화

### 15.1 저사양 기기 감지

```typescript
// src/utils/deviceCapability.ts

export interface DeviceCapability {
  tier: "high" | "medium" | "low";
  cores: number;
  memory: number; // GB
  gpu: "webgpu" | "webgl2" | "webgl";
}

export function detectDeviceCapability(): DeviceCapability {
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as any).deviceMemory ?? 4;

  let tier: DeviceCapability["tier"];
  if (cores >= 8 && memory >= 8) {
    tier = "high";
  } else if (cores >= 4 && memory >= 4) {
    tier = "medium";
  } else {
    tier = "low";
  }

  return { tier, cores, memory, gpu: detectGPU() };
}

function detectGPU(): DeviceCapability["gpu"] {
  if ("gpu" in navigator) return "webgpu";
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2");
  return gl ? "webgl2" : "webgl";
}
```

### 15.2 Tier별 설정

```typescript
// src/config/performancePresets.ts

export const PERFORMANCE_PRESETS = {
  high: {
    pixi: {
      antialias: true,
      resolution: window.devicePixelRatio,
      legacy: false,
    },
    stylePanel: {
      debounceMs: 50,
      lazyLoadSections: false,
      enableWorker: true,
    },
  },
  medium: {
    pixi: {
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 1.5),
      legacy: false,
    },
    stylePanel: {
      debounceMs: 100,
      lazyLoadSections: true,
      enableWorker: true,
    },
  },
  low: {
    pixi: {
      antialias: false,
      resolution: 1,
      legacy: true,
    },
    stylePanel: {
      debounceMs: 150,
      lazyLoadSections: true,
      enableWorker: false, // Worker 오버헤드가 더 클 수 있음
    },
  },
} as const;
```

### 15.3 메모리 예산

| 환경   | 메모리 예산 | Object Pool 크기 | GC 주기 |
| ------ | ----------- | ---------------- | ------- |
| 고사양 | 512MB+      | 200              | 60초    |
| 중간   | 256-512MB   | 100              | 30초    |
| 저사양 | <256MB      | 50               | 15초    |

### 15.4 체크리스트

- [ ] `detectDeviceCapability` 함수 구현
- [ ] `PERFORMANCE_PRESETS` 설정 정의
- [ ] 앱 초기화 시 프리셋 자동 적용
- [ ] 사용자 수동 설정 옵션 제공 (선택)

---

## 16. 전체 성능 개선 요약

### 16.1 Phase별 누적 효과

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          성능 개선 누적 그래프                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  리렌더링 감소율                                                            │
│  100% ┤                                                    ████████ 95%    │
│   90% ┤                                          ████████████████████      │
│   80% ┤                              ████████████████████████████████ 85%  │
│   70% ┤                    ██████████████████████████████████████████ 75%  │
│   60% ┤                    ██████████████████████████████████████████      │
│   50% ┤          ██████████████████████████████████████████████████ 40%    │
│   40% ┤          ██████████████████████████████████████████████████        │
│   30% ┤          ██████████████████████████████████████████████████        │
│   20% ┤          ██████████████████████████████████████████████████        │
│   10% ┤          ██████████████████████████████████████████████████        │
│    0% ┼──────────┴──────────┴──────────┴──────────┴──────────┴─────────    │
│        Baseline   Phase 1    Phase 2    Phase 3    Phase 4    Phase 5      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 16.2 세부 메트릭

| Phase          | 리렌더링 감소      | 계산 시간 감소 | 메모리 감소 | UI 반응성   | 상태    |
| -------------- | ------------------ | -------------- | ----------- | ----------- | ------- |
| 0 (준비)       | 0%                 | 0%             | 0%          | 기준선 설정 | ✅ 완료 |
| 1 (Quick Wins) | 40%                | 30%            | -           | 50% 향상    | ✅ 완료 |
| 2 (구조적)     | 75%                | 60%            | 10%         | 70% 향상    | ✅ 완료 |
| 3 (상태 관리)  | **100%** (동일 값) | 70%            | 15%         | 80% 향상    | ✅ 완료 |
| 4 (메모리)     | 85%                | 70%            | 45%         | 85% 향상    | 대기    |
| 5 (장기)       | 95%                | 85%            | 50%         | 95% 향상    | 대기    |

**Phase 3 실제 결과 (2025-12-21):**

- 동일 스타일 요소 교차 선택: **리렌더 0회** (이전: 매번 150-200ms)
- Jotai selectAtom equality 체크로 불필요한 리렌더 완전 차단
- Violation 발생 시 수치는 비슷하지만, **발생 빈도 대폭 감소**

### 16.3 ROI 분석

| Phase | 구현 비용 | 효과             | ROI   |
| ----- | --------- | ---------------- | ----- |
| 0     | 낮음      | 필수 기반        | ★★★★★ |
| 1     | 낮음      | 높음             | ★★★★★ |
| 2     | 중간      | 매우 높음        | ★★★★☆ |
| 3     | 높음      | 높음             | ★★★☆☆ |
| 4     | 중간      | 중간             | ★★★☆☆ |
| 5     | 매우 높음 | 중간 (미래 대비) | ★★☆☆☆ |

---

## 17. 전체 체크리스트 (Master Checklist)

### Phase 0: 준비 단계 ✅ 완료 (2025-12-20)

> **2026-08-17 후기** — 아래 두 항목이 만든 `src/utils/performance/` 배럴과 모니터
> 3종은 삭제됐다. 어느 모듈도 배럴을 import 하지 않아 등록 전역(`__perfTools` 등)이
> 실제로 붙은 적이 없었다. 계측은 `builder/utils/perfMarks.ts`
> (`window.__composition_PERF__`), FPS·메모리는 Monitor 패널이 대신한다.

- [x] Performance markers 유틸리티 생성 (`src/utils/performance/stylePanelMetrics.ts`)
- [x] 벤치마크 스크립트 작성 (`src/utils/performance/fpsMonitor.ts`, `memoryMonitor.ts`)
- [x] 기준선 메트릭 수집 및 문서화 (`docs/research/BENCHMARK_BASELINE_TEMPLATE.md`)
- [ ] CI/CD 성능 회귀 테스트 추가 (선택적)

### Phase 1: Quick Wins ✅ 완료 (2025-12-20)

#### Selector 최적화

- [x] TransformSection selector primitive 변경 (useTransformValues 훅 사용)
- [x] LayoutSection selector primitive 변경 (useLayoutValues 훅 사용)
- [x] AppearanceSection selector primitive 변경 (useAppearanceValues 훅 사용)
- [x] TypographySection selector primitive 변경 (useTypographyValues 훅 사용)
- [x] shallow 비교 적용 (각 섹션 memo + 커스텀 비교)

#### useTransition

- [x] StylePanel useTransition 추가 (`useOptimizedStyleActions.ts`)
- [x] 캔버스 업데이트 startTransition 래핑 (`updateStylesTransition`)
- [x] isPending UI 피드백 (훅에서 반환)
- [ ] useDeferredValue 미리보기 최적화 (선택적)

#### colord

- [x] colord 패키지 설치 (`pnpm add colord`)
- [x] colorUtils.ts 유틸리티 생성 (`src/utils/color/colorUtils.ts`)
- [x] 기존 색상 파싱 마이그레이션 (`cssColorToPixiHex` 통합)
- [x] ColorPicker 업데이트 (PropertyColor 이미 최적화됨)

#### 프레임 동기화

- [x] useRAFThrottle 훅 구현 (`src/hooks/useFrameCallback.ts` - `rafCallback`)
- [x] useIdleCallback 훅 구현 (`src/hooks/useFrameCallback.ts` - `idleCallback`)
- [x] useStyleUpdate 통합 훅 (`useOptimizedStyleActions.ts`)
- [x] 드래그/슬라이더 RAF 적용 (`PropertyUnitInput` onDrag prop)
- [x] 타이핑 Idle callback 적용 (`FourWayGrid`에 적용)

### Phase 2: 구조적 최적화 ✅ 완료 (2025-12-20)

#### 타입 정의

- [x] TransformStyleValues 정의 (useTransformValues.ts)
- [x] LayoutStyleValues 정의 (useLayoutValues.ts)
- [x] AppearanceStyleValues 정의 (useAppearanceValues.ts)
- [x] TypographyStyleValues 정의 (useTypographyValues.ts)

#### 섹션별 훅

- [x] useTransformValues 구현 (Phase 22)
- [x] useLayoutValues 구현 (Phase 22)
- [x] useAppearanceValues 구현 (Phase 22)
- [x] useTypographyValues 구현 (Phase 22)
- [x] 하위 호환 useStyleValues 래퍼
- [ ] 단위 테스트 작성 (선택적)

#### Lazy Hook Execution

- [x] SectionWrapper 컴포넌트 (PropertySection lazy children - Phase 20)
- [x] TransformSection 분리 (함수형 children 사용)
- [x] LayoutSection 분리 (함수형 children 사용)
- [x] AppearanceSection 분리 (함수형 children 사용)
- [x] TypographySection 분리 (함수형 children 사용)

#### Shorthand 확장

- [x] expandPadding 함수 (`src/utils/css/shorthandExpander.ts`)
- [x] expandMargin 함수 (`src/utils/css/shorthandExpander.ts`)
- [x] expandBorderRadius 함수 (`src/utils/css/shorthandExpander.ts`)
- [x] expandBorder 함수 (`src/utils/css/shorthandExpander.ts`)

### Phase 3: 고급 상태 관리 ✅ 완료 (2025-12-21)

#### Jotai

- [x] jotai 설치 (`pnpm add jotai`)
- [x] Provider 설정 (JotaiBridge 컴포넌트로 구현)
- [x] 기본 atoms 정의 (`atoms/styleAtoms.ts`)
- [x] 속성별 atoms (35개+) - selectAtom + equality 체크
- [x] Zustand ↔ Jotai bridge (`hooks/useZustandJotaiBridge.ts`)

#### 마이그레이션

- [x] TransformSection Jotai 적용 (`useTransformValuesJotai`)
- [x] LayoutSection Jotai 적용 (`useLayoutValuesJotai` + alignment key atoms)
- [x] AppearanceSection Jotai 적용 (`useAppearanceValuesJotai`)
- [x] TypographySection Jotai 적용 (`useTypographyValuesJotai`)
- [x] StylesPanel Jotai 최적화 (`hasSelectedElementAtom`, `modifiedCountAtom`, `isCopyDisabledAtom`)

#### 추가 최적화

- [x] PropertyColor key 패턴 유지 (Jotai equality 체크와 시너지)
- [x] AllSections, ModifiedSectionsWrapper 컴포넌트 분리
- [x] 섹션 props 제거 (selectedElement 전달 불필요)

#### Immer

- [ ] immer 설치 (현재 불필요 - Jotai selectAtom으로 충분)
- [ ] Zustand middleware 적용
- [ ] 상태 업데이트 리팩토링

### Phase 4: 메모리 최적화

#### Object Pool

- [ ] ObjectPool 클래스 구현
- [ ] styleValuesPool 인스턴스
- [ ] 섹션 훅에 풀 적용
- [ ] 릴리스 로직 검증

#### PixiJS 메모리

- [ ] CanvasMemoryManager 구현
- [ ] 텍스처 캐시 정리
- [ ] Graphics 재사용 패턴
- [ ] 이벤트 리스너 정리

#### 모니터링

- [ ] 메모리 모니터 유틸리티
- [ ] 개발 환경 로깅
- [ ] 메모리 회귀 테스트

### Phase 5: 장기 최적화

#### Web Worker

- [ ] styleCalculator.worker.ts
- [ ] useWorkerStyleCalculation 훅
- [ ] 50+ 요소 자동 전환
- [ ] 에러 핸들링 및 fallback

#### PixiJS v8

- [ ] v8 업그레이드
- [ ] WebGPU 초기화
- [ ] 렌더러별 최적화
- [ ] 호환성 테스트

#### React Compiler

- [ ] React 19 업그레이드 대기
- [ ] 플러그인 설정
- [ ] 메모이제이션 정리
- [ ] 벤치마크

#### SharedArrayBuffer

- [ ] COOP/COEP 헤더
- [ ] 데이터 구조 설계
- [ ] Atomics 동기화
- [ ] Fallback

### 저사양 최적화

- [ ] detectDeviceCapability 함수
- [ ] PERFORMANCE_PRESETS 설정
- [ ] 자동 프리셋 적용
- [ ] 수동 설정 옵션

---

## Sources

### 기존 참고 자료

- [Webstudio GitHub](https://github.com/webstudio-is/webstudio)
- [CSSTree GitHub](https://github.com/csstree/csstree)
- [Colord](https://github.com/omgovich/colord)
- [Culori](https://culorijs.org/)
- [MDN CSS Numeric Data Types](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Numeric_data_types)

### 추가 리서치 (2025년 12월)

**WebGL/Canvas 최적화**

- [MDN WebGL Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)
- [MDN Optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
- [Evil Martians - OffscreenCanvas + Web Workers](https://evilmartians.com/chronicles/faster-webgl-three-js-3d-graphics-with-offscreencanvas-and-web-workers)

**상태 관리 최적화**

- [React State Management 2025 - Zustand vs Jotai](https://dev.to/hijazi313/state-management-in-2025-when-to-use-context-redux-zustand-or-jotai-2d2k)
- [Jotai Comparison](https://jotai.org/docs/basics/comparison)
- [Signals in React 2025](https://dev.to/krish_kakadiya_5f0eaf6342/supercharge-your-react-apps-with-signals-the-future-of-reactive-state-management-in-2025-47a3)
- [useSyncExternalStore Optimization](https://thisweekinreact.com/articles/useSyncExternalStore-the-underrated-react-api)

**PixiJS 최적화**

- [PixiJS Performance Tips](https://pixijs.com/8.x/guides/concepts/performance-tips)
- [PixiJS Garbage Collection](https://pixijs.com/8.x/guides/concepts/garbage-collection)
- [PixiJS Deep Dive Optimization](https://medium.com/@turkmergin/maximising-performance-a-deep-dive-into-pixijs-optimization-6689688ead93)

**메모리 최적화 패턴**

- [Game Programming Patterns - Object Pool](https://gameprogrammingpatterns.com/object-pool.html)
- [Flyweight Pattern in JavaScript](https://medium.com/@artemkhrenov/the-flyweight-pattern-in-modern-javascript-memory-optimization-for-large-scale-applications-fb651a5511a3)
- [SharedArrayBuffer & Atomics](https://dev.to/rigalpatel001/high-performance-javascript-simplified-web-workers-sharedarraybuffer-and-atomics-3ig1)

**DOM 렌더링 전략**

- [Google Incremental DOM](https://google.github.io/incremental-dom/)
- [Virtual DOM vs Incremental DOM](https://auth0.com/blog/face-off-virtual-dom-vs-incremental-dom-vs-glimmer/)
