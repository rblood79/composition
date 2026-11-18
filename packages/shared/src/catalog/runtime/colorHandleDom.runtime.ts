import {
  createElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactElement,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { ColorThumb as AriaColorThumb } from "react-aria-components/ColorThumb";
import {
  CATALOG_COLOR_CHECKER,
  CATALOG_COLOR_CHECKER_CSS,
  CATALOG_COLOR_HANDLE_INNER_RING,
  CATALOG_COLOR_LOUPE,
  lightShadows,
  parseShadow,
} from "@composition/rendering";

/**
 * The Preview's S2 `ColorHandle` (`ColorHandle.tsx`) on RAC's ColorThumb — the box is the ColorThumb
 * rule's (generated sheet): the displayed color over the checkerboard, the inner ring `div` filling the
 * box inside its border, and the Loupe above the handle while it is dragged (portal — the Canvas has
 * no drag). The values are `colorHandle.ts`, which the Canvas `color_thumb` reads too.
 */
export function CatalogColorHandle({
  style,
  ...rest
}: {
  style: CSSProperties;
} & Record<string, unknown>): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const ring = CATALOG_COLOR_HANDLE_INNER_RING;
  return createElement(AriaColorThumb as ElementType, {
    ...rest,
    ref,
    style: ({
      defaultStyle,
      isDisabled,
    }: {
      defaultStyle: CSSProperties;
      isDisabled: boolean;
    }) => ({
      ...defaultStyle,
      ...style,
      ...(isDisabled
        ? {}
        : {
            background: `linear-gradient(${defaultStyle.backgroundColor}, ${defaultStyle.backgroundColor}), ${CATALOG_COLOR_CHECKER_CSS}`,
          }),
    }),
    children: ({
      isDragging,
      color,
    }: {
      isDragging: boolean;
      color: { toString: (format?: string) => string };
    }) => [
      createElement("div", {
        key: "ring",
        className: "color-handle-ring",
        style: {
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          boxSizing: "border-box",
          border: `${ring.width}px solid rgb(0 0 0 / ${ring.alpha})`,
          pointerEvents: "none",
        },
      }),
      createElement(ColorLoupePortal, {
        key: "loupe",
        isOpen: isDragging,
        thumbRef: ref,
        color: color.toString("css"),
      }),
    ],
  });
}

/** S2 `ColorLoupePortal`: the Loupe stays mounted through its exit animation. */
function ColorLoupePortal({
  isOpen,
  thumbRef,
  color,
}: {
  isOpen: boolean;
  thumbRef: RefObject<HTMLDivElement | null>;
  color: string;
}): ReactElement | null {
  const [state, setState] = useState<"open" | "exiting" | "closed">(
    isOpen ? "open" : "closed",
  );
  if (isOpen && state !== "open") setState("open");
  if (!isOpen && state === "open") setState("exiting");
  if (state === "closed" || typeof document === "undefined") return null;
  return createPortal(
    createElement(ColorLoupe, {
      thumbRef,
      color,
      exiting: state === "exiting",
      onExited: () => setState("closed"),
    }),
    document.body,
  );
}

/** S2 elevated drop shadow — `filter: elevated` (layers reversed, as S2's filter). */
const LOUPE_FILTER = parseShadow(lightShadows.md)
  .reverse()
  .map(
    (layer) =>
      `drop-shadow(${layer.offsetX}px ${layer.offsetY}px ${layer.blur}px ${layer.color})`,
  )
  .join(" ");

/** (exported for its regression test — the Loupe's animation across re-renders) */
export function ColorLoupe({
  thumbRef,
  color,
  exiting,
  onExited,
}: {
  thumbRef: RefObject<HTMLDivElement | null>;
  color: string;
  exiting: boolean;
  onExited: () => void;
}): ReactElement {
  const patternId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const { width, height, border, offset, handle, path, ring } =
    CATALOG_COLOR_LOUPE;
  // (The handle's center in the viewport — S2 places the Loupe from the thumb's place in its control.)
  useLayoutEffect(() => {
    const rect = thumbRef.current?.getBoundingClientRect();
    if (rect)
      setCenter({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
  }, [thumbRef, color]);
  // S2's enter · exit: 125ms, 8px down and transparent — once per open · close: the Loupe re-renders
  // on every move (its color · place), so the latest `onExited` is read through a ref, not a dep (a
  // dep restarted the enter animation from transparent on each move — visible only once stopped).
  const onExitedRef = useRef(onExited);
  useEffect(() => {
    onExitedRef.current = onExited;
  });
  useEffect(() => {
    const svg = svgRef.current;
    const done = () => onExitedRef.current();
    if (!svg || typeof svg.animate !== "function") {
      if (exiting) done();
      return;
    }
    const frames = [
      { transform: "translateY(8px)", opacity: 0 },
      { transform: "none", opacity: 1 },
    ];
    const animation = svg.animate(exiting ? [...frames].reverse() : frames, {
      duration: 125,
      easing: "ease-in-out",
      fill: "forwards",
    });
    if (exiting) animation.onfinish = done;
    return () => animation.cancel();
  }, [exiting]);
  return createElement(
    "svg",
    {
      ref: svgRef,
      "aria-hidden": true,
      className: "color-loupe",
      width: width + border * 2,
      height: height + border * 2,
      style: {
        position: "fixed",
        top: center.y,
        left: center.x,
        marginTop: -height - border * 2 - handle / 2 - offset,
        marginLeft: -width / 2 - border,
        filter: LOUPE_FILTER,
        pointerEvents: "none",
        isolation: "isolate",
      },
    },
    createElement(
      "pattern",
      {
        id: patternId,
        x: 0,
        y: 0,
        width: CATALOG_COLOR_CHECKER.tile,
        height: CATALOG_COLOR_CHECKER.tile,
        patternUnits: "userSpaceOnUse",
      },
      createElement("rect", {
        fill: CATALOG_COLOR_CHECKER.light,
        x: 0,
        y: 0,
        width: 16,
        height: 16,
      }),
      createElement("rect", {
        fill: CATALOG_COLOR_CHECKER.dark,
        x: 0,
        y: 0,
        width: 8,
        height: 8,
      }),
      createElement("rect", {
        fill: CATALOG_COLOR_CHECKER.dark,
        x: 8,
        y: 8,
        width: 8,
        height: 8,
      }),
    ),
    createElement("path", { d: path, fill: `url(#${patternId})` }),
    createElement("path", { d: path, fill: color }),
    // (S2 `transparent-black-200` stroke on the white ring — `rgb(0 0 0 / 0.12)`.)
    createElement("path", {
      d: ring,
      fill: "white",
      stroke: "rgb(0 0 0 / 0.12)",
      strokeWidth: 1,
    }),
  );
}
