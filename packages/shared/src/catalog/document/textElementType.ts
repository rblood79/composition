import type { PropContract } from "../types";

/**
 * A Text's HTML element (사용자 결정 2026-11-25 「Text 컴포넌트 프러퍼티에 Tag 옵션」). RAC `Text` draws
 * its `elementType` (`private/Text.mjs` — default `span`), so a page heading or a paragraph is a Text
 * with its tag rather than one more component. The Heading component stays for the places RAC needs
 * its `Heading` (a Dialog's `slot="title"` names the dialog).
 *
 * The Canvas reads it as the browser draws it: an `h1`~`h6` takes the h rule's scale of its parent's
 * font and bold (`headingFont.ts` · `compositionRoot.ts` `inheritedFontOf`); a `p` · `span` take the
 * parent's font. The box is the same block either way (`Text.css` `display: block`, the app resets
 * the `p` · `h` margins).
 *
 * D2: S2 `Text` has no such prop — RAC `Text`'s `elementType` (`d2Provenance.ts`, `rac`). The key and
 * label are the frame's HTML tag's (`frameElementType.ts`).
 */
export const CATALOG_TEXT_ELEMENT_TYPES = [
  "span",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
] as const;

export type CatalogTextElementType =
  (typeof CATALOG_TEXT_ELEMENT_TYPES)[number];

const ELEMENT_TYPES: ReadonlySet<string> = new Set(CATALOG_TEXT_ELEMENT_TYPES);

export const TEXT_ELEMENT_TYPE_PROP: PropContract = {
  kind: "enum",
  label: "HTML tag",
  section: "accessibility",
  // (The panel shows `span` for an unset tag — not a `default`: that one would be every Text's resolved
  //  prop, written by the code view (`<Text elementType="span">`) and stored on each new Text.)
  defaultWhen: [{ when: { key: "elementType", truthy: false }, value: "span" }],
  // (The tags as written in HTML — not translated.)
  options: CATALOG_TEXT_ELEMENT_TYPES.map((value) => ({ value, label: value })),
  // (A part Text — a component's label · description slot — is its owner's to tag: only a Text
  //  with no slot role shows the field.)
  visibleWhen: { key: "slot", truthy: false },
};

/** The element a Text is drawn as — a value outside the list is a `span`. */
export function catalogTextElementType(
  props: Readonly<Record<string, unknown>>,
): CatalogTextElementType {
  const value = props.elementType;
  return typeof value === "string" && ELEMENT_TYPES.has(value)
    ? (value as CatalogTextElementType)
    : "span";
}

/** The heading level of a Text drawn as `h1`~`h6`, else undefined. */
export function catalogTextHeadingLevel(
  props: Readonly<Record<string, unknown>>,
): number | undefined {
  const element = catalogTextElementType(props);
  return element.startsWith("h") ? Number(element.slice(1)) : undefined;
}
