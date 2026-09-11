/**
 * ADR-213 HC1 · R7 정적 가드 — `origin:"ai"|"agent"` 로 152 적용기를 부르는 AI/agent 코드는
 * `dataProposalDispatcher.ts` 하나여야 한다. 다른 파일이 `applyDataChange(` 를 직접 부르면
 * 승인 없는 쓰기 경로다 (task-state 중단 기준).
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const ALLOW = new Set(["ai/data/dataProposalDispatcher.ts"]);

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
      out.push(full);
  }
  return out;
}

describe("services/** 의 데이터 쓰기 진입점", () => {
  it("applyDataChange( 직접 호출은 dispatcher 뿐 · origin ai/agent 문자열도 dispatcher 밖에 없다", async () => {
    const files = await walk(ROOT);
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file);
      if (ALLOW.has(rel)) continue;
      const source = await readFile(file, "utf-8");
      if (/applyDataChange\s*\(/.test(source))
        offenders.push(`${rel}: applyDataChange(`);
      if (/origin:\s*["'](ai|agent)["']/.test(source)) {
        // tool 이 dispatcher 에 넘기는 proposal.origin 은 허용 — 적용기 호출이 아니다
        if (!/dispatchDataProposal\s*\(/.test(source))
          offenders.push(`${rel}: origin literal`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
