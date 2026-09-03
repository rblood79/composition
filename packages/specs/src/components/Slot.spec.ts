/**
 * Slot Component Spec
 *
 * 플레이스홀더 컨테이너 컴포넌트
 * Single Source of Truth - React와 Skia Canvas에서 동일한 시각적 결과
 *
 * @packageDocumentation
 */

import type { ComponentSpec, TokenRef } from "../types";
import { parsePxValue, parseBorderWidth } from "../primitives";
import { FileText, Type, CircleAlert } from "lucide-react";

/**
 * Slot Props
 */
export interface SlotProps {
  size?: "sm" | "md" | "lg";
  name?: string;
  description?: string;
  required?: boolean;
  style?: Record<string, string | number | undefined>;
}

/**
 * Slot Component Spec
 */
const SLOT_DEFAULTS = {
  background: "{color.base}" as TokenRef,
  border: "{color.border}" as TokenRef,
};

export const SlotSpec: ComponentSpec<SlotProps> = {
  name: "Slot",
  description: "플레이스홀더 슬롯 컨테이너 컴포넌트",
  element: "div",
  skipCSSGeneration: false,

  defaultSize: "md",

  // ADR-923 Phase 5 후속 HC2 전환 (2026-09-03): outer display 를 **명시**한다. 종전에는 미등재라 CSSGenerator 가
  //   archetype "default" 기본값 inline-flex 를 emit 하고 Canvas (`resolveDefaultDisplay` — spec containerStyles 부재
  //   → 캔버스 기본 block) 는 block 이라 두 consumer 가 갈렸다. 값은 block — production 에서 Slot 은 frame body
  //   (display block, `createDefaultBodyProps`) 의 자식이라 outer 가 배치를 정하고, page 모드 preview
  //   (`App.tsx` `.preview-slot` div UA block) · Canvas 가 이미 block 이다. 상세:
  //   docs/adr/evidence/923-phase5-followup-hc2-conversion.md.
  containerStyles: {
    display: "block",
  },

  // ADR-923 Phase 5 후속 착수 8 (2026-09-04, 사용자 판단) — 상자 높이 축을 `height` → **`minHeight`** 로
  //   전환한다. 착수 3 에서 Canvas 는 이 값을 이미 minHeight 로 번역해 주입하고 있었고 (layout 템플릿의
  //   Slot 인라인 `minHeight: 60` · content slot `flex: 1` 과 같은 계약 — 고정 높이로 누르면 flex 로 늘어나는
  //   slot 이 깨진다), spec 만 `height` 라 **spec 의 선언과 소비 의미가 어긋나 있었다**. 이제 생성 CSS 도
  //   `min-height` 를 emit 해 DOM 이 같은 의미를 갖는다 (내용이 더 크면 늘어난다 — 사용자-가시 변화).
  sizes: {
    sm: {
      minHeight: 40,
      paddingX: 8,
      paddingY: 8,
      fontSize: "{typography.text-xs}" as TokenRef,
      borderRadius: "{radius.md}" as TokenRef,
      gap: 4,
    },
    md: {
      minHeight: 60,
      paddingX: 12,
      paddingY: 12,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.md}" as TokenRef,
      gap: 8,
    },
    lg: {
      minHeight: 80,
      paddingX: 16,
      paddingY: 16,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.lg}" as TokenRef,
      gap: 12,
    },
  },

  states: {},

  properties: {
    sections: [
      {
        title: "Slot Settings",
        fields: [
          {
            key: "name",
            type: "string",
            label: "Name",
            icon: FileText,
            placeholder: "content",
          },
          {
            key: "description",
            type: "string",
            label: "Description",
            icon: Type,
            placeholder: "Main content area",
            emptyToUndefined: true,
          },
          {
            key: "required",
            type: "boolean",
            label: "Required",
            icon: CircleAlert,
          },
        ],
      },
    ],
  },

  // ADR-923 Phase 5 후속 착수 8 (2026-09-04) — placeholder chrome 의 배치. 이 chrome (`Slot.tsx` 의
  //   icon + name/description) 은 **CSS 가 하나도 없어** 블록 흐름으로 쌓였고, 자연 높이 74 가 종전의
  //   고정 `height: 60px` 를 넘어 상자 밖으로 넘쳤다. 고정 높이를 minHeight 로 바꾸면 그 넘침이 상자
  //   높이로 드러나 (DOM 74 vs Canvas 60) 두 consumer 가 갈린다 — Canvas 는 이 chrome 을 그리지 않고
  //   점선 상자만 그리기 때문이다 (`render.shapes`). 그래서 chrome 을 한 줄 (icon · 이름) 로 눕혀
  //   선언 최소 높이 안에 들어오게 한다. 값은 배치뿐 — 색/타이포는 도입하지 않는다.
  //   (남는 비대칭: description 이 있어 두 줄이 되면 DOM 만 늘어난다. chrome 자체가 DOM 전용 편집
  //    장식이라는 성질에서 오는 것으로, Canvas 가 chrome 을 그리게 되면 같이 해소된다 — 기록만.)
  composition: {
    delegation: [],
    externalStyles: [
      {
        selector: ".react-aria-Slot > .react-aria-Slot-placeholder",
        styles: {
          display: "flex",
          "align-items": "center",
          gap: "8px",
          "min-width": "0",
        },
      },
      {
        selector: ".react-aria-Slot .react-aria-Slot-icon",
        styles: { display: "flex", flex: "none", "align-items": "center" },
      },
      {
        selector: ".react-aria-Slot .react-aria-Slot-info",
        styles: {
          display: "flex",
          "flex-direction": "column",
          "min-width": "0",
        },
      },
    ],
  },

  render: {
    presentation: { fills: "background" },
    shapes: (props, size, _state = "default") => {
      // 사용자 스타일 우선, 없으면 spec 기본값
      const borderRadius = parsePxValue(
        props.style?.borderRadius,
        size.borderRadius,
      );
      const borderWidth = parseBorderWidth(props.style?.borderWidth, 1);

      const bgColor = props.style?.backgroundColor ?? SLOT_DEFAULTS.background;
      const borderColor = props.style?.borderColor ?? SLOT_DEFAULTS.border;

      return [
        {
          id: "bg",
          presentationRole: "background-fill",
          type: "roundRect" as const,
          x: 0,
          y: 0,
          width: "auto",
          height: "auto" as unknown as number,
          radius: borderRadius as unknown as number,
          fill: bgColor,
          fillAlpha: 0.5,
        },
        {
          type: "border" as const,
          target: "bg",
          borderWidth,
          color: borderColor,
          style: "dashed",
          radius: borderRadius as unknown as number,
        },
      ];
    },

    react: () => ({}),
  },
};
