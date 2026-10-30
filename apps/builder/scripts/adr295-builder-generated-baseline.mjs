/**
 * ADR-295 Phase 0 — 빌더가 읽는 생성 시트의 치수 기준 JSON (Decision 9 게이트 (c) 의 295 전 기준).
 *
 * `builder-components.css` 가 import 하는 `generated/*.css` 의 모든 치수 선언을 빌더 root 변수값
 * (`theme.css` 가 싣는 시트의 `:root` 선언) 으로 풀어 `파일 › 조건 › 선택자 | 속성 → 값` 으로 적는다.
 * Phase 2 가 `builder-catalog-vars.css` 를 넣은 뒤 같은 계산이 이 JSON 과 같아야 한다.
 *
 *   node apps/builder/scripts/adr295-builder-generated-baseline.mjs <out.json>
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  THEME_CSS,
  resolveBuilderGeneratedSheets,
} from "./adr295BuilderGeneratedSheets.mjs";

const { sheets, rootVarCount, unresolvedExternal, entries } =
  resolveBuilderGeneratedSheets([THEME_CSS]);
const out = {
  note: "ADR-295 Phase 0 — 빌더 root 변수값으로 푼 생성 시트 치수 (295 전 기준). key = 파일 › 조건 › 선택자 | 속성",
  sheets,
  rootVarCount,
  // 빌더 root 에도 시트 안에도 선언이 없는 변수 (색 변수 `--fg` 등은 런타임 테마가 싣는다 — 치수 아님)
  unresolvedExternal,
  entries,
};
const path = resolve(
  process.argv[2] ?? "builder-consumed-generated-baseline.json",
);
writeFileSync(path, JSON.stringify(out, null, 2));
console.log(
  `sheets ${sheets.length} · entries ${Object.keys(entries).length} → ${path}`,
);
console.log("unresolved external vars:", unresolvedExternal.join(" "));
