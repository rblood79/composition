import { afterEach, expect, it, vi } from "vitest";
import { createUploadQueue } from "./queue";
import type { UploadQueue } from "../types";

const queues: UploadQueue[] = [];
afterEach(() => {
  for (const queue of queues.splice(0)) queue.destroy();
  vi.unstubAllGlobals();
});

it("자동 시작 없는 파일 준비는 전체 큐를 파일마다 재순회하지 않는다", async () => {
  vi.stubGlobal("crypto", {});
  const send = vi.fn(async () => {
    throw new Error("unexpected request");
  });
  const queue = createUploadQueue({
    endpoint: "https://example.invalid/upload",
    autoProceed: false,
    driver: { send },
    storage: { get: () => null, set: () => {}, remove: () => {} },
  });
  queues.push(queue);
  let visits = 0;
  const values = Map.prototype.values;
  const spy = vi.spyOn(Map.prototype, "values").mockImplementation(function* (
    this: Map<unknown, unknown>,
  ) {
    for (const item of values.call(this)) {
      if (
        item &&
        typeof item === "object" &&
        "wanted" in item &&
        "ready" in item
      )
        visits++;
      yield item;
    }
  } as typeof Map.prototype.values);
  try {
    queue.add(
      Array.from(
        { length: 200 },
        (_, i) => new File(["a"], `file-${i}`, { lastModified: 0 }),
      ),
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(send).not.toHaveBeenCalled();
    expect(queue.getItems()).toHaveLength(200);
    expect(
      queue
        .getItems()
        .every((item) => item.fingerprint && item.status === "queued"),
    ).toBe(true);
    expect(visits).toBeLessThanOrEqual(400);
  } finally {
    spy.mockRestore();
  }
});
