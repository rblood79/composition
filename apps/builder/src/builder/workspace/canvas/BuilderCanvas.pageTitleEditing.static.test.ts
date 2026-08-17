import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("BuilderCanvas page title editing wiring", () => {
  it("native dblclick은 마지막 title hit를 inline editor로 연다", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderCanvas.tsx"),
      "utf-8",
    );
    const workspaceCss = await readFile(
      resolve(__dirname, "../Workspace.css"),
      "utf-8",
    );
    expect(source).toContain(
      'element.addEventListener("dblclick", onDoubleClickCapture, true)',
    );
    expect(source).toContain(
      "isPointInPageTitleBounds(scenePoint, hit.bounds)",
    );
    expect(source).toContain('className="page-title-edit-input"');
    expect(source).toContain(
      "renamePageTitle(pageId, event.currentTarget.value)",
    );

    const editorStyle = workspaceCss.match(
      /\.page-title-edit-input\s*\{[\s\S]*?\n\}/,
    );
    expect(editorStyle).not.toBeNull();
    expect(editorStyle?.[0]).toContain("padding: 0;");
    expect(editorStyle?.[0]).toContain("font-weight: 500;");
    expect(editorStyle?.[0]).toContain("line-height: 12px;");
    expect(editorStyle?.[0]).toContain("appearance: none;");
  });
});
