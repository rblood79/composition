import { afterEach, describe, expect, it } from "vitest";
import {
  readRuntimeErrors,
  recordRuntimeError,
  resetRuntimeErrorLog,
  RUNTIME_ERROR_LOG_LIMIT,
} from "./runtimeErrorLog";

afterEach(() => resetRuntimeErrorLog());

describe("runtimeErrorLog", () => {
  it("uncaught error 와 unhandled rejection 을 같은 목록에 순서대로 남긴다", () => {
    recordRuntimeError("error", new TypeError("x is undefined"));
    recordRuntimeError("unhandledrejection", "network down");

    const entries = readRuntimeErrors();
    expect(entries.map((e) => [e.kind, e.message])).toEqual([
      ["error", "TypeError: x is undefined"],
      ["unhandledrejection", "network down"],
    ]);
    expect(entries[0].stack).toContain("TypeError");
  });

  it("상한을 넘으면 오래된 것부터 버리고 버린 개수를 센다", () => {
    for (let i = 0; i < RUNTIME_ERROR_LOG_LIMIT + 3; i++) {
      recordRuntimeError("error", new Error(`e${i}`));
    }
    const entries = readRuntimeErrors();
    expect(entries).toHaveLength(RUNTIME_ERROR_LOG_LIMIT);
    expect(entries[0].message).toBe("Error: e3");
    expect(entries[0].seq).toBe(3);
  });

  it("stack 은 앞 8줄까지만 보관한다", () => {
    const error = new Error("deep");
    error.stack = [
      "Error: deep",
      ...Array.from({ length: 20 }, (_, i) => `    at f${i}`),
    ].join("\n");
    recordRuntimeError("error", error);
    expect(readRuntimeErrors()[0].stack?.split("\n")).toHaveLength(8);
  });
});
