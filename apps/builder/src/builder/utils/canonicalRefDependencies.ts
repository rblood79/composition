import type { Element } from "../../types/core/store.types";
import {
  getCanonicalRefTarget,
  isCanonicalRefElement,
  resolveCanonicalRefMaster,
} from "./canonicalRefResolution";

function buildChildrenMap(elements: Iterable<Element>): Map<string, Element[]> {
  const childrenMap = new Map<string, Element[]>();
  for (const element of elements) {
    if (!element.parent_id) continue;
    const bucket = childrenMap.get(element.parent_id) ?? [];
    bucket.push(element);
    childrenMap.set(element.parent_id, bucket);
  }
  return childrenMap;
}

function collectSubtree(
  root: Element,
  childrenMap: Map<string, Element[]>,
  output: Element[],
  seen: Set<string>,
): void {
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (seen.has(current.id)) continue;
    seen.add(current.id);
    output.push(current);
    const children = childrenMap.get(current.id) ?? [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]);
    }
  }
}

export function includeCanonicalRefDependencies(
  scopedElements: Element[],
  allElements: Iterable<Element>,
): Element[] {
  if (scopedElements.length === 0) return scopedElements;

  const allElementList = Array.from(allElements);
  const childrenMap = buildChildrenMap(allElementList);
  const output: Element[] = [];
  const seen = new Set<string>();
  const scanQueue: Element[] = [];

  for (const element of scopedElements) {
    if (seen.has(element.id)) continue;
    seen.add(element.id);
    output.push(element);
    scanQueue.push(element);
  }

  while (scanQueue.length > 0) {
    const element = scanQueue.shift()!;
    if (!isCanonicalRefElement(element)) continue;
    const ref = getCanonicalRefTarget(element);
    if (!ref) continue;
    const master = resolveCanonicalRefMaster(ref, allElementList);
    if (!master || seen.has(master.id)) continue;

    const beforeLength = output.length;
    collectSubtree(master, childrenMap, output, seen);
    for (let index = beforeLength; index < output.length; index += 1) {
      scanQueue.push(output[index]);
    }
  }

  return output;
}
