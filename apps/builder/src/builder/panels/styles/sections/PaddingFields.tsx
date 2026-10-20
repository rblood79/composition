/**
 * PaddingFields — Layout 절의 Padding 줄 (ADR-275 사용자 결정 10, 2026-10-20 — Figma 구성).
 *
 * 기본: 「↔ 가로 · ↕ 세로 · 펼침」 한 줄 — 가로는 Left · Right, 세로는 Top · Bottom 을 한 값으로
 * 쓴다 (두 변이 다르면 비워 두고 Mixed). 펼치면 「Left · Top · 펼침」 / 「Right · Bottom」 두 줄.
 * 두 변이 다르면 펼친 상태로 시작한다. Canvas spacing 세션 (ADR-222) 이 편집 중인 변은 세션
 * 값을 보이고 잠긴다 (Gap 칸과 같은 어법). margin 은 패널에서 편집하지 않는다 (Figma · Framer
 * 처럼 — 사용자 결정 10, 값은 Layout 절 reset 이 지운다).
 */
import { memo, useState } from "react";
import {
  MoveHorizontal,
  MoveVertical,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PanelTop,
  SquareDashed,
} from "lucide-react";
import { PropertyUnitInput } from "../../../components/property/PropertyUnitInput";
import { SwatchIconToggleButton } from "../../../components/ui/SwatchIconButton";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { useSemanticLabel } from "../../../../i18n";
import { useOptimizedStyleActions } from "../hooks/useOptimizedStyleActions";
import {
  readSessionSpacingValue,
  useSpacingSession,
} from "../../../presentation/useSpacingSession";

type Side = "Top" | "Right" | "Bottom" | "Left";

export interface PaddingValues {
  readonly paddingTop: string;
  readonly paddingRight: string;
  readonly paddingBottom: string;
  readonly paddingLeft: string;
}

const SIDE_FIELDS: ReadonlyArray<{
  side: Side;
  label: string;
  icon: typeof PanelLeft;
}> = [
  { side: "Left", label: "Left padding", icon: PanelLeft },
  { side: "Top", label: "Top padding", icon: PanelTop },
  { side: "Right", label: "Right padding", icon: PanelRight },
  { side: "Bottom", label: "Bottom padding", icon: PanelBottom },
];

export const PaddingFields = memo(function PaddingFields({
  values,
  selectedId,
}: {
  values: PaddingValues;
  selectedId: string | null;
}) {
  const localize = useSemanticLabel();
  const { updateStylesImmediate } = useOptimizedStyleActions();
  const session = useSpacingSession();

  const read = (side: Side): { value: string; active: boolean } => {
    const property = `padding${side}` as const;
    const live = readSessionSpacingValue(session, selectedId, property);
    return live === null
      ? { value: values[property], active: false }
      : { value: `${live}px`, active: true };
  };
  const sides = {
    Top: read("Top"),
    Right: read("Right"),
    Bottom: read("Bottom"),
    Left: read("Left"),
  };
  const [expanded, setExpanded] = useState(
    () =>
      values.paddingLeft !== values.paddingRight ||
      values.paddingTop !== values.paddingBottom,
  );

  const write = (targets: readonly Side[], value: string) =>
    updateStylesImmediate(
      Object.fromEntries(targets.map((side) => [`padding${side}`, value])),
    );

  const field = (
    key: string,
    label: string,
    icon: typeof PanelLeft,
    targets: readonly Side[],
  ) => {
    const [first, ...rest] = targets.map((side) => sides[side]);
    const value = rest.every((other) => other.value === first.value)
      ? first.value
      : "";
    return (
      <PropertyUnitInput
        key={key}
        label={label}
        labelMode="icon"
        icon={icon}
        className={`layout-padding-${key}`}
        value={value}
        placeholder={value === "" ? localize("Mixed") : undefined}
        units={["px"]}
        defaultUnit="px"
        // 빈 값 (Mixed) 을 0 으로 그리지 않는다 — 입력할 때까지 placeholder
        preserveEmptyValueOnUnitChange
        allowKeywords={false}
        isDisabled={targets.some((side) => sides[side].active)}
        min={0}
        max={9999}
        onChange={(next) => write(targets, next)}
      />
    );
  };

  return (
    // 줄 전체의 legend 「Padding」 — 칸은 아이콘 라벨 (Figma: 「Padding」 아래 ↔ · ↕)
    <fieldset
      className="properties-aria layout-padding"
      data-expanded={expanded || undefined}
    >
      <legend className="fieldset-legend">{localize("Padding")}</legend>
      <div className="fieldset-row">
        {expanded ? (
          SIDE_FIELDS.map(({ side, label, icon }) =>
            field(side.toLowerCase(), label, icon, [side]),
          )
        ) : (
          <>
            {field("x", "Horizontal padding", MoveHorizontal, [
              "Left",
              "Right",
            ])}
            {field("y", "Vertical padding", MoveVertical, ["Top", "Bottom"])}
          </>
        )}
        <div className="fieldset-actions actions-padding">
          <SwatchIconToggleButton
            aria-label={localize("Padding per side")}
            isSelected={expanded}
            onChange={setExpanded}
          >
            <SquareDashed
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </SwatchIconToggleButton>
        </div>
      </div>
    </fieldset>
  );
});
