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
    else throw new Error(`알 수 없는 evidence 명령: ${command}`);
  } catch (error) {
    console.error(`[agent:evidence] ${error.message}`);
    process.exitCode = 1;
  }
}
