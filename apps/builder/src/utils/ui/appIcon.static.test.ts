/**
 * 앱 아이콘은 `public/appIcon.svg` — production 은 `/composition/` 아래에 배포되므로 JS 에서
 * `"/appIcon.svg"` 로 적으면 404 (헤더 로고 · 로그인 · 대시보드가 깨짐, 2026-09-26 live 실측).
 * `index.html` 은 Vite 가 빌드 때 base 를 붙이므로 예외. JS 는 `APP_ICON_URL` 하나만 쓴다.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_ICON_URL } from "./uiConstants";

const SRC = resolve(__dirname, "../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)
      ? [path]
      : [];
  });
}

describe("앱 아이콘 경로 — 배포 base 를 따른다", () => {
  it("src 에 base 없는 /appIcon.svg 가 없다", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => /["'`]\/appIcon\.svg/.test(readFileSync(file, "utf8")))
      .map((file) => relative(SRC, file));
    expect(offenders).toEqual([]);
  });

  it("APP_ICON_URL 은 Vite BASE_URL 아래", () => {
    expect(APP_ICON_URL).toBe(`${import.meta.env.BASE_URL}appIcon.svg`);
  });
});
