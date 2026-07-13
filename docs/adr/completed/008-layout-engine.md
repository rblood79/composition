# ADR: 캔버스 레이아웃 엔진 전환 (전략 D)

- 상태: **Implemented**
- 결정일: **2026-02-17**
- 마지막 수정: **2026-03-03**
- 대상 코드: `apps/builder/src/builder/workspace/canvas/layout/`
- 관련 경로:
  - `apps/builder/src/builder/workspace/canvas/layout/engines/`
  - `apps/builder/src/builder/workspace/canvas/wasm/`
  - `apps/builder/src/builder/workspace/canvas/sprites/`

---

## 1) 배경 (Context)

현재 레이아웃 시스템은 `@pixi/layout(Yoga)` + 커스텀 `BlockEngine/GridEngine` + Rust WASM 가속의 혼합 구조다. 이 구조는 기능/좌표/이벤트/파서가 분산되어 아래 문제가 누적되었다.

| 문제                              | 영향                             | 원인                                                    |
| --------------------------------- | -------------------------------- | ------------------------------------------------------- |
| 엔진 다중화(Flex/Block/Grid 분리) | 좌표 오차, 디버깅 비용 증가      | 엔진별 모델/규칙 차이                                   |
| `@pixi/layout`/`@pixi/ui` 결합도  | 교체 비용 증가, 이벤트 충돌 위험 | 렌더/레이아웃/이벤트 경계 불명확                        |
| CSS 값 파싱 경로 분산             | 동일 입력의 해석 불일치          | 파서 중복(`parseSize`, `parseCSSValue`, `parseCSSSize`) |
| Block/Inline 표현력 한계          | 복합 텍스트/인라인 흐름 부족     | 현재 BlockEngine의 기능 갭                              |

---

## 2) 의사결정 기준 (Decision Drivers)

1. CSS 커버리지 확대 (특히 Block/Inline/Float, Grid)
2. 엔진 경계 단순화와 유지보수성
3. 기존 Rust WASM 인프라 재사용 가능성
4. 성능 회귀 최소화와 단계적 롤아웃 가능성
5. 실패 시 빠른 롤백 경로 보유

---

## 3) 검토 대안 (Options)

### 전략 A: Taffy 단일 엔진 (Flex+Grid+Block 전면 통합)

- 장점: 엔진 수 최소화
- 단점: Inline Formatting Context 공백이 커서 웹 빌더 요구 대응이 어려움
- 판단: **기각**

### 전략 B: Taffy(Flex+Grid) + Dropflow(Block) 듀얼

- 장점: 기능 커버리지 최대
- 단점: HarfBuzz WASM 직접 번들링(+200-400KB) + 통합 복잡도/기간 증가
- 판단: **조건부 가능, 우선순위 하향** → 전략 D가 HarfBuzz 번들 문제를 해결하여 상위 호환

### 전략 C: Taffy(Flex+Grid) + 기존 커스텀 Block 유지

- 장점: 단기 리스크 최소
- 단점: Inline/Float/혼합 흐름 갭이 구조적으로 잔존
- 판단: **비최종안(명시 분리, 백업안)**

### 전략 D: Taffy(Flex+Grid) + Dropflow Fork(Block+Inline) + CanvasKit 텍스트 어댑터

- 장점: Block/Inline/Float/줄바꿈 요구를 실질적으로 충족
- 단점: Fork 유지보수 + 어댑터 PoC 리스크
- 판단: **최종 채택 → 이후 Dropflow Fork 제거, Taffy 단일 엔진(TaffyBlockEngine)으로 최종 통합**

---

## 4) 최종 결정 (Decision)

**전략 D를 채택한다. 이후 Dropflow Fork는 완전 제거되고, Taffy 단일 엔진 아키텍처(TaffyBlockEngine)로 최종 통합되었다.**

### 4.1 목표 아키텍처 (현재 구현 상태)

- `display: flex | inline-flex` → **TaffyFlexEngine** (Taffy WASM)
- `display: grid | inline-grid` → **TaffyGridEngine** (Taffy WASM)
- `display: block | inline | inline-block | flow-root` → **TaffyBlockEngine** (Taffy WASM, 전 Dropflow Fork)
- 텍스트 shaping/metrics → **CanvasKit Paragraph/SkFont 기반 어댑터**
- 렌더링 파이프라인 → 기존 CanvasKit/Skia 유지

> **변경 이력**: 초기 결정 당시 Block/Inline 경로는 Dropflow Fork(DropflowBlockEngine)로 구현되었다.
> 이후 Phase 11(2026-02-28)에서 Dropflow Fork가 완전 제거되고 TaffyBlockEngine으로 대체되어
> Taffy WASM 단일 엔진 체계로 통합되었다.

```typescript
// engines/fullTreeLayout.ts (현재 구현 — 단일 Taffy 엔진 체계)
// 모든 display 타입을 fullTreeLayout.ts의 buildNodeStyle()이 단일 WASM 호출로 처리.
// TaffyBlockEngine, TaffyFlexEngine, TaffyGridEngine이 display 타입별로 내부 라우팅.

import { elementToTaffyBlockStyle } from "./TaffyBlockEngine";

// block / inline-block / inline / flow-root / 기타 → TaffyBlockEngine 경로
// taffyDisplayAdapter가 모든 block layout 시뮬레이션 규칙을 TaffyDisplayConfig에 포함.
const taffyConfig = toTaffyDisplay(display, childDisplays, childElements);
const taffyStyle: TaffyStyle = elementToTaffyBlockStyle(element, taffyConfig);

// flex / inline-flex → TaffyFlexEngine 경로
// grid / inline-grid → TaffyGridEngine 경로
```

### 4.2 결정 근거 요약

1. Taffy 단독으로는 Inline Formatting Context 요구를 충족하지 못한다 ([taffy#627](https://github.com/DioxusLabs/taffy/issues/627): 메인테이너가 "inline/flow layout은 Taffy 외부에서 구현" 명시). → 이후 TaffyBlockEngine의 `taffyDisplayAdapter`가 inline-block 자식을 가진 부모를 flex row wrap으로 자동 변환하는 방식으로 Inline Flow를 시뮬레이션하여 해결.
2. (역사적) 초기 결정 당시 Dropflow Fork가 Block/Inline/Float/Line box 영역의 기능 공백을 메우는 역할을 담당했다. 이후 TaffyBlockEngine이 동일 역할을 대체하면서 Dropflow 의존이 제거되었다.
3. HarfBuzz 직접 의존은 CanvasKit 어댑터로 치환하여 중복 번들 리스크를 줄인다. **이것이 전략 B 대비 전략 D의 핵심 차별점이다** — 전략 B는 HarfBuzz WASM을 직접 번들링(+200-400KB)해야 하지만, 전략 D는 이미 로드된 CanvasKit의 Paragraph/SkFont API를 어댑터로 활용하여 추가 번들 비용 없이 동일한 텍스트 shaping을 확보한다.
4. 현 코드베이스의 WASM 빌드 인프라(`wasm-pack`, Cargo) 재사용이 가능하다.

---

## 5) 전략 C 명시 분리 (Deprecated Baseline)

> 이 섹션은 **폐기된 최종안이 아니라, 롤백 가능한 백업 기준선**을 문서화한다.

### 5.1 전략 C 정의

- Taffy로 Flex/Grid만 교체
- 기존 BlockEngine 유지

### 5.2 전략 C를 최종안으로 채택하지 않는 이유

- Inline/Float/혼합 콘텐츠/익명 박스 처리 공백이 장기적으로 남는다.
- 요구사항 대비 "기능 부채 고정화" 위험이 높다.

### 5.3 전략 C의 현재 역할

- Phase Gate 실패 시 즉시 되돌릴 수 있는 **Fallback 경로**
- 일정 보호를 위한 비상 플랜

---

## 6) 결과 영향 (Consequences)

### 긍정 효과

- Block/Inline/Float/줄바꿈을 포함한 CSS2 normal flow 대응력 향상
- 기존 커스텀 Block 보수 비용 축소(중장기)
- 엔진 책임 분리가 명확해져 디버깅 경계가 뚜렷해짐

### 부정/비용

- (해소됨) Dropflow Fork 유지보수 책임 → TaffyBlockEngine으로 대체 후 제거됨
- CanvasKit shaper 어댑터 구현 난이도 존재
- 초기 통합 단계에서 회귀 테스트 범위 확대 필요

---

## 7) 구현 계획 (Plan)

### Phase 0 (2주): `@pixi/ui` 로직 추출

- `borderUtils`, 색상 수학 로직을 순수 함수로 분리
- 텍스트 측정 경로를 CanvasKit 중심으로 정리
- UI 컴포넌트 교체를 위한 최소 인터페이스 확정

### Phase 1 (1주): Dropflow Fork Layer A 도입

- Block/Box/Image 레이어 포크
- composition 타입/스타일 시스템에 맞는 어댑터 작성

### Phase 2 (2주): CanvasKit Shaper PoC (핵심 게이트)

- `shapePart` 대체 경로 검증
- line metrics, bidi, fallback font 동작 검증

### Phase 3 (2주): BlockEngine → Dropflow Fork 교체

- 디스패처 반영
- min/max, fit-content 등 누락 기능 보완
- 기존 Block 테스트 + 회귀 케이스 이관

### Phase 4 (2-3주): Taffy WASM 바인딩

- `apps/builder/src/builder/workspace/canvas/wasm/Cargo.toml` 확장
- `taffy_bridge.rs` 작성
- TS 래퍼/타입/배치 API 구성

### Phase 5 (1-2주): Flex Yoga → Taffy 전환

- `styleToLayout.ts` 변환 경로 교체
- 기능 플래그 기반 단계적 전환

### Phase 6 (1-2주): Grid → Taffy Grid 통합

- 커스텀 GridEngine 의존 축소
- 핵심 Grid 케이스 회귀 검증

### Phase 7 (1주): @pixi/layout → 커스텀 엔진 독립화

- `@pixi/layout` Yoga 위임 경로 축소
- 커스텀 엔진이 모든 display 모드를 직접 처리하도록 전환

### Phase 8 (1주): 통합 테스트 및 안정화

- `WASM_FLAGS.LAYOUT_ENGINE` 활성화 검증
- `resolveLayoutSize()` 퍼센트 값 해석 수정
- Flex parent passthrough (center/alignment) 수정
- 기능 회귀 테스트

### Phase 9 (1주): 레거시 엔진 삭제 + 디스패처 정리 ← 완료 (2026-02-17)

- **Phase 9A**: 레거시 엔진 삭제 (`BlockEngine.ts` 952줄, `FlexEngine.ts` 65줄, `GridEngine.ts` 563줄)
- **Phase 9B**: Feature flag 제거 (`taffyFlex`, `taffyGrid`, `dropflowBlock`)
- **Phase 9C**: `engines/index.ts` 디스패처 정리 (`shouldDelegateToPixiLayout` 제거, 직접 라우팅)
- **Phase 9D**: `TaffyFlexEngine` / `TaffyGridEngine` / `TaffyBlockEngine (Phase 11에서 Dropflow 대체)` 리뷰 이슈 수정

---

## 8) 게이트 및 롤백 (Risk / Rollback)

### Gate A (Phase 2 종료 시점)

- 조건: CanvasKit Shaper PoC 성공
- 실패 시: **전략 C로 롤백**. Phase 0~1 작업물(Dropflow Fork 어댑터, `@pixi/ui` 추출)은 feature branch에 보존하되, 메인 레이아웃 경로는 기존 BlockEngine으로 복귀한다. Phase 0의 `@pixi/ui` 순수 함수 추출은 전략 C에서도 유효하므로 머지 가능.

### Gate B (Phase 5 종료 시점)

- 조건: Flex 회귀 테스트 통과 + 성능 허용 범위 내
- 실패 시: **전략 D-partial** 상태로 운용 — Flex는 Yoga(@pixi/layout) 유지, Block/Inline만 Dropflow Fork 적용. 이 혼합 상태는 현재 하이브리드 구조(Yoga + 커스텀 Block)와 엔진 경계가 동일하므로 안정적 운용이 가능하다. Taffy Flex 전환은 별도 일정으로 재시도.

### Gate C (Phase 9 종료 시점) — 통과

- 조건: 레거시 엔진 삭제 완료, 번들 크기 절감 (~1,580줄 코드 삭제)
- 결과: **조건 충족. Gate C 통과.**
  - `BlockEngine.ts`(952줄), `FlexEngine.ts`(65줄), `GridEngine.ts`(563줄) 삭제 완료
  - (초기 기록) WASM 미로드 시 `DropflowBlockEngine` 폴백으로 안전성 확보 → 이후 Phase 11에서 `TaffyBlockEngine`으로 대체됨

---

## 9) 성공 기준 (Success Metrics)

1. 핵심 레이아웃 회귀 테스트(기준 케이스) 100% 통과
2. Inline/Float/혼합 콘텐츠 렌더링 정확도 확보
3. 기존 대비 치명적 인터랙션 버그(클릭/호버 오작동) 감소
4. 성능 회귀가 합의한 임계치 이내 유지

---

## 10) 범위 외 (Non-goals)

- 본 ADR은 디자인 시스템 컴포넌트 시각 리디자인을 다루지 않는다.
- 본 ADR은 CanvasKit 자체 교체/렌더러 아키텍처 재정의를 다루지 않는다.

---

## 11) 관련 문서

### 내부 문서

- [WASM 아키텍처](../../legacy/RENDERING_ARCHITECTURE.md)
- [ADR-003: Canvas 렌더링](./003-canvas-rendering.md)

### 외부 참고 저장소

| 저장소           | 용도                               | 링크                                           |
| ---------------- | ---------------------------------- | ---------------------------------------------- |
| DioxusLabs/taffy | Flex + Grid + Block WASM 엔진      | https://github.com/DioxusLabs/taffy            |
| chearon/dropflow | CSS2 Block/Inline 엔진 (Fork 원본) | https://github.com/chearon/dropflow            |
| Taffy PR #394    | 공식 WASM 바인딩 (Draft)           | https://github.com/DioxusLabs/taffy/pull/394   |
| Taffy Issue #627 | Inline/Flow layout 지원 논의       | https://github.com/DioxusLabs/taffy/issues/627 |
| DioxusLabs/blitz | Taffy + Parley 통합 사례           | https://github.com/DioxusLabs/blitz            |
| kane50613/takumi | Taffy WASM 통합 사례               | https://github.com/kane50613/takumi            |

---

## 12) 변경 이력

- **2026-02-17**: ADR 형식으로 재작성. 전략 D 단일 결론 확정, 전략 C는 Deprecated Baseline(Fallback 경로)으로 명시 분리. 전략 B vs D 차별화 근거 추가, Gate A/B 롤백 범위 명확화, 외부 참고 저장소 복원.
- **2026-02-17**: Phase 9 완료 — 레거시 엔진(`BlockEngine`, `FlexEngine`, `GridEngine`) 삭제, Feature flag 제거, 디스패처 정리. 전략 D 목표 아키텍처 달성.
- **2026-02-21**: Post-Implementation Notes 추가 — `LayoutContext.getChildElements` 확장, `enrichWithIntrinsicSize` 개선(childElements 파라미터, fontBoundingBox line-height 통일), 수정 파일 목록.
- **2026-02-26**: Phase 4-1C box-sizing 근본 수정 기록 추가 — `enrichWithIntrinsicSize()` border-box 통일, `applyCommonTaffyStyle()` content-box 변환.
- **2026-02-26**: fontSize CSS 상속 일관성 수정 기록 추가 — `calculateContentHeight()` computedStyle 파라미터 추가, min/max-content 하드코딩 제거.
- **2026-03-01**: fullTreeLayout.ts 속성 커버리지 확장 기록 추가 — `applyFlexItemProperties()` 공유 유틸 추가, `applyCommonTaffyStyle()` overflow/aspectRatio 지원 추가, block/grid 경로 flex 부모 자식 처리 개선, CSS `height: auto` 컨테이너 enrichment 제거.
- **2026-03-03**: Phase 11 완료 반영 — Dropflow Fork(`DropflowBlockEngine`) 완전 제거, `TaffyBlockEngine`으로 대체. 4.1 목표 아키텍처, 코드 예시, 결정 근거, 결과 영향 섹션을 현재 Taffy 단일 엔진 체계에 맞게 업데이트. 섹션 3 검토 대안은 역사적 기록으로 원문 유지, 전략 D 채택 근거에 이후 전환 이력 추가.

---

## 13) 구현 후 노트 (Post-Implementation Notes)

### Post-Implementation Notes (2026-02-21)

#### LayoutContext 확장

- `getChildElements?: (elementId: string) => Element[]` — 컨테이너 컴포넌트의 자식 Element 접근
- `BuilderCanvas.tsx`에서 `pageChildrenMap` 기반으로 주입
- `enrichWithIntrinsicSize`에서 `calculateContentWidth/Height`에 자식 전달

#### enrichWithIntrinsicSize 개선

- INLINE_BLOCK_TAGS는 항상 padding+border를 border-box 크기에 포함 (layoutInlineRun 호환)
- `childElements` 파라미터 추가: 자식 Element 기반 너비/높이 계산 (ToggleButtonGroup 등)
- fontBoundingBox 기반 line-height 통일: `measureFontMetrics().lineHeight` 사용

#### 수정된 파일

| 파일                  | 변경                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------- |
| `LayoutEngine.ts`     | `LayoutContext.getChildElements` 추가                                                 |
| `utils.ts`            | `enrichWithIntrinsicSize` childElements, fontBoundingBox lineHeight, border shorthand |
| `TaffyBlockEngine.ts` | enrichment 시 childElements 전달 (구 DropflowBlockEngine.ts — Phase 11에서 대체됨)    |
| `TaffyFlexEngine.ts`  | enrichment 시 childElements 전달, context 파라미터 추가                               |
| `BuilderCanvas.tsx`   | `getChildElements` context 주입                                                       |
| `textMeasure.ts`      | `measureWrappedTextHeight` fontBoundingBox lineHeight                                 |

#### CanvasKit halfLeading 보정 (2026-02-26)

CSS `line-height`는 extra leading을 텍스트 상하 균등 분배(half-leading)하여 세로 중앙 정렬합니다.
CanvasKit의 `heightMultiplier`는 기본적으로 extra leading을 하단에만 추가하므로
`halfLeading: true` 옵션을 명시하여 CSS와 동일한 렌더링을 보장합니다.

| 파일                | 변경                                                                         |
| ------------------- | ---------------------------------------------------------------------------- |
| `nodeRenderers.ts`  | ParagraphStyle textStyle에 `halfLeading: true` 추가                          |
| `styleConverter.ts` | `convertToTextStyle()` lineHeight 배수 판별: 문자열 `"1.4"` 등도 배수로 인식 |

이 수정은 `renderText()` 함수에 위치하여 TextSprite 경로(Text, Heading, Description 등)와
Spec shapes 텍스트 경로(Button, Badge, Input 등) 양쪽에 모두 적용됩니다.

**주의**: CSS `line-height`는 단위 없는 숫자(`"1.4"`)일 때 배수, `px`/`em` 단위가 있으면 절대값입니다.
`convertToTextStyle()`에서 `typeof === 'number'`만 체크하면 문자열 배수 값이 픽셀로 오인되어
`leading = 0` → `heightMultiplier = 0` → halfLeading 미적용됩니다.

#### box-sizing 근본 수정 — enrichWithIntrinsicSize (2026-02-26)

웹 CSS `* { box-sizing: border-box }` 동작과 일치하도록 레이아웃 엔진의 크기 주입 방식을 통일.

**문제**: `enrichWithIntrinsicSize()`가 CSS padding 유무에 따라 content-box/border-box를 혼합 주입.
Dropflow adapter는 `boxSizing: 'border-box'` 고정이므로, content-box 값이 들어오면 padding이 이중 차감됨.

**수정**:

| 파일               | 변경                                                                        |
| ------------------ | --------------------------------------------------------------------------- |
| `engines/utils.ts` | `enrichWithIntrinsicSize()` — 항상 border-box 값 주입 (조건부 분기 제거)    |
| `engines/utils.ts` | `applyCommonTaffyStyle()` — border-box → content-box 변환 추가 (Taffy 호환) |

- Dropflow: 변경 없음 (`boxSizing: 'border-box'` 네이티브 지원)
- Taffy: `applyCommonTaffyStyle()`에서 numeric width/height에서 padding+border 차감

#### fontSize CSS 상속 일관성 — calculateContentHeight (2026-02-26)

`calculateContentWidth()`에서 적용된 CSS 상속 fontSize 패턴을 `calculateContentHeight()`와 `enrichWithIntrinsicSize()` min/max-content 경로에도 통일.

**문제**: width 측정은 `computedStyle?.fontSize ?? 16`을 사용하지만, height 측정은 `?? 16` 하드코딩,
min/max-content는 `14` 하드코딩. 부모에 fontSize: 20 설정 시 width/height 측정 불일치.

**수정**:

| 파일               | 변경                                                                                |
| ------------------ | ----------------------------------------------------------------------------------- |
| `engines/utils.ts` | `calculateContentHeight()` — `computedStyle?: ComputedStyle` 5번째 파라미터 추가    |
| `engines/utils.ts` | TEXT_LEAF_TAGS fontSize/fontWeight/fontFamily에 computedStyle fallback              |
| `engines/utils.ts` | `enrichWithIntrinsicSize()` min/max-content fontSize `14` → `computedStyle ?? 16`   |
| `engines/utils.ts` | `enrichWithIntrinsicSize()` → `calculateContentHeight()` 호출 시 computedStyle 전달 |

### Post-Implementation Notes (2026-03-01)

#### fullTreeLayout.ts 속성 커버리지 확장

`buildNodeStyle()` 함수와 `applyCommonTaffyStyle()` 공유 유틸의 CSS 속성 지원 범위를 확장했다.

**배경**: 기존에 `flex` shorthand 분해(`applyFlexItemProperties`)가 flex 경로에서만 동작하고 block/grid 자식에서는 무시되었으며, `overflow-x/overflow-y`와 `aspect-ratio`는 Taffy 전달 경로가 없었다.

**변경 1 — `applyFlexItemProperties()` 공유 유틸**

| 항목      | 내용                                                                                          |
| --------- | --------------------------------------------------------------------------------------------- |
| 위치      | `engines/utils.ts`                                                                            |
| 역할      | `flex` shorthand → `flexGrow` / `flexShrink` / `flexBasis` 분해                               |
| 적용 경로 | flex 경로(기존) + **block/grid 경로(신규)** — `buildNodeStyle(parentDisplay)` 파라미터로 분기 |

```typescript
// fullTreeLayout.ts — buildNodeStyle() 시그니처 변경
function buildNodeStyle(element: Element, parentDisplay?: string): TaffyStyle {
  const style = applyCommonTaffyStyle(element);
  // block/grid 자식이어도 flex 부모 아래라면 flex item 속성 적용
  if (parentDisplay === "flex" || parentDisplay === "inline-flex") {
    applyFlexItemProperties(style, element.style);
  }
  return style;
}
```

**변경 2 — `applyCommonTaffyStyle()` overflow/aspectRatio 추가**

| CSS 속성       | 이전                       | 이후                                                       |
| -------------- | -------------------------- | ---------------------------------------------------------- |
| `overflow`     | Flex/Grid 경로에만 전달    | Flex/Grid/Block 3경로 공통 전달                            |
| `overflow-x`   | BFC baseline 계산에만 사용 | Taffy `overflowX` 필드로 전달                              |
| `overflow-y`   | BFC baseline 계산에만 사용 | Taffy `overflowY` 필드로 전달                              |
| `aspect-ratio` | 미지원                     | `applyCommonTaffyStyle()` 내에서 `aspectRatio` 필드로 전달 |

**변경 3 — CSS `height: auto` 컨테이너 enrichment 제거**

| 항목 | 내용                                                                                                  |
| ---- | ----------------------------------------------------------------------------------------------------- |
| 문제 | `enrichWithIntrinsicSize()`가 `height: auto` 컨테이너에 계산 높이를 주입 → Taffy 자동 계산 억제       |
| 수정 | `height === 'auto'`이거나 미지정인 경우 enrichment height 주입 스킵 — Taffy가 자식 기반으로 자동 계산 |
| 영향 | `height: auto` 컨테이너의 실제 콘텐츠 높이가 레이아웃 결과에 정확히 반영됨                            |

#### 수정된 파일

| 파일                        | 변경                                                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `engines/fullTreeLayout.ts` | `buildNodeStyle(parentDisplay)` 파라미터 추가, block/grid 경로에 `applyFlexItemProperties()` 호출                             |
| `engines/utils.ts`          | `applyFlexItemProperties()` 공유 유틸 추출, `applyCommonTaffyStyle()`에 `overflow`/`overflowX`/`overflowY`/`aspectRatio` 추가 |
| `engines/utils.ts`          | `enrichWithIntrinsicSize()` — `height: auto` 컨테이너 enrichment height 제거                                                  |
