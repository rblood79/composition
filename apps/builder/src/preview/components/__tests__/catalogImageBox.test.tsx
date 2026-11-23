import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CatalogImageBox } from "../../../../../../packages/shared/src/catalog/runtime/imageBox.components";

/**
 * S2 `Image` load states (S2 체크리스트 부록 D.2, 사용자 결정 2026-11-23 「속성 · 런타임」 · 「오류 대체 내용」):
 * loading = skeleton box + transparent `img`, loaded = the `img` shown, error · no source = the Image's own
 * nodes (S2 `renderError`) in place of the `img`. The `img` takes S2's fetch attributes as given.
 */
afterEach(cleanup);

const box = (container: HTMLElement) =>
  container.querySelector(".react-aria-Image") as HTMLElement;

describe("CatalogImageBox — S2 Image load states", () => {
  it("loading → skeleton box and a transparent img with the S2 attributes; load → shown", () => {
    const { container } = render(
      <CatalogImageBox
        className="react-aria-Image"
        imgProps={{
          src: "https://img.example.test/a.png",
          alt: "A",
          loading: "lazy",
          decoding: "async",
          width: 640,
          height: 480,
        }}
      >
        <span className="fallback">no picture</span>
      </CatalogImageBox>,
    );
    const img = container.querySelector("img")!;
    expect(box(container).getAttribute("data-image-state")).toBe("loading");
    expect(box(container).getAttribute("data-skeleton-look")).toBe("box");
    expect(img.style.opacity).toBe("0");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("decoding")).toBe("async");
    expect(img.getAttribute("width")).toBe("640");
    expect(container.querySelector(".fallback")).toBeNull();
    act(() => {
      fireEvent.load(img);
    });
    expect(box(container).getAttribute("data-image-state")).toBe("shown");
    expect(box(container).hasAttribute("data-skeleton-look")).toBe(false);
    expect(img.style.opacity).toBe("1");
  });

  it("error → the Image's own nodes instead of the img (none: the img stays, transparent — S2)", () => {
    const { container } = render(
      <CatalogImageBox
        className="react-aria-Image"
        imgProps={{ src: "https://img.example.test/missing.png", alt: "" }}
      >
        <span className="fallback">no picture</span>
      </CatalogImageBox>,
    );
    act(() => {
      fireEvent.error(container.querySelector("img")!);
    });
    expect(box(container).getAttribute("data-image-state")).toBe("error");
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".fallback")?.textContent).toBe(
      "no picture",
    );
    cleanup();
    const empty = render(
      <CatalogImageBox
        className="react-aria-Image"
        imgProps={{ src: "https://img.example.test/missing.png", alt: "" }}
      />,
    );
    act(() => {
      fireEvent.error(empty.container.querySelector("img")!);
    });
    expect(
      (empty.container.querySelector("img") as HTMLImageElement).style.opacity,
    ).toBe("0");
  });

  it("no source → the Image's own nodes at once (none: the bare img, S2), no skeleton; a source starts loading", () => {
    const { container, rerender } = render(
      <CatalogImageBox className="react-aria-Image" imgProps={{ alt: "" }}>
        <span className="fallback">no picture</span>
      </CatalogImageBox>,
    );
    expect(box(container).getAttribute("data-image-state")).toBe("empty");
    expect(box(container).hasAttribute("data-skeleton-look")).toBe(false);
    expect(container.querySelector(".fallback")).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
    rerender(
      <CatalogImageBox
        className="react-aria-Image"
        imgProps={{ src: "https://img.example.test/b.png", alt: "" }}
      >
        <span className="fallback">no picture</span>
      </CatalogImageBox>,
    );
    expect(box(container).getAttribute("data-image-state")).toBe("loading");
    expect(container.querySelector(".fallback")).toBeNull();
  });
});
