import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { cascadeLayerOrderTag, readCascadeLayerOrder } from "./cascadeLayerOrder";

const indexCss = readFileSync(resolve(__dirname, "index.css"), "utf8");

describe("cascade layer 순서 — Builder index.html 머리", () => {
  it("index.css 의 순서 선언을 그대로 읽는다 (목록 사본 없음)", () => {
    expect(readCascadeLayerOrder(indexCss)).toBe(
      "@layer theme, dashboard, base, preview-system, components, shared-tokens, builder-system, utilities;",
    );
  });

  // production 빌드는 공용 CSS chunk (LoadingSpinner · overlay · EmptyState …) 를 main CSS 보다 먼저
  // <link> 한다. 그 chunk 의 `@layer builder-system{…}` 가 레이어를 먼저 등록하면 index.css 의
  // 선언이 늦어 base (Tailwind 리셋) 가 builder-system 을 이긴다 — 순서 선언이 어떤 <link> 보다
  // 앞에 와야 한다.
  it("head 맨 앞 style 로 넣는다", () => {
    expect(cascadeLayerOrderTag(indexCss)).toEqual({
      tag: "style",
      attrs: { "data-cascade-layer-order": "" },
      children: readCascadeLayerOrder(indexCss),
      injectTo: "head-prepend",
    });
  });

  it("선언이 없으면 빌드를 멈춘다", () => {
    expect(() => readCascadeLayerOrder("@import 'x';")).toThrow(/@layer/);
  });
});
