# React Aria Starter Upstream Snapshot

This package is the read-only upstream source baseline for Composition's React
Aria Components strategy.

## Policy

- Do not edit files under `src/` or `stories/` for Composition-specific behavior.
- Keep upstream behavior, DOM structure, data attributes, and CSS structure intact.
- Apply Composition-specific behavior through `packages/shared/src/catalog`,
  `packages/shared/src/components`, theme/tokens root collections, runtime
  adapters, or Builder registration metadata.
- Treat local CSS changes in this package as upstream snapshot changes, not product
  customization.
- Do not commit dependency install artifacts such as `node_modules` or
  `.yarn/install-state.gz`.

## Update Flow

1. Replace this snapshot from the upstream React Aria starter source.
2. Record the source version, import date, and any intentional file exclusions.
3. Run a starter inventory diff against the previous snapshot.
4. Update the ADR-142 starter inventory, `design.md`, and affected catalog /
   binding / reusable-document outputs.
5. Verify Panel, Factory, Preview, theme/CSS, and Skia consumers together.

## Snapshot Metadata

- Imported into Composition path: `packages/react-aria-starter`
- Package role: upstream reference snapshot
- Runtime customization owner: `packages/shared/src/catalog`,
  `packages/shared/src/components`, theme/tokens, and Composition adapters
- Upstream source/version: not recorded in this move; record during the first
  formal upstream refresh.
