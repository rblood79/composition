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
import {
  allowsMultipleExpanded,
  resolveGroupExpandedDisclosureIds,
} from "../utils/disclosureGroupExpansion";
import { resolveCatalogDensityField } from "../catalog/resolvers/resolveCatalogContainer";
import { resolveCalendarHeaderStyle } from "./DateRenderers";
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
      // defaultSelectedKey(uncontrolled) 는 mount 시점 값만 읽는다. 패널에서 defaultSelectedKey
      //   토글 시 key 가 바뀌어 Tabs 가 re-mount → 새 defaultSelectedKey 를 다시 읽게 한다
      //   (Checkbox/RadioGroup 동형). Skia 는 canvasSceneNode 가 selectedKey ?? defaultSelectedKey
      //   로 tab_indicator 를 매 rebuild 즉시 그리므로, key 없으면 Skia↔CSS preview drift.
      key={`${element.id}:${String(element.props.defaultSelectedKey || "")}`}
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
        // ADR-148 Phase 3 cross-check: variant 전달 누락 정정 — 미전달 시 Card 내부
        // default "primary" 로 고정되어 data-variant 가 편집을 무시 (Skia 는 catalog
        // rule 로 variant fill 을 소비 → CSS↔Skia 발산, ADR-912 R6 전환 잔존 결함).
        variant={(element.props.variant as string) || undefined}
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
      // ADR-148 Phase 3 cross-check: variant 전달 누락 정정 (structural 분기와 동일).
      variant={(element.props.variant as string) || undefined}
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
 * Card 슬롯 부품(CardPreview/CardHeader/CardContent/CardFooter)의 스타일 채널 계약.
 *
 * ADR-171 Phase 6 2a (2026-07-29) — 이 4종은 **회귀**로 클래스를 잃고 있었다.
 * ADR-912 cutover 시점의 계약은 `{Type}.binding.ts` 주석이 명시한 대로
 * "generic fallback 유지 → `react-aria-{Type}` className + data-size 보존" 이었는데,
 * 2026-06-24 에 자식 미렌더(Heading/Image 누락)를 고치려고
 * `renderFacetDeclaration.ts` 에 delegating 등록하면서 live path 가 아래 전용
 * 렌더러로 바뀌었고, 그 렌더러들이 `card-header` 같은 kebab 클래스를 하드코딩해
 * `react-aria-{Type}` 이 사라졌다. 생성 CSS 는 `.react-aria-CardHeader` 를 노리므로
 * 그때부터 selector 가 영구 미매칭이었고, `.card-*` 를 잡는 CSS 는 저장소에 0건이라
 * DOM 스타일 공급원이 인라인 하나만 남아 있었다(Phase 2 가 "dead CSS" 로 본 현상의 정체).
 *
 * 클래스 규약은 레퍼런스에서 오지 않는다 — S2 Card 는 `style()` 매크로라 클래스가 없고
 * SWC 는 `<sp-card>` 커스텀 엘리먼트다. `react-aria-{Type}` 은 RAC 에서 온 composition
 * house convention 이고, 생성기(`.react-aria-{Type}`)·`Card.tsx`·`CanonicalNodeRenderer`
 * generic fallback 이 모두 그것을 쓴다. 그 규약에 되돌린다.
 */
function cardSlotChrome(
  type: "CardPreview" | "CardHeader" | "CardContent" | "CardFooter",
  element: PreviewElement,
): { className: string; "data-size": string } {
  const userClassName = element.props?.className as string | undefined;
  return {
    className: [`react-aria-${type}`, userClassName].filter(Boolean).join(" "),
    // 생성 CSS 가 `.react-aria-{Type}[data-size="md"]` 로 size 축을 emit 한다.
    // catalog `defaultSize: "md"` — generic fallback 의 resolveBackedDefaultSize 와 같은 기본값.
    "data-size": (element.props?.size as string | undefined) ?? "md",
  };
}

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
      {...cardSlotChrome("CardHeader", element)}
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
      {...cardSlotChrome("CardContent", element)}
      style={element.props?.style as React.CSSProperties}
    >
      {children.map((child) => {
        // Description: React Aria slot 컨텍스트 없이 직접 렌더링.
        // ADR-151 B3 (2026-07-16): `react-aria-Description` 클래스 + data-size 를 부여해
        //   generated Description.css(catalog 파생 — lg 14/20)가 도달하게 한다. 미부여 시
        //   Card 폰트(16/24)를 상속해 Skia(catalog 14/20)와 세로 -4px 발산.
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
              className="react-aria-Description card-description"
              data-size={(child.props?.size as string) ?? undefined}
              data-variant={(child.props?.variant as string) ?? undefined}
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
      {...cardSlotChrome("CardPreview", element)}
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
      {...cardSlotChrome("CardFooter", element)}
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
      staticColor={
        (element.props.staticColor as "auto" | "black" | "white") || "auto"
      }
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
      // catalog defaultVariant 와 정렬 (2026-08-20): 구 fallback "default" 는
      //   generated CSS 에 대응 규칙이 없어(neutral/info/positive/negative 4종만)
      //   존재하지 않는 variant 를 가리키는 거짓 신호였다. base 규칙이 neutral 값과
      //   같아 시각 결과는 동일하나, Skia(defaultVariant "neutral") 와 표기를 맞춘다.
      data-variant={element.props.variant || "neutral"}
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
      offset={
        element.props.offset !== undefined
          ? Number(element.props.offset)
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

  // ADR-912 영역 B (A): items SSOT 전환 후 crumb 은 Breadcrumbs.props.items 가 정본
  //   (Breadcrumbs wrapper 가 useResolvedCollectionItems 로 렌더). pre-migration 기존 문서의
  //   자식 Breadcrumb element 는 BC fallback 으로 유지 (items 가 비고 자식이 있으면 자식 렌더).
  const breadcrumbChildren = (
    context.childrenByParent.get(element.id) ?? []
  ).filter((child) => child.type === "Breadcrumb");
  const items = element.props.items as unknown[] | undefined;
  const hasItems = Array.isArray(items) && items.length > 0;

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
      separator={element.props.separator as string | undefined}
      items={items}
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
      {hasItems
        ? null
        : breadcrumbChildren.map((child) => renderElement(child, child.id))}
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
      href={element.props.href ? String(element.props.href) : undefined}
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
      href={element.props.href ? String(element.props.href) : undefined}
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
  // StatusLightSpec.sizes 와 정합 (sm/md/lg/xl)
  const dotSize = { sm: 8, md: 10, lg: 12, xl: 14 }[size] ?? 10;
  const fontSize = { sm: 12, md: 14, lg: 16, xl: 18 }[size] ?? 14;

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
        // catalog(D3 SSOT) generated StatusLight.css = inline-flex — 블록 stretch(flex)
        // 였던 종전 inline 값은 Skia(fit-content 75)와 폭 발산 (CSS 388, 2026-07-13 sweep).
        display: "inline-flex",
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

// ==================== Phase 2: Action/Group (ADR-030) ====================

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
  // ButtonGroupSpec.render 와 정합: orientation → flexDirection, size → gap
  const flexDirection =
    (element.props.orientation as string) === "vertical" ? "column" : "row";
  const gapBySize: Record<string, number> = {
    xs: 4,
    sm: 6,
    md: 8,
    lg: 10,
    xl: 12,
  };
  const gap = gapBySize[String(element.props.size || "md")] ?? 8;

  return (
    <div
      key={element.id}
      data-element-id={element.id}
      data-custom-id={element.customId}
      role="group"
      style={{
        display: "flex",
        flexDirection,
        gap,
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
 * DisclosureGroup 렌더링
 * React Aria DisclosureGroup — 여러 Disclosure를 감싸는 컨테이너
 */
export const renderDisclosureGroup = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement, updateElementProps } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  // ADR-912 Disclosure 군 cutover 후속 (2026-06-10): RAC DisclosureGroup 은 자식 Disclosure 의
  //   expansion 을 `expandedKeys`(controlled) / `defaultExpandedKeys`(uncontrolled) + 각 Disclosure
  //   의 id 로 관리한다(RAC Disclosure.tsx: `groupState.expandedKeys.has(id)`). renderDisclosure 가
  //   id={child.customId} 로 RAC Disclosure 를 렌더하므로, 그룹 초기 expansion 도 customId 키로
  //   defaultExpandedKeys 에 전달한다. uncontrolled 라 header 클릭 토글은 그룹 상태머신이 양방향
  //   관리(toggleKey) → 열고 닫기 모두 동작. (controlled expandedKeys 는 canonical 노드 prop 을
  //   header 클릭이 못 바꿔 lock 되므로 미사용 — Disclosure 단독 수정과 동일 사유.)
  //   key 는 customId ?? id — canonical 렌더 경로(CanonicalNodeRenderer flatten)의
  //   PreviewElement 는 customId 미보유라, customId 단독 의존 시 keys 가 빈 배열로
  //   떨어져 그룹 전체가 접힌 채 시작 (intent: isExpanded ?? true = 펼침 — Skia 와
  //   비대칭이던 근본, 2026-07-14 sweep). renderDisclosure 의 id fallback 과 동일 규칙.
  //
  //   확장 후보 판정은 `resolveGroupExpandedDisclosureIds`(SSOT) 경유 — Skia(content 숨김 +
  //   chevron)와 **같은 규칙**을 소비해야 allowsMultipleExpanded 가 양쪽에 대칭 반영된다
  //   (2026-07-14: Skia 가 그룹 제약을 몰라 전부 펼치던 발산 수정).
  const expandedIds = resolveGroupExpandedDisclosureIds(
    element.props as Record<string, unknown>,
    children.map((c) => ({ id: c.id, type: c.type, props: c.props })),
  );
  const defaultExpandedKeys = children
    .filter((c) => c.type === "Disclosure" && expandedIds.has(c.id))
    .map((c) => c.customId ?? c.id)
    .filter((id): id is string => Boolean(id));

  const multiple = allowsMultipleExpanded(
    element.props as Record<string, unknown>,
  );

  return (
    <DisclosureGroup
      // key 에 allowsMultipleExpanded 포함 — RAC DisclosureGroup 은 **uncontrolled** 라
      //   `defaultExpandedKeys` 가 초기값으로만 쓰인다. false→true 로 되돌려도 내부
      //   expandedKeys 는 이미 축약된 {첫 번째} 상태를 유지한다(useDisclosureGroupState 의
      //   useEffect 는 축약만 하고 복원하지 않음) → Inspector 토글이 Preview 에 반영 안 됨.
      //   key 변경으로 재마운트해 초기 상태를 다시 적용한다(renderDisclosure 의
      //   `key={id}:${defaultExpanded}` 동형). 2026-07-14.
      key={`${element.id}:${multiple}`}
      id={element.customId}
      data-element-id={element.id}
      data-variant={(element.props.variant as string) || "default"}
      data-size={(element.props.size as string) || "md"}
      allowsMultipleExpanded={multiple}
      isDisabled={Boolean(element.props.isDisabled)}
      defaultExpandedKeys={defaultExpandedKeys}
      // 그룹 안 Disclosure 의 header 클릭은 **그룹의** onExpandedChange 로만 통지된다
      //   (RAC: groupState.toggleKey — 개별 Disclosure 의 onExpandedChange 는 호출 안 됨).
      //   Preview runtime store 의 isExpanded 를 동기화해 Preview 내부 정합을 유지한다
      //   (renderDisclosure 단독 경로가 하는 것과 동형). 2026-07-14.
      onExpandedChange={(keys) => {
        const expandedKeySet = new Set<string>([...keys].map((k) => String(k)));
        for (const child of children) {
          if (child.type !== "Disclosure") continue;
          const key = child.customId ?? child.id;
          if (!key) continue;
          const next = expandedKeySet.has(key);
          // 변경분만 기록 (불필요한 store 갱신 방지).
          //   isExpanded 미지정 = 펼침(binding default) → 그 기준으로 비교.
          const prev = (child.props as Record<string, unknown> | undefined)
            ?.isExpanded;
          if ((prev !== false) === next) continue;
          updateElementProps(child.id, { isExpanded: next });
        }
      }}
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
  const { renderElement, updateElementProps } = context;

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

  const defaultExpanded = Boolean(element.props.isExpanded ?? true);

  // ADR-912 Disclosure 군 cutover 후속 (2026-06-10): 그룹 멤버십 판정.
  //   RAC 소스(Disclosure.tsx) 확인 — 그룹 내부 Disclosure 는 `groupState.expandedKeys.has(id)` 가
  //   isExpanded/defaultExpanded 를 override 하고, 토글은 `groupState.toggleKey(id)` 로 그룹이 관리한다.
  //   따라서 그룹 내부에선 (1) 개별 defaultExpanded 무의미(그룹이 제어) (2) key 에 defaultExpanded 를
  //   넣어 재마운트하면 RAC 내부 상태/id 가 흔들려 toggleKey 가 깨짐(열린 뒤 닫히지 않음). 그룹 초기
  //   expansion 은 renderDisclosureGroup 이 defaultExpandedKeys 로 그룹에 전달한다.
  const parentEl = element.parent_id
    ? context.elementsById.get(element.parent_id)
    : undefined;
  const isInGroup = parentEl?.type === "DisclosureGroup";

  return (
    <Disclosure
      // 독립 Disclosure: uncontrolled defaultExpanded + key 에 isExpanded 포함(Inspector State
      //   토글을 재마운트로 반영, header 클릭은 RAC 내부 상태로 동작 — 2026-06-10 수정).
      //   그룹 내부: key 에 defaultExpanded 제외(재마운트 금지 — 그룹 expandedKeys 상태머신 보존) +
      //   defaultExpanded 미전달(그룹이 override). id 는 안정적 customId 로 toggleKey 키 고정.
      key={isInGroup ? element.id : `${element.id}:${defaultExpanded}`}
      // customId ?? id — renderDisclosureGroup defaultExpandedKeys 와 동일 규칙 (canonical
      //   경로 customId 부재 시 그룹 key 미매칭 → 항상 접힘 회귀 차단, 2026-07-14).
      id={element.customId ?? element.id}
      data-element-id={element.id}
      title={title}
      size={(element.props.size as "sm" | "md" | "lg") || "md"}
      isDisabled={Boolean(element.props.isDisabled)}
      {...(isInGroup ? {} : { defaultExpanded })}
      onExpandedChange={(isExpanded) =>
        updateElementProps(element.id, { isExpanded })
      }
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
 * ColorPicker 렌더링
 * 기존 spec-backed fallback 과 같은 div shell. 자식 ColorArea/ColorSlider/ColorField 가 UI를 그린다.
 */
export const renderColorPicker = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <div
      key={element.id}
      data-element-id={element.id}
      data-custom-id={element.customId}
      data-size={String(element.props.size ?? "md")}
      data-variant={
        element.props.variant ? String(element.props.variant) : undefined
      }
      style={element.props.style}
      className={`react-aria-ColorPicker ${element.props.className || ""}`}
    >
      {children.map((child) => context.renderElement(child, child.id))}
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
    element.props.size === "sm" ? 24 : element.props.size === "lg" ? 64 : 32;
  const strokeWidth = element.props.size === "lg" ? 4 : 3;
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

  // design-data 감사 §1-3 (2026-08-21): Calendar 는 노출 중인 3종을 RangeCalendar 만
  //   전달하지 않아 편집 표면이 비대칭이었다 (RSP RangeCalendar 규정 prop). 컴포넌트는
  //   `AriaRangeCalendarProps` 를 extends 하고 `{...props}` 로 spread 하므로 전달만 하면
  //   RAC 에 닿는다. renderCalendar 동형 처리.
  const getPageBehavior = () => {
    const pb = element.props.pageBehavior;
    return pb === "visible" || pb === "single" ? pb : "visible";
  };

  // CalendarHeader 자식 style 의 layout 부분을 `<header>` 로 전달 (2026-07-02 B2, Calendar 동형).
  const headerStyle = resolveCalendarHeaderStyle(element, context);

  return (
    <RangeCalendar
      key={remountKey}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      headerStyle={headerStyle}
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
      isInvalid={Boolean(element.props.isInvalid)}
      autoFocus={Boolean(element.props.autoFocus)}
      pageBehavior={getPageBehavior() as "visible" | "single"}
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
 * TableView 자식 트리(TableHeader/TableBody/Column/Row/Cell)의 type별 시각 계약.
 *
 * **D3 대칭 SSOT (catalog `generated/componentRulesTable.ts`)**: 각 type 의 catalog
 * `containerStyles` / `sizes.md` 시각값을 Preview generic div 인라인에 그대로 반영하여
 * Skia(buildCatalogShapes 가 같은 catalog rule 소비) ↔ Preview DOM 시각 대칭을 맞춘다.
 *   - TableHeader: flex row | TableBody: flex column | Row: flex row
 *   - Column: flex:1 + padding 8px(`{spacing.sm}`) + fontWeight 600
 *   - Cell:   flex:1 + padding 8px(`{spacing.sm}`)
 * RAC Table.css 정본(`.react-aria-Cell,.react-aria-Column{padding:var(--spacing-2)}`=8px,
 * `.column-header{font-weight:600}`)과 동일.
 *
 * **className 비부여 (CRITICAL)**: `react-aria-Row` / `react-aria-TableBody` 클래스를 주면
 * composition `Table.css`(data-driven Table 의 TanStack 가상화 전용)의
 * `.react-aria-TableBody & .react-aria-Row { position: absolute }` 규칙이 누수되어 Row 가
 * absolute 로 빠지고 부모(TableBody/grid) 높이가 0 으로 붕괴한다. 시각값을 100% 인라인으로
 * 완결하고(generic div), 식별은 `data-tableview-part` 중립 속성만 사용. Row 는 누수 방어로
 * position:relative 명시.
 */
const TABLEVIEW_CHILD_STYLE: Record<
  string,
  { role: string; style: React.CSSProperties }
> = {
  TableHeader: {
    role: "rowgroup",
    // flexShrink:0 — grid(flex column) main-axis 에서 자식이 축소되지 않도록(overflow:hidden 클리핑 방지).
    style: { display: "flex", flexDirection: "row", flexShrink: 0 },
  },
  TableBody: {
    role: "rowgroup",
    style: { display: "flex", flexDirection: "column", flexShrink: 0 },
  },
  Row: {
    role: "row",
    style: { display: "flex", flexDirection: "row", position: "relative" },
  },
  Column: {
    role: "columnheader",
    // textAlign left: catalog COMPONENT_RULES_TABLE.Column.variants.default.textAlign 미러
    //   (starter Table.css `.react-aria-Column{text-align:left}` 정본). Skia(rule.textAlign)와
    //   동일 값 명시 — generic div 인라인 완결 패턴(브라우저 기본 left 의존 대신 SSOT 미러).
    // fontSize/lineHeight 16/24: catalog COMPONENT_RULES_TABLE.Column sizes 미러 (ADR-151
    //   후속 2026-07-17) — 루트 .react-aria-TableView 가 font-size:text-sm(14) 을 cascade
    //   하면서 상속 의존이 깨져(행 37 vs Skia 40) 명시 미러로 전환. Skia
    //   calculateContentHeight(estimateTextHeight 16/24 + paddingY*2=40)와 동일 source.
    style: {
      flex: "1",
      padding: 8,
      fontWeight: 600,
      textAlign: "left",
      fontSize: 16,
      lineHeight: "24px",
    },
  },
  Cell: {
    role: "gridcell",
    // textAlign left: catalog COMPONENT_RULES_TABLE.Cell.variants.default.textAlign 미러.
    // fontSize/lineHeight 16/24: Column 동형 — catalog Cell sizes 미러.
    style: {
      flex: "1",
      padding: 8,
      textAlign: "left",
      fontSize: 16,
      lineHeight: "24px",
    },
  },
};

/**
 * TableView 자식 서브트리를 generic div 로 직접 렌더 (renderTabs 패턴 — 부모가 자식 트리를
 * 직접 그림, 자식은 CanonicalNodeRenderer 위임 경유 안 함).
 *
 * **Why**: TableHeader/TableBody/Column/Row/Cell 은 CATALOG_CUTOVER_TYPES 미등록이라
 * CanonicalNodeRenderer 가 generic 빈 div 로만 그린다(자식 렌더러 미위임). renderTabs 가
 * TabList/Tab/TabPanel 을 부모 렌더러에서 직접 그리는 선례와 동형으로, renderTableView 가
 * 자식 트리 전체를 직접 재귀 렌더한다. 알려진 5 type 은 catalog 시각 div, 그 외(leaf 일반
 * element)는 renderElement 위임.
 */
function renderTableViewSubtree(
  element: PreviewElement,
  context: RenderContext,
  density?: string,
): React.ReactNode {
  const spec = TABLEVIEW_CHILD_STYLE[element.type];
  if (!spec) {
    // 알려진 TableView 자식 type 이 아니면 일반 렌더 경로(leaf element 등)에 위임.
    return context.renderElement(element, element.id);
  }

  // density (2026-08-21): catalog `Column/Cell.densities` 의 paddingY 로 위 인라인 상수
  //   `padding: 8` 의 세로 성분만 교체 (Spectrum 규칙 — 폰트·가로 여백 불변). Skia 는
  //   같은 catalog 값을 applyImplicitStyles 가 paddingTop/Bottom 으로 주입해 읽으므로 두
  //   consumer 가 동일 SSOT 를 본다. `densities` 미정의면 undefined → 인라인 상수 유지.
  const densityPaddingY =
    element.type === "Column" || element.type === "Cell"
      ? resolveCatalogDensityField(element.type, density, "paddingY")
      : undefined;

  const childElements = context.childrenByParent.get(element.id) ?? [];
  const textContent =
    typeof element.props.children === "string"
      ? element.props.children
      : undefined;

  return (
    <div
      key={element.id}
      data-element-id={element.id}
      data-custom-id={element.customId}
      data-tableview-part={element.type}
      role={spec.role}
      className={element.props.className}
      style={{
        ...spec.style,
        ...(densityPaddingY !== undefined
          ? { paddingTop: densityPaddingY, paddingBottom: densityPaddingY }
          : {}),
        ...element.props.style,
      }}
    >
      {childElements.length > 0
        ? childElements.map((child) =>
            renderTableViewSubtree(child, context, density),
          )
        : textContent}
    </div>
  );
}

/**
 * TableView 렌더링
 */
export const renderTableView = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const children = context.childrenByParent.get(element.id) ?? [];

  // ADR-912 R7 G1-b: S2 variant 모델(default/quiet) — 구 isQuiet boolean 흡수.
  //   variant 우선, legacy isQuiet:true → quiet 정규화. quiet=transparent border(catalog CSS).
  const variant =
    (element.props.variant as string | undefined) ??
    (element.props.isQuiet === true ? "quiet" : "default");

  // ADR-151 후속 (2026-07-17): display/border/radius/width/fontSize 는 generated
  //   TableView.css(.react-aria-TableView[data-variant]) 단일 위임 — 구 inline 상수가
  //   catalog CSS 를 가리고 클래스 미부여로 width:100%/text-sm 이 미도달해 Skia(catalog
  //   containerStyles 소비)와 발산했다(flex 부모 350×80 vs 179.4×106). overflow 만 CSS 에
  //   없는 잔여 inline(둥근 모서리 클리핑).
  const userClassName = element.props.className as string | undefined;

  // density (2026-08-21): Spectrum `table.item.padding × density` — 값은 TableView 가 갖고
  //   소비 주체는 자손 Column/Cell 이라 서브트리로 내려보낸다. `data-density` 는 식별용
  //   (자식 시각값은 인라인 완결 — 위 TABLEVIEW_CHILD_STYLE 주석의 className 비부여 규칙).
  const density = element.props.density as string | undefined;

  return (
    <div
      key={element.id}
      data-element-id={element.id}
      data-custom-id={element.customId}
      data-variant={variant}
      data-density={density}
      role="grid"
      style={{
        overflow: "hidden",
        ...element.props.style,
      }}
      className={
        userClassName
          ? `react-aria-TableView ${userClassName}`
          : "react-aria-TableView"
      }
    >
      {/* renderTabs 패턴: 자식 트리(TableHeader/TableBody/Column/Row/Cell)를 부모가 직접
          generic div 로 그린다. 자식 type 은 CATALOG_CUTOVER_TYPES 미등록 → CanonicalNodeRenderer
          위임 경유 시 빈 div 가 되므로 직접 렌더. */}
      {children.map((child) => renderTableViewSubtree(child, context, density))}
    </div>
  );
};
