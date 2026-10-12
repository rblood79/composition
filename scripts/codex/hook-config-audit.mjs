#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || process.cwd());
const configPath = path.join(root, ".codex/hooks.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const requiredEvents = ["PreToolUse", "PostToolUse"];
const requiredScripts = ["protect-files.sh", "auto-format.sh"];
const errors = [];
const referenced = new Set();
let handlerCount = 0;

for (const event of requiredEvents) {
  if (
    !Array.isArray(config.hooks?.[event]) ||
    config.hooks[event].length === 0
  ) {
    errors.push(`event 없음: ${event}`);
  }
}

for (const [event, groups] of Object.entries(config.hooks || {})) {
  for (const group of groups || []) {
    for (const handler of group.hooks || []) {
      handlerCount += 1;
      if (handler.type !== "command") {
        errors.push(
          `${event}: type=${handler.type || "missing"} (command 필요)`,
        );
        continue;
      }

      const command = String(handler.command || "");
      const paths =
        command.match(/(?:\.codex|\.claude)\/hooks\/[^'"\s]+\.sh/g) || [];
      if (paths.length === 0)
        errors.push(`${event}: command에서 hook .sh 경로를 찾지 못함`);
      if (command.includes(root))
        errors.push(`${event}: 사용자 checkout 절대 경로 잔존`);
      if (
        paths.length > 0 &&
        !command.includes("git rev-parse --show-toplevel")
      ) {
        errors.push(`${event}: repo-local hook은 git root 기반 경로여야 함`);
      }
      for (const relativePath of paths) {
        const scriptPath = path.join(root, relativePath);
        referenced.add(path.basename(scriptPath));
        if (!fs.existsSync(scriptPath))
          errors.push(`${event}: 파일 없음 ${relativePath}`);
        else if ((fs.statSync(scriptPath).mode & 0o111) === 0)
          errors.push(`${event}: 실행권한 없음 ${relativePath}`);
      }
    }
  }
}

for (const script of requiredScripts) {
  if (!referenced.has(script)) errors.push(`핵심 Codex hook 미등록: ${script}`);
}

const hooksDir = path.join(root, ".codex/hooks");
const reachable = new Set(
  [...referenced].filter((name) => fs.existsSync(path.join(hooksDir, name))),
);
const pending = [...reachable];
while (pending.length > 0) {
  const name = pending.pop();
  const source = fs.readFileSync(path.join(hooksDir, name), "utf8");
  for (const match of source.matchAll(
    /\$(?:SCRIPT_DIR|\{SCRIPT_DIR\})\/([A-Za-z0-9_.-]+\.sh)/g,
  )) {
    const dependency = match[1];
    if (!fs.existsSync(path.join(hooksDir, dependency))) {
      errors.push(`${name}: 공용 hook 파일 없음 ${dependency}`);
    } else if (!reachable.has(dependency)) {
      reachable.add(dependency);
      pending.push(dependency);
    }
  }
}
if (fs.existsSync(hooksDir)) {
  for (const name of fs.readdirSync(hooksDir)) {
    if (name.endsWith(".sh") && !reachable.has(name))
      errors.push(`미등록 Codex hook: ${name}`);
  }
}

for (const error of errors) console.log(`ERROR\t${error}`);
console.log(`COUNT\t${handlerCount}`);
