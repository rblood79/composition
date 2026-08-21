import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Tree as AriaTree } from "react-aria-components";
import { describe, expect, it } from "vitest";

import { Tree, TreeItem } from "../Tree";

const TREE_STYLE_MARKER = 'data-composition-tree="true"';

function renderPublicTree(props: { isLoading?: boolean } = {}): string {
  return renderToStaticMarkup(
    <Tree
      aria-label="Files"
      className="consumer-tree"
      isLoading={props.isLoading}
    >
      <TreeItem id="file-1" title="File 1" showInfoButton={false} />
    </Tree>,
  );
}

function selectorPreludesContaining(css: string, needle: string): string[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const selectors: string[] = [];
  let index = source.indexOf(needle);

  while (index >= 0) {
    const selectorEnd = source.indexOf("{", index);
    const selectorStart =
      Math.max(source.lastIndexOf("{", index), source.lastIndexOf("}", index)) +
      1;

    if (selectorEnd >= 0) {
      selectors.push(source.slice(selectorStart, selectorEnd).trim());
    }
    index = source.indexOf(needle, index + needle.length);
  }

  return selectors;
}

describe("Tree public style scope", () => {
  it("public Tree root만 style marker를 발행하고 consumer class를 보존한다", () => {
    const html = renderPublicTree();

    expect(html).toContain(TREE_STYLE_MARKER);
    expect(html).toMatch(/class="[^"]*react-aria-Tree[^"]*consumer-tree/);
  });

  it("loading skeleton 경로도 동일한 style marker를 발행한다", () => {
    expect(renderPublicTree({ isLoading: true })).toContain(TREE_STYLE_MARKER);
  });

  it("raw React Aria Tree는 public Tree style scope에 자동 편입되지 않는다", () => {
    const html = renderToStaticMarkup(
      <AriaTree aria-label="Authoring tree">{[]}</AriaTree>,
    );

    expect(html).not.toContain("data-composition-tree");
  });

  it("Tree.css의 모든 Tree/TreeItem selector가 public marker 아래에 격리된다", async () => {
    const css = await readFile(
      new URL("../styles/Tree.css", import.meta.url),
      "utf-8",
    );
    const selectors = selectorPreludesContaining(css, ".react-aria-Tree");

    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      expect(selector, selector).toContain("data-composition-tree");
    }
    expect(css).toContain(
      ":where(.react-aria-Tree[data-composition-tree]) .react-aria-TreeItem",
    );
  });
});
