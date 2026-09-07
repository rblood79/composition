/**
 * 팔레트에 노출된 컴포넌트가 publish 레지스트리에도 있는지 (ADR-194 R6).
 *
 * **왜 필요한가**: builder 의 `componentRegistrationContract` 는 `rendererMap` /
 * `TAG_SPEC_MAP` / `getDefaultProps` 3축만 본다 (`RegistryName` 이 그 셋뿐). publish 의
 * `ComponentRegistry` 는 어느 게이트의 감시 밖이라, 새 컴포넌트를 등록하면서 여기만
 * 빠뜨리면 **빌더에서는 멀쩡한데 배포본에서만 안 그려진다** — 그리고 그건 배포 후에야
 * 드러난다. ADR-194 Phase 0 에서 이 공백을 실측하고 본 테스트를 추가했다.
 *
 * **ratchet 형태인 이유**: 착수 시점에 이미 10종이 빠져 있었다. 그걸 다 메우는 것은
 * 본 ADR 의 scope 가 아니므로(각각 별개 사유가 있을 수 있다) 현 상태를 baseline 으로
 * 얼리고 **새로 생기는 누락만** 막는다. baseline 은 줄어들 수만 있다 —
 * `componentRegistrationContract` 의 BASELINE_RATCHET 과 같은 규율이다.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..", "..");
const REGISTRY_FILE = join(
  REPO_ROOT,
  "apps/publish/src/registry/ComponentRegistry.tsx",
);
const PALETTE_FILE = join(
  REPO_ROOT,
  "apps/builder/src/builder/panels/components/paletteItems.ts",
);

/**
 * 착수 시점(2026-09-08) 누락 baseline. 여기 있는 type 은 publish 미등록이 **알려진**
 * 상태다. 메우면 이 목록에서 지운다 — 목록은 커질 수 없다.
 *
 * `frame` / `Slot` 은 캔버스 전용 구조 컨테이너라 publish 렌더 대상이 아닐 수 있다
 * (판정은 별도 작업). 나머지 8종은 실제 공백으로 보인다.
 */
const KNOWN_MISSING = new Set([
  "ColorField",
  "DropZone",
  "FileTrigger",
  "frame",
  "IconButton",
  "Menu",
  "Nav",
  "Section",
  "Slot",
  "TextArea",
]);

function paletteTypes(): string[] {
  const source = readFileSync(PALETTE_FILE, "utf8");
  const order = source.slice(source.indexOf("const PALETTE_ORDER"));
  const matches = order.matchAll(/\{\s*type:\s*"([A-Za-z_]+)"\s*,\s*source:/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

function registeredTypes(): Set<string> {
  const source = readFileSync(REGISTRY_FILE, "utf8");
  const matches = source.matchAll(/registerComponent\(\s*"([A-Za-z_]+)"/g);
  return new Set([...matches].map((m) => m[1]));
}

describe("publish ComponentRegistry 커버리지 (ADR-194 R6)", () => {
  it("팔레트 목록과 레지스트리 목록을 실제로 읽어냈다", () => {
    // 정규식이 조용히 0건을 내면 아래 테스트가 vacuous 하게 통과한다.
    expect(paletteTypes().length).toBeGreaterThan(50);
    expect(registeredTypes().size).toBeGreaterThan(50);
  });

  it("팔레트 노출 컴포넌트는 publish 에도 등록돼 있다 (baseline 예외 제외)", () => {
    const registered = registeredTypes();
    const missing = paletteTypes().filter(
      (type) => !registered.has(type) && !KNOWN_MISSING.has(type),
    );
    expect(missing).toEqual([]);
  });

  it("baseline 은 줄어들 수만 있다 — 해소된 항목은 목록에서 지운다", () => {
    const registered = registeredTypes();
    const palette = new Set(paletteTypes());
    const stale = [...KNOWN_MISSING].filter(
      (type) => registered.has(type) || !palette.has(type),
    );
    expect(stale).toEqual([]);
  });

  it("Chart 는 등록돼 있다 (ADR-194)", () => {
    expect(registeredTypes().has("Chart")).toBe(true);
  });
});
