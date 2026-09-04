import { getDefaultProps } from "../../../types/builder/unified.types";
import { generateCustomId } from "../../utils/idGeneration";
import { withFrameElementMirrorId } from "../../../adapters/canonical/frameMirror";
import type { useStore } from "../../stores";

export type AddElementInput = Parameters<
  ReturnType<typeof useStore.getState>["addElement"]
>[0];
export type CustomIdElements = Parameters<typeof generateCustomId>[1];

export const BUTTON_CHILD_HOST_TAGS: ReadonlySet<string> = new Set([
  "Button",
  "ToggleButton",
]);

export function findFirstIconChild<
  T extends { id: string; type: string; deleted?: boolean },
>(children: ReadonlyArray<T>): T | undefined {
  return children.find((child) => child.type === "Icon" && !child.deleted);
}

export function findFirstTextChild<
  T extends { id: string; type: string; deleted?: boolean },
>(children: ReadonlyArray<T>): T | undefined {
  return children.find((child) => child.type === "Text" && !child.deleted);
}

export function buildButtonChild(
  type: "Icon" | "Text",
  parentId: string,
  pageId: string,
  pageElements: CustomIdElements,
  propsOverride: Record<string, unknown>,
): AddElementInput {
  return withFrameElementMirrorId(
    {
      id: crypto.randomUUID(),
      type,
      customId: generateCustomId(type, pageElements),
      props: { ...getDefaultProps(type), ...propsOverride },
      page_id: pageId,
      parent_id: parentId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as AddElementInput,
    null,
  );
}
