import { act, createEvent, fireEvent } from "@testing-library/react";
import { vi } from "vitest";

/**
 * ADR-284 Phase 5 — a collection's drag and drop through RAC's own path: lists of one collection
 * (a drag carries the collection's type — a list accepts its own collection's items and, Phase 6,
 * the collections its drop rules write), the source list dragging too (a rule makes a list drag),
 * jsdom's empty rects laid out as rows 40px high (`ListDropTargetDelegate` reads them; a list's
 * `data-drop-left` places it), a `DataTransfer` RAC writes and reads.
 */
export const DROP_ROW = 40;
export const DROP_LIST = "[role=grid],[role=listbox],[role=treegrid]";
export const DROP_ITEM = "[data-key]:is([role=row],[role=option])";
export function dropRects() {
  const original = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const rect = (left: number, top: number, height: number) =>
        ({
          x: left,
          y: top,
          left,
          top,
          right: left + 200,
          bottom: top + height,
          width: 200,
          height,
          toJSON() {},
        }) as DOMRect;
      const list = this.closest(DROP_LIST);
      const left = Number(list?.getAttribute("data-drop-left") ?? 0);
      const item = this.closest(DROP_ITEM);
      if (item && list) {
        const items = [...list.querySelectorAll(DROP_ITEM)].filter(
          (row) => row.closest(DROP_LIST) === list,
        );
        return rect(left, items.indexOf(item) * DROP_ROW, DROP_ROW);
      }
      if (this.matches(DROP_LIST))
        return rect(
          left,
          0,
          Math.max(this.querySelectorAll(DROP_ITEM).length, 1) * DROP_ROW,
        );
      return original.call(this);
    },
  );
}
export function dataTransfer() {
  const data = new Map<string, string>();
  const items: {
    kind: string;
    type: string;
    getAsString: (cb: (s: string) => void) => void;
  }[] = [];
  return {
    get items() {
      return Object.assign([...items], {
        add(value: string, type: string) {
          data.set(type, value);
          items.push({ kind: "string", type, getAsString: (cb) => cb(value) });
        },
      });
    },
    get types() {
      return [...data.keys()];
    },
    files: [],
    dropEffect: "none",
    effectAllowed: "all",
    setData(type: string, value: string) {
      this.items.add(value, type);
    },
    getData: (type: string) => data.get(type) ?? "",
    setDragImage() {},
    clearData() {},
  };
}

/** RAC's drag from `from` onto `to` at (x, y): start · enter · over (twice — RAC settles) · drop · end. */
export async function racDrag(
  from: Element,
  to: Element,
  x: number,
  y: number,
): Promise<void> {
  const transfer = dataTransfer();
  const fire = (
    element: Element,
    name: "dragStart" | "dragEnter" | "dragOver" | "drop" | "dragEnd",
    at: [number, number],
  ) => {
    const created = createEvent[name](element, { dataTransfer: transfer });
    Object.defineProperty(created, "clientX", { value: at[0] });
    Object.defineProperty(created, "clientY", { value: at[1] });
    fireEvent(element, created);
  };
  await act(async () => fire(from, "dragStart", [x + 10, 10]));
  await act(() => new Promise((done) => setTimeout(done, 20)));
  await act(async () => {
    fire(to, "dragEnter", [x, y]);
    fire(to, "dragOver", [x, y]);
  });
  await act(async () => {
    await new Promise((done) => setTimeout(done, 20));
    fire(to, "dragOver", [x, y]);
  });
  await act(async () => fire(to, "drop", [x, y]));
  await act(async () => {
    fire(from, "dragEnd", [x, y]);
    await new Promise((done) => setTimeout(done, 50));
  });
}
