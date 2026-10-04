/** Publish 후속 전환까지 보존하는 구 spec API. 공용 실행 구현은 rendering이 소유한다. */
export * from "@composition/rendering";
export { FrameSpec } from "./components/Frame.spec";
export type { FrameProps } from "./components/Frame.spec";
export { GroupSpec } from "./components/Group.spec";
export type { GroupProps } from "./components/Group.spec";
export { SlotSpec } from "./components/Slot.spec";
export type { SlotProps } from "./components/Slot.spec";
export {
  getElementForTag,
  hasSpec,
  getDefaultSizeForTag,
  BASE_TAG_SPEC_MAP,
  TAG_SPEC_MAP,
  LOWERCASE_TAG_SPEC_MAP,
} from "./runtime/tagToElement";
export { resolveContainerStylesFallback } from "./runtime/containerStylesFallback";
