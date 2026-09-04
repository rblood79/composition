import { describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";

/**
 * 패널 탭 구조 정적 가드 (2026-08-30 통일).
 *
 * 정본 조합 — `.panel-tabs` > `.panel-header.panel-tabrow` > `.panel-tablist` > `.panel-tab`
 * (+ `.panel-tab-label`), 구현은 RAC `Tabs`/`TabList`/`Tab`.
 *
 * **왜 래퍼까지 강제하나**: 바 크롬(32px 높이 · `--bg-raised` · 하단 구분선)은
 * `.panel-header` 가 이미 주고 `.panel-tabrow` 가 헤더 패딩만 0 으로 되돌린다. 래퍼를 빼고
 * 같은 값을 `.panel-tablist` 인스턴스 override 로 다시 쓰면 크롬 정의가 두 곳이 되고,
 * 패널 골격(`panel-header` 줄이 몇 개인가)도 패널마다 달라진다 — 실제로 DataTable/Monitor 가
 * 그 상태였다.
 *
 * **`TabPanel` = `.panel-contents`** (2026-08-30 Monitor 표준화, 2026-09-05 `panelContents()`
 * 헬퍼 경유로 전환). 스크롤·패딩·배경을 갖는
 * 본문은 탭 **안**이다. Monitor 만 `.panel-contents` 가 `Tabs` 를 감싸고 `TabPanel` 은
 * 로컬 클래스(`.monitor-tab-panel`)라, 탭 줄까지 본문 크롬을 받고 스크롤 규칙이 두 곳에
 * 있었다. `Tabs` 가 탭 줄만 감싸고 본문을 형제 `.panel-contents` 에 두는 DataTable 편집기
 * 형태는 `TabPanel` 자체를 쓰지 않으므로 이 조항의 대상이 아니다.
 */

const BUILDER_ROOT = resolve(__dirname, "../..");

async function collectTsxFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "dist") continue;
      out.push(...(await collectTsxFiles(full)));
    } else if (e.name.endsWith(".tsx") && !e.name.includes(".test.")) {
      out.push(full);
    }
  }
  return out;
}

describe("패널 탭 구조 가드", () => {
  it("`.panel-tablist` 를 쓰는 곳은 `.panel-header.panel-tabrow` 래퍼를 함께 둔다", async () => {
    const files = await collectTsxFiles(BUILDER_ROOT);
    const offenders: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf-8");
      if (!source.includes("panel-tablist")) continue;
      // 탭 컴포넌트를 분리한 파일(TabList 만 렌더)은 마운트 파일이 래퍼를 갖는다 —
      // 같은 패널 디렉터리 안에서 확인한다.
      if (source.includes("panel-header panel-tabrow")) continue;
      const dir = resolve(file, "..", "..");
      const siblings = await collectTsxFiles(dir);
      const wrapped = await Promise.all(
        siblings.map(async (s) =>
          (await readFile(s, "utf-8")).includes("panel-header panel-tabrow"),
        ),
      );
      if (!wrapped.some(Boolean)) offenders.push(relative(BUILDER_ROOT, file));
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("`TabPanel` 은 곧 `.panel-contents` 다 (스크롤 영역이 탭 밖으로 나가지 않는다)", async () => {
    const files = await collectTsxFiles(BUILDER_ROOT);
    const offenders: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf-8");
      for (const match of source.matchAll(/<TabPanel\b([\s\S]*?)>/g)) {
        const attrs = match[1];
        // `panelContents()` 헬퍼 경유가 정본 (PanelContents.tsx 주석) — 리터럴은
        // 아직 옮기지 않은 파일용으로만 남긴다. 손으로 적는 이름은 오타를 못 막는다.
        if (/className=\{panelContents\(/.test(attrs)) continue;
        if (/className="panel-contents/.test(attrs)) continue;
        const line = source.slice(0, match.index).split("\n").length;
        offenders.push(`${relative(BUILDER_ROOT, file)}:${line}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("구조 클래스는 패널별 twin 을 만들지 않는다 (CSS 0건 이름 중복 차단)", async () => {
    // 오버라이드가 필요하면 조상 스코프(`.{도메인}-panel .panel-tablist`)로 건다 —
    // 아무 규칙도 없는 `{도메인}-panel-tablist` 류는 이름만 늘리고 막아 주는 것이 없다.
    const files = await collectTsxFiles(BUILDER_ROOT);
    const offenders: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf-8");
      const m = source.match(/[a-z]+-panel-(tabs|tabrow|tablist)\b/g);
      if (m)
        offenders.push(
          `${relative(BUILDER_ROOT, file)}: ${[...new Set(m)].join(", ")}`,
        );
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("탭 바는 RAC Tabs 경유 — 수동 button 탭 마크업 0건", async () => {
    const files = await collectTsxFiles(BUILDER_ROOT);
    const offenders: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf-8");
      // 종전 결함 형태: `<button className={... ? "active" : ""}>` 로 손수 만든 탭 바
      if (/className=\{`[a-z-]*tab[^`]*\$\{[^}]*"active"/.test(source)) {
        offenders.push(relative(BUILDER_ROOT, file));
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
