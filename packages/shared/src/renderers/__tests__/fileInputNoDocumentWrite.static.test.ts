/**
 * ADR-201 G3 — 파일 입력 렌더러의 문서 write 0 (정적 grep 게이트).
 *
 * 종전 `renderFileTrigger` 는 선택한 파일 **이름** 을 `selectedFiles` prop 에
 * `updateElementProps` 로 기록했다 — 런타임 상태를 canonical 문서 채널에 싣는 잘못된 경로
 * (publish 는 `/project.json` 을 그대로 서빙하므로 사용자 파일명이 배포본에 남는다).
 * 소비처는 0 (2026-09-17 재grep: 쓰기 1건 외 읽기 0). 본 게이트는 그 채널이 되살아나는 것과,
 * 새 `renderFileUpload` 가 큐 상태를 문서에 쓰는 것을 같이 차단한다.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RENDERERS_DIR = resolve(__dirname, "..");
const read = (name: string) =>
  readFileSync(resolve(RENDERERS_DIR, name), "utf8");

function functionBody(source: string, name: string): string {
  const start = source.indexOf(`export const ${name} = (`);
  expect(start, `${name} 정의를 찾지 못함`).toBeGreaterThanOrEqual(0);
  const next = source.indexOf("\nexport const ", start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

describe("ADR-201 — 파일 입력 렌더러는 문서에 쓰지 않는다", () => {
  it("renderers/ 의 파일 입력 계열에 `selectedFiles` 채널이 없다", () => {
    for (const file of ["FormRenderers.tsx", "UploadRenderers.tsx"]) {
      if (!existsSync(resolve(RENDERERS_DIR, file))) continue;
      expect(
        read(file).includes("selectedFiles"),
        `${file}: selectedFiles`,
      ).toBe(false);
    }
  });

  it("renderFileTrigger · renderDropZone 본문에 updateElementProps 호출이 없다", () => {
    const source = read("FormRenderers.tsx");
    for (const name of ["renderFileTrigger", "renderDropZone"]) {
      const body = functionBody(source, name);
      expect(body.includes("updateElementProps("), `${name}`).toBe(false);
      // onSelect / onDrop 은 ADR-158 규칙 위임 (createEventHandlerMap) 경로다.
      expect(body.includes("createEventHandlerMap"), `${name} 위임`).toBe(true);
    }
  });

  it("renderFileUpload (UploadRenderers) 는 큐 상태를 문서에 쓰지 않는다", () => {
    const path = resolve(RENDERERS_DIR, "UploadRenderers.tsx");
    if (!existsSync(path)) return; // Phase 3 후반 이전
    const source = readFileSync(path, "utf8");
    expect(source.includes("updateElementProps(")).toBe(false);
    expect(source.includes("batchUpdateElementProps(")).toBe(false);
    expect(source.includes("setElements(")).toBe(false);
  });
});
