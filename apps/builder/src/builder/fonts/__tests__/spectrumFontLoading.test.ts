import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  faces: new Set<string>(),
  load: vi.fn(),
  warm: vi.fn(),
}));
vi.mock("../../workspace/canvas/skia/fontManager", () => ({
  skiaFontManager: {
    hasFont: (family: string, weight: string, style: string) =>
      state.faces.has(`${family}:${weight}:${style}`),
    loadFont: state.load,
    warmFontMgr: state.warm,
  },
}));
import { loadSpectrumFontsToSkia } from "../loadCustomFontsToSkia";

beforeEach(() => {
  state.faces.clear();
  state.faces.add("adobe-clean-spectrum-vf:400:normal");
  state.warm.mockReset();
  state.load
    .mockReset()
    .mockImplementation(async (family, _url, weight, style) => {
      state.faces.add(`${family}:${weight}:${style}`);
    });
});

afterEach(() => vi.unstubAllGlobals());

it("variable face의 브라우저 검사에는 단일 굵기, 등록에는 원래 범위를 전달한다", async () => {
  const check = vi.fn(() => false);
  const face = { load: vi.fn(async () => {}) };
  const FontFaceMock = vi.fn(function (
    _family: string,
    _source: string,
    _descriptors: FontFaceDescriptors,
  ) {
    return face;
  });
  vi.stubGlobal("FontFace", FontFaceMock);
  vi.stubGlobal("document", { fonts: { check, add: vi.fn() } });
  expect(
    await loadSpectrumFontsToSkia([
      { family: "adobe-clean-spectrum-srf-vf", style: "italic", weight: 700 },
    ]),
  ).toBe(1);
  expect(check).toHaveBeenCalledWith(
    'italic 400 12px "adobe-clean-spectrum-srf-vf"',
  );
  expect(FontFaceMock.mock.calls[0]?.[2]).toEqual({
    weight: "100 1000",
    style: "italic",
  });
});

it("normal이 로드되어도 italic을 별도로 받고 이미 받은 face는 반복하지 않는다", async () => {
  const request = [
    { family: "adobe-clean-spectrum-vf", style: "italic", weight: 700 },
  ];
  expect(await loadSpectrumFontsToSkia(request)).toBe(1);
  expect(state.load.mock.calls[0][3]).toBe("italic");
  expect(await loadSpectrumFontsToSkia(request)).toBe(0);
  expect(state.load).toHaveBeenCalledTimes(1);
});

it("같은 face의 동시 요청은 한 번 받고 필요한 code 굵기를 구분한다", async () => {
  let release!: () => void;
  state.load.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const request = [{ family: "source-code-pro", weight: 700 }];
  const first = loadSpectrumFontsToSkia(request);
  const second = loadSpectrumFontsToSkia(request);
  expect(state.load).toHaveBeenCalledTimes(1);
  release();
  expect(await first).toBe(1);
  expect(await second).toBe(0);
  await loadSpectrumFontsToSkia([{ family: "source-code-pro", weight: 400 }]);
  expect(state.load.mock.calls[1][2]).toBe("400");
});

it("요청하지 않은 S2 face를 받지 않고 실패 후 재시도할 수 있다", async () => {
  expect(
    await loadSpectrumFontsToSkia([{ family: "Inter", style: "italic" }]),
  ).toBe(0);
  state.load.mockRejectedValueOnce(new Error("offline"));
  const request = [{ family: "adobe-clean-spectrum-srf-vf" }];
  await expect(loadSpectrumFontsToSkia(request)).rejects.toThrow("offline");
  expect(await loadSpectrumFontsToSkia(request)).toBe(1);
});
