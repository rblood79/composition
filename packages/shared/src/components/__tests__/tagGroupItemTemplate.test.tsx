import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { resolveSlotComposition } from "../../catalog/slotRoles";
import type { TagItemTemplate } from "../../types";
import { TagGroup } from "../TagGroup";
import {
  renderTagLeadingSlot,
  resolveTagLeadingSlotSource,
} from "../tagLeadingSlot";

/**
 * ADR-229 Phase 1 — TagGroup chip 이 item template (Components 페이지 `component-tag-item-*` origin)
 * 을 적용하는 DOM 계약. builder Skia projection (`appendTagRowProjection`) 과 같은 규칙:
 *  - rootStyles.base 는 모든 chip inline style, selected 는 선택 chip 에 overlay
 *  - slot 구성으로 leading (icon/avatar) 존재 gating — avatar slot 이 없으면 avatar 데이터를 안 그린다
 *  - slot 자식 style 의 크기 (icon fontSize · avatar width) 가 inline 으로 실린다
 *  - template null = legacy → 기존 chip 그대로
 * renderToStaticMarkup 으로 정적 HTML 을 검사한다 (RAC 의 items 경로 = `useResolvedCollectionItems`).
 */

const ITEMS = [
  { id: "a", label: "A", icon: "star", avatar: "https://x/a.png" },
  { id: "b", label: "B", icon: "inbox" },
  { id: "c", label: "C" },
];

function slotChildren(roles: ReadonlyArray<"icon" | "avatar" | "label">) {
  return roles.map((role) =>
    role === "icon"
      ? { type: "Icon", props: { slot: "icon", style: { fontSize: 20 } } }
      : role === "avatar"
        ? { type: "Avatar", props: { slot: "avatar", style: { width: 24 } } }
        : { type: "Text", props: { slot: "label" } },
  );
}

function template(input: {
  roles?: ReadonlyArray<"icon" | "avatar" | "label">;
  base?: Record<string, unknown> | null;
  selected?: Record<string, unknown> | null;
}): TagItemTemplate {
  const composition = resolveSlotComposition(
    slotChildren(input.roles ?? ["icon", "avatar", "label"]),
  );
  return {
    composition,
    selectedComposition: composition,
    rootStyles: { base: input.base ?? null, selected: input.selected ?? null },
  };
}

function html(itemTemplate: TagItemTemplate | null): string {
  return renderToStaticMarkup(
    <TagGroup
      label="Tags"
      items={ITEMS as never}
      selectionMode="multiple"
      selectedKeys={["b"]}
      itemTemplate={itemTemplate}
    />,
  );
}

function chipsOf(markup: string): string[] {
  // 미러 (maxRows 없음 → 미러 없음) 가 없으므로 .react-aria-Tag 는 실제 chip 뿐.
  return markup.split('class="react-aria-Tag"').slice(1);
}

describe("ADR-229 Phase 1 — TagGroup chip item template (DOM)", () => {
  it("template 이 없으면 chip 은 종전 그대로 (avatar > icon · inline style 없음)", () => {
    const chips = chipsOf(html(null));
    expect(chips).toHaveLength(3);
    expect(chips[0]).toContain("tag-leading-avatar");
    expect(chips[0]).not.toContain("tag-leading-icon");
    expect(chips[1]).toContain("tag-leading-icon");
    expect(chips[2]).not.toContain("tag-leading-");
    expect(chips[0].startsWith(" style=")).toBe(false);
  });

  it("rootStyles.base 는 모든 chip 에, selected 는 선택 chip 에만 overlay 된다", () => {
    const chips = chipsOf(
      html(
        template({
          base: { paddingLeft: 20, borderRadius: 999 },
          selected: { borderColor: "#ff0000" },
        }),
      ),
    );
    expect(chips[0]).toContain("padding-left:20px;border-radius:999px");
    expect(chips[0]).not.toContain("border-color");
    expect(chips[1]).toContain("padding-left:20px;border-radius:999px;border-color:#ff0000");
    expect(chips[2]).not.toContain("border-color");
  });

  it("slot 존재 gating — Avatar slot 이 없으면 avatar 데이터가 있어도 icon 을 그리고, icon slot 이 없으면 avatar 만", () => {
    const noAvatar = chipsOf(html(template({ roles: ["icon", "label"] })));
    expect(noAvatar[0]).not.toContain("tag-leading-avatar");
    expect(noAvatar[0]).toContain("tag-leading-icon");
    expect(noAvatar[2]).not.toContain("tag-leading-");

    const noIcon = chipsOf(html(template({ roles: ["avatar", "label"] })));
    expect(noIcon[0]).toContain("tag-leading-avatar");
    expect(noIcon[1]).not.toContain("tag-leading-");
  });

  it("slot 자식 style 의 크기가 leading 요소 inline 으로 실린다 (avatar width 24 · icon fontSize 20)", () => {
    const chips = chipsOf(html(template({})));
    expect(chips[0]).toMatch(/tag-leading-avatar[^>]*style="width:24px;height:24px"/);
    expect(chips[1]).toMatch(/style="width:20px;height:20px;font-size:20px"[^>]*class="react-aria-Icon tag-leading-icon"/);
  });

  it("resolveTagLeadingSlotSource / renderTagLeadingSlot 단위 계약 (Skia `resolveLeadingSlot` 과 같은 판정)", () => {
    const composition = resolveSlotComposition(slotChildren(["icon", "label"]));
    expect(
      resolveTagLeadingSlotSource({ icon: "star", avatar: "/a.png" }, composition),
    ).toEqual({ avatar: null, icon: "star", size: 20 });
    expect(resolveTagLeadingSlotSource({ icon: "star", avatar: "/a.png" }, null)).toEqual({
      avatar: "/a.png",
      icon: "star",
      size: undefined,
    });
    expect(renderTagLeadingSlot({}, composition)).toBeNull();
    expect(renderTagLeadingSlot({ avatar: "/a.png" }, composition)).toBeNull();
  });
});
