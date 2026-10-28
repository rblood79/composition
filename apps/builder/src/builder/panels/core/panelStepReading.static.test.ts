import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/**
 * 패널의 「step 마다 다시 읽기」 는 `useCatalogStepReading` · `useCatalogRevision`
 * (`catalogRuntime/react.runtime.ts`) 하나로 한다 — 2026-10-28 전에는 `subscribeSteps(() =>
 * notify())` + `useSyncExternalStore` + `JSON.stringify/parse` 를 사이트마다 (약 29곳, 사본 hook 2개)
 * 손으로 적었다. 한 entry 의 field 만 읽는 view 는 field 구독 (`useCatalogPropSource` ·
 * `runtime.subscribeEntryField`) 이 먼저다 (state-management.md §3).
 */
const PANELS = resolve(__dirname, "..");
/** 남긴 곳 — 이유와 함께. */
const ALLOWED = new Map([
  [
    "styles/catalog/catalogStylesHost.ts",
    "page 위치 = step + session 복합 구독 (선택이 바뀌어도 다시 읽는다)",
  ],
  [
    "properties/catalog/CatalogPropertiesPanel.components.tsx",
    "원시값 snapshot 5개가 구독 하나를 공유 (JSON 아님) · ADR-246 호출 수 ratchet 대상",
  ],
  [
    "datatable/editors/QueryFormatSection.tsx",
    "workspace 가 없을 수 있는 경로 (useOptionalCatalogWorkspace)",
  ],
  [
    "datatable/usage/catalogDataVariablesHost.ts",
    "host 안의 원시값 snapshot (소유 page 제목)",
  ],
]);

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

describe("패널 step 읽기 = 공용 hook", () => {
  it("subscribeSteps(() => notify()) 손 구독이 허용 목록 밖에 없다", () => {
    const offenders = walk(PANELS)
      .map((path) => relative(PANELS, path))
      .filter((rel) => !ALLOWED.has(rel))
      .filter((rel) =>
        readFileSync(join(PANELS, rel), "utf8").includes(
          "subscribeSteps(() => notify())",
        ),
      );
    expect(offenders).toEqual([]);
  });
});
