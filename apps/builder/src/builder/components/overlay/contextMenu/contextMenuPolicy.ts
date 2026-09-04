import { isRulerEventTarget } from "../../../workspace/components/rulerOverlayUtils";

export type ContextMenuDisposition =
  "native" | "suppress" | "suppress-without-menu";

export interface ContextMenuPolicyInput {
  target: EventTarget | null;
  altKey: boolean;
  isDevelopment?: boolean;
}

export function isEditableContextMenuTarget(
  target: EventTarget | null,
): boolean {
  if (typeof Element === "undefined" || !(target instanceof Element)) {
    return false;
  }

  return target.closest('input, textarea, [contenteditable="true"]') !== null;
}

export function resolveContextMenuDisposition({
  target,
  altKey,
  isDevelopment = import.meta.env.DEV,
}: ContextMenuPolicyInput): ContextMenuDisposition {
  if (isEditableContextMenuTarget(target)) {
    return "native";
  }

  if (isDevelopment && altKey) {
    return "native";
  }

  if (isRulerEventTarget(target)) {
    return "suppress-without-menu";
  }

  return "suppress";
}
