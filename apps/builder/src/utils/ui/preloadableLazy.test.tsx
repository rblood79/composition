import { Suspense } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { afterEach, describe, expect, it } from "vitest";
import { preloadableLazy } from "./preloadableLazy";

function Content({ label }: { label: string }) {
  return <span>{label}</span>;
}

describe("preloadableLazy", () => {
  let container: HTMLDivElement | null = null;
  afterEach(() => {
    container?.remove();
    container = null;
  });

  const renderSync = (node: React.ReactNode) => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    flushSync(() => root.render(node));
    return root;
  };

  it("preload 가 끝난 뒤 첫 렌더는 Suspense fallback 없이 곧바로 내용을 그린다", async () => {
    const Lazy = preloadableLazy(async () => ({ default: Content }));
    await Lazy.preload();
    const root = renderSync(
      <Suspense fallback={<i>loading</i>}>
        <Lazy label="ready" />
      </Suspense>,
    );
    expect(container!.textContent).toBe("ready");
    root.unmount();
  });

  it("받기 전에 그리면 Suspense 로 기다렸다가 내용을 그린다", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const Lazy = preloadableLazy(async () => {
      await gate;
      return { default: Content };
    });
    const root = renderSync(
      <Suspense fallback={<i>loading</i>}>
        <Lazy label="later" />
      </Suspense>,
    );
    expect(container!.textContent).toBe("loading");
    release();
    await Lazy.preload();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(container!.textContent).toBe("later");
    root.unmount();
  });

  it("로드 실패 뒤 preload 는 다시 시도한다", async () => {
    let calls = 0;
    const Lazy = preloadableLazy(async () => {
      calls += 1;
      if (calls === 1) throw new Error("offline");
      return { default: Content };
    });
    await expect(Lazy.preload()).rejects.toThrow("offline");
    await Lazy.preload();
    expect(calls).toBe(2);
  });
});
