# Shared Components Legacy Boundary

`packages/shared/src/components/legacy` is a compatibility-only boundary for
pre-ADR-142 component implementations.

Allowed uses:

- Import/export, publish, and migration compatibility adapters.
- Regression fixtures that explicitly exercise legacy payload behavior.
- Temporary family cutover fallbacks with a documented ADR-142 gate reason.

Disallowed uses:

- active Builder authoring imports.
- new Component Panel, Factory, Preview, or Publish runtime paths.
- new component registrations or reusable component definitions.
- runtime imports from `packages/react-aria-starter/src`.

Active ADR-142 component authoring must go through `packages/shared/src/catalog`
and the primitive wrapper surface in `packages/shared/src/components`, or through
catalog reusable canonical documents for composed components.
