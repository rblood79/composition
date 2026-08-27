// @vitest-environment node
/**
 * ADR-195 Phase 1 — command registry 게시/해제/우선순위 계약.
 *
 * 키보드는 리스너마다 각자 발화하므로 중복 id(`escape`·`detachInstance`)가 둘 다
 * 돌지만, 팔레트는 하나만 부를 수 있다. 그 하나를 고르는 규칙(priority 내림차순
 * → seq 내림차순)을 여기서 잠근다.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  getCommandRegistrySnapshot,
  registerCommand,
  resetCommandRegistry,
  resolveCommand,
  subscribeCommandRegistry,
} from "./commandRegistry";

const base = {
  handler: () => {},
  scope: "canvas-focused" as const,
  priority: 70,
  allowInInput: false,
  disabled: false,
};

beforeEach(() => {
  resetCommandRegistry();
});

describe("commandRegistry", () => {
  it("게시한 명령을 id 로 조회하고, 해제하면 사라진다", () => {
    const handler = () => {};
    const unregister = registerCommand({ ...base, id: "duplicate", handler });

    const entry = resolveCommand("duplicate");
    expect(entry?.handler).toBe(handler);
    expect(entry?.scope).toBe("canvas-focused");
    expect(entry?.priority).toBe(70);

    unregister();
    expect(resolveCommand("duplicate")).toBeUndefined();
    expect(getCommandRegistrySnapshot().has("duplicate")).toBe(false);
  });

  it("중복 id 는 우선순위가 높은 쪽, 동률이면 나중 등록이 이긴다", () => {
    const first = () => {};
    const second = () => {};
    registerCommand({ ...base, id: "escape", handler: first });
    registerCommand({ ...base, id: "escape", handler: second });

    expect(resolveCommand("escape")?.handler).toBe(second);

    const higher = () => {};
    registerCommand({
      ...base,
      id: "escape",
      handler: higher,
      priority: 100,
    });
    expect(resolveCommand("escape")?.handler).toBe(higher);
  });

  it("중복 id 하나를 해제해도 나머지가 남는다", () => {
    const first = () => {};
    const second = () => {};
    registerCommand({ ...base, id: "detachInstance", handler: first });
    const unregisterSecond = registerCommand({
      ...base,
      id: "detachInstance",
      handler: second,
    });

    unregisterSecond();
    expect(resolveCommand("detachInstance")?.handler).toBe(first);
  });

  it("재등록은 seq 가 갱신돼 stale 핸들러가 남지 않는다", () => {
    const stale = () => {};
    const fresh = () => {};
    const unregister = registerCommand({
      ...base,
      id: "group",
      handler: stale,
    });
    unregister();
    registerCommand({ ...base, id: "group", handler: fresh });

    expect(resolveCommand("group")?.handler).toBe(fresh);
    expect(getCommandRegistrySnapshot().get("group")).toHaveLength(1);
  });

  it("게시/해제가 구독자에게 알려진다", () => {
    let notified = 0;
    const unsubscribe = subscribeCommandRegistry(() => {
      notified += 1;
    });

    const unregister = registerCommand({ ...base, id: "selectAll" });
    expect(notified).toBe(1);
    unregister();
    expect(notified).toBe(2);

    unsubscribe();
    registerCommand({ ...base, id: "selectAll" });
    expect(notified).toBe(2);
  });
});
