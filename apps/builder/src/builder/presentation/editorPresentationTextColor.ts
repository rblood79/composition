/**
 * ADR-187 Phase 5 text color presentation capability.
 *
 * Only nodes whose own Skia materialization contains text targets may enter
 * this paint lane. Multi-child inherited subtrees remain canonical-only until
 * their descendant target projection is materialized as one explicit lane.
 */
const TEXT_COLOR_PRESENTATION_TYPES = new Set(["Button", "Text"]);

export function isTextColorPresentationType(type: string): boolean {
  return TEXT_COLOR_PRESENTATION_TYPES.has(type);
}
