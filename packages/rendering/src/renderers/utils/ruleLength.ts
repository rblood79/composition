/**
 * ADR-295 Phase 3c-3 — the relative length forms of Decision 3 in a rule's size block.
 *
 * S2 writes a padding · gap in one of four forms, and two of them are relative: a control's
 * padding-inline is a ratio of its height (`edge-to-text` = height × 3/8, a Button's `pill` = height / 2)
 * and an icon-to-text · label-to-control gap a ratio of its font (`text-to-visual` = 6/14 em, touch 8/17 em;
 * `text-to-control` = 10/14 em). A rule size block declares them as forms — `ofHeight(3, 8)` ·
 * `em(6, 14, [8, 17])` — next to the size's height and font tokens.
 *
 * Each form becomes one length ref, `{length.<base token>*<a>/<b>[~<touch a>/<touch b>]}` (the base is the
 * block's own `{size.height.<S>}` · `{typography.text-<x>}`), and every consumer reads that one ref:
 * - the Canvas · the engine · the panels read the number in the installed maps (`resolveToken` — desktop
 *   for the Canvas, the touch set in the G2 harness's touch arm): `defineRuleLengthForms` turns the key
 *   into a getter, so the readers of a number stay as they are;
 * - the generated CSS and the DOM inline write the formula over the device variables (`ruleLengthCss`),
 *   so the touch set (× 1.25 height, 17 base font, the touch coefficient) reaches them;
 * - a library definition keeps the ref as a token use, so the resolver remembers where the number came
 *   from (`catalogResolvedTokenRef`) and the DOM can write the formula for a record still at it.
 */
import type { TokenRef } from "../../types/token.types";
import { tokenToCSSLength, tokenToCSSVar } from "./tokenResolver";
import { withCatalogTokenVars } from "../CSSGenerator";

export type RuleLengthForm =
  | { readonly ofHeight: readonly [number, number] }
  | {
      readonly em: readonly [number, number];
      readonly touch?: { readonly em: readonly [number, number] };
    };

const FORM = Symbol("ruleLengthForm");
type MarkedForm = RuleLengthForm & { readonly [FORM]: true };

/**
 * A padding · gap of the size's control height × a / b (S2 `self(height)` ratios). Typed as the number
 * it reads as: `defineRuleLengthForms` replaces it with a getter before the table is read.
 */
export function ofHeight(a: number, b: number): number {
  return { ofHeight: [a, b], [FORM]: true } as MarkedForm as unknown as number;
}

/**
 * A padding · gap of the size's font × a / b (S2 `fontRelative(a, b)`); `touch` = the coefficient S2's
 * `touch:` condition writes instead (`text-to-visual` 6/14 → 8/17). Typed as the number it reads as.
 */
export function em(a: number, b: number, touch?: [number, number]): number {
  return {
    em: [a, b],
    ...(touch ? { touch: { em: touch } } : {}),
    [FORM]: true,
  } as MarkedForm as unknown as number;
}

function isForm(value: unknown): value is MarkedForm {
  return typeof value === "object" && value !== null && FORM in value;
}

const HEIGHT_REF = /^\{size\.height\.[A-Z]+\}$/;
const FONT_REF = /^\{typography\.text-[a-z0-9-]+\}$/;

/** The length ref of a form in a size block (its base = the block's height · font token). */
export function ruleLengthRef(
  form: RuleLengthForm,
  block: Readonly<Record<string, unknown>>,
): TokenRef {
  const ratio = (pair: readonly [number, number]) => `${pair[0]}/${pair[1]}`;
  if ("ofHeight" in form) {
    const base = [block.height, block.minHeight].find(
      (value) => typeof value === "string" && HEIGHT_REF.test(value),
    ) as string | undefined;
    if (!base)
      throw new Error(
        `ADR-295 ofHeight needs a {size.height.<S>} height or minHeight in its size block`,
      );
    return `{length.${base.slice(1, -1)}*${ratio(form.ofHeight)}}` as TokenRef;
  }
  const font = block.fontSize;
  if (typeof font !== "string" || !FONT_REF.test(font))
    throw new Error(
      `ADR-295 em needs a {typography.text-<x>} fontSize in its size block`,
    );
  const touch = form.touch ? `~${ratio(form.touch.em)}` : "";
  return `{length.${font.slice(1, -1)}*${ratio(form.em)}${touch}}` as TokenRef;
}

/** One scaled term of a length ref: the base token × the ratio (the touch ratio on the touch set). */
export interface RuleLengthTerm {
  base: TokenRef;
  ratio: number;
  ratioText: string;
  touch?: { ratio: number; ratioText: string };
}

const NUM = String.raw`-?\d+(?:\.\d+)?`;
const TERM = new RegExp(
  `^([a-z]+\\.[A-Za-z0-9.-]+?)\\*(${NUM})\\/(\\d+(?:\\.\\d+)?)(?:~(${NUM})\\/(\\d+(?:\\.\\d+)?))?([+-]\\d+(?:\\.\\d+)?)?$`,
);

/**
 * `{length.<term>[+<term>…][±<px>]}` → its terms and px offset, else `undefined`. A term is
 * `<base>*<a>/<b>[~<c>/<d>]` (a negative `a` subtracts); the px offset follows the last term. ADR-295 Phase
 * 3c-3b: a length of several bases — a SearchField's text start (height / 2 + the font's line + 6/14 em), a
 * field button's room (the end inset + its square + 10/14 em).
 */
export function parseRuleLengthTerms(
  ref: string,
): { terms: RuleLengthTerm[]; add: number } | undefined {
  const body = /^\{length\.([^{}]+)\}$/.exec(ref)?.[1];
  if (!body) return undefined;
  const terms: RuleLengthTerm[] = [];
  let add = 0;
  const parts = body.split("+");
  for (const [index, part] of parts.entries()) {
    const match = TERM.exec(part);
    if (!match) {
      // (A trailing positive px offset: `…+12`.)
      if (
        index === parts.length - 1 &&
        index > 0 &&
        /^\d+(?:\.\d+)?$/.test(part)
      ) {
        add += Number(part);
        continue;
      }
      return undefined;
    }
    const [, base, a, b, c, d, offset] = match;
    if (offset !== undefined) {
      if (index !== parts.length - 1) return undefined;
      add += Number(offset);
    }
    terms.push({
      base: `{${base}}` as TokenRef,
      ratio: Number(a) / Number(b),
      ratioText: `${a} / ${b}`,
      ...(c !== undefined && d !== undefined
        ? { touch: { ratio: Number(c) / Number(d), ratioText: `${c} / ${d}` } }
        : {}),
    });
  }
  return terms.length ? { terms, add } : undefined;
}

/**
 * A one-term length ref (`{length.<base>*<a>/<b>[~<c>/<d>][±<px>]}` — a rule's relative padding · gap) → its
 * parts, else `undefined` (several terms: `parseRuleLengthTerms`).
 */
export function parseRuleLengthRef(
  ref: string,
): (RuleLengthTerm & { add: number }) | undefined {
  const parsed = parseRuleLengthTerms(ref);
  return parsed?.terms.length === 1
    ? { ...parsed.terms[0]!, add: parsed.add }
    : undefined;
}

/** The device-set flag of the size map (`{size.device.touch}` — 0 desktop, 1 touch). */
export const DEVICE_TOUCH_REF = "{size.device.touch}" as TokenRef;

/** A length ref's px in the maps `resolve` reads (`resolveToken`), else `undefined`. */
export function ruleLengthPx(
  ref: string,
  resolve: (ref: TokenRef) => unknown,
): number | undefined {
  const parsed = parseRuleLengthTerms(ref);
  if (!parsed) return undefined;
  const touch = resolve(DEVICE_TOUCH_REF) === 1;
  let total = parsed.add;
  for (const term of parsed.terms) {
    const base = resolve(term.base);
    if (typeof base !== "number") return undefined;
    total += base * (touch && term.touch ? term.touch.ratio : term.ratio);
  }
  return total;
}

/**
 * The CSS of a length ref over the device variables: `calc(<base> * a / b [± px])`, with a touch coefficient
 * `calc(<base> * (a / b + (c / d − a / b) × touch flag) [± px])` (`--catalog-token-size-device-touch`); several
 * terms are summed (`calc(<term> + <term> …)`). A font's line base (`{typography.<x>--line-height}` — unitless
 * in CSS) is that font × the line ratio.
 */
export function ruleLengthCss(ref: string): string | undefined {
  const parsed = parseRuleLengthTerms(ref);
  if (!parsed) return undefined;
  const term = (part: RuleLengthTerm) => {
    const base = withCatalogTokenVars(tokenToCSSLength(part.base));
    return part.touch
      ? `${base} * (${part.ratioText} + (${part.touch.ratioText} - ${part.ratioText}) * ${tokenToCSSVar(DEVICE_TOUCH_REF)})`
      : `${base} * ${part.ratioText}`;
  };
  const add =
    parsed.add === 0
      ? ""
      : ` ${parsed.add < 0 ? "-" : "+"} ${Math.abs(parsed.add)}px`;
  return `calc(${parsed.terms.map(term).join(" + ")}${add})`;
}

/**
 * A component's pin of a relative padding · gap (`--catalog-token-button-padding-x-M`):
 * `builder-catalog-vars.css` declares it for the builder chrome (the pre-295 px — Decision 8 · 9), nothing
 * else does, so the Preview · Publish read the form's formula behind it (`var(<pin>, <formula>)`).
 */
export function lengthPinVar(
  component: string,
  key: string,
  size: string,
): string {
  const kebab = (name: string) =>
    name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  return `--catalog-token-${kebab(component)}-${kebab(key)}-${size}`;
}

const LENGTH_REFS = new WeakMap<object, Record<string, TokenRef>>();

/** The length ref a size block's key reads (`undefined` = a literal · token · no form). */
export function ruleSizeLengthRef(
  block: object,
  key: string,
): TokenRef | undefined {
  return LENGTH_REFS.get(block)?.[key];
}

/** All length refs of a size block (carried onto a copy — the CSS generator's `SizeSpec`). */
export function ruleSizeLengthRefs(
  block: object,
): Readonly<Record<string, TokenRef>> | undefined {
  return LENGTH_REFS.get(block);
}

/**
 * The size blocks' forms → getters reading the installed maps (`resolve` = `resolveToken`). Run once on
 * the rule table after it is built; a block shared by several rules is converted once.
 */
export function defineRuleLengthForms(
  rules: Readonly<Record<string, { sizes?: Readonly<Record<string, object>> }>>,
  resolve: (ref: TokenRef) => unknown,
): void {
  for (const rule of Object.values(rules))
    for (const block of Object.values(rule.sizes ?? {})) {
      const record = block as Record<string, unknown>;
      for (const [key, value] of Object.entries(record)) {
        if (!isForm(value)) continue;
        const ref = ruleLengthRef(value, record);
        LENGTH_REFS.set(block, { ...LENGTH_REFS.get(block), [key]: ref });
        Object.defineProperty(record, key, {
          enumerable: true,
          configurable: true,
          get: () => {
            const px = resolve(ref);
            return typeof px === "number" ? px : 0;
          },
        });
      }
    }
}
