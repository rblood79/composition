import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/**
 * lazy 패널 경계 — ADR-212 HC5 · ADR-242 R2.
 *
 * 대상 구현 모듈은 자기 패널 디렉토리 밖 어디서도 값으로 import 되지 않고 (`panelConfigs` 정적 import ·
 * `panels/index.ts` barrel · 패널 밖 소비처 전부 이 검사 하나), dynamic import 한 곳 (`panelConfigs`
 * 또는 lazy 래퍼) 으로만 온다. 정적 import 하나면 chunk 분리가 무효가 되고 initial 바이트 게이트가
 * 조용히 깨진다. 실제 바이트는 `scripts/adr212-editor-initial-bytes.mjs --match <dir>` 가 잰다.
 */
const SRC = resolve(__dirname, "../../..");
const PANELS = resolve(__dirname, "..");

/** lazy 대상 — `dir` 은 값 import 가 허용되는 패널 디렉토리, `module` 은 구현 파일 basename */
const LAZY_TARGETS = [
  { dir: "datatable", module: "DataTableEditorPanel" },
  { dir: "datatable", module: "DataTableFieldPanel" },
  { dir: "ai", module: "AIPanel" },
  { dir: "history", module: "HistoryPanel" },
  { dir: "themes", module: "ThemesPanel" },
  { dir: "interactions", module: "InteractionsPanel" },
  { dir: "settings", module: "SettingsPanel" },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== "node_modules") walk(path, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

const FILES = walk(SRC).map((file) => ({
  file,
  source: readFileSync(file, "utf8"),
}));

describe("lazy 패널 경계", () => {
  it.each(LAZY_TARGETS.map((t) => [`${t.dir}/${t.module}`, t] as const))(
    "%s — 패널 밖 값 import 0 · dynamic import 1+",
    (_name, { dir, module }) => {
      const allowed = resolve(PANELS, dir) + "/";
      const valueImport = new RegExp(
        `^import\\s+(?!type\\b)[^;]*?from\\s+"[^"]*/${module}";`,
        "m",
      );
      const dynamicImport = new RegExp(`import\\("[^"]*/${module}"\\)`);
      const offenders = FILES.filter(
        ({ file, source }) =>
          !file.startsWith(allowed) && valueImport.test(source),
      ).map(({ file }) => relative(SRC, file));
      expect(offenders).toEqual([]);
      expect(FILES.some(({ source }) => dynamicImport.test(source))).toBe(true);
    },
  );

  it("목록 패널 (DataTablePanel) 은 editors 를 import 하지 않는다", () => {
    const panel = readFileSync(
      resolve(PANELS, "datatable/DataTablePanel.tsx"),
      "utf8",
    );
    expect(panel).not.toMatch(/from "\.\/editors/);
  });
});
