#!/usr/bin/env node
// Adobe Agent Skill 매니페스트에서 react-aria · react-spectrum 의 references/ 를 다시 받는다.
//
// 출처: https://react-aria.adobe.com/ai#agent-skills · https://react-spectrum.adobe.com/ai (2026-10-15 확인)
//   npx skills add <site> 가 읽는 매니페스트 = <site>/.well-known/skills/index.json
//   파일 본문 = <site>/.well-known/skills/<name>/<file>
//
// 받지 않는 것: 공식 SKILL.md 본문 — S2 쪽은 "S2 컴포넌트 우선 · style macro" 를 지시해 이 프로젝트의
//   D1 (RAC) · D3 (catalog CSS) 경계와 충돌한다. 로컬 SKILL.md wrapper (D1/D2 분기 · 설치본이 정본) 를 유지한다.
// 지우지 않는 것: 매니페스트에 없는 로컬 파일 (index.md 등) — 보고만 한다.
//
// 사용: node scripts/adobe-skills-refresh.mjs [--dry-run] [react-aria|react-spectrum]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = {
  "react-aria": { site: "https://react-aria.adobe.com", skill: "react-aria" },
  "react-spectrum": {
    site: "https://react-spectrum.adobe.com",
    skill: "react-spectrum-s2",
  },
};

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const only = args.filter((a) => !a.startsWith("--"));
const targets = only.length ? only : Object.keys(SOURCES);

async function fetchText(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const text = await res.text();
  if (/^\s*<(!doctype|html|head)/i.test(text))
    throw new Error(`HTML 응답 (markdown 아님): ${url}`);
  return text;
}

for (const dir of targets) {
  const src = SOURCES[dir];
  if (!src)
    throw new Error(`알 수 없는 대상: ${dir} (react-aria | react-spectrum)`);
  const manifestUrl = `${src.site}/.well-known/skills/index.json`;
  const manifest = JSON.parse(await fetchText(manifestUrl));
  const skill = manifest.skills.find((s) => s.name === src.skill);
  if (!skill) throw new Error(`매니페스트에 ${src.skill} 없음: ${manifestUrl}`);
  const files = skill.files.filter((f) => f !== "SKILL.md");
  const base = path.join(ROOT, ".claude/skills", dir);
  let written = 0;
  for (const rel of files) {
    const url = `${src.site}/.well-known/skills/${src.skill}/${rel}`;
    const text = await fetchText(url);
    const out = path.join(base, rel);
    if (!dryRun) {
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, text);
    }
    written += 1;
  }
  const localOnly = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else {
        const rel = path.relative(base, p);
        if (rel !== "SKILL.md" && !files.includes(rel)) localOnly.push(rel);
      }
    }
  };
  walk(base);
  const today = new Date().toISOString().slice(0, 10);
  const manifestMd = [
    `# ${dir} references — 공식 Agent Skill 스냅샷`,
    "",
    `- 출처: ${manifestUrl} (skill \`${src.skill}\`)`,
    `- 받은 날: ${today} · 파일 ${files.length}`,
    `- 갱신: \`pnpm skills:adobe-refresh${only.length ? ` ${dir}` : ""}\` (scripts/adobe-skills-refresh.mjs)`,
    "- 공식 SKILL.md 본문은 받지 않는다 — 로컬 SKILL.md 가 이 프로젝트의 D1/D2 경계를 적는다",
    "",
    "## 파일",
    "",
    ...files.map((f) => `- ${f}`),
    "",
  ].join("\n");
  if (!dryRun)
    fs.writeFileSync(path.join(base, "references/MANIFEST.md"), manifestMd);
  console.log(
    `${dir}: ${dryRun ? "(dry-run) " : ""}${written}/${files.length} 파일 ← ${src.skill}`,
  );
  if (localOnly.length)
    console.log(
      `  매니페스트에 없는 로컬 파일 (그대로 둠): ${localOnly.join(", ")}`,
    );
}
