import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ADR-923 착수 5 재확인 (2026-09-04) — 3.6 (implicit child style → batch 패치) 의 fit-content 폭
 * 재측정 write 는 어느 경로에서도 최종 rect 에 닿지 않는 dead 경로였다 (write 를 1px 로 강제해도
 * parity 1110 · layout unit 482 · live 무반응). 삭제 후 되살아나지 않도록 원문을 고정한다 — 3.6 이
 * batch 에 쓰는 치수 키는 fontSize 변경 시의 `height` 하나뿐이고, `style.width` write 는 root 의
 * pageW (Step 5) 만 남는다. 폭 축은 자식 visit 의 스칼라 + 엔진 intrinsic 해소 (ADR-165/170) 소유.
 */
describe("fullTreeLayout 3.6 — 폭 재측정 write 부재 (dead 경로 삭제 고정)", () => {
  const source = readFileSync(
    resolve(__dirname, "../fullTreeLayout.ts"),
    "utf8",
  );

  it("batch `style.width =` write 는 root pageW 하나뿐이다", () => {
    const writes = source.match(/\.style\.width = /g) ?? [];
    expect(writes).toHaveLength(1);
    expect(source).toMatch(/batch\[rootIdx\]\.style\.width = `\$\{pageW\}px`/);
  });

  it("3.6 에 fit-content 재측정 심볼이 없다", () => {
    for (const sym of [
      "isFitContentRemeasureWidth",
      "resolveFitContentRemeasureText",
      "resolveRemeasureChildProps",
      "childForWidth",
    ]) {
      expect(source.includes(sym), sym).toBe(false);
    }
  });
});
