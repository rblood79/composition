// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import type { Element } from "@composition/shared";
import { useBodyElement } from "../hooks/useBodyElement";

it("Publish shell에 페이지 grid/너비/padding을 중복 적용하지 않는다", async () => {
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  function Page() {
    useBodyElement([{id:"body",type:"body",parent_id:null,props:{style:{display:"grid",gridTemplateColumns:"repeat(3, 320px)",width:1100,padding:24,color:"red",fontFamily:"monospace"}}}] as Element[]);
    return <div style={{display:"grid",gridTemplateColumns:"repeat(3, 320px)",width:1100,padding:24}}>Charts</div>;
  }
  await act(async()=>root.render(<Page />));
  expect(document.body.style.display).toBe("");expect(document.body.style.width).toBe("");expect(document.body.style.padding).toBe("");
  expect(document.body.style.color).toBe("red");expect(document.body.style.fontFamily).toBe("monospace");
  expect(host.firstElementChild?.getAttribute("style")).toContain("width: 1100px");
  await act(async()=>root.unmount());host.remove();expect(document.body.style.color).toBe("");
});
