import { describe, expect, it, vi } from "vitest";
import { CatalogPreviewToastBridge } from "../runtime/toastBridge";

describe("Preview toast consumer lifecycle", () => {
  it("an old consumer cleanup keeps the replacement connected", () => {
    const toast = new CatalogPreviewToastBridge();
    const old = vi.fn();
    const current = vi.fn();
    const releaseOld = toast.connect(old);
    const releaseCurrent = toast.connect(current);
    releaseOld();
    toast.show("current");
    expect(old).not.toHaveBeenCalled();
    expect(current).toHaveBeenCalledWith("current");
    releaseCurrent();
    toast.show("unmounted");
    expect(current).toHaveBeenCalledTimes(1);
  });
});
