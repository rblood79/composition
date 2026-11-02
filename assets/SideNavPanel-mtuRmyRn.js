var e=`/* ============================================================
 * AUTO-GENERATED from catalog SideNavPanel — DO NOT EDIT MANUALLY
 * Source: packages/shared/src/catalog/generated/componentRulesTable.ts
 * Archetype: container
 * ============================================================ */

@layer components {

.react-aria-SideNavPanel {
  /* Base styles — archetype: container */
    display: block;
    box-sizing: border-box;
    font-family: var(--font-sans);

  /* Container styles (ADR-071 + ADR-083 Phase 1) */
  min-height: 0px;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  /* Default variant */
  background: transparent;
  color: var(--fg);
  border: none;

  /* Default size */
  height: auto;
  padding: 0px 0px;
  font-size: var(--catalog-token-text-sm);
  border-radius: var(--catalog-token-radius-none);
}

.react-aria-SideNavPanel:where([data-variant="default"]) {
  background: transparent;
  color: var(--fg);
}

.react-aria-SideNavPanel.react-aria-SideNavPanel:where(:is([data-side-panel-collapsed], [data-side-panel-collapsed] *)) {
  width: 42px;
}

.react-aria-SideNavPanel.react-aria-SideNavPanel .react-aria-SideNavItem .react-aria-Text:where(:is([data-side-panel-collapsed], [data-side-panel-collapsed] *)) {
  display: none;
}

.react-aria-SideNavPanel.react-aria-SideNavPanel .react-aria-SideNavItem .react-aria-Button[slot="chevron"]:where(:is([data-side-panel-collapsed], [data-side-panel-collapsed] *)) {
  display: none;
}

.react-aria-SideNavPanel.react-aria-SideNavPanel .react-aria-SideNavHeader:where(:is([data-side-panel-collapsed], [data-side-panel-collapsed] *)) {
  display: none;
}

.react-aria-SideNavPanel.react-aria-SideNavPanel .react-aria-SideNavItem:where(:is([data-side-panel-collapsed], [data-side-panel-collapsed] *)) {
  padding-inline-end: 0px;
}

.react-aria-SideNavPanel.react-aria-SideNavPanel .react-aria-SideNavItem .react-aria-Icon:where(:is([data-side-panel-collapsed], [data-side-panel-collapsed] *)) {
  margin-inline-end: 0px;
}

/* ── Tier 2: Composite Delegation ── */


@media (forced-colors: active) {
  .react-aria-SideNavPanel {
    forced-color-adjust: auto;
  }
}


  .react-aria-SideNavPanel > .react-aria-SideNav {
    flex-grow: 1;
    flex-shrink: 1;
    min-width: 0px;
  }

  .react-aria-SideNavPanel > .react-aria-Button[slot="collapse"] {
    margin: 4px;
    align-self: flex-start;
    flex-shrink: 0;
  }


  .react-aria-SideNavPanel {
    transition: width 200ms;
  }


} /* @layer components */`;export{e as default};