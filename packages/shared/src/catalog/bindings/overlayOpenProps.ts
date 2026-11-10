import type { PropContract } from "../types";

/** 기본값 false를 주입하지 않는다: trigger context와 defaultOpen을 가리지 않게 한다. */
export const OVERLAY_OPEN_PROPS: Record<string, PropContract> = {
  isOpen: { kind: "boolean", label: "Open", section: "state" },
  defaultOpen: { kind: "boolean", label: "Initially open", section: "state" },
};
