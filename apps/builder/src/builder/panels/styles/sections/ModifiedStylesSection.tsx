/**
 * ModifiedStylesSection - 변경된 스타일만 표시하는 섹션
 *
 * VS Code 스타일 @modified 필터
 * 사용자가 수정한 inline style만 표시
 */

import {
  PropertySection,
  PropertyUnitInput,
  PropertyColor,
  PropertySelect,
} from "../../../components";
import type { SelectedElement } from "../../../inspector/types";
import { useDirtyStyleProps } from "../hooks/useResetStyles";
import { useStyleActions } from "../hooks/useStyleActions";
import { Type, Square, RulerDimensionLine } from "lucide-react";
import {
  FONT_FAMILIES,
  FONT_WEIGHTS,
  BORDER_STYLES,
  DISPLAY_OPTIONS,
  FLEX_DIRECTION_OPTIONS,
  ALIGN_ITEMS_OPTIONS,
  JUSTIFY_CONTENT_OPTIONS,
  FLEX_WRAP_OPTIONS,
} from "../constants/styleOptions";
import { isFillDerivedStyleProp } from "../utils/fillDerivedStyleProps";

interface ModifiedStylesSectionProps {
  selectedElement: SelectedElement;
}

export function ModifiedStylesSection({
  selectedElement,
}: ModifiedStylesSectionProps) {
  // baseline(factory default / spec preset / subpart)과 실제로 다른 prop 만 modified 로 표시.
  //   getModifiedProperties(키 존재만 판정)는 factory 가 주입한 layout default 까지 modified 로 잡아
  //   reset 버튼과 비대칭이었음(2026-06-24). useDirtyStyleProps 가 reset 판정과 동일 baseline 공유.
  const modifiedProperties = useDirtyStyleProps();
  const { updateStyle } = useStyleActions();

  if (modifiedProperties.length === 0) {
    return (
      <PropertySection title="Modified Styles">
        <div className="empty-state">
          <p className="empty-message">No modified styles</p>
          <p className="empty-hint">Edit any style property to see it here</p>
        </div>
      </PropertySection>
    );
  }

  // Group properties by category for better organization
  const categorizedProps = {
    layout: modifiedProperties.filter((p) =>
      [
        "display",
        "flexDirection",
        "alignItems",
        "justifyContent",
        "gap",
        "flexWrap",
      ].includes(p),
    ),
    spacing: modifiedProperties.filter((p) =>
      [
        "padding",
        "margin",
        "width",
        "height",
        "top",
        "left",
        "right",
        "bottom",
      ].includes(p),
    ),
    appearance: modifiedProperties.filter((p) =>
      [
        "backgroundColor",
        "backgroundImage",
        "backgroundSize",
        "borderColor",
        "borderWidth",
        "borderRadius",
        "borderStyle",
        "overflow",
        "boxShadow",
      ].includes(p),
    ),
    typography: modifiedProperties.filter((p) =>
      [
        "fontFamily",
        "fontSize",
        "fontWeight",
        "fontStyle",
        "lineHeight",
        "letterSpacing",
        "color",
        "textAlign",
        "textDecoration",
        "textTransform",
        "verticalAlign",
      ].includes(p),
    ),
  };

  // Render property input based on type
  const renderProperty = (property: string) => {
    const value =
      selectedElement.style?.[property as keyof React.CSSProperties];
    if (!value) return null;

    // Fill V2 에서는 background* 가 파생 필드이므로 read-only display
    if (
      property === "backgroundImage" ||
      property === "backgroundSize" ||
      isFillDerivedStyleProp(property)
    ) {
      const displayValue = String(value);
      const truncated =
        displayValue.length > 30
          ? displayValue.slice(0, 30) + "…"
          : displayValue;
      return (
        <div key={property} className="modified-readonly-field">
          <span className="modified-readonly-label">
            {formatLabel(property)}
          </span>
          <span className="modified-readonly-value" title={displayValue}>
            {truncated}
          </span>
        </div>
      );
    }

    // Color properties
    if (["backgroundColor", "borderColor", "color"].includes(property)) {
      return (
        <PropertyColor
          key={property}
          icon={Square}
          label={formatLabel(property)}
          value={String(value)}
          onChange={(newValue) => updateStyle(property, newValue)}
        />
      );
    }

    // Font family
    if (property === "fontFamily") {
      return (
        <PropertySelect
          key={property}
          icon={Type}
          label={formatLabel(property)}
          value={String(value)}
          options={FONT_FAMILIES}
          onChange={(newValue) => updateStyle(property, newValue)}
        />
      );
    }

    // Font weight
    if (property === "fontWeight") {
      return (
        <PropertySelect
          key={property}
          icon={Type}
          label={formatLabel(property)}
          value={String(value)}
          options={FONT_WEIGHTS}
          onChange={(newValue) => updateStyle(property, newValue)}
        />
      );
    }

    // Border style
    if (property === "borderStyle") {
      return (
        <PropertySelect
          key={property}
          icon={Square}
          label={formatLabel(property)}
          value={String(value)}
          options={BORDER_STYLES}
          onChange={(newValue) => updateStyle(property, newValue)}
        />
      );
    }

    // Layout properties (display, flexDirection, alignItems, justifyContent, flexWrap)
    if (property === "display") {
      return (
        <PropertySelect
          key={property}
          icon={Square}
          label={formatLabel(property)}
          value={String(value)}
          options={DISPLAY_OPTIONS}
          onChange={(newValue) => updateStyle(property, newValue)}
        />
      );
    }

    if (property === "flexDirection") {
      return (
        <PropertySelect
          key={property}
          icon={Square}
          label={formatLabel(property)}
          value={String(value)}
          options={FLEX_DIRECTION_OPTIONS}
          onChange={(newValue) => updateStyle(property, newValue)}
        />
      );
    }

    if (property === "alignItems") {
      return (
        <PropertySelect
          key={property}
          icon={Square}
          label={formatLabel(property)}
          value={String(value)}
          options={ALIGN_ITEMS_OPTIONS}
          onChange={(newValue) => updateStyle(property, newValue)}
        />
      );
    }

    if (property === "justifyContent") {
      return (
        <PropertySelect
          key={property}
          icon={Square}
          label={formatLabel(property)}
          value={String(value)}
          options={JUSTIFY_CONTENT_OPTIONS}
          onChange={(newValue) => updateStyle(property, newValue)}
        />
      );
    }

    if (property === "flexWrap") {
      return (
        <PropertySelect
          key={property}
          icon={Square}
          label={formatLabel(property)}
          value={String(value)}
          options={FLEX_WRAP_OPTIONS}
          onChange={(newValue) => updateStyle(property, newValue)}
        />
      );
    }

    // Unit-based properties (most common)
    return (
      <PropertyUnitInput
        key={property}
        icon={RulerDimensionLine}
        label={formatLabel(property)}
        value={String(value)}
        units={getUnitsForProperty(property)}
        onChange={(newValue) => updateStyle(property, newValue)}
        min={getMinForProperty(property)}
        max={getMaxForProperty(property)}
      />
    );
  };

  return (
    <PropertySection title={`Modified Styles (${modifiedProperties.length})`}>
      {categorizedProps.layout.length > 0 && (
        <div className="modified-category">
          <h4 className="category-title">Layout</h4>
          {categorizedProps.layout.map(renderProperty)}
        </div>
      )}

      {categorizedProps.spacing.length > 0 && (
        <div className="modified-category">
          <h4 className="category-title">Spacing</h4>
          {categorizedProps.spacing.map(renderProperty)}
        </div>
      )}

      {categorizedProps.appearance.length > 0 && (
        <div className="modified-category">
          <h4 className="category-title">Appearance</h4>
          {categorizedProps.appearance.map(renderProperty)}
        </div>
      )}

      {categorizedProps.typography.length > 0 && (
        <div className="modified-category">
          <h4 className="category-title">Typography</h4>
          {categorizedProps.typography.map(renderProperty)}
        </div>
      )}
    </PropertySection>
  );
}

// Helper: Format property name to readable label
function formatLabel(property: string): string {
  return property
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

// Helper: Get units for property
function getUnitsForProperty(property: string): string[] {
  if (
    ["width", "height", "top", "left", "right", "bottom"].includes(property)
  ) {
    return ["reset", "px", "%", "rem", "em", "vh", "vw"];
  }
  if (["padding", "margin", "gap"].includes(property)) {
    return ["reset", "px", "rem", "em"];
  }
  if (["fontSize", "lineHeight", "letterSpacing"].includes(property)) {
    return ["reset", "px", "rem", "em", "pt"];
  }
  if (["borderWidth"].includes(property)) {
    return ["reset", "px"];
  }
  if (["borderRadius"].includes(property)) {
    return ["reset", "px", "%", "rem", "em"];
  }
  return ["px"];
}

// Helper: Get min value for property
function getMinForProperty(property: string): number {
  if (["top", "left", "right", "bottom", "letterSpacing"].includes(property)) {
    return -9999;
  }
  return 0;
}

// Helper: Get max value for property
function getMaxForProperty(property: string): number {
  if (
    ["width", "height", "top", "left", "right", "bottom"].includes(property)
  ) {
    return 9999;
  }
  if (["padding", "margin", "gap", "borderRadius"].includes(property)) {
    return 500;
  }
  if (["fontSize"].includes(property)) {
    return 200;
  }
  if (["borderWidth"].includes(property)) {
    return 100;
  }
  if (["lineHeight", "letterSpacing"].includes(property)) {
    return 10;
  }
  return 9999;
}
