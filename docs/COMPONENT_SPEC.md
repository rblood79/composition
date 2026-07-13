# Component Spec Architecture - 상세 설계 문서

> ⚠️ **DEPRECATED / STALE (2026-04-18, 2026-07-08 재확인)** — 본 문서는 **2026-03-03 시점 기준**이며 이후 다수의 ADR에 의해 **광범위하게 stale**합니다. 현행 상태와 일치하지 않는 심볼·파일명이 다수 포함되어 있으므로 **현재 작업의 레퍼런스로 사용 금지**.
>
> **2026-07-08 추가**: [ADR-142](adr/completed/142-starter-spec-component-system-cutover.md)(Implemented 2026-06-02)로 D3 시각 SSOT가 컴포넌트당 spec 파일에서 **catalog(`COMPONENT_RULES_TABLE`) + theme/tokens root collection**으로 전환됨. 아래 §"대체 참조"의 "ADR-036 Spec-First 정본" / "Spec SSOT = spec 파일" 서술은 stale — [ADR-036](adr/completed/036-spec-first-single-source.md)은 Superseded by ADR-142. 잔존 spec은 Frame/Group/Slot 3개 한정.
>
> **stale 범위 (grep 94회 매칭)**:
>
> - `ElementSprite.tsx` — ADR-100 Phase 9 (2026-04-06)에서 PixiJS 단일 렌더러 제거로 경로 변경
> - `CHILD_COMPOSITION_EXCLUDE_TAGS` 단일 Set — ADR-072 (2026-04-18)에서 `SHELL_ONLY_CONTAINER_TAGS` + `SYNTHETIC_CHILD_PROP_MERGE_TAGS` 2분할
> - `SPEC_RENDERS_ALL_TAGS_SET` / `TRANSPARENT_CONTAINER_TAGS` — Compositional Architecture 전환 이후 재배치 또는 폐기
> - PixiJS / `@pixi/layout` — ADR-100 Phase 9에서 완전 제거
> - Phase 1~6 구현 상세 — ADR-036 Spec-First 재승격 체인(ADR-057~062)으로 대체됨
>
> **대체 참조 (우선순위)**:
>
> 1. **ADR 체인**: ADR-036 (Spec-First 정본) → ADR-057~062 (Text/Form/Focus/Variant 재승격) → ADR-100 (Unified Skia) → ADR-072 (`_hasChildren` 컨벤션) → ADR-063 (SSOT Charter 3-Domain)
> 2. **규칙 파일**: [`.claude/rules/canvas-rendering.md`](../.claude/rules/canvas-rendering.md) / [`.claude/rules/layout-engine.md`](../.claude/rules/layout-engine.md) / [`.claude/rules/ssot-hierarchy.md`](../.claude/rules/ssot-hierarchy.md)
> 3. **skill 문서**: [`.claude/skills/composition-patterns/`](../.claude/skills/composition-patterns/)
> 4. **Spec SSOT**: `packages/specs/src/components/*.spec.ts` (실제 코드가 정본)
>
> **보존 이유**: 초기 아키텍처 의사결정 맥락(Why) + React Aria DOM 구조/ARIA 매핑 부록(아직 유효). 전면 재작성은 비용 대비 가치 낮음(ADR-036 이후 진짜 SSOT는 spec 파일).
>
> ---
>
> **작성일**: 2026-01-27 | **수정일**: 2026-03-03
> **상태**: Phase 6 Skia Spec 렌더링 구현 완료 | **Compositional Architecture 전환 완료** (2026-02-25) — SPEC_RENDERS_ALL_TAGS 폐기, 7개 Child Spec 추가
> **목표**: Builder(CanvasKit/Skia)와 Publish(React)의 100% 시각적 일치
> **통합**: `REACT_ARIA.md` 문서를 본 문서에 병합 (2026-03-03) — React Aria DOM 구조 레퍼런스 및 ARIA Role 매핑을 부록으로 이관

---

## 목차

1. [Executive Summary](#1-executive-summary)
2. [아키텍처 개요](#2-아키텍처-개요)
3. [Phase 0: 인프라 구축](#3-phase-0-인프라-구축)
4. [Phase 1: 핵심 컴포넌트 마이그레이션](#4-phase-1-핵심-컴포넌트-마이그레이션)
5. [Phase 2: Form 컴포넌트 마이그레이션](#5-phase-2-form-컴포넌트-마이그레이션)
6. [Phase 3: 복합 컴포넌트 마이그레이션](#6-phase-3-복합-컴포넌트-마이그레이션)
7. [Phase 4: 특수 컴포넌트 마이그레이션](#7-phase-4-특수-컴포넌트-마이그레이션)
8. [Phase 5: 검증 및 최적화](#8-phase-5-검증-및-최적화)
9. [Phase 6: Spec Shapes → Skia 렌더링 파이프라인](#9-phase-6-spec-shapes--skia-렌더링-파이프라인)
10. [기술 명세](#10-기술-명세)
11. [마이그레이션 전략](#11-마이그레이션-전략)
12. [Compositional Architecture 전환](#12-compositional-architecture-전환)

---

## 1. Executive Summary

### 1.1 현재 문제

```
현재: 3개 소스 분리
├── Button.css (CSS 스타일)
├── cssVariableReader.ts (런타임 변환)
└── PixiButton.tsx (PIXI 렌더링)

문제점:
- 시각적 일치율: 70-80%
- hover 계산 불일치 (CSS: color-mix vs PIXI: mixWithBlack)
- 62개 컴포넌트 × 3파일 = 186개 파일 유지보수
- 새 variant 추가 시 3곳 수정 필요
```

### 1.2 목표 아키텍처

```
목표: 1개 소스 (Component Spec)
└── Button.spec.ts
    ├── tokens (값)
    ├── render.shape (도형 정의)
    ├── render.react (React 변환)
    └── render.skia (CanvasKit/Skia Surface 렌더링)

기대효과:
- 시각적 일치율: 95-98%
- 단일 소스 = 완벽한 동기화
- 73개 컴포넌트 × 1파일 = 73개 파일
- 새 variant 추가 시 1곳만 수정
- CanvasKit Surface 렌더링으로 고품질 벡터/텍스트 출력
```

### 1.3 Phase 요약

| Phase | 내용                                     | 기간 | 산출물                                              |
| ----- | ---------------------------------------- | ---- | --------------------------------------------------- |
| 0     | 인프라 구축                              | 2주  | specs/, 렌더러, 타입 시스템                         |
| 1     | 핵심 컴포넌트 (10개)                     | 2주  | Button, Card, Badge 등                              |
| 2     | Form 컴포넌트 (16개)                     | 3주  | TextField, Select, Checkbox 등                      |
| 3     | 복합 컴포넌트 (20개)                     | 3주  | Table, Tree, Tabs 등                                |
| 4     | 특수 컴포넌트 (16개)                     | 2주  | DatePicker, ColorPicker 등                          |
| 5     | 검증 및 최적화 + **CanvasKit/Skia 전환** | 2주  | 테스트, 성능 최적화, Skia 렌더링 파이프라인         |
| 6     | Spec Shapes → Skia 렌더링 파이프라인     | 2주  | specShapeConverter, line 렌더러, flexDirection 지원 |

**총 기간: 16주 (약 4개월)**

#### CanvasKit/Skia 렌더링 전환 (완료)

CanvasKit/Skia가 **메인 렌더러로 전환 완료**되었다.
PixiJS는 씬 그래프 관리 + 이벤트(EventBoundary) 전용으로 축소되었으며,
모든 시각적 렌더링은 CanvasKit Surface에서 처리한다.

- 상세 설계: `docs/RENDERING_ARCHITECTURE.md` Phase 5-6

**Spec 시스템의 렌더러 독립성:**

- ComponentSpec의 **Shape 타입 정의**는 렌더러 무관 (CanvasKit 전환에도 유지)
- Shape 확장(C4-C6)은 CanvasKit 고급 기능을 반영한 타입 정의

**현재 렌더링 아키텍처:**

- **CanvasKit 렌더링**: `apps/builder/src/builder/workspace/canvas/skia/` 디렉토리
  - Element → SkiaNodeData → `renderNode()` 파이프라인
  - Spec Shape → Skia 매핑은 ElementSprite에서 skiaNodeData 생성 시 수행
- **PixiJS 역할**: 씬 그래프 구조 관리 + EventBoundary(Hit Testing) 전용

**Skia 색상 변환 안전 규칙 (ADR-017 패치):**

- `colorValueToFloat32()`: TokenRef → `resolveColor()` → hex → Float32Array RGBA
- **`"transparent"` 처리**: `resolveColor()` 결과가 `"transparent"`, `undefined`, `null`이면 `TRANSPARENT` (alpha=0) 반환
- **미처리 시**: `undefined >> 16` → `0` → 검정색(0,0,0,1) 렌더링 버그
- **Spec TokenRef 유효성**: `colors.ts`의 `ColorTokens`에 정의된 키만 사용 가능. CSS 변수명(`field-background` 등)을 TokenRef 키로 사용 금지 → `surface-container`, `on-surface-variant` 등 시맨틱 매핑명 사용

---

## 2. 아키텍처 개요

### 2.1 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    Component Spec Architecture               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  packages/specs/                                             │
│  ├── primitives/           # 기본 토큰                       │
│  │   ├── colors.ts         # 색상 토큰                       │
│  │   ├── spacing.ts        # 간격 토큰                       │
│  │   ├── typography.ts     # 타이포그래피 토큰               │
│  │   └── shadows.ts        # 그림자 토큰                     │
│  │                                                           │
│  ├── components/           # 컴포넌트 스펙                   │
│  │   ├── Button.spec.ts                                      │
│  │   ├── TextField.spec.ts                                   │
│  │   └── ... (75개)                                          │
│  │                                                           │
│  ├── renderers/            # 렌더러                          │
│  │   ├── ReactRenderer.ts  # Spec → React Props              │
│  │   ├── PixiRenderer.ts   # Spec → 씬 그래프 (이벤트 전용)  │
│  │   └── CSSGenerator.ts   # Spec → CSS 파일                 │
│  │                                                           │
│  └── types/                # 타입 정의                       │
│      ├── spec.types.ts                                       │
│      ├── shape.types.ts                                      │
│      └── token.types.ts                                      │
│                                                              │
│  ┌─────────────────┐       ┌──────────────────────────────┐  │
│  │ shared/         │       │ builder/workspace/canvas/    │  │
│  │ components/     │       │ skia/                        │  │
│  │                 │       │                              │  │
│  │ Button.tsx      │       │ SkiaOverlay.tsx              │  │
│  │ (ReactRenderer  │       │ nodeRenderers.ts             │  │
│  │  사용)          │       │ (CanvasKit Surface 렌더링)   │  │
│  └─────────────────┘       └──────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 데이터 흐름

```
┌──────────────┐
│ Button.spec  │ (Single Source of Truth)
└──────┬───────┘
       │
       ├──────────────┬──────────────┬──────────────────┐
       ▼              ▼              ▼                  ▼
┌────────────┐ ┌────────────┐ ┌──────────────┐ ┌────────────────────┐
│CSSGenerator│ │ReactRender.│ │PixiJS        │ │CanvasKit/Skia      │
│(빌드/배포) │ │(React DOM) │ │(씬 그래프)   │ │(Surface 렌더링)    │
└──────┬─────┘ └──────┬─────┘ └──────┬───────┘ └─────────┬──────────┘
       │              │              │                    │
       ▼              ▼              ▼                    ▼
  Button.css     Button.tsx    EventBoundary      CanvasKit Surface
  (Publish)      (React DOM)   (Hit Testing)     (drawRRect, drawParagraph...)
```

**렌더러 역할:**

- **CSSGenerator**: React 렌더링 + Publish(배포) 전용
- **ReactRenderer**: Preview iframe 내 React DOM 렌더링
- **PixiJS**: 씬 그래프 관리 + EventBoundary(Hit Testing) 전용 — 시각적 렌더링 없음
- **CanvasKit/Skia (Primary)**: `apps/builder/.../skia/` 디렉토리에서 Element → SkiaNodeData → `nodeRenderers.renderNode()` → CanvasKit Surface 파이프라인으로 시각적 렌더링 담당

**CanvasKit 렌더링 파이프라인:**

```
ElementSprite                  skia/useSkiaNode.ts        skia/SkiaOverlay.tsx         skia/nodeRenderers.ts
─────────────                  ───────────────────        ────────────────────         ─────────────────────
Element props  ──→  skiaNodeData 생성  ──→  글로벌 레지스트리 등록  ──→  renderNode(ck, canvas, tree)
                   (box/text/image)         (Map<elementId,              ├── renderBox()
                                             SkiaNodeData>)             ├── renderText()
                                                                        └── renderImage()
```

> **레이아웃 계층 분리**: Spec은 컴포넌트 **내부** Shape 배치를 정의하고,
> **외부** 컨테이너 간 배치는 Taffy 레이아웃 엔진이 담당합니다.
>
> | 엔진                 | 담당                  | CSS display                       |
> | -------------------- | --------------------- | --------------------------------- |
> | **Taffy WASM**       | Flex/Grid 레이아웃    | `flex`, `grid`, `inline-flex`     |
> | **TaffyBlockEngine** | Block/Inline 레이아웃 | `block`, `inline`, `inline-block` |
>
> React 경로는 브라우저 CSS 레이아웃을, Canvas 경로는 Taffy가 계산한 절대 px 값을 CanvasKit이 사용합니다.
> 자세한 내용은 [ADR-008: 레이아웃 엔진](./adr/008-layout-engine.md)를 참조하세요.

<details>
<summary>Phase 1-4 레거시 데이터 흐름 (PixiJS 중심)</summary>

```
┌──────────────┐
│ Button.spec  │ (Single Source of Truth)
└──────┬───────┘
       │
       ├────────────────────┬────────────────────┐
       ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ CSSGenerator │     │ ReactRenderer│     │ PixiRenderer │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       ▼                    ▼                    ▼
  Button.css           Button.tsx          PixiButton
  (빌드 시 생성)       (Props 적용)        (Graphics)
```

> Phase 1-4에서는 PixiRenderer가 시각적 렌더링을 직접 수행했으나,
> Phase 5 이후 CanvasKit/Skia로 완전히 대체되었다.

</details>

### 2.3 핵심 원칙

1. **Single Source of Truth**: 모든 스타일 정보는 Spec에서만 정의
2. **Shape-First**: 도형을 먼저 정의하고, 각 렌더러가 해석
3. **Token Reference**: 값은 토큰으로 참조 (하드코딩 금지)
4. **Renderer Agnostic**: Spec은 렌더러에 독립적
5. **Type Safe**: 모든 Spec은 TypeScript로 타입 검증
6. **Build-Sync**: Spec 소스 변경 후 반드시 `@composition/specs` 빌드 실행 (dist 미갱신 시 소비자가 구 버전 참조)

---

## 3. Phase 0: 인프라 구축

### 3.1 목표

- Spec 타입 시스템 구축
- Primitive 토큰 정의
- React/PIXI 렌더러 구현
- CSS 생성기 구현

### 3.2 디렉토리 구조

```
packages/
└── specs/
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── index.ts
    │   │
    │   ├── types/
    │   │   ├── index.ts
    │   │   ├── spec.types.ts        # ComponentSpec 인터페이스
    │   │   ├── shape.types.ts       # Shape 정의
    │   │   ├── token.types.ts       # 토큰 참조 타입
    │   │   └── state.types.ts       # 상태 (hover, pressed 등)
    │   │
    │   ├── primitives/
    │   │   ├── index.ts
    │   │   ├── colors.ts            # 색상 토큰
    │   │   ├── spacing.ts           # 간격 토큰
    │   │   ├── typography.ts        # 폰트 토큰
    │   │   ├── radius.ts            # 둥근 모서리 토큰
    │   │   └── shadows.ts           # 그림자 토큰
    │   │
    │   ├── renderers/
    │   │   ├── index.ts
    │   │   ├── ReactRenderer.ts     # Spec → React Props
    │   │   ├── PixiRenderer.ts      # Spec → 씬 그래프 이벤트 전용 (시각적 렌더링 없음)
    │   │   ├── CSSGenerator.ts      # Spec → CSS 파일 (React/Publish 전용)
    │   │   └── utils/
    │   │       └── tokenResolver.ts # 토큰 → 실제 값 (색상, 크기, 그림자 등)
    │   │
    │   ├── adapters/
    │   │   └── index.ts             # 어댑터 (placeholder)
    │   │
    │   ├── icons/
    │   │   └── lucideIcons.ts       # 아이콘 SVG 경로 데이터 레지스트리
    │   │
    │   ├── utils/
    │   │   └── stateEffect.ts       # 상태 이펙트 유틸리티
    │   │
    │   └── components/
    │       └── (현재 75개 Spec 파일 -- 부록 A 참조)
    │
    └── scripts/
        ├── generate-css.ts          # CSS 생성 스크립트
        └── validate-specs.ts        # Spec 검증 스크립트

# CanvasKit/Skia 렌더링 (builder 패키지 내 구현)
apps/builder/src/builder/workspace/canvas/skia/
    ├── SkiaRenderer.ts          # 메인 렌더링 엔진 (Phase 5: single Surface, Phase 6: 2-pass dual Surface + present)
    ├── SkiaOverlay.tsx          # React 컴포넌트 — CanvasKit canvas 관리, 렌더 루프
    ├── nodeRenderers.ts         # 노드 타입별 렌더링 (renderBox, renderText, renderImage)
    ├── specShapeConverter.ts    # Spec shapes -> Skia shapes 변환 (핵심)
    ├── renderCommands.ts        # Skia 렌더 커맨드 추상화
    ├── useSkiaNode.ts           # React hook — SkiaNodeData 레지스트리 관리
    ├── types.ts                 # SkiaNodeData, Fill/Effect 타입 정의
    ├── fills.ts                 # 6가지 Fill 타입 (Color, Linear/Radial/Angular/MeshGradient, Image)
    ├── effects.ts               # Effect 파이프라인 (Opacity, Blur, DropShadow — saveLayer 기반)
    ├── blendModes.ts            # 블렌드 모드 정의
    ├── fontManager.ts           # 폰트 로딩/캐싱, CanvasKit FontMgr 관리
    ├── selectionRenderer.ts     # 선택 박스, 트랜스폼 핸들, 라쏘 렌더링
    ├── hoverRenderer.ts         # 호버 상태 렌더링
    ├── gridRenderer.ts          # 그리드 렌더러
    ├── imageCache.ts            # 이미지 캐시
    ├── aiEffects.ts             # AI 생성 이펙트 (파티클/블러/플래시)
    ├── disposable.ts            # 리소스 정리 패턴 (SkiaDisposable)
    ├── createSurface.ts         # GPU Surface 팩토리
    ├── initCanvasKit.ts         # CanvasKit WASM 초기화
    ├── export.ts                # 캔버스 내보내기 유틸리티
    ├── workflowRenderer.ts      # 워크플로우 렌더러
    ├── workflowEdges.ts         # 워크플로우 엣지 렌더링
    ├── workflowGraphUtils.ts    # 워크플로우 그래프 유틸리티
    ├── workflowHitTest.ts       # 워크플로우 히트 테스트
    └── workflowMinimap.ts       # 워크플로우 미니맵

# 텍스트 측정 유틸리티 (canvas/utils/ 내 위치)
apps/builder/src/builder/workspace/canvas/utils/
    └── textMeasure.ts           # 텍스트 측정 유틸리티 (CanvasKit Paragraph 기반)
```

### 3.3 핵심 타입 정의

#### 3.3.1 ComponentSpec 인터페이스

```typescript
// packages/specs/src/types/spec.types.ts

import type { Shape } from "./shape.types";
import type { TokenRef } from "./token.types";
import type { StateStyles } from "./state.types";

/**
 * 컴포넌트 스펙 - 단일 소스
 */
export interface ComponentSpec<Props = Record<string, unknown>> {
  /** 컴포넌트 이름 */
  name: string;

  /** 컴포넌트 설명 */
  description?: string;

  /** 기본 HTML 태그 (React용) */
  element: keyof HTMLElementTagNameMap | "fragment";

  /**
   * 포털/오버레이 설정 (Dialog, Tooltip, Popover 등)
   * React에서는 createPortal, PIXI에서는 별도 레이어로 처리
   */
  overlay?: {
    /** 포털 사용 여부 */
    usePortal: boolean;

    /** 포털 컨테이너 (기본: document.body) */
    portalContainer?: string;

    /** 오버레이 타입 */
    type: "modal" | "popover" | "tooltip" | "drawer" | "toast";

    /** 백드롭 표시 여부 */
    hasBackdrop?: boolean;

    /** 백드롭 클릭 시 닫기 */
    closeOnBackdropClick?: boolean;

    /** ESC 키로 닫기 */
    closeOnEscape?: boolean;

    /** 포커스 트랩 사용 */
    trapFocus?: boolean;

    /** PIXI에서의 렌더링 레이어 (z-index 개념) */
    pixiLayer?: "content" | "overlay" | "modal" | "toast";
  };

  /** Variant 정의 */
  variants: Record<string, VariantSpec>;

  /** Size 정의 */
  sizes: Record<string, SizeSpec>;

  /** 기본 variant */
  defaultVariant: string;

  /** 기본 size */
  defaultSize: string;

  /** 상태별 스타일 (hover, pressed, disabled 등) */
  states: StateStyles;

  /** 렌더링 정의 */
  render: RenderSpec<Props>;
}

/**
 * Variant 스펙
 *
 * [상태 스타일 우선순위 규칙]
 * VariantSpec의 색상은 "variant별 색상 토큰"을 정의합니다.
 * states의 스타일은 "공통 상태 효과"(transform, shadow, opacity 등)를 정의합니다.
 *
 * 우선순위: VariantSpec 색상 > states 효과 (합성)
 * - hover 시: VariantSpec.backgroundHover + states.hover 효과
 * - pressed 시: VariantSpec.backgroundPressed + states.pressed 효과
 */
export interface VariantSpec {
  /** 배경색 (토큰 참조) - default 상태 */
  background: TokenRef;

  /** 배경색 hover - hover 상태의 색상 (states.hover와 합성됨) */
  backgroundHover: TokenRef;

  /** 배경색 pressed - pressed 상태의 색상 (states.pressed와 합성됨) */
  backgroundPressed: TokenRef;

  /** 텍스트 색상 */
  text: TokenRef;

  /** 텍스트 색상 hover (optional, 미지정 시 text 사용) */
  textHover?: TokenRef;

  /** 테두리 색상 (optional) */
  border?: TokenRef;

  /** 테두리 색상 hover (optional) */
  borderHover?: TokenRef;

  /** 배경 투명도 (optional, 0-1) */
  backgroundAlpha?: number;
}

/**
 * Size 스펙
 */
export interface SizeSpec {
  /** 높이 (px) */
  height: number;

  /** 가로 패딩 (px) */
  paddingX: number;

  /** 세로 패딩 (px) */
  paddingY: number;

  /** 폰트 크기 (토큰 참조) */
  fontSize: TokenRef;

  /** 둥근 모서리 (토큰 참조) */
  borderRadius: TokenRef;

  /** 아이콘 크기 (optional) */
  iconSize?: number;

  /** 간격 (optional) */
  gap?: number;
}

/**
 * 컴포넌트 상태
 * - default: 기본 상태
 * - hover: 마우스 오버
 * - pressed: 클릭/터치 중
 * - focused: 포커스 (마우스/터치)
 * - focusVisible: 키보드 포커스 (접근성)
 * - disabled: 비활성화
 */
export type ComponentState =
  | "default"
  | "hover"
  | "pressed"
  | "focused"
  | "focusVisible"
  | "disabled";

/**
 * 렌더링 스펙
 */
export interface RenderSpec<Props> {
  /**
   * 공통 도형 정의
   * React와 PIXI 모두에서 사용하는 도형 구조
   *
   * @param props - 컴포넌트 props
   * @param variant - 현재 variant 스펙
   * @param size - 현재 size 스펙
   * @param state - 현재 상태 (default, hover, pressed, focused, focusVisible, disabled)
   * @returns 렌더링할 도형 배열
   */
  shapes: (
    props: Props,
    variant: VariantSpec,
    size: SizeSpec,
    state: ComponentState,
  ) => Shape[];

  /**
   * React 특화 속성
   * className, data-* 속성 등
   */
  react?: (props: Props) => Record<string, unknown>;

  /**
   * PIXI 특화 속성
   * hitArea, eventMode 등
   */
  pixi?: (props: Props) => Record<string, unknown>;
}
```

```typescript
// packages/specs/src/types/state.types.ts

/**
 * 상태별 스타일 정의
 *
 * [역할 분리]
 * - VariantSpec: variant별 "색상" 정의 (background, text, border)
 * - StateStyles: 상태별 "효과" 정의 (transform, shadow, opacity 등)
 *
 * 두 가지가 합성되어 최종 스타일이 결정됩니다.
 */
export interface StateStyles {
  /** hover 상태 효과 (VariantSpec.backgroundHover와 합성) */
  hover?: StateEffect;

  /** pressed 상태 효과 (VariantSpec.backgroundPressed와 합성) */
  pressed?: StateEffect;

  /** focused 상태 효과 */
  focused?: StateEffect;

  /** disabled 상태 효과 */
  disabled?: StateEffect;

  /** focus-visible 상태 효과 (키보드 포커스) */
  focusVisible?: StateEffect;
}

/**
 * 상태 효과 (색상 제외 - 색상은 VariantSpec에서 정의)
 */
export interface StateEffect {
  /** 변형 */
  transform?: string;

  /** 그림자 (CSS box-shadow 형식 또는 토큰 참조 {shadow.md}) */
  boxShadow?: string | ShadowTokenRef;

  /** 투명도 (0-1) */
  opacity?: number;

  /** 스케일 (1 = 100%) */
  scale?: number;

  /** 아웃라인 (focus ring) */
  outline?: string;
  outlineOffset?: string;

  /** 커서 */
  cursor?: string;

  /** 트랜지션 (기본값 사용 시 생략) */
  transition?: string;

  /** 포인터 이벤트 */
  pointerEvents?: "none" | "auto";
}
```

#### 3.3.2 Shape 타입

```typescript
// packages/specs/src/types/shape.types.ts

/**
 * 기본 도형 타입
 */
/**
 * 모든 Shape의 공통 속성
 * Border/Shadow 타겟팅을 위한 id 포함
 */
export interface ShapeBase {
  /** 고유 식별자 (Border/Shadow 적용 대상 지정용) */
  id?: string;
}

/**
 * Shape 유니온 타입
 * 모든 Shape는 ShapeBase를 포함 (& 교차 타입)
 */
export type Shape =
  | (RectShape & ShapeBase)
  | (RoundRectShape & ShapeBase)
  | (CircleShape & ShapeBase)
  | (TextShape & ShapeBase)
  | (ShadowShape & ShapeBase)
  | (BorderShape & ShapeBase)
  | (ContainerShape & ShapeBase)
  | (GradientShape & ShapeBase)
  | (ImageShape & ShapeBase)
  | (LineShape & ShapeBase)
  | (IconFontShape & ShapeBase);

/**
 * 사각형
 */
export interface RectShape {
  type: "rect";
  x: number;
  y: number;
  width: number | "auto";
  height: number | "auto";
  fill?: ColorValue;
  fillAlpha?: number;
}

/**
 * 둥근 사각형
 */
export interface RoundRectShape {
  type: "roundRect";
  x: number;
  y: number;
  width: number | "auto";
  height: number | "auto";
  radius: number | [number, number, number, number]; // [tl, tr, br, bl]
  fill?: ColorValue;
  fillAlpha?: number;
}

/**
 * 원
 */
export interface CircleShape {
  type: "circle";
  x: number;
  y: number;
  radius: number;
  fill?: ColorValue;
  fillAlpha?: number;
}

/**
 * 텍스트
 */
export interface TextShape {
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight?: string | number;
  fontStyle?: "normal" | "italic";
  fill?: ColorValue;
  align?: "left" | "center" | "right";
  baseline?: "top" | "middle" | "bottom";

  /** 줄 높이 (배수, 예: 1.5) */
  lineHeight?: number;

  /** 자간 (px) */
  letterSpacing?: number;

  /** 텍스트 장식 */
  textDecoration?: "none" | "underline" | "line-through";

  /** 텍스트 변환 */
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";

  /** 최대 너비 (말줄임 처리) */
  maxWidth?: number;

  /** 오버플로우 처리 */
  overflow?: "visible" | "ellipsis" | "clip";

  /** 줄 수 제한 (multiline 텍스트) */
  maxLines?: number;
}

/**
 * 그림자
 *
 * [적용 방식]
 * - target이 없으면: shapes 배열에서 바로 앞의 도형에 적용
 * - target이 있으면: 해당 id를 가진 도형에 적용
 */
export interface ShadowShape {
  type: "shadow";

  /** 적용 대상 shape의 id (없으면 이전 shape에 적용) */
  target?: string;

  /** 그림자가 적용될 영역 (target 없이 직접 지정 시) */
  x?: number;
  y?: number;
  width?: number | "auto";
  height?: number | "auto";
  radius?: number | [number, number, number, number];

  /** 그림자 오프셋 */
  offsetX: number;
  offsetY: number;

  /** 블러 반경 */
  blur: number;

  /** 확산 (CSS spread) */
  spread?: number;

  /** 그림자 색상 */
  color: ColorValue;

  /** 투명도 */
  alpha?: number;

  /** 내부 그림자 여부 */
  inset?: boolean;
}

/**
 * 테두리
 *
 * [적용 방식]
 * - target이 없으면: shapes 배열에서 바로 앞의 도형 윤곽에 적용
 * - target이 있으면: 해당 id를 가진 도형에 적용
 */
export interface BorderShape {
  type: "border";

  /** 적용 대상 shape의 id (없으면 이전 shape에 적용) */
  target?: string;

  /** 테두리가 적용될 영역 (target 없이 직접 지정 시) */
  x?: number;
  y?: number;
  width?: number | "auto";
  height?: number | "auto";

  /** 테두리 두께 */
  borderWidth: number;

  /** 테두리 색상 */
  color: ColorValue;

  /** 테두리 스타일 */
  style?: "solid" | "dashed" | "dotted";

  /** 모서리 반경 */
  radius?: number | [number, number, number, number];

  /** 특정 변만 적용 */
  sides?: {
    top?: boolean;
    right?: boolean;
    bottom?: boolean;
    left?: boolean;
  };
}

/**
 * 컨테이너 (자식 요소 그룹)
 */
export interface ContainerShape {
  type: "container";
  x: number;
  y: number;
  width?: number | "auto";
  height?: number | "auto";
  children: Shape[];
  clip?: boolean;

  /** 레이아웃 설정 (Taffy WASM 연동) */
  layout?: ContainerLayout;
}

/**
 * 컨테이너 레이아웃 설정
 */
export interface ContainerLayout {
  /** 레이아웃 타입 (하이브리드 엔진: block→BlockEngine, flex→FlexEngine, grid→GridEngine) */
  display?: "flex" | "block" | "grid" | "none";

  /** 포지션 타입 */
  position?: "relative" | "absolute";

  /** absolute 포지션일 때 위치 */
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;

  /** z-index (레이어 순서) */
  zIndex?: number;

  // ─── Flex 레이아웃 ───
  flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
  flexWrap?: "nowrap" | "wrap" | "wrap-reverse";
  justifyContent?:
    | "flex-start"
    | "center"
    | "flex-end"
    | "space-between"
    | "space-around"
    | "space-evenly";
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
  alignContent?:
    | "flex-start"
    | "center"
    | "flex-end"
    | "stretch"
    | "space-between"
    | "space-around";

  // ─── Grid 레이아웃 ───
  gridTemplateColumns?: string; // "1fr 1fr" | "repeat(3, 100px)"
  gridTemplateRows?: string;
  gridGap?: number | [number, number]; // [rowGap, columnGap]
  gridAutoFlow?: "row" | "column" | "dense";

  // ─── 공통 ───
  gap?: number;
  rowGap?: number;
  columnGap?: number;
  padding?: number | [number, number, number, number];
  margin?: number | [number, number, number, number];

  // ─── 자식 요소용 (flex/grid item) ───
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | "auto";
  alignSelf?:
    | "auto"
    | "flex-start"
    | "center"
    | "flex-end"
    | "stretch"
    | "start"
    | "end";
  justifySelf?: "auto" | "start" | "center" | "end" | "stretch" | "normal";
}

// CanvasKit overflow 구현 상태:
// overflow: 'hidden' → canvas.clipRect(containerRect, ClipOp.Intersect)  ← ✅ SkiaRenderer.ts:151에 구현 완료
// overflow: 'scroll' → canvas.clipRect() + ScrollBar 오버레이 렌더링     ← ⚠️ 미구현
// clipPath: border-radius가 있는 경우 → canvas.clipRRect()로 둥근 클리핑 ← ⚠️ clipRRect 미구현

/**
 * 그라디언트 (ColorPicker, Slider 등에서 사용)
 */
export interface GradientShape {
  type: "gradient";
  x: number;
  y: number;
  width: number | "auto";
  height: number | "auto";
  radius?: number | [number, number, number, number];
  gradient: {
    type: "linear" | "radial";
    angle?: number; // linear gradient 각도 (0-360)
    stops: Array<{
      offset: number; // 0-1
      color: ColorValue;
    }>;
  };
}

// GradientShape CanvasKit 구현 상태 (fills.ts):
//   gradient.type: 'linear' | 'radial' | 'angular' | 'mesh'
//     - linear: Shader.MakeLinearGradient()              ← ✅ fills.ts:38-45
//     - radial: Shader.MakeTwoPointConicalGradient()     ← ✅ fills.ts:51-61
//     - angular: Shader.MakeSweepGradient()              ← ✅ fills.ts:64-74
//     - mesh: Shader.MakeMeshGradient()                  ← ⚠️ 스텁만 (fills.ts:96-106, 공개 API 미지원)
//   gradient.tileMode?: 'clamp' | 'repeat' | 'mirror'
//     - 현재 Clamp만 사용 (repeat/mirror 미구현)
//   gradient.colorSpace?: 'sRGB' | 'lab' | 'oklch'
//     - ⚠️ 미구현 (향후 Skia SkColorSpace 지원 예정)
//   gradient.center?: { x: number; y: number }
//     - radial/angular의 중심점 (기본: width/2, height/2)

/**
 * 이미지
 */
export interface ImageShape {
  type: "image";
  x: number;
  y: number;
  width: number | "auto";
  height: number | "auto";
  src: string;
  fit?: "contain" | "cover" | "fill" | "none";
  radius?: number | [number, number, number, number];
}

/**
 * 선
 */
export interface LineShape {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: ColorValue;
  strokeWidth: number;
  strokeDasharray?: number[];
}

/**
 * 아이콘 (SVG 경로 기반)
 *
 * Lucide 등 아이콘 라이브러리의 SVG 경로 데이터를 사용하여
 * CanvasKit Path로 렌더링. 원본 viewBox는 24x24 기준.
 */
export interface IconFontShape {
  type: "icon_font";
  /** 아이콘 이름 (lucideIcons 레지스트리에서 조회) */
  iconName: string;
  /** 아이콘 라이브러리 (기본: 'lucide') */
  iconFontFamily?: string;
  /** 아이콘 중심 X 좌표 */
  x: number;
  /** 아이콘 중심 Y 좌표 */
  y: number;
  /** 렌더링 크기 (px, 기본: 16) */
  fontSize?: number;
  /** 선 두께 (기본: 2) — Lucide 기본 strokeWidth */
  strokeWidth?: number;
  /** 채우기 색상 (stroke 색상으로 사용) */
  fill?: ColorValue;
}

/**
 * 색상 값 (토큰 참조 또는 직접 값)
 */
export type ColorValue = TokenRef | string | number;
```

#### 3.3.3 토큰 타입

```typescript
// packages/specs/src/types/token.types.ts

/**
 * 토큰 참조 문자열
 * 예: '{color.primary}', '{spacing.md}', '{radius.lg}'
 */
export type TokenRef = `{${string}}`;

/**
 * 타입 안전한 토큰 참조 (권장)
 * 컴파일 타임에 유효한 토큰만 허용
 */
export type ColorTokenRef = `{color.${keyof ColorTokens}}`;
export type SpacingTokenRef = `{spacing.${keyof SpacingTokens}}`;
export type TypographyTokenRef = `{typography.${keyof TypographyTokens}}`;
export type RadiusTokenRef = `{radius.${keyof RadiusTokens}}`;
export type ShadowTokenRef = `{shadow.${keyof ShadowTokens}}`;

/**
 * 모든 유효한 토큰 참조 유니온
 */
export type StrictTokenRef =
  | ColorTokenRef
  | SpacingTokenRef
  | TypographyTokenRef
  | RadiusTokenRef
  | ShadowTokenRef;

/**
 * 토큰 참조 유효성 검사 유틸리티
 */
export function isValidTokenRef(ref: string): ref is TokenRef {
  const pattern =
    /^\{(color|spacing|typography|radius|shadow)\.[a-zA-Z0-9-]+\}$/;
  return pattern.test(ref);
}

/**
 * 토큰 카테고리
 */
export interface TokenCategories {
  color: ColorTokens;
  spacing: SpacingTokens;
  typography: TypographyTokens;
  radius: RadiusTokens;
  shadow: ShadowTokens;
}

/**
 * 색상 토큰
 */
export interface ColorTokens {
  // Primary
  primary: string;
  "primary-hover": string;
  "primary-pressed": string;
  "on-primary": string;

  // Secondary
  secondary: string;
  "secondary-hover": string;
  "secondary-pressed": string;
  "on-secondary": string;

  // Tertiary
  tertiary: string;
  "tertiary-hover": string;
  "tertiary-pressed": string;
  "on-tertiary": string;

  // Error
  error: string;
  "error-hover": string;
  "error-pressed": string;
  "on-error": string;

  // Surface
  surface: string;
  "surface-container": string;
  "surface-container-high": string;
  "surface-container-highest": string;
  "on-surface": string;

  // Outline
  outline: string;
  "outline-variant": string;
}

/**
 * 간격 토큰
 */
export interface SpacingTokens {
  xs: number; // 4
  sm: number; // 8
  md: number; // 16
  lg: number; // 24
  xl: number; // 32
  "2xl": number; // 48
}

/**
 * 타이포그래피 토큰
 */
export interface TypographyTokens {
  "text-xs": number; // 12
  "text-sm": number; // 14
  "text-md": number; // 16
  "text-lg": number; // 18
  "text-xl": number; // 20
  "text-2xl": number; // 24
}

/**
 * 둥근 모서리 토큰
 */
export interface RadiusTokens {
  none: number; // 0
  sm: number; // 4
  md: number; // 6
  lg: number; // 8
  xl: number; // 12
  full: number; // 9999
}

/**
 * 그림자 토큰
 */
export interface ShadowTokens {
  /** 그림자 없음 */
  none: string;

  /** 작은 그림자 (elevation 1) */
  sm: string;

  /** 중간 그림자 (elevation 2) */
  md: string;

  /** 큰 그림자 (elevation 3) */
  lg: string;

  /** 매우 큰 그림자 (elevation 4) */
  xl: string;

  /** 내부 그림자 (inset) */
  inset: string;

  /** 포커스 링 */
  "focus-ring": string;
}
```

### 3.4 Primitive 토큰 정의

```typescript
// packages/specs/src/primitives/colors.ts

import type { ColorTokens } from "../types/token.types";

/**
 * Light 모드 색상 토큰
 * Material Design 3 기반
 */
export const lightColors: ColorTokens = {
  // Primary (Purple)
  primary: "#6750a4",
  "primary-hover": "#5c4799",
  "primary-pressed": "#523e8e",
  "on-primary": "#ffffff",

  // Secondary
  secondary: "#625b71",
  "secondary-hover": "#584f66",
  "secondary-pressed": "#4e455c",
  "on-secondary": "#ffffff",

  // Tertiary
  tertiary: "#7d5260",
  "tertiary-hover": "#714956",
  "tertiary-pressed": "#65404c",
  "on-tertiary": "#ffffff",

  // Error
  error: "#b3261e",
  "error-hover": "#a1221b",
  "error-pressed": "#8f1e18",
  "on-error": "#ffffff",

  // Surface
  surface: "#fef7ff",
  "surface-container": "#f3edf7",
  "surface-container-high": "#ece6f0",
  "surface-container-highest": "#e6e0e9",
  "on-surface": "#1d1b20",

  // Outline
  outline: "#79747e",
  "outline-variant": "#cac4d0",
};

/**
 * Dark 모드 색상 토큰
 */
export const darkColors: ColorTokens = {
  // Primary
  primary: "#d0bcff",
  "primary-hover": "#c4aff7",
  "primary-pressed": "#b8a2ef",
  "on-primary": "#381e72",

  // Secondary
  secondary: "#ccc2dc",
  "secondary-hover": "#c0b5d0",
  "secondary-pressed": "#b4a8c4",
  "on-secondary": "#332d41",

  // Tertiary
  tertiary: "#efb8c8",
  "tertiary-hover": "#e3acbc",
  "tertiary-pressed": "#d7a0b0",
  "on-tertiary": "#492532",

  // Error
  error: "#f2b8b5",
  "error-hover": "#e6acab",
  "error-pressed": "#daa0a1",
  "on-error": "#601410",

  // Surface
  surface: "#141218",
  "surface-container": "#211f26",
  "surface-container-high": "#2b2930",
  "surface-container-highest": "#36343b",
  "on-surface": "#e6e0e9",

  // Outline
  outline: "#938f99",
  "outline-variant": "#49454f",
};

/**
 * 현재 테마에 따른 색상 반환
 */
export function getColorToken(
  name: keyof ColorTokens,
  theme: "light" | "dark" = "light",
): string {
  return theme === "dark" ? darkColors[name] : lightColors[name];
}
```

```typescript
// packages/specs/src/primitives/spacing.ts

import type { SpacingTokens } from "../types/token.types";

export const spacing: SpacingTokens = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
};

export function getSpacingToken(name: keyof SpacingTokens): number {
  return spacing[name];
}
```

```typescript
// packages/specs/src/primitives/typography.ts

import type { TypographyTokens } from "../types/token.types";

export const typography: TypographyTokens = {
  "text-xs": 12,
  "text-sm": 14,
  "text-md": 16,
  "text-lg": 18,
  "text-xl": 20,
  "text-2xl": 24,
};

export const fontFamily = {
  sans: "Pretendard, Inter, system-ui, -apple-system, sans-serif",
  mono: "JetBrains Mono, Consolas, monospace",
};

/**
 * 폰트 두께
 */
export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

/**
 * 줄 높이 (배수)
 */
export const lineHeight = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75,
};

export function getTypographyToken(name: keyof TypographyTokens): number {
  return typography[name];
}
```

```typescript
// packages/specs/src/primitives/radius.ts

import type { RadiusTokens } from "../types/token.types";

/**
 * CSS 변수 기준:
 * --radius-sm: 0.25rem = 4px
 * --radius-md: 0.375rem = 6px
 * --radius-lg: 0.5rem = 8px
 * --radius-xl: 0.75rem = 12px
 */
export const radius: RadiusTokens = {
  none: 0,
  sm: 4, // 0.25rem
  md: 6, // 0.375rem
  lg: 8, // 0.5rem
  xl: 12, // 0.75rem
  full: 9999,
};

export function getRadiusToken(name: keyof RadiusTokens): number {
  return radius[name];
}
```

```typescript
// packages/specs/src/primitives/shadows.ts

import type { ShadowTokens } from "../types/token.types";

/**
 * 그림자 토큰
 * CSS box-shadow 형식 (Tailwind-style)
 */
export const shadows: ShadowTokens = {
  /** 그림자 없음 */
  none: "none",

  /** 작은 그림자 (elevation 1) */
  sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",

  /** 중간 그림자 (elevation 2) */
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",

  /** 큰 그림자 (elevation 3) */
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",

  /** 매우 큰 그림자 (elevation 4) */
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",

  /** 내부 그림자 (inset) */
  inset: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)",

  /** 포커스 링 */
  "focus-ring": "0 0 0 2px var(--primary, #6750a4)",
};

export function getShadowToken(name: keyof ShadowTokens): string {
  return shadows[name];
}

/**
 * CSS box-shadow 문자열을 파싱하여 PIXI에서 사용할 수 있는 형태로 변환
 */
export interface ParsedShadow {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  alpha: number;
  inset: boolean;
}

export function parseShadow(shadow: string): ParsedShadow[] {
  if (shadow === "none") return [];
  // rgba 괄호 안의 쉼표는 무시하고 분리
  const parts = shadow.split(/,(?![^(]*\))/);
  // 각 part에서 inset, 색상, 숫자값 파싱 → ParsedShadow 반환
  // ...
}
```

### 3.5 렌더러 구현

#### 3.5.1 Token Resolver

```typescript
// packages/specs/src/renderers/utils/tokenResolver.ts

import type { TokenRef, ColorValue } from "../../types";
import { lightColors, darkColors } from "../../primitives/colors";
import { spacing } from "../../primitives/spacing";
import { typography } from "../../primitives/typography";
import { radius } from "../../primitives/radius";
import { shadows } from "../../primitives/shadows";

/**
 * 토큰 참조를 실제 값으로 변환
 */
export function resolveToken(
  ref: TokenRef,
  theme: "light" | "dark" = "light",
): string | number {
  // '{color.primary}' → 'primary'
  const match = ref.match(/^\{(\w+)\.(.+)\}$/);
  if (!match) {
    console.warn(`Invalid token reference: ${ref}`);
    return ref;
  }

  const [, category, name] = match;

  switch (category) {
    case "color":
      return theme === "dark"
        ? darkColors[name as keyof typeof darkColors]
        : lightColors[name as keyof typeof lightColors];
    case "spacing":
      return spacing[name as keyof typeof spacing];
    case "typography":
      return typography[name as keyof typeof typography];
    case "radius":
      return radius[name as keyof typeof radius];
    case "shadow":
      return shadows[name as keyof typeof shadows];
    default:
      console.warn(`Unknown token category: ${category}`);
      return ref;
  }
}

/**
 * ColorValue를 실제 색상으로 변환
 */
export function resolveColor(
  value: ColorValue,
  theme: "light" | "dark" = "light",
): string | number {
  if (typeof value === "string" && value.startsWith("{")) {
    return resolveToken(value as TokenRef, theme);
  }
  return value;
}

/**
 * CSS 변수명으로 변환
 */
export function tokenToCSSVar(ref: TokenRef): string {
  // '{color.primary}' → 'var(--primary)'
  // '{color.on-primary}' → 'var(--on-primary)'
  const match = ref.match(/^\{(\w+)\.(.+)\}$/);
  if (!match) return ref;

  const [, category, name] = match;

  switch (category) {
    case "color":
      return `var(--${name})`;
    case "spacing":
      return `var(--spacing-${name})`;
    case "typography":
      return `var(--${name})`;
    case "radius":
      return `var(--radius-${name})`;
    case "shadow":
      return `var(--shadow-${name})`;
    default:
      return `var(--${name})`;
  }
}
```

#### 3.5.2 React Renderer

```typescript
// packages/specs/src/renderers/ReactRenderer.ts

import type { ComponentSpec, Shape, VariantSpec, SizeSpec } from "../types";
import { tokenToCSSVar } from "./utils/tokenResolver";

export interface ReactRenderResult {
  /** CSS 클래스명 */
  className: string;
  /** data-* 속성 */
  dataAttributes: Record<string, string>;
  /** 인라인 스타일 (Shape에서 계산된 동적 스타일) */
  style?: React.CSSProperties;
}

/**
 * ComponentSpec을 React Props로 변환
 */
export function renderToReact<Props extends Record<string, unknown>>(
  spec: ComponentSpec<Props>,
  props: Props,
): ReactRenderResult {
  const variant = (props.variant as string) || spec.defaultVariant;
  const size = (props.size as string) || spec.defaultSize;

  const variantSpec = spec.variants[variant];
  const sizeSpec = spec.sizes[size];

  if (!variantSpec || !sizeSpec) {
    console.warn(`Invalid variant/size: ${variant}/${size}`);
  }

  // 기본 data 속성
  const dataAttributes: Record<string, string> = {
    "data-variant": variant,
    "data-size": size,
  };

  // 컴포넌트별 추가 속성
  if (spec.render.react) {
    const customAttrs = spec.render.react(props);
    Object.entries(customAttrs).forEach(([key, value]) => {
      if (key.startsWith("data-") && value !== undefined) {
        dataAttributes[key] = String(value);
      }
    });
  }

  // 동적 스타일 계산 (inline style override용)
  const style = calculateDynamicStyle(spec, props, variantSpec, sizeSpec);

  return {
    className: `react-aria-${spec.name}`,
    dataAttributes,
    style,
  };
}

/**
 * Shapes에서 동적 스타일 계산
 * inline style prop으로 오버라이드된 경우에만 사용
 */
function calculateDynamicStyle<Props>(
  spec: ComponentSpec<Props>,
  props: Props,
  variantSpec: VariantSpec,
  sizeSpec: SizeSpec,
): React.CSSProperties | undefined {
  const inlineStyle = (props as { style?: React.CSSProperties }).style;
  if (!inlineStyle) return undefined;

  // inline style이 있으면 그대로 반환 (CSS보다 우선)
  return inlineStyle;
}

/**
 * ComponentSpec에서 CSS 변수 스타일 생성
 */
export function generateCSSVariables(
  variantSpec: VariantSpec,
): Record<string, string> {
  return {
    "--spec-bg": tokenToCSSVar(variantSpec.background),
    "--spec-bg-hover": tokenToCSSVar(variantSpec.backgroundHover),
    "--spec-bg-pressed": tokenToCSSVar(variantSpec.backgroundPressed),
    "--spec-text": tokenToCSSVar(variantSpec.text),
    ...(variantSpec.border && {
      "--spec-border": tokenToCSSVar(variantSpec.border),
    }),
  };
}
```

#### 3.5.3 CanvasKit/Skia Renderer (Primary)

CanvasKit/Skia가 Builder Canvas의 **메인 시각적 렌더러**이다.
구현 위치: `apps/builder/src/builder/workspace/canvas/skia/`

**렌더링 역할 분담:**

| 기능               | 담당      | 구현 위치                                                     |
| ------------------ | --------- | ------------------------------------------------------------- |
| 도형 렌더링        | CanvasKit | `nodeRenderers.ts` → `renderBox()`                            |
| 텍스트 렌더링      | CanvasKit | `nodeRenderers.ts` → `renderText()` (ParagraphBuilder)        |
| 이미지 렌더링      | CanvasKit | `nodeRenderers.ts` → `renderImage()`                          |
| 그림자/블러/이펙트 | CanvasKit | `effects.ts` → saveLayer + ImageFilter                        |
| Fill (6종)         | CanvasKit | `fills.ts` → Color, Linear/Radial/Angular/MeshGradient, Image |
| 이벤트 히트 영역   | PixiJS    | EventBoundary (씬 그래프 전용)                                |
| 씬 그래프 순서     | PixiJS    | Container 트리 (시각적 렌더링 없음)                           |

**SkiaNodeData 구조 (nodeRenderers.ts):**

```typescript
// apps/builder/src/builder/workspace/canvas/skia/nodeRenderers.ts

interface SkiaNodeData {
  type: "box" | "text" | "image" | "container";
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  effects?: EffectStyle[];

  // type === 'box'
  box?: {
    fillColor: string;
    borderRadius: number;
    strokeColor?: string;
    strokeWidth?: number;
  };

  // type === 'text'
  text?: {
    content: string;
    fontFamilies: string[];
    fontSize: number;
    align: "left" | "center" | "right";
    lineHeight?: number;
    paddingLeft?: number;
    paddingTop?: number;
    maxWidth?: number;
  };

  // type === 'image'
  image?: {
    skImage: SkImage;
    contentX: number;
    contentY: number;
    contentWidth: number;
    contentHeight: number;
  };

  children?: SkiaNodeData[];
}
```

**renderNode() — 재귀적 노드 렌더링:**

```typescript
// apps/builder/src/builder/workspace/canvas/skia/nodeRenderers.ts

function renderNode(
  ck: CanvasKit,
  canvas: Canvas,
  node: SkiaNodeData,
  cullingBounds: CullingBounds,
): void {
  if (!node.visible || !intersectsAABB(cullingBounds, node)) return;

  // 이펙트 적용 (saveLayer 기반)
  const layerCount = beginRenderEffects(ck, canvas, node.effects);

  switch (node.type) {
    case "box":
      renderBox(ck, canvas, node);
      break;
    case "text":
      renderText(ck, canvas, node);
      break;
    case "image":
      renderImage(ck, canvas, node);
      break;
  }

  // 자식 노드 재귀 렌더링
  node.children?.forEach((child) =>
    renderNode(ck, canvas, child, cullingBounds),
  );

  // 이펙트 레이어 복원
  endRenderEffects(canvas, layerCount);
}
```

**색상 변환 (CanvasKit Color4f):**

```typescript
// CanvasKit은 ck.Color4f(r, g, b, a) 형식의 Float32Array 사용
function cssColorToSkiaColor(
  color: string,
  ck: CanvasKit,
  fallback?: Float32Array,
): Float32Array {
  if (!color || color === "transparent") {
    return fallback ?? ck.Color4f(0, 0, 0, 0);
  }
  const parsed = colord(color);
  if (!parsed.isValid()) return fallback ?? ck.Color4f(0, 0, 0, 1);
  const { r, g, b, a } = parsed.toRgb();
  return ck.Color4f(r / 255, g / 255, b / 255, a);
}
```

<details>
<summary>Phase 1-4 레거시: PixiRenderer (폐기 — 참조용)</summary>

> **⚠️ 폐기됨**: Phase 5 이후 PixiRenderer는 시각적 렌더링을 수행하지 않는다.
> 현재 PixiJS는 EventBoundary Hit Testing + Container 트리 관리 전용이다.
> 시각 렌더링은 CanvasKit/Skia가 담당한다 (§3.5.3.1 참조).

**핵심 인터페이스 (참조용):**

```typescript
// packages/specs/src/renderers/PixiRenderer.ts (폐기됨)

export interface PixiRenderContext {
  graphics: Graphics;
  theme: "light" | "dark";
  width: number;
  height: number;
  state?: ComponentState;
}

// Shape 타입별 렌더링 매핑 (폐기됨 → CanvasKit 대체):
// roundRect/rect → canvas.drawRRect() / canvas.drawRect()
// circle        → canvas.drawCircle()
// border        → paint.setStyle(ck.PaintStyle.Stroke)
// text          → canvas.drawParagraph()
// shadow        → ImageFilter.MakeDropShadow()
// container     → 재귀 렌더링 (CanvasKit 트리로 대체)
```

**색상 변환 함수 (현재 사용):**

```typescript
// CSS → CanvasKit: ck.Color4f(r/255, g/255, b/255, a) — Float32Array
// CSS → CanvasKit: ((alpha << 24) | (r << 16) | (g << 8) | b) >>> 0 — uint32
// 실제 구현: fills.ts, aiEffects.ts 등에서 인라인 호출
```

</details>

#### 3.5.3.1 CanvasKit/Skia 렌더링 상세

상세: `docs/RENDERING_ARCHITECTURE.md` Phase 5.3, 6.3 참조

**PixiJS → CanvasKit 역할 전환 (완료):**

| 기능             | Phase 1-4 (PixiRenderer)               | 현재 (CanvasKit/Skia)                        |
| ---------------- | -------------------------------------- | -------------------------------------------- |
| 도형 렌더링      | `graphics.rect()`, `graphics.circle()` | `renderBox()` → `canvas.drawRRect()`         |
| 텍스트 렌더링    | `new Text()` (별도 객체)               | `renderText()` → `canvas.drawParagraph()`    |
| 그림자/이펙트    | 별도 처리 (불완전)                     | `effects.ts` → `ImageFilter` + `saveLayer()` |
| 이벤트 히트 영역 | `EventBoundary`                        | 동일 (PixiJS 유지)                           |
| 씬 그래프 순서   | `Container` 트리                       | 동일 (PixiJS 유지)                           |

**Spec → CanvasKit 매핑 참조 (renderToSkia 설계 예시):**

> 실제 구현은 `apps/builder/src/builder/workspace/canvas/skia/nodeRenderers.ts`의
> `renderNode()` 함수가 담당한다 (위 3.5.3 참조).
> 아래는 Spec 패키지 내 렌더러 설계 참조 코드이다.

```typescript
// Spec → CanvasKit 매핑 참조 (실제 구현: apps/builder/src/builder/workspace/canvas/skia/nodeRenderers.ts)

import type { CanvasKit, Canvas, Paint } from "canvaskit-wasm";
import type { ComponentSpec, Shape } from "../types";

export interface SkiaRenderContext {
  ck: CanvasKit;
  canvas: Canvas;
  theme: Record<string, string>;
  width: number;
  height: number;
  state?: "default" | "hover" | "pressed" | "disabled";
}

/**
 * ComponentSpec의 Shapes를 CanvasKit Surface에 렌더링
 */
export function renderToSkia<Props extends Record<string, unknown>>(
  spec: ComponentSpec<Props>,
  props: Props,
  context: SkiaRenderContext,
): void {
  const { ck, canvas, theme, width, height, state = "default" } = context;

  const variant = (props.variant as string) || spec.defaultVariant;
  const size = (props.size as string) || spec.defaultSize;

  const variantSpec = spec.variants[variant];
  const sizeSpec = spec.sizes[size];

  if (!variantSpec || !sizeSpec) return;

  const shapes = spec.render.shapes(props, variantSpec, sizeSpec, state);

  // 각 Shape를 CanvasKit API로 렌더링
  shapes.forEach((shape) => {
    renderSkiaShape(ck, canvas, shape, theme, width, height);
  });
}

function renderSkiaShape(
  ck: CanvasKit,
  canvas: Canvas,
  shape: Shape,
  theme: Record<string, string>,
  width: number,
  height: number,
): void {
  switch (shape.type) {
    case "rect": {
      const paint = new ck.Paint();
      paint.setStyle(ck.PaintStyle.Fill);
      paint.setColor(cssColorToSkiaColor(shape.fill, ck));
      const rect = ck.LTRBRect(
        shape.x,
        shape.y,
        shape.x + resolveSize(shape.width, width),
        shape.y + resolveSize(shape.height, height),
      );
      canvas.drawRect(rect, paint);
      paint.delete();
      break;
    }
    case "roundRect": {
      const paint = new ck.Paint();
      paint.setStyle(ck.PaintStyle.Fill);
      paint.setColor(cssColorToSkiaColor(shape.fill, ck));
      // per-corner radius: number → 균일, [tl,tr,br,bl] → 개별
      const r =
        typeof shape.radius === "number"
          ? shape.radius
          : (shape.radius?.[0] ?? 0);
      // TODO: per-corner radius 시 rrect 12-float 배열 사용
      const rrect = ck.RRectXY(
        ck.LTRBRect(
          shape.x,
          shape.y,
          shape.x + resolveSize(shape.width, width),
          shape.y + resolveSize(shape.height, height),
        ),
        r,
        r,
      );
      canvas.drawRRect(rrect, paint);
      paint.delete();
      break;
    }
    case "text": {
      const paraStyle = new ck.ParagraphStyle({
        textAlign: ck.TextAlign.Center,
      });
      const builder = ck.ParagraphBuilder.Make(paraStyle, fontMgr);
      builder.pushStyle(
        new ck.TextStyle({
          color: cssColorToSkiaColor(shape.fill, ck),
          fontSize: shape.fontSize,
          fontFamilies: [shape.fontFamily || "sans-serif"],
        }),
      );
      builder.addText(shape.text);
      const para = builder.build();
      para.layout(resolveSize(shape.maxWidth ?? width, width));
      canvas.drawParagraph(para, shape.x, shape.y);
      para.delete();
      break;
    }
    case "shadow": {
      const filter = ck.ImageFilter.MakeDropShadow(
        shape.offsetX,
        shape.offsetY,
        shape.blur / 2,
        shape.blur / 2,
        cssColorToSkiaColor(shape.color, ck),
      );
      // saveLayer로 shadow 적용
      const layerPaint = new ck.Paint();
      layerPaint.setImageFilter(filter);
      canvas.saveLayer(layerPaint);
      // ... target shape 렌더링
      canvas.restore();
      layerPaint.delete();
      break;
    }
  }
}
```

#### 3.5.4 CSS Generator

```typescript
// packages/specs/src/renderers/CSSGenerator.ts

import type { ComponentSpec, VariantSpec, SizeSpec } from "../types";
import { tokenToCSSVar } from "./utils/tokenResolver";

/**
 * ComponentSpec에서 CSS 파일 내용 생성
 */
export function generateCSS<Props>(spec: ComponentSpec<Props>): string {
  const lines: string[] = [];

  // 파일 헤더
  lines.push(`/* Generated from ${spec.name}.spec.ts */`);
  lines.push(`/* DO NOT EDIT MANUALLY */`);
  lines.push("");
  lines.push("@layer components {");

  // 기본 스타일
  lines.push(`  .react-aria-${spec.name} {`);
  lines.push(...generateBaseStyles(spec));
  lines.push("  }");
  lines.push("");

  // Variant 스타일
  Object.entries(spec.variants).forEach(([variantName, variantSpec]) => {
    lines.push(`  .react-aria-${spec.name}[data-variant="${variantName}"] {`);
    lines.push(...generateVariantStyles(variantSpec));
    lines.push("");

    // hover 상태
    lines.push("    &[data-hovered] {");
    lines.push(
      `      background: ${tokenToCSSVar(variantSpec.backgroundHover)};`,
    );
    if (variantSpec.textHover) {
      lines.push(`      color: ${tokenToCSSVar(variantSpec.textHover)};`);
    }
    if (variantSpec.borderHover) {
      lines.push(
        `      border-color: ${tokenToCSSVar(variantSpec.borderHover)};`,
      );
    } else if (variantSpec.border) {
      lines.push(
        `      border-color: ${tokenToCSSVar(variantSpec.backgroundHover)};`,
      );
    }
    lines.push("    }");
    lines.push("");

    // pressed 상태
    lines.push("    &[data-pressed] {");
    lines.push(
      `      background: ${tokenToCSSVar(variantSpec.backgroundPressed)};`,
    );
    if (variantSpec.border) {
      lines.push(
        `      border-color: ${tokenToCSSVar(variantSpec.backgroundPressed)};`,
      );
    }
    lines.push("    }");
    lines.push("  }");
    lines.push("");
  });

  // Size 스타일
  Object.entries(spec.sizes).forEach(([sizeName, sizeSpec]) => {
    lines.push(`  .react-aria-${spec.name}[data-size="${sizeName}"] {`);
    lines.push(...generateSizeStyles(sizeSpec));
    lines.push("  }");
    lines.push("");
  });

  // 상태 스타일
  lines.push(...generateStateStyles(spec));

  lines.push("}");

  return lines.join("\n");
}

function generateBaseStyles<Props>(spec: ComponentSpec<Props>): string[] {
  const defaultVariant = spec.variants[spec.defaultVariant];
  const defaultSize = spec.sizes[spec.defaultSize];

  return [
    `    /* Base styles */`,
    `    display: inline-flex;`,
    `    align-items: center;`,
    `    justify-content: center;`,
    `    box-sizing: border-box;`,
    `    cursor: pointer;`,
    `    user-select: none;`,
    `    transition: background 0.15s ease, border-color 0.15s ease;`,
    `    font-family: var(--font-sans);`,
    ``,
    `    /* Default variant */`,
    `    background: ${tokenToCSSVar(defaultVariant.background)};`,
    `    color: ${tokenToCSSVar(defaultVariant.text)};`,
    defaultVariant.border
      ? `    border: 1px solid ${tokenToCSSVar(defaultVariant.border)};`
      : `    border: none;`,
    ``,
    `    /* Default size */`,
    `    height: ${defaultSize.height}px;`,
    `    padding: ${defaultSize.paddingY}px ${defaultSize.paddingX}px;`,
    `    font-size: ${tokenToCSSVar(defaultSize.fontSize)};`,
    `    border-radius: ${tokenToCSSVar(defaultSize.borderRadius)};`,
  ];
}

function generateVariantStyles(variant: VariantSpec): string[] {
  const lines = [
    `    background: ${tokenToCSSVar(variant.background)};`,
    `    color: ${tokenToCSSVar(variant.text)};`,
  ];

  if (variant.border) {
    lines.push(`    border-color: ${tokenToCSSVar(variant.border)};`);
  }

  if (variant.backgroundAlpha !== undefined && variant.backgroundAlpha < 1) {
    lines.push(`    background: transparent;`);
  }

  return lines;
}

function generateSizeStyles(size: SizeSpec): string[] {
  return [
    `    height: ${size.height}px;`,
    `    padding: ${size.paddingY}px ${size.paddingX}px;`,
    `    font-size: ${tokenToCSSVar(size.fontSize)};`,
    `    border-radius: ${tokenToCSSVar(size.borderRadius)};`,
    ...(size.gap ? [`    gap: ${size.gap}px;`] : []),
  ];
}

/**
 * boxShadow 값 해석 (토큰 또는 CSS 문자열)
 *
 * ShadowTokenRef는 `{shadow.${keyof ShadowTokens}}` 형식의 문자열 리터럴 타입이므로
 * 모든 값이 문자열로 처리됩니다.
 */
function resolveBoxShadow(
  value: string | ShadowTokenRef | undefined,
): string | undefined {
  if (!value) return undefined;

  // ShadowTokenRef도 문자열 리터럴 타입이므로 동일하게 처리
  // 토큰 참조 형식 {shadow.md}, {shadow.lg} 등
  if (value.startsWith("{shadow.")) {
    const name = value.slice(8, -1); // "md", "lg" 등
    return `var(--shadow-${name})`;
  }

  // 일반 CSS box-shadow 문자열
  return value;
}

function generateStateStyles<Props>(spec: ComponentSpec<Props>): string[] {
  const lines: string[] = [];
  const states = spec.states;

  // hover 상태 효과 (색상은 variant에서 처리, 여기선 효과만)
  if (states?.hover) {
    lines.push(`  .react-aria-${spec.name}[data-hovered] {`);
    if (states.hover.boxShadow) {
      lines.push(
        `    box-shadow: ${resolveBoxShadow(states.hover.boxShadow)};`,
      );
    }
    if (states.hover.transform) {
      lines.push(`    transform: ${states.hover.transform};`);
    }
    if (states.hover.scale !== undefined) {
      lines.push(`    transform: scale(${states.hover.scale});`);
    }
    if (states.hover.opacity !== undefined) {
      lines.push(`    opacity: ${states.hover.opacity};`);
    }
    lines.push(`  }`);
    lines.push(``);
  }

  // focused 상태 효과
  if (states?.focused) {
    lines.push(`  .react-aria-${spec.name}[data-focused] {`);
    if (states.focused.outline) {
      lines.push(`    outline: ${states.focused.outline};`);
    }
    if (states.focused.outlineOffset) {
      lines.push(`    outline-offset: ${states.focused.outlineOffset};`);
    }
    if (states.focused.boxShadow) {
      lines.push(
        `    box-shadow: ${resolveBoxShadow(states.focused.boxShadow)};`,
      );
    }
    if (states.focused.transform) {
      lines.push(`    transform: ${states.focused.transform};`);
    }
    lines.push(`  }`);
    lines.push(``);
  }

  // focusVisible 상태 (키보드 포커스 - 기본값 제공)
  lines.push(`  .react-aria-${spec.name}[data-focus-visible] {`);
  if (states?.focusVisible) {
    if (states.focusVisible.outline) {
      lines.push(`    outline: ${states.focusVisible.outline};`);
    } else {
      lines.push(`    outline: 2px solid var(--primary);`);
    }
    if (states.focusVisible.outlineOffset) {
      lines.push(`    outline-offset: ${states.focusVisible.outlineOffset};`);
    } else {
      lines.push(`    outline-offset: 2px;`);
    }
    if (states.focusVisible.boxShadow) {
      lines.push(
        `    box-shadow: ${resolveBoxShadow(states.focusVisible.boxShadow)};`,
      );
    }
  } else {
    lines.push(`    outline: 2px solid var(--primary);`);
    lines.push(`    outline-offset: 2px;`);
  }
  lines.push(`  }`);
  lines.push(``);

  // pressed 상태 효과 (색상 외의 효과)
  if (states?.pressed) {
    lines.push(`  .react-aria-${spec.name}[data-pressed] {`);
    if (states.pressed.boxShadow) {
      lines.push(
        `    box-shadow: ${resolveBoxShadow(states.pressed.boxShadow)};`,
      );
    }
    if (states.pressed.transform) {
      lines.push(`    transform: ${states.pressed.transform};`);
    }
    if (states.pressed.scale !== undefined) {
      lines.push(`    transform: scale(${states.pressed.scale});`);
    }
    lines.push(`  }`);
    lines.push(``);
  }

  // disabled 상태
  lines.push(`  .react-aria-${spec.name}[data-disabled] {`);
  if (states?.disabled) {
    lines.push(`    opacity: ${states.disabled.opacity ?? 0.38};`);
    lines.push(`    cursor: ${states.disabled.cursor ?? "not-allowed"};`);
    if (states.disabled.pointerEvents) {
      lines.push(`    pointer-events: ${states.disabled.pointerEvents};`);
    } else {
      lines.push(`    pointer-events: none;`);
    }
  } else {
    lines.push(`    opacity: 0.38;`);
    lines.push(`    cursor: not-allowed;`);
    lines.push(`    pointer-events: none;`);
  }
  lines.push(`  }`);

  return lines;
}

/**
 * 모든 스펙에서 CSS 파일 생성
 */
export async function generateAllCSS(
  specs: ComponentSpec[],
  outputDir: string,
): Promise<void> {
  const fs = await import("fs/promises");
  const path = await import("path");

  for (const spec of specs) {
    const css = generateCSS(spec);
    const filePath = path.join(outputDir, `${spec.name}.css`);
    await fs.writeFile(filePath, css, "utf-8");
    console.log(`Generated: ${filePath}`);
  }
}
```

> **참고:** CSS Generator는 **React 렌더링 및 Publish(배포) 전용**이다.
> Builder Canvas의 시각적 렌더링은 CanvasKit/Skia가 담당하며,
> CSS Generator가 생성한 CSS는 Canvas 렌더링에 사용되지 않는다.
> Canvas에서는 ComponentSpec의 Shapes를 직접 CanvasKit Paint/Path로 변환한다.

### 3.6 Phase 0 산출물

| 산출물               | 파일                                                              | 설명                                                   |
| -------------------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| 타입 시스템          | `specs/src/types/*.ts`                                            | ComponentSpec, Shape, Token 타입                       |
| Primitive 토큰       | `specs/src/primitives/*.ts`                                       | 색상, 간격, 타이포그래피, 둥근모서리                   |
| React 렌더러         | `specs/src/renderers/ReactRenderer.ts`                            | Spec → React Props                                     |
| PixiJS 렌더러        | `specs/src/renderers/PixiRenderer.ts`                             | Spec → 씬 그래프 이벤트 전용 (시각적 렌더링 없음)      |
| **CanvasKit 렌더러** | `apps/builder/src/builder/workspace/canvas/skia/nodeRenderers.ts` | **Spec → CanvasKit/Skia Surface (메인 시각적 렌더러)** |
| CSS 생성기           | `specs/src/renderers/CSSGenerator.ts`                             | Spec → CSS 파일 (React/Publish 전용)                   |
| 빌드 스크립트        | `specs/scripts/*.ts`                                              | CSS 생성, 검증                                         |

### 3.7 Phase 0 체크리스트

- [x] `packages/specs` 패키지 생성
- [x] `package.json`, `tsconfig.json` 설정
- [x] 타입 시스템 구현 (`types/*.ts`)
- [x] Primitive 토큰 정의 (`primitives/*.ts`)
- [x] Token Resolver 구현
- [x] React Renderer 구현
- [x] PixiJS Renderer 구현 (씬 그래프 이벤트 전용)
- [x] CSS Generator 구현
- [x] 빌드 스크립트 작성
- [x] 단위 테스트 작성 (`packages/specs/__tests__`, `packages/specs/vitest.config.ts`)
- [x] CanvasKit WASM 초기화 설정 (`initCanvasKit.ts`)
- [x] CanvasKitRenderer 구현 (`apps/builder/src/builder/workspace/canvas/skia/nodeRenderers.ts`)
- [x] CanvasKit 폰트 로더 구현 (`fontManager.ts`)
- [x] SkiaOverlay 구현 + PixiJS 이벤트 유지 (`SkiaOverlay.tsx`, EventBoundary 기반)
- [x] Fill 시스템 구현 — 6종 (`fills.ts`)
- [x] Effect 파이프라인 구현 (`effects.ts`)
- [x] Dual Surface + 2-pass 최적화 (컨텐츠 캐시 + present blit + 오버레이 분리) (`SkiaRenderer.ts`)

### 3.8 Phase 0 → Phase 1 검증 게이트

**Phase 1 시작 전 반드시 통과해야 하는 검증 항목:**

#### 3.8.1 필수 통과 조건 (Blocking)

| #   | 검증 항목               | 기준                       | 검증 방법            |
| --- | ----------------------- | -------------------------- | -------------------- |
| 1   | 타입 시스템 완전성      | 모든 타입 export           | `tsc --noEmit` 성공  |
| 2   | 토큰 일관성             | CSS 변수와 1:1 매핑        | 자동화 검증 스크립트 |
| 3   | React Renderer 동작     | Button Props 변환          | 단위 테스트 100%     |
| 4   | CanvasKit Renderer 동작 | Button renderNode() 렌더링 | 단위 테스트 100%     |
| 5   | CSS Generator 동작      | Button.css 자동 생성       | diff 검증            |
| 6   | 빌드 성공               | pnpm build 성공            | CI 파이프라인        |

#### 3.8.2 품질 게이트 (Quality Gates)

```typescript
// scripts/validate-phase0.ts

interface Phase0ValidationResult {
  passed: boolean;
  blockers: string[];
  warnings: string[];
}

async function validatePhase0(): Promise<Phase0ValidationResult> {
  const result: Phase0ValidationResult = {
    passed: true,
    blockers: [],
    warnings: [],
  };

  // 1. 타입 검사
  const tscResult = await runCommand("pnpm tsc --noEmit");
  if (!tscResult.success) {
    result.blockers.push("TypeScript 컴파일 실패");
    result.passed = false;
  }

  // 2. 토큰 검증 - CSS 변수와 매핑 확인
  const tokenValidation = await validateTokenMapping();
  if (!tokenValidation.allMapped) {
    result.blockers.push(`누락된 토큰: ${tokenValidation.missing.join(", ")}`);
    result.passed = false;
  }

  // 3. Renderer 테스트
  const testResult = await runCommand("pnpm vitest run --coverage");
  if (testResult.coverage < 80) {
    result.blockers.push(
      `테스트 커버리지 부족: ${testResult.coverage}% (최소 80%)`,
    );
    result.passed = false;
  }

  // 4. CSS 생성 검증
  const cssValidation = await validateGeneratedCSS();
  if (!cssValidation.valid) {
    result.blockers.push("생성된 CSS 검증 실패");
    result.passed = false;
  }

  // 5. 성능 벤치마크
  const perfResult = await runPerformanceBenchmark();
  if (perfResult.renderTime > 16) {
    // 60fps 기준
    result.warnings.push(
      `렌더링 성능 저하: ${perfResult.renderTime}ms (권장 <16ms)`,
    );
  }

  return result;
}

// 토큰 매핑 검증
async function validateTokenMapping(): Promise<{
  allMapped: boolean;
  missing: string[];
}> {
  const cssVariables = await extractCSSVariables(
    "packages/shared/src/styles/tokens.css",
  );
  const specTokens = await extractSpecTokens("packages/specs/src/primitives");

  const missing: string[] = [];

  for (const cssVar of cssVariables) {
    const tokenName = cssVarToTokenName(cssVar); // --primary → color.primary
    if (!specTokens.includes(tokenName)) {
      missing.push(tokenName);
    }
  }

  return { allMapped: missing.length === 0, missing };
}
```

#### 3.8.3 검증 자동화

```yaml
# .github/workflows/phase0-gate.yml
name: Phase 0 Validation Gate

on:
  pull_request:
    paths:
      - "packages/specs/**"

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2

      - name: Install dependencies
        run: pnpm install

      - name: Type Check
        run: pnpm --filter @composition/specs tsc --noEmit

      - name: Unit Tests
        run: pnpm --filter @composition/specs test:coverage
        env:
          MIN_COVERAGE: 80

      - name: Token Validation
        run: pnpm --filter @composition/specs validate:tokens

      - name: CSS Generation Test
        run: pnpm --filter @composition/specs generate:css --dry-run

      - name: Phase 0 Gate Check
        run: pnpm --filter @composition/specs validate:phase0
```

#### 3.8.4 검증 리포트 템플릿

```markdown
## Phase 0 검증 리포트

**날짜**: YYYY-MM-DD
**검증자**: @username

### 필수 항목 (Blockers)

| 항목                  | 상태    | 비고        |
| --------------------- | ------- | ----------- |
| TypeScript 컴파일     | ✅ / ❌ |             |
| 토큰 매핑 완전성      | ✅ / ❌ | 누락:       |
| React Renderer 테스트 | ✅ / ❌ | Coverage: % |
| PIXI Renderer 테스트  | ✅ / ❌ | Coverage: % |
| CSS Generator 검증    | ✅ / ❌ |             |
| 빌드 성공             | ✅ / ❌ |             |

### 품질 항목 (Warnings)

| 항목            | 값  | 권장  | 상태 |
| --------------- | --- | ----- | ---- |
| 테스트 커버리지 | %   | ≥80%  |      |
| 렌더링 시간     | ms  | <16ms |      |
| 번들 크기 증가  | KB  | <50KB |      |

### 결론

- [ ] **Phase 1 진행 승인**
- [ ] **수정 후 재검증 필요**

### 서명

- 기술 리드: **\*\***\_\_\_**\*\***
- QA 담당: **\*\***\_\_\_**\*\***
```

---

## 4. Phase 1: 핵심 컴포넌트 마이그레이션

### 4.1 목표

- 가장 많이 사용되는 10개 컴포넌트 마이그레이션
- Spec 패턴 검증 및 안정화

### 4.2 대상 컴포넌트 (10개)

| #   | 컴포넌트          | 현재 상태 | 복잡도 | 우선순위 |
| --- | ----------------- | --------- | ------ | -------- |
| 1   | Button            | ✅ 정상   | 중간   | 최우선   |
| 2   | Badge             | ⚠️ 부분   | 낮음   | 높음     |
| 3   | Card              | ✅ 정상   | 중간   | 높음     |
| 4   | Link              | ✅ 정상   | 낮음   | 높음     |
| 5   | Separator         | ✅ 정상   | 낮음   | 중간     |
| 6   | ToggleButton      | ✅ 정상   | 중간   | 높음     |
| 7   | ToggleButtonGroup | ✅ 정상   | 높음   | 높음     |
| 8   | Tooltip           | ✅ 정상   | 중간   | 중간     |
| 9   | Popover           | ✅ 정상   | 중간   | 중간     |
| 10  | Dialog            | ✅ 정상   | 높음   | 중간     |

### 4.3 Button Spec 예시 (상세)

```typescript
// packages/specs/src/components/Button.spec.ts

import type { ComponentSpec, Shape, TokenRef } from "../types";

export interface ButtonProps {
  variant?:
    | "default"
    | "primary"
    | "secondary"
    | "tertiary"
    | "error"
    | "surface"
    | "outline"
    | "ghost";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  children?: string;
  text?: string;
  label?: string;
  isDisabled?: boolean;
  isLoading?: boolean;
  style?: Record<string, string | number | undefined>;
}

export const ButtonSpec: ComponentSpec<ButtonProps> = {
  name: "Button",
  description: "Material Design 3 기반 버튼 컴포넌트",
  element: "button",

  defaultVariant: "default",
  defaultSize: "sm",

  variants: {
    default: {
      background: "{color.surface-container-high}" as TokenRef,
      backgroundHover: "{color.surface-container-highest}" as TokenRef,
      backgroundPressed: "{color.surface-container-highest}" as TokenRef,
      text: "{color.on-surface}" as TokenRef,
      border: "{color.outline-variant}" as TokenRef,
    },
    primary: {
      background: "{color.primary}" as TokenRef,
      backgroundHover: "{color.primary-hover}" as TokenRef,
      backgroundPressed: "{color.primary-pressed}" as TokenRef,
      text: "{color.on-primary}" as TokenRef,
      border: "{color.primary}" as TokenRef,
      borderHover: "{color.primary-hover}" as TokenRef,
    },
    secondary: {
      background: "{color.secondary}" as TokenRef,
      backgroundHover: "{color.secondary-hover}" as TokenRef,
      backgroundPressed: "{color.secondary-pressed}" as TokenRef,
      text: "{color.on-secondary}" as TokenRef,
      border: "{color.secondary}" as TokenRef,
      borderHover: "{color.secondary-hover}" as TokenRef,
    },
    tertiary: {
      background: "{color.tertiary}" as TokenRef,
      backgroundHover: "{color.tertiary-hover}" as TokenRef,
      backgroundPressed: "{color.tertiary-pressed}" as TokenRef,
      text: "{color.on-tertiary}" as TokenRef,
      border: "{color.tertiary}" as TokenRef,
      borderHover: "{color.tertiary-hover}" as TokenRef,
    },
    error: {
      background: "{color.error}" as TokenRef,
      backgroundHover: "{color.error-hover}" as TokenRef,
      backgroundPressed: "{color.error-pressed}" as TokenRef,
      text: "{color.on-error}" as TokenRef,
      border: "{color.error}" as TokenRef,
      borderHover: "{color.error-hover}" as TokenRef,
    },
    surface: {
      background: "{color.surface-container-highest}" as TokenRef,
      backgroundHover: "{color.surface-container-highest}" as TokenRef,
      backgroundPressed: "{color.surface-container-highest}" as TokenRef,
      text: "{color.on-surface}" as TokenRef,
      border: "{color.outline-variant}" as TokenRef,
    },
    outline: {
      background: "{color.surface}" as TokenRef,
      backgroundHover: "{color.surface-container}" as TokenRef,
      backgroundPressed: "{color.surface-container-high}" as TokenRef,
      text: "{color.primary}" as TokenRef,
      border: "{color.outline}" as TokenRef,
      backgroundAlpha: 0,
    },
    ghost: {
      background: "{color.surface}" as TokenRef,
      backgroundHover: "{color.surface-container}" as TokenRef,
      backgroundPressed: "{color.surface-container-high}" as TokenRef,
      text: "{color.primary}" as TokenRef,
      backgroundAlpha: 0,
    },
  },

  sizes: {
    xs: {
      height: 24,
      paddingX: 8,
      paddingY: 2,
      fontSize: "{typography.text-xs}" as TokenRef,
      borderRadius: "{radius.sm}" as TokenRef,
      iconSize: 12,
      gap: 4,
    },
    sm: {
      height: 32,
      paddingX: 12,
      paddingY: 4,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.sm}" as TokenRef,
      iconSize: 14,
      gap: 6,
    },
    md: {
      height: 40,
      paddingX: 24,
      paddingY: 8,
      fontSize: "{typography.text-md}" as TokenRef,
      borderRadius: "{radius.md}" as TokenRef,
      iconSize: 16,
      gap: 8,
    },
    lg: {
      height: 48,
      paddingX: 32,
      paddingY: 12,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.lg}" as TokenRef,
      iconSize: 20,
      gap: 10,
    },
    xl: {
      height: 56,
      paddingX: 40,
      paddingY: 16,
      fontSize: "{typography.text-xl}" as TokenRef,
      borderRadius: "{radius.lg}" as TokenRef,
      iconSize: 24,
      gap: 12,
    },
  },

  states: {
    hover: {
      // variant별 hover는 variants에서 정의
    },
    pressed: {
      boxShadow: "inset 0 1px 2px rgba(0,0,0,0.1)",
    },
    disabled: {
      opacity: 0.38,
      cursor: "not-allowed",
      pointerEvents: "none",
    },
    focusVisible: {
      outline: "2px solid var(--primary)",
      outlineOffset: "2px",
    },
  },

  render: {
    shapes: (props, variant, size, state = "default") => {
      const width = (props.style?.width as number) || "auto";
      const height = size.height;
      const borderRadius = size.borderRadius;

      // 상태에 따른 배경색 선택
      const bgColor =
        state === "hover"
          ? variant.backgroundHover
          : state === "pressed"
            ? variant.backgroundPressed
            : variant.background;

      // 상태에 따른 텍스트색 선택
      const textColor =
        state === "hover" && variant.textHover
          ? variant.textHover
          : variant.text;

      // 상태에 따른 테두리색 선택
      const borderColor =
        state === "hover" && variant.borderHover
          ? variant.borderHover
          : variant.border;

      const shapes: Shape[] = [
        // 배경
        {
          id: "bg",
          type: "roundRect" as const,
          x: 0,
          y: 0,
          width,
          height,
          radius: borderRadius,
          fill: bgColor,
          fillAlpha: variant.backgroundAlpha ?? 1,
        },
      ];

      // 테두리 (있는 경우)
      if (borderColor) {
        shapes.push({
          type: "border" as const,
          target: "bg", // 배경 shape에 적용
          borderWidth: 1,
          color: borderColor,
          radius: borderRadius,
        });
      }

      // 텍스트
      const text = props.children || props.text || props.label;
      if (text) {
        shapes.push({
          type: "text" as const,
          x: 0,
          y: 0,
          text,
          fontSize: size.fontSize,
          fontFamily: fontFamily.sans,
          fontWeight: 500,
          fill: textColor,
          align: "center" as const,
          baseline: "middle" as const,
        });
      }

      return shapes;
    },

    react: (props) => ({
      "data-loading": props.isLoading || undefined,
      "aria-busy": props.isLoading || undefined,
    }),

    pixi: (props) => ({
      eventMode: "static",
      cursor: props.isDisabled ? "not-allowed" : "pointer",
    }),
  },
};
```

### 4.4 마이그레이션된 React 컴포넌트

```typescript
// packages/shared/src/components/Button.tsx (마이그레이션 후)

import { forwardRef } from 'react';
import { Button as RACButton, type ButtonProps as RACButtonProps } from 'react-aria-components';
import { ButtonSpec, type ButtonProps as SpecButtonProps } from '@composition/specs';
import { renderToReact } from '@composition/specs/renderers';
import { Skeleton } from './Skeleton';

export interface ButtonProps extends RACButtonProps, SpecButtonProps {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(props, ref) {
    const {
      isLoading,
      loadingLabel = 'Loading...',
      children,
      variant = 'default',
      size = 'sm',
      ...restProps
    } = props;

    // Spec에서 렌더링 정보 가져오기
    const { className, dataAttributes, style } = renderToReact(ButtonSpec, {
      variant,
      size,
      children: children as string,
      isDisabled: props.isDisabled,
      isLoading,
      style: props.style,
    });

    return (
      <RACButton
        ref={ref}
        {...restProps}
        {...dataAttributes}
        className={className}
        style={style}
        isDisabled={isLoading || props.isDisabled}
      >
        {isLoading ? (
          <>
            <Skeleton componentVariant="button" size={size} />
            <span className="sr-only">{loadingLabel}</span>
          </>
        ) : (
          children
        )}
      </RACButton>
    );
  }
);
```

### 4.5 CanvasKit/Skia 렌더링 패턴 (현재)

**Button 렌더링 흐름** (Skia 모드 하드코딩):

```
ElementSprite (spriteType='button')
├── PixiJS Container (씬 그래프 + 이벤트 전용)
│   └── FancyButton (EventBoundary Hit Testing)
└── useSkiaNode(elementId, skiaNodeData) → 글로벌 레지스트리 등록
    │
    ▼
SkiaOverlay.renderFrame()
└── buildSkiaTreeHierarchical(cameraContainer)  // PixiJS 씬 그래프 계층 순회
    └── getSkiaNode(elementId)                  // 레지스트리에서 SkiaNodeData 조회
        └── renderNode(ck, canvas, tree)        // CanvasKit으로 시각적 렌더링
            ├── renderBox()   → ck.drawRRect() / drawRect()
            └── renderText()  → ck.ParagraphBuilder → drawParagraph()

// 계층적 트리: 부모-자식 상대 좌표 (worldTransform 뺄셈으로 카메라 오프셋 상쇄)
// Root (0,0) → Body (relX, relY) → Button (부모 기준 relX, relY)
```

**skiaNodeData 구조 (Button 예시):**

```typescript
{
  type: 'box',
  box: { fillColor, borderRadius, strokeColor, strokeWidth },
  children: [{
    type: 'text',
    text: { content, fontSize, color, align: 'center', paddingTop, maxWidth }
  }]
}
```

**UI 컴포넌트 텍스트 추출** (`ElementSprite.tsx`):

```typescript
// 텍스트 추출 우선순위: children > text > label > value > placeholder > count
const textContent = String(
  props?.children ||
    props?.text ||
    props?.label ||
    props?.value ||
    props?.placeholder ||
    props?.count ||
    "",
);

// 컴포넌트 타입별 정렬: Button/Badge = center, Input/Checkbox = left
// Input 계열은 좌측 패딩(8px) 적용
// placeholder 텍스트는 연한 색상(gray-400) 사용
```

**variant별 텍스트 색상 매핑**:

| variant   | 텍스트 색상 | hex       |
| --------- | ----------- | --------- |
| default   | 진한 회색   | `#1d1b20` |
| primary   | 흰색        | `#ffffff` |
| secondary | 흰색        | `#ffffff` |
| surface   | 진한 회색   | `#1d1b20` |
| outline   | 보라        | `#6750a4` |
| ghost     | 보라        | `#6750a4` |

**variant별 배경 색상 매핑** (Skia 폴백 렌더링):

| variant   | 배경 색상                 | hex       | alpha |
| --------- | ------------------------- | --------- | ----- |
| default   | surface-container-high    | `#ece6f0` | 1     |
| primary   | primary                   | `#6750a4` | 1     |
| secondary | secondary                 | `#625b71` | 1     |
| tertiary  | tertiary                  | `#7d5260` | 1     |
| error     | error                     | `#b3261e` | 1     |
| surface   | surface-container-highest | `#e6e0e9` | 1     |
| outline   | surface (투명)            | `#fef7ff` | 0     |
| ghost     | surface (투명)            | `#fef7ff` | 0     |

**variant별 테두리 색상 매핑** (Skia 폴백 렌더링):

| variant   | 테두리 색상     | hex       | 비고        |
| --------- | --------------- | --------- | ----------- |
| default   | outline-variant | `#cac4d0` |             |
| primary   | primary         | `#6750a4` |             |
| secondary | secondary       | `#625b71` |             |
| tertiary  | tertiary        | `#7d5260` |             |
| error     | error           | `#b3261e` |             |
| surface   | outline-variant | `#cac4d0` |             |
| outline   | outline         | `#79747e` |             |
| ghost     | —               | —         | 테두리 없음 |

> **구현 참조**: `ElementSprite.tsx`의 `VARIANT_BG_COLORS`, `VARIANT_BG_ALPHA`, `VARIANT_BORDER_COLORS` 상수 테이블. outline/ghost variant는 배경 alpha=0으로 투명 처리되며, ghost는 테두리도 없음.

### 4.6 Phase 1 체크리스트

- [x] Button.spec.ts 작성 ✅
- [x] Button.tsx 마이그레이션 ✅
- [x] PixiButton.tsx 마이그레이션 ✅
- [ ] Badge.spec.ts 작성 및 마이그레이션
- [ ] Card.spec.ts 작성 및 마이그레이션
- [ ] Link.spec.ts 작성 및 마이그레이션
- [ ] Separator.spec.ts 작성 및 마이그레이션
- [ ] ToggleButton.spec.ts 작성 및 마이그레이션
- [ ] ToggleButtonGroup.spec.ts 작성 및 마이그레이션
- [ ] Tooltip.spec.ts 작성 및 마이그레이션
- [ ] Popover.spec.ts 작성 및 마이그레이션
- [ ] Dialog.spec.ts 작성 및 마이그레이션
- [ ] Visual Regression Test 작성

### 4.7 구현 진행 내역 (2026-01-27)

#### 4.7.1 packages/specs 패키지 생성

Spec 아키텍처의 핵심 패키지 구조 완성:

```
packages/specs/
├── src/
│   ├── types/           # 타입 정의
│   │   └── index.ts     # ComponentSpec, SizeSpec 등
│   ├── primitives/      # 기본 토큰
│   │   └── index.ts     # spacing, radius 등
│   ├── renderers/       # 렌더러 유틸리티
│   │   └── index.ts     # getSizePreset, resolveRadius 등
│   ├── components/      # 컴포넌트 스펙
│   │   └── Button.spec.ts
│   └── index.ts         # 통합 export
├── package.json
└── tsconfig.json
```

#### 4.7.2 ButtonSpec 구현

- **파일**: `packages/specs/src/components/Button.spec.ts`
- **구현 내용**:
  - 8개 variant 정의 (default, primary, secondary, tertiary, error, surface, outline, ghost)
  - 5개 size 정의 (xs, sm, md, lg, xl)
  - size별 borderRadius 매핑 (CSS 변수 기준)
  - `getSizePreset()` 함수로 렌더러에서 통합 조회

#### 4.7.3 PixiButton.tsx Feature Flag 마이그레이션

- **ENABLE_BUTTON_SPEC** 플래그로 점진적 전환
- 기존 cssVariableReader 방식과 새 Spec 방식 병행
- `getSizePreset(ButtonSpec, size, theme)`로 통합 스타일 조회

```typescript
// Feature Flag 기반 마이그레이션
if (ENABLE_BUTTON_SPEC) {
  const sizePreset = getSizePreset(ButtonSpec.sizes[size], theme);
  // Spec 기반 렌더링
} else {
  // 기존 cssVariableReader 방식
}
```

#### 4.7.4 CSS 단위 처리 규칙

> **관련 파일 정리:**
>
> - `layout/engines/cssValueParser.ts` — `resolveCSSSizeValue()`, `CSSValueContext` (CSS 단위 → px 변환)
> - `layout/engines/utils.ts` — `enrichWithIntrinsicSize()`, `parseBoxModel()`, `calculateContentHeight/Width()` (intrinsic 크기)
> - 레거시 `parseCSSSize()` (`sprites/styleConverter`) — 폐기됨, 위 함수로 대체

**CanvasKit/Skia 렌더링 (현재):** Taffy 레이아웃 엔진이 CSS 단위(%, vw, vh, rem, calc 등)를 **절대 px로 변환**한 결과를 CanvasKit이 받으므로, CanvasKit 렌더러에서는 CSS 단위 해석이 **불필요**하다. `skiaNodeData.width/height` 등 이미 계산된 숫자를 직접 사용한다.

| 항목               | Phase 1-4 (PixiJS)                         | 현재 (CanvasKit + Taffy WASM)                                               |
| ------------------ | ------------------------------------------ | --------------------------------------------------------------------------- |
| CSS 단위 해석      | 각 Pixi 컴포넌트에서 `parseCSSSize()` 필요 | **불필요** — 레이아웃 엔진이 px로 변환 완료                                 |
| viewport 크기 참조 | vw/vh → parentContentArea 기준 변환        | `resolveCSSSizeValue()`가 `CSSValueContext`로 처리, CanvasKit은 결과만 수신 |
| % 단위             | 부모 content area 수동 계산                | Taffy가 자동 계산                                                           |
| 입력 형식          | CSS 문자열 ("16px", "50%")                 | 숫자 (px 절대값)                                                            |

**CSS 단위 파서 (`cssValueParser.ts`):**

```typescript
import {
  resolveCSSSizeValue,
  CSSValueContext,
} from "../layout/engines/cssValueParser";

// 통합 CSS 크기 값 파서 — px, %, vh, vw, em, rem, calc(), clamp(), min(), max() 지원
function resolveCSSSizeValue(
  value: unknown,
  ctx: CSSValueContext = {},
  fallback?: number,
): number | undefined;

interface CSSValueContext {
  parentSize?: number; // em 참조
  containerSize?: number; // % 참조
  viewportWidth?: number; // vw 참조
  viewportHeight?: number; // vh 참조
  rootFontSize?: number; // rem 참조 (기본 16)
  variableScope?: CSSVariableScope; // CSS var() 참조
}
```

**단위별 해석 기준**:

| 단위          | resolveCSSSizeValue 해석            | 참조 컨텍스트     |
| ------------- | ----------------------------------- | ----------------- |
| `px`          | 절대 픽셀값                         | —                 |
| `%`           | `ctx.containerSize` 기준 비율       | 부모 content area |
| `vw`          | `ctx.viewportWidth` 기준 비율       | 캔버스 너비       |
| `vh`          | `ctx.viewportHeight` 기준 비율      | 캔버스 높이       |
| `rem`         | `ctx.rootFontSize` × 계수 (기본 16) | 루트 폰트 크기    |
| `em`          | `ctx.parentSize` × 계수             | 부모 폰트 크기    |
| `calc()`      | 중첩 단위 해석 + 산술 연산          | 복합 컨텍스트     |
| `fit-content` | sentinel -2                         | 엔진 내부 처리    |
| `auto`        | undefined (엔진 자동 계산)          | —                 |

> **⚠️ 예외: 시각 전용 속성 (borderRadius, borderColor 등)**
>
> Taffy가 변환하는 것은 **레이아웃 속성**(width, height, padding, margin 등)뿐이다.
> `borderRadius`와 같은 **시각 전용 속성**은 레이아웃 엔진을 거치지 않으므로 `element.props.style`에
> CSS 문자열 형태(`"12px"`, `"8"`)로 남아 있다.
> `ElementSprite`의 Skia 폴백에서 이런 속성을 읽을 때는 반드시 `convertStyle()`의 반환값을
> 사용해야 한다.
>
> ```typescript
> // ❌ 금지: raw style 직접 typeof 체크 (CSS 문자열이면 항상 0)
> const br = typeof style.borderRadius === "number" ? style.borderRadius : 0;
>
> // ✅ 필수: convertStyle() 반환값 사용
> const { borderRadius: convertedBorderRadius } = convertStyle(style);
> const br =
>   typeof convertedBorderRadius === "number"
>     ? convertedBorderRadius
>     : (convertedBorderRadius?.[0] ?? 0);
> ```
>
> (2026-02-03 수정: ElementSprite에서 이 패턴 위반으로 borderRadius가 반영되지 않던 버그 수정)

<details>
<summary>Phase 1-4 레거시: Pixi UI 컴포넌트 CSS 단위 해석 규칙 (폐기됨)</summary>

> **⚠️ 폐기됨**: 아래 규칙은 Phase 1-4 PixiJS 컴포넌트에만 적용되었던 레거시 규칙이다.
> 현재는 Taffy 레이아웃 엔진이 CSS 단위를 자동 해석하며,
> `resolveCSSSizeValue()` + `CSSValueContext` (`layout/engines/cssValueParser.ts`)로 대체되었다.
>
> - `parseCSSSize()` → `resolveCSSSizeValue()`
> - `parsePadding()` / `parseBorderWidth()` → `parseBoxModel()`
> - 뷰포트/부모 content area 수동 계산 → 레이아웃 엔진 자동 처리

</details>

#### 4.7.4.0 `@composition/specs` 빌드 동기화 (CRITICAL)

`@composition/specs` 패키지는 **tsup으로 빌드된 `dist/`** 를 통해 내보냅니다.
`src/` 파일을 수정한 후 빌드하지 않으면, 소비자(`@composition/builder` 등)는
**이전 dist의 값을 계속 참조**합니다.

```
⚠️ 실제 발생한 버그 사례 (Button auto width 불일치):

1. Button.spec.ts (src) paddingX: 16 → 24 수정  ✅ 소스 변경
2. utils.ts (builder 내부) BUTTON_SIZE_CONFIG padding: 16 → 24  ✅ 즉시 반영
3. pnpm --filter @composition/specs build 미실행  ❌ dist 미갱신
4. PixiButton이 import하는 ButtonSpec은 dist/의 구 버전 (paddingX=16)
5. Layout 엔진은 새 padding(24) 적용, PixiButton은 구 padding(16) → 공백 발생

원인: dist/ 와 src/ 의 값 불일치 (layout=새값, rendering=구값)
```

**규칙**:

| 변경 대상                         | 필요 작업                                          |
| --------------------------------- | -------------------------------------------------- |
| `packages/specs/src/**` 파일 수정 | `pnpm --filter @composition/specs build` 실행 필수 |
| `apps/builder/src/**` 파일 수정   | 추가 빌드 불필요 (Vite HMR 즉시 반영)              |
| specs + builder 동시 수정         | specs 빌드 후 builder 개발 서버 재시작             |

**개발 시 권장**: `pnpm --filter @composition/specs dev` (watch 모드)를 별도 터미널에서 실행하면
소스 변경 시 자동으로 dist가 갱신됩니다.

```bash
# 터미널 1: specs watch 모드
pnpm --filter @composition/specs dev

# 터미널 2: builder 개발 서버
pnpm --filter @composition/builder dev
```

**새 컴포넌트 Spec 작성 시 체크리스트**:

1. ✅ `packages/specs/src/components/Xxx.spec.ts` 작성
2. ✅ `packages/specs/src/index.ts`에서 export 추가
3. ✅ `pnpm --filter @composition/specs build` 실행
4. ✅ builder에서 import 후 동작 확인
5. ✅ `BUTTON_SIZE_CONFIG` 등 builder 내부 상수와 Spec 값이 **동일한지** 확인

**값 동기화 대상** (`@sync` 주석으로 표시):

| Spec 값                           | Builder 내부 상수                            | CSS 토큰                             |
| --------------------------------- | -------------------------------------------- | ------------------------------------ |
| `ButtonSpec.sizes[size].paddingX` | `BUTTON_SIZE_CONFIG[size].paddingLeft/Right` | `Button.css [data-size] padding`     |
| `ButtonSpec.sizes[size].fontSize` | `BUTTON_SIZE_CONFIG[size].fontSize`          | `Button.css [data-size] font-size`   |
| `fontFamily.sans` (typography.ts) | `measureTextWidth()` 기본 폰트               | `body { font-family }`               |
| CSS base `border: 1px solid`      | `BUTTON_SIZE_CONFIG[size].borderWidth` (=1)  | `Button.css base: border: 1px solid` |
| `ButtonSpec.variants[v].border`   | `PixiButton specDefaultBorderWidth` (=1)     | `Button.css border-color`            |

위 값들이 불일치하면 CSS↔WebGL 렌더링 차이가 발생합니다.
코드에 `// @sync` 주석이 있는 곳은 반드시 연관된 다른 소스와 값을 맞춰야 합니다.

#### 4.7.4.1 Padding/Border 이중 적용 방지 (CRITICAL)

자체적으로 padding/border를 그래픽 크기에 반영하는 leaf UI 컴포넌트(Button 등)는
레이아웃 엔진(Taffy)에도 padding/border를 전달하면 **이중 적용**된다.

**현행 해결 방식: `enrichWithIntrinsicSize()` + `parseBoxModel()`**

```
layout/engines/utils.ts
├── enrichWithIntrinsicSize()    # leaf UI 컴포넌트의 intrinsic 크기 주입
├── parseBoxModel()              # 폼 요소 기본 padding/border + border-box 변환
└── INLINE_BLOCK_TAGS            # 대상 컴포넌트 목록
```

- **`INLINE_BLOCK_TAGS`**: leaf UI 컴포넌트 식별 (`button`, `badge`, `chip`, `checkbox`, `radio`, `switch`, `togglebutton`, `togglebuttongroup` 등)
- **`enrichWithIntrinsicSize()`**: CSS 미지정 시 spec 기본 padding/border를 포함한 intrinsic width/height 계산 → 엔진에 content 크기로 전달
- **`parseBoxModel()`**: 폼 요소에서 명시적 CSS가 없으면 `INLINE_UI_SIZE_CONFIGS` 기본값 적용, border-box → content-box 변환으로 엔진과 self-rendering 간 이중 계산 방지

**핵심 원칙**: 레이아웃 엔진은 **content-box 크기**만 받고, 시각적 padding/border는 spec shapes 또는 컴포넌트 self-rendering에서 처리

<details>
<summary>레거시: SELF_PADDING_TAGS 패턴 (제거됨)</summary>

> 아래 패턴은 @pixi/layout LayoutContainer + Yoga 시절에 사용되었으며, 현재는 제거되었다.
> `enrichWithIntrinsicSize()` + `parseBoxModel()`이 이 역할을 대체한다.

```typescript
// [제거됨] BuilderCanvas.tsx의 SELF_PADDING_TAGS
const SELF_PADDING_TAGS = new Set([
  'Button', 'SubmitButton', 'FancyButton', 'ToggleButton',
]);
function stripSelfRenderedProps(layout: LayoutStyle): LayoutStyle { ... }
```

</details>

#### 4.7.4.2 BlockEngine Border-Box 크기 계산 (CRITICAL)

`BlockEngine.calculate()`에서 `parseBoxModel()`이 반환하는 **content-box** 크기를
그대로 사용하면 padding/border를 포함한 실제 차지 공간이 누락되어 요소가 겹칩니다.

**해결**: content-box → border-box 변환 (`BlockEngine.ts`)

```typescript
// border-box 크기 = content + padding + border
const { padding, border } = boxModel;
const padBorderH = padding.left + padding.right + border.left + border.right;
const padBorderV = padding.top + padding.bottom + border.top + border.bottom;

// Block: Auto-width는 이미 border-box, Explicit width는 content-box + padding/border
const childWidth =
  boxModel.width !== undefined
    ? childContentWidth + padBorderH
    : childContentWidth; // auto: availableWidth - margins (이미 border-box)
const childHeight = childContentHeight + padBorderV;

currentY += childHeight; // border-box 높이로 진행
```

inline-block 경로도 동일하게 border-box 크기 사용.

> **v1.13 참고**: `parseBoxModel()`이 폼 요소에 대해 자동으로 border-box → content-box 변환을
> 수행하므로 (§4.7.4.5), BlockEngine의 `childContentWidth + padBorderH` 합산이 정확한
> border-box 크기를 생성합니다. 폼 요소에 명시적 `width`/`height`가 있을 때도 이중 계산이 발생하지 않습니다.

#### 4.7.4.3 Baseline 정렬: 버튼 수직 중앙 정렬

`display: block` 부모에서 다른 높이의 inline-block 버튼들이 배치될 때,
CSS 웹 모드에서는 텍스트가 수직 중앙 정렬된 버튼들이 서로 중앙 정렬됩니다.

**원인**: 기존 `calculateBaseline()`이 `height * 0.8` (일반 텍스트 블록용)을 사용하여
버튼처럼 텍스트가 수직 중앙 정렬된 요소에 맞지 않음.

**해결**: `VERTICALLY_CENTERED_TAGS`에 해당하는 요소는 `height / 2` 반환 (`utils.ts`)

```typescript
const VERTICALLY_CENTERED_TAGS = new Set([
  "button",
  "submitbutton",
  "fancybutton",
  "togglebutton",
  "input",
  "select",
]);

// calculateBaseline 내부
if (VERTICALLY_CENTERED_TAGS.has(tag)) {
  return height / 2; // 수직 중앙 정렬 요소: baseline ≈ 중앙
}
```

**검증**: Button 1(h=100), Button 2(h=200)

- baseline: 50, 100 → Button 1 y = 100 - 50 = **50** (수직 중앙 ✓)

#### 4.7.4.4 Spec 기본 borderWidth 적용

CSS 모드에서는 `.react-aria-Button { border: 1px solid var(--outline-variant); }`가
**모든 variant에** 기본 border를 제공하지만, WebGL 모드는 inline style만 읽으므로 기본 border가 누락됩니다.

**v1.12 수정**: CSS는 모든 variant에 `border: 1px solid`를 적용하므로, `specDefaultBorderWidth`를
variant의 `border` 존재 여부와 무관하게 항상 `1`로 설정합니다.

```typescript
// PixiButton.tsx — CSS base: border: 1px solid (all variants)
const specDefaultBorderWidth = 1;

// 모든 variant에 border/borderHover 추가 (Button.spec.ts)
// primary, secondary, tertiary, error → border: 배경색과 동일 (시각적으로 투명)
// default, surface → border: outline-variant
// outline → border: outline
// ghost → border 없음 (backgroundAlpha: 0)
```

**v1.12 추가 — borderHover 분리**: hover/pressed 상태에서 border 색상이 다른 경우를 지원합니다.

```typescript
// PixiButton.tsx — hover 시 별도 border 색상
const borderHoverColor = hasInlineBorderColor
  ? borderColor
  : (variantColors.borderHover ?? borderColor);

// default vs hover graphics 옵션 분리
const defaultGraphicsOptions = { borderColor: layout.borderColor, ... };
const hoverGraphicsOptions = { borderColor: layout.borderHoverColor, ... };
```

#### 4.7.4.5 parseBoxModel 폼 요소 기본값 적용 (v1.12)

`parseBoxModel()`은 inline style만으로 padding/border를 계산합니다.
Button 등 self-rendering 요소는 inline style이 없어도 **BUTTON_SIZE_CONFIG 기본값**이 적용되어야 합니다.

**문제**: `calculateContentWidth`가 padding을 포함했고, `parseBoxModel`도 inline padding을 반환
→ 사용자가 style panel에서 padding을 변경하면 이중 계산 발생

**해결**: `calculateContentWidth`는 순수 텍스트 너비만 반환하고,
`parseBoxModel`이 BUTTON_SIZE_CONFIG 기본값을 제공하도록 분리

```typescript
// utils.ts parseBoxModel()
const tag = (element.tag ?? '').toLowerCase();
const isFormElement = ['button', 'input', 'select'].includes(tag);
if (isFormElement) {
  const size = (props?.size as string) ?? 'sm';
  const sizeConfig = BUTTON_SIZE_CONFIG[size] ?? BUTTON_SIZE_CONFIG.sm;

  // inline padding이 없으면 BUTTON_SIZE_CONFIG 기본값 적용
  const hasInlinePadding = style?.padding !== undefined ||
    style?.paddingTop !== undefined || /* ... */;
  if (!hasInlinePadding) {
    padding = {
      top: sizeConfig.paddingY,
      right: sizeConfig.paddingRight,
      bottom: sizeConfig.paddingY,
      left: sizeConfig.paddingLeft,
    };
  }

  // inline border가 없으면 BUTTON_SIZE_CONFIG 기본값 적용
  const hasInlineBorder = style?.borderWidth !== undefined || /* ... */;
  if (!hasInlineBorder) {
    border = {
      top: sizeConfig.borderWidth,
      right: sizeConfig.borderWidth,
      bottom: sizeConfig.borderWidth,
      left: sizeConfig.borderWidth,
    };
  }
}
```

**결과**: BlockEngine의 `childWidth = contentWidth + padding + border` 계산에서:

- **기본 상태**: `textWidth + BUTTON_SIZE_CONFIG.padding + BUTTON_SIZE_CONFIG.border`
- **inline 변경 시**: `textWidth + inlinePadding + inlineBorder` (이중 계산 없음)

**v1.13 추가 — 폼 요소 자동 border-box 처리**:
폼 요소(`button`, `input`, `select`)에 명시적 `width`/`height`가 설정된 경우,
해당 값을 **border-box** 크기로 취급하여 `padding + border`를 차감합니다.
PixiButton 등 self-rendering 요소는 `width`를 총 렌더링 크기로 사용하지만,
BlockEngine은 `content-box + padding + border`로 합산하므로 이중 계산이 발생합니다.

```typescript
// utils.ts parseBoxModel() — border-box 변환
const treatAsBorderBox =
  boxSizing === "border-box" ||
  (isFormElement && (width !== undefined || height !== undefined));

if (treatAsBorderBox) {
  if (width !== undefined) {
    width = Math.max(0, width - paddingH - borderH);
  }
  if (height !== undefined) {
    height = Math.max(0, height - paddingV - borderV);
  }
}
```

**v3.9 추가 → v3.12 수정 — Card/Box/Section padding 처리**:
컨테이너 요소(`Card`, `Box`, `Section`)도 `parseBoxModel()`에서 `treatAsBorderBox` 대상입니다.
단, `enrichWithIntrinsicSize()`에서는 CSS에 padding/border가 명시된 경우 **content-box 높이만 주입**합니다.
레이아웃 엔진(Taffy)이 CSS padding/border를 자체 추가하므로, enrichment에서 중복 추가하면 이중 계산이 발생합니다.

```typescript
// utils.ts enrichWithIntrinsicSize() — CSS padding 유무에 따른 조건부 추가
// CSS에 padding이 없으면 spec 기본값 포함, 있으면 엔진에 위임
if (!isSpecShapesInput && (!hasCSSVerticalPadding || isInlineBlockTag)) {
  injectHeight += box.padding.top + box.padding.bottom;
}
// INLINE_BLOCK_TAGS만 항상 border-box (layoutInlineRun이 직접 사용)
```

> **관련**: §9.10.4 padding 주입 규칙, §4.7.4.2 BlockEngine border-box 크기 계산

#### 4.7.4.6 calculateContentWidth 순수 텍스트 너비 반환 (v1.12)

폼 요소(`button`, `input`, `select`, `a`, `label`)에 대해 `calculateContentWidth()`는
padding/border를 포함하지 않고 **순수 텍스트 너비만** 반환합니다.

```typescript
// utils.ts calculateContentWidth()
const isFormElement = ["button", "input", "select", "a", "label"].includes(tag);
if (isFormElement) {
  const size = (props?.size as string) ?? "sm";
  const sizeConfig = BUTTON_SIZE_CONFIG[size] ?? BUTTON_SIZE_CONFIG.sm;
  const fontSize = parseNumericValue(style?.fontSize) ?? sizeConfig.fontSize;
  return calculateTextWidth(text, fontSize, 0); // padding=0, border는 parseBoxModel에서 처리
}
```

이는 §4.7.4.5 (`parseBoxModel` 기본값)과 짝을 이루어 이중 계산을 방지합니다.

#### 4.7.4.7 텍스트 측정 엔진 통일 (v1.12)

CSS, BlockEngine, PixiButton이 각각 다른 텍스트 측정 엔진을 사용하여 `display: block`
부모에서 자식 버튼 간 간격이 발생했습니다.

| 구성 요소              | 측정 엔진                          | 비고   |
| ---------------------- | ---------------------------------- | ------ |
| CSS                    | 브라우저 네이티브                  | 기준   |
| BlockEngine (utils.ts) | Canvas 2D `ctx.measureText()`      |        |
| PixiButton             | PixiJS `PixiText.getLocalBounds()` | 불일치 |

**해결**: PixiButton의 **너비 측정**을 Canvas 2D로 통일하고, **높이 측정**만 PixiJS 유지

```typescript
// PixiButton.tsx — Canvas 2D 텍스트 너비 측정 사용
import { measureTextWidth as measureTextWidthCanvas } from "../layout/engines/utils";

const textWidth = measureTextWidthCanvas(buttonText, fontSize, fontFamily);
const textStyle = new TextStyle({ fontSize, fontFamily });
const textHeight = measureTextSize(buttonText, textStyle).height;
```

`measureTextWidth()`는 utils.ts에서 `export`하여 공유합니다.

#### 4.7.4.8 createDefaultButtonProps borderWidth 기본값 (v1.12)

버튼 추가 시 Style Panel에서 `borderWidth`가 0으로 표시되는 문제를 해결합니다.

**원인**: Style Panel이 `element.style.borderWidth ?? computedStyle.borderWidth ?? '0px'`를 읽는데,
새로 생성된 버튼의 props에 `borderWidth`가 없었음

**해결**: `createDefaultButtonProps()`에 기본 style 추가

```typescript
// unified.types.ts
export function createDefaultButtonProps(): ButtonElementProps {
  return {
    children: "Button",
    variant: "default",
    size: "sm",
    isDisabled: false,
    style: {
      borderWidth: "1px",
    },
  };
}
```

#### 4.7.5 WebGL computedStyle 동기화 수정

**문제**: WebGL 요소 선택 시 Style Panel의 borderRadius가 업데이트되지 않음

**원인 분석**:

- React 컴포넌트: Preview iframe에서 `window.getComputedStyle()` → postMessage로 전송
- WebGL 컴포넌트: `createCompleteProps()`에 computedStyle 미포함

**해결**:

1. `computeCanvasElementStyle()` 함수 생성 (`elementHelpers.ts`)
   - inline style에서 borderRadius 추출 (우선순위 1)
   - 컴포넌트별 Spec에서 size 기반 계산 (우선순위 2)

2. `scheduleHydrateSelectedProps()`에서 computedStyle 포함
   ```typescript
   const computedStyle = computeCanvasElementStyle(element);
   set({
     selectedElementProps: { ...createCompleteProps(element), computedStyle },
   });
   ```

#### 4.7.6 smoothRoundRect 구현 (WebGL 렌더링 품질 개선)

**문제**: PixiJS 기본 `roundRect()`이 제한된 bezier 세그먼트로 확대 시 계단 현상 발생

**해결**: `smoothRoundRect()` 함수 구현 (`graphicsUtils.ts`)

```typescript
export function smoothRoundRect(
  g: PixiGraphics,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  segments?: number,
): void;
```

**특징**:

- 반경 기반 동적 세그먼트 계산 (8~48개)
- 저사양 기기 대응 (6~24개)
- devicePixelRatio 고려한 품질 조정
- 모든 border style (solid, dashed, dotted, double)에 적용

**참고**: Figma는 "squircle" 방식으로 3개의 bezier 곡선으로 부드러운 곡률 전환 구현

#### 4.7.7 수정된 파일 목록

| 파일                                                    | 변경 내용                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/specs/`                                       | 새 패키지 생성                                                                                                                                                                                                                                                                                                                                                |
| `packages/shared/src/components/Button.tsx`             | size별 borderRadius 인라인 스타일                                                                                                                                                                                                                                                                                                                             |
| `packages/shared/src/components/styles/Button.css`      | size별 borderRadius CSS                                                                                                                                                                                                                                                                                                                                       |
| `apps/builder/.../stores/elements.ts`                   | computedStyle 포함                                                                                                                                                                                                                                                                                                                                            |
| `apps/builder/.../stores/utils/elementHelpers.ts`       | computeCanvasElementStyle 추가                                                                                                                                                                                                                                                                                                                                |
| `apps/builder/.../canvas/ui/PixiButton.tsx`             | Feature Flag 마이그레이션, spec 기본 borderWidth 적용 (v1.10)                                                                                                                                                                                                                                                                                                 |
| `apps/builder/.../canvas/utils/graphicsUtils.ts`        | smoothRoundRect 구현                                                                                                                                                                                                                                                                                                                                          |
| `apps/builder/.../canvas/BuilderCanvas.tsx`             | ~~`SELF_PADDING_TAGS` + `stripSelfRenderedProps`~~ → `enrichWithIntrinsicSize` + `parseBoxModel` 패턴으로 대체 (v1.10→v3.3)                                                                                                                                                                                                                                   |
| `apps/builder/.../canvas/layout/engines/BlockEngine.ts` | content-box → border-box 크기 변환 (v1.10)                                                                                                                                                                                                                                                                                                                    |
| `apps/builder/.../canvas/layout/engines/utils.ts`       | `VERTICALLY_CENTERED_TAGS` baseline 수정 (v1.10), `BUTTON_SIZE_CONFIG` padding 동기화 + fontFamily specs 참조 (v1.11), `BUTTON_SIZE_CONFIG.borderWidth` 추가 + `calculateContentWidth` 순수 텍스트 반환 + `parseBoxModel` 폼 요소 기본값 + `measureTextWidth` export (v1.12), `parseBoxModel`에서 요소 자체 width를 `calculateContentHeight`에 전달 (v1.15.1) |
| `packages/specs/src/components/Button.spec.ts`          | paddingX md:16→24, lg:24→32, xl:32→40, fontFamily specs 상수 사용 (v1.11), 전 variant border/borderHover 추가 (v1.12)                                                                                                                                                                                                                                         |
| `packages/specs/src/primitives/typography.ts`           | fontFamily.sans에 Pretendard 추가 (v1.11)                                                                                                                                                                                                                                                                                                                     |
| `packages/specs/src/renderers/PixiRenderer.ts`          | `getVariantColors()` borderHover 반환 추가 (v1.12)                                                                                                                                                                                                                                                                                                            |
| `apps/builder/.../canvas/ui/PixiButton.tsx`             | fontFamily를 specs 상수로 교체 (v1.11), `specDefaultBorderWidth=1` 고정 + borderHoverColor 분리 + Canvas 2D 텍스트 측정 통일 (v1.12)                                                                                                                                                                                                                          |
| `apps/builder/src/types/builder/unified.types.ts`       | `createDefaultButtonProps()` style.borderWidth 기본값 추가 (v1.12)                                                                                                                                                                                                                                                                                            |

---

## 5. Phase 2: Form 컴포넌트 마이그레이션

### 5.1 대상 컴포넌트 (16개)

| #   | 컴포넌트       | 현재 상태                                  | 복잡도 |
| --- | -------------- | ------------------------------------------ | ------ |
| 1   | TextField      | ✅ 정상                                    | 중간   |
| 2   | TextArea       | ✅ 정상                                    | 중간   |
| 3   | NumberField    | ✅ 정상                                    | 중간   |
| 4   | SearchField    | ✅ 정상                                    | 중간   |
| 5   | Checkbox       | ⚠️ 부분                                    | 중간   |
| 6   | CheckboxGroup  | ✅ 정상                                    | 높음   |
| 7   | Radio          | ⚠️ 부분                                    | 중간   |
| 8   | Switch         | ✅ 정상                                    | 중간   |
| 9   | Select         | ✅ 정상                                    | 높음   |
| 10  | ComboBox       | ✅ 정상                                    | 높음   |
| 11  | ListBox        | ✅ 정상                                    | 높음   |
| 12  | Slider         | ✅ 완전 지원 (Complex Component 전환 완료) | 높음   |
| 13  | Meter          | ⚠️ 부분                                    | 중간   |
| 14  | ProgressBar    | ⚠️ 부분                                    | 중간   |
| 14b | ProgressCircle | ✅ 정상 (Arc 기반 Skia 렌더링 완료)        | 중간   |
| 15  | Form           | ⚠️ 부분                                    | 낮음   |
| 16  | Autocomplete   | ❌ 미구현                                  | 높음   |

### 5.2 TextField Spec 예시

```typescript
// packages/specs/src/components/TextField.spec.ts

import type { ComponentSpec } from "../types";

export interface TextFieldProps {
  variant?:
    | "default"
    | "primary"
    | "secondary"
    | "tertiary"
    | "error"
    | "success";
  size?: "sm" | "md" | "lg";
  label?: string;
  description?: string;
  errorMessage?: string;
  placeholder?: string;
  value?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  isReadOnly?: boolean;
  orientation?: "horizontal" | "vertical";
  style?: React.CSSProperties;
}

export const TextFieldSpec: ComponentSpec<TextFieldProps> = {
  name: "TextField",
  description: "Material Design 3 기반 텍스트 입력 필드",
  element: "div",

  defaultVariant: "default",
  defaultSize: "md",

  variants: {
    default: {
      background: "{color.surface-container}",
      backgroundHover: "{color.surface-container-high}",
      backgroundPressed: "{color.surface-container-high}",
      text: "{color.on-surface}",
      border: "{color.outline-variant}",
    },
    primary: {
      background: "{color.surface-container}",
      backgroundHover: "{color.surface-container-high}",
      backgroundPressed: "{color.surface-container-high}",
      text: "{color.on-surface}",
      border: "{color.primary}",
    },
    // ... 나머지 variants
  },

  sizes: {
    sm: {
      height: 36,
      paddingX: 12,
      paddingY: 8,
      fontSize: "{typography.text-sm}",
      borderRadius: "{radius.sm}",
    },
    md: {
      height: 44,
      paddingX: 16,
      paddingY: 10,
      fontSize: "{typography.text-md}",
      borderRadius: "{radius.md}",
    },
    lg: {
      height: 52,
      paddingX: 20,
      paddingY: 14,
      fontSize: "{typography.text-lg}",
      borderRadius: "{radius.md}",
    },
  },

  states: {
    focused: {
      outline: "2px solid var(--primary)",
      outlineOffset: "0px",
    },
    disabled: {
      opacity: 0.38,
      cursor: "not-allowed",
      pointerEvents: "none",
    },
    focusVisible: {
      outline: "2px solid var(--primary)",
      outlineOffset: "2px",
    },
  },

  render: {
    shapes: (props, variant, size, state = "default") => {
      const shapes: Shape[] = [];

      // 상태에 따른 테두리 스타일
      const isFocused = state === "focused" || state === "focusVisible";
      const borderWidth = isFocused ? 2 : props.isInvalid ? 2 : 1;
      const borderColor = props.isInvalid
        ? "{color.error}"
        : isFocused
          ? "{color.primary}"
          : variant.border!;

      // 레이블
      if (props.label) {
        shapes.push({
          type: "text" as const,
          x: 0,
          y: 0,
          text: props.label,
          fontSize: "{typography.text-sm}",
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 500,
          fill: "{color.on-surface}",
        });
      }

      // 입력 필드 배경
      shapes.push({
        id: "input-bg",
        type: "roundRect" as const,
        x: 0,
        y: props.label ? 24 : 0,
        width: "auto",
        height: size.height,
        radius: size.borderRadius,
        fill: variant.background,
      });

      // 테두리
      shapes.push({
        type: "border" as const,
        target: "input-bg",
        borderWidth,
        color: borderColor,
        radius: size.borderRadius,
      });

      // 플레이스홀더 또는 값
      shapes.push({
        type: "text" as const,
        x: size.paddingX,
        y: (props.label ? 24 : 0) + size.height / 2,
        text: props.value || props.placeholder || "",
        fontSize: size.fontSize,
        fontFamily: "Inter, system-ui, sans-serif",
        fill: props.value ? variant.text : "{color.on-surface-variant}",
        baseline: "middle" as const,
      });

      // 설명 또는 에러 메시지
      if (props.errorMessage || props.description) {
        shapes.push({
          type: "text" as const,
          x: 0,
          y: (props.label ? 24 : 0) + size.height + 4,
          text: props.errorMessage || props.description || "",
          fontSize: "{typography.text-xs}",
          fontFamily: "Inter, system-ui, sans-serif",
          fill: props.errorMessage
            ? "{color.error}"
            : "{color.on-surface-variant}",
        });
      }

      return shapes;
    },

    react: (props) => ({
      "data-invalid": props.isInvalid || undefined,
      "data-readonly": props.isReadOnly || undefined,
      "data-orientation": props.orientation || "vertical",
    }),

    pixi: (props) => ({
      eventMode: "static",
      cursor: props.isDisabled ? "not-allowed" : "text",
    }),
  },
};
```

### 5.3 Phase 2 체크리스트

- [ ] TextField.spec.ts
- [ ] TextArea.spec.ts
- [ ] NumberField.spec.ts
- [ ] SearchField.spec.ts
- [ ] Checkbox.spec.ts
- [ ] CheckboxGroup.spec.ts
- [ ] Radio.spec.ts
- [ ] Switch.spec.ts
- [ ] Select.spec.ts
- [ ] ComboBox.spec.ts
- [ ] ListBox.spec.ts
- [x] Slider.spec.ts ← Complex Component 전환 + TokenRef offsetY 버그 수정 (2026-02-22)
- [ ] Meter.spec.ts
- [ ] ProgressBar.spec.ts
- [ ] Form.spec.ts
- [ ] 각 컴포넌트 React/PIXI 마이그레이션
- [ ] Visual Regression Test

---

## 6. Phase 3: 복합 컴포넌트 마이그레이션

### 6.1 대상 컴포넌트 (20개)

| #   | 컴포넌트        | 현재 상태                     | 복잡도    |
| --- | --------------- | ----------------------------- | --------- |
| 1   | Table           | ✅ 정상                       | 매우 높음 |
| 2   | Tree            | ✅ 정상                       | 높음      |
| 3   | Tabs            | ✅ 완전 지원 (컨테이너 패턴)  | 높음      |
| 4   | Menu            | ⚠️ 부분                       | 높음      |
| 5   | Breadcrumbs     | ✅ 정상 (CONTAINER_TAGS 전환) | 중간      |
| 6   | Pagination      | ⚠️ 부분                       | 중간      |
| 7   | TagGroup        | ✅ 정상 (CONTAINER_TAGS 전환) | 중간      |
| 8   | GridList        | ✅ 정상                       | 높음      |
| 9   | Disclosure      | ✅ 정상                       | 중간      |
| 10  | DisclosureGroup | 🔵 PIXI전용                   | 높음      |
| 11  | Toolbar         | ⚠️ 부분                       | 중간      |
| 12  | Toast           | ⚠️ 부분                       | 중간      |
| 13  | Panel           | ✅ 정상                       | 중간      |
| 14  | Group           | ⚠️ 부분                       | 낮음      |
| 15  | Slot            | ⚠️ 부분                       | 낮음      |
| 16  | Skeleton        | ✅ 정상                       | 낮음      |
| 17  | DropZone        | ✅ 정상                       | 중간      |
| 18  | FileTrigger     | ❌ 문제                       | 중간      |
| 19  | ScrollBox       | ⚠️ 부분                       | 높음      |
| 20  | MaskedFrame     | ⚠️ 부분                       | 높음      |

### 6.2 Table Spec 예시 (복합 구조)

```typescript
// packages/specs/src/components/Table.spec.ts

import type { ComponentSpec } from "../types";

export interface TableProps {
  variant?: "default" | "striped" | "bordered";
  size?: "sm" | "md" | "lg";
  columns: TableColumn[];
  rows: TableRow[];
  selectionMode?: "none" | "single" | "multiple";
  sortDescriptor?: { column: string; direction: "ascending" | "descending" };
  style?: React.CSSProperties;
}

export interface TableColumn {
  id: string;
  label: string;
  width?: number;
  allowsSorting?: boolean;
}

export interface TableRow {
  id: string;
  cells: Record<string, unknown>;
  isSelected?: boolean;
}

export const TableSpec: ComponentSpec<TableProps> = {
  name: "Table",
  description: "Material Design 3 기반 데이터 테이블",
  element: "div",

  defaultVariant: "default",
  defaultSize: "md",

  variants: {
    default: {
      background: "{color.surface}",
      backgroundHover: "{color.surface-container}",
      backgroundPressed: "{color.surface-container-high}",
      text: "{color.on-surface}",
      border: "{color.outline-variant}",
    },
    striped: {
      background: "{color.surface}",
      backgroundHover: "{color.surface-container}",
      backgroundPressed: "{color.surface-container-high}",
      text: "{color.on-surface}",
      border: "{color.outline-variant}",
      // 홀수 행 배경
      // alternateBackground: '{color.surface-container}',
    },
    bordered: {
      background: "{color.surface}",
      backgroundHover: "{color.surface-container}",
      backgroundPressed: "{color.surface-container-high}",
      text: "{color.on-surface}",
      border: "{color.outline}",
    },
  },

  sizes: {
    sm: {
      height: 36,
      paddingX: 8,
      paddingY: 4,
      fontSize: "{typography.text-sm}",
      borderRadius: "{radius.sm}",
    },
    md: {
      height: 44,
      paddingX: 12,
      paddingY: 8,
      fontSize: "{typography.text-md}",
      borderRadius: "{radius.md}",
    },
    lg: {
      height: 52,
      paddingX: 16,
      paddingY: 12,
      fontSize: "{typography.text-lg}",
      borderRadius: "{radius.md}",
    },
  },

  // 테이블은 복합 shapes 구조
  render: {
    shapes: (props, variant, size, state = "default") => {
      const shapes: Shape[] = [];
      const { columns, rows } = props;

      // 컨테이너
      shapes.push({
        type: "container" as const,
        x: 0,
        y: 0,
        children: [
          // 테두리
          {
            type: "border" as const,
            borderWidth: 1,
            color: variant.border!,
            radius: size.borderRadius,
          },
        ],
        clip: true,
      });

      // 헤더 행
      let yOffset = 0;
      shapes.push({
        type: "container" as const,
        x: 0,
        y: yOffset,
        children: [
          {
            type: "rect" as const,
            x: 0,
            y: 0,
            width: "auto",
            height: size.height,
            fill: "{color.surface-container}",
          },
          // 각 컬럼 헤더
          ...columns.map((col, i) => ({
            type: "text" as const,
            x: i * (col.width || 100) + size.paddingX,
            y: size.height / 2,
            text: col.label,
            fontSize: size.fontSize,
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: 600,
            fill: variant.text,
            baseline: "middle" as const,
          })),
        ],
      });

      yOffset += size.height;

      // 데이터 행
      rows.forEach((row, rowIndex) => {
        const isEven = rowIndex % 2 === 0;
        const rowBg =
          props.variant === "striped" && !isEven
            ? "{color.surface-container}"
            : variant.background;

        shapes.push({
          type: "container" as const,
          x: 0,
          y: yOffset,
          children: [
            {
              type: "rect" as const,
              x: 0,
              y: 0,
              width: "auto",
              height: size.height,
              fill: row.isSelected ? "{color.primary-container}" : rowBg,
            },
            // 각 셀
            ...columns.map((col, i) => ({
              type: "text" as const,
              x: i * (col.width || 100) + size.paddingX,
              y: size.height / 2,
              text: String(row.cells[col.id] || ""),
              fontSize: size.fontSize,
              fontFamily: "Inter, system-ui, sans-serif",
              fill: variant.text,
              baseline: "middle" as const,
            })),
          ],
        });

        yOffset += size.height;
      });

      return shapes;
    },
  },
};
```

### 6.3 Phase 3 체크리스트

- [ ] Table.spec.ts (복합 구조)
- [ ] Tree.spec.ts
- [ ] Tabs.spec.ts
- [ ] Menu.spec.ts
- [x] Breadcrumbs.spec.ts (CONTAINER_TAGS 전환 완료)
- [ ] Pagination.spec.ts
- [x] TagGroup.spec.ts (CONTAINER_TAGS 전환 완료)
- [ ] GridList.spec.ts
- [ ] Disclosure.spec.ts
- [ ] DisclosureGroup.spec.ts
- [ ] Toolbar.spec.ts
- [ ] Toast.spec.ts
- [ ] Panel.spec.ts
- [ ] Group.spec.ts
- [ ] Slot.spec.ts
- [ ] Skeleton.spec.ts
- [ ] DropZone.spec.ts
- [ ] FileTrigger.spec.ts
- [ ] ScrollBox.spec.ts
- [ ] MaskedFrame.spec.ts

---

## 7. Phase 4: 특수 컴포넌트 마이그레이션

### 7.1 대상 컴포넌트 (16개)

| #   | 컴포넌트          | 현재 상태 | 복잡도    |
| --- | ----------------- | --------- | --------- |
| 1   | DatePicker        | ⚠️ 부분   | 매우 높음 |
| 2   | DateRangePicker   | ⚠️ 부분   | 매우 높음 |
| 3   | DateField         | ❌ 문제   | 높음      |
| 4   | TimeField         | ❌ 문제   | 높음      |
| 5   | Calendar          | ⚠️ 부분   | 높음      |
| 6   | ColorPicker       | ⚠️ 부분   | 매우 높음 |
| 7   | ColorField        | ❌ 문제   | 높음      |
| 8   | ColorSlider       | ⚠️ 부분   | 높음      |
| 9   | ColorArea         | ⚠️ 부분   | 높음      |
| 10  | ColorWheel        | ⚠️ 부분   | 높음      |
| 11  | ColorSwatch       | ⚠️ 부분   | 중간      |
| 12  | ColorSwatchPicker | ⚠️ 부분   | 중간      |
| 13  | List              | ❌ 문제   | 중간      |
| 14  | Input             | ✅ 정상   | 낮음      |
| 15  | FancyButton       | ✅ 정상   | 중간      |
| 16  | Switcher          | ✅ 정상   | 중간      |

### 7.2 ColorPicker Spec 예시

```typescript
// packages/specs/src/components/ColorPicker.spec.ts

import type { ComponentSpec } from "../types";

export interface ColorPickerProps {
  variant?: "default" | "compact" | "expanded";
  size?: "sm" | "md" | "lg";
  value?: string; // hex color
  defaultValue?: string;
  onChange?: (color: string) => void;
  showAlpha?: boolean;
  showInput?: boolean;
  swatches?: string[];
  style?: React.CSSProperties;
}

export const ColorPickerSpec: ComponentSpec<ColorPickerProps> = {
  name: "ColorPicker",
  description: "색상 선택기",
  element: "div",

  defaultVariant: "default",
  defaultSize: "md",

  variants: {
    default: {
      background: "{color.surface-container}",
      backgroundHover: "{color.surface-container-high}",
      backgroundPressed: "{color.surface-container-high}",
      text: "{color.on-surface}",
      border: "{color.outline-variant}",
    },
    compact: {
      background: "{color.surface-container}",
      backgroundHover: "{color.surface-container-high}",
      backgroundPressed: "{color.surface-container-high}",
      text: "{color.on-surface}",
      border: "{color.outline-variant}",
    },
    expanded: {
      background: "{color.surface}",
      backgroundHover: "{color.surface-container}",
      backgroundPressed: "{color.surface-container}",
      text: "{color.on-surface}",
      border: "{color.outline-variant}",
    },
  },

  sizes: {
    sm: {
      height: 200,
      paddingX: 8,
      paddingY: 8,
      fontSize: "{typography.text-sm}",
      borderRadius: "{radius.md}",
    },
    md: {
      height: 260,
      paddingX: 12,
      paddingY: 12,
      fontSize: "{typography.text-md}",
      borderRadius: "{radius.md}",
    },
    lg: {
      height: 320,
      paddingX: 16,
      paddingY: 16,
      fontSize: "{typography.text-lg}",
      borderRadius: "{radius.lg}",
    },
  },

  render: {
    shapes: (props, variant, size, state = "default") => {
      const shapes: Shape[] = [];

      // 컨테이너 배경
      shapes.push({
        type: "roundRect" as const,
        x: 0,
        y: 0,
        width: "auto",
        height: size.height,
        radius: size.borderRadius,
        fill: variant.background,
      });

      // 테두리
      shapes.push({
        type: "border" as const,
        borderWidth: 1,
        color: variant.border!,
        radius: size.borderRadius,
      });

      // ColorArea (그라디언트 영역)
      const areaSize = size.height - size.paddingY * 2 - 60;
      shapes.push({
        type: "container" as const,
        x: size.paddingX,
        y: size.paddingY,
        children: [
          {
            type: "roundRect" as const,
            x: 0,
            y: 0,
            width: areaSize,
            height: areaSize,
            radius: "{radius.sm}",
            fill: props.value || "#ff0000",
            // 실제로는 그라디언트 구현 필요
          },
        ],
      });

      // Hue 슬라이더
      shapes.push({
        type: "roundRect" as const,
        x: size.paddingX,
        y: size.paddingY + areaSize + 8,
        width: areaSize,
        height: 16,
        radius: "{radius.full}",
        fill: "#ff0000", // 실제로는 hue 그라디언트
      });

      // Alpha 슬라이더 (옵션)
      if (props.showAlpha) {
        shapes.push({
          type: "roundRect" as const,
          x: size.paddingX,
          y: size.paddingY + areaSize + 32,
          width: areaSize,
          height: 16,
          radius: "{radius.full}",
          fill: props.value || "#ffffff",
        });
      }

      // 현재 색상 미리보기
      shapes.push({
        type: "circle" as const,
        x: size.paddingX + areaSize + 20,
        y: size.paddingY + 20,
        radius: 16,
        fill: props.value || "#ff0000",
      });

      return shapes;
    },
  },
};
```

### 7.3 Phase 4 체크리스트

- [ ] DatePicker.spec.ts
- [ ] DateRangePicker.spec.ts
- [ ] DateField.spec.ts
- [ ] TimeField.spec.ts
- [ ] Calendar.spec.ts
- [ ] ColorPicker.spec.ts
- [ ] ColorField.spec.ts
- [ ] ColorSlider.spec.ts
- [ ] ColorArea.spec.ts
- [ ] ColorWheel.spec.ts
- [ ] ColorSwatch.spec.ts
- [ ] ColorSwatchPicker.spec.ts
- [ ] List.spec.ts
- [ ] Input.spec.ts
- [ ] FancyButton.spec.ts
- [ ] Switcher.spec.ts

---

## 8. Phase 5: 검증 및 최적화

### 8.1 Visual Regression Testing

#### 8.1.1 Playwright 설정 (플래키 방지)

```typescript
// packages/specs/playwright.config.ts

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: false, // 순차 실행으로 리소스 경쟁 방지

  // 플래키 방지 설정
  retries: 2, // 실패 시 2회 재시도
  timeout: 30000,

  expect: {
    // 스냅샷 비교 허용치
    toMatchSnapshot: {
      maxDiffPixels: 50, // 최대 50픽셀 차이 허용
      maxDiffPixelRatio: 0.01, // 또는 1% 비율
    },
  },

  use: {
    // 일관된 뷰포트
    viewport: { width: 1280, height: 720 },

    // 디바이스 스케일 고정
    deviceScaleFactor: 1,

    // 애니메이션 비활성화
    actionTimeout: 10000,

    // 스크린샷 설정
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // 일관된 폰트 렌더링을 위한 설정
        launchOptions: {
          args: [
            "--font-render-hinting=none",
            "--disable-font-subpixel-positioning",
          ],
        },
      },
    },
  ],
});
```

#### 8.1.2 테스트 헬퍼 (플래키 가드)

```typescript
// packages/specs/tests/visual/helpers.ts

import { Page } from "@playwright/test";

/**
 * 폰트 로딩 대기
 */
export async function waitForFonts(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    // 추가 대기 (폰트 렌더링 완료)
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
}

/**
 * 애니메이션 완료 대기
 */
export async function waitForAnimations(page: Page): Promise<void> {
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      // CSS 애니메이션 완료 대기
      const animations = document.getAnimations();
      if (animations.length === 0) {
        resolve();
        return;
      }
      Promise.all(animations.map((a) => a.finished)).then(() => resolve());
    });
  });
}

/**
 * CanvasKit 렌더링 완료 대기 (waitForPixiRender 대체)
 * __canvasKitReady 플래그: SkiaRenderer 초기화 완료 시
 * SkiaOverlay.tsx에서 window.__canvasKitReady = true 설정
 */
export async function waitForCanvasKitRender(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as any).__canvasKitReady === true);
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await page.waitForTimeout(100); // 폰트 로드 등 안정화
}

/**
 * 안정적인 스크린샷 촬영
 */
export async function stableScreenshot(
  page: Page,
  selector: string,
): Promise<Buffer> {
  await waitForFonts(page);
  await waitForAnimations(page);

  const element = page.locator(selector);
  await element.waitFor({ state: "visible" });

  // 레이아웃 안정화 대기
  await page.waitForTimeout(50);

  return element.screenshot({
    animations: "disabled",
    caret: "hide",
  });
}
```

#### 8.1.3 테스트 코드 — React ↔ CanvasKit 비교

> **구현 상태:** `waitForCanvasKitRender` 및 Playwright 비주얼 리그레션 테스트 구축 예정.
> 상세: `docs/RENDERING_ARCHITECTURE.md` Phase 5.3 참조

```typescript
// packages/specs/tests/visual/button.test.ts

import { test, expect } from "@playwright/test";
import { ButtonSpec } from "../../src/components/Button.spec";
import {
  waitForFonts,
  waitForCanvasKitRender,
  stableScreenshot,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important;
      transition-duration: 0s !important;
    }`,
  });
});

test.describe("Button Visual Regression", () => {
  const variants = Object.keys(ButtonSpec.variants);
  const sizes = Object.keys(ButtonSpec.sizes);

  for (const variant of variants) {
    for (const size of sizes) {
      test(`Button ${variant}/${size} matches snapshot`, async ({ page }) => {
        // React 버전 캡처
        await page.goto(`/storybook/button?variant=${variant}&size=${size}`);
        await waitForFonts(page);
        const reactScreenshot = await stableScreenshot(
          page,
          ".react-aria-Button",
        );

        // CanvasKit 버전 캡처
        await page.goto(
          `/builder-preview/button?variant=${variant}&size=${size}`,
        );
        await waitForCanvasKitRender(page);
        const canvasKitScreenshot = await stableScreenshot(
          page,
          "canvas[data-skia-overlay]",
        );

        // 스냅샷 비교 (React ↔ CanvasKit 최대 1% 차이 허용)
        expect(reactScreenshot).toMatchSnapshot(
          `button-${variant}-${size}-react.png`,
        );
        expect(canvasKitScreenshot).toMatchSnapshot(
          `button-${variant}-${size}-skia.png`,
        );
      });
    }
  }
});
```

```typescript
// CanvasKit 캔버스 캡처
async function captureCanvasKit(page: Page): Promise<Buffer> {
  return page.locator("canvas[data-skia-overlay]").screenshot();
}
```

### 8.1.4 Spec Shape ↔ CanvasKit API 매핑

각 Spec Shape 타입과 CanvasKit API의 1:1 매핑 참조.

> 상세: `docs/RENDERING_ARCHITECTURE.md` Phase 6.3 참조

| Spec Shape       | CanvasKit Canvas API (현재)                                                    | Skia Paint/Path                  | 레거시 PixiJS           | 비고                 |
| ---------------- | ------------------------------------------------------------------------------ | -------------------------------- | ----------------------- | -------------------- |
| `RectShape`      | `canvas.drawRect()` / `canvas.drawRRect()`                                     | `Paint` + `RRect`                | ~~`graphics.rect()`~~   | radius 있으면 RRect  |
| `CircleShape`    | `canvas.drawCircle()`                                                          | `Paint`                          | ~~`graphics.circle()`~~ | cx, cy, r            |
| `TextShape`      | `canvas.drawParagraph()`                                                       | `ParagraphBuilder` → `Paragraph` | ~~`new Text()`~~        | Phase 5에서 통합     |
| `ShadowShape`    | `ImageFilter.MakeDropShadow()`                                                 | `canvas.saveLayer(paint)`        | ~~별도 처리~~           | Phase 5에서 통합     |
| `BorderShape`    | `canvas.drawRRect()` (stroke)                                                  | `Paint.setStyle(Stroke)`         | ~~`graphics.stroke()`~~ | strokeAlignment 추가 |
| `GradientShape`  | `Shader.MakeLinearGradient()` / `MakeRadialGradient()` / `MakeSweepGradient()` | `Paint.setShader()`              | ~~`graphics.fill()`~~   | angular = Sweep      |
| `ImageShape`     | `canvas.drawImageRect()`                                                       | `Image` + `Paint`                | ~~`Sprite`~~            | fit/fill/crop        |
| `ContainerShape` | `canvas.save()` / `canvas.clipRect()` / `canvas.restore()`                     | clip + children 재귀             | ~~`Container`~~         | overflow clipping    |

**Fill + Stroke 분리 패턴 (CanvasKit):**

```typescript
// CanvasKit은 fill과 stroke를 별도 Paint로 분리 렌더링
function renderRectShape(
  canvas: Canvas,
  shape: RectShape,
  ck: CanvasKit,
): void {
  const rrect = ck.RRectXY(
    ck.LTRBRect(
      shape.x,
      shape.y,
      shape.x + shape.width,
      shape.y + shape.height,
    ),
    shape.radius ?? 0,
    shape.radius ?? 0,
  );

  // 1. Fill
  const fillPaint = new ck.Paint();
  fillPaint.setStyle(ck.PaintStyle.Fill);
  fillPaint.setColor(cssColorToSkiaColor(shape.fill, ck));
  canvas.drawRRect(rrect, fillPaint);
  fillPaint.delete();

  // 2. Stroke (border가 있는 경우)
  if (shape.borderWidth) {
    const strokePaint = new ck.Paint();
    strokePaint.setStyle(ck.PaintStyle.Stroke);
    strokePaint.setStrokeWidth(shape.borderWidth);
    strokePaint.setColor(cssColorToSkiaColor(shape.borderColor, ck));
    canvas.drawRRect(rrect, strokePaint);
    strokePaint.delete();
  }
}
```

### 8.2 성능 최적화

```typescript
// packages/specs/src/renderers/PixiRenderer.ts

// 캐싱 추가
const variantColorCache = new Map<string, VariantColors>();
const sizePresetCache = new Map<string, SizePreset>();

export function getVariantColors(
  variantSpec: VariantSpec,
  theme: "light" | "dark",
): VariantColors {
  const cacheKey = `${JSON.stringify(variantSpec)}-${theme}`;

  if (variantColorCache.has(cacheKey)) {
    return variantColorCache.get(cacheKey)!;
  }

  const colors = computeVariantColors(variantSpec, theme);
  variantColorCache.set(cacheKey, colors);

  return colors;
}

// 테마 변경 시 캐시 무효화
export function invalidateCache(): void {
  variantColorCache.clear();
  sizePresetCache.clear();
}
```

#### 8.2.1 CanvasKit/Skia 최적화 (현재)

상세: `docs/RENDERING_ARCHITECTURE.md` Phase 5.5, 6.1-6.2 참조

**이중 Surface 캐싱 + Frame Classification:**

```
Frame Classification (SkiaRenderer.ts):
  idle        → 변경 없음, 렌더링 스킵
  present     → 오버레이만 변경, snapshot blit + 오버레이 렌더
  camera-only → 줌/팬만 변경, snapshot 아핀 blit + 오버레이 렌더 (<2ms)
  content     → 요소 변경, 컨텐츠 전체 재렌더 + present (~8-16ms)
  full        → 첫 프레임/리사이즈/cleanup, 컨텐츠 전체 재렌더 + present
```

**이중 Surface 구조:**

```
Main Surface (화면 표시용)
  ↕ 더블 버퍼링
Offscreen Surface (변경 사항 렌더링)
  → 디자인 컨텐츠 전체 렌더 → snapshot 캐시
  → present 단계에서 Main Surface로 blit + 오버레이 별도 렌더
```

| 전략           | 설명                                  | CanvasKit API                                      | 구현 상태                                                                |
| -------------- | ------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------ |
| 이중 Surface   | 렌더링 중 화면 깜빡임 방지            | `MakeWebGLCanvasSurface` + `Surface.makeSurface()` | ✅ SkiaRenderer.ts                                                       |
| 2-pass present | 컨텐츠 캐시(snapshot) + 오버레이 분리 | `makeImageSnapshot()` + `drawImage()`              | ✅ SkiaRenderer.ts                                                       |
| Paint 재사용   | 동일 스타일 Paint 객체 캐싱           | `new CanvasKit.Paint()` + Map 캐시                 | ⚠️ 미구현 (인라인 생성)                                                  |
| Font 캐시      | 폰트 로드 결과 캐싱                   | `CanvasKit.Typeface` + Map 캐시                    | ✅ fontManager.ts                                                        |
| Paragraph 캐시 | 텍스트 shaping/layout 결과 캐싱       | `ParagraphBuilder` → `Paragraph`                   | ✅ 구현 (LRU 500, 폰트 교체/페이지 전환/HMR 무효화) — `nodeRenderers.ts` |

```typescript
// CanvasKit 2-pass present 개념 예시
function presentFrame(canvas: Canvas, snapshot: Image): void {
  // 1) 컨텐츠 스냅샷 blit (camera-only는 아핀 변환 포함)
  canvas.drawImage(snapshot, 0, 0);
  // 2) 오버레이(Selection/AI 등) 별도 렌더
  renderOverlay(canvas);
  // 3) flush
}
```

### 8.3 번들 크기 최적화

```typescript
// packages/specs/src/index.ts

// Tree-shaking을 위한 개별 export
export { ButtonSpec } from "./components/Button.spec";
export { TextFieldSpec } from "./components/TextField.spec";
// ... 개별 export

// 타입만 export (번들에 포함 안 됨)
export type { ComponentSpec, Shape, TokenRef } from "./types";
```

### 8.4 Phase 5 체크리스트

**CanvasKit/Skia 렌더링 인프라 (완료):**

- [x] CanvasKit WASM 초기화 (`initCanvasKit.ts`)
- [x] SkiaRenderer 구현 — Phase 5 single Surface (`SkiaRenderer.ts`)
- [x] SkiaRenderer 구현 — Phase 6 2-pass dual Surface + present + 오버레이 분리 (`SkiaRenderer.ts`)
- [x] nodeRenderers 구현 — renderBox, renderText, renderImage (`nodeRenderers.ts`)
- [x] Fill 시스템 — 6종 (Color, Linear/Radial/Angular/MeshGradient, Image) (`fills.ts`)
- [x] Effect 파이프라인 — saveLayer 기반 (Opacity, Blur, DropShadow) (`effects.ts`)
- [x] Font 로딩/캐싱 (`fontManager.ts`)
- [x] SkiaOverlay + PixiJS 이벤트 유지 (EventBoundary 기반, 브릿지 불필요) (`SkiaOverlay.tsx`)

**테스트 및 최적화 (진행 중):**

- [ ] Visual Regression Test 설정 (Playwright + CanvasKit 캡처)
- [ ] 모든 컴포넌트 스냅샷 생성
- [ ] React ↔ CanvasKit 비교 자동화
- [ ] 성능 프로파일링
- [ ] Paint 캐시 최적화 (현재 인라인 생성)
- [x] Paragraph 캐시 최적화 (LRU 캐시 + 무효화 정책 반영)
- [ ] 번들 크기 분석 및 최적화
- [ ] 문서화 완료

## 9. Phase 6: Spec Shapes → Skia 렌더링 파이프라인

> **상태**: ✅ 구현 완료 (2026-02-12)
> **목표**: ComponentSpec `shapes()` → SkiaNodeData 변환으로 75개 UI 컴포넌트 정확한 Skia 렌더링

### 9.1 배경

Phase 5까지 CanvasKit/Skia 이중 렌더러 인프라가 완성되었지만, Card를 제외한 모든 UI 컴포넌트가
`ElementSprite.tsx`의 텍스트-전용 fallback으로만 렌더링되고 있었다.
각 ComponentSpec의 `render.shapes()` 함수는 모든 시각적 도형을 `Shape[]` 배열로 반환하므로,
이를 `SkiaNodeData`로 변환하면 별도의 컴포넌트별 렌더링 코드 없이 모든 UI 컴포넌트를 정확히 렌더링할 수 있다.

### 9.2 렌더링 파이프라인

```
ComponentSpec.render.shapes(props, variant, size, state)
  → Shape[] (roundRect, rect, circle, line, border, text, shadow, icon_font, ...)
    → specShapesToSkia() 변환기
      → SkiaNodeData { type:'box'|'line'|'text'|'container'|'icon_path', children: [...] }
        → nodeRenderers.ts renderNode()
          → CanvasKit Canvas API 호출
```

### 9.3 구현 내용

#### 9.3.1 nodeRenderers.ts — line 타입 추가

`SkiaNodeData`에 `'line'` 타입 추가. 체크마크, 구분선 등 line shape 렌더링 지원.

```typescript
// SkiaNodeData.type 확장
type: 'box' | 'text' | 'image' | 'container' | 'line' | 'icon_path' | 'partial_border'

// line 전용 데이터
line?: {
  x1: number; y1: number;
  x2: number; y2: number;
  strokeColor: Float32Array;
  strokeWidth: number;
};
```

#### 9.3.2 specShapeConverter.ts — Shape[] → SkiaNodeData 변환기

| Shape Type  | → SkiaNodeData                                                              |
| ----------- | --------------------------------------------------------------------------- |
| `roundRect` | `type:'box'`, `box:{ fillColor, borderRadius }`                             |
| `rect`      | `type:'box'`, `box:{ fillColor, borderRadius:0 }`                           |
| `circle`    | `type:'box'`, 정사각형 `width=height=radius*2`, `borderRadius=radius`       |
| `line`      | `type:'line'`, `line:{ x1,y1,x2,y2,strokeColor,strokeWidth }`               |
| `border`    | target Shape의 `box.strokeColor/strokeWidth` 설정                           |
| `text`      | `type:'text'`, `text:{ content, fontSize, color, ... }`                     |
| `shadow`    | target Shape의 `effects[]`에 DropShadowEffect 추가                          |
| `gradient`  | target Shape의 `box.fills[]`에 LinearGradient/RadialGradient Shader 추가    |
| `icon_font` | `type:'icon_path'`, `getIconData()`로 SVG 경로 조회 → CanvasKit Path 렌더링 |

색상 해석: `Shape.fill` (ColorValue = TokenRef | string | number) → `resolveColor(fill, theme)` → `Float32Array[r,g,b,a]`

#### 9.3.3 ElementSprite.tsx — spec shapes 통합

- `getSpecForTag(tag)`: 75개 태그 → ComponentSpec 매핑 함수
- `rearrangeShapesForColumn()`: row 좌표 shapes를 column 배치로 변환
- spec 렌더링 블록: shapes → specShapesToSkia → Skia 렌더 데이터 적용
- 수직 중앙 정렬: `specNode.y = Math.round((finalHeight - specHeight) / 2)`

#### 9.3.4 레이아웃 통합

Body의 `display: 'block'` → TaffyBlockEngine 경로에서의 폼 컨트롤 크기 계산:

| 파일               | 변경                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `engines/utils.ts` | `enrichWithIntrinsicSize()`: leaf UI 컴포넌트 intrinsic 크기 주입 (Taffy Flex/Block 공용)                                |
| `engines/utils.ts` | `calculateContentHeight`/`Width`: INLINE_FORM 테이블 기반 크기 계산                                                      |
| `engines/utils.ts` | `INLINE_FORM_INDICATOR_WIDTHS` switch/toggle 값 수정 (26/34/42 → 36/44/52) + `INLINE_FORM_GAPS` 테이블 신규 추가 (v3.10) |

### 9.4 flexDirection:column 지원

> 레이아웃 엔진 관련 — §4.7.4 CSS 단위 규칙 및 [ADR-008: 레이아웃 엔진](./adr/008-layout-engine.md) 참조.

Spec `shapes()` 함수는 항상 row 레이아웃 좌표를 생성. column 지원을 위한 3단계 변환:

1. **shapes 좌표 변환** (`rearrangeShapesForColumn`): indicator 중앙 배치, text를 indicator 아래로 이동
2. **크기 계산** (`engines/utils.ts`의 `enrichWithIntrinsicSize()`): column → height = indicator + gap + textLineHeight, width = max(indicator, textWidth)
3. **BlockEngine 동기화** (`engines/utils.ts`): 동일한 column 크기 계산을 TaffyBlockEngine 경로에도 적용

### 9.5 수정 파일 목록

| 파일                             | 변경 내용                                                                        |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `skia/nodeRenderers.ts`          | `SkiaNodeData` line 타입 + `renderLine()`                                        |
| `skia/specShapeConverter.ts`     | **신규** — Shape[] → SkiaNodeData 변환기                                         |
| `skia/aiEffects.ts`              | borderRadius 튜플 타입 호환                                                      |
| `sprites/ElementSprite.tsx`      | getSpecForTag, spec 렌더링, column 재배치                                        |
| `layout/engines/utils.ts`        | enrichWithIntrinsicSize + calculateContentHeight/Width 폼 컨트롤 + flexDirection |
| `types/builder/unified.types.ts` | Checkbox/Radio/Switch 기본 props                                                 |

### 9.6 props.style 오버라이드 패턴 (2026-02-12)

모든 75개 ComponentSpec의 `render.shapes()`에 인라인 스타일 우선 참조 패턴을 적용:

**참조 구현 (Button.spec.ts):**

```typescript
shapes: (props, variant, size, state = "default") => {
  // props.style 우선, 없으면 spec 기본값
  const bgColor =
    props.style?.backgroundColor ??
    (state === "hover"
      ? variant.backgroundHover
      : state === "pressed"
        ? variant.backgroundPressed
        : variant.background);

  const textColor = props.style?.color ?? variant.text;
  const borderRadius = props.style?.borderRadius ?? size.borderRadius;
  const borderWidth = props.style?.borderWidth ?? 1;
  const paddingX =
    props.style?.paddingLeft ?? props.style?.padding ?? size.paddingX;

  return [
    {
      id: "bg",
      type: "roundRect",
      width: "auto",
      height: "auto", // ← 레이아웃 엔진 높이 사용
      fill: bgColor,
      radius: borderRadius,
      fillAlpha: variant.backgroundAlpha ?? 1,
    },
    {
      type: "border",
      target: "bg",
      borderWidth,
      color: props.style?.borderColor ?? variant.border,
    },
    {
      type: "text",
      x: paddingX,
      fontSize: props.style?.fontSize ?? size.fontSize,
      fontWeight: props.style?.fontWeight ?? 500,
      fontFamily: props.style?.fontFamily ?? fontFamily.sans,
      fill: textColor,
      align: props.style?.textAlign ?? "center",
      baseline: "middle",
    },
  ];
};
```

**우선순위 규칙:**

| 속성        | 1순위 (inline)                 | 2순위 (state)                     | 3순위 (default)      |
| ----------- | ------------------------------ | --------------------------------- | -------------------- |
| 배경색      | `props.style?.backgroundColor` | `variant.backgroundHover/Pressed` | `variant.background` |
| 텍스트색    | `props.style?.color`           | `variant.textHover`               | `variant.text`       |
| 테두리색    | `props.style?.borderColor`     | `variant.borderHover`             | `variant.border`     |
| 모서리 반경 | `props.style?.borderRadius`    | —                                 | `size.borderRadius`  |
| 테두리 두께 | `props.style?.borderWidth`     | —                                 | `1`                  |
| 폰트 크기   | `props.style?.fontSize`        | —                                 | `size.fontSize`      |
| 폰트 굵기   | `props.style?.fontWeight`      | —                                 | `500`                |
| 폰트 패밀리 | `props.style?.fontFamily`      | —                                 | `fontFamily.sans`    |
| 텍스트 정렬 | `props.style?.textAlign`       | —                                 | `'center'`           |
| 패딩        | `props.style?.padding*`        | —                                 | `size.paddingX`      |

**ElementSprite 통합:**

| 항목                     | 수정 전                                                     | 수정 후                                                     |
| ------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------- |
| **배경 roundRect**       | `height: size.height` (고정)                                | `height: 'auto'` (엔진 계산 높이)                           |
| **배경 roundRect width** | `props.style?.width \|\| 'auto'`                            | `'auto' as const` (9개 spec 수정)                           |
| **specHeight**           | `Math.min(sizeSpec.height, finalHeight)`                    | `finalHeight` (항상 엔진 계산값)                            |
| **MIN_BUTTON_HEIGHT**    | 24px 최소값 제한                                            | 제거 (PixiButton.tsx)                                       |
| **gradient fill**        | spec shapes가 `boxData.fill` 클리어 → 소실                  | `boxData.fill → specNode.box.fill` 이전 후 클리어           |
| **effectiveElement %**   | `(parseFloat(w) / 100) * computedContainerSize` (이중 적용) | `computedContainerSize.width` 직접 사용                     |
| **텍스트 줄바꿈 높이**   | specHeight 고정 (텍스트 줄바꿈 무시)                        | `measureSpecTextMinHeight()` → `contentMinHeight` 자동 확장 |
| **updateTextChildren**   | box 자식 미처리 (return child)                              | box 자식 재귀: width/height 갱신 + 내부 text 처리           |

**specShapeConverter 개선:**

| 항목            | 변경                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------ |
| 텍스트 maxWidth | `shape.x > 0`일 때 자동 감소: center → `containerWidth - x*2`, left/right → `containerWidth - x` |
| safety clamp    | `maxWidth < 1`이면 `containerWidth`로 폴백 (padding=0 안전 처리)                                 |

**상세:** `packages/specs/src/components/*.spec.ts` (75개), `apps/builder/src/.../sprites/ElementSprite.tsx`, `apps/builder/src/.../skia/specShapeConverter.ts`, `apps/builder/src/.../ui/PixiButton.tsx`

### 9.7 ComponentDefinition 재귀 확장 및 TagGroup CONTAINER_TAGS 전환 (2026-02-13)

#### 9.7.1 ChildDefinition 재귀 타입

기존 `ComponentDefinition`의 children은 2-level 구조(parent + flat children)만 지원했다.
TagGroup처럼 3-level 이상의 계층(TagGroup → TagList → Tag)이 필요한 컴포넌트를 위해
`ChildDefinition` 타입에 재귀적 `children` 필드를 추가했다.

**변경 전 (2-level):**

```typescript
// 기존: children은 Element와 동일 구조, 중첩 불가
export interface ComponentDefinition {
  tag: string;
  parent: Omit<Element, "id" | "created_at" | "updated_at">;
  children: Omit<Element, "id" | "created_at" | "updated_at" | "parent_id">[];
}
```

**변경 후 (무한 중첩):**

```typescript
// apps/builder/src/builder/factories/types/index.ts

/**
 * 자식 요소 정의 (재귀적 중첩 지원)
 */
export type ChildDefinition = Omit<
  Element,
  "id" | "created_at" | "updated_at" | "parent_id"
> & {
  children?: ChildDefinition[];
};

export interface ComponentDefinition {
  tag: string;
  parent: Omit<Element, "id" | "created_at" | "updated_at">;
  children: ChildDefinition[];
}
```

**핵심 포인트:**

- `children?: ChildDefinition[]` — optional 재귀 필드로 무한 중첩 가능
- `parent_id` 제외 — Factory가 생성 시 자동 할당 (부모 Element의 id)
- `id`, `created_at`, `updated_at` 제외 — Factory가 자동 생성

#### 9.7.2 Factory createElementsFromDefinition 재귀 생성

`createElementsFromDefinition()` 함수에 `processChildren()` 재귀 함수를 추가하여
중첩된 `ChildDefinition[]`을 일괄 처리한다.

```typescript
// apps/builder/src/builder/factories/utils/elementCreation.ts

export function createElementsFromDefinition(definition: ComponentDefinition): {
  parent: Element;
  children: Element[];
} {
  const store = useStore.getState();
  const currentElements = store.elements;

  // 부모 요소 생성
  const parent: Element = {
    ...definition.parent,
    id: ElementUtils.generateId(),
    customId: generateCustomId(definition.parent.tag, currentElements),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 자식 요소들 재귀 생성 (중첩 children 지원)
  const allElementsSoFar = [...currentElements, parent];
  const allChildren: Element[] = [];

  function processChildren(
    childDefs: ChildDefinition[],
    parentId: string,
  ): void {
    childDefs.forEach((childDef) => {
      const { children: nestedChildren, ...elementDef } = childDef;
      const child: Element = {
        ...elementDef,
        id: ElementUtils.generateId(),
        customId: generateCustomId(elementDef.tag, allElementsSoFar),
        parent_id: parentId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      allChildren.push(child);
      allElementsSoFar.push(child);

      // 중첩 children 재귀 처리
      if (nestedChildren && nestedChildren.length > 0) {
        processChildren(nestedChildren, child.id);
      }
    });
  }

  processChildren(definition.children, parent.id);

  return { parent, children: allChildren };
}
```

**`allElementsSoFar` 배열의 역할:**

| 단계                       | 배열 상태                      | 목적                       |
| -------------------------- | ------------------------------ | -------------------------- |
| 초기화                     | `[...currentElements, parent]` | 기존 페이지 요소 + 새 부모 |
| 자식 생성 시               | `.push(child)`                 | 새 자식 추가               |
| `generateCustomId` 호출 시 | 전체 참조                      | customId 중복 방지         |

- `generateCustomId(tag, allElementsSoFar)`는 기존 요소의 customId와 충돌하지 않는 고유 ID를 생성한다.
- 재귀 처리 중에도 `allElementsSoFar`에 즉시 추가하여 같은 tag의 형제/사촌 간 customId 충돌을 방지한다.

#### 9.7.3 TagGroup → CONTAINER_TAGS 전환 사례

TagGroup은 기존에 `TAG_SPEC_MAP`에 등록된 전용 렌더러(`PixiTagGroup.tsx`)를 사용했다.
이를 `CONTAINER_TAGS` 기반의 범용 BoxSprite 컨테이너로 전환하여, 웹 CSS와 동일한 계층 구조를 달성했다.

**웹 CSS 구조 (3-level 계층):**

```
TagGroup (display: flex, flex-direction: column, gap: 2)
├── Label ("Tag Group", fontSize: 12, fontWeight: 500)
└── TagList (display: flex, flex-direction: row, flex-wrap: wrap, gap: 4)
    ├── Tag ("Tag 1")
    └── Tag ("Tag 2")
```

**Factory 정의 (재귀 children 활용):**

```typescript
// apps/builder/src/builder/factories/definitions/GroupComponents.ts

return {
  tag: "TagGroup",
  parent: {
    tag: "TagGroup",
    props: {
      label: "Tag Group",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 2,
        width: "fit-content",
      },
    },
    ...ownerFields,
    parent_id: parentId,
    order_num: orderNum,
  },
  children: [
    {
      tag: "Label",
      props: {
        children: "Tag Group",
        style: { fontSize: 12, fontWeight: 500 },
      },
      ...ownerFields,
      order_num: 1,
    },
    {
      tag: "TagList",
      props: {
        style: {
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 4,
        },
      },
      ...ownerFields,
      order_num: 2,
      children: [
        // ← 재귀적 중첩
        {
          tag: "Tag",
          props: { children: "Tag 1" },
          ...ownerFields,
          order_num: 1,
        },
        {
          tag: "Tag",
          props: { children: "Tag 2" },
          ...ownerFields,
          order_num: 2,
        },
      ],
    },
  ],
};
```

**전환 전후 비교:**

| 항목             | 전환 전                                   | 전환 후                                  |
| ---------------- | ----------------------------------------- | ---------------------------------------- |
| **렌더링**       | `PixiTagGroup.tsx` (전용 Graphics 렌더링) | BoxSprite 기본 컨테이너 (CONTAINER_TAGS) |
| **TAG_SPEC_MAP** | TagGroup 등록                             | 제거 (spec shapes 미사용)                |
| **레이아웃**     | PixiTagGroup 내부 계산                    | Taffy flex layout (TaffyFlexEngine)      |
| **구조**         | 2-level (parent + flat children)          | 3-level (TagGroup → TagList → Tag)       |
| **CSS 동기화**   | 수동 동기화                               | props.style로 직접 적용                  |

**레이아웃 기본값 (props.style로 적용):**

```typescript
// TagGroup: 기본 flex column 레이아웃 (Label + TagList 수직 배치)
// → props.style: { display: 'flex', flexDirection: 'column' }
// → TaffyFlexEngine이 Flex 레이아웃 계산

// TagList: 기본 flex row wrap 레이아웃 (Tags 가로 배치)
// → props.style: { display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 4 }
// → TaffyFlexEngine이 Flex 레이아웃 계산
```

**수정 파일:**

| 파일                                       | 변경                                        |
| ------------------------------------------ | ------------------------------------------- |
| `factories/types/index.ts`                 | `ChildDefinition` 재귀 타입 추가            |
| `factories/utils/elementCreation.ts`       | `processChildren()` 재귀 생성 함수          |
| `factories/definitions/GroupComponents.ts` | TagGroup 3-level 정의 (재귀 children)       |
| `sprites/ElementSprite.tsx`                | TAG_SPEC_MAP에서 TagGroup/TagList 제거      |
| `ui/PixiTagGroup.tsx`                      | 특수 렌더러 사용 중단 (CONTAINER_TAGS 대체) |

### 9.8 CONTAINER_TAGS 계층 선택 (Drill-Down) 아키텍처 (2026-02-19)

#### 9.8.1 설계 원칙: 웹 컴포넌트 구조 = 캔버스 구조

모든 CONTAINER_TAGS 컴포넌트는 **웹 컴포넌트(Preview/Publish)의 DOM 계층과 캔버스(Builder)의 요소 계층이 1:1로 일치**해야 한다.
이 원칙이 지켜져야 Layer Tree 선택, Double-Click Drill-Down, 그리고 Preview↔Builder 시각적 일치가 보장된다.

```
설계 원칙:

Web (packages/shared/src/components/)     Canvas (Builder 요소 트리)
├── TagGroup                              ├── TagGroup (CONTAINER_TAG)
│   ├── Label                             │   ├── Label
│   ├── TagList                           │   ├── TagList (CONTAINER_TAG)
│   │   ├── Tag                           │   │   ├── Tag → BadgeSpec (Skia)
│   │   └── Tag                           │   │   └── Tag → BadgeSpec (Skia)
│   └── description                       │   └── (description은 props)
└── (CSS flex layout)                     └── (TaffyFlexEngine layout)
```

#### 9.8.2 계층 선택 메커니즘

**핵심 상태: `editingContextId`** (selection.ts)

```
editingContextId = null  → Body 직계 자식만 선택 가능 (루트 레벨)
editingContextId = "X"   → 요소 X의 직계 자식만 선택 가능 (컨테이너 내부)
```

**선택 흐름:**

```
[1] 클릭 → resolveClickTarget()로 현재 context 레벨의 대상 결정

    예: TagGroup > TagList > Tag를 클릭했을 때
    editingContextId = null → resolveClickTarget가 body 직계인 TagGroup 반환
    editingContextId = "TagGroup" → TagList 반환
    editingContextId = "TagList" → Tag 반환

[2] 더블클릭 → enterEditingContext()로 컨테이너 진입
    TagGroup 더블클릭 → editingContextId = TagGroup.id
    → 이제 Label, TagList 선택 가능

[3] Escape → exitEditingContext()로 상위 컨텍스트 복귀
    editingContextId = TagList → TagGroup
    editingContextId = TagGroup → null (루트)
```

**resolveClickTarget 알고리즘** (hierarchicalSelection.ts):

```typescript
// 클릭된 요소에서 부모 방향으로 올라가며 현재 context의 직계 자식을 찾는다
function resolveClickTarget(
  clickedId,
  editingContextId,
  elementsMap,
): string | null {
  let current = clickedId;
  while (current) {
    const el = elementsMap.get(current);
    if (editingContextId === null) {
      // 루트 레벨: parent가 body인 요소를 찾는다
      if (elementsMap.get(el.parent_id)?.tag === "body") return current;
    } else {
      // 컨테이너 내부: parent가 editingContextId인 요소를 찾는다
      if (el.parent_id === editingContextId) return current;
    }
    current = el.parent_id; // 부모로 올라감
  }
  return null;
}
```

**Layer Tree 동기화** (LayersSection.tsx):

Layer Tree에서 요소를 클릭하면 `editingContextId`가 자동으로 조정된다.
깊은 요소(예: Tag)를 선택하면 그 부모(TagList)가 editingContextId로 설정되어 Canvas에서도 동일 레벨이 활성화된다.

#### 9.8.3 캔버스 이벤트 처리 구조

```
CanvasKit Surface (z-index: 3)    ← 시각적 렌더링만 (pointerEvents: auto)
PixiJS Canvas (z-index: 4)        ← 이벤트 전용 (alpha=0, 보이지 않음)
  └── Camera Container (alpha=0)
      └── ElementSprite[]         ← 각각 eventMode="static" + onPointerDown
          └── 재귀적 자식 ElementSprite (컨테이너 내부)
```

- PixiJS 8 EventBoundary는 `alpha=0`을 prune 조건으로 사용하지 않음 → 히트 테스팅 유지
- 각 ElementSprite는 300ms 기반 더블클릭 감지 (handleContainerPointerDown)
- 컨테이너(`NON_CONTAINER_TAGS` 미포함, §9.13 opt-out 참조)의 자식은 `createContainerChildRenderer()`로 재귀 렌더링 → 각 자식이 독립 ElementSprite

#### 9.8.4 CONTAINER_TAGS 구조적 일관성 현황

| 컴포넌트              |     웹 컴포넌트     |  Factory   |             Renderer              |            Drill-Down            | 상태                            |
| --------------------- | :-----------------: | :--------: | :-------------------------------: | :------------------------------: | ------------------------------- |
| **TagGroup**          |         ✅          | ✅ 3-level |                ✅                 |                ✅                | ✅ 정상                         |
| **TagList**           |   (TagGroup 내부)   | ✅ (자식)  |                 —                 |                ✅                | ✅ 정상                         |
| **ToggleButtonGroup** |         ✅          |     ✅     |                ✅                 |                ✅                | ✅ 정상                         |
| **Card**              |         ✅          | ✅ 정의됨  |                ✅                 |                ✅                | ✅ 정상                         |
| **Panel**             |         ✅          | ❌ 미정의  |                ✅                 |                ✅                | ⚠️ Factory 필요                 |
| **Group**             |         ✅          |     ✅     |                ✅                 |                ✅                | ✅ 정상                         |
| **Form**              |         ✅          | ❌ 미정의  |                ❌                 |                ✅                | ⚠️ Factory + Renderer 필요      |
| **Dialog**            |         ✅          | ❌ 미정의  |                ❌                 |                ✅                | ⚠️ Factory + Renderer 필요      |
| **Modal**             |         ✅          | ❌ 미정의  |              ⚠️ div               |                ✅                | ⚠️ Factory + Renderer 수정 필요 |
| **Disclosure**        |         ✅          | ❌ 미정의  |                ❌                 |                ✅                | ⚠️ Factory + Renderer 필요      |
| **DisclosureGroup**   |         ✅          | ❌ 미정의  |                ❌                 |                ✅                | ⚠️ Factory + Renderer 필요      |
| **Accordion**         | (= DisclosureGroup) |     ❌     |                ❌                 |                ✅                | ⚠️ DisclosureGroup 별칭         |
| **Tabs**              |         ✅          |     ✅     |                ✅                 |                ✅                | ✅ 완전 지원 (컨테이너 패턴)    |
| **Breadcrumbs**       |         nav         |    flex    | `_crumbs` 주입 (자식 텍스트 배열) | `filteredContainerChildren = []` | ✅ 정상 (CONTAINER_TAGS 전환)   |
| **Box**               |    (= Card 별칭)    |     ❌     |                ❌                 |                ✅                | ⚠️ Card Factory 재사용          |

> **Note**: Drill-Down 자체는 CONTAINER_TAGS 등록만으로 작동한다 (`enterEditingContext` + `createContainerChildRenderer`).
> Factory/Renderer 미비는 **초기 요소 생성과 Preview 렌더링**에만 영향을 준다.

#### 9.8.5 웹 컴포넌트 구조 동일성 가이드라인

새 CONTAINER_TAG 컴포넌트 추가 시 반드시 아래 체크리스트를 따른다:

**필수 체크리스트:**

- [ ] **1. 웹 컴포넌트 구조 분석**: `packages/shared/src/components/XXX.tsx`의 JSX 계층 확인
- [ ] **2. Factory 정의**: `factories/definitions/`에 웹 컴포넌트와 **동일한 자식 계층** 생성
  ```typescript
  // 예: Disclosure의 경우
  createDisclosureDefinition() → {
    tag: 'Disclosure',
    children: [
      { tag: 'Heading', children: [{ tag: 'Button', props: { children: 'Trigger' } }] },
      { tag: 'DisclosurePanel', children: [{ tag: 'p', props: { children: 'Content' } }] },
    ]
  }
  ```
- [ ] **3. 컨테이너 확인**: `BuilderCanvas.tsx`의 `NON_CONTAINER_TAGS`에 포함되지 않는지 확인 (§9.13 opt-out 전환)
- [ ] **4. Default Props**: `unified.types.ts`에 `createDefaultXXXProps()` 추가 (display, layout 기본값)
- [ ] **5. Renderer 등록**: `packages/shared/src/renderers/`에서 children 렌더링 지원
- [ ] **6. Spec 등록 (leaf일 경우)**: `TAG_SPEC_MAP`에 매핑 (컨테이너는 등록하지 않음)
- [ ] **7. Drill-Down 테스트**: 클릭→컨테이너 선택, 더블클릭→자식 선택, Escape→상위 복귀

**전환 완료 컴포넌트 (CONTAINER_TAGS 등록 완료):**

- [x] **TagGroup** — 3-level 계층 (TagGroup > Label + TagList > Tag×N), TaffyFlexEngine
- [x] **Tabs** — 컨테이너 패턴, Panel 필터링, paddingTop=tabBar+padding
- [x] **Breadcrumbs** — nav/flex, `_crumbs` 주입 (자식 텍스트 배열), `filteredContainerChildren = []`
- [x] **Calendar** — Compositional (Calendar > CalendarHeader + CalendarGrid), `_hasChildren` 2단계 평가
- [x] **DatePicker** — Compositional (DatePicker > DateField + Calendar > CalendarHeader + CalendarGrid), TRANSPARENT_CONTAINER_TAGS 등록, Factory nested children
- [x] **ComboBox** — child specs (ComboBoxInput, ComboBoxTrigger), TAG_SPEC_MAP 등록, NON_CONTAINER_TAGS 등록
- [x] **Select** — child specs (SelectValue, SelectIcon, SelectTrigger), TAG_SPEC_MAP 등록, NON_CONTAINER_TAGS 등록

**구조 동일성 원칙:**

```
규칙 1: 웹 컴포넌트의 JSX children 계층 = Factory의 children 계층
규칙 2: 컨테이너 → NON_CONTAINER_TAGS 미포함 + display 기본값 (flex/block) (§9.13 opt-out 전환)
규칙 3: 리프 UI → TAG_SPEC_MAP + ComponentSpec (Skia 렌더링)
규칙 4: 컨테이너의 레이아웃 = 웹 CSS와 동일 (TaffyFlexEngine/TaffyBlockEngine)
규칙 5: Layer Tree 선택 = Canvas Drill-Down 선택 (editingContextId 동기화)
```

#### 9.8.6 Pixi UI 컴포넌트 Skia 전환 현황 (2026-02-19)

62개 Pixi UI 컴포넌트의 CanvasKit/Skia 전환 상태를 3등급으로 분류한다.

**A등급 — 전환 완료 (12개)**: 투명 히트 영역 + 이벤트만. WebGL 드로잉 코드 제거됨.

| 컴포넌트         | 줄 수 | 설명                                  |
| ---------------- | ----: | ------------------------------------- |
| PixiButton       |   130 | `LayoutComputedSizeContext` 히트 영역 |
| PixiFancyButton  |   172 | 히트 영역 전용                        |
| PixiToggleButton |   135 | 히트 영역 전용                        |
| PixiSlider       |   124 | 히트 영역 전용                        |
| PixiBadge        |   145 | 히트 영역 전용                        |
| PixiCheckboxItem |   100 | 히트 영역 전용 (그룹 내 자식)         |
| PixiRadioItem    |   100 | 히트 영역 전용 (그룹 내 자식)         |
| PixiProgressBar  |   135 | 히트 영역 전용                        |
| PixiSelect       |   118 | 히트 영역 전용                        |
| PixiScrollBox    |    75 | 히트 영역 전용                        |
| PixiMaskedFrame  |    75 | 히트 영역 전용                        |
| PixiSeparator    |   196 | 히트 영역 전용                        |

**B등급 — 전환 필요 (47개)**: WebGL Graphics 드로잉 코드(g.roundRect, g.fill, TextStyle 등) 잔존.
Skia가 시각 렌더링을 담당하지만, 불필요한 PixiJS 드로잉이 남아있어 **A등급 패턴으로 재작성** 필요.

| 컴포넌트              | 줄 수 | Draw 호출 | TextStyle | 비고                                                                    |
| --------------------- | ----: | --------: | --------: | ----------------------------------------------------------------------- |
| PixiCard              |   339 |         4 |         2 | CONTAINER_TAG + 다중 텍스트                                             |
| PixiPanel             |   222 |         3 |         2 | CONTAINER_TAG                                                           |
| PixiDialog            |   262 |        17 |         — | backdrop + title + content                                              |
| PixiDisclosure        |   219 |         9 |         — | header + content                                                        |
| PixiDisclosureGroup   |   323 |        11 |         — | 복합 아코디언                                                           |
| PixiColorPicker       |   315 |        25 |         — | 최다 Draw — 완전 재작성                                                 |
| PixiToast             |   218 |        23 |         — | 복합 UI                                                                 |
| PixiSkeleton          |   211 |        22 |         — | 다중 레이어                                                             |
| PixiDatePicker        |   296 |        16 |         — | 캘린더 + 입력                                                           |
| PixiPopover           |   220 |        16 |         — | backdrop + 말풍선                                                       |
| PixiToolbar           |   166 |        15 |         — | 다중 버튼                                                               |
| PixiDateRangePicker   |   349 |        11 |         — | 2x 캘린더                                                               |
| PixiCalendar          |   347 |        10 |         — | 그리드 셀                                                               |
| PixiColorField        |   177 |        10 |         — | swatch + input                                                          |
| PixiSlot              |   288 |        10 |         — | placeholder 패턴                                                        |
| PixiComboBox          |   335 |         9 |         4 | input + dropdown                                                        |
| PixiDropZone          |   253 |         9 |         — | 점선 + 아이콘                                                           |
| PixiFileTrigger       |   148 |         8 |         — | 버튼 + 아이콘                                                           |
| PixiColorArea         |   162 |         8 |         — | 2D gradient                                                             |
| PixiColorSlider       |   184 |         8 |         — | track + thumb                                                           |
| PixiColorSwatchPicker |   154 |         8 |         — | 그리드                                                                  |
| PixiColorSwatch       |   129 |         7 |         — | 단일 swatch                                                             |
| PixiTooltip           |   163 |         8 |         — | 말풍선                                                                  |
| PixiSwitch            |   211 |         7 |         — | track + thumb                                                           |
| PixiColorWheel        |   174 |         5 |         — | 원형 gradient                                                           |
| PixiForm              |   144 |         7 |         — | CONTAINER_TAG                                                           |
| PixiInput             |   307 |         6 |         — | border + placeholder                                                    |
| PixiTextField         |   234 |         6 |         — | label + input                                                           |
| PixiTextArea          |   201 |         5 |         — | multiline input                                                         |
| PixiGroup             |   182 |         6 |         — | CONTAINER_TAG                                                           |
| PixiTable             |   392 |         8 |         4 | header + rows                                                           |
| PixiTree              |   355 |         6 |         3 | indent + nodes                                                          |
| PixiGridList          |   253 |         5 |         3 | header + cells                                                          |
| PixiNumberField       |   252 |         5 |         3 | input + spinner                                                         |
| PixiTimeField         |   191 |         5 |         — | segments                                                                |
| PixiDateField         |   173 |         5 |         — | segments                                                                |
| PixiMenu              |   333 |         4 |         4 | items + separators                                                      |
| PixiTabs              |   376 |         3 |         3 | tab bar + content                                                       |
| PixiSearchField       |   227 |         3 |         3 | input + icon                                                            |
| PixiBreadcrumbs       |   215 |         2 |         3 | items + separators ← **Skia spec shapes 전환 완료, 더 이상 사용 안 함** |
| PixiPagination        |   245 |         7 |         1 | 페이지 버튼                                                             |
| PixiMeter             |   281 |         2 |         2 | track + fill                                                            |
| PixiLink              |   184 |         0 |         1 | 텍스트만 (TextStyle)                                                    |
| PixiToggleButtonGroup |   346 |         1 |         1 | CONTAINER_TAG + children                                                |
| PixiCheckbox          |   225 |         2 |         1 | indicator + label                                                       |
| PixiCheckboxGroup     |   449 |         2 |         2 | children 반복                                                           |
| PixiRadio             |   441 |         2 |         2 | indicator + label                                                       |

**C등급 — Dead Code (1개)**: import 없음, 완전 대체됨.

| 컴포넌트     | 줄 수 | 상태                             |
| ------------ | ----: | -------------------------------- |
| PixiTagGroup |   310 | CONTAINER_TAGS로 대체, 삭제 대상 |

**미구현 — Pixi/Spec 미생성 (1개)**: 웹 컴포넌트만 존재, Canvas 구현 없음.

| 컴포넌트     | 웹 파일                                           | 구조                    | 비고                                                |
| ------------ | ------------------------------------------------- | ----------------------- | --------------------------------------------------- |
| Autocomplete | `packages/shared/src/components/Autocomplete.tsx` | SearchField + Menu 복합 | Pixi 파일, TAG_SPEC_MAP 모두 미등록. Phase 2에 추가 |

> **참고**: `Breadcrumb.tsx`는 `Breadcrumbs`의 하위 아이템 컴포넌트로 독립 등록 불필요 (Breadcrumbs 내부에서 사용).

**요약:**

| 등급          | 수량 | 총 줄 수 | 조치                  |
| ------------- | ---: | -------: | --------------------- |
| A (완료)      |   12 |   ~1,730 | 유지                  |
| B (전환 필요) |   47 |  ~11,700 | A등급 패턴으로 재작성 |
| C (Dead Code) |    1 |      310 | 삭제                  |

**A등급 목표 패턴 (PixiButton 참조):**

```typescript
// A등급: 투명 히트 영역 + 이벤트만 (Skia가 시각 렌더링 전담)
export const PixiXXX = memo(function PixiXXX({ element, onClick }: Props) {
  useExtend(PIXI_COMPONENTS);
  const computedSize = useContext(LayoutComputedSizeContext);
  const hitW = computedSize?.width ?? 0;
  const hitH = computedSize?.height ?? 0;

  const drawHitArea = useCallback((g: PixiGraphicsClass) => {
    g.clear();
    g.rect(0, 0, hitW, hitH);
    g.fill({ color: 0xffffff, alpha: 0 });
  }, [hitW, hitH]);

  const handleClick = useCallback((e: unknown) => {
    // modifier key 추출 후 onClick 호출
    onClick?.(element.id, extractModifiers(e));
  }, [element.id, onClick]);

  return (
    <pixiContainer>
      <pixiGraphics draw={drawHitArea} eventMode="static" cursor="pointer"
        onPointerDown={handleClick} />
    </pixiContainer>
  );
});
```

## 9.9 Tabs 컨테이너 렌더링 아키텍처

### 9.9.1 CSS Preview 구조 (정상 참조)

```
Tabs (348×166) display:flex flex-direction:column
├── TabList (348×30) flex row, border-bottom: 1px solid
│   ├── Tab "Tab 1" (66×29) pad=4px 16px
│   └── Tab "Tab 2" (68×29) pad=4px 16px
└── TabPanel (348×136) pad=16px
    └── Panel (316×104) flex column, border: 1px solid
```

### 9.9.2 WebGL Canvas 렌더링 구조

```
Tabs → ElementSprite (spec shapes: tab bar + indicator + 구분선)
├── Tab texts → spec shapes (Skia 렌더링)
├── Selection indicator → spec shapes (line, strokeWidth=3)
└── Panel → 컨테이너 시스템 (DirectContainer 배치)
    └── Panel spec shapes (배경 + 테두리 + 타이틀)
```

### 9.9.3 높이 계산 흐름

1. `enrichWithIntrinsicSize` → `calculateContentHeight(Tabs)`
2. Tabs: `tabBarHeight(30) + tabPanelPadding*2(32) + panelBorderBox`
3. Panel 재귀: `PANEL_HEIGHTS.md.withTitle = 104`
4. Total: `30 + 32 + 104 = 166px` (CSS와 일치)

### 9.9.4 핵심 패턴

- **effectiveElementWithTabs**: Tab 자식에서 `_tabLabels` 추출 → spec shapes에 동적 레이블
- **Panel 높이 케이스 위치**: `childElements` 블록 **밖** (Panel은 element tree에 자식 없음)
- **TokenRef fontSize**: `typeof === 'number'` 체크 후 height 기반 fallback 매핑
- **CONTAINER_TAGS 필터링**: `containerChildren.filter(c => c.tag === 'Panel')` → 활성 Panel만
- **BuilderCanvas paddingTop**: `tabBarHeight + tabPanelPadding` → Panel을 탭 바 아래 배치

---

## 9.10 Card 컨테이너 렌더링 아키텍처

### 9.10.1 Card element tree 구조

Card는 `display:flex`, `flexDirection:column` 컨테이너로, 자식 요소를 순서대로 배치합니다.
CSS Preview와 캔버스 렌더링이 동일한 element tree를 공유합니다.

```
Card (display:flex, flexDirection:column, padding:16px, gap:8px)
├── Heading  ("Card Title", fontSize:16, fontWeight:600)
└── Description  ("Card description text", fontSize:14)
```

- **Heading**: `TEXT_TAGS`에 포함된 태그로, TextSprite를 통해 Skia 텍스트 렌더링
- **Description**: v3.9 패치에서 `TEXT_TAGS`에 추가되어 TextSprite 렌더링 활성화
- **gap**: 자식 요소 사이의 수직 간격 (`gap:8px` 기본값)
- **padding**: Card 자체 내부 여백 (`padding:16px` 기본값)

### 9.10.2 TEXT_TAGS 확장 — Description 태그 추가

**배경**: Description 태그가 `TEXT_TAGS` 목록에 누락되어 있어 TextSprite 렌더링이 활성화되지 않고
plain container로 처리되었습니다.

**해결**: `TEXT_TAGS` 상수에 `'description'` 태그를 추가하여 Heading, Paragraph 등과 동일하게
TextSprite 렌더링 파이프라인을 거치도록 합니다.

```typescript
// engines/utils.ts 또는 canvas/constants.ts
export const TEXT_TAGS = new Set([
  "heading",
  "paragraph",
  // "label" — 제거됨 (2026-03-16): spec shapes 경로로 전환, §9.11 참조
  "span",
  "text",
  "description", // v3.9 추가 — Card 내 텍스트 자식 렌더링
]);
```

> **관련**: §9.3.1 nodeRenderers.ts TextShape 렌더링, §4.5 CanvasKit/Skia 렌더링 패턴, §9.11 Label spec shapes 경로

### 9.10.3 높이 계산 흐름

Card의 intrinsic 높이는 `enrichWithIntrinsicSize()` → `calculateContentHeight(Card)`를 통해 결정됩니다.

1. `enrichWithIntrinsicSize(Card)` 호출
2. `childElements`가 존재하면 자식 기준 계산 우선:
   - `Heading.intrinsicHeight + gap + Description.intrinsicHeight`
3. `childElements`가 없으면 스펙 기본값(`CARD_DEFAULT_HEIGHT`) 사용
4. 결과에 `padding.top + padding.bottom` 합산 → 엔진에 border-box 크기 전달

```
calculateContentHeight(Card)
  └── childElements 우선 탐색
      ├── Heading.intrinsicHeight  (텍스트 측정 기반)
      ├── gap (8px)
      └── Description.intrinsicHeight (텍스트 측정 기반)
```

### 9.10.4 padding/border 주입 규칙 — enrichWithIntrinsicSize (v3.12 수정)

`enrichWithIntrinsicSize()`의 padding/border 추가 여부는 **CSS 속성 존재 여부**와 **태그 유형**으로 결정합니다.

| 조건                      | padding/border 추가  | 이유                                     |
| ------------------------- | -------------------- | ---------------------------------------- |
| CSS에 padding/border 없음 | O (spec 기본값 포함) | 레이아웃 엔진이 추가할 값 없음           |
| CSS에 padding/border 있음 | X (엔진에 위임)      | Taffy가 CSS 값을 자체 추가               |
| INLINE_BLOCK_TAGS         | O (항상 포함)        | layoutInlineRun이 border-box로 직접 사용 |

> **v3.9→v3.12 변경**: 기존 `isTreatedAsBorderBox` 조건이 Card/Box/Section에 CSS padding이 있어도 강제 추가 → Taffy가 또 추가 → 이중 계산. 조건 제거하여 CSS padding 존재 시 엔진에 위임.

> **관련**: §4.7.4.5 parseBoxModel border-box 변환, §4.7.4.2 BlockEngine border-box 크기 계산

### 9.10.5 Card props→children 텍스트 동기화 패턴 (v3.11)

**배경**: `CardEditor`는 Card element의 `props.heading`, `props.title`, `props.description`을 업데이트합니다.
그러나 WebGL의 `TextSprite`는 자식 Heading/Description element의 `props.children`을 읽으므로,
Card.props 변경이 자식 요소에 자동으로 전파되지 않아 Properties Panel에서 텍스트를 변경해도
캔버스에 반영되지 않는 버그가 발생했습니다.

**해결 — BuilderCanvas.tsx `createContainerChildRenderer`**

Card 자식을 렌더링할 때 Card element의 props를 자식의 `props.children`에 주입합니다.
이 패턴은 Tabs의 `_tabLabels` 동적 주입과 동일합니다.

```typescript
// BuilderCanvas.tsx — createContainerChildRenderer 내부
// Card props → 자식 Heading/Description 주입
if (containerTag === "card" || containerTag === "Card") {
  const cardProps = containerElement.props;
  if (childElement.tag === "Heading" || childElement.tag === "heading") {
    effectiveChild = {
      ...childElement,
      props: {
        ...childElement.props,
        // heading 우선, 없으면 title 폴백
        children:
          cardProps.heading ?? cardProps.title ?? childElement.props.children,
      },
    };
  } else if (
    childElement.tag === "Description" ||
    childElement.tag === "description"
  ) {
    effectiveChild = {
      ...childElement,
      props: {
        ...childElement.props,
        children: cardProps.description ?? childElement.props.children,
      },
    };
  }
}
```

**해결 — LayoutRenderers.tsx CSS Preview 동기화**

CSS Preview Card 렌더러에도 `heading`, `subheading`, `footer` props를 자식에 전달하여
CSS Preview와 WebGL Canvas 간 텍스트 소스를 일치시킵니다.

```typescript
// packages/shared/src/renderers/LayoutRenderers.tsx — Card 렌더러
// heading/subheading/footer props를 자식 렌더러에 전달
<CardRenderer
  heading={element.props.heading ?? element.props.title}
  subheading={element.props.subheading}
  footer={element.props.footer}
  description={element.props.description}
  {...restProps}
/>
```

**우선순위 규칙**

| 자식 태그    | 주입 소스                                | 우선순위                        |
| ------------ | ---------------------------------------- | ------------------------------- |
| Heading      | `card.props.heading ?? card.props.title` | `heading` 있으면 `title` 미사용 |
| Description  | `card.props.description`                 | —                               |
| (SubHeading) | `card.props.subheading`                  | —                               |

> **관련**: §9.9.4 핵심 패턴 (Tabs `_tabLabels` 주입), §9.10.1 Card element tree 구조

---

## 9.11 TagGroup label 두 줄 렌더링 버그 수정 (2026-02-22)

### 9.11.1 현상 및 근본 원인

WebGL Canvas에서 TagGroup 컴포넌트의 label("Tag Group")이 두 줄로 렌더링되는 버그가 발생했다.
근본 원인은 두 가지다.

**원인 1 — Spec shapes 중복 렌더링**

`TagGroupSpec.render.shapes`가 label 텍스트를 fontSize 12px로 직접 렌더링하면서,
동시에 자식 Label 엘리먼트도 fontSize 14px로 독립적으로 렌더링하여
두 개의 텍스트가 겹쳐 두 줄처럼 표시되었다.

```
렌더링 결과 (수정 전):
┌──────────────────────────┐
│ Tag Group  ← spec shapes (fontSize:12)
│ Tag Group  ← 자식 Label element (fontSize:14)
│ [Tag 1] [Tag 2]
└──────────────────────────┘
```

**원인 2 — Canvas 2D → CanvasKit 폭 측정 오차**

`calculateContentWidth`의 일반 텍스트 경로에서 Canvas 2D `measureText` 결과(65px)를 보정 없이
그대로 사용했다. CanvasKit paragraph API는 동일 텍스트를 렌더링할 때 더 넓은 폭을 필요로 하여
폭이 부족한 경우 텍스트가 자동 wrapping되었다.

INLINE_FORM 경로(line 718-719)에는 이미 `Math.ceil() + 2` 보정이 존재했으나,
일반 텍스트 경로(line 759-760)에는 동일 보정이 누락되어 있었다.

### 9.11.2 수정 내용

**수정 파일 1 — `packages/specs/src/components/TagGroup.spec.ts`**

`render.shapes`에서 label 텍스트 shape을 제거한다.
label 렌더링은 자식 Label 엘리먼트 단독 담당으로 일원화한다.

```typescript
// TagGroup.spec.ts — render.shapes (수정 전)
shapes: (props, size) => [
  // ... 배경, 테두리 shape ...
  {
    type: "text",
    content: props.label ?? "Tag Group",
    fontSize: 12,
    // ...
  },
  // ... TagList, Tag shape ...
];

// TagGroup.spec.ts — render.shapes (수정 후)
shapes: (props, size) => [
  // ... 배경, 테두리 shape만 유지 ...
  // label 텍스트 shape 제거 — 자식 Label element가 렌더링 담당
  // ... TagList, Tag shape ...
];
```

**수정 파일 2 — `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`**

일반 텍스트 경로에 Canvas 2D→CanvasKit 폭 측정 보정을 추가한다.
INLINE_FORM 경로(line 718-719)와 동일한 `Math.ceil() + 2` 패턴을 적용한다.

```typescript
// engines/utils.ts — calculateContentWidth (수정 전, line 759-760)
const textWidth = calculateTextWidth(text, fontSize, fontWeight, fontFamily);
return textWidth;

// engines/utils.ts — calculateContentWidth (수정 후, line 759-760)
const textWidth = calculateTextWidth(text, fontSize, fontWeight, fontFamily);
return Math.ceil(textWidth) + 2; // Canvas 2D → CanvasKit 폭 측정 보정
```

### 9.11.3 Spec shapes label 중복 렌더링 제거 원칙

컴포넌트 spec에서 자식 엘리먼트와 spec shapes 간 텍스트 렌더링이 겹치지 않도록
아래 원칙을 준수한다.

| 렌더링 담당       | 적용 조건                                             | 예시                                     |
| ----------------- | ----------------------------------------------------- | ---------------------------------------- |
| **자식 엘리먼트** | Label, Heading, Description 등 독립 element tree 노드 | TagGroup > Label, Card > Heading         |
| **spec shapes**   | 자식 element가 없는 내부 장식 텍스트                  | Tab 레이블(Tabs), 버튼 내 텍스트(Button) |

> spec shapes와 자식 element가 동일 텍스트를 이중 렌더링하면 Canvas에서 두 줄/겹침으로 표시된다.
> 자식 element가 담당하는 경우 spec shapes에서 해당 텍스트 shape을 제거한다.

### 9.11.4 Canvas 2D → CanvasKit 폭 보정 패턴

`calculateContentWidth`에서 Canvas 2D `measureText`와 CanvasKit paragraph 간 측정값 차이를 보정한다.

```typescript
// engines/utils.ts — 공통 보정 패턴
// INLINE_FORM 경로 (line 718-719) 및 일반 텍스트 경로 (line 759-760) 동일 적용
return (
  Math.ceil(calculateTextWidth(text, fontSize, fontWeight, fontFamily)) + 2
);
//     ^^^^^^^^^^                                                              ^^^
//     소수점 올림 (픽셀 단위 정수화)                                          CanvasKit 여유 마진
```

- `Math.ceil()`: Canvas 2D `measureText`가 반환하는 소수점 너비를 픽셀 단위로 올림
- `+ 2`: CanvasKit paragraph API의 자체 padding/렌더링 여유 폭 확보

---

## 9.12 Slider Complex Component 전환 (2026-02-22)

### 9.12.1 전환 배경 및 목표

Slider는 단순 컴포넌트(단일 element)에서 **Complex Component**(DOM 구조를 그대로 반영하는 계층적 element tree)로 전환되었다. 이 전환으로 layer tree가 실제 DOM 구조와 1:1로 일치하게 되었으며, Select/ComboBox 등 기존 Complex Component 패턴을 동일하게 따른다.

### 9.12.2 DOM 구조 (element tree)

```
Slider (display:flex, flexDirection:column)
├── Label            (텍스트 — 레이블)
├── SliderOutput     (텍스트 — 현재 값 표시)
└── SliderTrack      (track 배경 + fill)
    └── SliderThumb  (드래그 핸들)
```

이 구조는 React-Aria의 `<Slider>` DOM 구조와 동일하다.

### 9.12.3 복합 컴포넌트 전환 절차

Slider를 Complex Component로 전환할 때 수정한 파일과 역할은 다음과 같다.

| 파일                   | 역할                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `FormComponents.ts`    | `createSliderDefinition()` 팩토리 추가 — 4개 자식 element 재귀 생성                   |
| `ComponentFactory.ts`  | Slider creator 등록 — `TAG_CREATOR_MAP`에 항목 추가                                   |
| `useElementCreator.ts` | `complexComponents` 배열에 `'Slider'` 추가 — 삽입 시 복합 구조 생성 경로로 분기       |
| `ElementSprite.tsx`    | `_hasLabelChild` 체크에 `'Slider'` 추가 — spec shapes의 label/output 중복 렌더링 방지 |
| `Slider.spec.ts`       | `_hasLabelChild` 플래그 처리 추가 — 자식 element가 담당할 때 shapes 스킵              |

> 동일 패턴 참조: Select, ComboBox — `useElementCreator.ts`의 `complexComponents` 배열과 `_hasLabelChild` 플래그 사용이 동일하다.

### 9.12.4 `_hasChildren` 통합 패턴 (Select / ComboBox / Slider 공통)

> **변경 이력**: 기존 `_hasLabelChild` 플래그는 `_hasChildren` 단일 패턴으로 통합되어 **제거됨** (2026-02 Compositional Architecture 전환).

복합 컴포넌트로 전환된 컴포넌트는 자식 Label/Output element가 텍스트 렌더링을 직접 담당한다. 이때 spec의 `render.shapes`에서 label/output 텍스트 shape를 그대로 출력하면 이중 렌더링이 발생한다.

현재는 `_hasChildren` 플래그 하나로 모든 컴포넌트의 이중 렌더링을 방지한다. 자식 element가 존재하면 `_hasChildren: true`가 주입되고, spec shapes는 배경/테두리(shell)만 반환한다.

```typescript
// ElementSprite.tsx — _hasChildren 단일 패턴 (모든 컴포넌트 통합)
if (!CHILD_COMPOSITION_EXCLUDE_TAGS.has(tag)) {
  // 실제 자식 유무 기반: 자식이 있으면 _hasChildren=true → spec은 shell만 반환
  // 자식이 모두 삭제되면 _hasChildren=false → spec이 standalone 모드로 복귀
  if (childElements && childElements.length > 0) {
    specProps = { ...specProps, _hasChildren: true };
  }
}

// Slider.spec.ts — shapes 내부에서 _hasChildren로 스킵
shapes: (props, variant, size, state) => {
  const shapes: Shape[] = [];
  const hasChildren = !!(props as Record<string, unknown>)._hasChildren;

  // track, thumb shapes는 항상 출력 (배경/구조)
  shapes.push({ type: 'roundRect', /* track ... */ });
  shapes.push({ type: 'circle',    /* thumb ... */ });

  // label/output 텍스트: 자식 element가 렌더링 담당이면 스킵
  if (!hasChildren) {
    shapes.push({ type: 'text', /* label ... */ });
    shapes.push({ type: 'text', /* output value ... */ });
  }

  return shapes;
},
```

> **적용 범위**: Select, ComboBox, Slider 포함 모든 컴포넌트에 동일하게 적용. §9.13 Compositional Architecture 참조.

### 9.12.5 TokenRef 산술 연산 버그 — `resolveToken()` 필수 원칙

**증상**: 렌더링이 실패하거나 요소의 y 좌표가 `NaN`이 되어 화면에 표시되지 않음.

**원인**: `SizeSpec.fontSize`는 `TokenRef` 타입(`'{typography.text-md}'`)이다. 이를 숫자 연산(`-`, `+`, `/`)에 직접 사용하면 문자열 연결 또는 `NaN`이 발생한다. `as unknown as number` 타입 캐스팅은 TypeScript 컴파일러를 속일 뿐, 실제 런타임 값은 여전히 문자열이다.

**영향 범위 (2026-02-25 기준 수정 완료)**: 19개 이상 spec 파일

Calendar, CheckboxGroup, ColorField, DateField, DatePicker, DateRangePicker, Disclosure, Form, GridList, List, ListBox, Meter, NumberField, Panel, ProgressBar, RadioGroup, SearchField, TagGroup, TextArea, TimeField, Tree

```typescript
// 잘못된 코드 패턴 1 — 직접 산술 연산 (NaN 발생)
const offsetY = (height - size.fontSize) / 2;
//                       ^^^^^^^^^^^^^^^^
//                       TokenRef 문자열 → NaN

// 잘못된 코드 패턴 2 — as unknown as number 캐스팅 (컴파일만 통과, 런타임 NaN)
const fontSize = size.fontSize as unknown as number;
const labelFontSize = fontSize - 2; // NaN

// 올바른 코드 — resolveToken()으로 TokenRef → 숫자 변환
import { resolveToken } from "../renderers/utils/tokenResolver";
import type { TokenRef } from "../types";

const rawFontSize = props.style?.fontSize ?? size.fontSize;
const resolvedFs =
  typeof rawFontSize === "number"
    ? rawFontSize
    : typeof rawFontSize === "string" && rawFontSize.startsWith("{")
      ? resolveToken(rawFontSize as TokenRef)
      : rawFontSize;
const fontSize = typeof resolvedFs === "number" ? resolvedFs : 16; // fallback 16px

// 이후 산술 연산 안전
const labelFontSize = fontSize - 2;
const offsetY = (height - fontSize) / 2;
```

> **CRITICAL 규칙**: spec `shapes()` 함수 내에서 `SizeSpec.fontSize`, `SizeSpec.borderRadius` 등 `TokenRef` 타입 필드를 숫자 연산에 사용할 때는 반드시 `resolveToken()`을 통해 숫자로 변환한다. `as unknown as number` 캐스팅은 런타임 NaN을 방지하지 못한다. `typeof === 'number'` 체크로 이미 숫자인 경우를 처리하고, `{`로 시작하는 문자열인 경우 `resolveToken()` 호출이 필수이다.

### 9.12.6 SliderOutput 텍스트 위치 수정

**증상**: SliderOutput 텍스트가 컨테이너 바깥(오른쪽 화면 밖)에 렌더링되는 현상.

**원인**: `x: width`로 설정하면 텍스트 시작점이 컨테이너 오른쪽 끝에 위치한다.

```typescript
// 잘못된 코드
{ type: 'text', x: width, text: String(props.value ?? 0), align: 'right' }

// 올바른 코드 — x:0 + maxWidth로 컨테이너 내 우측 정렬
{ type: 'text', x: 0, maxWidth: width, text: String(props.value ?? 0), align: 'right' }
```

`x: 0`에서 시작하되 `maxWidth: width`를 설정하면, CanvasKit ParagraphBuilder가 컨테이너 너비 내에서 `align: 'right'`를 올바르게 적용한다.

### 9.12.7 Slider DIMENSIONS 스펙

M3 디자인 토큰 기반의 치수:

| size | trackHeight | thumbSize |
| ---- | ----------- | --------- |
| sm   | 4px         | 14px      |
| md   | 6px         | 18px      |
| lg   | 8px         | 22px      |

CSS 파일에서 `.sm`, `.primary` 클래스 selector 방식에서 `[data-size="sm"]`, `[data-variant="primary"]` data-attribute selector로 전환하여 React-Aria의 data-attribute 상태 관리와 일치시켰다.

### 9.12.8 label 렌더링 — labelOffset 패턴

SearchField, NumberField 등 라벨이 있는 입력 컴포넌트에서 label 텍스트 shape을 추가하고, 이후 입력 필드 배경의 y 좌표를 `labelOffset`만큼 아래로 보정하는 패턴이다.

**배경**: label이 있을 때는 입력 필드 위에 label 텍스트가 표시되어야 하므로, 배경 roundRect와 내부 요소들의 y 좌표를 label 높이 + gap 만큼 내려야 한다.

```typescript
// fontSize resolveToken으로 얻은 후
const labelFontSize = fontSize - 2;
const labelHeight = Math.ceil(labelFontSize * 1.2); // 줄 높이
const labelGap = size.gap ?? 8;
const labelOffset = props.label ? labelHeight + labelGap : 0;

if (props.label) {
  shapes.push({
    type: "text" as const,
    x: 0,
    y: 0, // label은 항상 y:0에서 시작
    text: props.label,
    fontSize: labelFontSize,
    // ...
  });
}

// 이후 모든 shapes에 labelOffset 적용
shapes.push({
  id: "bg",
  type: "roundRect" as const,
  x: 0,
  y: labelOffset, // label이 있으면 아래로 이동
  width,
  height,
  // ...
});
```

> **주의**: `props.label ? 20 : 0` 같은 하드코딩된 오프셋은 size별 폰트 크기 변화를 반영하지 못한다. 반드시 `resolveToken()`으로 얻은 fontSize 기반으로 `labelOffset`을 계산해야 한다.

### 9.12.9 `rearrangeShapesForColumn` — 가드 제거됨

> **변경 이력**: `SPEC_RENDERS_ALL_TAGS_SET` 가드는 Compositional Architecture 전환 시 **제거됨** (2026-02). `_hasChildren` 패턴 통합으로 불필요해짐.

`rearrangeShapesForColumn()`은 `flexDirection: 'column'`인 컴포넌트의 shapes를 세로 배치로 재정렬하는 함수다.

**이전 문제**: SearchField, NumberField 등의 spec `shapes()`가 label → bg → 아이콘 순서로 직접 y 좌표를 지정하는데, `rearrangeShapesForColumn()`이 이를 덮어쓰는 문제가 있었다. 이전에는 `SPEC_RENDERS_ALL_TAGS_SET` 가드로 특정 태그를 재배치에서 제외했다.

**현재**: `_hasChildren` 패턴으로 전환되면서, 자식이 있는 컴포넌트는 spec shapes가 shell만 반환하므로 좌표 충돌이 발생하지 않는다. 따라서 가드 없이 모든 column 컴포넌트에 `rearrangeShapesForColumn`을 적용한다.

```typescript
// ElementSprite.tsx — rearrangeShapesForColumn 호출부 (현재)
if (isColumn) {
  rearrangeShapesForColumn(shapes, finalWidth, sizeSpec.gap ?? 8);
}
```

> **원칙**: spec `shapes()`에서 `_hasChildren`일 때 shell만 반환하면 좌표 충돌이 발생하지 않으므로, 별도 가드가 불필요하다. standalone 모드(자식 없음)에서만 내부 레이아웃을 직접 배치한다.

---

## 9.13 자식 조합 패턴 전체 전환 (Child Composition Pattern) (2026-02-24)

### 9.13.1 전환 배경 및 목표

기존: 각 컴포넌트 spec의 `shapes()`가 배경 + 콘텐츠(텍스트, 아이콘 등) 전체를 렌더링
문제: Figma/Pencil App/HTML+CSS DOM 구조와 불일치, Layer 트리에서 자식 개별 선택/편집 불가
해결: spec shapes는 배경/테두리/그림자만 담당, 자식 Element가 콘텐츠 렌더링

```
전환 전:
TextField.spec.ts shapes() → [bg, border, label텍스트, input텍스트, placeholder]
→ 모든 시각 요소가 하나의 shapes 배열

전환 후:
TextField.spec.ts shapes(_hasChildren=true) → [bg, border]  (shell만)
├── Label Element → TextSprite 렌더링
├── Input Element → TextSprite 렌더링
└── FieldError Element → TextSprite 렌더링
```

### 9.13.2 인프라 변경

#### Opt-Out 아키텍처: CHILD_COMPOSITION_EXCLUDE_TAGS (`ElementSprite.tsx`)

기존 화이트리스트(`CHILD_COMPOSITION_TAGS`, 42개)에서 **블랙리스트(`CHILD_COMPOSITION_EXCLUDE_TAGS`, 5개)로 전환**.
자식이 있으면 **기본적으로** `_hasChildren: true`를 주입하고, 제외 태그만 스킵한다.

```typescript
// 자체 synthetic prop 메커니즘 또는 복잡한 다단계 중첩으로 제외
const CHILD_COMPOSITION_EXCLUDE_TAGS = new Set([
  "Tabs", // _tabLabels synthetic prop
  "Breadcrumbs", // _crumbs synthetic prop
  "TagGroup", // _tagItems synthetic prop
  "Table", // 3단계 중첩 (별도 작업)
  "Tree", // 다단계 중첩 (별도 작업)
]);

if (!CHILD_COMPOSITION_EXCLUDE_TAGS.has(tag)) {
  // 실제 자식 유무 기반: 자식이 있으면 _hasChildren=true → spec은 shell만 반환
  // 자식이 모두 삭제되면 _hasChildren=false → spec이 standalone 모드로 복귀하여 자체 콘텐츠 렌더링
  if (childElements && childElements.length > 0) {
    specProps = { ...specProps, _hasChildren: true };
  }
}
```

> **전환 이유**: 노코드 빌더에서 사용자가 제공 컴포넌트만으로 모든 요구를 충족할 수 없으므로,
> 모든 컴포넌트가 기본적으로 자식 조합을 허용해야 한다. 화이트리스트(opt-in)는 신규 컴포넌트마다
> 3중 수동 등록(CHILD_COMPOSITION_TAGS + CONTAINER_TAGS + spec 수정)을 요구하여 자유 조합을 차단했다.

#### 공유 상수: COMPLEX_COMPONENT_TAGS (`factories/constants.ts`)

Factory가 자식 Element를 생성하는 컴포넌트 태그를 **공유 상수**로 분리한다.
이 Set은 `useElementCreator.ts`에서 Factory 경로 분기에 사용된다.

> **변경 이력**: 이전에는 `ElementSprite.tsx`에서 `COMPLEX_COMPONENT_TAGS.has(tag)` 선행 검사로 항상 `_hasChildren: true`를 주입했으나, 자식 삭제 후에도 shell만 남는 버그로 인해 제거됨. 현재는 실제 `childElements.length > 0` 조건만 사용.

```typescript
// apps/builder/src/builder/factories/constants.ts
export const COMPLEX_COMPONENT_TAGS = new Set([
  // Form Input
  "TextField",
  "TextArea",
  "NumberField",
  "SearchField",
  "DateField",
  "TimeField",
  "ColorField",
  // Selection
  "Select",
  "ComboBox",
  "ListBox",
  "GridList",
  "List",
  // Control
  "Checkbox",
  "Radio",
  "Switch",
  "Slider",
  "ToggleButtonGroup",
  "Switcher",
  // Group
  "CheckboxGroup",
  "RadioGroup",
  // Layout
  "Card",
  // Navigation
  "Menu",
  "Disclosure",
  "DisclosureGroup",
  "Pagination",
  // Overlay
  "Dialog",
  "Popover",
  "Tooltip",
  // Feedback
  "Form",
  "Toast",
  "Toolbar",
  // Date & Color
  "DatePicker",
  "DateRangePicker",
  "Calendar",
  "ColorPicker",
  "ColorSwatchPicker",
  // CHILD_COMPOSITION_EXCLUDE_TAGS 태그 (Factory 경로 분기용)
  "Tabs",
  "Tree",
  "TagGroup",
  "Table",
]);
```

**동작 규칙 (현재)**:

| 컴포넌트 유형                  | `_hasChildren` 조건            | 예시                                     |
| ------------------------------ | ------------------------------ | ---------------------------------------- |
| 모든 컴포넌트 (EXCLUDE 제외)   | 자식이 실제로 있을 때만 `true` | TextField, Select, Button, Badge         |
| CHILD_COMPOSITION_EXCLUDE_TAGS | `_hasChildren` 주입 차단       | Tabs, Tree, TagGroup, Table, Breadcrumbs |

> **현재 설계**: 모든 컴포넌트에 동일한 조건 (`childElements.length > 0`)을 적용.
> 자식 삭제 시 `_hasChildren`이 `false`가 되어 standalone 렌더링으로 복귀하는 것이 **의도된 동작**.

#### Opt-Out 아키텍처: NON_CONTAINER_TAGS (`BuilderCanvas.tsx`)

기존 화이트리스트(`CONTAINER_TAGS`, 49개)에서 **블랙리스트(`NON_CONTAINER_TAGS`, 32개)로 전환**.
대부분의 컴포넌트가 기본적으로 컨테이너로 작동하고, 자식을 내부에 렌더링할 수 없는 태그만 제외한다.

```typescript
const NON_CONTAINER_TAGS = new Set([
  // TEXT_TAGS: TextSprite 렌더링, 컨테이너 불가
  "Text",
  "Heading",
  "Description",
  "Label",
  "Paragraph",
  "Link",
  "Strong",
  "Em",
  "Code",
  "Pre",
  "Blockquote",
  "ListItem",
  "ListBoxItem",
  "GridListItem",
  // Void/Visual: 자식 없는 단일 요소
  "Input",
  "Separator",
  "Skeleton",
  // Color Sub-component: 부모 ColorPicker의 내부 요소
  "ColorSwatch",
  "ColorWheel",
  "ColorArea",
  "ColorSlider",
  // Field sub-components: leaf 요소 (자식 없음)
  "FieldError",
  "DateSegment",
  "TimeSegment",
  "SliderOutput",
  "SliderThumb",
  // Select sub-components: leaf 요소
  "SelectValue",
  "SelectIcon",
  // ComboBox sub-components: leaf 요소
  "ComboBoxInput",
  "ComboBoxTrigger",
  // Calendar sub-components: leaf 요소
  "CalendarHeader",
  "CalendarGrid",
]);

function isContainerTagForLayout(
  tag: string,
  style?: Record<string, unknown>,
): boolean {
  if (tag === "Section") {
    return style?.display === "flex" || style?.flexDirection !== undefined;
  }
  return !NON_CONTAINER_TAGS.has(tag); // 블랙리스트 반전
}
```

#### TRANSPARENT_CONTAINER_TAGS 확장 (`ElementSprite.tsx`)

배경/테두리를 spec shapes가 담당하므로 PixiJS container가 투명해야 하는 컴포넌트:

```typescript
const TRANSPARENT_CONTAINER_TAGS = new Set([
  "TextField",
  "NumberField",
  "SearchField",
  "DateField",
  "TimeField",
  "ColorField",
  "TextArea",
  "Textarea",
  "ComboBox",
  "Select",
  "Dropdown",
  "DatePicker",
  "Slider",
  "CheckboxGroup",
  "RadioGroup",
  "Switch",
  "Toggle",
]);
```

#### BuilderCanvas.tsx props sync 확장

Input Field 6종과 Overlay 4종에 Container Props 주입 패턴 확장:

| 컨테이너 카테고리  | 부모 props 키             | 대상 자식 tag | 주입 대상 prop |
| ------------------ | ------------------------- | ------------- | -------------- |
| Input Fields (6종) | `label`                   | `Label`       | `children`     |
| Overlay (4종)      | `heading` / `title`       | `Heading`     | `children`     |
| Overlay (4종)      | `description` / `message` | `Description` | `children`     |

### 9.13.3 Spec shapes() 3가지 카테고리

#### 카테고리 A: TRANSPARENT 컨테이너 (Input Fields)

`_hasChildren` 시 bg + border shapes만 반환. 자식이 모든 콘텐츠 렌더링.

적용: TextField, NumberField, SearchField, DateField, TimeField, ColorField

```typescript
const shapes: Shape[] = [
  { id: 'bg', type: 'roundRect', ... },
  { type: 'border', target: 'bg', ... },
];
const hasChildren = !!(props as Record<string, unknown>)._hasChildren;
if (hasChildren) return shapes;
// standalone 전용 텍스트 shapes...
```

#### 카테고리 B: NON-TRANSPARENT 컨테이너 (Overlay, Navigation)

`_hasChildren` 시 shadow + bg + border (shell) 유지. 자식이 내부 콘텐츠 렌더링.

적용:

- Dialog: backdrop + shadow + bg roundRect
- Popover: shadow + bg + border
- Tooltip: bg roundRect
- Toast: shadow + bg + border + 좌측 액센트 바
- Menu: shadow + bg + border
- Disclosure, DisclosureGroup, Toolbar: bg + border

```typescript
const shapes: Shape[] = [
  { type: 'shadow', ... },
  { id: 'bg', type: 'roundRect', ... },
  { type: 'border', ... },
];
if (hasChildren) return shapes; // shell 유지
// standalone 전용 container/text shapes...
```

#### 카테고리 C: TRANSPARENT Groups

`_hasChildren` 시 빈 배열 반환. 자식이 모든 렌더링 담당.

적용: CheckboxGroup, RadioGroup

#### 카테고리 D: Date & Color Composites

배경 shapes 유지 후 `_hasChildren` 체크. 복합 콘텐츠(캘린더 그리드, 컬러 영역) 스킵.

적용: DatePicker, DateRangePicker, Calendar, ColorPicker

### 9.13.4 border-box 높이 이중 계산 수정

`calculateContentHeight` flex column 분기에서 자식의 explicit height가 border-box인 경우 padding+border 미추가.

근본 원인: Input(height:40, border-box)에 padding(8)+border(2)를 추가로 더해 enrichedHeight가 70 (기대값: 60).

```typescript
const childIsBorderBox =
  childBoxSizing === "border-box" ||
  (childIsFormEl && childExplicitH !== undefined);

if (childExplicitH !== undefined && childIsBorderBox) {
  return childExplicitH; // border-box: padding+border 포함
}
return (
  contentH +
  childBox.padding.top +
  childBox.padding.bottom +
  childBox.border.top +
  childBox.border.bottom
);
```

### 9.13.5 Taffy 단일 엔진 레이아웃

> **변경 이력**: 이전 `DropflowBlockEngine` fallback flex 처리 코드는 Taffy 단일 엔진 전환(ADR-009 Foundation)으로 제거되었다.
> 현재 모든 display 타입(flex/grid/block)은 Taffy WASM 단일 호출로 처리된다.

### 9.13.6 하위호환

| 데이터 상태                   | `_hasChildren` | 동작                                 |
| ----------------------------- | -------------- | ------------------------------------ |
| 구 데이터 (자식 없음)         | `false`        | spec shapes 전체 렌더링 (기존 동작)  |
| 새 데이터 (factory 자식 생성) | `true`         | 자식이 콘텐츠 렌더링, spec은 shell만 |

### 9.13.7 `_hasChildren` 지원 컴포넌트 현황 (49개)

Opt-out 전환 후, 75개 spec 중 49개가 `_hasChildren`를 지원한다.

| 단계                                                            | 컴포넌트 수 | 대표 컴포넌트                                                |
| --------------------------------------------------------------- | ----------- | ------------------------------------------------------------ |
| E-1: 초기 20개 (Input, Overlay, Navigation, Groups, Date/Color) | 20          | TextField, Dialog, Menu, CheckboxGroup                       |
| E-2: 확장 22개 (Container, Selection, Composite)                | 22          | Card, Select, ComboBox, Slider, Switch                       |
| Phase 1: 신규 7개 (Leaf, Visual)                                | 7           | Button, Badge, ToggleButton, Slot, Panel, ProgressBar, Meter |
| **합계**                                                        | **49**      |                                                              |

**전수 검증 결과 (33개 COMPLEX_COMPONENT_TAGS 전체)**:

| 분류                                                                       | 개수 | 컴포넌트                                          | 동작                                                                                                        |
| -------------------------------------------------------------------------- | ---- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 일반 컴포넌트 (`_hasChildren` 자식 유무 기반)                              | 46   | TextField, Select, Slider, Card, Button, Badge 등 | 자식 있으면 shell, 없으면 standalone                                                                        |
| `CHILD_COMPOSITION_EXCLUDE_TAGS` (`_hasChildren` 주입 차단)                | 4    | Tabs, Tree, Table, TagGroup                       | COMPLEX_COMPONENT_TAGS 포함이지만 Factory 경로 분기용으로만 사용, `_hasChildren` 주입은 EXCLUDE 가드로 차단 |
| `CHILD_COMPOSITION_EXCLUDE_TAGS` (synthetic prop, \_hasChildren 주입 차단) | 1    | Breadcrumbs                                       | `_crumbs` synthetic prop 메커니즘 사용                                                                      |

> **주의**: COMPLEX_COMPONENT_TAGS에는 `Tabs`, `Tree`, `TagGroup`, `Table`이 포함되어 있으나,
> `ElementSprite.tsx`의 `CHILD_COMPOSITION_EXCLUDE_TAGS` 가드에 의해 `_hasChildren` 주입이 차단된다.
> 따라서 이 4개는 Factory 경로 분기(`useElementCreator.ts`)에서만 COMPLEX_COMPONENT_TAGS를 참조한다.

### 9.13.8 핵심 파일

| 파일                                      | 역할                                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| `factories/constants.ts`                  | `COMPLEX_COMPONENT_TAGS` Set (40개) — Factory 경로 분기용 공유 상수                           |
| `ElementSprite.tsx` L1161                 | `CHILD_COMPOSITION_EXCLUDE_TAGS` (5개 블랙리스트) + `_hasChildren` flag 전파 (자식 유무 기반) |
| `ElementSprite.tsx` L876                  | `TRANSPARENT_CONTAINER_TAGS`                                                                  |
| `BuilderCanvas.tsx` L165                  | `NON_CONTAINER_TAGS` (32개 블랙리스트) + `isContainerTagForLayout()`                          |
| `BuilderCanvas.tsx` L661-963              | createContainerChildRenderer (layout 주입, props sync, transparent)                           |
| `engines/utils.ts` L1148                  | flex column border-box 높이 이중 계산 수정                                                    |
| `engines/index.ts`                        | 레이아웃 엔진 디스패처 (Taffy 단일 엔진)                                                      |
| `packages/specs/src/components/*.spec.ts` | 49개 spec의 shapes() 함수 `_hasChildren` 지원                                                 |

### 9.13.9 신규 컴포넌트 등록 체크리스트 (Opt-Out)

대부분의 컴포넌트는 **등록 없이** 자동으로 자식 조합을 지원한다.
아래는 특수한 경우에만 필요한 체크리스트:

1. **Spec 파일**: shapes()에 `_hasChildren` 체크 추가 (bg/border shapes 이후 `if (hasChildren) return shapes;`)
2. **ElementSprite.tsx**: 자체 synthetic prop이나 다단계 중첩이 필요하면 `CHILD_COMPOSITION_EXCLUDE_TAGS`에 추가
3. **BuilderCanvas.tsx**: 컨테이너가 아닌 경우(텍스트, void 요소) `NON_CONTAINER_TAGS`에 추가. 필요시 props sync 분기 추가
4. **Factory 정의**: 자식 Element 정의 (Label, Input, Description 등)
   - **Factory 복합 컴포넌트인 경우**: `factories/constants.ts`의 `COMPLEX_COMPONENT_TAGS`에도 추가
     (자식 삭제 시 standalone 렌더링 복귀 방지)
5. **검증**: `pnpm build` + `pnpm type-check` + Canvas 시각 확인 + Layer 트리 자식 선택 확인

## 9.14 Label spec shapes 경로 전환 (2026-03-16)

### 9.14.1 배경 및 동기

기존 Label은 `TEXT_TAGS`에 포함되어 TextSprite 경로로 렌더링되었다.
이 경로에서 부모 컴포넌트(Select, ComboBox 등)의 variant에 따라 Label 색상을 결정하려면
`PARENT_VARIANT_TO_LABEL_TOKEN` 매핑(hex 하드코딩)이 필요했고, 이는 단일 소스 원칙에 위배된다.

**문제점:**

- `PARENT_VARIANT_TO_LABEL_TOKEN`: 색상값이 Spec 바깥 JS에 하드코딩 → Spec 변경 시 동기화 필요
- `labelColorElement` useMemo 해킹: 색상을 적용하기 위해 임시 element 생성
- TextSprite 경로에서 spec shapes API(`LabelSpec.variants`) 미사용

### 9.14.2 전환 내용

| 항목                 | 이전                                       | 이후                                                  |
| -------------------- | ------------------------------------------ | ----------------------------------------------------- |
| 렌더링 경로          | `TEXT_TAGS` → TextSprite                   | spec shapes 경로                                      |
| 색상 소스            | `PARENT_VARIANT_TO_LABEL_TOKEN` (하드코딩) | `LabelSpec.variants` (단일 소스)                      |
| `isUIComponent` 판정 | 별도 set 등록                              | `getSpecForTag(tag) != null` 조건                     |
| `hasOwnSprite`       | spec 있는 "box" 태그 포함                  | spec 있는 "box" 태그 제외                             |
| Factory 기본값       | variant 미설정                             | `variant: "accent"`                                   |
| 부모 variant 상속    | delegation에서 직접 override               | `PARENT_VARIANT_TO_LABEL` 매핑 (`isUIComponent` 분기) |

### 9.14.3 구현 원칙

```typescript
// 금지: TEXT_TAGS에 "Label" 재추가
// TEXT_TAGS는 순수 텍스트 요소(heading, paragraph, span, description 등) 전용

// 올바른 패턴: isUIComponent 판정
function isUIComponent(tag: string): boolean {
  return getSpecForTag(tag) != null; // LabelSpec 있으면 true
}

// 올바른 패턴: Label 색상은 LabelSpec.variants에서
// 부모 variant → PARENT_VARIANT_TO_LABEL 매핑 → label variant 결정
const PARENT_VARIANT_TO_LABEL = {
  accent: "accent",
  primary: "default",
  // ...
} as const;
```

**금지 패턴:**

- `TEXT_TAGS`에 `"Label"` 재추가 (TextSprite + spec shapes 이중 렌더링)
- `PARENT_VARIANT_TO_LABEL_TOKEN` 방식 부활 (hex 하드코딩)
- Select/ComboBox delegation에서 Label color 직접 override

> **관련**: `.claude/rules/canvas-rendering.md` §Label 렌더링 경로

---

## 10. 기술 명세

### 10.1 패키지 의존성

```json
// packages/specs/package.json
{
  "name": "@composition/specs",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./renderers": {
      "types": "./dist/renderers/index.d.ts",
      "import": "./dist/renderers/index.js"
    },
    "./primitives": {
      "types": "./dist/primitives/index.d.ts",
      "import": "./dist/primitives/index.js"
    },
    "./types": {
      "types": "./dist/types/index.d.ts",
      "import": "./dist/types/index.js"
    },
    "./adapters": {
      "types": "./dist/adapters/index.d.ts",
      "import": "./dist/adapters/index.js"
    }
  },
  "files": ["dist"],
  "dependencies": {
    "colord": "^2.9.3"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "tsup": "^8.0.0",
    "tsx": "^4.7.0",
    "vitest": "^4.0.18",
    "@vitest/coverage-v8": "^4.0.18",
    "@playwright/test": "^1.58.2",
    "pixelmatch": "^7.1.0",
    "pngjs": "^7.0.0",
    "eslint": "^10.0.2"
  }
}
```

### 10.2 빌드 설정

```json
// packages/specs/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### 10.3 스크립트

```json
// packages/specs/package.json (scripts)
// ⚠️ 빌드 도구: tsup (tsc가 아님). dist/ 출력이 esm + cjs + dts
{
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts",
    "dev": "tsup src/index.ts --format esm,cjs --dts --watch",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "test:visual": "playwright test",
    "generate:css": "tsx scripts/generate-css.ts",
    "validate": "tsx scripts/validate-specs.ts",
    "validate:tokens": "tsx scripts/validate-tokens.ts",
    "validate:phase0": "tsx scripts/validate-phase0.ts",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  }
}
```

> **CRITICAL**: `@composition/specs`는 `dist/`를 통해 내보내므로, 소스 수정 후 반드시
> `pnpm --filter @composition/specs build`를 실행해야 합니다. 미실행 시 소비자 앱이
> 구 버전을 참조하여 레이아웃↔렌더링 불일치가 발생합니다.
> 자세한 내용은 [4.7.4.0 빌드 동기화](#4740-compositionspecs-빌드-동기화-critical) 참조.

### 10.4 Zustand 상태 관리 연동

#### 10.4.1 Store와 Spec 연동 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                 Zustand Store ↔ Spec 연동                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Zustand Store                                               │
│  ├── elementsMap: Map<string, Element>                      │
│  │   └── element.props: { variant, size, children, ... }    │
│  │                                                          │
│  └── selectedElementId: string                              │
│                                                              │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────┐                                        │
│  │ Spec Adapter    │ ← element.props 를 Spec Props로 변환   │
│  └────────┬────────┘                                        │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐                                        │
│  │ Component Spec  │ ← ButtonSpec, TextFieldSpec 등         │
│  └────────┬────────┘                                        │
│           │                                                  │
│    ┌──────┴──────┐                                          │
│    ▼             ▼                                          │
│  React         CanvasKit/Skia                               │
│  Renderer      Renderer                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 10.4.2 Spec Adapter 구현

```typescript
// packages/specs/src/adapters/storeAdapter.ts

import type { Element } from "@composition/builder/types";
import type { ComponentSpec } from "../types";
import { ButtonSpec } from "../components/Button.spec";
import { TextFieldSpec } from "../components/TextField.spec";

/**
 * Element 타입 → Component Spec 매핑
 */
const specRegistry: Record<string, ComponentSpec<unknown>> = {
  Button: ButtonSpec,
  TextField: TextFieldSpec,
  // ... 추가 컴포넌트
};

/**
 * Zustand Element를 Spec Props로 변환
 */
export function elementToSpecProps<T>(element: Element): T {
  const spec = specRegistry[element.type];
  if (!spec) {
    console.warn(`No spec found for element type: ${element.type}`);
    return element.props as T;
  }

  // props 정규화 (기본값 적용)
  return {
    variant: element.props.variant || spec.defaultVariant,
    size: element.props.size || spec.defaultSize,
    ...element.props,
  } as T;
}

/**
 * Element 타입에 해당하는 Spec 반환
 */
export function getSpecForElement(
  element: Element,
): ComponentSpec<unknown> | undefined {
  return specRegistry[element.type];
}

/**
 * Spec 변경 시 Element 업데이트 (역방향)
 */
export function specPropsToElement<T>(
  elementId: string,
  specProps: T,
  updateElement: (id: string, props: Partial<Element["props"]>) => void,
): void {
  updateElement(elementId, specProps as Partial<Element["props"]>);
}
```

#### 10.4.3 ElementSprite에서 Skia 렌더링 사용 예시

```typescript
// apps/builder/src/builder/workspace/canvas/ElementSprite.tsx (개념)

import { useEditorStore } from '../../../../store/editorStore';
import { elementToSpecProps, getSpecForElement } from '@composition/specs/adapters';
import { useSkiaNode } from '../skia/useSkiaNode';
import type { ButtonProps } from '@composition/specs';

function ElementSpriteButton({ elementId }: { elementId: string }) {
  // Zustand에서 element 가져오기
  const element = useEditorStore(state => state.elementsMap.get(elementId));

  if (!element) return null;

  // Spec Adapter로 props 변환
  const props = elementToSpecProps<ButtonProps>(element);
  const spec = getSpecForElement(element);

  if (!spec) return null;

  // SkiaNodeData 생성 및 글로벌 레지스트리 등록
  const skiaNodeData = useMemo(() => ({
    type: 'box' as const,
    box: { fillColor: variantColor, borderRadius, strokeColor, strokeWidth },
    children: [{ type: 'text', text: { content: buttonText, fontSize, align: 'center' } }],
  }), [variantColor, borderRadius, buttonText, fontSize]);

  useSkiaNode(elementId, skiaNodeData);

  // PixiJS Container는 이벤트 전용 (시각적 렌더링 없음)
  // ... PixiJS Container 반환
});
```

#### 10.4.4 히스토리 연동

```typescript
// Spec 변경 시 히스토리 기록 (CRITICAL 규칙 준수)

import { useEditorStore } from "../../../../store/editorStore";

function updateElementFromSpec(
  elementId: string,
  newProps: Partial<ButtonProps>,
) {
  const store = useEditorStore.getState();

  // 1. 히스토리 기록 (상태 변경 전)
  store.recordHistory();

  // 2. Memory Update (즉시)
  store.updateElement(elementId, { props: newProps });

  // 3. Index Rebuild (자동)
  // 4. DB Persist (백그라운드)
  // 5. Preview Sync (백그라운드)
}
```

### 10.5 테스트 전략

#### 10.5.1 테스트 피라미드

```
                    ┌─────────────┐
                    │   E2E      │  Playwright (Visual Regression)
                    │   Tests    │  - React ↔ CanvasKit 비교
                    └─────────────┘  - 5% of tests
                   ┌───────────────┐
                   │  Integration  │  Vitest + React Testing Library
                   │    Tests      │  - Renderer + Store 연동
                   └───────────────┘  - 15% of tests
              ┌─────────────────────────┐
              │       Unit Tests        │  Vitest
              │   (render.shapes 함수)  │  - 순수 함수 테스트
              └─────────────────────────┘  - 80% of tests
```

#### 10.5.2 Unit Test 범위

```typescript
// packages/specs/tests/unit/Button.spec.test.ts

import { describe, it, expect } from "vitest";
import { ButtonSpec } from "../../src/components/Button.spec";

describe("ButtonSpec", () => {
  describe("variants", () => {
    it("모든 variant가 필수 속성을 가짐", () => {
      const requiredKeys = [
        "background",
        "backgroundHover",
        "backgroundPressed",
        "text",
      ];

      Object.entries(ButtonSpec.variants).forEach(([name, variant]) => {
        requiredKeys.forEach((key) => {
          expect(variant).toHaveProperty(key);
          expect(variant[key]).toMatch(/^\{color\./);
        });
      });
    });

    it("모든 토큰 참조가 유효함", () => {
      Object.values(ButtonSpec.variants).forEach((variant) => {
        expect(isValidTokenRef(variant.background)).toBe(true);
        expect(isValidTokenRef(variant.text)).toBe(true);
      });
    });
  });

  describe("sizes", () => {
    it("모든 size가 필수 속성을 가짐", () => {
      Object.entries(ButtonSpec.sizes).forEach(([name, size]) => {
        expect(size.height).toBeGreaterThan(0);
        expect(size.paddingX).toBeGreaterThan(0);
        expect(size.fontSize).toMatch(/^\{typography\./);
        expect(size.borderRadius).toMatch(/^\{radius\./);
      });
    });

    it("size 순서가 오름차순임", () => {
      const sizes = ["xs", "sm", "md", "lg", "xl"];
      const heights = sizes.map((s) => ButtonSpec.sizes[s].height);

      for (let i = 1; i < heights.length; i++) {
        expect(heights[i]).toBeGreaterThan(heights[i - 1]);
      }
    });
  });

  describe("render.shapes()", () => {
    it("기본 shapes를 반환함 (default state)", () => {
      const props = { variant: "primary", size: "md", children: "Click" };
      const variant = ButtonSpec.variants.primary;
      const size = ButtonSpec.sizes.md;

      const shapes = ButtonSpec.render.shapes(props, variant, size, "default");

      expect(shapes.length).toBeGreaterThan(0);
      expect(shapes[0].type).toBe("roundRect");
    });

    it("hover state에서 올바른 색상 사용", () => {
      const props = { variant: "primary", size: "md", children: "Click" };
      const variant = ButtonSpec.variants.primary;
      const size = ButtonSpec.sizes.md;

      const shapes = ButtonSpec.render.shapes(props, variant, size, "hover");

      const bgShape = shapes.find((s) => s.type === "roundRect");
      expect(bgShape?.fill).toBe(variant.backgroundHover);
    });

    it("border variant는 border shape 포함", () => {
      const props = { variant: "outline", size: "md" };
      const variant = ButtonSpec.variants.outline;
      const size = ButtonSpec.sizes.md;

      const shapes = ButtonSpec.render.shapes(props, variant, size, "default");

      const borderShape = shapes.find((s) => s.type === "border");
      expect(borderShape).toBeDefined();
      expect(borderShape?.borderWidth).toBe(1);
    });

    it("children이 있으면 text shape 포함", () => {
      const props = { variant: "primary", size: "md", children: "Submit" };
      const variant = ButtonSpec.variants.primary;
      const size = ButtonSpec.sizes.md;

      const shapes = ButtonSpec.render.shapes(props, variant, size, "default");

      const textShape = shapes.find((s) => s.type === "text");
      expect(textShape).toBeDefined();
      expect(textShape?.text).toBe("Submit");
    });

    it("focusVisible state에서 올바른 처리", () => {
      const props = { variant: "primary", size: "md", children: "Focus" };
      const variant = ButtonSpec.variants.primary;
      const size = ButtonSpec.sizes.md;

      // focusVisible state 지원 확인
      const shapes = ButtonSpec.render.shapes(
        props,
        variant,
        size,
        "focusVisible",
      );
      expect(shapes.length).toBeGreaterThan(0);
    });
  });
});
```

#### 10.5.3 Integration Test 범위

```typescript
// packages/specs/tests/integration/ReactRenderer.test.ts

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { renderToReact } from "../../src/renderers/ReactRenderer";
import { ButtonSpec } from "../../src/components/Button.spec";

describe("ReactRenderer Integration", () => {
  it("renderToReact가 올바른 className 반환", () => {
    const result = renderToReact(ButtonSpec, {
      variant: "primary",
      size: "md",
    });

    expect(result.className).toBe("react-aria-Button");
  });

  it("data-* 속성이 올바르게 설정됨", () => {
    const result = renderToReact(ButtonSpec, {
      variant: "primary",
      size: "lg",
    });

    expect(result.dataAttributes["data-variant"]).toBe("primary");
    expect(result.dataAttributes["data-size"]).toBe("lg");
  });
});
```

#### 10.5.4 Visual Regression Test (확장)

```typescript
// packages/specs/tests/visual/consistency.test.ts

import { test, expect } from "@playwright/test";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

test.describe("React ↔ CanvasKit Visual Consistency", () => {
  const MAX_DIFF_PERCENT = 1; // 최대 1% 차이 허용

  test("Button primary/md가 일치함", async ({ page }) => {
    // React 버전 캡처
    await page.goto("/test/button-react?variant=primary&size=md");
    const reactScreenshot = await page
      .locator(".react-aria-Button")
      .screenshot();

    // CanvasKit 버전 캡처
    await page.goto("/test/button-canvas?variant=primary&size=md");
    await page.waitForFunction(() => (window as any).__canvasKitReady === true);
    const canvasKitScreenshot = await page
      .locator("canvas[data-skia-overlay]")
      .screenshot();

    // 픽셀 비교
    const reactImg = PNG.sync.read(reactScreenshot);
    const canvasKitImg = PNG.sync.read(canvasKitScreenshot);

    const diff = new PNG({ width: reactImg.width, height: reactImg.height });
    const numDiffPixels = pixelmatch(
      reactImg.data,
      canvasKitImg.data,
      diff.data,
      reactImg.width,
      reactImg.height,
      { threshold: 0.1 },
    );

    const totalPixels = reactImg.width * reactImg.height;
    const diffPercent = (numDiffPixels / totalPixels) * 100;

    expect(diffPercent).toBeLessThan(MAX_DIFF_PERCENT);
  });
});
```

#### 10.5.5 테스트 커버리지 목표

| 영역                  | 최소 커버리지 | 목표 커버리지 |
| --------------------- | ------------- | ------------- |
| types/\*.ts           | 100%          | 100%          |
| primitives/\*.ts      | 100%          | 100%          |
| renderers/\*.ts       | 80%           | 90%           |
| components/\*.spec.ts | 80%           | 95%           |
| adapters/\*.ts        | 70%           | 85%           |
| **전체**              | **80%**       | **90%**       |

#### 10.5.6 CI 테스트 파이프라인

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm --filter @composition/specs test:coverage
      - uses: codecov/codecov-action@v3

  visual-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm --filter @composition/specs build
      - run: npx playwright install --with-deps
      - run: pnpm --filter @composition/specs test:visual
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: visual-diff-report
          path: packages/specs/test-results/
```

---

## 11. 마이그레이션 전략

### 11.1 점진적 마이그레이션

```
기존 코드와 병행 운영:

1. Spec이 없는 컴포넌트: 기존 방식 유지
2. Spec이 있는 컴포넌트: 새 방식 사용
3. Feature flag로 전환 제어

// 예시
const USE_SPEC_RENDERER = {
  Button: true,
  TextField: true,
  Table: false, // 아직 마이그레이션 안 됨
};

function ElementSpriteButton({ element }) {
  if (USE_SPEC_RENDERER.Button) {
    return <SkiaButtonFromSpec element={element} />;  // CanvasKit 렌더링
  }
  return <LegacyPixiButton element={element} />;  // Phase 1-4 레거시
}
```

### 11.2 롤백 계획

```
문제 발생 시:

1. Feature flag OFF → 기존 방식으로 즉시 롤백
2. Spec 버그 수정 후 재배포
3. Visual Regression Test로 검증
4. Feature flag ON
```

### 11.3 성공 기준

| 기준              | 목표                                       | 측정 방법               |
| ----------------- | ------------------------------------------ | ----------------------- |
| 시각적 일치율     | > 95%                                      | Playwright 픽셀 비교    |
| 성능              | 60fps 유지                                 | Chrome DevTools         |
| 번들 크기         | +10% 이하                                  | webpack-bundle-analyzer |
| 테스트 커버리지   | > 80%                                      | Vitest                  |
| 마이그레이션 완료 | 73개 전체 (작성 당시 기준, 현재 75개 Spec) | 체크리스트              |

---

## 부록

### A. 전체 컴포넌트 목록 (73개 -- 작성 당시 기준, 현재 75개 Spec 파일)

<details>
<summary>클릭하여 펼치기</summary>

| #   | 컴포넌트          | Phase | 복잡도    |
| --- | ----------------- | ----- | --------- |
| 1   | Button            | 1     | 중간      |
| 2   | Badge             | 1     | 낮음      |
| 3   | Card              | 1     | 중간      |
| 4   | Link              | 1     | 낮음      |
| 5   | Separator         | 1     | 낮음      |
| 6   | ToggleButton      | 1     | 중간      |
| 7   | ToggleButtonGroup | 1     | 높음      |
| 8   | Tooltip           | 1     | 중간      |
| 9   | Popover           | 1     | 중간      |
| 10  | Dialog            | 1     | 높음      |
| 11  | TextField         | 2     | 중간      |
| 12  | TextArea          | 2     | 중간      |
| 13  | NumberField       | 2     | 중간      |
| 14  | SearchField       | 2     | 중간      |
| 15  | Checkbox          | 2     | 중간      |
| 16  | CheckboxGroup     | 2     | 높음      |
| 17  | Radio             | 2     | 중간      |
| 18  | RadioGroup        | 2     | 높음      |
| 19  | Switch            | 2     | 중간      |
| 20  | Select            | 2     | 높음      |
| 21  | ComboBox          | 2     | 높음      |
| 22  | ListBox           | 2     | 높음      |
| 23  | Slider            | 2     | 높음      |
| 24  | Meter             | 2     | 중간      |
| 25  | ProgressBar       | 2     | 중간      |
| 26  | Form              | 2     | 낮음      |
| 27  | Label             | 2     | 낮음      |
| 28  | Table             | 3     | 매우 높음 |
| 29  | Tree              | 3     | 높음      |
| 30  | Tabs              | 3     | 높음      |
| 31  | Menu              | 3     | 높음      |
| 32  | Breadcrumbs       | 3     | 중간      |
| 33  | Pagination        | 3     | 중간      |
| 34  | TagGroup          | 3     | 중간      |
| 35  | GridList          | 3     | 높음      |
| 36  | Disclosure        | 3     | 중간      |
| 37  | DisclosureGroup   | 3     | 높음      |
| 38  | Toolbar           | 3     | 중간      |
| 39  | Toast             | 3     | 중간      |
| 40  | Panel             | 3     | 중간      |
| 41  | Group             | 3     | 낮음      |
| 42  | Slot              | 3     | 낮음      |
| 43  | Skeleton          | 3     | 낮음      |
| 44  | DropZone          | 3     | 중간      |
| 45  | FileTrigger       | 3     | 중간      |
| 46  | ScrollBox         | 3     | 높음      |
| 47  | MaskedFrame       | 3     | 높음      |
| 48  | Avatar            | 3     | 낮음      |
| 49  | IconButton        | 3     | 중간      |
| 50  | Spinner           | 3     | 낮음      |
| 51  | Alert             | 3     | 중간      |
| 52  | DatePicker        | 4     | 매우 높음 |
| 53  | DateRangePicker   | 4     | 매우 높음 |
| 54  | DateField         | 4     | 높음      |
| 55  | TimeField         | 4     | 높음      |
| 56  | Calendar          | 4     | 높음      |
| 57  | RangeCalendar     | 4     | 높음      |
| 58  | ColorPicker       | 4     | 매우 높음 |
| 59  | ColorField        | 4     | 높음      |
| 60  | ColorSlider       | 4     | 높음      |
| 61  | ColorArea         | 4     | 높음      |
| 62  | ColorWheel        | 4     | 높음      |
| 63  | ColorSwatch       | 4     | 중간      |
| 64  | ColorSwatchPicker | 4     | 중간      |
| 65  | List              | 4     | 중간      |
| 66  | Input             | 4     | 낮음      |
| 67  | FancyButton       | 4     | 중간      |
| 68  | Switcher          | 4     | 중간      |
| 69  | Modal             | 4     | 높음      |
| 70  | Drawer            | 4     | 높음      |
| 71  | Accordion         | 4     | 중간      |
| 72  | Overlay           | 4     | 중간      |
| 73  | Autocomplete      | 2     | 높음      |

</details>

### B. React Aria DOM 구조 레퍼런스

> 이관일: 2026-03-03 (COMPONENT_SPEC.md에 통합) — 50개 React Aria Components의 실제 DOM 구조

<details>
<summary>클릭하여 펼치기</summary>

#### B.1 Form/Input 컴포넌트

##### Button

```html
<button
  class="react-aria-Button"
  data-hovered
  data-pressed
  data-focused
  data-focus-visible
  data-disabled
  data-pending
>
  {children}
</button>
```

| 속성 | data-\*    | Render Props                                                             |
| ---- | ---------- | ------------------------------------------------------------------------ |
| 루트 | `<button>` | `isHovered, isPressed, isFocused, isFocusVisible, isDisabled, isPending` |

##### ToggleButton

```html
<button
  class="react-aria-ToggleButton"
  data-selected
  data-hovered
  data-pressed
  data-focused
  data-focus-visible
  data-disabled
>
  {children}
</button>
```

| 속성 | data-\*    | Render Props                           |
| ---- | ---------- | -------------------------------------- |
| 루트 | `<button>` | Button + `isSelected` (isPending 제외) |

##### TextField

```html
<div
  class="react-aria-TextField"
  data-disabled
  data-invalid
  data-readonly
  data-required
>
  <label class="react-aria-Label">...</label>
  <input
    class="react-aria-Input"
    data-hovered
    data-focused
    data-focus-visible
    data-disabled
    data-invalid
  />
  <div slot="description">...</div>
  <div class="react-aria-FieldError">...</div>
</div>
```

| 하위 컴포넌트      | HTML      | data-\* 속성                                       |
| ------------------ | --------- | -------------------------------------------------- |
| TextField (root)   | `<div>`   | disabled, invalid, readonly, required              |
| Label              | `<label>` | -                                                  |
| Input              | `<input>` | hovered, focused, focus-visible, disabled, invalid |
| Text (description) | `<div>`   | -                                                  |
| FieldError         | `<div>`   | -                                                  |

##### NumberField

```html
<div class="react-aria-NumberField" data-disabled data-invalid data-required>
  <label class="react-aria-Label">...</label>
  <div
    class="react-aria-Group"
    role="group"
    data-hovered
    data-focus-within
    data-focus-visible
    data-disabled
    data-invalid
  >
    <button slot="decrement">-</button>
    <input class="react-aria-Input" />
    <button slot="increment">+</button>
  </div>
  <div class="react-aria-FieldError">...</div>
</div>
```

##### SearchField

```html
<div
  class="react-aria-SearchField"
  data-empty
  data-disabled
  data-invalid
  data-readonly
  data-required
>
  <label class="react-aria-Label">...</label>
  <input class="react-aria-Input" type="search" />
  <button class="react-aria-Button">X (clear)</button>
  <div class="react-aria-FieldError">...</div>
</div>
```

##### Checkbox

```html
<label
  class="react-aria-Checkbox"
  data-selected
  data-indeterminate
  data-hovered
  data-pressed
  data-focused
  data-focus-visible
  data-disabled
  data-readonly
  data-invalid
  data-required
>
  <input type="hidden" />
  <div class="indicator"><svg>...</svg></div>
  {children (label text)}
</label>
```

##### CheckboxGroup

```html
<div
  class="react-aria-CheckboxGroup"
  data-disabled
  data-readonly
  data-required
  data-invalid
>
  <label class="react-aria-Label">...</label>
  <label class="react-aria-Checkbox">...</label>
  <label class="react-aria-Checkbox">...</label>
  <div class="react-aria-FieldError">...</div>
</div>
```

##### RadioGroup + Radio

```html
<div
  class="react-aria-RadioGroup"
  data-orientation
  data-disabled
  data-readonly
  data-required
  data-invalid
>
  <label class="react-aria-Label">...</label>
  <label
    class="react-aria-Radio"
    data-selected
    data-hovered
    data-pressed
    data-focused
    data-focus-visible
    data-disabled
    data-readonly
    data-invalid
    data-required
  >
    <input type="radio" hidden />
    <div class="indicator">...</div>
    {children}
  </label>
</div>
```

##### Switch

```html
<label
  class="react-aria-Switch"
  data-selected
  data-hovered
  data-pressed
  data-focused
  data-focus-visible
  data-disabled
  data-readonly
>
  <input type="hidden" />
  <div class="indicator">{track + thumb}</div>
  {children (label text)}
</label>
```

##### Slider

```html
<div class="react-aria-Slider" data-orientation data-disabled>
  <label class="react-aria-Label">...</label>
  <output class="react-aria-SliderOutput">50</output>
  <div
    class="react-aria-SliderTrack"
    data-hovered
    data-disabled
    data-orientation
  >
    <div
      class="react-aria-SliderThumb"
      data-dragging
      data-hovered
      data-focused
      data-focus-visible
      data-disabled
    >
      <input type="hidden" />
    </div>
  </div>
</div>
```

##### Form

```html
<form class="react-aria-Form">{children}</form>
```

#### B.2 Selection/Collection 컴포넌트

##### Select

```html
<div class="react-aria-Select">
  <label>...</label>
  <button>
    <span class="react-aria-SelectValue" data-placeholder>선택된 값</span>
    <span aria-hidden="true">▼</span>
  </button>
  <!-- Popover (portal) -->
  <div class="react-aria-Popover" data-trigger="Select">
    <div role="listbox">
      <div
        role="option"
        data-selected
        data-focused
        data-disabled
        data-hovered
        data-focus-visible
      >
        항목
      </div>
    </div>
  </div>
</div>
```

##### ComboBox

```html
<div class="react-aria-ComboBox" data-open data-disabled>
  <label>...</label>
  <div>
    <input
      role="combobox"
      aria-expanded
      aria-autocomplete
      aria-activedescendant
    />
    <button>▼</button>
  </div>
  <div class="react-aria-Popover" data-trigger="ComboBox">
    <div role="listbox">
      <div role="option">항목</div>
    </div>
  </div>
</div>
```

##### ListBox

```html
<div
  role="listbox"
  class="react-aria-ListBox"
  data-focus-visible
  data-empty
  data-layout
  data-orientation
>
  <div
    role="option"
    data-selected
    data-focused
    data-focus-visible
    data-hovered
    data-pressed
    data-disabled
    data-dragging
    data-drop-target
  >
    <span slot="label">레이블</span>
    <span slot="description">설명</span>
  </div>
</div>
```

##### Menu

```html
<div role="menu" class="react-aria-Menu" data-empty>
  <div
    role="menuitem"
    data-focused
    data-hovered
    data-pressed
    data-disabled
    data-open
    data-selected
    data-selection-mode
  >
    <span slot="label">메뉴 항목</span>
    <kbd class="react-aria-Keyboard">⌘C</kbd>
  </div>
  <hr class="react-aria-Separator" />
</div>
```

| ARIA role 변형     | 조건                     |
| ------------------ | ------------------------ |
| `menuitem`         | 기본 (선택 모드 없음)    |
| `menuitemcheckbox` | selectionMode="multiple" |
| `menuitemradio`    | selectionMode="single"   |

##### Tabs

```html
<div class="react-aria-Tabs" data-orientation="horizontal">
  <div role="tablist" data-orientation="horizontal">
    <div role="tab" data-selected data-hovered data-focus-visible data-disabled>
      탭 1
    </div>
    <div role="tab">탭 2</div>
  </div>
  <div role="tabpanel" data-focus-visible data-entering data-exiting>
    탭 콘텐츠
  </div>
</div>
```

##### TagGroup

```html
<div class="react-aria-TagGroup">
  <label>태그</label>
  <div class="react-aria-TagList">
    <div
      class="react-aria-Tag"
      data-selected
      data-focused
      data-focus-visible
      data-hovered
      data-pressed
      data-disabled
    >
      태그 텍스트
      <button slot="remove">✕</button>
    </div>
  </div>
</div>
```

##### GridList

```html
<div
  role="grid"
  class="react-aria-GridList"
  data-layout
  data-focus-visible
  data-empty
  data-drop-target
>
  <div
    role="row"
    data-selected
    data-focus-visible
    data-pressed
    data-disabled
    data-dragging
    data-drop-target
  >
    <div role="gridcell">
      <input type="checkbox" slot="selection" />
      항목 텍스트
    </div>
  </div>
</div>
```

##### Table

```html
<table class="react-aria-Table">
  <thead>
    <tr>
      <th data-pressed data-sort-direction data-focus-visible>
        컬럼명
        <div
          class="react-aria-ColumnResizer"
          data-resizable-direction
          data-resizing
        />
      </th>
    </tr>
  </thead>
  <tbody data-empty data-drop-target>
    <tr
      data-selected
      data-focus-visible
      data-pressed
      data-disabled
      data-dragging
      data-drop-target
    >
      <td data-focus-visible>셀 값</td>
    </tr>
  </tbody>
</table>
```

##### Tree

```html
<div
  role="treegrid"
  class="react-aria-Tree"
  data-focus-visible
  data-empty
  data-drop-target
>
  <div
    role="row"
    data-expanded
    data-has-child-items
    data-selected
    data-focus-visible
    data-pressed
    data-disabled
  >
    <div role="gridcell">
      <button slot="chevron">▶</button>
      <input type="checkbox" slot="selection" />
      노드 이름
    </div>
  </div>
</div>
```

##### Breadcrumbs

```html
<ol class="react-aria-Breadcrumbs">
  <li class="react-aria-Breadcrumb">
    <a
      class="react-aria-Link"
      data-current
      data-hovered
      data-focus-visible
      data-disabled
    >
      현재 페이지
    </a>
  </li>
</ol>
```

##### Toolbar

```html
<div
  role="toolbar"
  class="react-aria-Toolbar"
  data-orientation
  aria-label="도구모음"
>
  <div role="group">{controls}</div>
  <hr class="react-aria-Separator" />
</div>
```

#### B.3 Overlay 컴포넌트

##### Dialog

```html
<div role="dialog" class="react-aria-Dialog">
  <h2 slot="title">제목</h2>
  {content}
  <button slot="close">닫기</button>
</div>
```

##### Popover

```html
<div
  class="react-aria-Popover"
  data-placement
  data-entering
  data-exiting
  data-trigger
>
  <div class="react-aria-OverlayArrow"><svg /></div>
  {content}
</div>
```

##### Tooltip

```html
<div class="react-aria-Tooltip" data-placement data-entering data-exiting>
  <div class="react-aria-OverlayArrow" />
  {content}
</div>
```

##### Modal / ModalOverlay

```html
<div class="react-aria-ModalOverlay" data-entering data-exiting>
  <div class="react-aria-Modal" data-entering data-exiting>
    {Dialog content}
  </div>
</div>
```

#### B.4 Date/Time 컴포넌트

##### DateField / TimeField

```html
<div class="react-aria-DateField">
  <label class="react-aria-Label">...</label>
  <div class="react-aria-DateInput" data-focus-within data-invalid>
    <div
      class="react-aria-DateSegment"
      data-type="year"
      data-placeholder
      data-readonly
      data-focused
    >
      2024
    </div>
    <div class="react-aria-DateSegment" data-type="literal">/</div>
    <div class="react-aria-DateSegment" data-type="month">01</div>
  </div>
  <div class="react-aria-FieldError">...</div>
</div>
```

| DateSegment data-type      | 값                |
| -------------------------- | ----------------- |
| `year`, `month`, `day`     | 날짜 세그먼트     |
| `hour`, `minute`, `second` | 시간 세그먼트     |
| `dayPeriod`                | AM/PM             |
| `literal`                  | 구분자 (/, :, 등) |

##### DatePicker

```html
<div class="react-aria-DatePicker">
  <label />
  <div class="react-aria-Group">
    <div class="react-aria-DateInput">{segments}</div>
    <button>📅</button>
  </div>
  <div class="react-aria-Popover" data-trigger="DatePicker">
    <div class="react-aria-Dialog">
      <div class="react-aria-Calendar">
        <header>
          <button slot="previous" />
          <h2 class="react-aria-Heading" />
          <button slot="next" />
        </header>
        <table class="react-aria-CalendarGrid">
          ...
        </table>
      </div>
    </div>
  </div>
</div>
```

##### DateRangePicker

```html
<div class="react-aria-DateRangePicker">
  <label />
  <div class="react-aria-Group">
    <div class="react-aria-DateInput" slot="start">{segments}</div>
    <span aria-hidden="true"> -- </span>
    <div class="react-aria-DateInput" slot="end">{segments}</div>
    <button />
  </div>
  <!-- RangeCalendar with data-selection-start, data-selection-end -->
</div>
```

##### Calendar / RangeCalendar

```html
<div class="react-aria-Calendar">
  <header>
    <button slot="previous">◀</button>
    <h2 class="react-aria-Heading">January 2024</h2>
    <button slot="next">▶</button>
  </header>
  <table class="react-aria-CalendarGrid" role="grid">
    <thead class="react-aria-CalendarGridHeader">
      <tr>
        <th class="react-aria-CalendarHeaderCell">Sun</th>
        ...
      </tr>
    </thead>
    <tbody class="react-aria-CalendarGridBody">
      <tr>
        <td class="react-aria-CalendarCell" data-selected data-outside-month>
          1
        </td>
        ...
      </tr>
    </tbody>
  </table>
</div>
```

#### B.5 Color 컴포넌트

##### ColorField

```html
<div class="react-aria-ColorField">
  <label />
  <input class="react-aria-Input" data-focused data-invalid data-disabled />
  <div class="react-aria-FieldError">...</div>
</div>
```

##### ColorPicker (Provider만, 자체 DOM 없음)

```tsx
<ColorPicker value={color} onChange={setColor}>
  <ColorArea />
  <ColorSlider />
  <ColorField />
</ColorPicker>
```

##### ColorArea

```html
<div class="react-aria-ColorArea" data-disabled>
  <div
    class="react-aria-ColorThumb"
    data-dragging
    data-focused
    data-focus-visible
    data-disabled
  />
  <input type="hidden" /><input type="hidden" />
</div>
```

##### ColorSlider

```html
<div class="react-aria-ColorSlider" data-orientation data-disabled>
  <label />
  <output class="react-aria-SliderOutput" />
  <div class="react-aria-SliderTrack">
    <div
      class="react-aria-ColorThumb"
      data-dragging
      data-focused
      data-focus-visible
      data-disabled
    />
  </div>
</div>
```

##### ColorWheel

```html
<div class="react-aria-ColorWheel" data-disabled>
  <div class="react-aria-ColorWheelTrack" />
  <div
    class="react-aria-ColorThumb"
    data-dragging
    data-focused
    data-focus-visible
  />
</div>
```

##### ColorSwatch

```html
<div
  class="react-aria-ColorSwatch"
  role="img"
  aria-roledescription="color swatch"
  aria-label="red"
/>
```

#### B.6 Utility 컴포넌트

##### Link

```html
<a
  class="react-aria-Link"
  data-hovered
  data-pressed
  data-focus-visible
  data-disabled
  data-current
>
  Link text
</a>
```

##### ProgressBar

```html
<div
  class="react-aria-ProgressBar"
  role="progressbar"
  aria-valuenow="50"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuetext="50%"
>
  <label>Loading...</label>
  <span class="value">50%</span>
  <div class="track"><div class="fill" style="width: 50%"></div></div>
</div>
```

##### Meter

```html
<div
  class="react-aria-Meter"
  role="meter"
  aria-valuenow="75"
  aria-valuemin="0"
  aria-valuemax="100"
>
  <label>Storage</label>
  <div class="track"><div class="fill" style="width: 75%"></div></div>
</div>
```

##### Separator

```html
<div
  class="react-aria-Separator"
  role="separator"
  aria-orientation="horizontal"
/>
```

##### Disclosure

```html
<div class="react-aria-Disclosure" data-expanded data-disabled>
  <h3 class="react-aria-Heading">
    <button
      class="react-aria-Button"
      slot="trigger"
      aria-expanded
      aria-controls="[panel-id]"
    >
      Section Title
    </button>
  </h3>
  <div class="react-aria-DisclosurePanel" id="[panel-id]" role="group">
    Panel content
  </div>
</div>
```

##### DropZone

```html
<div
  class="react-aria-DropZone"
  role="button"
  tabindex="0"
  data-focus-visible
  data-drop-target
  data-hovered
  data-focused
  data-disabled
>
  <span slot="label">Drop files here</span>
</div>
```

</details>

### C. ARIA Role 매핑 총표

> 이관일: 2026-03-03 (COMPONENT_SPEC.md에 통합)

| 컴포넌트      | Container Role           | Item Role                                         | 비고                              |
| ------------- | ------------------------ | ------------------------------------------------- | --------------------------------- |
| Button        | -                        | `<button>`                                        | 시맨틱 HTML                       |
| ToggleButton  | -                        | `<button>`                                        | `aria-pressed`                    |
| TextField     | -                        | `<div>` wrapper                                   | Label+Input 연결                  |
| NumberField   | `group` (Group)          | `<div>` wrapper                                   | spinbutton                        |
| SearchField   | -                        | `<div>` wrapper                                   | type="search"                     |
| Checkbox      | -                        | `<label>`                                         | `aria-checked`                    |
| CheckboxGroup | `group`                  | -                                                 | 그룹 래퍼                         |
| RadioGroup    | `radiogroup`             | -                                                 | `aria-checked`                    |
| Switch        | -                        | `<label>`                                         | `role="switch"`                   |
| Slider        | -                        | `<div>`                                           | `role="slider"` (hidden input)    |
| Select        | -                        | `<div>`                                           | ListBox는 `listbox`               |
| ComboBox      | -                        | `<div>`                                           | Input은 `combobox`                |
| ListBox       | `listbox`                | `option`                                          | 표준                              |
| Menu          | `menu`                   | `menuitem` / `menuitemcheckbox` / `menuitemradio` | 선택 모드에 따라                  |
| Tabs          | `tablist`                | `tab` + `tabpanel`                                | Tab-Panel 쌍                      |
| TagGroup      | `grid`                   | `row` > `gridcell`                                | 키보드 탐색                       |
| GridList      | `grid`                   | `row` > `gridcell`                                | 2단 중첩                          |
| Table         | (암시적)                 | `row` > `columnheader` / `gridcell`               | 시맨틱 HTML                       |
| Tree          | `treegrid`               | `row` > `gridcell`                                | `aria-expanded`, `aria-level`     |
| Breadcrumbs   | `nav`                    | `<li>` > `<a>`                                    | `aria-current`                    |
| Toolbar       | `toolbar`                | (다양)                                            | roving tabindex                   |
| Dialog        | `dialog` / `alertdialog` | -                                                 | 포커스 트랩                       |
| Calendar      | -                        | `grid` > `gridcell`                               | 표준 달력                         |
| Disclosure    | -                        | -                                                 | `aria-expanded` + `aria-controls` |
| ProgressBar   | `progressbar`            | -                                                 | `aria-valuenow`                   |
| Meter         | `meter`                  | -                                                 | `aria-valuenow`                   |
| Separator     | `separator`              | -                                                 | `aria-orientation`                |
| DropZone      | `button`                 | -                                                 | 키보드 접근성                     |

### D. 참조 문서

- [ADR-002: Styling Approach](./adr/002-styling-approach.md) - 스타일링 결정
- [ADR-003: Canvas Rendering](./adr/003-canvas-rendering.md) - 캔버스 렌더링 결정
- [CSS_ARCHITECTURE.md](./reference/components/CSS_ARCHITECTURE.md) - CSS 아키텍처
- [React Aria Components 공식 문서](https://react-aria.adobe.com)
- [React Aria 라이브러리 통합 가이드](./reference/components/REACT_ARIA_LIBRARIES.md)
- [React Aria 1.14.0 마이그레이션 기록](./legacy/REACT_ARIA_MIGRATION_1_14.md)

---

## Spec 에러 처리 및 버전 관리

### 에러 처리 정책

ComponentSpec 렌더링 실패 시 fallback 동작:

| 단계                  | 실패 시점                      | fallback 동작                                                         |
| --------------------- | ------------------------------ | --------------------------------------------------------------------- |
| 1. Spec 로드          | `TAG_SPEC_MAP`에 태그 미등록   | BoxSprite 기본 렌더링 (회색 placeholder)                              |
| 2. shapes() 호출      | props/variant/size 미스매치    | 빈 Shape[] 반환 → 빈 노드 렌더 (크기 0 방지: minWidth/minHeight 적용) |
| 3. specShapesToSkia() | Shape → SkiaNodeData 변환 실패 | `console.warn` + 해당 shape skip, 나머지 정상 렌더                    |
| 4. CanvasKit 렌더     | GPU 리소스 부족/Paint 실패     | dirty flag 유지 → 다음 프레임 재시도                                  |

### ComponentSpec 인터페이스 버전 관리

현재 Spec 인터페이스는 **implicit versioning** (파일 수정 시 `@composition/specs` 빌드 필요):

```
Spec 수정 → pnpm --filter @composition/specs build → dist/ 갱신 → Builder 핫리로드
```

**Breaking Change 시 체크리스트:**

1. `packages/specs/src/types/shape.types.ts` — Shape 유니온 변경 시 `specShapeConverter.ts` case 추가 필수
2. `packages/specs/src/types/component.types.ts` — RenderSpec 시그니처 변경 시 75개 spec 파일 일괄 수정
3. `packages/specs/src/types/token.types.ts` — TokenRef 변경 시 tokenResolver.ts + cssVariableReader.ts 동기화
4. 변경 후 반드시 `pnpm --filter @composition/specs build` 실행 (CRITICAL: v1.11에서 발견된 빌드 동기화 이슈 참조)

---

## 변경 이력

| 날짜       | 버전 | 변경 내용                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-01-27 | 1.0  | 초기 설계 문서 작성                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-01-27 | 1.1  | 문서 보완: Shape 타입 확장, TokenRef 타입 강화, Phase 0 검증 게이트, Zustand 연동, 테스트 전략 보강                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-01-27 | 1.2  | 리뷰 반영: states/VariantSpec 역할 분리, ShadowTokens 추가, 컴포넌트 72개 완성, Shape target 속성, TextShape 확장, ContainerLayout grid/position, overlay 설정, 패키지 exports 수정, Visual test 플래키 가드                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-01-27 | 1.3  | 2차 리뷰 반영: (1) ComponentState에 'focusVisible' 추가, (2) Shape 유니온에 ShapeBase 교차 타입 결합, (3) resolveToken에 shadow 카테고리 처리 + shadows primitive 추가, (4) BorderShape.borderWidth로 PIXI 렌더러 통일, (5) 모든 shapes 호출부에 state 파라미터 추가 (기본값 'default'), (6) CSS 생성기에 textHover/borderHover 반영, (7) generateStateStyles가 spec.states를 동적으로 사용, (8) 테스트 코드 state 파라미터 추가 + focusVisible 테스트 케이스                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-01-27 | 1.4  | 3차 리뷰 반영: (1) PixiRenderContext에 state 필드 추가, (2) renderToPixi에서 shapes 호출 시 state 파라미터 전달, (3) generateStateStyles에 hover/focused 상태 처리 추가, (4) StateEffect.boxShadow에 ShadowTokenRef 지원 + resolveBoxShadow 헬퍼 함수 추가, (5) RenderSpec JSDoc에 'focusVisible' 추가                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-01-27 | 1.5  | 4차 리뷰 반영: (1) 디렉토리 구조 effects.ts → shadows.ts 수정, (2) renderers/utils를 tokenResolver.ts 단일 파일로 통일, (3) resolveBoxShadow에서 ShadowTokenRef가 문자열 리터럴 타입임을 반영하여 불필요한 .ref 분기 제거                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-01-27 | 1.6  | 5차 리뷰 반영: (1) 아키텍처 개요 다이어그램 effects.ts → shadows.ts 수정, (2) tokenToCSSVar에 shadow 카테고리 처리 추가                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-01-29 | 1.7  | 하이브리드 레이아웃 엔진 완료 반영: (1) ContainerLayout 인터페이스에 레이아웃 엔진 지원 CSS 속성 추가 (inline-block, flow-root, box-sizing, min/max 크기, overflow-x/y, lineHeight, verticalAlign, visibility, justifySelf), (2) 데이터 흐름 다이어그램에 하이브리드 레이아웃 엔진 계층(BlockEngine/FlexEngine/GridEngine) 추가 및 내부/외부 레이아웃 계층 분리 설명                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-01-29 | 1.8  | Button 구현 점검 — 코드↔문서 동기화: (1) RadiusTokens 값 교정 (md:8→6, lg:12→8, xl:16→12, CSS 변수 기준), (2) typography에 fontWeight/lineHeight 객체 추가, (3) ButtonProps에 text/label 필드 추가 및 style 타입을 Record로 변경, (4) ButtonSpec variants/sizes에 `as TokenRef` 캐스트 추가, (5) lg size borderRadius를 `{radius.lg}`로 수정, (6) disabled state에 pointerEvents 추가, (7) focusVisible outline을 var(--primary) 형식으로 수정, (8) render.shapes에 text 폴백 체인(children → text → label) 반영                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-01-29 | 1.9  | Pixi UI 컴포넌트 CSS 단위 해석 규칙 추가 (Section 4.7.4): (1) typeof === 'number' 패턴 사용 금지 → parseCSSSize() 필수, (2) % / vw / vh는 부모 content area 기준 해석 (parentContentArea = 부모 width - padding - border), (3) padding shorthand(parsePadding) + border width 4방향(parseBorderWidth) 파싱 필수, (4) 적용 필수 컴포넌트 18개 목록 명시, (5) Yoga 경로에서 vh/vw → % 문자열 변환 정책 (styleToLayout.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-01-29 | 1.10 | Button 레이아웃 버그 패치 4건 + 컴포넌트 상태 추적표 (Section 4.7.4.1~4.7.4.4): (1) padding/border 이중 적용 방지 — SELF_PADDING_TAGS(Button, SubmitButton, FancyButton, ToggleButton) + stripSelfRenderedProps (BuilderCanvas.tsx), (2) BlockEngine border-box 크기 계산 — content-box → border-box 변환으로 block/inline-block 요소 겹침 해결 (BlockEngine.ts), (3) baseline 정렬 수정 — VERTICALLY_CENTERED_TAGS(button/fancybutton/togglebutton/input/select) height/2 반환으로 CSS 웹 모드와 동일한 수직 중앙 정렬 (utils.ts), (4) spec 기본 borderWidth 적용 — inline style 미지정 시 variantColors.border 존재하면 1px 기본값 (PixiButton.tsx), (5) 적용 필수 컴포넌트 18개 상태 추적표 추가 — PixiFancyButton/PixiToggleButton은 SELF_PADDING_TAGS 등록 완료, typeof 패턴 전환은 미완료(잔여 작업)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-01-30 | 1.11 | Button auto width 불일치 수정 + Spec 빌드 동기화 규칙 (Section 4.7.4.0): (1) ButtonSpec sizes paddingX 수정 — md:16→24, lg:24→32, xl:32→40 (CSS 토큰과 일치), (2) BUTTON_SIZE_CONFIG paddingLeft/Right 동기화, (3) fontFamily 통일 — Pretendard를 specs fontFamily.sans에 추가, PixiButton·utils.ts·Button.spec.ts에서 specs 상수 참조로 교체, (4) `@composition/specs` 빌드 동기화 규칙 추가 (CRITICAL) — dist/ 미갱신 시 layout↔rendering 값 불일치 발생 사례 문서화, (5) 핵심 원칙에 Build-Sync 추가, (6) 9.3 스크립트 섹션을 실제 tsup 빌드 도구와 동기화, (7) 값 동기화 대상 테이블 (Spec↔Builder 내부 상수↔CSS 토큰) 및 @sync 주석 정책 명시                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-01-30 | 1.12 | Button borderWidth/레이아웃 이중 계산 수정 (Section 4.7.4.4~4.7.4.8): (1) 전 variant에 border/borderHover 추가 — CSS `border: 1px solid`와 동기화 (Button.spec.ts), (2) specDefaultBorderWidth=1 고정 — variant.border 유무 무관 (PixiButton.tsx), (3) borderHoverColor 분리 — hover/pressed 상태 별도 border 색상 (PixiButton.tsx, PixiRenderer.ts), (4) parseBoxModel 폼 요소 기본값 — inline style 미지정 시 BUTTON_SIZE_CONFIG padding/border 적용 (utils.ts), (5) calculateContentWidth 순수 텍스트 반환 — 폼 요소 padding/border를 parseBoxModel으로 분리하여 이중 계산 제거 (utils.ts), (6) 텍스트 측정 엔진 통일 — PixiButton 너비 측정을 Canvas 2D measureTextWidth로 교체 (PixiButton.tsx), (7) createDefaultButtonProps borderWidth:'1px' 기본값 — Style Panel 0 표시 해결 (unified.types.ts), (8) BUTTON_SIZE_CONFIG에 borderWidth:1 필드 추가 (utils.ts), (9) 값 동기화 테이블에 borderWidth 항목 추가                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-01-31 | 1.13 | 버튼 display/레이아웃 버그 수정 5건 (Section 4.7.4.2, 4.7.4.5): (1) parseBoxModel 폼 요소 자동 border-box — 명시적 width/height를 border-box로 취급하여 padding+border 차감 (treatAsBorderBox), PixiButton self-rendering과 BlockEngine content-box 합산 간 이중 계산 해결 (utils.ts), (2) calculateContentHeight에서 padding 이중 계산 제거 — content-box 기준 textHeight만 반환 (utils.ts), (3) Body borderWidth 처리 — renderWithCustomEngine의 availableWidth에서 border 차감 추가, 자식 offset은 padding만 적용 (Yoga가 border offset 자동 처리) (BuilderCanvas.tsx), (4) §4.7.4.2에 v1.13 border-box 참고 추가                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-02-01 | 1.14 | Phase 5+ CanvasKit/Skia 구현 코드 대조 검증 12건 반영: (1) §1 아키텍처 개요 — Skia 렌더링 실제 위치(apps/builder/.../skia/) 명시, (2) §2 렌더러 설명 — CanvasKitRenderer → nodeRenderers.ts 파이프라인 정정, (3) §2 파일 목록 — CanvasKitRenderer.ts → 외부 구현 참조 코멘트, (4) §3 TextShape — "설계 명세 — 인터페이스 적용 예정" 상태 표기, (5) §3 ShadowShape — 실제 구현 위치(skia/types.ts EffectStyle) 명시, (6) §3 BorderShape — "설계 명세 — 인터페이스 적용 예정" 상태 표기, (7) §4 Clipping — clipRect ✅/clipRRect·overflow 미구현 상태 표기, (8) §4 Gradient — 타입별 구현 상태 + fills.ts 라인 참조, (9) §7 색상 변환 — "설계 예시" + Color4f 인라인 사용 명시, (10) §8 렌더러 파일 — 설계 예시 + nodeRenderers.ts 참조, (11) §12 테스트 헬퍼 — "구현 예정 — 현재 미구현" 표기, (12) §12 캐시 전략 — 구현 상태 컬럼 추가(Paint·Paragraph ⚠️ 미구현, Font·Surface·DirtyRect ✅)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-02-02 | 2.0  | **Skia 중심 문서 리팩토링**: (1) 문서 상태를 "Phase 5 구현 완료 (CanvasKit/Skia 렌더링 전환)"로 갱신, (2) 목표 아키텍처를 render.skia 중심으로 변경, (3) 메인 데이터 흐름 다이어그램을 CanvasKit 4-path로 교체하고 기존 3-path를 레거시 접이식 블록으로 이동, (4) 시스템 아키텍처 다이어그램에 skia/ 디렉토리 반영, (5) 디렉토리 구조에 skia/ 18개 파일 목록 추가, (6) §3.5.3을 "CanvasKit/Skia Renderer (Primary)"로 재구조화 — SkiaNodeData 구조, renderNode() 파이프라인, 렌더러 역할 분담 테이블 추가, PixiRenderer 코드를 레거시 접이식 블록으로 이동, (7) Shape 타입 내 Phase 5+ 주석을 본문으로 승격 — TextShape(ParagraphBuilder), ShadowShape(effects.ts), BorderShape(Skia Stroke), GradientShape(fills.ts 구현 상태), overflow(clipRect 구현 완료), (8) §4.5를 "CanvasKit/Skia 렌더링 패턴"으로 교체 — ElementSprite→useSkiaNode→SkiaOverlay 파이프라인 다이어그램, (9) §4.7.4 CSS 단위 규칙을 CanvasKit 중심으로 재구성 — Yoga px 변환 설명을 본문으로, PixiJS 규칙을 레거시 접이식 블록으로, (10) Phase 0 체크리스트 갱신 — CanvasKit 인프라 11개 항목 [x] 완료, (11) Phase 5 체크리스트 갱신 — Skia 인프라 8개 항목 [x] 완료 + 미완료 항목 분리, (12) VRT 섹션을 React ↔ CanvasKit 비교로 전환, (13) 성능 최적화에 Frame Classification(idle/camera-only/content/full) 추가, (14) 테스트 코드 내 PIXI 참조를 CanvasKit으로 교체                                                                                                                                                                |
| 2026-02-04 | 2.1  | 문서 정확성 검증 및 수정 7건: (1) §7.1 컴포넌트 개수 17→16으로 수정, (2) §5.2 TextFieldSpec states 타입 불일치 수정 — focus→focused, invalid 제거, borderColor/borderWidth→outline/outlineOffset (StateEffect 인터페이스 준수), (3) §4.2 ToggleButton/ToggleButtonGroup 상태 "⚠️ 부분"→"✅ 정상" (WebGL container-only 패턴 구현 완료), (4) §3.5.3.1 renderSkiaShape rect case에서 RectShape 타입에 없는 radius 사용 수정 — rect/roundRect case 분리, (5) hexStringToNumber 함수 정의 추가 (PixiRenderer.ts 코드에서 참조되나 미정의), (6) §4.7.4 PixiToggleButtonGroup CSS 단위 파싱 상태 갱신 — "❌"→"✅ 완료" (container-only 패턴, LayoutComputedSizeContext 사용), (7) ToggleButtonGroup WebGL 구현 관련 변경 반영 — PropertyUnitInput 키워드 유닛 버그 수정, styleToLayout.ts formatStyles 캐싱 수정, PixiToggleButtonGroup selection 수정 (eventMode, computedSize > 0 체크)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-02-04 | 2.2  | Phase 0 재점검 — 코드↔문서 동기화 5건: (1) §3.7 Phase 0 체크리스트 항목 1-9 `[x]` 완료 표기 (패키지 생성, 타입 시스템, Primitive 토큰, Token Resolver, React/PixiJS/CSS 렌더러, 빌드 스크립트 모두 구현 확인), 항목 10 단위 테스트는 `[ ]` 유지 (tests/ 디렉토리 미생성), (2) §3.4 shadows.ts 코드 예시 전면 교체 — lightShadows/darkShadows 분리 구조에서 단일 `shadows` 객체로 수정 (Tailwind-style 값), `getShadowToken(name)` 시그니처 수정 (theme 파라미터 제거), `ParsedShadow` 인터페이스 및 `parseShadow()` 함수 추가, (3) §3.4 typography.ts fontFamily.sans에 'Pretendard' 추가 — 실제 코드와 동기화 (v1.11에서 추가되었으나 코드 예시 미반영), (4) §9.3 package.json의 validate:tokens 스크립트에 미구현 주석 추가 (scripts/validate-tokens.ts 파일 미생성)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-02-04 | 2.3  | Card WebGL/Skia 구현 + Body 레이아웃 버그 수정 6건: (1) **PixiCard LayoutComputedSizeContext 패턴 전환** — onLayout+useState(1프레임 지연) → LayoutComputedSizeContext(즉시 반영)로 교체, ToggleButtonGroup과 동일 패턴 (PixiCard.tsx), (2) **Card 다중 텍스트 Skia 렌더링** — ElementSprite.tsx에서 Card 태그 특수 처리, title(fontSize:16,fontWeight:600) + subheading(fontSize:14) + description(fontSize:14) 3개 텍스트 노드 생성, autoCenter:false로 Card 내 수직 스택 위치 유지, (3) **SkiaNodeData.text.autoCenter 필드 추가** — nodeRenderers.ts에 autoCenter 옵션 추가, SkiaOverlay.tsx updateTextChildren()에서 autoCenter:false일 때 maxWidth만 업데이트하고 paddingTop/중앙정렬 스킵, (4) **SkiaOverlay Yoga computed width 우선** — buildSkiaTreeHierarchical에서 c.width(PixiJS visual bounds, stale 가능) 대신 c.\_layout.computedLayout.width(Yoga 즉시값) 우선 사용 (SkiaOverlay.tsx), (5) **renderWithCustomEngine Body 이중 패딩 수정** — 루트 pixiContainer가 이미 contentOffsetX/contentWidth를 적용하므로 Body 자식에 paddingOffset 재적용 방지, availableWidth에 border 차감 추가 (BuilderCanvas.tsx), (6) **blockLayout flexBasis:'100%' 미적용 수정** — styleToLayout이 항상 width:'auto'(truthy) 반환하여 !effectiveLayout.width가 false → width!=='auto' 체크로 교체, Body의 isParentFlexRow에 rootLayout 기본 flexDirection:'row' 반영 (BuilderCanvas.tsx), (7) §4.7.4 컴포넌트 목록에 PixiCard 추가                                                                             |
| 2026-02-05 | 2.4  | **@pixi/layout formatStyles stale 속성 잔류 버그 수정** (BuilderCanvas.tsx): (1) **근본 원인** — `@pixi/layout`의 `formatStyles()`가 `{ ...currentStyles.custom, ...style }`로 merge하여, 새 layout 객체에 미포함된 속성이 이전 값으로 잔류. Body `flex-direction: row→column` 전환 시 `blockLayout`의 `flexBasis:'100%'`가 column 모드에서도 잔류하여 Card 높이가 body 전체로 확대되는 현상 발생 (새로고침 시 `_styles.custom` 초기화로 정상 동작), (2) **수정** — `blockLayoutDefaults = { flexBasis: 'auto', flexGrow: 0 }` 기본값 객체를 containerLayout spread 최선두에 배치하여 매 렌더마다 stale 속성을 명시적 리셋. 이후 `blockLayout`이 필요 시 올바른 값으로 override, (3) **적용 위치 3곳** — top-level `containerLayout` (~line 774), child `childContainerLayout` (~line 812), nested `nestedContainerLayout` (~line 835), (4) **영향 범위** — Card뿐 아니라 BLOCK_TAGS 전체(Panel, Form, Disclosure 등)에 동일 적용, 기존 동작 유지 (blockLayout이 올바른 값으로 override)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-02-05 | 2.5  | **Card children(Button 등) description 겹침 버그 수정** (PixiCard.tsx): (1) **근본 원인** — `calculatedContentHeight`가 텍스트(title, subheading, description)만 계산하고 children(Button 등) 높이를 무시. `cardLayout.height: calculatedContentHeight`로 고정하여 Yoga가 children 배치 공간 부족 → description과 겹침 발생, (2) **수정 — cardLayout 높이 자동 계산** — `height: calculatedContentHeight`(고정) → `height: 'auto'`(Yoga 자동 계산) + `minHeight: calculatedContentHeight`(텍스트 최소 높이 보장)로 변경. children이 있으면 Yoga가 자동으로 높이 확장, 텍스트만 있으면 minHeight로 정확한 크기 유지, (3) **수정 — contentLayout gap 추가** — description과 children-row 사이 `gap: 8` 추가 (headerLayout.marginBottom과 동일 간격), (4) **Skia 렌더링 영향 없음** — `contentMinHeight`(텍스트 기준)는 SkiaOverlay에서 `Math.max(baseHeight, contentMinHeight)` 처리되므로 Yoga computed height가 더 클 때 자동으로 올바른 값 사용                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-02-05 | 2.6  | **ElementsLayer/BodyLayer props 미전달 버그 수정 + SkiaOverlay 빌드 에러** (BuilderCanvas.tsx, SkiaOverlay.tsx): (1) **근본 원인 — ElementsLayer props 누락** — `ElementsLayer`가 내부 `useStore` 구독에서 외부 props(`pageElements`, `bodyElement`, `elementById`, `depthMap`)로 리팩토링되었으나, BuilderCanvas의 `<ElementsLayer>` render call에서 해당 props 미전달 → 모두 `undefined` → `pageElements.filter()` TypeError, body padding/layout 완전 무시, (2) **수정 — ElementsLayer render call 업데이트** — `bodyElement` computation을 BuilderCanvas에 추가, `<ElementsLayer>` render call에 `pageElements`, `bodyElement`, `elementById`, `depthMap` props 전달, (3) **근본 원인 — BodyLayer pageId 누락** — `BodyLayer`가 내부 `useStore(currentPageId)` → `pageId` prop으로 리팩토링되었으나 render call에서 미전달 → `bodyElement` 항상 `undefined` → Skia node 미등록 → body 배경색/border/selection 미표시, (4) **수정 — BodyLayer render call 업데이트** — `<BodyLayer pageId={currentPageId!}>` prop 추가, (5) **SkiaOverlay 빌드 에러** — `currentPageId`가 prop(line 407)과 `useStore`(line 789)에서 중복 선언 → esbuild 에러. 중복 `useStore` 구독 제거로 해결, (6) **공통 패턴** — "내부 store→외부 props 리팩토링 시 render call 업데이트 누락" — 증상: 새로고침하면 정상(store 재구독), 동적 변경 시 비정상(props가 undefined)                                                                                                                                                         |
| 2026-02-06 | 2.7  | **Card display: block 완전 지원** (BuilderCanvas.tsx, PixiCard.tsx, unified.types.ts, utils.ts): (1) **Body 기본값 설정** — `createDefaultBodyProps()`에 `display: 'block'` 추가, Reset 시 컴포넌트 기본값 복원 (`useResetStyles.ts`), (2) **renderWithCustomEngine CONTAINER_TAGS 지원** — Card에 `display: 'block'` 추가 시 children이 외부 형제로 렌더링되는 문제 수정. `isContainerType` 체크 추가, `childElements`/`renderChildElement` props 전달로 children 내부 렌더링 구현. 3단계 nesting 지원 (Card > Panel > Button 등), (3) **Card 기본값 추가** — `createDefaultCardProps()`에 `display: 'block'`, `width: '100%'`, `padding: '12px'` 추가 (Preview CSS와 동기화), (4) **padding 이중 적용 수정** — `calculatedContentHeight` (PixiCard.tsx)와 `calculateContentHeight()` (utils.ts)에서 padding 제외. Yoga/BlockEngine이 별도 padding 추가하므로 content-only 값 반환. minHeight: 60→36 (padding 24px 제외), (5) **CONTAINER_TAGS siblings 자동 재배치** — `renderWithCustomEngine`에서 absolute→relative 위치 변환. flex column 래퍼로 감싸서 Card height 변경 시 siblings 자동 재배치. BlockEngine y→marginTop, x→marginLeft 변환, (6) **최종 결과** — children 내부 렌더링 ✅, padding 정상 적용 ✅, height auto-grow ✅, siblings 자동 재배치 ✅, Preview 일치 ✅                                                                                                                                                                                                                          |
| 2026-02-06 | 2.8  | **Block 레이아웃 라인 기반 렌더링 + Button 계열 사이즈 통일** (BuilderCanvas.tsx, cssVariableReader.ts, PixiToggleButton.tsx): (1) **inline 요소 가로 배치 수정** — `renderWithCustomEngine`에서 같은 y 값을 가진 요소들을 라인(flex row)으로 그룹화. 기존 flex column + marginLeft 방식 → 라인별 flex row + 라인 간 flex column으로 변경하여 계단식 배치 문제 해결, (2) **라인 그룹화 알고리즘** — BlockEngine 결과에서 y 값 기준(EPSILON=0.5) 라인 그룹 생성, x 기준 정렬 후 marginLeft로 간격 표현, 라인 간 marginTop으로 수직 간격 표현, (3) **ToggleButton/ToggleButtonGroup borderRadius 통일** — `TOGGLE_BUTTON_FALLBACKS` borderRadius를 Button과 동일하게 수정 (sm:6→4, md:8→6, lg:10→8), `TOGGLE_BUTTON_SIZE_MAPPING`에 borderRadius CSS 변수 추가, `getToggleButtonSizePreset()`에서 사이즈별 borderRadius 읽기, (4) **Button 계열 통일된 사이즈** — sm(fontSize:14, paddingY:4, paddingX:12, borderRadius:4), md(fontSize:16, paddingY:8, paddingX:24, borderRadius:6), lg(fontSize:18, paddingY:12, paddingX:32, borderRadius:8). Button, ToggleButton, ToggleButtonGroup 모두 동일                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-02-12 | 3.0  | **Phase 6 Spec Shapes → Skia 렌더링 파이프라인 문서화**: (1) 문서 상태를 "Phase 6 Skia Spec 렌더링 구현 완료"로 갱신, (2) 목차에 Phase 6 항목 추가 및 이후 섹션 번호 재조정 (9→10, 10→11), (3) Phase 요약 테이블에 Phase 6 행 추가 (specShapeConverter, line 렌더러, flexDirection 지원), (4) §9 Phase 6 섹션 신규 작성 — 전체 렌더링 흐름 다이어그램 (ComponentSpec → Shape[] → specShapesToSkia → SkiaNodeData → renderNode), Shape 타입 매핑 테이블 (8개 타입), 핵심 파일 구조, specShapeConverter 핵심 로직 (배경 box 추출/target 참조/색상 변환), ElementSprite TAG_SPEC_MAP 통합 코드, flexDirection row/column 지원 (rearrangeShapesForColumn), BlockEngine 통합 (calculateContentHeight/Width), Phase 6 체크리스트 (변환 인프라 9건 + 레이아웃 4건 + 검증 3건 완료)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-02-13 | 3.1  | **ComponentDefinition 재귀 확장 + TagGroup CONTAINER_TAGS 전환** (§9.7): (1) ChildDefinition 재귀 타입 추가 — 기존 2-level (parent + flat children) → 무한 중첩 지원, optional children?: ChildDefinition[] 필드, (2) Factory createElementsFromDefinition 재귀 생성 — processChildren() 재귀 함수로 중첩 자식 일괄 생성, allElementsSoFar 배열로 customId 중복 방지, (3) TagGroup → CONTAINER_TAGS 전환 — TAG_SPEC_MAP에서 TagGroup/TagList 제거, PixiTagGroup 특수 렌더러 사용 중단, BoxSprite 기반 컨테이너로 전환, (4) TagGroup 3-level 계층 정의 — TagGroup(flex column) → Label + TagList(flex row wrap) → Tag×2, styleToLayout.ts에 TagGroup/TagList flex 기본값 추가, (5) Phase 3 §6.1 TagGroup 상태 "⚠️ 부분"→"✅ 정상 (CONTAINER_TAGS 전환)", Phase 3 체크리스트 TagGroup.spec.ts 완료 표기                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-02-15 | 3.2  | **Button 텍스트 줄바꿈 시 높이 확장 (Skia + BlockEngine)**: (1) `measureSpecTextMinHeight()` 헬퍼 — spec shapes 내 텍스트 word-wrap 높이 측정 (ElementSprite.tsx), (2) `contentMinHeight` 패턴 — 다중 줄 시 `specHeight` 확장 + `cardCalculatedHeight` 전파 (ElementSprite.tsx), (3) 다중 줄 텍스트 `paddingTop` 보정 — `(specHeight - wrappedHeight) / 2` 수직 중앙 (ElementSprite.tsx), (4) `updateTextChildren` box 재귀 — specNode 내부 텍스트 크기 갱신 (SkiaOverlay.tsx), (5) **BlockEngine `parseBoxModel` 수정** — 요소 자체 border-box width를 `calculateContentHeight`에 전달, 부모 `availableWidth` 대신 사용하여 올바른 텍스트 줄바꿈 높이 계산 (utils.ts), (6) `styleToLayout` minHeight 기본 사이즈 `'md'`→`'sm'` 수정 (styleToLayout.ts), (7) Flex 경로는 `minHeight` → Yoga, BlockEngine 경로는 `parseBoxModel` → `calculateContentHeight`로 각각 처리, (8) **Button `layout.height` 명시적 설정** — Yoga 리프 노드 `height:'auto'` 자기 강화 방지, `paddingY*2 + lineHeight + borderW*2` 계산 (styleToLayout.ts), (9) 인라인 padding 시 `MIN_BUTTON_HEIGHT` 미적용 — padding:0으로 완전 축소 허용 (utils.ts), (10) `toNum` 함수 0값 버그 수정 — `parseFloat(v) \|\| undefined` → `isNaN` 체크 (styleToLayout.ts)                                                                                                                                                                                                                                                                            |
| 2026-02-19 | 3.3  | **렌더링 엔진 변경 반영 — 문서 갱신**: (1) §4.7.4 CSS 단위 처리 규칙 — `Yoga` → `Taffy/Dropflow` 레이아웃 엔진, `parseCSSSize()` → `resolveCSSSizeValue()` + `CSSValueContext` 통합 파서 (cssValueParser.ts), 단위 테이블에 em/calc()/fit-content 추가, (2) §4.7.4.1 이중 padding 방지 — `SELF_PADDING_TAGS` + `stripSelfRenderedProps()` → `enrichWithIntrinsicSize()` + `parseBoxModel()` + `INLINE_BLOCK_TAGS` 패턴으로 교체, 레거시 코드를 접이식 블록으로 이동, (3) §9.3.4 레이아웃 통합 — `styleToLayout.ts` (Yoga) → `engines/utils.ts`의 `enrichWithIntrinsicSize()` (Taffy/Dropflow 공용), (4) §9.4 flexDirection:column — `styleToLayout.ts` 크기 계산 → `engines/utils.ts`의 `enrichWithIntrinsicSize()`, BlockEngine → DropflowBlockEngine, (5) §9.5 수정 파일 목록 — `layout/styleToLayout.ts` → `layout/engines/utils.ts` 참조 갱신, (6) §9.7 TagGroup — `Yoga flex layout (styleToLayout.ts)` → `Taffy flex layout (TaffyFlexEngine)`, styleToLayout.ts 파일 참조 제거, (7) §4.7.7 파일 목록 — SELF_PADDING_TAGS 참조에 대체 패턴 주석 추가, (8) Checkbox/Radio shapes 비교 테이블 — `Yoga 높이` → `엔진 계산 높이`                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-02-19 | 3.4  | **§9.8 CONTAINER_TAGS 계층 선택(Drill-Down) 아키텍처 섹션 신규 작성**: (1) 설계 원칙 — 웹 컴포넌트 DOM 계층 = 캔버스 요소 계층 1:1 일치, (2) editingContextId 기반 계층 선택 메커니즘 — resolveClickTarget 알고리즘 + 더블클릭 enterEditingContext + Escape exitEditingContext + Layer Tree 자동 동기화, (3) 캔버스 이벤트 처리 구조 — CanvasKit(시각) + PixiJS alpha=0(이벤트) 이중 레이어, EventBoundary 히트테스팅, (4) 13개 CONTAINER_TAGS 구조적 일관성 현황 테이블 — Group/ToggleButtonGroup/TagGroup 정상, Card/Panel/Form/Dialog/Modal/Disclosure 등 Factory/Renderer 미비 현황 명시, (5) 웹 컴포넌트 구조 동일성 가이드라인 — 7개 체크리스트 + 5개 구조 동일성 원칙                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-02-19 | 3.5  | **§9.8.6 Pixi UI 컴포넌트 Skia 전환 현황**: 62개 전수 조사 — A등급(투명 히트영역, 전환 완료) 12개, B등급(WebGL 드로잉 잔존, 전환 필요) 47개, C등급(Dead Code) 1개. A등급 목표 패턴(PixiButton 참조) 문서화. B등급 47개 재작성 로드맵                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-02-19 | 3.7  | **문서 품질 검토 21건 수정**: (1) **CRITICAL** — §10.4/10.5 하위 10개 소섹션 번호 `9.x.x`→`10.x.x` 수정, 변경 이력 v3.0-3.6 시간순 정렬, 성공 기준 컴포넌트 수 72→73, Token Resolver `shadows.dark/light`→단일 `shadows` 객체, (2) **레거시 축소** — PixiRenderer 코드 블록 ~330줄→~30줄 핵심 인터페이스만 유지, parseCSSSize 레거시 패턴 ~55줄→폐기 요약 10줄, Phase 1-4 테스트 코드를 CanvasKit 기반으로 교체, waitForPixiRender→waitForCanvasKitRender, (3) **불일치 수정** — Shape→API 테이블 "현재 PixiJS"→"레거시 PixiJS"로 헤더 수정, 삭제된 eventBridge.ts/dirtyRectTracker.ts 디렉토리 구조에서 정리, roundRect per-corner radius TODO 추가, (4) **누락 보완** — Taffy(Flex/Grid) vs Dropflow(Block/Inline) 역할 분담 테이블 추가, GradientShape→SkiaNodeData 매핑 테이블 추가, \_\_canvasKitReady 플래그 설정 위치 설명 추가, §4.7.4 관련 파일 정리 블록 추가, (5) **구조 개선** — §9.4 flexDirection에 레이아웃 아키텍처 교차 참조 추가, CSS 단위 파싱 관련 파일 3종 정리 블록으로 혼동 방지, §10.4.1 다이어그램 PIXI→CanvasKit/Skia Renderer 수정                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-02-19 | 3.6  | **웹 컴포넌트 전수 교차 대조**: (1) `packages/shared/src/components/` 60개 vs 설계 문서 대조 — 58/60 정상 등록(96.7%), (2) **Autocomplete 누락 발견** — SearchField+Menu 복합 컴포넌트, Pixi 파일·TAG_SPEC_MAP 모두 미등록. Phase 2 §5.1에 16번째 컴포넌트로 추가, 부록 A에 #73으로 추가, §9.8.6에 미구현 섹션 추가, (3) Breadcrumb.tsx는 Breadcrumbs 하위 아이템 컴포넌트로 독립 등록 불필요 확인, (4) 부록 A 전체 컴포넌트 수 72→73개로 갱신                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-02-21 | 3.8  | **§9.9 Tabs 컨테이너 렌더링 정합성**: (1) `Tabs.spec.ts` — fontSize TokenRef → 숫자 변환, CSS 기준 사이즈(sm=25/md=30/lg=35), `_tabLabels` prop, 콘텐츠 기반 탭 너비 추정, (2) `engines/utils.ts` — Tabs 전용 `calculateContentHeight` (tabBar + tabPanelPadding + Panel), Panel 케이스를 childElements 블록 밖으로 이동, (3) `BuilderCanvas.tsx` — CONTAINER_TAGS에 'Tabs' 추가, Tabs 컨테이너 핸들러 (Panel 필터링, paddingTop=tabBar+padding), (4) `ui/PixiTabs.tsx` — childElements/renderChildElement props로 활성 Panel 내부 렌더링, (5) `sprites/ElementSprite.tsx` — effectiveElementWithTabs 전파 (skiaNodeData useMemo 전체), Panel-in-Tabs skip 제거. §9.9 섹션 신규 작성 — CSS Preview 구조, WebGL Canvas 렌더링 구조, 높이 계산 흐름, 핵심 패턴 4가지                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-02-21 | 3.9  | **§9.10 Card 컨테이너 렌더링 아키텍처 + border-box 정합성**: (1) **Card Description TextSprite 전환** — `TEXT_TAGS`에 `'description'` 추가, Description 태그가 TextSprite 렌더링 파이프라인을 거치도록 활성화 (engines/utils.ts 또는 canvas/constants.ts), (2) **Card childElements 높이 계산** — `calculateContentHeight(Card)`에서 `childElements` 우선 탐색, `Heading.intrinsicHeight + gap + Description.intrinsicHeight` 합산 → 자식이 없으면 스펙 기본값 사용 (engines/utils.ts), (3) **Card/Box/Section enrichWithIntrinsicSize border-box 정합성** — `isTreatedAsBorderBox` 체크 추가, `enrichWithIntrinsicSize()`에서 padding+border 포함 높이 주입 시 `parseBoxModel()`에서 이중 계산 방지 (engines/utils.ts), (4) §9.10 Card 컨테이너 렌더링 아키텍처 섹션 신규 작성 — element tree 구조, TEXT_TAGS 확장, 높이 계산 흐름, border-box 정합성 테이블, (5) §4.7.4.5 Card/Box/Section border-box 처리 보완 설명 추가                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-02-21 | 3.10 | **Switch/Toggle label 줄바꿈 정합성 수정**: (1) `INLINE_FORM_INDICATOR_WIDTHS` switch/toggle 값이 spec trackWidth보다 10px 작아 WebGL Canvas에서 label 줄바꿈 발생 — 26/34/42 → 36/44/52 (sm/md/lg) 수정 (engines/utils.ts), (2) `INLINE_FORM_GAPS` 테이블 신규 추가 — switch/toggle: 8/10/12, checkbox/radio: 6/8/10 (sm/md/lg) (engines/utils.ts), (3) `calculateContentHeight` column 방향 gap 계산을 `INLINE_FORM_GAPS` 기준으로 통일 (engines/utils.ts). §9.3.4 INLINE_FORM dimensions 수정 사실 기록                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-02-21 | 3.11 | **§9.10.5 Card props→children 텍스트 동기화 패턴 추가**: Properties Panel에서 Card Title/Description 변경이 WebGL Canvas에 미반영되는 버그 문서화 및 해결 패턴 기술. 근본 원인: `CardEditor`가 `Card.props.heading/description` 업데이트 → WebGL `TextSprite`는 자식 `Heading.props.children` 참조 → 동기화 부재. 해결: `BuilderCanvas.tsx` `createContainerChildRenderer`에서 cardProps 주입 (Tabs `_tabLabels` 패턴 동일), `LayoutRenderers.tsx` CSS Preview Card 렌더러에 `heading`/`subheading`/`footer` props 추가. 우선순위 규칙 테이블 및 코드 예시 포함                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-02-22 | 3.12 | **§9.11 TagGroup label 두 줄 렌더링 버그 수정**: (1) `TagGroup.spec.ts` — `render.shapes`에서 label 텍스트 shape 제거. 자식 Label 엘리먼트가 렌더링 담당이므로 spec shapes(fontSize:12)와 Label element(fontSize:14)의 이중 렌더링으로 인한 두 줄 표시 현상 제거. (2) `engines/utils.ts` line 759-760 — `calculateContentWidth` 일반 텍스트 경로에 Canvas 2D→CanvasKit 폭 측정 보정(`Math.ceil() + 2`) 추가. INLINE_FORM 경로(line 718-719)와 동일 패턴. §9.11.3 spec shapes label 중복 렌더링 제거 원칙, §9.11.4 Canvas 2D→CanvasKit 폭 보정 패턴 문서화                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-02-22 | 3.13 | **§9.12 Slider Complex Component 전환**: (1) **Slider → Complex Component 전환** — `useElementCreator.ts` complexComponents 배열에 'Slider' 추가, `ComponentFactory.ts` Slider creator 등록, `FormComponents.ts` `createSliderDefinition()` 팩토리 추가. DOM 구조: `Slider > Label + SliderOutput + SliderTrack > SliderThumb`, (2) **TokenRef offsetY NaN 버그 수정** — `Slider.spec.ts` `size.fontSize`(TokenRef 문자열)를 숫자 연산에 직접 사용하여 NaN 발생. `resolveToken()` 호출로 해결. CRITICAL 규칙 추가: spec `shapes()` 내 TokenRef 필드는 숫자 연산 전 `resolveToken()` 필수, (3) **SliderOutput 위치 수정** — `x: width` → `x: 0` + `maxWidth: width`로 컨테이너 내 우측 정렬, (4) **`_hasLabelChild` 패턴 문서화** — Select/ComboBox/Slider 공통 패턴, 자식 element 담당 텍스트를 spec shapes에서 스킵하는 메커니즘, (5) **Slider.css data-attribute 전환** — `.sm`/`.primary` class selector → `[data-size="sm"]`/`[data-variant="primary"]` data-attribute selector, SLIDER_DIMENSIONS spec 정확히 반영 (sm=4/14, md=6/18, lg=8/22), M3 토큰 사용, (6) **unified.types.ts** — Slider 기본 props 수정 (value=50, width=200, height=45, showValue=true, maxWidth=300). §5.1 Slider 상태 "✅ 완전 지원 (Complex Component 전환 완료)"로 갱신. §5.3 Slider.spec.ts 체크리스트 완료 표기                                                                                                                                                                                                          |
| 2026-02-23 | 3.14 | **§9.x Breadcrumbs CONTAINER_TAGS 전환 + Skia 렌더링**: (1) **Breadcrumbs.spec.ts** — `resolveToken` 기반 fontSize 해석, 기본 구분자 `›`, CSS 일치 sizes height (sm:16, md:24, lg:24), (2) **ElementSprite.tsx** — `_crumbs` prop 주입 (자식 Breadcrumb 텍스트 배열 → spec shapes), (3) **BuilderCanvas.tsx** — `CONTAINER_TAGS`에 `'Breadcrumbs'` 추가, `filteredContainerChildren = []` (spec shapes가 크럼 텍스트 직접 렌더링), (4) **utils.ts** — `calculateContentHeight` Breadcrumbs 핸들러 (sm:16, md:24, lg:24), `SPEC_SHAPES_INPUT_TAGS`에 `'breadcrumbs'` 추가, (5) **PixiBreadcrumbs** — Skia spec shapes 전환 완료로 더 이상 사용하지 않음. §6.1 상태 "⚠️ 부분"→"✅ 정상 (CONTAINER_TAGS 전환)", §6.3 체크리스트 완료 표기, §9.8.4 테이블에 Breadcrumbs 행 추가, §9.8.5 전환 완료 목록에 Breadcrumbs 추가                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-02-24 | 3.15 | **§9.13 자식 조합 패턴(Child Composition Pattern) 전체 전환**: (1) **CHILD_COMPOSITION_TAGS 통합 Set** — ElementSprite.tsx에 20개 컴포넌트 등록 (Input Fields 6종, Overlay 4종, Navigation 4종, Groups 2종, Date&Color 4종), `_hasChildren: true` flag 주입으로 spec shapes 조건부 렌더링 (2) **TRANSPARENT_CONTAINER_TAGS 확장** — DateField, TimeField, ColorField, CheckboxGroup, RadioGroup 추가, (3) **Input Field 5종 spec 전환** — NumberField, SearchField, DateField, TimeField, ColorField shapes()에 `_hasChildren` → bg/border만 반환, (4) **Overlay 4종 spec 전환** — Dialog(backdrop+shadow+bg), Popover(shadow+bg+border), Tooltip(bg), Toast(shadow+bg+border+accent bar) 유지, 콘텐츠 스킵, (5) **Navigation 4종 spec 전환** — Menu(shadow+bg+border), Disclosure(bg+border), DisclosureGroup(bg+border), Toolbar(bg+border) 유지, 콘텐츠 스킵, (6) **Groups 2종** — CheckboxGroup, RadioGroup 빈 배열 반환 (transparent container), (7) **Date&Color 4종** — DatePicker, DateRangePicker, Calendar, ColorPicker 배경 shapes 유지 후 복합 콘텐츠 스킵, (8) **BuilderCanvas.tsx props sync 확장** — Input Fields 6종(label→Label), Overlay 4종(heading→Heading, description→Description), (9) **border-box 높이 이중 계산 수정** — calculateContentHeight flex column에서 form element border-box explicit height 감지, padding+border 미추가 (engines/utils.ts), (10) **Dropflow fallback flex 처리** — Taffy WASM 미로드 시 flex-direction row/column + gap 수동 후처리 (engines/index.ts) |
| 2026-02-24 | 3.16 | **§9.13 Opt-In → Opt-Out 아키텍처 전환**: (1) **CHILD_COMPOSITION_TAGS(42개 화이트리스트) → CHILD_COMPOSITION_EXCLUDE_TAGS(5개 블랙리스트)** — 모든 컴포넌트가 기본적으로 자식 조합 허용, Tabs/Breadcrumbs/TagGroup(synthetic prop)/Table/Tree(다단계 중첩)만 제외 (ElementSprite.tsx), (2) **CONTAINER_TAGS(49개 화이트리스트) → NON_CONTAINER_TAGS(~21개 블랙리스트)** — TEXT_TAGS 14개 + Void/Visual 3개 + Color Sub-component 4개만 비컨테이너, 나머지 모두 컨테이너 (BuilderCanvas.tsx), (3) **isContainerTagForLayout() 반전** — `CONTAINER_TAGS.has(tag)` → `!NON_CONTAINER_TAGS.has(tag)`, Section 조건부 로직 유지, (4) **7개 신규 spec `_hasChildren` 추가** — Button, Badge, ToggleButton, Slot, Panel, ProgressBar, Meter (packages/specs/src/components/), (5) **`_hasChildren` 지원 spec 총 49개** (E-1: 20개 + E-2: 22개 + Phase 1: 7개), (6) **전환 동기** — 노코드 빌더에서 DOM+CSS 자유 조합 지원, 3중 수동 등록(CHILD_COMPOSITION_TAGS + CONTAINER_TAGS + spec) 제거, (7) **§9.8.5 체크리스트 업데이트** — `CONTAINER_TAGS 등록` → `NON_CONTAINER_TAGS 미포함 확인`, 규칙 2 NON_CONTAINER_TAGS 반영, (8) **문서 동기화** — SKILL.md opt-out 패턴 반영, CHILD_COMPOSITION_REMAINING.md 완료 보고서 갱신                                                                                                                                                                                                                                                                                    |
| 2026-02-24 | 3.17 | **COMPLEX_COMPONENT_TAGS 공유 상수 도입 + `_hasChildren` 자식 삭제 버그 수정**: (1) **`factories/constants.ts` 신규** — `COMPLEX_COMPONENT_TAGS` Set(40+개 태그) 공유 상수 파일 생성, `useElementCreator.ts`/`ElementSprite.tsx`에서 import, (2) **`ElementSprite.tsx` L1105 조건 수정** — 기존 `!CHILD_COMPOSITION_EXCLUDE_TAGS.has(tag) && childElements && childElements.length > 0` → `!CHILD_COMPOSITION_EXCLUDE_TAGS.has(tag)` 내에서 `COMPLEX_COMPONENT_TAGS.has(tag)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |     | (childElements && childElements.length > 0)`, (3) **`useElementCreator.ts`로컬 배열 → 공유 상수 전환** — 로컬`complexComponents`배열 제거,`COMPLEX_COMPONENT_TAGS`import 후`includes()`→`has()`교체, (4) **버그 수정** — TextField 등 complex component에서 모든 자식을 삭제했을 때`\_hasChildren`이 `false`가 되어 standalone 렌더링(label+input 일체형)이 재활성화되는 현상 수정. 근본 원인: `\_hasChildren`이 런타임 `childElements.length > 0`에만 의존하는 설계 |
| 2026-02-25 | 3.18 | **TokenRef fontSize 산술 연산 버그 전수 수정 + label 렌더링 패턴 추가**: (1) **§9.12.5 확장** — `as unknown as number` 캐스팅이 런타임 NaN을 방지하지 못함을 명시, 영향 범위 19개 이상 spec 파일(Calendar, CheckboxGroup, ColorField, DateField, DatePicker, DateRangePicker, Disclosure, Form, GridList, List, ListBox, Meter, NumberField, Panel, ProgressBar, RadioGroup, SearchField, TagGroup, TextArea, TimeField, Tree) 문서화, 올바른 패턴(rawFontSize → resolvedFs → fallback 16px) 코드 예시 갱신, (2) **§9.12.8 신규 — labelOffset 패턴** — SearchField/NumberField label 렌더링 추가: `resolveToken()` 기반 fontSize → labelFontSize(-2) → labelHeight(\*1.2) → labelOffset 계산, props.label 조건부 text shape 추가 및 이후 모든 shapes에 y+labelOffset 적용, 하드코딩 오프셋(`props.label ? 20 : 0`) 금지 원칙                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-02-25 | 3.19 | **`rearrangeShapesForColumn` + `SPEC_RENDERS_ALL_TAGS_SET` 가드 + `_hasChildren` 패턴 복원**: (1) **§9.12.9 신규** — `SPEC_RENDERS_ALL_TAGS_SET` 가드 문서화: spec shapes()가 자체 y 좌표 레이아웃을 포함하는 컴포넌트(TextField/NumberField/SearchField/DateField/TimeField/ColorField/TextArea/Slider)는 `rearrangeShapesForColumn` 재배치 스킵, ElementSprite.tsx 코드 예시 추가, (2) **`_hasChildren` 패턴 복원 이력** — 에이전트가 무단 삭제한 `_hasChildren` 체크를 13개 파일에서 복원(7개 git checkout 원복, 6개 수동 복원), 컨테이너 컴포넌트(Button, Badge, ToggleButton, Slot, Panel, ProgressBar, Meter, DropZone, FileTrigger, ScrollBox, MaskedFrame, Section, Group) spec에서 `_hasChildren` 체크는 자동 코드 편집 도구가 임의로 제거해서는 안 되는 핵심 로직임을 명시                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-02-25 | 3.20 | **Card bottom padding 이중 적용 수정 + Description 줄바꿈 높이**: (1) **`enrichWithIntrinsicSize` `isTreatedAsBorderBox` 제거** — Card/Box/Section에 CSS padding이 있으면 enrichment에서 padding 추가 제외, 레이아웃 엔진(Taffy)에 위임. 기존: `isTreatedAsBorderBox` 플래그가 `hasCSSVerticalPadding`을 override → border-box 높이 주입 → 엔진이 또 padding 추가 → 이중 적용. 수정: `(!hasCSSVerticalPadding \|\| isInlineBlockTag)` 조건만 사용 (engines/utils.ts), (2) **TaffyFlexEngine border-box→content-box 변환 제거** — enriched height가 content-box이므로 불필요한 padding/border 차감 제거 (TaffyFlexEngine.ts), (3) **TEXT_LEAF_TAGS 텍스트 줄바꿈 높이 측정** — Description/Heading/Label 등 리프 텍스트의 줄바꿈 시 선택 영역 높이가 1줄 고정이던 문제 수정, `measureWrappedTextHeight` 기반 step 4.9 추가 (engines/utils.ts), (4) **Card children availableWidth 보정** — `calculateContentHeight` Card 자식 루프에서 Card padding을 차감한 `childAvailableWidth` 사용 (engines/utils.ts), (5) **LayoutRenderers.tsx Card 중복 렌더링 수정** — Heading/Description 자식을 children에서 필터링 (title/description props로 이미 렌더링됨), (6) **§9.10.4 문서 갱신** — border-box 정합성 → padding/border 주입 규칙으로 재작성, v3.12 수정 반영, §4.7.4.5 갱신                                                                                                                                                                                                                                 |

---

## 12. Compositional Architecture 전환 (2026-02-25)

### 12.1 Monolithic → Compositional 전환 배경

#### 이전 문제 (Monolithic Spec)

```
TextField (parent)
├── spec shapes가 모든 것을 직접 렌더링:
│   ├── Label 텍스트
│   ├── Input 배경/테두리/placeholder
│   └── FieldError 텍스트
├── Factory가 자식 Element(Label, Input, FieldError) 생성
│   └── BUT: SPEC_RENDERS_ALL_TAGS가 childElements=[] 강제
│       → 자식 Element는 store/layer tree에만 존재 (Ghost Elements)
└── 결과: 자식 삭제해도 parent spec이 모든 것을 렌더링 → 시각적 변화 없음
```

이 문제는 9개 compound 컴포넌트에서 동일하게 발생:

- TextField, NumberField, SearchField, TextArea
- DateField, TimeField, ColorField
- Slider (single + range mode)

#### 해결: Compositional Architecture

```
TextField (parent) — spec shapes: 배경/테두리만
├── Label (child Element) — LabelSpec으로 독립 렌더링
├── Input (child Element) — InputSpec으로 독립 렌더링
└── FieldError (child Element) — FieldErrorSpec으로 독립 렌더링

→ 자식 삭제 시 해당 영역이 캔버스에서 즉시 사라짐 ✅
```

### 12.2 주요 변경사항

| 항목                    | 이전                                        | 이후                            |
| ----------------------- | ------------------------------------------- | ------------------------------- |
| `SPEC_RENDERS_ALL_TAGS` | 9개 태그 강제 `childElements=[]`            | **완전 제거**                   |
| `skipChildSpecShapes`   | `backgroundColor === 'transparent'` 시 차단 | **항상 false** (비활성)         |
| `_hasChildren` 판단     | `COMPLEX_COMPONENT_TAGS` 기반 (항상 true)   | 실제 `childElements.length > 0` |
| 자식 Element 배경       | `backgroundColor: 'transparent'` 강제       | 제거 — 자체 spec 렌더링         |
| `elementRemoval.ts`     | 2-phase 상태 업데이트                       | **Atomic 단일 `set()`**         |

### 12.3 신규 Child Spec (7개)

| Spec             | 파일                   | 역할                                         |
| ---------------- | ---------------------- | -------------------------------------------- |
| LabelSpec        | `Label.spec.ts`        | 라벨 텍스트 (sm:12, md:14, lg:16)            |
| FieldErrorSpec   | `FieldError.spec.ts`   | 에러 텍스트 (`'{color.error}'`)              |
| DescriptionSpec  | `Description.spec.ts`  | 설명 텍스트 (`'{color.on-surface-variant}'`) |
| SliderTrackSpec  | `SliderTrack.spec.ts`  | 트랙 바 + fill                               |
| SliderThumbSpec  | `SliderThumb.spec.ts`  | 원형 thumb (primary 색상)                    |
| SliderOutputSpec | `SliderOutput.spec.ts` | 값 텍스트 표시                               |
| DateSegmentSpec  | `DateSegment.spec.ts`  | 날짜/시간 세그먼트 박스 (TimeSegment 공용)   |

### 12.4 영향받은 파일

| 파일                 | 변경                                                                             |
| -------------------- | -------------------------------------------------------------------------------- |
| `BuilderCanvas.tsx`  | `SPEC_RENDERS_ALL_TAGS` 완전 제거, `NON_CONTAINER_TAGS` 확장                     |
| `ElementSprite.tsx`  | `TAG_SPEC_MAP` 7개 추가, `skipChildSpecShapes=false`, `_hasChildren` 로직 간소화 |
| `elementRemoval.ts`  | Atomic state update (단일 `set()` 호출)                                          |
| `FormComponents.ts`  | 13개 자식 Element에서 `backgroundColor: 'transparent'` 제거                      |
| `specs/src/index.ts` | 7개 신규 Spec export 추가                                                        |

### 12.5 검증 결과 (브라우저 전수조사)

| 컴포넌트    | 렌더링                        | Child 삭제        |
| ----------- | ----------------------------- | ----------------- |
| TextField   | ✅ Label + Input 독립         | ✅ 삭제 시 사라짐 |
| SearchField | ✅ Label + Input 독립         | —                 |
| NumberField | ✅ Label + [-]/0/[+] 독립     | —                 |
| Slider      | ✅ Label + Track + Thumb 독립 | —                 |
| DateField   | ✅ Label + Input 독립         | —                 |
| TimeField   | ✅ Label + Input 독립         | —                 |
