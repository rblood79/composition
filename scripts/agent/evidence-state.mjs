import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const digest = (value) => createHash("sha256").update(value).digest("hex");
function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
}

// 검증 범위의 HEAD·파일 목록·내용을 기록한다. ignored evidence 파일은 범위에 들어가지 않는다.
export function snapshot(root, manifest, explicitFiles) {
  const head = git(root, ["rev-parse", "HEAD"]).trim();
  const run = JSON.parse(fs.readFileSync(manifest, "utf8"));
  let files = explicitFiles;
  if (!files) {
    files = [
      ...git(root, ["diff", "--name-only", "-z", "HEAD"]).split("\0"),
      ...git(root, ["ls-files", "--others", "--exclude-standard", "-z"]).split(
        "\0",
      ),
    ];
    if (run.headAtStart && run.headAtStart !== "unknown")
      files.push(
        ...git(root, [
          "diff",
          "--name-only",
          "-z",
          `${run.headAtStart}..HEAD`,
        ]).split("\0"),
      );
  }
  files = [...new Set(files.filter(Boolean))].sort();
  const contents = files.map((file) => {
    const absolute = path.resolve(root, file);
    if (!absolute.startsWith(`${path.resolve(root)}${path.sep}`))
      throw new Error(`범위 밖 evidence 경로: ${file}`);
    try {
      const stat = fs.lstatSync(absolute);
      const content = stat.isSymbolicLink()
        ? fs.readlinkSync(absolute)
        : fs.readFileSync(absolute);
      return [file, stat.mode, digest(content)];
    } catch (error) {
      if (error.code === "ENOENT") return [file, "deleted"];
      throw error;
    }
  });
  return {
    head,
    files,
    fingerprint: digest(JSON.stringify(contents)),
    explicit: Boolean(explicitFiles),
  };
}

const READS = "evidence-reads.jsonl";
const jsonl = (file) =>
  fs.existsSync(file)
    ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map(JSON.parse)
    : [];

// 증거 파일이 run 폴더 artifacts/ 안의 실제 파일이면 run 기준 상대 경로, 아니면 null.
function artifactPath(runDir, file) {
  const base = path.join(runDir, "artifacts");
  if (!fs.existsSync(base) || !fs.existsSync(file)) return null;
  const real = fs.realpathSync(file);
  if (!real.startsWith(`${fs.realpathSync(base)}${path.sep}`)) return null;
  return fs.statSync(real).isFile()
    ? path.relative(fs.realpathSync(runDir), real)
    : null;
}

// Read hook 이 호출한다 — artifacts/ 안 파일을 읽은 사실과 그때의 내용 지문을 남긴다.
export function recordRead(runDir, file, session) {
  const rel = artifactPath(runDir, file);
  if (!rel) return false;
  fs.appendFileSync(
    path.join(runDir, READS),
    `${JSON.stringify({
      ts: new Date().toISOString(),
      path: rel,
      sha: digest(fs.readFileSync(file)),
      session: session || null,
    })}\n`,
  );
  return true;
}

// live-exercise pass 의 증거 검사 — 위치 · 내용 · 재사용 · (요구되면) Read 기록.
export function checkArtifact(runDir, file, requireRead) {
  const rel = artifactPath(runDir, file);
  if (!rel)
    throw new Error(
      `artifact 는 run 폴더 artifacts/ 안의 파일이어야 한다: ${file} (${path.join(runDir, "artifacts")} 로 저장)`,
    );
  const content = fs.readFileSync(file);
  if (content.length === 0) throw new Error(`artifact 가 비어 있음: ${rel}`);
  const sha = digest(content);
  const reused = jsonl(path.join(runDir, "evidence.jsonl")).some(
    (entry) =>
      entry.kind === "live-exercise" &&
      entry.status === "pass" &&
      entry.artifactSha === sha,
  );
  if (reused)
    throw new Error(
      `같은 증거 파일은 pass 한 번에만 쓴다: ${rel} — 다시 관찰해 새 파일로 남긴다`,
    );
  const read = jsonl(path.join(runDir, READS)).some(
    (entry) => entry.path === rel && entry.sha === sha,
  );
  if (requireRead && !read)
    throw new Error(
      `이 증거 파일을 Read 한 기록이 없다: ${rel} — Read 도구로 연 뒤 다시 기록한다 (Read 뒤 파일이 바뀌었으면 다시 Read)`,
    );
  return { path: rel, sha, read: read ? true : null };
}

export function hasCurrentPass(root, manifest, kind, explicitFiles) {
  const ledger = path.join(path.dirname(manifest), "evidence.jsonl");
  if (!fs.existsSync(ledger)) return false;
  const entries = fs
    .readFileSync(ledger, "utf8")
    .split("\n")
    .filter(Boolean)
    .map(JSON.parse);
  const latest = entries.findLast((entry) => entry.kind === kind);
  if (latest?.status !== "pass" || !latest.snapshot) return false;
  // live 는 증거 파일이 붙은 PASS 만 인정한다 — artifact · 지문 없는 옛 행은 재검증 대상.
  if (kind === "live-exercise" && !(latest.artifact && latest.artifactSha))
    return false;
  // 호출자가 범위를 지정하지 않으면 증거의 명시 범위를 재검사한다.
  const files =
    explicitFiles ??
    (latest.snapshot.explicit ? latest.snapshot.files : undefined);
  const current = snapshot(root, manifest, files);
  return (
    current.head === latest.snapshot.head &&
    current.fingerprint === latest.snapshot.fingerprint
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [command, root, manifest, arg, fileList] = process.argv.slice(2);
  try {
    if (command === "snapshot")
      console.log(
        JSON.stringify(
          snapshot(root, manifest, arg ? arg.split(",") : undefined),
        ),
      );
    else if (command === "has-pass")
      process.exitCode = hasCurrentPass(
        root,
        manifest,
        arg,
        fileList ? fileList.split(",") : undefined,
      )
        ? 0
        : 1;
    else if (command === "artifact-check")
      console.log(JSON.stringify(checkArtifact(root, manifest, arg === "1")));
    else if (command === "record-read") recordRead(root, manifest, arg);
    else throw new Error(`알 수 없는 evidence 명령: ${command}`);
  } catch (error) {
    console.error(`[agent:evidence] ${error.message}`);
    process.exitCode = 1;
  }
}
