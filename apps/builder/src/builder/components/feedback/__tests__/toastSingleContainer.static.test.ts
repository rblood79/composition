/**
 * 빌더 토스트 단일 컨테이너 계약.
 *
 * Why: `ToastContainer` 는 전역 store 를 그린다. 두 곳이 마운트하면 같은 토스트가 두 번
 * 뜬다 (2026-09-08 live 재현 — 컨테이너 2 · 토스트 4 · 랜드마크 2).
 * 렌더 지점은 BuilderCore 하나, 발신은 store 하나다. 로컬 훅 경로는 삭제됐다.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "../../../..");
const read = (rel: string): string => readFileSync(join(SRC, rel), "utf8");

describe("builder toast — 단일 컨테이너 · 단일 store", () => {
  it("ToastContainer 를 마운트하는 컴포넌트는 BuilderCore 하나다", () => {
    expect(read("builder/main/BuilderCore.tsx")).toContain(
      "<ToastContainer />",
    );
  });

  it("로컬 훅 경로는 없다 — 발신은 useToastStore 뿐", () => {
    expect(existsSync(join(SRC, "builder/hooks/useToast.ts"))).toBe(false);
    expect(read("builder/hooks/index.ts")).not.toMatch(/useToast\b/);
    expect(read("builder/main/BuilderCore.tsx")).toContain(
      "useToastStore((state) => state.showToast)",
    );
  });

  it("컨테이너는 props 없이 store 만 읽는다", () => {
    const src = read("builder/components/feedback/ToastContainer.tsx");
    expect(src).toContain("export function ToastContainer()");
    expect(src).not.toContain("hookToasts");
  });
});
