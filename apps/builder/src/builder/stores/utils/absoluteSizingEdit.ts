import {
  getSizingEffectiveStyle,
  isValidFillFactor,
  resolveEffectiveFill,
  type BreakpointName,
  type FillParentContext,
  type SizeAxis,
} from "@composition/shared";
import type { Element } from "../../../types/core/store.types";
import { SIZING_TIERS, type UsedSizing } from "./ratioSizingEdit";
import {
  buildResponsiveStyleOverride,
  shouldWriteBreakpointOverride,
} from "./responsiveWriteRouting";
import { inferSizeMode, resolveSizeMode } from "./sizeModeResolver";

/**
 * ADR-224 §6.1 Flow→Absolute — 절대 위치에서 Fill 은 성립하지 않는다 (containing block 의
 * 가용 공간 분배가 없다). 활성화 시 **무효가 되는 Fill 축만** 변경 전 used px 로 기존 CSS
 * Fixed 로 굳히고 marker 를 해제한다. Absolute→Flow 는 그 Fixed 를 유지하며 이전 Fill 을
 * 자동 복원하지 않는다 (marker 가 null 이라 되살아날 것이 없다) — Undo 가 전체를 되돌린다.
 *
 * tier 규칙은 Ratio 와 같다 (`buildRatioSizingEdit`): 자기 상태 (tier CSS override 또는
 * tier Fill marker) 가 있는 tier 만 쓰고 geometry 를 요구한다. 자기 상태가 없는 tier 는 base
 * 의 px 를 상속한다 — 한 화면 px 를 모든 tier 에 복사하지 않되, 미측정 tier 때문에 base
 * 편집이 막히지도 않는다.
 */
export interface AbsoluteFixPlan {
  tier: BreakpointName;
  axis: SizeAxis;
  px: number;
  /** Fixed 로 바꿀 때 지울 Fill 파생 CSS (legacy grow 등) */
  cleanup: readonly string[];
}

export interface AbsoluteActivationInput {
  source: Element;
  effective: Element;
  /** tier 별 부모 문맥 (`display: contents` 를 건너뛴 실제 부모) */
  parentContext: (tier: BreakpointName) => FillParentContext;
  used: UsedSizing;
}

function tierOwnsAxis(
  source: Element,
  axis: SizeAxis,
  tier: BreakpointName,
): boolean {
  if (tier === "desktop") return true;
  const styles = source.responsive?.styles as
    Record<string, Record<string, unknown> | undefined> | undefined;
  const css = styles?.[axis]?.[tier];
  const fill = source.responsive?.sizing?.[tier]?.[axis];
  return (css != null && css !== "") || fill !== undefined;
}

/**
 * 절대 위치에서 무효가 되는 Fill 축 (marker 또는 legacy CSS grow) 을 tier 별로 모은다.
 * geometry 가 없는 축이 하나라도 있으면 `null` — 부분 commit 하지 않는다.
 */
export function collectInvalidFillAxes(
  input: AbsoluteActivationInput,
): AbsoluteFixPlan[] | null {
  const { source, effective, used } = input;
  const plans: AbsoluteFixPlan[] = [];
  for (const tier of SIZING_TIERS) {
    const style = getSizingEffectiveStyle(effective, tier);
    if (style.position === "absolute" || style.position === "fixed") continue;
    const context = input.parentContext(tier);
    const fill = resolveEffectiveFill(effective, tier);
    for (const axis of ["width", "height"] as const) {
      const marker = fill?.[axis];
      const markerActive = !!marker && isValidFillFactor(marker.factor);
      const legacy =
        !markerActive &&
        inferSizeMode(style, axis, context.display, context.flexDirection) ===
          "fill";
      if (!markerActive && !legacy) continue;
      if (!tierOwnsAxis(source, axis, tier)) continue; // base px 상속
      const px = used[tier]?.[axis];
      if (px == null || !Number.isFinite(px) || px < 0) return null;
      plans.push({
        tier,
        axis,
        px: Math.round(px * 100) / 100,
        cleanup: resolveSizeMode(
          "fixed",
          axis,
          context.display,
          context.flexDirection,
        ).remove,
      });
    }
  }
  return plans;
}

/**
 * position/inset + 무효 Fill 의 Fixed 화를 한 요소의 갱신으로 합친다. position 계열은 기존
 * write 라우팅 (`shouldWriteBreakpointOverride`) 을 그대로 따른다.
 */
export function buildAbsoluteActivationEdit(
  source: Element,
  positionStyles: Record<string, string>,
  activeBreakpoint: BreakpointName,
  fixes: readonly AbsoluteFixPlan[],
): Partial<Element> {
  const style = { ...((source.props.style ?? {}) as Record<string, unknown>) };
  const sizing = { ...source.sizing };
  let responsive = source.responsive;
  const write = (key: string, tier: BreakpointName, next: string) => {
    if (tier === "desktop") {
      if (next === "") delete style[key];
      else style[key] = next;
    } else {
      responsive = buildResponsiveStyleOverride(responsive, key, next, tier);
    }
  };
  for (const [key, value] of Object.entries(positionStyles)) {
    const tier = shouldWriteBreakpointOverride(
      source.responsive,
      key,
      activeBreakpoint,
    )
      ? activeBreakpoint
      : "desktop";
    write(key, tier, value);
  }
  for (const fix of fixes) {
    write(fix.axis, fix.tier, `${fix.px}px`);
    for (const key of fix.cleanup) write(key, fix.tier, "");
    if (fix.tier === "desktop") {
      sizing[fix.axis] = null;
    } else {
      responsive = {
        ...responsive,
        sizing: {
          ...responsive?.sizing,
          [fix.tier]: { ...responsive?.sizing?.[fix.tier], [fix.axis]: null },
        },
      };
    }
  }
  return { props: { ...source.props, style }, sizing, responsive };
}
