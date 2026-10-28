import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/**
 * 패널은 문서 명령을 `catalogRuntime/commandRunner.ts` (`useCatalogCommandRunner` ·
 * `runCatalogCommand` · `runBuiltCatalogCommand`) 로만 실행한다 — 거부는 안내 (`notifyEditRefusal`),
 * 그 밖의 실패는 toast. 패널이 `workspace.execute` 를 직접 부르면 거부 문구가 일반 오류 toast 로
 * 나가거나 (PropFollow · RacSlot · ShowWhen) 이벤트 핸들러 밖으로 던져졌다 (Themes · Settings).
 */
const PANELS = resolve(__dirname, "..");

/** 명령 경로가 아닌 `execute` (datatable Quick Connect 실행기) 는 대상 밖 */
const ALLOWED = new Set(["datatable/editors/DataTableCreator.tsx"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== "__tests__") walk(path, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

describe("패널 명령 실행 = 공용 runner", () => {
  it("패널 소스에 workspace.execute 직접 호출이 없다", () => {
    const offenders = walk(PANELS)
      .map((path) => relative(PANELS, path))
      .filter((rel) => !ALLOWED.has(rel))
      .filter((rel) =>
        /\bworkspace\??\.execute\(/.test(
          readFileSync(join(PANELS, rel), "utf8"),
        ),
      );
    expect(offenders).toEqual([]);
  });
});
