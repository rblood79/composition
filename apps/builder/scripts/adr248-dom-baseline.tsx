#!/usr/bin/env node
/** ADR-248 G0: isolated old DOM renderer oracle. Does not open Preview/Compare. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PreviewElement, RenderContext } from "@composition/shared";
import {
  renderGroup,
  renderSlot,
} from "../../../packages/shared/src/renderers/LayoutRenderers";

const root = resolve(import.meta.dirname, "../../..");
// tsx's standalone loader compiles workspace TSX with classic JSX; app/Vitest use react-jsx.
(globalThis as typeof globalThis & { React: typeof React }).React = React;
const outIndex = process.argv.indexOf("--out");
if (outIndex >= 0 && !process.argv[outIndex + 1])
  throw new Error("--out requires path");
const out = resolve(
  outIndex >= 0
    ? process.argv[outIndex + 1]
    : "/private/tmp/adr248-dom-baseline.json",
);
const scenario = {
  id: "adr248-native-dom-unit-v1",
  seed: 248,
  surface: "isolated-dom-unit",
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  cases: [
    "Group horizontal role/disabled",
    "Group vertical role/disabled",
    "Slot empty required two-line description",
    "Slot filled page content",
  ],
};
const sha256 = (input: string) =>
  createHash("sha256").update(input).digest("hex");
const groupCssPath = resolve(
  root,
  "packages/shared/src/components/styles/Group.css",
);
const slotCssPath = resolve(
  root,
  "packages/shared/src/components/styles/generated/Slot.css",
);
const group: PreviewElement = {
  id: "group-1",
  customId: "example-group",
  type: "Group",
  props: {
    label: "Example group",
    "aria-label": "Example group",
    role: "group",
    isDisabled: true,
  },
};
const slot: PreviewElement = {
  id: "slot-content",
  type: "Slot",
  props: {
    name: "content",
    required: true,
    description: "첫째 줄\n둘째 줄",
  },
};
const child: PreviewElement = {
  id: "filled-text",
  type: "Text",
  props: { children: "채운 내용" },
};
function context(
  host: PreviewElement,
  children: PreviewElement[],
  editMode: RenderContext["editMode"],
): RenderContext {
  return {
    elements: [host, ...children],
    elementsById: new Map([
      [host.id, host],
      ...children.map((item) => [item.id, item] as const),
    ]),
    childrenByParent: new Map([[host.id, children]]),
    updateElementProps: () => {},
    batchUpdateElementProps: () => {},
    setElements: () => {},
    renderElement: (element) =>
      createElement(
        "span",
        { key: element.id, "data-element-id": element.id },
        String(element.props.children ?? ""),
      ),
    editMode,
  };
}
const renderHtml = (node: ReturnType<typeof renderGroup>) =>
  renderToStaticMarkup(createElement("div", null, node));
const horizontal = renderHtml(
  renderGroup(
    { ...group, props: { ...group.props, orientation: "horizontal" } },
    context(group, [], "layout"),
  ),
);
const vertical = renderHtml(
  renderGroup(
    { ...group, props: { ...group.props, orientation: "vertical" } },
    context(group, [], "layout"),
  ),
);
const empty = renderHtml(renderSlot(slot, context(slot, [], "layout")));
const filled = renderHtml(renderSlot(slot, context(slot, [child], "page")));
if (
  !horizontal.includes('role="group"') ||
  !horizontal.includes("react-aria-Group")
)
  throw new Error(`Group DOM baseline invalid: ${horizontal}`);
if (
  !empty.includes("react-aria-Slot-placeholder") ||
  !empty.includes("첫째 줄\n둘째 줄")
)
  throw new Error(`Empty Slot DOM baseline invalid: ${empty}`);
if (
  !filled.includes("채운 내용") ||
  filled.includes("react-aria-Slot-placeholder")
)
  throw new Error(`Filled Slot DOM baseline invalid: ${filled}`);
const report = {
  head: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
  executionBuildIdentity: `old-source-modules:${(() => {
    const sourcePaths = execFileSync(
      "git",
      [
        "ls-files",
        "-z",
        "apps/builder/src",
        "packages/shared/src",
        "packages/specs/src",
        "packages/engine/src",
      ],
      { cwd: root },
    )
      .toString()
      .split("\0")
      .filter(Boolean);
    const digest = createHash("sha256");
    for (const path of sourcePaths)
      digest
        .update(path)
        .update("\0")
        .update(readFileSync(resolve(root, path)))
        .update("\0");
    return digest.digest("hex");
  })()}`,
  executionClass: "ISOLATED_OLD_MODULE_ORACLE",
  visualEnvironment: "NOT_APPLICABLE_TO_STATIC_DOM_MARKUP",
  scenario,
  scenarioHash: sha256(JSON.stringify(scenario)),
  css: {
    groupSha256: sha256(readFileSync(groupCssPath, "utf8")),
    slotSha256: sha256(readFileSync(slotCssPath, "utf8")),
  },
  html: {
    groupHorizontal: horizontal,
    groupVertical: vertical,
    slotEmpty: empty,
    slotFilled: filled,
  },
  observations: {
    groupOrientationChangesMarkup: horizontal !== vertical,
    groupHasAriaOrientation: horizontal.includes("aria-orientation="),
    slotEmptyHasDescription: empty.includes("첫째 줄\n둘째 줄"),
    slotFilledHasPlaceholder: filled.includes("react-aria-Slot-placeholder"),
  },
};
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${out}: 4 isolated DOM cases captured\n`);
