import {
  getRatioDependentAxis,
  getSizingEffectiveStyle,
  resolveEffectiveFill,
  type BreakpointName,
  type SizeAxis,
} from "@composition/shared";
import type { Element } from "../../../types/core/store.types";
import { parseAspectRatio } from "../../utils/aspectRatio";
import { buildResponsiveStyleOverride } from "./responsiveWriteRouting";

export const SIZING_TIERS: readonly BreakpointName[] = [
  "desktop",
  "tablet",
  "mobile",
];
export type UsedSizing = Partial<
  Record<BreakpointName, { width: number; height: number }>
>;

/** tier 가 그 축에 자기 상태 (tier CSS override 또는 tier Fill marker) 를 갖는가. */
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
 * 전역 Ratio 명령: 모든 계획이 유효할 때만 호출자가 한 transaction으로 적용한다.
 *
 * 해제는 **각 영향 tier** 의 직전 used px 를 고정한다 (breakdown §4). 영향 tier = desktop (base) +
 * 종속 축이나 driver 축에 자기 상태가 있는 tier. 자기 상태가 없는 tier 는 base 의 px 를 그대로
 * 상속하므로 geometry 가 필요 없다 — 그 tier 까지 geometry 를 요구하면 편집 뒤엔 active tier 의
 * 발행만 남아 (문서 버전이 바뀌면 다른 tier 발행은 버려진다) 해제가 늘 막힌다.
 */
export function buildRatioSizingEdit(
  source: Element,
  effective: Element,
  value: string,
  used: UsedSizing,
): Partial<Element> | null {
  const locking = value !== "" && value !== "auto" && value !== "reset";
  if (locking && !parseAspectRatio(value)) return null;
  const style = { ...((source.props.style ?? {}) as Record<string, unknown>) };
  const sizing = { ...source.sizing };
  let responsive = source.responsive;
  const write = (axis: SizeAxis, tier: BreakpointName, next: string) => {
    if (tier === "desktop") {
      style[axis] = next;
      sizing[axis] = null;
    } else {
      responsive = buildResponsiveStyleOverride(responsive, axis, next, tier);
      responsive = {
        ...responsive,
        sizing: {
          ...responsive?.sizing,
          [tier]: { ...responsive?.sizing?.[tier], [axis]: null },
        },
      };
    }
  };
  for (const tier of SIZING_TIERS) {
    if (locking) {
      // Height 의 tier override/Fill 이 있는 tier 만 auto/null 로 정규화한다 (breakdown §4 — 임의
      // 삭제로 상속 Fill 이 살아나지 않게). 자기 상태가 없는 tier 에 auto/null 을 쓰면 그 tier 가
      // "자기 상태 보유" 가 되어 해제 때 geometry 를 요구한다 (live: 해제가 항상 막혔다).
      if (tierOwnsAxis(source, "height", tier)) write("height", tier, "auto");
    } else {
      const dependent = getRatioDependentAxis(
        getSizingEffectiveStyle(effective, tier),
        resolveEffectiveFill(effective, tier),
      );
      if (!dependent) continue;
      if (
        tier !== "desktop" &&
        !tierOwnsAxis(source, dependent, tier) &&
        !tierOwnsAxis(source, dependent === "width" ? "height" : "width", tier)
      )
        continue; // base px 상속
      const px = used[tier]?.[dependent];
      if (px == null || !Number.isFinite(px) || px < 0) return null;
      write(dependent, tier, `${Math.round(px * 100) / 100}px`);
    }
  }
  if (locking) style.aspectRatio = value;
  else delete style.aspectRatio;
  return { props: { ...source.props, style }, sizing, responsive };
}
