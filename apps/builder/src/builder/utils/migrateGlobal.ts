/**
 * Dev-time migration helpers exposed on `window.__composition_MIGRATE__`.
 *
 * Side-effect import — attaches global handlers for DevTools-driven
 * one-shot data repair. Dev builds only; production no-op.
 *
 * Element sibling order is canonical `children[]` only. No dev-time
 * order-number repair handlers are exposed.
 */

if (import.meta.env.DEV && typeof window !== "undefined") {
  const w = window as unknown as {
    __composition_MIGRATE__?: Record<string, never>;
  };
  w.__composition_MIGRATE__ = {};
}
