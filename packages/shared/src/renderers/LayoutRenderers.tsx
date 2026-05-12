import React from "react";
import {
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Card,
  Dialog,
  Popover,
  Button,
  Link,
  Badge,
  Tooltip,
  ProgressBar,
  Meter,
  Separator,
  Breadcrumbs,
  Breadcrumb,
  Group,
  Skeleton,
  RangeCalendar,
} from "../components/list";
import { Disclosure } from "../components/Disclosure";
import { DisclosureGroup } from "../components/DisclosureGroup";
import { ColorSwatch } from "../components/ColorSwatch";
import {
  ColorSwatchPicker,
  ColorSwatchPickerItem,
} from "../components/ColorSwatchPicker";
import { parseColor } from "react-aria-components";
import { Slot } from "../components/Slot";
import { getIconData } from "@composition/specs";
import { getElementDataBinding } from "../utils/compositionExtensionFields";
import type {
  PreviewElement,
  RenderContext,
  ColumnMapping,
  BadgeVariant,
  ComponentSize,
} from "../types";

/** Button 내부 아이콘 SVG 렌더링 (Preview용) */
const BUTTON_ICON_SIZE_MAP: Record<string, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
};

function renderButtonIcon(
  iconName: string,
  size?: string,
  strokeWidth?: number,
  overrideFontSize?: number,
): React.ReactNode | null {
  const data = getIconData(iconName);
  if (!data) return null;
  // fontSize 오버라이드 시 iconSize = fontSize
  const s =
    overrideFontSize != null
      ? overrideFontSize
      : (BUTTON_ICON_SIZE_MAP[size || "md"] ?? 16);
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {data.paths.map((d: string, i: number) => (
        <path key={i} d={d} />
      ))}
      {data.circles?.map(
        (c: { cx: number; cy: number; r: number }, i: number) => (
          <circle key={`c${i}`} cx={c.cx} cy={c.cy} r={c.r} />
        ),
      )}
    </svg>
  );
}

/**
 * Layout 관련 컴포넌트 렌더러
 * - Tabs, TabList, Tab, TabPanel
 * - Panel
 * - Card
 * - Button
 * - Text
 * - Tooltip, ProgressBar, Meter
 */

/**
 * Tabs 렌더링
 */
export const renderTabs = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { childrenByParent, updateElementProps, renderElement } = context;

  // PropertyDataBinding 형식 감지
  const dataBinding = getElementDataBinding(element);
  const isPropertyBinding =
    dataBinding &&
    typeof dataBinding === "object" &&
    "source" in (dataBinding as object) &&
    "name" in (dataBinding as object) &&
    !("type" in (dataBinding as object));

  // ADR-066: items SSOT 기반 렌더. Tab element 없음.
  const items =
    (element.props.items as Array<{ id: string; title: string }>) ?? [];

  // TabPanel element는 TabPanels 아래에 존재, itemId로 items와 페어링.
  const tabPanelsElement = childrenByParent
    .get(element.id)
    ?.find((child) => child.type === "TabPanels");
  const panelChildren = tabPanelsElement
    ? (childrenByParent
        .get(tabPanelsElement.id)
        ?.filter((child) => child.type === "TabPanel") ?? [])
    : [];
  const findPanelForItem = (itemId: string) =>
    panelChildren.find(
      (p) => (p.props as { itemId?: string }).itemId === itemId,
    );

  return (
    <Tabs
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      defaultSelectedKey={String(element.props.defaultSelectedKey || "")}
      density={
        (element.props.density as "compact" | "regular" | undefined) ||
        "regular"
      }
      orientation={
        (element.props.orientation as "horizontal" | "vertical") || "horizontal"
      }
      size={(element.props.size as ComponentSize) || "md"}
      isDisabled={Boolean(element.props.isDisabled)}
      dataBinding={
        isPropertyBinding
          ? dataBinding
          : getElementDataBinding(element, "legacy-only")
      }
      columnMapping={element.props.columnMapping as ColumnMapping | undefined}
      onSelectionChange={(key) => {
        const updatedProps = {
          ...element.props,
          selectedKey: key,
        };
        updateElementProps(element.id, updatedProps);
      }}
    >
      <TabList
        density={
          (element.props.density as "compact" | "regular" | undefined) ||
          "regular"
        }
        size={(element.props.size as ComponentSize) || "md"}
        showIndicator={element.props.showIndicator !== false}
        items={items}
      >
        {(item) => <Tab id={item.id}>{item.title}</Tab>}
      </TabList>

      {items.map((item) => {
        const panel = findPanelForItem(item.id);
        if (!panel) {
          console.warn(`No TabPanel element found for item ${item.id}`);
          return null;
        }
        return (
          <TabPanel
            key={panel.id}
            id={item.id}
            data-element-id={panel.id}
            style={panel.props.style}
            className={panel.props.className}
          >
            {(context.childrenByParent.get(panel.id) ?? []).map((child) =>
              renderElement(child, child.id),
            )}
          </TabPanel>
        );
      })}
    </Tabs>
  );
};

/**
 * TabList 렌더링
 * TabList는 부모 Tabs 렌더러가 직접 처리하므로 null 반환
 */
export const renderTabList = (
  _element: PreviewElement,
  _context: RenderContext,
): React.ReactNode => {
  return null;
};

/**
 * TabPanels 렌더링
 * TabPanels는 부모 Tabs 렌더러가 직접 처리하므로 null 반환
 */
export const renderTabPanels = (
  _element: PreviewElement,
  _context: RenderContext,
): React.ReactNode => {
  return null;
};

/**
 * Card 렌더링
 */
export const renderCard = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const allChildren = context.childrenByParent.get(element.id) ?? [];

  // 새 구조 감지: CardHeader/CardContent/CardPreview/CardFooter 자식이 있는지 확인
  const hasStructuralChildren = allChildren.some(
    (c) =>
      c.type === "CardHeader" ||
      c.type === "CardContent" ||
      c.type === "CardPreview" ||
      c.type === "CardFooter",
  );

  const eventHandlers =
    context.services?.createEventHandlerMap?.(element, context) ?? {};

  if (hasStructuralChildren) {
    // 새 구조: title/description은 children(CardHeader/CardContent)에서 처리
    return (
      <Card
        key={element.id}
        id={element.customId}
        data-element-id={element.id}
        data-accent={
          element.props.accentColor
            ? String(element.props.accentColor)
            : undefined
        }
        cardType={
          (element.props.cardType as
            | "default"
            | "asset"
            | "user"
            | "product") || undefined
        }
        size={(element.props.size as "sm" | "md" | "lg" | undefined) || "md"}
        isQuiet={Boolean(element.props.isQuiet)}
        isSelected={Boolean(element.props.isSelected)}
        isDisabled={Boolean(element.props.isDisabled)}
        isFocused={Boolean(element.props.isFocused)}
        structuralChildren={true}
        style={element.props.style}
        className={element.props.className}
        onClick={eventHandlers.onClick as unknown as () => void}
      >
        {allChildren.map((child) => renderElement(child, child.id))}
      </Card>
    );
  }

  // 이전 구조: Heading/Description은 title/description props로 처리
  const children = allChildren.filter(
    (child) => child.type !== "Heading" && child.type !== "Description",
  );

  return (
    <Card
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      data-accent={
        element.props.accentColor
          ? String(element.props.accentColor)
          : undefined
      }
      heading={
        typeof element.props.heading === "string"
          ? element.props.heading
          : undefined
      }
      subheading={
        typeof element.props.subheading === "string"
          ? element.props.subheading
          : undefined
      }
      title={
        typeof element.props.title === "string"
          ? element.props.title
          : undefined
      }
      description={
        element.props.description
          ? String(element.props.description)
          : undefined
      }
      footer={
        typeof element.props.footer === "string"
          ? element.props.footer
          : undefined
      }
      cardType={
        (element.props.cardType as "default" | "asset" | "user" | "product") ||
        undefined
      }
      size={(element.props.size as "sm" | "md" | "lg" | undefined) || "md"}
      isQuiet={Boolean(element.props.isQuiet)}
      isSelected={Boolean(element.props.isSelected)}
      isDisabled={Boolean(element.props.isDisabled)}
      isFocused={Boolean(element.props.isFocused)}
      style={element.props.style}
      className={element.props.className}
      onClick={eventHandlers.onClick as unknown as () => void}
    >
      {typeof element.props.children === "string"
        ? element.props.children
        : null}
      {children.map((child) => renderElement(child, child.id))}
    </Card>
  );
};

/**
 * CardHeader 렌더링
 * Card 새 구조에서 header 영역을 담당하는 투명 컨테이너
 */
export const renderCardHeader = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <div
      key={element.id}
      data-element-id={element.id}
      className="card-header"
      style={element.props?.style as React.CSSProperties}
    >
      {children.map((child) => renderElement(child, child.id))}
    </div>
  );
};

/**
 * CardContent 렌더링
 * Card 새 구조에서 content 영역을 담당하는 투명 컨테이너
 *
 * Description 자식은 React Aria slot="description" 컨텍스트가 없으므로
 * plain <div class="card-description"> 으로 직접 렌더링
 */
export const renderCardContent = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <div
      key={element.id}
      data-element-id={element.id}
      className="card-content"
      style={element.props?.style as React.CSSProperties}
    >
      {children.map((child) => {
        // Description: React Aria slot 컨텍스트 없이 직접 렌더링
        if (child.type === "Description") {
          const text =
            typeof child.props?.children === "string"
              ? child.props.children
              : typeof child.props?.text === "string"
                ? child.props.text
                : null;
          return (
            <div
              key={child.id}
              data-element-id={child.id}
              className="card-description"
              style={child.props?.style as React.CSSProperties}
            >
              {text}
            </div>
          );
        }
        return renderElement(child, child.id);
      })}
    </div>
  );
};

/**
 * CardPreview 렌더링
 * Card 구조에서 이미지/미디어 미리보기 영역을 담당하는 컨테이너
 */
export const renderCardPreview = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <div
      key={element.id}
      data-element-id={element.id}
      className="card-preview"
      style={element.props?.style as React.CSSProperties}
    >
      {children.map((child) => renderElement(child, child.id))}
    </div>
  );
};

/**
 * CardFooter 렌더링
 * Card 구조에서 하단 액션/상태 영역을 담당하는 컨테이너
 */
export const renderCardFooter = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <div
      key={element.id}
      data-element-id={element.id}
      className="card-footer"
      style={element.props?.style as React.CSSProperties}
    >
      {children.map((child) => renderElement(child, child.id))}
    </div>
  );
};

/**
 * Button 렌더링
 */
export const renderButton = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  const eventHandlers =
    context.services?.createEventHandlerMap?.(element, context) ?? {};

  // React Aria Button은 onPress를 사용하므로 onClick과 onPress 모두 확인
  const handlePress = eventHandlers.onPress || eventHandlers.onClick;

  return (
    <Button
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      variant={
        (element.props.variant as
          | "accent"
          | "primary"
          | "secondary"
          | "negative"
          | "premium"
          | "genai") || "primary"
      }
      fillStyle={(element.props.fillStyle as "fill" | "outline") || "fill"}
      size={element.props.size as "xs" | "sm" | "md" | "lg" | "xl"}
      type={(element.props.type as "button" | "submit" | "reset") || "button"}
      isDisabled={Boolean(element.props.isDisabled as boolean)}
      isPending={Boolean(element.props.isPending)}
      name={element.props.name ? String(element.props.name) : undefined}
      style={element.props.style}
      className={element.props.className}
      onPress={handlePress as unknown as () => void}
      onHoverStart={
        eventHandlers.onMouseEnter as unknown as (e: unknown) => void
      }
      onHoverEnd={eventHandlers.onMouseLeave as unknown as (e: unknown) => void}
      onFocus={eventHandlers.onFocus as unknown as (e: unknown) => void}
      onBlur={eventHandlers.onBlur as unknown as (e: unknown) => void}
      onKeyDown={eventHandlers.onKeyDown as unknown as (e: unknown) => void}
      onKeyUp={eventHandlers.onKeyUp as unknown as (e: unknown) => void}
      {...(element.props.iconName && !element.props.children
        ? { "data-icon-only": true }
        : {})}
    >
      {(() => {
        const iconName = element.props.iconName as string | undefined;
        const iconPos = (element.props.iconPosition as string) || "start";
        const styleFontSize =
          element.props.style?.fontSize != null
            ? typeof element.props.style.fontSize === "number"
              ? element.props.style.fontSize
              : parseFloat(String(element.props.style.fontSize)) || undefined
            : undefined;
        const iconSvg = iconName
          ? renderButtonIcon(
              iconName,
              element.props.size as string,
              element.props.iconStrokeWidth as number | undefined,
              styleFontSize,
            )
          : null;
        const textContent =
          typeof element.props.children === "string"
            ? element.props.children
            : children.length === 0 && !iconName
              ? "Button"
              : null;

        return (
          <>
            {iconSvg && iconPos === "start" && iconSvg}
            {textContent}
            {iconSvg && iconPos === "end" && iconSvg}
          </>
        );
      })()}
      {children.map((child) => renderElement(child, child.id))}
    </Button>
  );
};

// ADR-058 Phase 1: renderText 제거 — Text는 Spec 경로 + getElementForTag fallback으로 처리
// (buildSpecNodeData가 Skia 렌더링, Text.css가 auto-generated).

/**
 * Tooltip 렌더링
 */
export const renderTooltip = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <Tooltip
      key={element.id}
      data-element-id={element.id}
      data-variant={element.props.variant || "default"}
      data-size={element.props.size || "md"}
      style={element.props.style}
      className={element.props.className}
      placement={
        (element.props.placement as
          | "top"
          | "bottom"
          | "left"
          | "right"
          | "top start"
          | "top end"
          | "bottom start"
          | "bottom end") || undefined
      }
      offset={
        element.props.offset !== undefined
          ? Number(element.props.offset)
          : undefined
      }
      containerPadding={
        element.props.containerPadding !== undefined
          ? Number(element.props.containerPadding)
          : undefined
      }
      crossOffset={
        element.props.crossOffset !== undefined
          ? Number(element.props.crossOffset)
          : undefined
      }
      shouldFlip={
        element.props.shouldFlip !== undefined
          ? Boolean(element.props.shouldFlip)
          : undefined
      }
    >
      {typeof element.props.children === "string"
        ? element.props.children
        : null}
      {children.map((child) => renderElement(child, child.id))}
    </Tooltip>
  );
};

/**
 * Dialog 렌더링
 */
export const renderDialog = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <Dialog
      key={element.id}
      data-element-id={element.id}
      data-size={element.props.size || "md"}
      style={element.props.style}
      className={element.props.className}
      role={(element.props.role as "dialog" | "alertdialog") || "dialog"}
      isDismissable={Boolean(element.props.isDismissable)}
    >
      {typeof element.props.children === "string"
        ? element.props.children
        : null}
      {children.map((child) => renderElement(child, child.id))}
    </Dialog>
  );
};

/**
 * Popover 렌더링
 */
export const renderPopover = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <Popover
      key={element.id}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      size={element.props.size as ComponentSize | undefined}
      placement={
        (element.props.placement as
          | "top"
          | "bottom"
          | "left"
          | "right"
          | "top start"
          | "top end"
          | "bottom start"
          | "bottom end") || undefined
      }
      crossOffset={
        element.props.crossOffset !== undefined
          ? Number(element.props.crossOffset)
          : undefined
      }
      shouldFlip={
        element.props.shouldFlip !== undefined
          ? Boolean(element.props.shouldFlip)
          : undefined
      }
      containerPadding={
        element.props.containerPadding !== undefined
          ? Number(element.props.containerPadding)
          : undefined
      }
    >
      {typeof element.props.children === "string"
        ? element.props.children
        : null}
      {children.map((child) => renderElement(child, child.id))}
    </Popover>
  );
};

/**
 * ProgressBar 렌더링
 */
export const renderProgressBar = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { childrenByParent } = context;

  // Child element에서 label 읽기 (compositional 패턴)
  const labelEl = childrenByParent
    .get(element.id)
    ?.find((c) => c.type === "Label");
  const label = labelEl
    ? String(labelEl.props?.children || "")
    : String(element.props.label || "");

  return (
    <ProgressBar
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      label={label}
      variant={
        (element.props.variant as "default" | "accent" | "neutral") || "default"
      }
      value={Number(element.props.value || 0)}
      minValue={
        element.props.minValue !== undefined
          ? Number(element.props.minValue)
          : 0
      }
      maxValue={
        element.props.maxValue !== undefined
          ? Number(element.props.maxValue)
          : 100
      }
      isIndeterminate={Boolean(element.props.isIndeterminate || false)}
      size={(element.props.size as "sm" | "md" | "lg") || "md"}
      showValueLabel={element.props.showValueLabel !== false}
      valueLabel={
        element.props.valueLabel ? String(element.props.valueLabel) : undefined
      }
      formatOptions={
        element.props.formatOptions &&
        typeof element.props.formatOptions === "object"
          ? (element.props.formatOptions as Intl.NumberFormatOptions)
          : undefined
      }
      locale={(element.props.locale as string) || undefined}
      labelPosition={(element.props.labelPosition as "top" | "side") || "top"}
    />
  );
};

/**
 * Meter 렌더링
 */
export const renderMeter = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { childrenByParent } = context;

  // Child element에서 label 읽기 (compositional 패턴)
  const meterLabelEl = childrenByParent
    .get(element.id)
    ?.find((c) => c.type === "Label");
  const meterLabel = meterLabelEl
    ? String(meterLabelEl.props?.children || "")
    : String(element.props.label || "");

  return (
    <Meter
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      label={meterLabel}
      value={Number(element.props.value || 0)}
      minValue={
        element.props.minValue !== undefined
          ? Number(element.props.minValue)
          : 0
      }
      maxValue={
        element.props.maxValue !== undefined
          ? Number(element.props.maxValue)
          : 100
      }
      variant={
        (element.props.variant as
          | "informative"
          | "positive"
          | "warning"
          | "critical") || "informative"
      }
      size={(element.props.size as "sm" | "md" | "lg") || "md"}
      showValueLabel={element.props.showValueLabel !== false}
      valueLabel={
        element.props.valueLabel ? String(element.props.valueLabel) : undefined
      }
      formatOptions={
        element.props.formatOptions &&
        typeof element.props.formatOptions === "object"
          ? (element.props.formatOptions as Intl.NumberFormatOptions)
          : undefined
      }
      locale={(element.props.locale as string) || undefined}
      labelPosition={(element.props.labelPosition as "top" | "side") || "top"}
    />
  );
};

/**
 * Separator 렌더링
 */
export const renderSeparator = (
  element: PreviewElement,
  _context: RenderContext,
): React.ReactNode => {
  return (
    <Separator
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      orientation={
        (element.props.orientation as "horizontal" | "vertical") || "horizontal"
      }
      variant={
        (element.props.variant as "default" | "dashed" | "dotted") || "default"
      }
      size={(element.props.size as "sm" | "md" | "lg") || "md"}
      style={element.props.style}
      className={element.props.className}
    />
  );
};

/**
 * Group 렌더링
 */
export const renderGroup = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <Group
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      data-accent={
        element.props.accentColor
          ? String(element.props.accentColor)
          : undefined
      }
      label={element.props.label as string | undefined}
      isDisabled={Boolean(element.props.isDisabled)}
      isInvalid={Boolean(element.props.isInvalid)}
      isReadOnly={Boolean(element.props.isReadOnly)}
      role={
        (element.props.role as "group" | "region" | "presentation") || "group"
      }
      aria-label={element.props["aria-label"] as string | undefined}
      aria-labelledby={element.props["aria-labelledby"] as string | undefined}
      style={element.props.style}
      className={element.props.className}
    >
      {children.map((child) => renderElement(child, child.id))}
    </Group>
  );
};

/**
 * Modal 렌더링
 */
export const renderModal = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;
  const eventHandlers =
    context.services?.createEventHandlerMap?.(element, context) ?? {};

  const children = context.childrenByParent.get(element.id) ?? [];

  const resolvedId = element.customId || element.id;
  const mergedStyle = {
    ...(element.props.style || {}),
    display:
      element.props.isOpen === false
        ? "none"
        : (element.props.style as React.CSSProperties | undefined)?.display,
  };

  return (
    <div
      key={element.id}
      id={resolvedId}
      data-element-id={element.id}
      data-custom-id={element.customId}
      data-accent={
        element.props.accentColor
          ? String(element.props.accentColor)
          : undefined
      }
      role="dialog"
      aria-modal="true"
      className={element.props.className}
      style={mergedStyle}
      onClick={eventHandlers.onClick as unknown as () => void}
    >
      {children.length === 0 && typeof element.props.children === "string"
        ? element.props.children
        : children.map((child) => renderElement(child, child.id))}
    </div>
  );
};

/**
 * Breadcrumbs 렌더링
 */
export const renderBreadcrumbs = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;
  const eventHandlers =
    context.services?.createEventHandlerMap?.(element, context) ?? {};

  // PropertyDataBinding 형식 감지
  const dataBinding = getElementDataBinding(element);
  const isPropertyBinding =
    dataBinding &&
    typeof dataBinding === "object" &&
    "source" in (dataBinding as object) &&
    "name" in (dataBinding as object) &&
    !("type" in (dataBinding as object));

  const breadcrumbChildren = (
    context.childrenByParent.get(element.id) ?? []
  ).filter((child) => child.type === "Breadcrumb");

  return (
    <Breadcrumbs
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      data-size={(element.props.size as string) || "M"}
      data-variant={(element.props.variant as string) || "default"}
      aria-label={
        typeof element.props["aria-label"] === "string"
          ? element.props["aria-label"]
          : undefined
      }
      size={element.props.size as "S" | "M" | "L" | undefined}
      isDisabled={Boolean(element.props.isDisabled)}
      style={element.props.style}
      className={element.props.className}
      dataBinding={
        isPropertyBinding
          ? dataBinding
          : getElementDataBinding(element, "legacy-only")
      }
      columnMapping={element.props.columnMapping as ColumnMapping | undefined}
      {...eventHandlers}
    >
      {breadcrumbChildren.map((child) => renderElement(child, child.id))}
    </Breadcrumbs>
  );
};

/**
 * Breadcrumb (아이템) 렌더링
 */
export const renderBreadcrumb = (
  element: PreviewElement,
  _context: RenderContext,
): React.ReactNode => {
  return (
    <Breadcrumb
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      href={String(element.props.href || "")}
    >
      {element.props.children}
    </Breadcrumb>
  );
};

/**
 * Link 렌더링
 */
export const renderLink = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  const eventHandlers =
    context.services?.createEventHandlerMap?.(element, context) ?? {};

  return (
    <Link
      key={element.id}
      data-custom-id={element.customId || undefined}
      data-element-id={element.id}
      href={String(element.props.href || "")}
      variant={(element.props.variant as "primary" | "secondary") || undefined}
      size={
        (element.props.size as "xs" | "sm" | "md" | "lg" | "xl") || undefined
      }
      isQuiet={Boolean(element.props.isQuiet)}
      staticColor={
        (element.props.staticColor as "auto" | "black" | "white") || "auto"
      }
      isExternal={Boolean(element.props.isExternal)}
      showExternalIcon={element.props.showExternalIcon !== false}
      isDisabled={Boolean(element.props.isDisabled)}
      target={(element.props.target as string) || undefined}
      rel={(element.props.rel as string) || undefined}
      style={element.props.style}
      className={element.props.className}
      onPress={eventHandlers.onPress as unknown as () => void}
      onHoverStart={
        eventHandlers.onMouseEnter as unknown as (e: unknown) => void
      }
      onHoverEnd={eventHandlers.onMouseLeave as unknown as (e: unknown) => void}
      onFocus={eventHandlers.onFocus as unknown as (e: unknown) => void}
      onBlur={eventHandlers.onBlur as unknown as (e: unknown) => void}
    >
      {typeof element.props.children === "string"
        ? element.props.children
        : children.length === 0
          ? "Link"
          : null}
      {children.map((child) => renderElement(child, child.id))}
    </Link>
  );
};

/**
 * Badge 렌더링
 */
export const renderBadge = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <Badge
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      variant={(element.props.variant as BadgeVariant) || undefined}
      fillStyle={
        (element.props.fillStyle as "bold" | "subtle" | "outline") || undefined
      }
      size={(element.props.size as "sm" | "md" | "lg") || undefined}
      isDot={Boolean(element.props.isDot)}
      isPulsing={Boolean(element.props.isPulsing)}
      style={element.props.style}
      className={element.props.className}
    >
      {typeof element.props.children === "string"
        ? element.props.children
        : children.length === 0
          ? "1"
          : null}
      {children.map((child) => renderElement(child, child.id))}
    </Badge>
  );
};

/**
 * Slot 렌더링
 *
 * Layout 내에서 Page 콘텐츠가 삽입될 위치를 표시하는 컴포넌트.
 * - Layout 편집 모드: 빈 플레이스홀더 표시
 * - Page 렌더링 모드: Page elements로 교체됨 (layoutResolver에서 처리)
 */
export const renderSlot = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement, editMode } = context;

  // Layout 편집 모드인지 확인
  const isLayoutEditMode = editMode === "layout";

  // Slot에 들어갈 자식 요소들 (이미 layoutResolver에서 배치됨)
  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <Slot
      key={element.id}
      data-element-id={element.id}
      name={String(element.props.name || "content")}
      required={Boolean(element.props.required)}
      description={String(element.props.description || "")}
      isEditMode={isLayoutEditMode}
      style={element.props.style}
      className={element.props.className}
    >
      {children.map((child) => renderElement(child, child.id))}
    </Slot>
  );
};

/**
 * Toast 렌더링
 *
 * Toast(div 컨테이너)
 *   ├─ Heading
 *   └─ Description
 */
export const renderToast = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;
  const eventHandlers =
    context.services?.createEventHandlerMap?.(element, context) ?? {};

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <div
      key={element.id}
      data-element-id={element.id}
      data-custom-id={element.customId}
      data-position={(element.props.position as string) || "top-right"}
      data-variant={(element.props.variant as string) || "info"}
      data-timeout={
        element.props.timeout !== undefined
          ? String(element.props.timeout)
          : undefined
      }
      data-max-toasts={
        element.props.maxToasts !== undefined
          ? String(element.props.maxToasts)
          : undefined
      }
      data-accent={
        element.props.accentColor
          ? String(element.props.accentColor)
          : undefined
      }
      role="alert"
      style={element.props.style}
      className={element.props.className}
      onClick={eventHandlers.onClick as unknown as () => void}
    >
      {children.length > 0
        ? children.map((child) => renderElement(child, child.id))
        : (element.props.defaultTitle as React.ReactNode) ||
          (element.props.defaultDescription as React.ReactNode) ||
          (element.props.children as React.ReactNode) ||
          "Toast"}
    </div>
  );
};

/**
 * Pagination 렌더링
 *
 * Pagination(nav 컨테이너)
 *   ├─ Button (Prev)
 *   ├─ Button (1, 2, 3...)
 *   └─ Button (Next)
 */
export const renderPagination = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;
  const eventHandlers =
    context.services?.createEventHandlerMap?.(element, context) ?? {};

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <nav
      key={element.id}
      data-element-id={element.id}
      data-accent={
        element.props.accentColor
          ? String(element.props.accentColor)
          : undefined
      }
      data-custom-id={element.customId}
      aria-label="Pagination"
      style={element.props.style}
      className={element.props.className}
      onClick={eventHandlers.onClick as unknown as () => void}
    >
      {children.map((child) => renderElement(child, child.id))}
    </nav>
  );
};

/**
 * Skeleton 렌더링
 *
 * 로딩 상태를 나타내는 플레이스홀더 컴포넌트.
 */
export const renderSkeleton = (
  element: PreviewElement,
  _context: RenderContext,
): React.ReactNode => {
  return (
    <Skeleton
      key={element.id}
      data-element-id={element.id}
      variant={
        (element.props.variant as
          | "text"
          | "circular"
          | "rectangular"
          | "rounded") || "text"
      }
      animation={
        (element.props.animation as "shimmer" | "pulse" | "wave" | "none") ||
        "shimmer"
      }
      width={
        element.props.width !== undefined
          ? (element.props.width as string | number)
          : undefined
      }
      height={
        element.props.height !== undefined
          ? (element.props.height as string | number)
          : undefined
      }
      lines={
        element.props.lines !== undefined
          ? Number(element.props.lines)
          : undefined
      }
      lastLineWidth={
        typeof element.props.lastLineWidth === "string"
          ? element.props.lastLineWidth
          : undefined
      }
      componentVariant={
        element.props.componentVariant as
          | import("../components/Skeleton").ComponentSkeletonVariant
          | undefined
      }
      size={(element.props.size as "sm" | "md" | "lg") || "md"}
      style={element.props.style}
      className={element.props.className}
    />
  );
};

// ==================== Phase 1: Display/Feedback ====================

/**
 * Avatar 렌더링
 */
export const renderAvatar = (
  element: PreviewElement,
  _context: RenderContext,
): React.ReactNode => {
  const size =
    { xs: 24, sm: 28, md: 32, lg: 40, xl: 48 }[
      (element.props.size as string) || "md"
    ] ?? 32;

  return (
    <div
      key={element.id}
      data-element-id={element.id}
      data-custom-id={element.customId}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--bg-muted)",
        color: "var(--fg)",
        fontSize: size * 0.4,
        fontWeight: 500,
        flexShrink: 0,
        ...element.props.style,
      }}
      className={element.props.className}
    >
      {element.props.src ? (
        <img
          src={element.props.src as string}
          alt={(element.props.alt as string) || "Avatar"}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span>{(element.props.initials as string) || "?"}</span>
      )}
    </div>
  );
};

/**
 * AvatarGroup 렌더링
 */
export const renderAvatarGroup = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <div
      key={element.id}
      data-element-id={element.id}
      data-custom-id={element.customId}
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        ...element.props.style,
      }}
      className={element.props.className}
    >
      {children.map((child) => renderElement(child, child.id))}
    </div>
  );
};

/**
 * StatusLight 렌더링
 */
export const renderStatusLight = (
  element: PreviewElement,
  _context: RenderContext,
): React.ReactNode => {
  const size = String(element.props.size || "md").toLowerCase();
  const dotSize = { sm: 8, md: 10, lg: 12 }[size] ?? 10;
  const fontSize = { sm: 12, md: 14, lg: 16 }[size] ?? 14;

  const variantColorMap: Record<string, string> = {
    neutral: "var(--fg-muted)",
    informative: "var(--color-info-600, #2563eb)",
    positive: "var(--color-green-600, #16a34a)",
    notice: "var(--color-warning-600, #d97706)",
    negative: "var(--negative, #dc2626)",
  };
  const color =
    variantColorMap[(element.props.variant as string) || "neutral"] ||
    "var(--fg-muted)";

  return (
    <div
      key={element.id}
      data-element-id={element.id}
      data-custom-id={element.customId}
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        ...element.props.style,
      }}
      className={element.props.className}
    >
      <span
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: "50%",
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      {element.props.children && (
        <span style={{ fontSize }}>{element.props.children as string}</span>
      )}
    </div>
  );
};

/**
 * InlineAlert 렌더링
 */
export const renderInlineAlert = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <div
      key={element.id}
      data-element-id={element.id}
      data-custom-id={element.customId}
      data-variant={(element.props.variant as string) || "info"}
      data-size={(element.props.size as string) || "md"}
      role="alert"
      className={`react-aria-InlineAlert ${element.props.className || ""}`}
      style={element.props.style}
    >
      {children.map((child) => renderElement(child, child.id))}
    </div>
  );
};

// ==================== Phase 2: Action/Group/Accordion (ADR-030) ====================

/**
 * ButtonGroup 렌더링
 * 버튼들을 정렬하는 컨테이너 (form footer 등)
 */
export const renderButtonGroup = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  const align = (element.props.align as string) || "end";
  const justifyMap: Record<string, string> = {
    start: "flex-start",
    center: "center",
    end: "flex-end",
  };

  return (
    <div
      key={element.id}
      data-element-id={element.id}
      data-custom-id={element.customId}
      role="group"
      style={{
        display: "flex",
        flexDirection: "row",
        gap: 8,
        justifyContent: justifyMap[align] ?? "flex-end",
        ...element.props.style,
      }}
      className={element.props.className}
    >
      {children.map((child) => renderElement(child, child.id))}
    </div>
  );
};

/**
 * Nav 렌더링
 * 네비게이션 컨테이너 — 자식(Link 등) 렌더링
 */
export const renderNav = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <nav
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "8px 16px",
        ...element.props.style,
      }}
      className={element.props.className}
      aria-label={String(element.props.label || "Navigation")}
    >
      {children.map((child) => renderElement(child, child.id))}
    </nav>
  );
};

/**
 * Accordion 렌더링
 * React Aria DisclosureGroup 기반 — Accordion = DisclosureGroup
 */
export const renderAccordion = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <DisclosureGroup
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      allowsMultipleExpanded={Boolean(
        element.props.allowsMultipleExpanded ?? false,
      )}
      style={element.props.style}
      className={element.props.className}
    >
      {children.map((child) => renderElement(child, child.id))}
    </DisclosureGroup>
  );
};

/**
 * DisclosureGroup 렌더링
 * React Aria DisclosureGroup — 여러 Disclosure를 감싸는 컨테이너
 */
export const renderDisclosureGroup = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <DisclosureGroup
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      data-variant={(element.props.variant as string) || "default"}
      data-size={(element.props.size as string) || "md"}
      allowsMultipleExpanded={Boolean(
        element.props.allowsMultipleExpanded ?? true,
      )}
      style={element.props.style}
      className={element.props.className}
    >
      {children.map((child) => renderElement(child, child.id))}
    </DisclosureGroup>
  );
};

/**
 * Disclosure 렌더링
 * React Aria Disclosure — 접을 수 있는 콘텐츠 패널
 */
export const renderDisclosure = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  const headerEl = children.find(
    (c) => c.type === "DisclosureHeader" || c.type === "Heading",
  );

  const title = headerEl
    ? String(
        (headerEl.props as Record<string, unknown>).children ||
          (headerEl.props as Record<string, unknown>).title ||
          "Section",
      )
    : String(element.props.title || "Section");

  const contentChildren = children.filter(
    (c) => c.type !== "DisclosureHeader" && c.type !== "Heading",
  );

  return (
    <Disclosure
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      title={title}
      size={(element.props.size as "sm" | "md" | "lg") || "md"}
      defaultExpanded={Boolean(element.props.isExpanded ?? true)}
      style={element.props.style}
      className={element.props.className}
    >
      {contentChildren.map((child) => renderElement(child, child.id))}
    </Disclosure>
  );
};

/**
 * DisclosureHeader 렌더링 — Disclosure 내부에서 직접 처리하므로 단독 사용 시 fallback
 */
export const renderDisclosureHeader = (
  element: PreviewElement,
  _context: RenderContext,
): React.ReactNode => {
  return (
    <span key={element.id} data-element-id={element.id}>
      {String(element.props.children || element.props.title || "Section")}
    </span>
  );
};

/**
 * DisclosureContent 렌더링 — 텍스트 콘텐츠 표시
 */
export const renderDisclosureContent = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;
  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <div
      key={element.id}
      data-element-id={element.id}
      style={element.props.style}
    >
      {children.length > 0
        ? children.map((child) => renderElement(child, child.id))
        : String(element.props.children || "")}
    </div>
  );
};

/**
 * ColorSwatch 렌더링
 * React Aria ColorSwatch — 단일 색상 박스
 */
export const renderColorSwatch = (
  element: PreviewElement,
  _context: RenderContext,
): React.ReactNode => {
  const colorStr = String(
    element.props.color || element.props.value || "#3b82f6",
  );
  let color;
  try {
    color = parseColor(colorStr);
  } catch {
    color = parseColor("#3b82f6");
  }

  return (
    <ColorSwatch
      key={element.id}
      data-element-id={element.id}
      color={color}
      style={element.props.style}
      className={element.props.className}
    />
  );
};

/**
 * ColorSwatchPicker 렌더링
 * React Aria ColorSwatchPicker — 색상 선택 그리드
 */
export const renderColorSwatchPicker = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const swatchChildren = (
    context.childrenByParent.get(element.id) ?? []
  ).filter((child) => child.type === "ColorSwatch");

  return (
    <ColorSwatchPicker
      key={element.id}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
    >
      {swatchChildren.map((child) => {
        const colorStr = String(
          (child.props as Record<string, unknown>).color ||
            (child.props as Record<string, unknown>).value ||
            "#3b82f6",
        );
        let color;
        try {
          color = parseColor(colorStr);
        } catch {
          color = parseColor("#3b82f6");
        }
        return <ColorSwatchPickerItem key={child.id} color={color} />;
      })}
    </ColorSwatchPicker>
  );
};

// ─── Phase 3: Extended Controls (ADR-030) ────────────────────────────────────

/**
 * ProgressCircle 렌더링
 * 원형 진행률 표시기 (SVG)
 */
export const renderProgressCircle = (
  element: PreviewElement,
  _context: RenderContext,
): React.ReactNode => {
  const size =
    element.props.size === "S" ? 24 : element.props.size === "L" ? 64 : 32;
  const strokeWidth = element.props.size === "L" ? 4 : 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = Math.max(0, Math.min(100, Number(element.props.value ?? 0)));
  const offset = circumference - (value / 100) * circumference;
  const isIndeterminate = Boolean(element.props.isIndeterminate);

  return (
    <div
      key={element.id}
      data-element-id={element.id}
      data-custom-id={element.customId}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={isIndeterminate ? undefined : value}
      style={{
        width: size,
        height: size,
        ...element.props.style,
      }}
      className={element.props.className}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--bg-muted, #e5e7eb)"
          strokeWidth={strokeWidth}
        />
        {!isIndeterminate && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--accent, #3b82f6)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
    </div>
  );
};

/**
 * Image 렌더링
 * 반응형 이미지 컴포넌트
 */
export const renderImage = (
  element: PreviewElement,
  _context: RenderContext,
): React.ReactNode => {
  const src = element.props.src ? String(element.props.src) : "";
  const alt = String(element.props.alt || "Image");
  const objectFit = String(
    element.props.objectFit || "cover",
  ) as React.CSSProperties["objectFit"];

  if (src) {
    return (
      <img
        key={element.id}
        data-element-id={element.id}
        data-custom-id={element.customId}
        src={src}
        alt={alt}
        style={{
          objectFit,
          width: "100%",
          height: "100%",
          display: "block",
          ...element.props.style,
        }}
        className={element.props.className}
      />
    );
  }

  return (
    <div
      key={element.id}
      data-element-id={element.id}
      data-custom-id={element.customId}
      role="img"
      aria-label={alt}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--bg-muted, #f3f4f6)",
        color: "var(--fg-muted, #9ca3af)",
        fontSize: "14px",
        ...element.props.style,
      }}
      className={element.props.className}
    >
      {alt}
    </div>
  );
};

/**
 * RangeCalendar 렌더링
 * Calendar와 동일 구조 — 날짜 범위 선택
 */
export const renderRangeCalendar = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { updateElementProps } = context;

  const locale = element.props.locale as string | undefined;
  const calendarSystem = element.props.calendarSystem as string | undefined;
  const maxVisibleMonths = Number(element.props.maxVisibleMonths) || 1;
  const size = element.props.size as string | undefined;
  const variant = element.props.variant as string | undefined;
  // locale/calendarSystem/size 변경 시 리마운트
  const remountKey = `${element.id}-${locale || ""}-${calendarSystem || ""}-${size || ""}`;

  return (
    <RangeCalendar
      key={remountKey}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      variant={(variant as "default" | "accent") || "default"}
      size={(size as "sm" | "md" | "lg") || "md"}
      locale={locale}
      calendarSystem={calendarSystem}
      aria-label={
        typeof element.props["aria-label"] === "string"
          ? element.props["aria-label"]
          : "Range Calendar"
      }
      isDisabled={Boolean(element.props.isDisabled)}
      isReadOnly={Boolean(element.props.isReadOnly)}
      maxVisibleMonths={maxVisibleMonths}
      allowsNonContiguousRanges={Boolean(
        element.props.allowsNonContiguousRanges,
      )}
      minValue={element.props.minValue as string | undefined}
      maxValue={element.props.maxValue as string | undefined}
      onChange={(dateRange) => {
        const updatedProps = {
          ...element.props,
          value: dateRange,
        };
        updateElementProps(element.id, updatedProps);
      }}
      errorMessage={String(element.props.errorMessage || "")}
    />
  );
};

// ==================== Phase 4: Advanced Components (ADR-030) ====================

/**
 * IllustratedMessage 렌더링
 */
export const renderIllustratedMessage = (
  element: PreviewElement,
  _context: RenderContext,
): React.ReactNode => {
  const heading = (element.props.heading as string) || "No content";
  const description =
    (element.props.description as string) || "There is nothing to display.";

  return (
    <div
      key={element.id}
      data-element-id={element.id}
      data-custom-id={element.customId}
      role="status"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
        textAlign: "center",
        ...element.props.style,
      }}
      className={element.props.className}
    >
      {/* 일러스트 placeholder */}
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: 12,
          backgroundColor: "var(--bg-muted, #f3f4f6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--fg-muted, #9ca3af)",
          fontSize: 48,
        }}
      >
        &#9675;
      </div>
      <div
        style={{ fontSize: 18, fontWeight: 600, color: "var(--fg, #1f2937)" }}
      >
        {heading}
      </div>
      <div style={{ fontSize: 14, color: "var(--fg-muted, #6b7280)" }}>
        {description}
      </div>
    </div>
  );
};

/**
 * CardView 렌더링
 */
export const renderCardView = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  const gap = (element.props.gap as number) || 16;

  return (
    <div
      key={element.id}
      data-element-id={element.id}
      data-custom-id={element.customId}
      role="grid"
      aria-label="Card collection"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap,
        ...element.props.style,
      }}
      className={element.props.className}
    >
      {children.map((child) => renderElement(child, child.id))}
    </div>
  );
};

/**
 * TableView 렌더링
 */
export const renderTableView = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  const isQuiet = element.props.isQuiet === true;

  return (
    <div
      key={element.id}
      data-element-id={element.id}
      data-custom-id={element.customId}
      role="grid"
      style={{
        display: "flex",
        flexDirection: "column",
        border: isQuiet ? "none" : "1px solid var(--border, #e5e7eb)",
        borderRadius: 6,
        overflow: "hidden",
        ...element.props.style,
      }}
      className={element.props.className}
    >
      {children.map((child) => renderElement(child, child.id))}
    </div>
  );
};
