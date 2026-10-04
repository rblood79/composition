/** Slot picker의 catalog primitive 항목. 생성은 catalog commands가 소유한다. */
export const SLOT_FILL_PRIMITIVE_TYPES: readonly string[] = [
  "Text",
  "Image",
  "Icon",
  "Separator",
  "frame",
];

const PRIMITIVE_SET: ReadonlySet<string> = new Set(SLOT_FILL_PRIMITIVE_TYPES);

export function isSlotFillPrimitiveType(type: string): boolean {
  return PRIMITIVE_SET.has(type);
}

export function slotFillPrimitiveLabel(type: string): string {
  return type === "frame" ? "Frame" : type;
}
