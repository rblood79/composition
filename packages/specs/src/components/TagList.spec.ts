/**
 * TagList Component Spec
 *
 * ADR-093 Phase 1 — TagList 중간 컨테이너의 layout primitive (display/flexDirection/flexWrap/gap)
 * SSOT 신설.
 *
 * - composition 자체 추상화: RAC `<TagList>` 에 대응하지만, 이 spec 은 composition
 *   builder 에서 TagGroup > TagList > Tag 3단 구조의 중간 컨테이너 레이어.
 * - CSS 자동 생성: skipCSSGeneration: true — 부모 TagGroupSpec.childSpecs 경로로
 *   부모 TagGroup generated CSS 내부에 inline emit (ADR-078/090/092 패턴 재사용).
 * - Skia consumer: ADR-094 `expandChildSpecs` 자동 등록 → `TAG_SPEC_MAP` /
 *   `LOWERCASE_TAG_SPEC_MAP` / `tagToElement.ts` 모든 소비처 자동 혜택.
 * - render.shapes: () => [] — TagList 자체 시각 없음. Tag 자식이 각자 렌더링.
 *
 * containerStyles: `implicitStyles.ts:574-582` TagList 분기의 display/flexDirection/
 *   flexWrap/gap base primitive 를 Spec SSOT 로 리프팅.
 *   Hard Constraint #2: TagGroup 에는 `orientation` prop 없음 (TagGroup.spec.ts:35 /
 *   GroupComponents.ts:403 확인) → 기본값은 row + wrap (현재 implicitStyles.ts:577 동작 일치).
 *
 * sizes: TagList 는 size prop 없음 (Soft Constraint) → sizes.md only.
 *   borderRadius: "{radius.none}" — CSS Generator undefined 출력 방지 (ADR-092 실수 방지).
 *
 * runtime fork (implicitStyles 잔존):
 *   - `labelPosition === "side"` 시 flex:1/minWidth:0 주입
 *   - Tag 자식 whiteSpace:"nowrap" 주입
 *   - maxRows 근사 계산 (자식 Element 조작, spec 커버 영역 아님 — ADR-093 HC#4)
 *
 * @packageDocumentation
 */

import type { ComponentSpec, TokenRef } from "../types";
import type { StoredTagItem } from "../types/taggroup-items";

/**
 * TagList Props
 *
 * TagList 는 TagGroup 내부의 중간 컨테이너로 composition 이 자동 생성하는 element.
 * size prop 없음 — 부모 TagGroup.size 를 propagation 으로 수신.
 */
export interface TagListProps {
  // 부모 TagGroup 으로부터 propagation 수신 전용
  size?: "sm" | "md" | "lg";
  allowsRemoving?: boolean;
  /**
   * ADR-097 Phase 4A — TagGroup.items SSOT 를 propagation 으로 수신.
   * TagList spec shapes 가 items 기반 chip 을 self-render (ListBox 선례 대칭).
   */
  items?: StoredTagItem[];
  /** 부모 TagGroup 의 variant 전파 — chip 색상 결정 */
  variant?: "default" | "accent" | "neutral" | "negative";
  /** CONTAINER_DIMENSION_TAGS 경유 주입 — chip layout 계산용 */
  _containerWidth?: number;
  _containerHeight?: number;
  style?: Record<string, string | number | undefined>;
}

/**
 * TagList Component Spec
 *
 * archetype: "simple" — SHELL_ONLY_CONTAINER_TAGS 판정 대상 아님 (부모 TagGroup 이 해당).
 * skipCSSGeneration: true — 독립 CSS 파일 emit 중단.
 *   부모 TagGroupSpec.childSpecs 경로로 부모 generated CSS 에만 inline emit.
 * render.shapes: () => [] — Skia shapes 없음 (container shell).
 *
 * containerStyles: ADR-093 — TagList 분기 base primitive 리프팅.
 *   Hard Constraint #2: TagGroup orientation prop 없음 → row+wrap 기본 (현재 runtime 동작 일치).
 *   ADR-094 `expandChildSpecs` 를 통해 `resolveContainerStylesFallback` /
 *   `LOWERCASE_TAG_SPEC_MAP` 자동 주입.
 */
/**
 * TagList variants — spec schema 필드(`variants`)용. TagGroupSpec.variants 1:1 복제
 *   (순환 import 회피). ADR-912 영역 B (A, 2026-06-05): chip self-render 제거 후 본 상수의
 *   시각 소비처(render.shapes)는 사라졌으나, ComponentSpec.variants 는 schema 필수 필드라
 *   유지. chip 색상은 chip projection(Tag.spec.variants)이 단독 결정한다.
 */
const TAG_LIST_VARIANTS = {
  default: {
    fill: {
      default: {
        base: "{color.layer-2}" as TokenRef,
        hover: "{color.layer-1}" as TokenRef,
        pressed: "{color.neutral-subtle}" as TokenRef,
      },
    },
    text: "{color.neutral}" as TokenRef,
    border: "{color.border}" as TokenRef,
  },
  accent: {
    fill: {
      default: {
        base: "{color.accent-subtle}" as TokenRef,
        hover: "{color.accent-subtle}" as TokenRef,
        pressed: "{color.accent-subtle}" as TokenRef,
      },
    },
    text: "{color.neutral}" as TokenRef,
    border: "{color.accent}" as TokenRef,
  },
  neutral: {
    fill: {
      default: {
        base: "{color.neutral-subtle}" as TokenRef,
        hover: "{color.neutral-subtle}" as TokenRef,
        pressed: "{color.neutral-subtle}" as TokenRef,
      },
    },
    text: "{color.neutral}" as TokenRef,
    border: "{color.neutral-subtle}" as TokenRef,
  },
  negative: {
    fill: {
      default: {
        base: "{color.negative-subtle}" as TokenRef,
        hover: "{color.negative-subtle}" as TokenRef,
        pressed: "{color.negative-subtle}" as TokenRef,
      },
    },
    text: "{color.neutral}" as TokenRef,
    border: "{color.negative}" as TokenRef,
  },
} as const;

/**
 * size 별 chip 치수 (TagSpec.sizes sm/md/lg 와 1:1 정합).
 *
 * ADR-912 영역 B (A, 2026-06-05): TagList self-render 제거 후에도 본 상수는
 *   layout 의 `calculateContentHeight` taglist 분기(utils.ts)가 import 하여 chip wrap
 *   기반 컨테이너 높이를 items SSOT 로 계산한다(ListBox/GridList 의 items 기반 height 분기와
 *   동형). chip 시각 자체는 chip projection(Tag.spec)이 그리지만, TagList 컨테이너 높이는
 *   여전히 items × chip 치수 wrap 으로 산출되어야 Taffy 가 행 수를 맞춘다.
 *
 * 치수 공식 (TagSpec 참조):
 *   `height = lineHeight + paddingY * 2`
 *
 * TagSpec sm/md/lg 값과 완전 동일 (chip=button sizing 의도).
 */
export const TAG_CHIP_SIZES = {
  sm: {
    paddingX: 8,
    paddingY: 2,
    fontSize: 12,
    lineHeight: 16,
    borderRadius: 4,
    gap: 4,
  },
  md: {
    paddingX: 12,
    paddingY: 4,
    fontSize: 14,
    lineHeight: 20,
    borderRadius: 6,
    gap: 4,
  },
  lg: {
    paddingX: 16,
    paddingY: 8,
    fontSize: 16,
    lineHeight: 24,
    borderRadius: 8,
    gap: 6,
  },
} as const;

export const TagListSpec: ComponentSpec<TagListProps> = {
  name: "TagList",
  description:
    "TagGroup 내부 중간 컨테이너 — display:flex row+wrap (TagGroup orientation prop 없음 반영)",
  archetype: "simple",
  element: "div",
  // ADR-093: 독립 CSS 파일 emit 중단.
  //   부모 TagGroupSpec.childSpecs 경로로 부모 generated CSS 에만 inline emit.
  skipCSSGeneration: true,

  // ADR-093 Phase 1: implicitStyles.ts TagList 분기(display/flexDirection/flexWrap/gap base)
  //   를 Spec SSOT 로 리프팅. ADR-094 `expandChildSpecs` 를 통해
  //   `resolveContainerStylesFallback` / `LOWERCASE_TAG_SPEC_MAP` 자동 주입.
  //   Hard Constraint #2: TagGroup 에는 orientation prop 없음 → row+wrap 기본값.
  //   runtime fork (labelPosition="side" 시 flex:1/minWidth:0, maxRows, whiteSpace injection)
  //   는 implicitStyles.ts 잔존 (Hard Constraint #4).
  containerStyles: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
  },

  defaultVariant: "default",
  defaultSize: "md",

  variants: TAG_LIST_VARIANTS,

  // sizes: TagList 는 size prop 없음 → sizes.md only (gap 4 = implicitStyles.ts:579 기존값 일치).
  //   borderRadius: "{radius.none}" — CSS Generator undefined 출력 방지 (ADR-092 실수 방지).
  //   ADR-097 Phase 4A: height = 32 (md chip height 근사, single-row 가정).
  //     Phase 4B 에서 items-based row-wrap intrinsic height 계산으로 대체.
  sizes: {
    md: {
      height: 32,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 4,
    },
  },

  states: {
    focusVisible: {
      focusRing: "{focus.ring.default}",
    },
  },

  render: {
    /**
     * ADR-912 영역 B (A) — chip self-render seam 제거 (shell only, 2026-06-05).
     *
     * **이전 (ADR-097 Phase 4A/4B)**: TagList.spec 이 items 를 직접 순회하여 chip bg/border/
     *   text/X + 수동 wrap 시뮬레이션 + maxRows "Show all" 까지 self-render 했다(ListBox 선례
     *   대칭). 이는 "TagList 노드 1개가 모든 chip 을 그리는" dual-render seam — chip 이 독립
     *   render-space 노드가 아니라 hit/per-chip 편집 불가.
     *
     * **현재**: chip 은 `appendTagRowProjection`(canvasSceneNode.ts)이 chip 1개 = projection
     *   node(`type:"Tag"`, `projection:tag-row:`)로 전개한다. 각 chip 시각은 Tag.spec.render.
     *   shapes 가 단독 렌더(bg+text+X). TagList 는 chip 컨테이너 shell 만 담당 → 시각 없음.
     *   wrap 은 projection rowsGroup 의 flexWrap:"wrap" 으로 Taffy 가 배치(수동 시뮬 폐기).
     *
     * **Why shell**: dual-SSOT(TagList self-render ↔ Tag.spec) 제거 = ADR-912 단일 공급원.
     *   self-render 와 projection 공존 시 chip 이 2벌 그려진다 → seam 0 이 kill criteria.
     */
    shapes: () => {
      // chip 시각은 chip projection(Tag.spec)이 단독 담당. TagList 는 컨테이너 shell.
      return [];
    },
    react: () => ({}),
  },
};
