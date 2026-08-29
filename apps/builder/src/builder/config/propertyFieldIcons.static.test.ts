import { describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ICONLESS_FIELD_KINDS,
  KIND_ICONS,
  PROP_KEY_ICONS,
  resolvePropertyFieldIcon,
} from "./propertyFieldIcons";

/**
 * Properties 필드 아이콘 레지스트리 정합 가드.
 *
 * 필드는 catalog `PropContract` 에서 **동적 생성**되므로 레지스트리도 catalog 를
 * 따라가야 한다. 세 가지가 어긋날 수 있다:
 *
 * 1. **dead entry** — catalog 에서 사라진 key 가 레지스트리에 남는다.
 * 2. **미등재 공유 key** — 2개+ 컴포넌트가 쓰는 새 key 가 kind 기본으로만 떨어진다.
 *    (등재 기준 = `actionIcons.ts` 와 같은 "2개 이상 surface" 원칙)
 * 3. **kind 구멍** — 계약에 새 `InspectorFieldKind` 가 추가되면 그 kind 의 모든
 *    필드가 아이콘 없이 렌더된다.
 */

const CATALOG_BINDINGS = resolve(
  __dirname,
  "../../../../../packages/shared/src/catalog/bindings",
);
const CATALOG_TYPES = resolve(
  __dirname,
  "../../../../../packages/shared/src/catalog/types.ts",
);

async function collectBindingFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) out.push(...(await collectBindingFiles(full)));
    else if (e.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

/** binding 파일에서 inspector PropContract 를 읽는다 (`source.kind` 는 제외). */
async function readCatalogKeys(): Promise<{
  keyComponents: Map<string, Set<string>>;
  keyKinds: Map<string, Set<string>>;
  kinds: Set<string>;
}> {
  const files = await collectBindingFiles(CATALOG_BINDINGS);
  const keyComponents = new Map<string, Set<string>>();
  const keyKinds = new Map<string, Set<string>>();
  const kinds = new Set<string>();
  for (const file of files) {
    const source = await readFile(file, "utf8");
    const component = file.split("/").pop()!.replace(".binding.ts", "");
    for (const m of source.matchAll(/(\w+)\s*:\s*\{\s*kind:\s*"([a-z-]+)"/g)) {
      const [, key, kind] = m;
      if (kind === "rac" || kind === "internal") continue;
      kinds.add(kind);
      if (!keyComponents.has(key)) keyComponents.set(key, new Set());
      keyComponents.get(key)!.add(component);
      if (!keyKinds.has(key)) keyKinds.set(key, new Set());
      keyKinds.get(key)!.add(kind);
    }
  }
  return { keyComponents, keyKinds, kinds };
}

describe("Properties 필드 아이콘 레지스트리", () => {
  it("등재 key 는 모두 catalog 에 존재한다 (dead entry 0)", async () => {
    const { keyComponents } = await readCatalogKeys();
    const dead = Object.keys(PROP_KEY_ICONS).filter(
      (key) => !keyComponents.has(key),
    );
    expect(dead).toEqual([]);
  });

  it("등재 key 는 2개 이상 컴포넌트가 공유하는 것만이다", async () => {
    const { keyComponents } = await readCatalogKeys();
    const singleUse = Object.keys(PROP_KEY_ICONS).filter(
      (key) => (keyComponents.get(key)?.size ?? 0) < 2,
    );
    expect(singleUse).toEqual([]);
  });

  it("2개 이상 컴포넌트가 공유하는 key 는 모두 등재돼 있다", async () => {
    const { keyComponents, keyKinds } = await readCatalogKeys();
    const unregistered = [...keyComponents.entries()]
      .filter(([key, comps]) => {
        if (comps.size < 2 || key in PROP_KEY_ICONS) return false;
        // 아이콘을 두지 않기로 한 kind 로만 쓰이는 key 는 등재 대상이 아니다.
        const kinds = keyKinds.get(key) ?? new Set<string>();
        return ![...kinds].every((kind) => ICONLESS_FIELD_KINDS.has(kind));
      })
      .map(([key, comps]) => `${key} (${comps.size} components)`);
    expect(unregistered).toEqual([]);
  });

  it("InspectorFieldKind 전체에 기본 아이콘이 있다", async () => {
    const types = await readFile(CATALOG_TYPES, "utf8");
    const union = types.slice(
      types.indexOf("export type InspectorFieldKind ="),
    );
    const declared = [
      ...union.slice(0, union.indexOf(";")).matchAll(/"([a-z-]+)"/g),
    ].map((m) => m[1]);
    expect(declared.length).toBeGreaterThan(0);
    const uncovered = declared.filter(
      (kind) => !(kind in KIND_ICONS) && !ICONLESS_FIELD_KINDS.has(kind),
    );
    expect(uncovered).toEqual([]);
  });

  it("catalog 에 실재하는 모든 필드가 아이콘을 얻는다 (제외 kind 만 undefined)", async () => {
    const { keyComponents, kinds } = await readCatalogKeys();
    const uncovered: string[] = [];
    for (const key of keyComponents.keys()) {
      for (const kind of kinds) {
        if (ICONLESS_FIELD_KINDS.has(kind)) continue;
        if (!resolvePropertyFieldIcon(key, kind))
          uncovered.push(`${key}/${kind}`);
      }
    }
    expect(uncovered).toEqual([]);
  });

  it("제외 kind 는 key 재정의가 있어도 아이콘을 내지 않는다", () => {
    for (const kind of ICONLESS_FIELD_KINDS) {
      expect(resolvePropertyFieldIcon("size", kind)).toBeUndefined();
      expect(resolvePropertyFieldIcon("iconName", kind)).toBeUndefined();
    }
  });
});
