/**
 * SelectTrigger Component Spec
 *
 * Select 컴포넌트의 트리거 버튼 영역 (배경 + 보더)
 * Compositional Architecture: Select의 자식 Element로 독립 렌더링
 *
 * ADR-100 Phase 2 (098-a 슬롯): RSP 네이밍 정합 정당화.
 *
 * composition 내부 식별자 "SelectTrigger" 는 RAC 공식 `<Button>` (slot="trigger")
 * 와 동일 역할. 리네이밍 미수행 근거 3건:
 *
 *  1. **저장 식별자 고유성**: builder element tree 에서 "SelectTrigger" 는 Select
 *     내부 전용 Button 으로 factory/editor/layout 분기가 고유. 일반 "Button" tag
 *     과 통합 시 discriminator (`parent.tag === "Select"` 또는 `slot` prop) 분기
 *     필요 → runtime layout/spec conversion 경로 + factory + editor 모두 복잡도↑.
 *
 *  2. **runtime DOM RSP 정합 이미 달성** (D1 도메인): `packages/shared/src/components
 *     /Select.tsx:309` 에서 RAC `<Button className="react-aria-Button">` 직접 렌더
 *     + `<SelectValue />` 자식 포함. 저장 식별자 수준 rename 과 독립적으로 DOM 층
 *     RSP 정합 완료.
 *
 *  3. **LayerTree UX 명시성**: 사용자가 Select 내부 Button (자동 생성 sub-element)
 *     을 일반 Button element (사용자 추가) 와 시각적으로 구분 가능. "SelectTrigger"
 *     고유 아이콘/라벨 → 학습 비용 감소.
 *
 * 본 정당화는 ADR-098-e (composition 고유 네이밍 정당화 통합 문서) 미발행 상태에서
 * ADR-100 selfcontained 로 포함. 098-e 발행 시 cross-reference 전환.
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import { parsePxValue, parseBorderWidth } from "../primitives";
// ADR-908 Phase 3-A-2: Fill token dual-read seam
import { resolveFillTokens } from "../utils/fillTokens";

export interface SelectTriggerProps {
  variant?: "default" | "accent" | "negative";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  isDisabled?: boolean;
  isInvalid?: boolean;
  /** ElementSprite 주입: 엔진 계산 최종 폭 */
  _containerWidth?: number;
  style?: Record<string, string | number | undefined>;
}

export const SelectTriggerSpec: ComponentSpec<SelectTriggerProps> = {
  name: "SelectTrigger",
  description: "Select 트리거 버튼 영역 (배경 + 보더)",
  element: "button",
  archetype: "button",

  // ADR-083 Phase 8 + ADR-084 Phase A3: button archetype base layout primitive SSOT.
  //   "inline-flex" → "flex" 정정 (Taffy 는 inline-flex 미이해, fit-content + flex 로 시각
  //   equivalent). flexDirection: "row" 명시 추가.
  //   implicitStyles.ts:1256 SelectTrigger 분기의 display/flexDirection/alignItems 직접
  //   할당이 ADR-084 로 해체됨 → Spec 이 3경로(Skia/CSS/Style Panel) 단일 소스.
  containerStyles: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
  },

  defaultVariant: "default",
  defaultSize: "md",

  variants: {
    default: {
      fill: {
        default: {
          base: "{color.layer-2}" as TokenRef,
          hover: "{color.layer-1}" as TokenRef,
          pressed: "{color.layer-1}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.border}" as TokenRef,
      borderHover: "{color.border-hover}" as TokenRef,
    },
    accent: {
      fill: {
        default: {
          base: "{color.layer-2}" as TokenRef,
          hover: "{color.layer-1}" as TokenRef,
          pressed: "{color.layer-1}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.accent}" as TokenRef,
      borderHover: "{color.accent-hover}" as TokenRef,
    },
    negative: {
      fill: {
        default: {
          base: "{color.layer-2}" as TokenRef,
          hover: "{color.negative-subtle}" as TokenRef,
          pressed: "{color.negative-subtle}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.negative}" as TokenRef,
      borderHover: "{color.negative-hover}" as TokenRef,
    },
  },

  // BUTTON_FAMILY_HEIGHTS (primitives/buttonSizes.ts) 와 동일 metric.
  // ADR-091 Phase 3: `contentHeight` = height - 2*paddingY - 2*borderWidth(1)
  //   content-box metric 을 layout 경로에서 계산 없이 직접 lookup. TRIGGER_CONTENT_HEIGHTS
  //   Record 해체 대응.
  sizes: {
    xs: {
      height: 20,
      paddingX: 4,
      paddingY: 1,
      fontSize: "{typography.text-2xs}" as TokenRef,
      borderRadius: "{radius.xs}" as TokenRef,
      iconSize: 10,
      gap: 2,
      contentHeight: 16, // 20 - 1*2 - 1*2
    },
    sm: {
      height: 22,
      paddingX: 8,
      paddingY: 2,
      fontSize: "{typography.text-xs}" as TokenRef,
      borderRadius: "{radius.sm}" as TokenRef,
      iconSize: 14,
      gap: 4,
      contentHeight: 16, // 22 - 2*2 - 1*2
    },
    md: {
      height: 30,
      paddingX: 12,
      paddingY: 4,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.md}" as TokenRef,
      iconSize: 18,
      gap: 6,
      contentHeight: 20, // 30 - 4*2 - 1*2
    },
    lg: {
      height: 42,
      paddingX: 16,
      paddingY: 8,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.lg}" as TokenRef,
      iconSize: 22,
      gap: 8,
      contentHeight: 24, // 42 - 8*2 - 1*2
    },
    xl: {
      height: 54,
      paddingX: 24,
      paddingY: 12,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.xl}" as TokenRef,
      iconSize: 28,
      gap: 10,
      contentHeight: 28, // 54 - 12*2 - 1*2
    },
  },

  states: {
    hover: {},
    pressed: {},
    disabled: {
      opacity: 0.38,
      cursor: "not-allowed",
      pointerEvents: "none",
    },
    focusVisible: {
      focusRing: "{focus.ring.default}",
    },
  },

  render: {
    shapes: (props, size, state = "default") => {
      const variant =
        SelectTriggerSpec.variants![
          (props as { variant?: keyof typeof SelectTriggerSpec.variants })
            .variant ?? SelectTriggerSpec.defaultVariant!
        ];
      // ADR-908 Phase 3-A-2: fill token dual-read seam
      const fill = resolveFillTokens(variant);
      const width =
        typeof props._containerWidth === "number" && props._containerWidth > 0
          ? props._containerWidth
          : (props.style?.width as number) || 200;
      // 레이아웃 엔진이 계산한 높이를 사용 (ElementSprite가 style.height로 주입)
      const height =
        (props.style?.height as number) || (size.height as number) || 40;

      const borderRadius = parsePxValue(
        props.style?.borderRadius,
        size.borderRadius as unknown as number,
      );

      // backgroundColor: 'transparent'는 factory 기본값 → spec variant 사용
      // 사용자가 명시적으로 색상을 설정한 경우에만 inline style 우선
      const userBg = props.style?.backgroundColor;
      const bgColor =
        userBg != null && userBg !== "transparent"
          ? userBg
          : state === "hover"
            ? (fill.default.hover ?? fill.default.base)
            : state === "pressed"
              ? (fill.default.pressed ?? fill.default.base)
              : fill.default.base;

      const borderColor =
        props.style?.borderColor ??
        (state === "hover" && variant.borderHover
          ? variant.borderHover
          : variant.border);

      const defaultBw = props.isInvalid ? 2 : 1;
      const borderWidth = parseBorderWidth(props.style?.borderWidth, defaultBw);

      const shapes: Shape[] = [
        {
          id: "trigger",
          type: "roundRect" as const,
          x: 0,
          y: 0,
          width,
          height,
          radius: borderRadius,
          fill: bgColor,
        },
      ];

      if (borderColor) {
        shapes.push({
          type: "border" as const,
          target: "trigger",
          borderWidth,
          color: props.isInvalid
            ? ("{color.negative}" as TokenRef)
            : borderColor,
          radius: borderRadius,
        });
      }

      return shapes;
    },

    react: (props) => ({
      "data-disabled": props.isDisabled || undefined,
      "data-invalid": props.isInvalid || undefined,
    }),

    pixi: (props) => ({
      eventMode: props.isDisabled ? ("none" as const) : ("static" as const),
      cursor: props.isDisabled ? "not-allowed" : "pointer",
    }),
  },
};
