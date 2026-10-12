import { describe, expect, it, vi } from "vitest";
import {
  FileUploadInbox,
  FileUploadModuleResource,
} from "../fileUploadResources";

describe("FileUpload module and intake ownership", () => {
  it("starts one import for concurrent intake and publishes readiness", async () => {
    let complete!: (value: { ready: true }) => void;
    const loader = vi.fn(
      () =>
        new Promise<{ ready: true }>((resolve) => {
          complete = resolve;
        }),
    );
    const source = new FileUploadModuleResource(loader);
    const statuses: string[] = [];
    const release = source.subscribe(() =>
      statuses.push(source.getSnapshot().status),
    );
    source.load();
    source.load();
    expect(loader).toHaveBeenCalledTimes(1);
    complete({ ready: true });
    await Promise.resolve();
    expect(statuses).toEqual(["loading", "ready"]);
    release();
  });

  it("turns a rejected import into the unavailable snapshot without retrying on rerender", async () => {
    const loader = vi.fn(() => Promise.reject(new Error("chunk unavailable")));
    const source = new FileUploadModuleResource(loader);
    source.load();
    await Promise.resolve();
    expect(source.getSnapshot()).toEqual({ status: "unavailable" });
    source.load();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("reports synchronous loader failure as unavailable", () => {
    const source = new FileUploadModuleResource(() => {
      throw new Error("loader failed");
    });
    expect(() => source.load()).not.toThrow();
    expect(source.getSnapshot()).toEqual({ status: "unavailable" });
  });

  it("drains rejected intake so a later endpoint change cannot send old files", () => {
    const inbox = new FileUploadInbox();
    const first = { name: "rejected.txt" } as File;
    const next = { name: "new.txt" } as File;
    const empty = inbox.getSnapshot();
    inbox.add([first]);
    inbox.drain();
    const drained = inbox.getSnapshot();
    expect(drained).toEqual([]);
    expect(empty).toEqual([]);
    inbox.drain();
    expect(inbox.getSnapshot()).toBe(drained);
    inbox.add([next]);
    expect(inbox.getSnapshot()).toEqual([next]);
  });
});
