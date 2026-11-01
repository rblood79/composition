var e=`/* ============================================================
 * AUTO-GENERATED from catalog Radio — DO NOT EDIT MANUALLY
 * Source: packages/shared/src/catalog/generated/componentRulesTable.ts
 * Archetype: toggle-indicator
 * ============================================================ */

@layer components {

.react-aria-Radio {
  /* Base styles — archetype: toggle-indicator */
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    box-sizing: border-box;
    user-select: none;

  /* Container styles (ADR-071 + ADR-083 Phase 1) */
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;

  /* Default variant */
  color: var(--fg);
  border: none;

  /* Default size */
  height: auto;
  padding: 0px 0px;
  font-size: var(--catalog-token-text-sm);
  border-radius: var(--catalog-token-radius-none);
  gap: var(--catalog-token-radio-gap-M, calc(var(--catalog-token-text-sm) * 10 / 14));
}

.react-aria-Radio:where([data-variant="default"]) {
  color: var(--fg);
}

.react-aria-Radio:where([data-variant="emphasized"]) {
  color: var(--fg);
}

.react-aria-Radio[data-size="S"] {
  height: auto;
  padding: 0px 0px;
  font-size: var(--catalog-token-text-xs);
  border-radius: var(--catalog-token-radius-none);
  gap: var(--catalog-token-radio-gap-S, calc(var(--catalog-token-text-xs) * 10 / 14));
}

.react-aria-Radio[data-size="M"] {
  height: auto;
  padding: 0px 0px;
  font-size: var(--catalog-token-text-sm);
  border-radius: var(--catalog-token-radius-none);
  gap: var(--catalog-token-radio-gap-M, calc(var(--catalog-token-text-sm) * 10 / 14));
}

.react-aria-Radio[data-size="L"] {
  height: auto;
  padding: 0px 0px;
  font-size: var(--catalog-token-text-base);
  border-radius: var(--catalog-token-radius-none);
  gap: var(--catalog-token-radio-gap-L, calc(var(--catalog-token-text-base) * 10 / 14));
}

.react-aria-Radio[data-size="XL"] {
  height: auto;
  padding: 0px 0px;
  font-size: var(--catalog-token-text-lg);
  border-radius: var(--catalog-token-radius-none);
  gap: var(--catalog-token-radio-gap-XL, calc(var(--catalog-token-text-lg) * 10 / 14));
}

.react-aria-Radio.react-aria-Radio:where([data-focus-visible]) {
  outline: var(--focus-ring-width) solid var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}

.react-aria-Radio.react-aria-Radio:where([data-disabled]) {
  opacity: 0.38;
  cursor: not-allowed;
  pointer-events: none;
}

.react-aria-Radio.react-aria-Radio .react-aria-RadioButton:where([data-selected]) .indicator {
  border-color: var(--radio-color);
}

.react-aria-Radio.react-aria-Radio .react-aria-RadioButton:where([data-invalid]) .indicator {
  border-color: var(--negative);
}

.react-aria-Radio.react-aria-Radio .react-aria-RadioButton:where([data-disabled]) .indicator {
  border-color: var(--border-disabled);
}

.react-aria-Radio.react-aria-Radio .react-aria-RadioButton:where([data-disabled][data-invalid][data-selected]) .indicator {
  border-color: var(--negative);
}

.react-aria-Radio.react-aria-Radio .react-aria-RadioButton:where([data-pressed]) .indicator {
  border-color: var(--border-hover);
}

.react-aria-Radio.react-aria-Radio .react-aria-RadioButton:where([data-pressed][data-selected]) .indicator {
  border-color: color-mix(in srgb, var(--radio-color) 75%, black);
}

.react-aria-Radio.react-aria-Radio .react-aria-RadioButton .indicator {
  background: var(--bg);
}

.react-aria-Radio.react-aria-Radio .react-aria-RadioButton:where([data-focus-visible]) .indicator {
  outline: 2px solid var(--radio-color);
  outline-offset: 2px;
}

/* ── Tier 2: Composite Delegation ── */

.react-aria-Radio[data-size="S"] {
  --radio-button-gap: var(--catalog-token-radio-gap-S, calc(var(--catalog-token-text-xs) * 10 / 14));
}

.react-aria-Radio[data-size="M"] {
  --radio-button-gap: var(--catalog-token-radio-gap-M, calc(var(--catalog-token-text-sm) * 10 / 14));
}

.react-aria-Radio[data-size="L"] {
  --radio-button-gap: var(--catalog-token-radio-gap-L, calc(var(--catalog-token-text-base) * 10 / 14));
}

.react-aria-Radio[data-size="XL"] {
  --radio-button-gap: var(--catalog-token-radio-gap-XL, calc(var(--catalog-token-text-lg) * 10 / 14));
}


@media (forced-colors: active) {
  .react-aria-Radio {
    forced-color-adjust: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .react-aria-Radio {
    transition-duration: 0s !important;
  }
}

  .react-aria-Radio .react-aria-RadioButton {
    display: inline-flex;
    align-items: center;
    gap: var(--radio-button-gap);
  }

  .react-aria-Radio .react-aria-RadioButton[data-focus-visible] {
    outline: var(--focus-ring-width) solid var(--focus-ring);
    outline-offset: var(--focus-ring-offset);
  }


  .react-aria-Radio[data-size="S"] .react-aria-RadioButton .indicator {
    width: var(--catalog-token-size-height-sm-S);
    height: var(--catalog-token-size-height-sm-S);
    border-radius: 9999px;
  }

  .react-aria-Radio[data-size="S"][data-selected] .react-aria-RadioButton .indicator {
    border-width: calc((var(--catalog-token-size-height-sm-S) - 4px) / 2);
  }

  .react-aria-Radio[data-size="M"] .react-aria-RadioButton .indicator {
    width: var(--catalog-token-size-height-sm-M);
    height: var(--catalog-token-size-height-sm-M);
    border-radius: 9999px;
  }

  .react-aria-Radio[data-size="M"][data-selected] .react-aria-RadioButton .indicator {
    border-width: calc((var(--catalog-token-size-height-sm-M) - 4px) / 2);
  }

  .react-aria-Radio[data-size="L"] .react-aria-RadioButton .indicator {
    width: var(--catalog-token-size-height-sm-L);
    height: var(--catalog-token-size-height-sm-L);
    border-radius: 9999px;
  }

  .react-aria-Radio[data-size="L"][data-selected] .react-aria-RadioButton .indicator {
    border-width: calc((var(--catalog-token-size-height-sm-L) - 4px) / 2);
  }

  .react-aria-Radio[data-size="XL"] .react-aria-RadioButton .indicator {
    width: var(--catalog-token-size-height-sm-XL);
    height: var(--catalog-token-size-height-sm-XL);
    border-radius: 9999px;
  }

  .react-aria-Radio[data-size="XL"][data-selected] .react-aria-RadioButton .indicator {
    border-width: calc((var(--catalog-token-size-height-sm-XL) - 4px) / 2);
  }


} /* @layer components */`;export{e as default};