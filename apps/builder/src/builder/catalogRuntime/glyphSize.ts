import { setFields } from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type {
  BreakpointName,
  EditTarget,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { CatalogConsumerNode } from "./compositionRoot";

/**
 * 2026-11-07 (사용자 「Width 64 · Height 40 이면 Text 탭 font size 도 40 이어야 일치 · Size 행 리셋 자리에
 * 숫자 입력」): a glyph leaf (Icon · Illustration) has one size — its drawn square
 * (`catalogGlyphSize`: the authored px box, else the authored font size, else the size step). Every
 * panel shows that number, and every entry writes so that it is the one drawn (the last edit wins):
 *
 * - Layout Width · Height — the box (`sizing`), which wins over the rest.
 * - Text Font Size · the Properties Size number — the font size, and the authored px box goes.
 * - Properties Size step (XS–XL) — the step, and the font size and box go.
 *
 * A clear at a breakpoint covers the layer below (a mask; a size layer's `null`), at Desktop removes.
 */
export function catalogIsGlyphRecord(
  record: Pick<CatalogConsumerNode, "bindingId" | "children"> | undefined,
): boolean {
  return (
    !!record &&
    (record.bindingId === "icon" || record.bindingId === "illustration") &&
    record.children.length === 0
  );
}

/** Types whose Properties Size row is a glyph size (the number in its action cell). */
export const CATALOG_GLYPH_TYPES: ReadonlySet<string> = new Set([
  "Icon",
  "Illustration",
]);

/** The glyph was sized off its step: an authored px box or font size. */
export function catalogGlyphSizeIsCustom(record: CatalogConsumerNode): boolean {
  const px = (value: unknown) => typeof value === "number" && value > 0;
  return (
    px(record.sizing.width) ||
    px(record.sizing.height) ||
    px(record.visual.fontSize)
  );
}

const clearOf = (breakpoint: BreakpointName) =>
  breakpoint === "desktop"
    ? ({ kind: "remove" } as const)
    : ({ kind: "mask" } as const);
/** A size layer takes `null` (no fixed size — over the layer below), not a mask. */
const clearSizeOf = (breakpoint: BreakpointName) =>
  breakpoint === "desktop"
    ? ({ kind: "remove" } as const)
    : ({ kind: "set", value: null } as const);
const layerOf = (breakpoint: BreakpointName) =>
  breakpoint === "desktop" ? {} : { breakpoint };

/** The authored px box goes (with a font-size write — the box would win over it). */
export function catalogGlyphBoxClearCommand(input: {
  targets: readonly EditTarget[];
  breakpoint: BreakpointName;
}): CatalogCommand {
  const clear = clearSizeOf(input.breakpoint);
  return setFields({
    targets: input.targets,
    ...layerOf(input.breakpoint),
    sizing: { width: clear, height: clear },
    label: "Edit icon size",
  });
}

/** The Properties Size number: the glyph px as the font size, the box cleared. */
export function catalogGlyphSizeCommand(input: {
  targets: readonly EditTarget[];
  breakpoint: BreakpointName;
  px: number;
}): CatalogCommand {
  const clear = clearSizeOf(input.breakpoint);
  return setFields({
    targets: input.targets,
    ...layerOf(input.breakpoint),
    visual: { fontSize: { kind: "set", value: input.px } },
    sizing: { width: clear, height: clear },
    label: "Edit icon size",
  });
}

/** A Size step pick: the font size and box go so the step is the one drawn. */
export function catalogGlyphStepClearCommand(input: {
  targets: readonly EditTarget[];
  breakpoint: BreakpointName;
}): CatalogCommand {
  const clear = clearSizeOf(input.breakpoint);
  return setFields({
    targets: input.targets,
    ...layerOf(input.breakpoint),
    visual: { fontSize: clearOf(input.breakpoint) },
    sizing: { width: clear, height: clear },
    label: "Edit icon size",
  });
}
