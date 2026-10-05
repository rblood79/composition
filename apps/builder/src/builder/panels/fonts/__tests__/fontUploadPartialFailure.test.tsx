import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";
import { FONT_REGISTRY_STORAGE_KEY } from "../../../fonts/customFonts";
import { useFontRegistry } from "../useFontRegistry";

vi.mock("../../../fonts/customFonts", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../fonts/customFonts")>();
  return {
    ...actual,
    createFontFaceFromFile: vi.fn(async (file: File) => {
      if (file.name.startsWith("bad")) throw new Error("UNREADABLE");
      return {
        id: `face-${file.name}`,
        family: file.name.replace(/\..*$/, ""),
        weight: "400",
        style: "normal",
        source: { type: "remote-url" as const, url: `https://fonts.test/${file.name}` },
        createdAt: "2026-10-05T00:00:00Z",
        updatedAt: "2026-10-05T00:00:00Z",
      };
    }),
  };
});

/**
 * 2026-10-05 감사 LOW — 여러 파일을 올릴 때 하나가 읽기 실패해도 나머지는 등록되고, upload 는
 * reject 하지 않는다 (호출부 FontUploadZone 이 promise 를 받지 않아 unhandled rejection 이었다).
 */
afterEach(() => localStorage.clear());

const files = (...names: string[]) => {
  const list = names.map((name) => new File(["x"], name, { type: "font/woff2" }));
  return Object.assign(list, { item: (i: number) => list[i] }) as unknown as FileList;
};

describe("useFontRegistry.upload — 일부 실패", () => {
  it("실패한 파일만 건너뛰고 나머지를 저장한다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useFontRegistry(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <I18nProvider initialLocale="en-US">{children}</I18nProvider>
      ),
    });
    await act(async () => {
      await expect(
        result.current.upload(files("One.woff2", "bad.woff2", "Two.woff2")),
      ).resolves.toBeUndefined();
    });
    expect(result.current.registry.faces.map((face) => face.family)).toEqual([
      "One",
      "Two",
    ]);
    expect(localStorage.getItem(FONT_REGISTRY_STORAGE_KEY)).toContain("Two");
    warn.mockRestore();
  });
});
