/**
 * ADR-200 G3 — 명령 라벨이 locale 을 거쳐 나오는가.
 *
 * 종전에는 `def.i18n?.ko || def.description` 이 팔레트·툴팁 3곳에 있어 설정이
 * `en-US` 여도 한국어가 먼저 나왔다 (ADR-200 R3). 필드를 없앴으므로 되살아나는
 * 경로 둘을 잠근다 — 소비 패턴의 부활과, `ShortcutDefinition` 필드의 부활.
 *
 * 세 번째 조항은 G1 의 사각을 메운다: 명령 키는 `t(`command.${id}`)` 라는 템플릿
 * 리터럴로 만들어져 G1 의 리터럴 스캔에 걸리지 않는다. 여기서 id 전수를 카탈로그와
 * 대조한다 — 하나라도 빠지면 팔레트에 `command.zoomIn` 이 그대로 뜬다.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { localizedStrings } from "@/i18n/translations";
import { SHORTCUT_DEFINITIONS } from "./keyboardShortcuts";

const SRC_ROOT = path.resolve(__dirname, "../..");
const SKIP_DIRS = new Set(["node_modules", "dist", "__snapshots__"]);

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectSourceFiles(path.join(dir, entry.name), out);
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    out.push(path.join(dir, entry.name));
  }
  return out;
}

describe("ADR-200 G3 — 명령 라벨 locale", () => {
  it("정의에서 ko 를 먼저 읽는 소비 패턴이 없다", () => {
    const offenders: string[] = [];
    for (const file of collectSourceFiles(SRC_ROOT)) {
      const source = fs.readFileSync(file, "utf8");
      source.split("\n").forEach((line, index) => {
        // 주석은 소비 경로가 아니다 — 본 파일의 설명문도 여기서 걸러진다.
        const code = line.trim();
        if (
          code.startsWith("*") ||
          code.startsWith("//") ||
          code.startsWith("/*")
        )
          return;
        if (/i18n\??\.\s*(ko|ja)\b/.test(line)) {
          offenders.push(`${path.relative(SRC_ROOT, file)}:${index + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("`ShortcutDefinition` 에 i18n 필드가 없다", () => {
    const source = fs.readFileSync(
      path.join(SRC_ROOT, "builder/types/keyboard.ts"),
      "utf8",
    );
    const start = source.indexOf("export interface ShortcutDefinition");
    expect(start).toBeGreaterThan(-1);
    const block = source.slice(start, source.indexOf("\n}", start));
    expect(block).not.toMatch(/^\s*i18n\??:/m);
  });

  it("모든 단축키 id 가 ko/en 양쪽에 `command.<id>` 를 갖는다", () => {
    const missing: string[] = [];
    for (const id of Object.keys(SHORTCUT_DEFINITIONS)) {
      for (const locale of ["ko-KR", "en-US"] as const) {
        if (localizedStrings[locale][`command.${id}`] === undefined) {
          missing.push(`${locale} command.${id}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
