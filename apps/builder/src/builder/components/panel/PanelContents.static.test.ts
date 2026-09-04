import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PANELS_DIR = resolve(__dirname, "../../panels");

/**
 * 패널 루트 (`.panel`) 를 그리는 파일은 반드시 표준 스크롤 층을 거쳐야 한다.
 *
 * Why: 이 게이트가 없던 동안 Settings 패널은 CSS 정의가 0건인 `panel-settings`
 * 를, Themes 패널은 아무 층도 두지 않아 두 패널 모두 스크롤이 되지 않았다
 * (`.panel` 에는 overflow 가 없고 그 위 `.workspace-panel-frame` 은
 * `overflow: visible`). 클래스 이름을 손으로 적는 구조에서는 새 패널이 조용히
 * 빠지고, 증상은 "내용이 길어지기 전까지" 드러나지 않는다.
 */
async function collectPanelSources() {
  const entries = await readdir(PANELS_DIR, {
    recursive: true,
    withFileTypes: true,
  });
  const files = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".tsx") &&
        !entry.name.includes(".test."),
    )
    .map((entry) => resolve(entry.parentPath, entry.name));

  return Promise.all(
    files.map(async (path) => ({
      path,
      source: await readFile(path, "utf-8"),
    })),
  );
}

/** `className="panel ..."` 로 패널 루트를 여는 파일만 대상. */
const PANEL_ROOT = /className="panel(?:\s+[^"]*)?"/;

describe("패널 본문 스크롤 층 계약", () => {
  it("패널 루트를 그리는 파일은 PanelContents 또는 panelContents() 를 쓴다", async () => {
    const sources = await collectPanelSources();
    const roots = sources.filter(({ source }) => PANEL_ROOT.test(source));

    expect(roots.length).toBeGreaterThan(0);

    const missing = roots
      .filter(
        ({ source }) =>
          !source.includes("<PanelContents") &&
          !source.includes("panelContents("),
      )
      .map(({ path }) => path.slice(path.indexOf("/panels/")));

    expect(missing).toEqual([]);
  });

  it("클래스 문자열을 손으로 적지 않는다", async () => {
    const sources = await collectPanelSources();
    const handwritten = sources
      .filter(({ source }) => source.includes('className="panel-contents'))
      .map(({ path }) => path.slice(path.indexOf("/panels/")));

    expect(handwritten).toEqual([]);
  });
});
