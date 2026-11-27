import {
  resolveToken,
  tokenToCSSVar,
  type TokenRef,
} from "@composition/rendering";
import type { StepListStepState } from "./stepListState";
import {
  catalogStepChromeAnchors,
  catalogStepChromeColors,
  catalogStepGlyph,
  catalogStepMinMain,
  catalogStepPadding,
  catalogStepSize,
  STEP_GLYPH_SIZE,
  STEP_RULE,
  STEP_VISUAL_BORDER,
  type StepOrientation,
  type StepSize,
  type StepState,
} from "../rule/stepList";

/**
 * ADR-321 — StepList 의 상태 규칙 (`stepListState.ts` — breakdown §5.2) 의 결과를 두 consumer 에 싣는
 * 파생 값 · 배치 · DOM 의 inline 값. Canvas 는 시작 값의 정지 모양을 그리고 (Decision 10), 실행 중
 * DOM 은 실행 상태로 같은 함수를 다시 읽는다 (`stepList.components.tsx`).
 */
export {
  catalogStepListKeys,
  catalogStepListStates,
  type StepListStateInput,
  type StepListStepState,
} from "./stepListState";

export const catalogStepListOrientation = (
  props: Readonly<Record<string, unknown>>,
): StepOrientation =>
  props.orientation === "vertical" ? "vertical" : "horizontal";

/** The px a step size's label line is (the Step rule's `lineHeight` token — the device set's). */
export function catalogStepLineHeight(size: StepSize): number {
  const ref = STEP_RULE.sizes[size]?.lineHeight;
  const value = typeof ref === "string" ? resolveToken(ref as TokenRef) : ref;
  return typeof value === "number"
    ? value
    : Number.parseFloat(String(value)) || 0;
}

/** The list's derived values (its direction for the Canvas's `styleOf`). */
export function catalogStepListDerived(
  props: Readonly<Record<string, unknown>>,
): Record<string, string> {
  return { _stepListOrientation: catalogStepListOrientation(props) };
}

/**
 * A step's derived values: its state in its list, its place (number · last), the list's orientation ·
 * emphasis, and the room it keeps for its visual and track (the Canvas's `catalogBoxModel` reads
 * the pads under an authored side; the DOM writes the same ones inline — `catalogStepDomStyle`).
 */
export function catalogStepDerived(
  step: StepListStepState,
  count: number,
  list: Readonly<Record<string, unknown>>,
  size: unknown,
): Record<string, string | number | boolean> {
  const orientation = catalogStepListOrientation(list);
  const stepSize = catalogStepSize(size);
  const pad = catalogStepPadding(
    orientation,
    stepSize,
    catalogStepLineHeight(stepSize),
  );
  return {
    _stepOrientation: orientation,
    _stepState: step.state,
    _stepNumber: step.index + 1,
    _stepLast: step.index === count - 1,
    _stepEmphasized: list.isEmphasized === true,
    _stepDisabled: step.disabled,
    _stepSize: stepSize,
    _stepPadTop: pad.top,
    _stepPadRight: pad.right,
    _stepPadBottom: pad.bottom,
    _stepPadLeft: pad.left,
  };
}

/**
 * The layout values of a StepList record: a vertical list stacks its steps (the Canvas's `styleOf` —
 * the DOM reads the rule's `orientation` block); a horizontal step takes an equal share of the list,
 * a step's main axis never under its visual + track minimum (both consumers — Canvas `styleOf` · DOM
 * inline). An authored item layout written after it wins.
 */
export function catalogStepListLayout(
  derived: Readonly<Record<string, unknown>> | undefined,
): Record<string, string | number> {
  if (derived?._stepListOrientation === "vertical")
    return { flexDirection: "column", alignItems: "stretch" };
  if (typeof derived?._stepOrientation !== "string") return {};
  const min = `${catalogStepMinMain(catalogStepSize(derived._stepSize))}px`;
  return derived._stepOrientation === "vertical"
    ? { minHeight: min }
    : { flexGrow: 1, flexShrink: 1, flexBasis: "0px", minWidth: min };
}

const px = (value: number) => `${value}px`;

/**
 * A Step's DOM inline style: its share · minimum (`catalogStepListLayout`) and its room for its
 * visual · track (the pads the Canvas box reads — `catalogStepDerived`). Authored values written
 * after it win. (The list's own direction is its rule's `orientation` block.)
 */
export function catalogStepDomStyle(
  derived: Readonly<Record<string, unknown>> | undefined,
): Record<string, string | number> {
  if (typeof derived?._stepOrientation !== "string") return {};
  return {
    ...catalogStepListLayout(derived),
    paddingTop: px(Number(derived._stepPadTop)),
    paddingRight: px(Number(derived._stepPadRight)),
    paddingBottom: px(Number(derived._stepPadBottom)),
    paddingLeft: px(Number(derived._stepPadLeft)),
  };
}

/**
 * A step's visual · track as the DOM draws them: each `span`'s inline place (the anchors the Canvas
 * resolves into its shapes' rects) and paint (the same TokenRefs, as the theme's variables), the
 * glyph in the visual and its size. Undefined outside a StepList.
 */
export function catalogStepChromeDom(
  derived: Readonly<Record<string, unknown>> | undefined,
):
  | {
      visual: Record<string, string>;
      track?: Record<string, string>;
      glyph: "number" | "check" | "none";
      glyphSize: number;
      number: string;
      /** The label's · description's color (the theme's variables — the step element's). */
      label: string;
      description: string;
    }
  | undefined {
  if (typeof derived?._stepState !== "string") return undefined;
  const size = catalogStepSize(derived._stepSize);
  const state = derived._stepState as StepState;
  const anchors = catalogStepChromeAnchors({
    orientation:
      derived._stepOrientation === "vertical" ? "vertical" : "horizontal",
    size,
    last: derived._stepLast === true,
    lineHeight: catalogStepLineHeight(size),
  });
  const colors = catalogStepChromeColors({
    state,
    emphasized: derived._stepEmphasized === true,
    disabled: derived._stepDisabled === true,
  });
  const place = (anchor: Record<string, number | undefined>) =>
    Object.fromEntries(
      Object.entries(anchor).flatMap(([key, value]) =>
        value === undefined ? [] : [[key, px(value)]],
      ),
    );
  return {
    visual: {
      ...place({ ...anchors.visual }),
      color: tokenToCSSVar(colors.glyph),
      ...(colors.visualFill
        ? { background: tokenToCSSVar(colors.visualFill) }
        : {}),
      ...(colors.visualBorder
        ? {
            border: `${tokenToCSSVar(STEP_VISUAL_BORDER)} solid ${tokenToCSSVar(colors.visualBorder)}`,
          }
        : {}),
    },
    ...(anchors.track
      ? {
          track: {
            ...place({ ...anchors.track }),
            background: tokenToCSSVar(colors.track),
          },
        }
      : {}),
    glyph: catalogStepGlyph(size, state),
    glyphSize: STEP_GLYPH_SIZE[size],
    number: String(derived._stepNumber ?? ""),
    label: tokenToCSSVar(colors.label),
    description: tokenToCSSVar(colors.description),
  };
}
