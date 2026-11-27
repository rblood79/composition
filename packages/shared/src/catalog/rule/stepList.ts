import type { TokenRef } from "@composition/rendering";
import type { ComponentRule } from "../../types/catalog-style.types";

/**
 * ADR-321 Phase 1 — StepList · Step 의 rule (D3). 값의 출처는 spectrum-design-data 의 `steplist`
 * (MCP dataset 4.7.0 — `__tests__/fixtures/adr321-design-data.json` 이 굳힌 값) 이고, 토큰이 비어 있는
 * 값은 아래 `STEP_LAYOUT` 이 정한다 (breakdown §5.3).
 *
 * 모양 (design-data visual recipe): 목록 = 단계의 줄 (세로면 열). 단계 = 라벨 (· 설명) 아래에 표식과
 * 다음 단계로 가는 선. 표식 · 선은 노드가 아니라 단계가 자기 여백 안에 그린다 (Toast 의 아이콘 방식).
 * 자리 · 색은 이 파일의 함수 하나씩 (`catalogStepPadding` · `catalogStepChromeAnchors` ·
 * `catalogStepChromeColors`) 이고 두 consumer 가 같이 읽는다 — DOM 은 단계와 `span.step-visual` ·
 * `span.step-track` 의 inline 값으로 (`runtime/stepList.ts` · `delegatedDom.runtime.ts`), Canvas 는 상자
 * (`catalogBoxModel`) 와 도형 (`ruleShapes.ts` `catalogStepChromeShapes`) 으로. 생성 CSS 는 바뀌지 않는
 * 모양만 든다.
 *
 * 세로 방향은 recipe 에 그림이 없다 (`notVisual: orientation`) — 표식 열이 왼쪽, 글자가 오른쪽이고
 * 선이 아래로 간다.
 */

export const STEP_LIST_TYPE = "StepList";
export const STEP_TYPE = "Step";

export const STEP_SIZES = ["S", "M", "L", "XL"] as const;
export type StepSize = (typeof STEP_SIZES)[number];
export type StepOrientation = "horizontal" | "vertical";
export type StepState = "current" | "completed" | "incomplete";

/**
 * 크기별 값 — `iconSize` = 표식 (design-data `steplist-visual-size-*`), `iconGap` = 글자와 표식 간격
 * (`base-gap-*`), 글자 = `font-size-75 · 100 · 200 · 300`. 행간은 저장소 사다리 (S2 `--line-height` 식 —
 * design-data 의 1.3 배수와 0.4 ~ 1.4 px 차이).
 */
const sizeBlock = (font: string, iconSize: number, iconGap: number) => ({
  height: 0,
  fontSize: `{typography.${font}}`,
  lineHeight: `{typography.${font}--line-height}`,
  borderRadius: "{radius.none}",
  iconSize,
  iconGap,
});
const SIZE_BLOCKS = {
  S: sizeBlock("text-xs", 8, 4),
  M: sizeBlock("text-sm", 16, 6),
  L: sizeBlock("text-base", 24, 6),
  XL: sizeBlock("text-lg", 32, 6),
} satisfies ComponentRule["sizes"];

/** 설명 글자 — 라벨보다 한 단계 아래 (사용자 결정 4 「설명 한 줄」, design-data 에 없음). */
const DESCRIPTION_FONT: Readonly<Record<StepSize, number>> = {
  S: 11,
  M: 12,
  L: 14,
  XL: 16,
};

/**
 * design-data 에 토큰이 없는 값 (binding 만 있다 — breakdown §5.3 「비어 있는 값」) 과 고정 값.
 * - `trackThickness`: `bar-thickness-extra-small` (2 px). 남음 표식의 테두리는 border-width 200 —
 *   `STEP_VISUAL_BORDER` (`{border.width.thick}`, 테마의 폭 토큰).
 * - `trackGap` (step 과 선의 간격): 4 — S2 spacing 단의 가장 작은 간격. 선의 양 끝이 표식에서 4 떨어진다.
 * - `minTrack` (step 의 폭 · 높이): 가로는 목록 폭을 단계 수로 고르게 나누고, 주축 최소 = 표식 +
 *   `trackGap × 2 + minTrack` (= 표식 + 24) — 선이 16 px 아래로 줄지 않는다. 세로는 내용 높이, 같은 최소.
 * - `textSeparation`: 단계의 글자가 다음 단계에 닿지 않게 두는 끝 여백 (가로 = 오른쪽, 세로 = 아래).
 * - 라벨 글자 맞춤: 세로 방향에서 라벨 첫 줄과 표식의 가운데를 맞춘다 (`|행간 − 표식| ÷ 2` —
 *   `catalogStepPadding` 의 top · `catalogStepChromeAnchors` 의 표식 top). 가로는 맞춤이 없다.
 */
export const STEP_LAYOUT = {
  trackThickness: 2,
  trackGap: 4,
  minTrack: 16,
  textSeparation: 8,
} as const;

/** 남음 표식의 테두리 폭 (design-data `Visual border` — border-width 200). */
export const STEP_VISUAL_BORDER = "{border.width.thick}" as const;

/** 표식 안 숫자 · 체크의 크기 (표식의 0.6 안팎 — design-data 에 없음. S 는 점만 그린다). */
export const STEP_GLYPH_SIZE: Readonly<Record<StepSize, number>> = {
  S: 0,
  M: 10,
  L: 14,
  XL: 18,
};
export const STEP_GLYPH_WEIGHT = 700;
export const STEP_CHECK_ICON = "check";
export const STEP_CHECK_STROKE = 3;

/**
 * 색 (design-data binding → 저장소 TokenRef, breakdown §5.3). 저장소에 같은 이름이 없는 셋은 가장 가까운
 * 기존 TokenRef 다 (새 테마 토큰을 만들지 않는다):
 * - 완료 표식 · 선 `neutral-subdued-background-color-default` (gray 700 / 500) = `{color.gray}` (같은 값).
 * - 남음 표식 테두리 · 선 `neutral-visual-color` (gray 500 / 600) → `{color.field-placeholder}`
 *   (gray 600 / 600 — dark 는 같은 값, light 는 한 단 진하다).
 * - 강조 완료 선 `accent-visual-color` (accent 800 / 900) → `{color.accent}` (accent 900 / 800 — 강조
 *   표식과 같은 색, 한 단 차이).
 */
export const STEP_COLORS = {
  visualCompleted: "{color.gray}",
  visualCurrent: "{color.neutral-fill}",
  visualEmphasized: "{color.accent}",
  visualIncompleteBorder: "{color.field-placeholder}",
  visualDisabled: "{color.disabled}",
  visualDisabledBorder: "{color.border-disabled}",
  glyphOnFill: "{color.on-neutral}",
  glyphOnAccent: "{color.on-accent}",
  glyphIncomplete: "{color.neutral-subdued}",
  glyphDisabled: "{color.disabled-content}",
  trackCompleted: "{color.gray}",
  trackCompletedEmphasized: "{color.accent}",
  trackRest: "{color.field-placeholder}",
  trackDisabled: "{color.disabled}",
  labelCurrent: "{color.neutral-content}",
  labelCurrentEmphasized: "{color.accent-content}",
  labelRest: "{color.neutral-subdued}",
  labelDisabled: "{color.disabled-content}",
  description: "{color.neutral-subdued}",
} as const satisfies Record<string, TokenRef>;

export const catalogStepSize = (value: unknown): StepSize =>
  (STEP_SIZES as readonly string[]).includes(String(value))
    ? (value as StepSize)
    : "M";

/** 단계의 주축 최소 (가로 = 최소 폭, 세로 = 최소 높이). */
export const catalogStepMinMain = (size: StepSize): number =>
  SIZE_BLOCKS[size].iconSize + STEP_LAYOUT.trackGap * 2 + STEP_LAYOUT.minTrack;

/** 세로 방향 — 라벨 첫 줄과 표식의 가운데를 맞추는 두 offset (표식 top · 글자 top). */
function verticalOffsets(size: StepSize, lineHeight: number) {
  const visual = SIZE_BLOCKS[size].iconSize;
  return {
    visualTop: Math.max(0, (lineHeight - visual) / 2),
    textTop: Math.max(0, (visual - lineHeight) / 2),
  };
}

/**
 * 단계가 표식 · 선을 그리려고 비우는 여백 — 두 consumer 가 같이 읽는다 (Canvas `catalogBoxModel`,
 * DOM inline). `lineHeight` = 단계 글자의 행간 px (세로 방향의 맞춤에만 쓴다).
 */
export function catalogStepPadding(
  orientation: StepOrientation,
  size: StepSize,
  lineHeight: number,
): { top: number; right: number; bottom: number; left: number } {
  const { iconSize, iconGap } = SIZE_BLOCKS[size];
  return orientation === "vertical"
    ? {
        top: verticalOffsets(size, lineHeight).textTop,
        right: 0,
        bottom: STEP_LAYOUT.textSeparation,
        left: iconSize + iconGap,
      }
    : {
        top: 0,
        right: STEP_LAYOUT.textSeparation,
        bottom: iconSize + iconGap,
        left: 0,
      };
}

/** 단계 상자의 모서리에서 잰 자리 — 준 모서리 · 크기만 있다 (CSS 의 절대 배치 값 그대로). */
export interface StepChromeAnchor {
  left: number;
  top?: number;
  right?: number;
  bottom?: number;
  width?: number;
  height?: number;
}

export interface StepChromeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 표식과 선의 자리 (단계의 padding 상자 모서리 기준). 선은 마지막 단계에 없다.
 * - 가로: 표식은 왼쪽 아래, 선은 표식에서 `trackGap` 떨어져 단계 끝 `trackGap` 앞까지 · 표식의 세로 가운데.
 * - 세로: 표식은 라벨 첫 줄의 가운데 높이, 선은 표식 아래 `trackGap` 에서 다음 표식 `trackGap` 위까지.
 */
export function catalogStepChromeAnchors(input: {
  orientation: StepOrientation;
  size: StepSize;
  last: boolean;
  lineHeight: number;
}): { visual: StepChromeAnchor; track?: StepChromeAnchor } {
  const visual = SIZE_BLOCKS[input.size].iconSize;
  const { trackThickness: thick, trackGap: gap } = STEP_LAYOUT;
  if (input.orientation === "vertical") {
    const { visualTop } = verticalOffsets(input.size, input.lineHeight);
    return {
      visual: { left: 0, top: visualTop, width: visual, height: visual },
      ...(input.last
        ? {}
        : {
            track: {
              left: (visual - thick) / 2,
              top: visualTop + visual + gap,
              bottom: Math.max(0, gap - visualTop),
              width: thick,
            },
          }),
    };
  }
  return {
    visual: { left: 0, bottom: 0, width: visual, height: visual },
    ...(input.last
      ? {}
      : {
          track: {
            left: visual + gap,
            right: gap,
            bottom: (visual - thick) / 2,
            height: thick,
          },
        }),
  };
}

const anchorRect = (
  anchor: StepChromeAnchor,
  width: number,
  height: number,
): StepChromeRect => {
  const w =
    anchor.width ?? Math.max(0, width - anchor.left - (anchor.right ?? 0));
  const h =
    anchor.height ??
    Math.max(0, height - (anchor.top ?? 0) - (anchor.bottom ?? 0));
  return {
    x: anchor.left,
    y: anchor.top ?? height - (anchor.bottom ?? 0) - h,
    width: w,
    height: h,
  };
};

/** 단계 상자 (`width` × `height`) 안의 표식과 선의 rect — Canvas 도형의 자리 (같은 anchor 를 푼 값). */
export function catalogStepChromeRects(
  input: Parameters<typeof catalogStepChromeAnchors>[0] & {
    width: number;
    height: number;
  },
): { visual: StepChromeRect; track?: StepChromeRect } {
  const { visual, track } = catalogStepChromeAnchors(input);
  return {
    visual: anchorRect(visual, input.width, input.height),
    ...(track ? { track: anchorRect(track, input.width, input.height) } : {}),
  };
}

/** 표식 · 선 · 글자의 색 (TokenRef) — 상태 · 강조 · 비활성에서. */
export function catalogStepChromeColors(input: {
  state: StepState;
  emphasized: boolean;
  disabled: boolean;
}): {
  visualFill?: TokenRef;
  visualBorder?: TokenRef;
  glyph: TokenRef;
  track: TokenRef;
  label: TokenRef;
  description: TokenRef;
} {
  const c = STEP_COLORS;
  if (input.disabled)
    return {
      ...(input.state === "incomplete"
        ? { visualBorder: c.visualDisabledBorder }
        : { visualFill: c.visualDisabled }),
      glyph: c.glyphDisabled,
      track: c.trackDisabled,
      label: c.labelDisabled,
      description: c.labelDisabled,
    };
  if (input.state === "incomplete")
    return {
      visualBorder: c.visualIncompleteBorder,
      glyph: c.glyphIncomplete,
      track: c.trackRest,
      label: c.labelRest,
      description: c.description,
    };
  const current = input.state === "current";
  return {
    visualFill: input.emphasized
      ? c.visualEmphasized
      : current
        ? c.visualCurrent
        : c.visualCompleted,
    glyph: input.emphasized ? c.glyphOnAccent : c.glyphOnFill,
    track: current
      ? c.trackRest
      : input.emphasized
        ? c.trackCompletedEmphasized
        : c.trackCompleted,
    label: current
      ? input.emphasized
        ? c.labelCurrentEmphasized
        : c.labelCurrent
      : c.labelRest,
    description: c.description,
  };
}

/** 표식 안에 그리는 것: 숫자 (현재 · 남음) · 체크 (완료) · 없음 (S 크기 — 점만). */
export function catalogStepGlyph(
  size: StepSize,
  state: StepState,
): "number" | "check" | "none" {
  if (STEP_GLYPH_SIZE[size] === 0) return "none";
  return state === "completed" ? "check" : "number";
}

// (Horizontal: the steps' visuals · tracks sit on one line whatever their labels' line counts.)
const stepListBox = {
  display: "flex",
  flexDirection: "row",
  alignItems: "flex-end",
};

export const STEP_LIST_RULE: ComponentRule = {
  defaultVariant: "default",
  defaultSize: "M",
  variants: { default: { paint: {} } },
  sizes: Object.fromEntries(
    STEP_SIZES.map((size) => [
      size,
      {
        height: 0,
        fontSize: SIZE_BLOCKS[size].fontSize,
        borderRadius: "{radius.none}",
      },
    ]),
  ),
  containerStyles: stepListBox,
  structure: {
    archetype: "container",
    // (The DOM root is RAC `Group` — the list's name; the steps' `ol` is its one child,
    //  `stepList.components.tsx`. The record's box is the Group's.)
    element: "div",
    containerStyles: stepListBox,
    composition: {
      delegation: [],
      rootSelectors: {
        // The `ol` fills the Group and lays the steps out with the Group's own flex values (rule ·
        // derived · authored), so the steps sit as the record's direct flex items do on the Canvas.
        "& > .step-list-items": {
          styles: {
            display: "flex",
            flex: "1 1 auto",
            "align-self": "stretch",
            "min-width": "0",
            "min-height": "0",
            "flex-direction": "inherit",
            "flex-wrap": "inherit",
            "align-items": "inherit",
            "justify-content": "inherit",
            gap: "inherit",
            "list-style": "none",
            margin: "0",
            padding: "0",
          },
        },
      },
      // Vertical: the steps stack. The DOM reads this block; the Canvas the same values from
      // `catalogStepListLayout` (a type's `containerVariants` reach the Canvas only when registered).
      // The block is also what makes the Styles panel's Direction toggle write `orientation`
      // (`orientationDrivenTags.ts` — a flex-direction alone would leave the steps' room behind).
      containerVariants: {
        orientation: {
          vertical: {
            styles: { "flex-direction": "column", "align-items": "stretch" },
          },
        },
      },
      containerVariantsOverride: true,
    },
  },
};

const stepBox = {
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
};

export const STEP_RULE: ComponentRule = {
  defaultVariant: "default",
  defaultSize: "M",
  variants: { default: { paint: {} } },
  sizes: SIZE_BLOCKS,
  containerStyles: stepBox,
  structure: {
    archetype: "container",
    element: "li",
    containerStyles: stepBox,
    composition: {
      delegation: [],
      // 설명 글자 (사용자 결정 4) — 두 consumer 가 읽는다 (part rule · 생성 CSS, Card 의 slot 글자 방식).
      sizeSelectors: Object.fromEntries(
        STEP_SIZES.map((size) => [
          size,
          {
            '.react-aria-Text[slot="description"]': {
              "font-size": `${DESCRIPTION_FONT[size]}px`,
            },
          },
        ]),
      ),
      // 표식 · 선의 바뀌지 않는 모양 (자리 · 색은 inline — `catalogStepChromeAnchors` · `Colors`).
      rootSelectors: {
        "&": {
          styles: { position: "relative", "list-style": "none", margin: "0" },
        },
        // The step's RAC Link (its press · focus) fills the `li` and lays the Texts out with the
        // `li`'s own flex values, so they sit as the record's direct flex items do on the Canvas.
        "& > .step-link": {
          styles: {
            display: "flex",
            flex: "1 1 auto",
            "align-self": "stretch",
            "min-width": "0",
            "flex-direction": "inherit",
            "align-items": "inherit",
            "justify-content": "inherit",
            gap: "inherit",
            color: "inherit",
            "text-decoration": "none",
            cursor: "pointer",
            outline: "none",
            "border-radius": "var(--catalog-token-radius-sm)",
          },
        },
        "& > .step-link[data-disabled]": { styles: { cursor: "default" } },
        "& > .step-link[data-focus-visible]": {
          styles: {
            outline: "var(--focus-ring-width) solid var(--focus-ring)",
            "outline-offset": "var(--focus-ring-offset)",
          },
        },
        "& > .step-track": {
          styles: { position: "absolute", "pointer-events": "none" },
        },
        // (In the Link — a press of the visual moves too. It is placed in the `li`'s padding: the
        //  Link is not a positioned box.)
        "& .step-visual": {
          styles: {
            position: "absolute",
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            "box-sizing": "border-box",
            "border-radius": "50%",
          },
        },
        // (The number has its own font in a child — the visual keeps the step's.)
        "& .step-visual > .step-glyph": {
          styles: {
            "font-weight": String(STEP_GLYPH_WEIGHT),
            "line-height": "1",
          },
        },
      },
    },
  },
};

/**
 * ADR-321 Phase 3 (사용자 결정 2 「넣는다」 · 자리 「감싸는 새 type」, 2026-11-27) — `Stepper > StepList +
 * StepPanel…`. Stepper 는 목록과 단계별 내용을 한 묶음으로 두는 role 없는 상자 (ReUI `Stepper` · Tabs 의
 * 모양) 이고, StepPanel 은 Step 과 key (`itemId` ↔ Step `id`) 로 짝인 상자 — 지금 단계의 것만 그린다
 * (`runtime/presence.ts` · `delegatedDom.runtime.ts`). design-data · v3 에 없는 두 상자라 값은 배치뿐이다:
 * 세로로 쌓고 목록과 패널 사이 16 (`{spacing.lg}` — S2 의 패널 간격 단), 패널은 블록 내용.
 */
export const STEPPER_TYPE = "Stepper";
export const STEP_PANEL_TYPE = "StepPanel";

const stepperBox = {
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: "{spacing.lg}",
};

export const STEPPER_RULE: ComponentRule = {
  defaultVariant: "default",
  defaultSize: "M",
  variants: { default: { paint: {} } },
  sizes: {
    M: { height: 0, borderRadius: "{radius.none}" },
  },
  containerStyles: stepperBox,
  structure: {
    archetype: "container",
    element: "div",
    containerStyles: stepperBox,
  },
};

const stepPanelBox = { display: "block", minHeight: "0px" };

export const STEP_PANEL_RULE: ComponentRule = {
  defaultVariant: "default",
  defaultSize: "M",
  variants: { default: { paint: {} } },
  sizes: {
    M: { height: 0, borderRadius: "{radius.none}" },
  },
  containerStyles: stepPanelBox,
  structure: {
    archetype: "container",
    element: "div",
    containerStyles: stepPanelBox,
  },
};
