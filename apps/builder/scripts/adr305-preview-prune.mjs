/**
 * ADR-305 Phase 5 (G3) — 사용자 컴포넌트 시트에서 빌더 몫을 뺀다.
 *
 *   node apps/builder/scripts/adr305-preview-prune.mjs <classify.json> [--write]
 *
 * 대상 = 공유 수동 시트 (Preview 그래프 · 생성 · 테마 시트 제외) 의 규칙 중 선택자가 catalog 노드가 아님
 * (`:not([data-catalog-id])` · `:not([data-catalog-id], [data-catalog-id] *)`) 을 조건으로 하는 빌더 분기이고,
 * Phase 0 계수에서 Preview · Publish 매치 0 인 것. 빌더 문서는 이 시트를 더는 싣지 않는다 (Phase 4) —
 * 빌더 위젯 몫은 `styles/widgets/` 사본에 있다.
 *
 * 규칙의 선택자가 전부 빌더 분기면 규칙째 (중첩 자식 포함) 지우고, 섞여 있으면 빌더 분기 부분만 지운다.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { flatSelector, repo, splitSelectorList } from "./adr305Sheets.mjs";

const require = createRequire(join(repo, "apps/builder/package.json"));
const postcss = require("postcss");
const [classifyPath, ...flags] = process.argv.slice(2);
const write = flags.includes("--write");
const BRANCH = /:not\(\s*\[data-catalog-id\]/;

/** 앞머리 `:is(a, b)rest` 를 `[a rest, b rest]` 로 (괄호 짝 · 재귀). */
function alternatives(part) {
  if (!part.startsWith(":is(")) return [part];
  let depth = 0;
  for (let i = 3; i < part.length; i++) {
    if (part[i] === "(") depth++;
    else if (part[i] === ")" && --depth === 0) {
      const rest = part.slice(i + 1);
      return splitSelectorList(part.slice(4, i)).flatMap((a) =>
        alternatives(a + rest),
      );
    }
  }
  return [part];
}

const classify = JSON.parse(readFileSync(classifyPath, "utf8"));
const targets = new Map();
for (const r of classify.rules) {
  const file = r.id.slice(0, r.id.lastIndexOf(":"));
  const sheet = classify.sheets[file];
  if (
    !sheet?.shared ||
    file.includes("/generated/") ||
    file.includes("/theme/")
  )
    continue;
  if (!BRANCH.test(r.selector) || r.userN !== 0) continue;
  (targets.get(file) ?? targets.set(file, new Set()).get(file)).add(
    Number(r.id.slice(r.id.lastIndexOf(":") + 1)),
  );
}

const report = {};
for (const [file, lines] of targets) {
  const path = join(repo, file);
  const root = postcss.parse(readFileSync(path, "utf8"), { from: path });
  const removed = [];
  const trimmed = [];
  root.walkRules((rule) => {
    if (!lines.has(rule.source.start.line)) return;
    // 지운 부모의 자식은 walk 가 한 번 더 방문한다 — 이미 부모와 함께 빠졌다
    for (let p = rule.parent; ; p = p.parent) {
      if (!p) return;
      if (p.type === "root") break;
    }
    const flat = splitSelectorList(flatSelector(rule));
    // `:is(부모 목록)` 으로 펼친 자식은 부모 갈래마다 판정한다 — 빌더 분기가 없는 갈래가 하나라도 있으면 그 부분은 일반이다
    const builderOnly = (part) =>
      alternatives(part).every((a) => BRANCH.test(a));
    if (flat.some((p) => BRANCH.test(p) && !builderOnly(p))) {
      if (process.env.DEBUG)
        console.error(
          "MIXED-PARENT",
          file,
          rule.source.start.line,
          flat.join(" | ").slice(0, 200),
        );
      return;
    }
    if (flat.every((p) => BRANCH.test(p))) {
      removed.push(rule.source.start.line);
      rule.remove();
      return;
    }
    const own = splitSelectorList(rule.selector);
    if (own.length !== flat.length)
      throw new Error(`${file}:${rule.source.start.line} 중첩 혼합 — 손으로`);
    const kept = own.filter((_, i) => !BRANCH.test(flat[i]));
    trimmed.push(rule.source.start.line);
    if (process.env.DEBUG)
      console.error(
        file,
        rule.source.start.line,
        JSON.stringify(own),
        "=>",
        JSON.stringify(kept),
      );
    rule.selector = kept.join(",\n");
  });
  report[file] = { removed: removed.length, trimmed: trimmed.length };
  if (write) writeFileSync(path, root.toString());
}
console.log(JSON.stringify(report, null, 1));
console.log(
  `total removed ${Object.values(report).reduce((n, r) => n + r.removed, 0)} · trimmed ${Object.values(report).reduce((n, r) => n + r.trimmed, 0)}`,
);
