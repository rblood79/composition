import { isRTL } from "@react-aria/i18n";
import type { CatalogConsumerNode } from "./compositionRoot";
import {
  catalogOverlayOwner,
  type OverlayLookup,
  type OverlayTypeOf,
} from "./overlayState";

type Box = { x: number; y: number; width: number; height: number };

/** Preserve a picker's trigger width even when it fills the viewport. */
export function catalogPickerOverlayPadding(
  padding: number,
  triggerWidth: number,
  viewportWidth: number,
  triggerX: number,
): number {
  return Math.min(
    padding,
    Math.max(0, triggerX),
    Math.max(0, viewportWidth - triggerX - triggerWidth),
  );
}
export type OverlayPlacement = {
  x: number;
  y: number;
  maxHeight: number;
  maxWidth?: number;
  width?: number;
  minWidth?: number;
  arrow?: { x: number; y: number; size: number };
  placement: string;
};
export type OverlayDescriptor = {
  modal: boolean;
  owner?: CatalogConsumerNode;
  anchor?: CatalogConsumerNode;
  arrowSize?: number;
};

/** 배치의 optional 폭·화살표 제거도 변경으로 취급한다. */
export function sameOverlayPlacement(
  a: OverlayPlacement | undefined,
  b: OverlayPlacement,
): boolean {
  return (
    !!a &&
    a.x === b.x &&
    a.y === b.y &&
    a.maxHeight === b.maxHeight &&
    a.maxWidth === b.maxWidth &&
    a.width === b.width &&
    a.minWidth === b.minWidth &&
    a.placement === b.placement &&
    a.arrow?.x === b.arrow?.x &&
    a.arrow?.y === b.arrow?.y &&
    a.arrow?.size === b.arrow?.size
  );
}

export function catalogOverlayDescriptor(
  node: CatalogConsumerNode,
  get: OverlayLookup,
  typeOf: OverlayTypeOf,
): OverlayDescriptor | undefined {
  const type = typeOf(node);
  const implicitDialog =
    type === "Dialog" && typeOf(get(node.parentId) ?? node) === "DialogTrigger";
  if (!["Modal", "Popover", "Tooltip"].includes(type) && !implicitDialog)
    return;
  const owner = catalogOverlayOwner(node, get, typeOf);
  const modal = type === "Modal" || implicitDialog;
  if (modal || !owner) return { modal, owner };
  const wanted = ["ComboBox", "DatePicker", "DateRangePicker"].includes(
    typeOf(owner),
  )
    ? "Group"
    : typeOf(owner) === "SubmenuTrigger"
      ? "MenuItem"
      : "Button";
  const find = (
    parent: CatalogConsumerNode,
  ): CatalogConsumerNode | undefined => {
    for (const id of parent.children) {
      const child = get(id);
      if (
        !child ||
        child.id === node.id ||
        ["Popover", "Modal", "Tooltip", "SheetOverlay"].includes(typeOf(child))
      )
        continue;
      // ActionButton도 RAC Button 트리거다. owner의 넓은 상자가 아닌 실제 버튼에 고정한다.
      if (
        typeOf(child) === wanted ||
        (wanted === "Button" && typeOf(child) === "ActionButton")
      )
        return child;
      const nested = find(child);
      if (nested) return nested;
    }
  };
  return {
    modal,
    owner,
    anchor: find(owner) ?? owner,
    arrowSize: node.children.some((id) => get(id)?.bindingId === "overlayarrow")
      ? type === "Tooltip"
        ? 8
        : 12
      : undefined,
  };
}

export function catalogS2OverlayPlacement(
  props: Readonly<Record<string, unknown>>,
): string {
  const direction =
    typeof props.direction === "string" ? props.direction : "bottom";
  const align = props.align === "end" ? "end" : "start";
  if (["left", "right", "start", "end"].includes(direction))
    return `${direction} ${align === "end" ? "bottom" : "top"}`;
  return `${direction === "top" ? "top" : "bottom"} ${align}`;
}

/** RAC의 viewport 경계·반전·cross-axis 제한을 엔진에 줄 fixed 입력으로 해소한다. */
export function catalogOverlayPlacement(
  node: CatalogConsumerNode,
  descriptor: OverlayDescriptor,
  anchor: Box | undefined,
  box: Box,
  viewport: { width: number; height: number },
  locale: string,
): OverlayPlacement {
  if (descriptor.modal)
    return {
      x: (viewport.width - box.width) / 2,
      y: (viewport.height - box.height) / 2,
      maxHeight: viewport.height,
      placement: "center",
    };
  const owner = descriptor.owner;
  const ownerType = owner?.ruleId ?? "";
  const p = {
    ...(ownerType === "TooltipTrigger" ? owner?.props : {}),
    ...node.props,
  };
  const contextPlacement =
    [
      "Select",
      "ComboBox",
      "MenuTrigger",
      "DatePicker",
      "DateRangePicker",
      "SubmenuTrigger",
    ].includes(ownerType) && p.placement === "bottom";
  let placement = String(
    (contextPlacement ? undefined : p.placement) ??
      (["Select", "ComboBox", "MenuTrigger"].includes(ownerType)
        ? catalogS2OverlayPlacement(owner!.props)
        : ownerType === "SubmenuTrigger"
          ? "end top"
          : ownerType === "TooltipTrigger"
            ? "top"
            : "bottom start"),
  );
  const rtl = isRTL(locale);
  placement = placement
    .replace(/\bstart\b/g, rtl ? "right" : "left")
    .replace(/\bend\b/g, rtl ? "left" : "right");
  let [side, align = "center"] = placement.split(" ");
  const target = anchor ?? { x: 0, y: 0, width: 0, height: 0 };
  const requestedPad = Number(p.containerPadding ?? 12);
  const pad = ["Select", "ComboBox"].includes(ownerType)
    ? catalogPickerOverlayPadding(
        requestedPad,
        target.width,
        viewport.width,
        target.x,
      )
    : requestedPad;
  const offset =
    Number(p.offset ?? (ownerType === "TooltipTrigger" ? 0 : 8)) +
    (ownerType === "TooltipTrigger" ? 8 : (descriptor.arrowSize ?? 0) / 2);
  const cross = Number(p.crossOffset ?? 0);
  const spaces: Record<string, number> = {
    top: target.y - pad - offset,
    bottom: viewport.height - target.y - target.height - pad - offset,
    left: target.x - pad - offset,
    right: viewport.width - target.x - target.width - pad - offset,
  };
  const opposite: Record<string, string> = {
    top: "bottom",
    bottom: "top",
    left: "right",
    right: "left",
  };
  const vertical = side === "top" || side === "bottom";
  if (
    p.shouldFlip !== false &&
    (vertical ? box.height : box.width) > spaces[side] &&
    spaces[opposite[side]] > spaces[side]
  )
    side = opposite[side];
  const maxHeight = Math.max(
    0,
    vertical ? spaces[side] : viewport.height - pad * 2,
  );
  const height = Math.min(box.height, maxHeight);
  const clamped = (v: number, size: number, limit: number) =>
    Math.max(pad, Math.min(v, limit - pad - size));
  const x = vertical
    ? clamped(
        target.x +
          (align === "left"
            ? 0
            : align === "right"
              ? target.width - box.width
              : (target.width - box.width) / 2) +
          cross,
        box.width,
        viewport.width,
      )
    : side === "left"
      ? target.x - box.width - offset
      : target.x + target.width + offset;
  const y = vertical
    ? side === "top"
      ? target.y - height - offset
      : target.y + target.height + offset
    : clamped(
        target.y +
          (align === "top"
            ? 0
            : align === "bottom"
              ? target.height - height
              : (target.height - height) / 2) +
          cross,
        height,
        viewport.height,
      );
  const size = descriptor.arrowSize;
  const arrow = size
    ? {
        size,
        x: vertical
          ? Math.max(
              0,
              Math.min(
                box.width - size,
                target.x + target.width / 2 - x - size / 2,
              ),
            )
          : side === "left"
            ? box.width
            : -size,
        y: vertical
          ? side === "top"
            ? height
            : -size
          : Math.max(
              0,
              Math.min(
                height - size,
                target.y + target.height / 2 - y - size / 2,
              ),
            ),
      }
    : undefined;
  return {
    x,
    y,
    maxHeight,
    maxWidth: Math.max(0, viewport.width - pad * 2),
    placement: side,
    ...(arrow ? { arrow } : {}),
  };
}

export function catalogOverlayLayout(
  node: CatalogConsumerNode,
  placement?: OverlayPlacement,
): Record<string, unknown> | undefined {
  if (node.hidden || node.derivedProps?._overlayPortal !== true) return;
  const ownMax = node.layout.maxWidth;
  const maxWidth =
    placement?.maxWidth === undefined
      ? undefined
      : Math.min(
          placement.maxWidth,
          typeof ownMax === "string" && /^\d+(?:\.\d+)?px$/.test(ownMax)
            ? Number.parseFloat(ownMax)
            : Infinity,
        );
  return {
    position: "fixed",
    ...(maxWidth === undefined ? {} : { maxWidth: `${maxWidth}px` }),
    insetLeft: `${placement?.x ?? 0}px`,
    insetTop: `${placement?.y ?? 0}px`,
    ...(placement
      ? {
          maxHeight: `${Math.min(placement.maxHeight, Number.parseFloat(String(node.layout.maxHeight ?? "")) || Infinity)}px`,
        }
      : {}),
    ...(placement?.minWidth !== undefined
      ? { minWidth: `${Math.min(placement.minWidth, maxWidth ?? Infinity)}px` }
      : {}),
    ...(placement?.width !== undefined
      ? {
          width: `${Math.min(placement.width, maxWidth ?? Infinity)}px`,
          minWidth: `${Math.min(placement.minWidth ?? placement.width, maxWidth ?? Infinity)}px`,
        }
      : {}),
  };
}

export function catalogOverlayArrowLayout(
  node: CatalogConsumerNode,
  placement?: OverlayPlacement,
): Record<string, unknown> | undefined {
  if (node.hidden || node.bindingId !== "overlayarrow") return;
  const a = placement?.arrow;
  return {
    position: "absolute",
    width: `${a?.size ?? 12}px`,
    height: `${a?.size ?? 12}px`,
    insetLeft: `${a?.x ?? 0}px`,
    insetTop: `${a?.y ?? 0}px`,
  };
}
