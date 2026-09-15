import { fillContract } from "../compiler/fillContract";
import {
  createDefaultFill,
  type FillItem,
} from "../../../types/builder/fill.types";

/** wire의 생략값은 기존 factory로 채우고 canonical fills 1차 필드로 전달한다. */
export function normalizeToolFills(raw: unknown): FillItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((value) => {
    const fill = fillContract.parse(value);
    return { ...createDefaultFill(fill.type), ...fill } as FillItem;
  });
}
