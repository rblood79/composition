var e=`/* ============================================================
 * AUTO-GENERATED from catalog Button — DO NOT EDIT MANUALLY
 * Source: packages/shared/src/catalog/generated/componentRulesTable.ts
 * Archetype: button
 * ============================================================ */

@layer components {

.react-aria-Button {
  /* Base styles — archetype: button */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: fit-content;
    box-sizing: border-box;
    cursor: pointer;
    user-select: none;
    transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
    font-family: var(--font-sans);

  /* Container styles (ADR-071 + ADR-083 Phase 1) */
  width: fit-content;
  height: fit-content;
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;

  /* Default variant */
  background: var(--fg);
  color: var(--bg);
  border-color: var(--fg);

  /* Default size */
  padding: calc((var(--catalog-token-size-height-M) - var(--catalog-token-text-sm) * var(--catalog-token-text-sm--line-height) - 2 * var(--border-width-thin)) / 2) var(--catalog-token-button-padding-x-M, calc(var(--catalog-token-size-height-M) * 1 / 2));
  font-size: var(--catalog-token-text-sm);
  border-radius: var(--catalog-token-radius-full);
  line-height: var(--catalog-token-text-sm--line-height);
  font-weight: 500;
  border-width: var(--border-width-thin);
  min-height: var(--catalog-token-size-height-M);
  gap: var(--catalog-token-button-gap-M, calc(var(--catalog-token-text-sm) * (6 / 14 + (8 / 17 - 6 / 14) * var(--catalog-token-size-device-touch))));
  --icon-size: var(--catalog-token-button-icon-size-M, calc(var(--catalog-token-text-sm) * var(--catalog-token-text-sm--line-height)));
  --icon-gap: var(--catalog-token-button-icon-gap-M, calc(var(--catalog-token-text-sm) * (6 / 14 + (8 / 17 - 6 / 14) * var(--catalog-token-size-device-touch))));
}

.react-aria-Button:where([data-variant="accent"]) {
  background: var(--accent);
  color: var(--fg-on-accent);
  border-color: var(--accent);
}

.react-aria-Button:where([data-variant="accent"][data-hovered]) {
  background: var(--accent-hover, color-mix(in srgb, var(--accent) 85%, black));
  border-color: var(--accent-hover, color-mix(in srgb, var(--accent) 85%, black));
}

.react-aria-Button:where([data-variant="accent"][data-pressed]) {
  background: var(--accent-pressed, color-mix(in srgb, var(--accent) 75%, black));
}

.react-aria-Button:where([data-variant="accent"][data-fill-style="outline"]) {
  background: transparent;
  color: var(--accent-content);
  border-color: var(--border-hover);
}

.react-aria-Button:where([data-variant="accent"][data-static-color="black"]) {
  background: #000000;
  color: #ffffff;
  border-color: #000000;
}

.react-aria-Button:where([data-variant="accent"][data-static-color="black"][data-hovered]) {
  background: #000000;
  color: #ffffff;
  border-color: #000000;
}

.react-aria-Button:where([data-variant="accent"][data-static-color="black"][data-pressed]) {
  background: #000000;
  color: #ffffff;
}

.react-aria-Button:where([data-variant="accent"][data-static-color="black"][data-fill-style="outline"]) {
  background: transparent;
  color: #000000;
  border-color: #000000;
}

.react-aria-Button:where([data-variant="accent"][data-static-color="white"]) {
  background: #ffffff;
  color: #000000;
  border-color: #ffffff;
}

.react-aria-Button:where([data-variant="accent"][data-static-color="white"][data-hovered]) {
  background: #ffffff;
  color: #000000;
  border-color: #ffffff;
}

.react-aria-Button:where([data-variant="accent"][data-static-color="white"][data-pressed]) {
  background: #ffffff;
  color: #000000;
}

.react-aria-Button:where([data-variant="accent"][data-static-color="white"][data-fill-style="outline"]) {
  background: transparent;
  color: #ffffff;
  border-color: #ffffff;
}

.react-aria-Button:where([data-variant="primary"]) {
  background: var(--fg);
  color: var(--bg);
  border-color: var(--fg);
}

.react-aria-Button:where([data-variant="primary"][data-hovered]) {
  background: var(--neutral-fill-hover);
  border-color: var(--neutral-fill-hover);
}

.react-aria-Button:where([data-variant="primary"][data-pressed]) {
  background: var(--neutral-fill-pressed);
}

.react-aria-Button:where([data-variant="primary"][data-fill-style="outline"]) {
  background: transparent;
  color: var(--fg);
  border-color: var(--border-hover);
}

.react-aria-Button:where([data-variant="primary"][data-static-color="black"]) {
  background: #000000;
  color: #ffffff;
  border-color: #000000;
}

.react-aria-Button:where([data-variant="primary"][data-static-color="black"][data-hovered]) {
  background: #000000;
  color: #ffffff;
  border-color: #000000;
}

.react-aria-Button:where([data-variant="primary"][data-static-color="black"][data-pressed]) {
  background: #000000;
  color: #ffffff;
}

.react-aria-Button:where([data-variant="primary"][data-static-color="black"][data-fill-style="outline"]) {
  background: transparent;
  color: #000000;
  border-color: #000000;
}

.react-aria-Button:where([data-variant="primary"][data-static-color="white"]) {
  background: #ffffff;
  color: #000000;
  border-color: #ffffff;
}

.react-aria-Button:where([data-variant="primary"][data-static-color="white"][data-hovered]) {
  background: #ffffff;
  color: #000000;
  border-color: #ffffff;
}

.react-aria-Button:where([data-variant="primary"][data-static-color="white"][data-pressed]) {
  background: #ffffff;
  color: #000000;
}

.react-aria-Button:where([data-variant="primary"][data-static-color="white"][data-fill-style="outline"]) {
  background: transparent;
  color: #ffffff;
  border-color: #ffffff;
}

.react-aria-Button:where([data-variant="secondary"]) {
  background: var(--bg-overlay);
  color: var(--fg);
  border-color: var(--border);
}

.react-aria-Button:where([data-variant="secondary"][data-hovered]) {
  background: var(--bg-muted);
}

.react-aria-Button:where([data-variant="secondary"][data-pressed]) {
  background: var(--bg-muted);
}

.react-aria-Button:where([data-variant="secondary"][data-fill-style="outline"]) {
  background: transparent;
  color: var(--fg);
  border-color: var(--border-hover);
}

.react-aria-Button:where([data-variant="secondary"][data-static-color="black"]) {
  background: #000000;
  color: #ffffff;
  border-color: #000000;
}

.react-aria-Button:where([data-variant="secondary"][data-static-color="black"][data-hovered]) {
  background: #000000;
  color: #ffffff;
}

.react-aria-Button:where([data-variant="secondary"][data-static-color="black"][data-pressed]) {
  background: #000000;
  color: #ffffff;
}

.react-aria-Button:where([data-variant="secondary"][data-static-color="black"][data-fill-style="outline"]) {
  background: transparent;
  color: #000000;
  border-color: #000000;
}

.react-aria-Button:where([data-variant="secondary"][data-static-color="white"]) {
  background: #ffffff;
  color: #000000;
  border-color: #ffffff;
}

.react-aria-Button:where([data-variant="secondary"][data-static-color="white"][data-hovered]) {
  background: #ffffff;
  color: #000000;
}

.react-aria-Button:where([data-variant="secondary"][data-static-color="white"][data-pressed]) {
  background: #ffffff;
  color: #000000;
}

.react-aria-Button:where([data-variant="secondary"][data-static-color="white"][data-fill-style="outline"]) {
  background: transparent;
  color: #ffffff;
  border-color: #ffffff;
}

.react-aria-Button:where([data-variant="negative"]) {
  background: var(--negative);
  color: var(--fg-on-negative);
  border-color: var(--negative);
}

.react-aria-Button:where([data-variant="negative"][data-hovered]) {
  background: var(--negative-hover, color-mix(in srgb, var(--negative) 85%, black));
  border-color: var(--negative-hover, color-mix(in srgb, var(--negative) 85%, black));
}

.react-aria-Button:where([data-variant="negative"][data-pressed]) {
  background: var(--negative-pressed, color-mix(in srgb, var(--negative) 75%, black));
}

.react-aria-Button:where([data-variant="negative"][data-fill-style="outline"]) {
  background: transparent;
  color: var(--negative);
  border-color: var(--border-hover);
}

.react-aria-Button:where([data-variant="negative"][data-static-color="black"]) {
  background: #000000;
  color: #ffffff;
  border-color: #000000;
}

.react-aria-Button:where([data-variant="negative"][data-static-color="black"][data-hovered]) {
  background: #000000;
  color: #ffffff;
  border-color: #000000;
}

.react-aria-Button:where([data-variant="negative"][data-static-color="black"][data-pressed]) {
  background: #000000;
  color: #ffffff;
}

.react-aria-Button:where([data-variant="negative"][data-static-color="black"][data-fill-style="outline"]) {
  background: transparent;
  color: #000000;
  border-color: #000000;
}

.react-aria-Button:where([data-variant="negative"][data-static-color="white"]) {
  background: #ffffff;
  color: #000000;
  border-color: #ffffff;
}

.react-aria-Button:where([data-variant="negative"][data-static-color="white"][data-hovered]) {
  background: #ffffff;
  color: #000000;
  border-color: #ffffff;
}

.react-aria-Button:where([data-variant="negative"][data-static-color="white"][data-pressed]) {
  background: #ffffff;
  color: #000000;
}

.react-aria-Button:where([data-variant="negative"][data-static-color="white"][data-fill-style="outline"]) {
  background: transparent;
  color: #ffffff;
  border-color: #ffffff;
}

.react-aria-Button:where([data-variant="premium"]) {
  background: var(--hue-purple);
  color: var(--color-white);
  border-color: var(--hue-purple);
}

.react-aria-Button:where([data-variant="premium"][data-hovered]) {
  background: var(--purple-hover, color-mix(in srgb, var(--hue-purple) 85%, black));
  border-color: var(--purple-hover, color-mix(in srgb, var(--hue-purple) 85%, black));
}

.react-aria-Button:where([data-variant="premium"][data-pressed]) {
  background: var(--purple-pressed, color-mix(in srgb, var(--hue-purple) 75%, black));
}

.react-aria-Button:where([data-variant="premium"][data-fill-style="outline"]) {
  background: transparent;
  color: var(--hue-purple);
  border-color: var(--border-hover);
}

.react-aria-Button:where([data-variant="premium"][data-static-color="black"]) {
  background: #000000;
  color: #ffffff;
  border-color: #000000;
}

.react-aria-Button:where([data-variant="premium"][data-static-color="black"][data-hovered]) {
  background: #000000;
  color: #ffffff;
  border-color: #000000;
}

.react-aria-Button:where([data-variant="premium"][data-static-color="black"][data-pressed]) {
  background: #000000;
  color: #ffffff;
}

.react-aria-Button:where([data-variant="premium"][data-static-color="black"][data-fill-style="outline"]) {
  background: transparent;
  color: #000000;
  border-color: #000000;
}

.react-aria-Button:where([data-variant="premium"][data-static-color="white"]) {
  background: #ffffff;
  color: #000000;
  border-color: #ffffff;
}

.react-aria-Button:where([data-variant="premium"][data-static-color="white"][data-hovered]) {
  background: #ffffff;
  color: #000000;
  border-color: #ffffff;
}

.react-aria-Button:where([data-variant="premium"][data-static-color="white"][data-pressed]) {
  background: #ffffff;
  color: #000000;
}

.react-aria-Button:where([data-variant="premium"][data-static-color="white"][data-fill-style="outline"]) {
  background: transparent;
  color: #ffffff;
  border-color: #ffffff;
}

.react-aria-Button:where([data-variant="genai"]) {
  background: var(--hue-purple);
  color: var(--color-white);
  border-color: var(--hue-purple);
}

.react-aria-Button:where([data-variant="genai"][data-hovered]) {
  background: var(--purple-hover, color-mix(in srgb, var(--hue-purple) 85%, black));
  border-color: var(--purple-hover, color-mix(in srgb, var(--hue-purple) 85%, black));
}

.react-aria-Button:where([data-variant="genai"][data-pressed]) {
  background: var(--purple-pressed, color-mix(in srgb, var(--hue-purple) 75%, black));
}

.react-aria-Button:where([data-variant="genai"][data-fill-style="outline"]) {
  background: transparent;
  color: var(--hue-purple);
  border-color: var(--border-hover);
}

.react-aria-Button:where([data-variant="genai"][data-static-color="black"]) {
  background: #000000;
  color: #ffffff;
  border-color: #000000;
}

.react-aria-Button:where([data-variant="genai"][data-static-color="black"][data-hovered]) {
  background: #000000;
  color: #ffffff;
  border-color: #000000;
}

.react-aria-Button:where([data-variant="genai"][data-static-color="black"][data-pressed]) {
  background: #000000;
  color: #ffffff;
}

.react-aria-Button:where([data-variant="genai"][data-static-color="black"][data-fill-style="outline"]) {
  background: transparent;
  color: #000000;
  border-color: #000000;
}

.react-aria-Button:where([data-variant="genai"][data-static-color="white"]) {
  background: #ffffff;
  color: #000000;
  border-color: #ffffff;
}

.react-aria-Button:where([data-variant="genai"][data-static-color="white"][data-hovered]) {
  background: #ffffff;
  color: #000000;
  border-color: #ffffff;
}

.react-aria-Button:where([data-variant="genai"][data-static-color="white"][data-pressed]) {
  background: #ffffff;
  color: #000000;
}

.react-aria-Button:where([data-variant="genai"][data-static-color="white"][data-fill-style="outline"]) {
  background: transparent;
  color: #ffffff;
  border-color: #ffffff;
}

.react-aria-Button[data-icon-only] {
  padding: 0;
  aspect-ratio: 1;
}

.react-aria-Button[data-size="XS"] {
  padding: calc((var(--catalog-token-size-height-XS) - var(--catalog-token-text-2xs) * var(--catalog-token-text-2xs--line-height) - 2 * var(--border-width-thin)) / 2) var(--catalog-token-button-padding-x-XS, calc(var(--catalog-token-size-height-XS) * 1 / 2));
  font-size: var(--catalog-token-text-2xs);
  border-radius: var(--catalog-token-radius-full);
  line-height: var(--catalog-token-text-2xs--line-height);
  font-weight: 500;
  border-width: var(--border-width-thin);
  min-height: var(--catalog-token-size-height-XS);
  gap: var(--catalog-token-button-gap-XS, calc(var(--catalog-token-text-2xs) * (6 / 14 + (8 / 17 - 6 / 14) * var(--catalog-token-size-device-touch))));
  --icon-size: var(--catalog-token-button-icon-size-XS, calc(var(--catalog-token-text-2xs) * var(--catalog-token-text-2xs--line-height)));
  --icon-gap: var(--catalog-token-button-icon-gap-XS, calc(var(--catalog-token-text-2xs) * (6 / 14 + (8 / 17 - 6 / 14) * var(--catalog-token-size-device-touch))));
}

.react-aria-Button[data-size="S"] {
  padding: calc((var(--catalog-token-size-height-S) - var(--catalog-token-text-xs) * var(--catalog-token-text-xs--line-height) - 2 * var(--border-width-thin)) / 2) var(--catalog-token-button-padding-x-S, calc(var(--catalog-token-size-height-S) * 1 / 2));
  font-size: var(--catalog-token-text-xs);
  border-radius: var(--catalog-token-radius-full);
  line-height: var(--catalog-token-text-xs--line-height);
  font-weight: 500;
  border-width: var(--border-width-thin);
  min-height: var(--catalog-token-size-height-S);
  gap: var(--catalog-token-button-gap-S, calc(var(--catalog-token-text-xs) * (6 / 14 + (8 / 17 - 6 / 14) * var(--catalog-token-size-device-touch))));
  --icon-size: var(--catalog-token-button-icon-size-S, calc(var(--catalog-token-text-xs) * var(--catalog-token-text-xs--line-height)));
  --icon-gap: var(--catalog-token-button-icon-gap-S, calc(var(--catalog-token-text-xs) * (6 / 14 + (8 / 17 - 6 / 14) * var(--catalog-token-size-device-touch))));
}

.react-aria-Button[data-size="M"] {
  padding: calc((var(--catalog-token-size-height-M) - var(--catalog-token-text-sm) * var(--catalog-token-text-sm--line-height) - 2 * var(--border-width-thin)) / 2) var(--catalog-token-button-padding-x-M, calc(var(--catalog-token-size-height-M) * 1 / 2));
  font-size: var(--catalog-token-text-sm);
  border-radius: var(--catalog-token-radius-full);
  line-height: var(--catalog-token-text-sm--line-height);
  font-weight: 500;
  border-width: var(--border-width-thin);
  min-height: var(--catalog-token-size-height-M);
  gap: var(--catalog-token-button-gap-M, calc(var(--catalog-token-text-sm) * (6 / 14 + (8 / 17 - 6 / 14) * var(--catalog-token-size-device-touch))));
  --icon-size: var(--catalog-token-button-icon-size-M, calc(var(--catalog-token-text-sm) * var(--catalog-token-text-sm--line-height)));
  --icon-gap: var(--catalog-token-button-icon-gap-M, calc(var(--catalog-token-text-sm) * (6 / 14 + (8 / 17 - 6 / 14) * var(--catalog-token-size-device-touch))));
}

.react-aria-Button[data-size="L"] {
  padding: calc((var(--catalog-token-size-height-L) - var(--catalog-token-text-base) * var(--catalog-token-text-base--line-height) - 2 * var(--border-width-thin)) / 2) var(--catalog-token-button-padding-x-L, calc(var(--catalog-token-size-height-L) * 1 / 2));
  font-size: var(--catalog-token-text-base);
  border-radius: var(--catalog-token-radius-full);
  line-height: var(--catalog-token-text-base--line-height);
  font-weight: 500;
  border-width: var(--border-width-thin);
  min-height: var(--catalog-token-size-height-L);
  gap: var(--catalog-token-button-gap-L, calc(var(--catalog-token-text-base) * (6 / 14 + (8 / 17 - 6 / 14) * var(--catalog-token-size-device-touch))));
  --icon-size: var(--catalog-token-button-icon-size-L, calc(var(--catalog-token-text-base) * var(--catalog-token-text-base--line-height)));
  --icon-gap: var(--catalog-token-button-icon-gap-L, calc(var(--catalog-token-text-base) * (6 / 14 + (8 / 17 - 6 / 14) * var(--catalog-token-size-device-touch))));
}

.react-aria-Button[data-size="XL"] {
  padding: calc((var(--catalog-token-size-height-XL) - var(--catalog-token-text-lg) * var(--catalog-token-text-lg--line-height) - 2 * var(--border-width-thin)) / 2) var(--catalog-token-button-padding-x-XL, calc(var(--catalog-token-size-height-XL) * 1 / 2));
  font-size: var(--catalog-token-text-lg);
  border-radius: var(--catalog-token-radius-full);
  line-height: var(--catalog-token-text-lg--line-height);
  font-weight: 500;
  border-width: var(--border-width-thin);
  min-height: var(--catalog-token-size-height-XL);
  gap: var(--catalog-token-button-gap-XL, calc(var(--catalog-token-text-lg) * (6 / 14 + (8 / 17 - 6 / 14) * var(--catalog-token-size-device-touch))));
  --icon-size: var(--catalog-token-button-icon-size-XL, calc(var(--catalog-token-text-lg) * var(--catalog-token-text-lg--line-height)));
  --icon-gap: var(--catalog-token-button-icon-gap-XL, calc(var(--catalog-token-text-lg) * (6 / 14 + (8 / 17 - 6 / 14) * var(--catalog-token-size-device-touch))));
}

.react-aria-Button[data-focus-visible] {
  outline: var(--focus-ring-width) solid var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}

.react-aria-Button[data-pressed] {
  transform: scale(0.95);
}

.react-aria-Button[data-disabled] {
  opacity: 0.38;
  cursor: not-allowed;
  pointer-events: none;
}

/* ── Tier 2: Composite Delegation ── */


@media (forced-colors: active) {
  .react-aria-Button {
    forced-color-adjust: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .react-aria-Button {
    transition-duration: 0s !important;
  }
}

  .react-aria-Button[data-field-button="XS"] {
    border-radius: var(--catalog-token-radius-sm);
    border-width: 0;
  }

  .react-aria-Button[data-field-button="S"] {
    border-radius: 7px;
    border-width: 0;
  }

  .react-aria-Button[data-field-button="M"] {
    border-radius: 8px;
    border-width: 0;
  }

  .react-aria-Button[data-field-button="L"] {
    border-radius: 9px;
    border-width: 0;
  }

  .react-aria-Button[data-field-button="XL"] {
    border-radius: 10px;
    border-width: 0;
  }


} /* @layer components */`;export{e as default};