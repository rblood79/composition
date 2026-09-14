/**
 * ModifiedStylesSection — 수정된 스타일 = key · value 목록 (읽기 전용)
 *
 * VS Code 스타일 @modified 필터. 사용자가 수정한 inline style 만 나열한다.
 *
 * 시각 어법 (panel-ui 04, 2026-09-14): 종전엔 항목마다 **편집 컨트롤을 다시 그렸다**
 * (「Appearance / Border Radius / [8 ▾]」, 항목당 70) — 편집은 해당 탭에서 하고 여기서는
 * 훑어보기 + 되돌리기(헤더 reset) 만. 행 하나 = key (12) + value (mono 10) 28. 색 값은
 * swatch 16 + HEX. 5개 항목 350 → 140.
 */

import { memo, useCallback, useMemo } from "react";
import { parseColor, type Color } from "react-aria-components/ColorPicker";
import { PaintRoller } from "lucide-react";
import { ColorSwatch } from "@composition/shared/components/ColorSwatch";
import { adaptStyleWithFills } from "@composition/shared";
import { EmptyState, PropertySection } from "../../../components";
import type { SelectedElement } from "../../../inspector/types";
import { useDirtyStyleProps, useResetStyles } from "../hooks/useResetStyles";
import { useElementStyleContext } from "../hooks/useElementStyleContext";
import { resolveStylePanelColor } from "../utils/styleValueHelpers";
import {
  useResolvedSkiaTheme,
  useThemeConfigVersion,
} from "../../../../stores/themeConfigStore";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../../i18n";

import "./ModifiedStylesSection.css";

interface ModifiedStylesSectionProps {
  selectedElement: SelectedElement;
}

/** 표시 순서 — Layout · Spacing · Appearance · Typography 순, 같은 절 안은 dirty 순서. */
const CATEGORY_ORDER: ReadonlyArray<ReadonlySet<string>> = [
  new Set([
    "display",
    "flexDirection",
    "alignItems",
    "justifyContent",
    "gap",
    "rowGap",
    "columnGap",
    "flexWrap",
  ]),
  new Set([
    "width",
    "height",
    "minWidth",
    "maxWidth",
    "minHeight",
    "maxHeight",
    "padding",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "margin",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
    "top",
    "left",
    "right",
    "bottom",
  ]),
  new Set([
    "backgroundColor",
    "backgroundImage",
    "backgroundSize",
    "borderColor",
    "borderWidth",
    "borderRadius",
    // ADR-219 — 코너 · 변 longhand 8 (비균일이면 4행씩, padding 과 같다)
    "borderTopLeftRadius",
    "borderTopRightRadius",
    "borderBottomRightRadius",
    "borderBottomLeftRadius",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "borderStyle",
    "overflow",
    "boxShadow",
    "opacity",
    "filter",
  ]),
];

const COLOR_PROPS = new Set(["backgroundColor", "borderColor", "color"]);

/** store 가 숫자로 강제하는 prop 중 단위 없는 것 — 나머지 숫자는 px (panel-ui 04 「Gap 8px」, 대조 B9) */
const UNITLESS_PROPS = new Set([
  "fontWeight",
  "opacity",
  "flexGrow",
  "flexShrink",
  "zIndex",
  "order",
]);

/**
 * longhand 묶음 — 전부 dirty 이고 값이 같으면 shorthand 한 행 (「Gap 8px」, 「Padding 12px」).
 * 하나라도 다르면 longhand 그대로 (비균일 코너 4행 · 변 4행은 ADR-219 그대로). dirty 목록에
 * shorthand 가 같이 실려 있으면 (store 가 gap → rowGap/columnGap 으로 분배하고 dirty 판정은
 * 둘 다 잡는다) 균일할 때 longhand 를, 아닐 때 shorthand 를 뺀다 — 같은 값 세 행 금지.
 */
const LONGHAND_GROUPS: ReadonlyArray<{
  shorthand: string;
  longhands: readonly string[];
}> = [
  { shorthand: "gap", longhands: ["rowGap", "columnGap"] },
  {
    shorthand: "padding",
    longhands: ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"],
  },
  {
    shorthand: "margin",
    longhands: ["marginTop", "marginRight", "marginBottom", "marginLeft"],
  },
  {
    shorthand: "borderRadius",
    longhands: [
      "borderTopLeftRadius",
      "borderTopRightRadius",
      "borderBottomRightRadius",
      "borderBottomLeftRadius",
    ],
  },
  {
    shorthand: "borderWidth",
    longhands: [
      "borderTopWidth",
      "borderRightWidth",
      "borderBottomWidth",
      "borderLeftWidth",
    ],
  },
];

function formatStyleValue(property: string, raw: unknown): string {
  if (raw === undefined || raw === null) return "";
  if (typeof raw === "number") {
    return UNITLESS_PROPS.has(property) ? String(raw) : `${raw}px`;
  }
  return String(raw);
}

/** dirty prop 목록에서 균일한 longhand 묶음을 shorthand 하나로 접는다 (표시 전용 — reset 은 그대로) */
export function collapseUniformLonghands(
  properties: readonly string[],
  style: Record<string, unknown>,
): string[] {
  const set = new Set(properties);
  const drop = new Set<string>();
  const insert = new Map<string, string>();
  for (const { shorthand, longhands } of LONGHAND_GROUPS) {
    if (!longhands.every((lh) => set.has(lh))) continue;
    const first = formatStyleValue(longhands[0], style[longhands[0]]);
    const uniform = longhands.every(
      (lh) => formatStyleValue(lh, style[lh]) === first,
    );
    if (!uniform) {
      if (set.has(shorthand)) drop.add(shorthand);
      continue;
    }
    for (const lh of longhands) drop.add(lh);
    if (!set.has(shorthand)) insert.set(longhands[0], shorthand);
  }
  const out: string[] = [];
  for (const property of properties) {
    if (insert.has(property)) out.push(insert.get(property)!);
    if (!drop.has(property)) out.push(property);
  }
  return out;
}

function categoryRank(property: string): number {
  const index = CATEGORY_ORDER.findIndex((set) => set.has(property));
  return index === -1 ? CATEGORY_ORDER.length : index;
}

/** camelCase → 「Border Radius」 */
function formatLabel(property: string): string {
  return property
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/** 표시용 HEX (# 없이 대문자, 알파 FF 는 생략). 파싱 불가 (var 토큰 등) 는 원문 그대로. */
function toDisplayHex(value: string): string {
  try {
    const hexa = parseColor(value).toString("hexa").toUpperCase();
    const hex = hexa.slice(1);
    return hex.length === 8 && hex.endsWith("FF") ? hex.slice(0, 6) : hex;
  } catch {
    return value;
  }
}

function safeSwatchColor(value: string): Color | null {
  try {
    return parseColor(value);
  } catch {
    return null;
  }
}

const VALUE_MAX = 40;

export const ModifiedStylesSection = memo(function ModifiedStylesSection({
  selectedElement,
}: ModifiedStylesSectionProps) {
  const i18n = useOptionalI18n();
  const localize = (label: string) =>
    i18n
      ? translateKey(i18n.t, semanticLabelKeys[label] ?? label, label)
      : label;
  // baseline(factory default / spec preset / subpart)과 실제로 다른 prop 만 modified 로 표시.
  //   구 getModifiedProperties(키 존재만 판정)는 factory 가 주입한 layout default 까지 modified 로 잡아
  //   reset 버튼과 비대칭이었음(2026-06-24). useDirtyStyleProps 가 reset 판정과 동일 baseline 공유.
  const modifiedProperties = useDirtyStyleProps();
  const resetStyles = useResetStyles();
  const { accentColor, fills } = useElementStyleContext(selectedElement.id);
  const theme = useResolvedSkiaTheme();
  useThemeConfigVersion();

  // 배경은 fills(canonical 1차 SSOT)에 있다 — dirty 판정(computeBaseDirtyStyleProps)과 같은
  //   adapt 로 backgroundColor 를 surface 해야 「Background Color · 2563EB」 가 값을 갖는다.
  //   gradient/image fill 은 backgroundImage 로 나온다.
  const effectiveStyle = useMemo(() => {
    const style = selectedElement.style ?? {};
    return Array.isArray(fills) && fills.length > 0
      ? (adaptStyleWithFills(style, fills) ?? style)
      : style;
  }, [selectedElement.style, fills]);

  const rows = useMemo(
    () =>
      collapseUniformLonghands(
        modifiedProperties,
        effectiveStyle as Record<string, unknown>,
      )
        .sort((a, b) => categoryRank(a) - categoryRank(b))
        .map((property) => {
          const style = effectiveStyle as Record<string, unknown>;
          const group = LONGHAND_GROUPS.find((g) => g.shorthand === property);
          // 접힌 shorthand 는 첫 longhand 의 값 (전부 같다)
          const raw =
            group && style[property] === undefined
              ? style[group.longhands[0]]
              : style[property];
          const value = formatStyleValue(property, raw);
          const resolved = COLOR_PROPS.has(property)
            ? resolveStylePanelColor(value, theme, accentColor)
            : null;
          const swatch = resolved ? safeSwatchColor(resolved) : null;
          const display = resolved ? toDisplayHex(resolved) : value;
          return {
            property,
            label: localize(formatLabel(property)),
            raw: value,
            display:
              display.length > VALUE_MAX
                ? `${display.slice(0, VALUE_MAX)}…`
                : display,
            swatch,
          };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- localize 는 i18n 에만 의존
    [modifiedProperties, effectiveStyle, theme, accentColor, i18n],
  );

  const handleReset = useCallback(() => {
    resetStyles([...modifiedProperties]);
  }, [modifiedProperties, resetStyles]);

  if (modifiedProperties.length === 0) {
    return (
      <PropertySection title="Modified">
        <EmptyState
          icon={<PaintRoller size={32} />}
          message={localize("No modified styles")}
          description={localize("Edit any style property to see it here")}
        />
      </PropertySection>
    );
  }

  return (
    <PropertySection
      title="Modified"
      badge={
        <span className="modified-count">{rows.length}</span>
      }
      onReset={handleReset}
    >
      {rows.map((row) => (
        <div key={row.property} className="modified-row">
          <span className="modified-row__key">{row.label}</span>
          <span className="modified-row__value" title={row.raw}>
            {row.swatch && <ColorSwatch color={row.swatch} />}
            <span className="modified-row__text">{row.display}</span>
          </span>
        </div>
      ))}
    </PropertySection>
  );
});
