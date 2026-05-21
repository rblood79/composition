type ExportRootKind = "children" | "nodes" | "reusableComponents";

export interface NormalizedCompositeNode {
  id: string;
  type?: string;
  name?: string;
  ref?: string;
  reusable?: boolean;
  descendants?: Record<string, NormalizedDescendantPatch>;
  slot?: false | string[];
  children?: NormalizedCompositeNode[];
  [key: string]: unknown;
}

export interface NormalizedDescendantPatch {
  [key: string]: unknown;
}

export interface NormalizedCompositeFixture {
  source: string;
  rootKind: ExportRootKind;
  roots: NormalizedCompositeNode[];
  allNodes: NormalizedCompositeNode[];
  selectedNodeIds: string[];
}

export interface CompositeFixtureStats {
  reusable: number;
  refs: number;
  refsWithDescendants: number;
  slotHosts: number;
}

export function normalizeCompositeRacExport(
  input: unknown,
  source: string,
): NormalizedCompositeFixture {
  const root = readRecord(input, source);
  const selectedNodeIds = readSelectedNodeIds(root);
  const { rootKind, roots } = readRootNodes(root, source);
  const allNodes = [
    ...collectRootNodes(root, rootKind, source),
    ...collectDetachedNodes(root, rootKind, source),
  ];

  return {
    source,
    rootKind,
    roots,
    allNodes,
    selectedNodeIds,
  };
}

export function getCompositeFixtureStats(
  fixture: NormalizedCompositeFixture,
): CompositeFixtureStats {
  return {
    reusable: fixture.allNodes.filter((node) => node.reusable === true).length,
    refs: fixture.allNodes.filter((node) => node.type === "ref").length,
    refsWithDescendants: fixture.allNodes.filter(
      (node) => node.type === "ref" && isRecord(node.descendants),
    ).length,
    slotHosts: fixture.allNodes.filter((node) => node.slot !== undefined)
      .length,
  };
}

export function findNormalizedNodeById(
  fixture: NormalizedCompositeFixture,
  id: string,
): NormalizedCompositeNode | undefined {
  return fixture.allNodes.find((node) => node.id === id);
}

export function findNormalizedNodeByName(
  fixture: NormalizedCompositeFixture,
  name: string,
): NormalizedCompositeNode | undefined {
  return fixture.allNodes.find((node) => node.name === name);
}

function readRootNodes(
  root: Record<string, unknown>,
  source: string,
): { rootKind: ExportRootKind; roots: NormalizedCompositeNode[] } {
  if (Array.isArray(root.children)) {
    return {
      rootKind: "children",
      roots: normalizeNodeArray(root.children, source),
    };
  }

  if (Array.isArray(root.nodes)) {
    return {
      rootKind: "nodes",
      roots: normalizeNodeArray(root.nodes, source),
    };
  }

  if (Array.isArray(root.reusableComponents)) {
    return {
      rootKind: "reusableComponents",
      roots: normalizeNodeArray(root.reusableComponents, source),
    };
  }

  if (isRecord(root.reusableComponents)) {
    return {
      rootKind: "reusableComponents",
      roots: normalizeNodeArray(Object.values(root.reusableComponents), source),
    };
  }

  throw new Error(
    `${source}: unsupported fixture root shape. Expected children[], nodes[], or reusableComponents.`,
  );
}

function normalizeNodeArray(
  values: unknown[],
  source: string,
): NormalizedCompositeNode[] {
  return values.map((value, index) => normalizeNode(value, source, index));
}

function normalizeNode(
  value: unknown,
  source: string,
  index: number,
): NormalizedCompositeNode {
  const record = readRecord(value, `${source} node[${index}]`);
  const id = readString(record.id, `${source} node[${index}].id`);
  const children = Array.isArray(record.children)
    ? normalizeNodeArray(record.children, source)
    : undefined;
  const slot = normalizeSlot(record.slot, `${source} node[${index}].slot`);
  const descendants = isRecord(record.descendants)
    ? normalizeDescendants(record.descendants)
    : undefined;

  return {
    ...record,
    id,
    ...(typeof record.type === "string" ? { type: record.type } : {}),
    ...(typeof record.name === "string" ? { name: record.name } : {}),
    ...(typeof record.ref === "string" ? { ref: record.ref } : {}),
    ...(record.reusable === true ? { reusable: true } : {}),
    ...(descendants ? { descendants } : {}),
    ...(slot !== undefined ? { slot } : {}),
    ...(children ? { children } : {}),
  };
}

function normalizeDescendants(
  descendants: Record<string, unknown>,
): Record<string, NormalizedDescendantPatch> {
  const result: Record<string, NormalizedDescendantPatch> = {};
  for (const [path, patch] of Object.entries(descendants)) {
    if (isRecord(patch)) result[path] = patch;
  }
  return result;
}

function normalizeSlot(
  value: unknown,
  label: string,
): false | string[] | undefined {
  if (value === undefined) return undefined;
  if (value === false) return false;
  if (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === "string")
  ) {
    return [...value];
  }
  throw new Error(`${label}: slot must be false or string[]`);
}

function collectRootNodes(
  root: Record<string, unknown>,
  rootKind: ExportRootKind,
  source: string,
): NormalizedCompositeNode[] {
  const result: NormalizedCompositeNode[] = [];
  collectNodeLikeObjects(root[rootKind], source, result);
  return result;
}

function collectDetachedNodes(
  root: Record<string, unknown>,
  rootKind: ExportRootKind,
  source: string,
): NormalizedCompositeNode[] {
  const result: NormalizedCompositeNode[] = [];
  for (const [key, value] of Object.entries(root)) {
    if (key === rootKind) continue;
    collectNodeLikeObjects(value, source, result);
  }
  return result;
}

function collectNodeLikeObjects(
  value: unknown,
  source: string,
  result: NormalizedCompositeNode[],
): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectNodeLikeObjects(entry, source, result));
    return;
  }

  if (!isRecord(value)) return;

  if (typeof value.id === "string") {
    const index = result.length;
    result.push(normalizeNode(value, `${source} detached`, index));
    Object.entries(value).forEach(([key, entry]) => {
      if (key !== "id") collectNodeLikeObjects(entry, source, result);
    });
    return;
  }

  Object.values(value).forEach((entry) =>
    collectNodeLikeObjects(entry, source, result),
  );
}

function readSelectedNodeIds(root: Record<string, unknown>): string[] {
  if (
    Array.isArray(root.selectedNodeIds) &&
    root.selectedNodeIds.every((value) => typeof value === "string")
  ) {
    return [...root.selectedNodeIds];
  }

  const selection = root.selection;
  if (
    isRecord(selection) &&
    Array.isArray(selection.selectedNodeIds) &&
    selection.selectedNodeIds.every((value) => typeof value === "string")
  ) {
    return [...selection.selectedNodeIds];
  }

  return [];
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label}: expected object`);
  }
  return value;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}: expected non-empty string`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
