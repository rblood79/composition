/**
 * ADR-305 — 두 스냅샷 디렉터리 (adr305-builder-snapshot · adr305-preview-snapshot 출력) 비교.
 *
 *   node apps/builder/scripts/adr305-compare.mjs <before> <after> [report.json]
 *
 * 변형 · 화면마다 Δ (속성 · 상태 합성 포함) · 사라진 / 새 요소 수. 한쪽에만 있는 화면도 보고한다.
 * exit 1 = Δ 또는 요소 차이 또는 빠진 화면이 있다.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { anchorCapture, compareCaptures } from "./adr305Snapshot.mjs";

const [a, b, reportPath] = process.argv.slice(2);
// ADR305_ANCHOR = 기준 요소 (key 안 문자열) 아래만 비교 · ADR305_SUBSET=1 = 한쪽에만 있는 변형은 실패로 세지 않음
const anchor = process.env.ADR305_ANCHOR;
const read = (f) => {
  const cap = JSON.parse(readFileSync(f, "utf8"));
  return anchor ? anchorCapture(cap, anchor) : cap;
};
if (a.endsWith(".json")) {
  const r = compareCaptures(read(a), read(b));
  const props = {};
  for (const d of r.delta) props[d.prop] = (props[d.prop] ?? 0) + 1;
  console.log(
    `delta ${r.delta.length} (state ${r.delta.filter((d) => d.state).length}) · missing ${r.missing.length} · added ${r.added.length}`,
  );
  console.log(
    Object.entries(props)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 25)
      .map(([p, c]) => `${p}×${c}`)
      .join(" "),
  );
  if (reportPath) writeFileSync(reportPath, JSON.stringify(r, null, 1));
  process.exit(r.delta.length + r.missing.length + r.added.length ? 1 : 0);
}
const report = {
  before: a,
  after: b,
  screens: {},
  onlyBefore: [],
  onlyAfter: [],
};
let bad = 0;
const variants = readdirSync(a).filter((v) => !v.endsWith(".json"));
for (const v of variants) {
  if (!existsSync(join(b, v))) {
    report.onlyBefore.push(v);
    if (process.env.ADR305_SUBSET !== "1") bad++;
    continue;
  }
  const fa = readdirSync(join(a, v)).filter((f) => f.endsWith(".json"));
  const fb = new Set(
    readdirSync(join(b, v)).filter((f) => f.endsWith(".json")),
  );
  for (const f of fa) {
    const name = `${v}/${f.replace(/\.json$/, "")}`;
    if (!fb.has(f)) {
      report.onlyBefore.push(name);
      bad++;
      continue;
    }
    fb.delete(f);
    const r = compareCaptures(read(join(a, v, f)), read(join(b, v, f)));
    report.screens[name] = r;
    const n = r.delta.length + r.missing.length + r.added.length;
    if (n) bad++;
    const props = {};
    for (const d of r.delta) props[d.prop] = (props[d.prop] ?? 0) + 1;
    const top = Object.entries(props)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 6)
      .map(([p, c]) => `${p}×${c}`)
      .join(" ");
    console.log(
      `${n ? "Δ" : "="} ${name}: delta ${r.delta.length} (state ${r.delta.filter((d) => d.state).length}) · missing ${r.missing.length} · added ${r.added.length}${top ? ` · ${top}` : ""}`,
    );
  }
  for (const f of fb) {
    report.onlyAfter.push(`${v}/${f}`);
    bad++;
  }
}
if (report.onlyBefore.length)
  console.log("only before:", report.onlyBefore.join(" "));
if (report.onlyAfter.length)
  console.log("only after:", report.onlyAfter.join(" "));
if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 1));
console.log(bad ? `FAIL — ${bad} 화면 차이` : "PASS — Δ 0");
process.exitCode = bad ? 1 : 0;
