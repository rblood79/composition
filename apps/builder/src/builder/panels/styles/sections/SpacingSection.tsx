/**
 * SpacingSection — Padding · Margin (Layout 탭, panel-ui 01, 2026-09-14).
 *
 * Margin/Padding fieldset의 박스 모델과 오른쪽 연동 액션으로 구성한다.
 * 종전엔 헤더 펼침으로 8-필드 표 (FourWayGrid ×2) 폴백이 있었으나 다이어그램이 이미
 * 변별 편집이라 중복 — 2026-09-15 사용자 판정으로 제거. 종전엔 Layout 절 끝에
 * 「Padding ▾ · Margin ▾」 축약값 둘 + 펼침이라 상하/좌우가 다른 경우를 펼쳐야 알 수 있었다.
 * 값 쓰기는 longhand (paddingTop …) — store 의 shorthand 분배 정책과 같은 채널.
 */

import { memo, useMemo } from "react";
import { catalogReadPositionConstraint } from "../../../catalogRuntime/positionConstraint";
import { useElementStyleContext } from "../hooks/useElementStyleContext";
import { Section as PropertySection } from "../../../components/panel/Section";
import { useOptimizedStyleActions } from "../hooks/useOptimizedStyleActions";
import { useLayoutValues } from "../hooks/useLayoutValues";
import { useResetStyles, useHasDirtyStyles } from "../hooks/useResetStyles";
import { useLayoutPresentationActions } from "../hooks/useLayoutPresentationActions";
import { BoxModelEditor, type BoxSide } from "../components/BoxModelEditor";
import { SPACING_PROPS } from "./styleSectionProps";
import {
  readSessionSpacingValue,
  useSpacingSession,
} from "../../../presentation/useSpacingSession";
import { useStylesSelectedId } from "../stylesHost";

/**
 * LayoutSection 내부 컨텐츠 — 섹션이 열릴 때만 마운트
 */
const SpacingSectionContent = memo(function SpacingSectionContent() {
  const { updateStyleImmediate, updateStylesImmediate } =
    useOptimizedStyleActions();
  const { commitLayoutPresentation } = useLayoutPresentationActions();
  const selectedId = useStylesSelectedId();
  const styleValues = useLayoutValues(selectedId);
  // ADR-222: 캔버스 spacing 세션이 이 노드의 padding 을 편집 중이면 확정값을 덮어 읽고 그 변을 강조
  const spacingSession = useSpacingSession();

  // BoxModelEditor 는 local draft + blur 커밋이므로 즉시 업데이트
  const handlePaddingChange = (
    direction: "Top" | "Right" | "Bottom" | "Left",
    value: string,
  ) => {
    if (!commitLayoutPresentation(`padding${direction}`, value)) {
      updateStyleImmediate(`padding${direction}`, value);
    }
  };

  const handleMarginChange = (
    direction: "Top" | "Right" | "Bottom" | "Left",
    value: string,
  ) => {
    updateStyleImmediate(`margin${direction}`, value);
  };

  // ADR-275 사용자 결정 2 — an absolute box's Center axis owns its margins (Figma · Framer: a
  // positioned box moves by its Position offset).
  const effective = useElementStyleContext(selectedId).effective;
  const lockedMarginSides = useMemo(() => {
    const view = (key: string) =>
      effective?.[key] === undefined ? undefined : String(effective[key]);
    if (view("position") !== "absolute") return undefined;
    const constraint = catalogReadPositionConstraint({
      insetLeft: view("left"),
      insetRight: view("right"),
      insetTop: view("top"),
      insetBottom: view("bottom"),
      justifySelf: view("justifySelf"),
      alignSelf: view("alignSelf"),
    });
    const sides = new Set<BoxSide>([
      ...(constraint.x === "center" ? (["Left", "Right"] as const) : []),
      ...(constraint.y === "center" ? (["Top", "Bottom"] as const) : []),
    ]);
    return sides.size ? sides : undefined;
  }, [effective]);

  const handleRingChange = (ring: "padding" | "margin", value: string) => {
    updateStylesImmediate(
      Object.fromEntries(
        (["Top", "Right", "Bottom", "Left"] as const)
          .filter((side) => ring !== "margin" || !lockedMarginSides?.has(side))
          .map((side) => [`${ring}${side}`, value]),
      ),
    );
  };

  if (!styleValues) return null;

  const sessionPadding = (
    side: BoxSide,
    fallback: string,
  ): [string, boolean] => {
    const value = readSessionSpacingValue(
      spacingSession,
      selectedId,
      `padding${side}`,
    );
    return value === null ? [fallback, false] : [`${value}px`, true];
  };
  const [paddingTop, topActive] = sessionPadding("Top", styleValues.paddingTop);
  const [paddingRight, rightActive] = sessionPadding(
    "Right",
    styleValues.paddingRight,
  );
  const [paddingBottom, bottomActive] = sessionPadding(
    "Bottom",
    styleValues.paddingBottom,
  );
  const [paddingLeft, leftActive] = sessionPadding(
    "Left",
    styleValues.paddingLeft,
  );
  const paddingValues = {
    top: paddingTop,
    right: paddingRight,
    bottom: paddingBottom,
    left: paddingLeft,
  };
  const activePaddingSides = new Set<BoxSide>(
    (
      [
        ["Top", topActive],
        ["Right", rightActive],
        ["Bottom", bottomActive],
        ["Left", leftActive],
      ] as const
    )
      .filter(([, active]) => active)
      .map(([side]) => side),
  );
  const marginValues = {
    top: styleValues.marginTop,
    right: styleValues.marginRight,
    bottom: styleValues.marginBottom,
    left: styleValues.marginLeft,
  };

  return (
    <div className="transform-row">
      <BoxModelEditor
        padding={paddingValues}
        margin={marginValues}
        onPaddingChange={handlePaddingChange}
        onMarginChange={handleMarginChange}
        onRingChange={handleRingChange}
        activePaddingSides={activePaddingSides}
        lockedMarginSides={lockedMarginSides}
      />
    </div>
  );
});

export const SpacingSection = memo(function SpacingSection() {
  const resetStyles = useResetStyles();
  const hasDirty = useHasDirtyStyles(SPACING_PROPS);

  return (
    <PropertySection
      id="spacing"
      title="Spacing"
      onReset={hasDirty ? () => resetStyles(SPACING_PROPS) : undefined}
    >
      <SpacingSectionContent />
    </PropertySection>
  );
});
