import { beforeEach, describe, expect, it, vi } from "vitest";

const notifyEditRefusal = vi.fn<(error: unknown) => boolean>();
vi.mock("../operationNotice", () => ({
  notifyEditRefusal: (error: unknown) => notifyEditRefusal(error),
}));
const showToast = vi.fn();
vi.mock("../../stores/toast", () => ({
  useToastStore: { getState: () => ({ showToast }) },
}));

import { runBuiltCatalogCommand, runCatalogCommand } from "../commandRunner";
import type { CatalogWorkspace } from "../workspace";
import type { CatalogCommand } from "../../../../../../packages/shared/src/catalog/commands/compose";

const command = (() => {
  throw new Error("not planned in this test");
}) as unknown as CatalogCommand;

function workspaceThat(execute: (command: CatalogCommand) => void) {
  return { execute: vi.fn(execute) } as unknown as CatalogWorkspace & {
    execute: ReturnType<typeof vi.fn>;
  };
}

/**
 * The one way a panel runs a command (`catalogRuntime/commandRunner.ts`): a refusal shows its
 * reason, anything else an error toast — a panel that called `workspace.execute` itself used to
 * show the refusal as a raw error toast (PropFollow · RacSlot · ShowWhen) or throw out of the event
 * handler (Themes · Settings).
 */
describe("runCatalogCommand", () => {
  beforeEach(() => {
    notifyEditRefusal.mockReset();
    showToast.mockReset();
  });

  it("runs the command and reports success", () => {
    const workspace = workspaceThat(() => {});
    expect(runCatalogCommand(workspace, command)).toBe(true);
    expect(workspace.execute).toHaveBeenCalledWith(command);
    expect(notifyEditRefusal).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("a refusal shows its notice, not an error toast", () => {
    const refusal = new Error("NESTING_NOT_ALLOWED: Text>Page");
    notifyEditRefusal.mockReturnValue(true);
    const workspace = workspaceThat(() => {
      throw refusal;
    });
    expect(runCatalogCommand(workspace, command)).toBe(false);
    expect(notifyEditRefusal).toHaveBeenCalledWith(refusal);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("another failure is an error toast with its message", () => {
    notifyEditRefusal.mockReturnValue(false);
    const workspace = workspaceThat(() => {
      throw new Error("boom");
    });
    expect(runCatalogCommand(workspace, command)).toBe(false);
    expect(showToast).toHaveBeenCalledWith("error", "boom");
  });

  it("a command that fails while being built reports the same way", () => {
    notifyEditRefusal.mockReturnValue(false);
    const workspace = workspaceThat(() => {});
    const ran = runBuiltCatalogCommand(workspace, () => {
      throw new Error("bad value");
    });
    expect(ran).toBe(false);
    expect(workspace.execute).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("error", "bad value");
  });

  it("nothing to write runs nothing", () => {
    const workspace = workspaceThat(() => {});
    expect(runBuiltCatalogCommand(workspace, () => undefined)).toBe(false);
    expect(workspace.execute).not.toHaveBeenCalled();
  });
});
