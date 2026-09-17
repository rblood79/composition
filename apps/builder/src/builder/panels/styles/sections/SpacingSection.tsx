/**
 * SpacingSection — Padding · Margin (Layout 탭, panel-ui 01, 2026-09-14).
 *
 * 박스 모델 다이어그램 하나 (BoxModelEditor — 4방향 값이 제자리에, 가운데 link 로 연동).
 * 종전엔 헤더 펼침으로 8-필드 표 (FourWayGrid ×2) 폴백이 있었으나 다이어그램이 이미
 * 변별 편집이라 중복 — 2026-09-15 사용자 판정으로 제거. 종전엔 Layout 절 끝에
 * 「Padding ▾ · Margin ▾」 축약값 둘 + 펼침이라 상하/좌우가 다른 경우를 펼쳐야 알 수 있었다.
 * 값 쓰기는 longhand (paddingTop …) — store 의 shorthand 분배 정책과 같은 채널.
 */

import { memo } from "react";
import { PropertySection } from "../../../components";
import { useOptimizedStyleActions } from "../hooks/useOptimizedStyleActions";
import { useLayoutValues } from "../hooks/useLayoutValues";
import { useResetStyles, useHasDirtyStyles } from "../hooks/useResetStyles";
import { useStore } from "../../../stores";
import { useLayoutPresentationActions } from "../hooks/useLayoutPresentationActions";
import { BoxModelEditor, type BoxSide } from "../components/BoxModelEditor";
import { SPACING_PROPS } from "./styleSectionProps";
import {
  readSessionSpacingValue,
  useSpacingSession,
} from "../../../presentation/useSpacingSession";

/**
 * LayoutSection 내부 컨텐츠 — 섹션이 열릴 때만 마운트
 */
const SpacingSectionContent = memo(function SpacingSectionContent() {
  const { updateStyleImmediate } = useOptimizedStyleActions();
  const { commitLayoutPresentation } = useLayoutPresentationActions();
  const selectedId = useStore((s) => s.selectedElementId);
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
    <BoxModelEditor
      padding={paddingValues}
      margin={marginValues}
      onPaddingChange={handlePaddingChange}
      onMarginChange={handleMarginChange}
      activePaddingSides={activePaddingSides}
    />
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
