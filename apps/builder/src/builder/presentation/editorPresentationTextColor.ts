/**
 * ADR-187 Phase 5 text color presentation capability.
 *
 * The current materialization proof covers only standalone Text and Button.
 * Shell/container roots, indicator-only primitives, and types with conditional
 * or delegated text remain canonical-only until each has its own target
 * fixture. Multi-child inherited subtrees remain canonical-only until their
 * descendant projection is materialized as one explicit lane.
 */
const TEXT_COLOR_PRESENTATION_TYPES = new Set(["Button", "Text"]);

export function isTextColorPresentationType(type: string): boolean {
  return TEXT_COLOR_PRESENTATION_TYPES.has(type);
}
