import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { runSkillValidation, validateSkill } from "./validate-skills.mjs";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const base = "name: sample\ndescription: 샘플 스킬";
function fixture(t, frontmatter = base, body = "# 샘플\n") {
  const temp = fs.mkdtempSync(
    path.join(os.tmpdir(), "composition-skill-validator-"),
  );
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const dir = path.join(temp, "sample");
  fs.mkdirSync(dir);
  const file = path.join(dir, "SKILL.md");
  fs.writeFileSync(file, `---\n${frontmatter}\n---\n${body}`);
  return file;
}

test("공용 frontmatter의 boolean 확장·단일 배열 argument-hint·YAML metadata를 보존한다", (t) => {
  const file = fixture(
    t,
    `${base}\nuser-invocable: true\ndisable-model-invocation: false\nargument-hint: [대상 범위]\nallowed-tools: [Read, Bash]\nmetadata:\n  snapshotDate: 2026-06-17`,
  );
  assert.deepEqual(validateSkill(file).errors, []);
});

test("문자열 argument-hint와 여러 줄 description을 허용한다", (t) => {
  const file = fixture(
    t,
    "name: sample\ndescription: >\n  여러 줄\n  설명\nargument-hint: 대상 범위",
  );
  assert.deepEqual(validateSkill(file).errors, []);
});

for (const [label, yaml, expected] of [
  ["잘못된 YAML", `${base}\nbroken: [`, /YAML 파싱 실패/],
  ["중복 YAML 키", `${base}\nname: other`, /YAML 파싱 실패/],
  ["필수 description 없음", "name: sample", /description:/],
  ["빈 description", 'name: sample\ndescription: " "', /description:/],
  ["폴더와 다른 이름", "name: other\ndescription: 설명", /폴더명과 다릅니다/],
  ["배열 name", "name: [sample]\ndescription: 설명", /name:/],
  ["문자열 boolean", `${base}\nuser-invocable: "true"`, /user-invocable:/],
  [
    "객체 argument-hint",
    `${base}\nargument-hint: {target: value}`,
    /argument-hint:/,
  ],
  ["빈 목록 allowed-tools", `${base}\nallowed-tools: []`, /allowed-tools:/],
  ["배열 metadata", `${base}\nmetadata: []`, /metadata:/],
  [
    "알 수 없는 확장",
    `${base}\nuser-invokable: true`,
    /지원하지 않는 frontmatter 필드/,
  ],
]) {
  test(`frontmatter 오류: ${label}`, (t) => {
    assert.match(validateSkill(fixture(t, yaml)).errors.join("\n"), expected);
  });
}

test("frontmatter 없는 문서를 거부한다", (t) => {
  const file = fixture(t);
  fs.writeFileSync(file, "# frontmatter 없음\n");
  assert.match(validateSkill(file).errors.join("\n"), /구분자/);
});

test("닫히지 않은 코드펜스를 거부한다", (t) => {
  assert.match(
    validateSkill(fixture(t, base, "```ts\nconst a = 1;\n")).errors.join("\n"),
    /코드펜스/,
  );
});

test("코드 안의 링크를 무시하고 중첩 코드펜스와 실제 로컬 링크를 검사한다", (t) => {
  const file = fixture(
    t,
    base,
    "````md\n```ts\n[코드](missing.md)\n```\n````\n`[예](missing.md)`\n[실제](target.md#section)\n[참조][target]\n[target]: target.md\n[웹](https://example.com)\n[앵커](#section)\n",
  );
  fs.writeFileSync(path.join(path.dirname(file), "target.md"), "# section");
  assert.deepEqual(validateSkill(file), { file, errors: [], links: 2 });
});

test("깨진 로컬 링크와 잘못된 URL 인코딩을 거부한다", (t) => {
  const result = validateSkill(
    fixture(t, base, "[없음](missing.md)\n[깨짐](bad%ZZ.md)\n"),
  );
  assert.match(result.errors.join("\n"), /로컬 링크 대상 없음/);
  assert.match(result.errors.join("\n"), /인코딩 오류/);
});

test("공백·URL 인코딩을 포함한 로컬 링크를 허용한다", (t) => {
  const file = fixture(
    t,
    base,
    "[공백](<target file.md>)\n[인코딩](target%20file.md)\n",
  );
  fs.writeFileSync(path.join(path.dirname(file), "target file.md"), "# 파일");
  assert.deepEqual(validateSkill(file).errors, []);
});

test("validator CLI가 잘못된 fixture에서 실패 상태를 반환한다", (t) => {
  const file = fixture(t, "name: sample");
  const result = spawnSync(
    process.execPath,
    ["scripts/codex/validate-skills.mjs", file],
    { cwd: repoRoot, encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /description:/);
});

test("실제 공용 스킬 전체를 검증한다", () => {
  const results = runSkillValidation();
  assert.ok(results.length >= 11);
  assert.deepEqual(
    results.flatMap((result) =>
      result.errors.map((error) => `${result.file}: ${error}`),
    ),
    [],
  );
});

function route(prompt, stdin = false) {
  const result = spawnSync(
    "bash",
    ["scripts/codex/route-prompt.sh", ...(stdin ? [] : ["--", prompt])],
    {
      cwd: repoRoot,
      encoding: "utf8",
      input: stdin ? prompt : undefined,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

for (const prompt of [
  "컴포넌트 코드 리뷰해줘",
  "현재 변경 검토해줘",
  "review the implementation",
]) {
  test(`일반 코드 review 라우팅: ${prompt}`, () => {
    const output = route(prompt);
    assert.match(output, /code-review: review/);
    assert.doesNotMatch(output, /review-adr/);
  });
}

test("ADR 리뷰는 review-adr로 분기한다", () => {
  const output = route("ADR-256 문서 리뷰해줘");
  assert.match(output, /review-adr/);
  assert.doesNotMatch(output, /code-review:/);
});

test("ADR 실행 지시가 dirty 정리나 무승인 push를 유도하지 않는다", () => {
  const output = route("ADR-256 다음 Phase 실행해");
  assert.match(output, /adr-execute:/);
  assert.match(output, /dirty 변경 보존/);
  assert.match(output, /commit\/push는 별도 사용자 요청/);
  assert.doesNotMatch(output, /clean main|push main directly/);
});

test("상태·선택·레이아웃 입력이 catalog runtime 계약으로 안내된다", () => {
  const output = route("상태 store layout과 selectedElement를 확인해");
  assert.match(output, /workspace.execute/);
  assert.match(output, /CatalogAutosave/);
  assert.match(output, /CatalogSession/);
  assert.match(output, /PersistentLayoutTree/);
  assert.doesNotMatch(
    output,
    /Memory -> Index|layoutVersion|readImmediateSelectionSnapshot|apply\*FromSelection|apply\*Explicit/,
  );
});

test("RAC slot·showWhen와 실제 Builder 확인은 공통 계약·evaluate로 안내된다", () => {
  const output = route(
    "RAC slot showWhen 변경을 실제 builder에서 브라우저 검증해",
    true,
  );
  assert.match(output, /domain-rac-composition.md/);
  assert.match(output, /live-evaluate: evaluate/);
});

test("라우터는 자동 UserPromptSubmit hook에 연결하지 않는다", () => {
  const config = JSON.parse(
    fs.readFileSync(path.join(repoRoot, ".codex/hooks.json"), "utf8"),
  );
  assert.equal(Object.hasOwn(config.hooks, "UserPromptSubmit"), false);
});

test("catalog 집계가 실제 review·evaluate 힌트를 포함하고 부분 이름·주석은 제외한다", (t) => {
  const gate = fs.readFileSync(
    path.join(repoRoot, "scripts/codex/agent-catalog-gate.sh"),
    "utf8",
  );
  const assignment = gate
    .split("\n")
    .find((line) => line.startsWith("XR_REFS="));
  assert.ok(assignment);
  const file = fixture(t);
  const source = path.join(path.dirname(file), "route.sh");
  function extracted(contents) {
    fs.writeFileSync(source, contents);
    const result = spawnSync(
      "bash",
      ["-c", `${assignment}\nprintf '%s\n' "$XR_REFS"`],
      {
        cwd: repoRoot,
        encoding: "utf8",
        env: { ...process.env, XR: source },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    return new Set(result.stdout.trim().split("\n"));
  }
  const negatives = extracted(
    '# add_hint "review evaluate"\n  add_hint "other: preview review-adr live-evaluate review_helper"\n',
  );
  assert.equal(negatives.has("review"), false);
  assert.equal(negatives.has("evaluate"), false);
  assert.equal(negatives.has("review-adr"), true);
  const actual = extracted(
    fs.readFileSync(
      path.join(repoRoot, "scripts/codex/route-prompt.sh"),
      "utf8",
    ),
  );
  assert.equal(actual.has("review"), true);
  assert.equal(actual.has("evaluate"), true);
});
