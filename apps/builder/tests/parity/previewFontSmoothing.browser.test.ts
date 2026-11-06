import { afterEach, expect, it } from "vitest";
import publishStyles from "../../../publish/src/styles/index.css?inline";
import { injectPreviewBaseStyles } from "../../src/preview/baseStyles";

const frames: HTMLIFrameElement[] = [];

afterEach(() => {
  for (const frame of frames.splice(0)) frame.remove();
});

function textWithStyles(styles?: string): CSSStyleDeclaration {
  const frame = document.createElement("iframe");
  document.body.appendChild(frame);
  frames.push(frame);
  const doc = frame.contentDocument!;
  if (styles) {
    const style = doc.createElement("style");
    style.textContent = styles;
    doc.head.appendChild(style);
  } else {
    injectPreviewBaseStyles(doc);
  }
  const label = doc.createElement("span");
  label.textContent = "Label 본문";
  doc.body.appendChild(label);
  return frame.contentWindow!.getComputedStyle(label);
}

it("Preview Label은 실제 Publish stylesheet와 같은 font smoothing을 상속한다", () => {
  const preview = textWithStyles();
  const publish = textWithStyles(publishStyles);
  expect(publish.getPropertyValue("-webkit-font-smoothing")).toBe(
    "antialiased",
  );
  expect(preview.getPropertyValue("-webkit-font-smoothing")).toBe(
    publish.getPropertyValue("-webkit-font-smoothing"),
  );
});
