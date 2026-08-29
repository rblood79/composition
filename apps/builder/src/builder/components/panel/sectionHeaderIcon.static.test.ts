import { describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";

/**
 * section header 는 **타이틀(+actions)만** — 아이콘은 패널 헤더 전용 장치다 (2026-08-30).
 *
 * **왜 층을 나누나**: `.panel-icon` 은 좌측 rail 아이콘과 짝을 이루는 패널 식별 장치이고
 * (PanelHeader 19/19 사용), 섹션 타이틀은 한 패널 안에서 이미 유일해 아이콘의 변별력이 없다.
 * 두 층 모두 아이콘을 달면 계층 신호가 무너진다.
 *
 * **왜 "빼는" 통일인가 (실측 2026-08-30)**: 아이콘을 쓰던 섹션은 54개 중 9개(17%)뿐이었고,
 * 나머지 45개의 큰 몫은 catalog 파생 섹션(`GenericFieldRenderer`/`CatalogInspectorFields` 가
 * `field.section` 문자열로 생성)이라 **아이콘을 넘길 채널 자체가 없다**. 채우는 방향의 통일은
 * catalog 계약에 icon 축을 신설해야 하므로(D2/D3 확장), 빼는 방향이 유일하게 도달 가능하다.
 * 부수 효과로 dead CSS(`.section-header .section-icon` — Section 이 wrapper 를 렌더하지 않아
 * 영구 무매칭)와 하드코딩 색(`--color-gray-400`, 패널 아이콘의 `--fg-muted` 와 불일치)도 사라졌다.
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

/** `<Section` / `<PropertySection` 여는 태그 본문을 중괄호 깊이 기준으로 잘라 낸다. */
function openingTags(source: string): string[] {
  const out: string[] = [];
  const re = /<(Section|PropertySection)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    let depth = 0;
    let i = m.index + m[0].length;
    for (; i < source.length; i++) {
      const c = source[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
    }
    out.push(source.slice(m.index, i));
  }
  return out;
}

describe("section header 아이콘 금지 가드", () => {
  it("`<Section` / `<PropertySection` 에 icon prop 0건", async () => {
    const files = await collectTsxFiles(BUILDER_ROOT);
    const offenders: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf-8");
      for (const tag of openingTags(source)) {
        if (/\bicon=/.test(tag)) {
          offenders.push(`${relative(BUILDER_ROOT, file)}: ${tag.slice(0, 80)}`);
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("SectionProps 에 icon 필드가 없다 (채널 자체를 닫는다)", async () => {
    const source = await readFile(resolve(__dirname, "Section.tsx"), "utf-8");
    const props = source.slice(
      source.indexOf("export interface SectionProps"),
      source.indexOf("export const Section"),
    );
    expect(props).not.toMatch(/\bicon\?:/);
  });

  it("panel-system.css 에 dead `.section-icon` 규칙이 없다", async () => {
    const css = await readFile(
      resolve(__dirname, "../styles/panel-system.css"),
      "utf-8",
    );
    expect(css).not.toContain("section-icon");
  });
});
