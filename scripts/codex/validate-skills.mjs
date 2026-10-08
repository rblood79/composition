import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const nonemptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;
const stringList = (value) =>
  Array.isArray(value) && value.length > 0 && value.every(nonemptyString);
const fields = {
  name: nonemptyString,
  description: nonemptyString,
  license: nonemptyString,
  compatibility: nonemptyString,
  metadata: (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value),
  "allowed-tools": (value) => nonemptyString(value) || stringList(value),
  "user-invocable": (value) => typeof value === "boolean",
  "disable-model-invocation": (value) => typeof value === "boolean",
  // 공용 스킬의 기존 [힌트] 표기는 YAML에서 단일 원소 배열로 파싱된다.
  "argument-hint": (value) =>
    nonemptyString(value) || (stringList(value) && value.length === 1),
};

export function validateSkill(file) {
  const errors = [];
  const source = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const frontmatter = source.match(
    /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/,
  );
  if (!frontmatter)
    return {
      file,
      errors: ["YAML frontmatter 시작·종료 구분자가 필요합니다."],
      links: 0,
    };
  try {
    // 언어 자동 감지를 쓰지 않고 YAML만 파싱한다 (javascript engine 실행 금지).
    const data = matter.engines.yaml.parse(frontmatter[1]);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      errors.push("frontmatter는 YAML mapping이어야 합니다.");
    } else {
      for (const required of ["name", "description"]) {
        if (!nonemptyString(data[required]))
          errors.push(`${required}: 비어 있지 않은 문자열이 필요합니다.`);
      }
      for (const [key, value] of Object.entries(data)) {
        if (!Object.hasOwn(fields, key))
          errors.push(`${key}: 지원하지 않는 frontmatter 필드입니다.`);
        else if (!fields[key](value))
          errors.push(`${key}: 지원하지 않는 값 타입입니다.`);
      }
      if (
        typeof data.name === "string" &&
        data.name !== path.basename(path.dirname(file))
      ) {
        errors.push(`name '${data.name}'이 폴더명과 다릅니다.`);
      }
      if (
        typeof data.name === "string" &&
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.name)
      ) {
        errors.push("name: 소문자·숫자·하이픈 이름이 필요합니다.");
      }
    }
  } catch (error) {
    errors.push(`YAML 파싱 실패: ${error.message}`);
  }

  const body = source.slice(frontmatter[0].length);
  let fence = null;
  const prose = [];
  for (const [index, line] of body.split(/\r?\n/).entries()) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (
        marker &&
        marker[1][0] === fence.char &&
        marker[1].length >= fence.length &&
        !marker[2].trim()
      )
        fence = null;
    } else if (marker) {
      fence = { char: marker[1][0], length: marker[1].length, line: index + 1 };
    } else {
      prose.push(line);
    }
  }
  if (fence)
    errors.push(`본문 ${fence.line}행의 코드펜스가 닫히지 않았습니다.`);
  const text = prose.join("\n").replace(/(`+)[\s\S]*?\1/g, "");
  // 일반 inline 링크와 reference 정의의 대상 파일만 검사한다. anchor/웹 응답은 범위 밖이다.
  const targets = [
    ...text.matchAll(
      /!?\[[^\]\n]*\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+["'][^\n]*?["'])?\s*\)/g,
    ),
    ...text.matchAll(/^ {0,3}\[[^\]\n]+\]:\s*(<[^>]+>|\S+)/gm),
  ];
  let links = 0;
  for (const match of targets) {
    const target = match[1].replace(/^<|>$/g, "");
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) continue;
    let local;
    try {
      local = decodeURIComponent(target.split(/[?#]/)[0]);
    } catch {
      errors.push(`링크 URL 인코딩 오류: ${target}`);
      continue;
    }
    if (!local) continue;
    links += 1;
    if (!fs.existsSync(path.resolve(path.dirname(file), local)))
      errors.push(`로컬 링크 대상 없음: ${target}`);
  }
  return { file, errors, links };
}

export function runSkillValidation(inputs = []) {
  const files = inputs.length
    ? inputs.map((input) =>
        path.resolve(
          input.endsWith(".md") ? input : path.join(input, "SKILL.md"),
        ),
      )
    : fs
        .readdirSync(path.join(repoRoot, ".claude/skills"), {
          withFileTypes: true,
        })
        .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
        .map((entry) =>
          path.join(repoRoot, ".claude/skills", entry.name, "SKILL.md"),
        );
  return files.map((file) => {
    try {
      return validateSkill(file);
    } catch (error) {
      return { file, errors: [error.message], links: 0 };
    }
  });
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const results = runSkillValidation(
    process.argv.slice(2).filter((arg) => arg !== "--"),
  );
  for (const result of results) {
    for (const error of result.errors)
      console.error(`${path.relative(repoRoot, result.file)}: ${error}`);
  }
  const errors = results.reduce((sum, result) => sum + result.errors.length, 0);
  const links = results.reduce((sum, result) => sum + result.links, 0);
  console.log(
    `스킬 ${results.length}개 · 로컬 링크 ${links}개 · 오류 ${errors}개`,
  );
  process.exitCode = errors ? 1 : 0;
}
