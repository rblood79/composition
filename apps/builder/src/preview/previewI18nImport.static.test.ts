// Preview 런타임은 i18n barrel (`@/i18n` · `../i18n`) 을 import 하지 않는다 — barrel 이 translations(302 KB
// 소스) + labels 를 Preview initial 에 싣는다. 2026-09-16 실측: Properties 패널 i18n 키 추가만으로 Preview
// initial 이 +5,871 B gzip (locales.js +3,715 · i18n.js +1,889) 늘어 ADR-219 상한을 넘겼다. Preview 가 쓰는 건
// `i18n/locales` 의 locale 판독 3개뿐이고 t() 호출은 0 이다.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname);
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });

describe("Preview i18n import 경계", () => {
  it("preview/ 는 i18n barrel 을 import 하지 않는다 (locales 직접만)", () => {
    const offenders = walk(ROOT).filter((file) => {
      const src = readFileSync(file, "utf8");
      return /from\s+["'](@\/i18n|(\.\.\/)+i18n)["']/.test(src);
    });
    expect(offenders).toEqual([]);
  });

  it("preview/ 는 translations · labels 를 직접 import 하지 않는다", () => {
    const offenders = walk(ROOT).filter((file) =>
      /i18n\/(translations|labels|useI18n|I18nProvider)["']/.test(
        readFileSync(file, "utf8"),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('preview/ 에 t("…") 호출이 없다 — 생기면 barrel 이 아니라 별도 preview 사전으로', () => {
    const offenders = walk(ROOT).filter((file) =>
      /\bt\(\s*["'][a-zA-Z0-9_.]+["']/.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
