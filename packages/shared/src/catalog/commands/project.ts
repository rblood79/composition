import { cloneNodeSubgraph } from "../document/clone";
import type {
  CatalogReader,
  CatalogToastPlacement,
  DefinitionEntry,
  EntryId,
  InstanceAddress,
  InteractionEntry,
  NodeEntry,
  NodeId,
  PageEntry,
  PageLayoutDeclaration,
  ProjectEntry,
  Scalar,
  StateVariableEntry,
  TemplateId,
  ThemeEntry,
  ThemePreset,
  TokenEntry,
  TokenType,
} from "../document/types";
import type { CatalogCommand } from "./compose";
import { CommandDraft, fail, sameAddress } from "./context";
import type { NewId } from "./materialize";
import { removeWithReferrers, subtree } from "./structure";

/**
 * ADR-248 Phase 4b project-level commands: pages, reusable page layouts, themes and their tokens,
 * state variables and interactions. All share the one project history (user decision 2026-09-30:
 * a single undo stack covers theme, page and interaction edits).
 */

const insertAt = <T>(
  list: readonly T[],
  index: number | undefined,
  item: T,
) => {
  const at =
    index === undefined || index < 0 || index > list.length
      ? list.length
      : index;
  return [...list.slice(0, at), item, ...list.slice(at)];
};
const listed = (project: ProjectEntry, ids: keyof ProjectEntry) =>
  project[ids] as readonly string[];

// ── Pages ──────────────────────────────────────────────────────────────────

/** A route must be unique among the project's pages (the pages list is project-scoped). */
function assertRouteFree(draft: CommandDraft, route: string, except?: string) {
  for (const id of draft.project().pageIds) {
    if (id === except) continue;
    const page = draft.read(id);
    if (page?.kind === "page" && page.route === route)
      fail("ROUTE_TAKEN", route);
  }
}

export const createPage =
  (input: {
    page: PageEntry;
    /** The page's node subtrees (every ID new). */
    entries?: readonly NodeEntry[];
    index?: number;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    assertRouteFree(draft, input.page.route);
    for (const entry of input.entries ?? []) draft.create(entry);
    draft.create(input.page);
    const project = draft.project();
    draft.write({
      ...project,
      pageIds: insertAt(project.pageIds, input.index, input.page.id),
    });
    return { label: input.label ?? "Add page", ops: draft.ops() };
  };

type PageFields = Pick<
  PageEntry,
  "name" | "route" | "parentId" | "placement" | "guideEntries"
>;
/** Page fields; an `undefined` value clears an optional field (parent, placement, guides). */
export const updatePage =
  (input: {
    id: EntryId<"page">;
    fields: { [K in keyof PageFields]?: PageFields[K] | undefined };
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const page = draft.page(input.id);
    if (input.fields.route !== undefined)
      assertRouteFree(draft, input.fields.route, page.id);
    const next = { ...page } as Record<string, unknown>;
    for (const [key, value] of Object.entries(input.fields))
      if (value === undefined) {
        if (key === "name" || key === "route") fail("PAGE_FIELD_REQUIRED", key);
        delete next[key];
      } else next[key] = structuredClone(value);
    draft.write(next as unknown as PageEntry);
    return { label: input.label ?? "Edit page", ops: draft.ops() };
  };

export const reorderPages =
  (input: {
    ids: readonly EntryId<"page">[];
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const project = draft.project();
    const current = new Set(project.pageIds);
    if (
      input.ids.length !== current.size ||
      input.ids.some((id) => !current.has(id))
    )
      fail("PAGE_ORDER_MISMATCH", "ids");
    draft.write({ ...project, pageIds: [...input.ids] });
    return { label: input.label ?? "Reorder pages", ops: draft.ops() };
  };

/**
 * Remove a page, its nodes and page-owned records. Interactions that navigate to it go; child
 * pages move up to its parent.
 */
export const removePage =
  (input: { id: EntryId<"page">; label?: string }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const page = draft.page(input.id);
    const project = draft.project();
    if (project.pageIds.length === 1) fail("LAST_PAGE", input.id);
    for (const referrerId of reader.referrersOf(input.id)) {
      const entry = draft.read(referrerId);
      if (entry?.kind === "page" && entry.parentId === input.id) {
        const next = { ...entry };
        if (page.parentId) next.parentId = page.parentId;
        else delete next.parentId;
        draft.write(next);
      }
    }
    const nodes = page.children.flatMap((id) => subtree(draft, id));
    draft.write({
      ...project,
      pageIds: project.pageIds.filter((id) => id !== input.id),
    });
    removeWithReferrers(draft, [input.id, ...nodes]);
    return { label: input.label ?? "Delete page", ops: draft.ops() };
  };

/** Copy a page after itself: new page, node copies and copies of its owned records. */
export const duplicatePage =
  (input: {
    id: EntryId<"page">;
    route: string;
    name: string;
    newId: NewId;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const page = draft.page(input.id);
    assertRouteFree(draft, input.route);
    const pageId = input.newId("page");
    const variables = new Map<string, EntryId<"stateVariable">>();
    const related: (StateVariableEntry | InteractionEntry)[] = [];
    for (const referrerId of reader.referrersOf(input.id)) {
      const entry = draft.read(referrerId);
      if (entry?.kind === "stateVariable" && entry.ownerId === input.id) {
        const id = input.newId("stateVariable");
        variables.set(entry.id, id);
        related.push({ ...structuredClone(entry), id, ownerId: pageId });
      }
    }
    const roots: NodeId[] = [];
    for (const rootId of page.children) {
      const clone = cloneNodeSubgraph(
        {
          getEntry: (id) => draft.read(id),
          referrersOf: (id) => reader.referrersOf(id),
        },
        rootId,
        () => input.newId("node"),
        (old) =>
          old.startsWith("project:stateVariable:")
            ? input.newId("stateVariable")
            : input.newId("interaction"),
      );
      for (const entry of clone.entries) draft.create(entry);
      for (const entry of clone.relatedEntries) {
        // Page variables the copied interactions set follow the page copy.
        if (
          entry.kind === "interaction" &&
          entry.action.opcode === "setState" &&
          variables.has(entry.action.variableId)
        )
          related.push({
            ...entry,
            action: {
              ...entry.action,
              variableId: variables.get(entry.action.variableId)!,
            },
          });
        else related.push(entry);
      }
      roots.push(clone.rootId);
    }
    const { id: _id, ...fields } = page;
    draft.create({
      ...structuredClone(fields),
      id: pageId,
      route: input.route,
      name: input.name,
      children: roots,
    });
    for (const entry of related) draft.create(entry);
    const project = draft.project();
    draft.write({
      ...project,
      pageIds: insertAt(
        project.pageIds,
        project.pageIds.indexOf(input.id) + 1,
        pageId,
      ),
      stateVariableIds: [
        ...project.stateVariableIds,
        ...related
          .filter((entry) => entry.kind === "stateVariable")
          .map((entry) => entry.id as EntryId<"stateVariable">),
      ],
      interactionIds: [
        ...project.interactionIds,
        ...related
          .filter((entry) => entry.kind === "interaction")
          .map((entry) => entry.id as EntryId<"interaction">),
      ],
    });
    return { label: input.label ?? "Duplicate page", ops: draft.ops() };
  };

/** The project's page grid (ADR-232 page layout declaration); `undefined` restores defaults. */
export const setPageLayoutSettings =
  (input: {
    pageLayout: PageLayoutDeclaration | undefined;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const { pageLayout: _layout, ...project } = draft.project();
    draft.write(
      input.pageLayout ? { ...project, pageLayout: input.pageLayout } : project,
    );
    return { label: input.label ?? "Page layout", ops: draft.ops() };
  };

/** Where the app's toasts show (S2 `ToastContainer` `placement`); `undefined` restores the default. */
export const setToastPlacement =
  (input: {
    placement: CatalogToastPlacement | undefined;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const { toastPlacement: _placement, ...project } = draft.project();
    draft.write(
      input.placement
        ? { ...project, toastPlacement: input.placement }
        : project,
    );
    return { label: input.label ?? "Toast placement", ops: draft.ops() };
  };

// ── Reusable page layouts ──────────────────────────────────────────────────

/** Declared slot positions of a layout template, in template order. */
function slotPaths(
  draft: CommandDraft,
  rootId: TemplateId,
): (readonly TemplateId[])[] {
  const out: (readonly TemplateId[])[] = [];
  const visit = (path: readonly TemplateId[]) => {
    const id = path[path.length - 1];
    const node = id.startsWith("lib:")
      ? draft.reader.library.templates.get(id as `lib:template:${string}`)
      : draft.node(id);
    if (!node) return;
    if (node.slot) out.push(path);
    for (const child of node.children) visit([...path, child as TemplateId]);
  };
  visit([rootId]);
  return out;
}

export const createLayout =
  (input: {
    name: string;
    /** The layout template: its root and descendants (every ID new); needs a declared slot. */
    entries: readonly NodeEntry[];
    rootId: NodeId;
    newId: NewId;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    for (const entry of input.entries) draft.create(entry);
    if (!slotPaths(draft, input.rootId).length)
      fail("LAYOUT_SLOT_REQUIRED", input.rootId);
    const definition: DefinitionEntry = {
      kind: "definition",
      id: input.newId("definition"),
      name: input.name.trim() || fail("NAME_REQUIRED", input.rootId),
      mode: "composite",
      accepts: {},
      defaults: {},
      visual: {},
      stateRules: {},
      templateRootId: input.rootId,
      usage: "layout",
    };
    draft.create(definition);
    const project = draft.project();
    draft.write({
      ...project,
      definitionIds: [...project.definitionIds, definition.id],
    });
    return { label: input.label ?? "Add layout", ops: draft.ops() };
  };

/** The library body: a page's one root, and the root of a layout made in the Builder. */
const BODY_DEFINITION = "lib:definition:type-body";

/** The layout instance a page body is, if any (page children = one layout instance). */
function pageLayoutInstance(
  draft: CommandDraft,
  page: PageEntry,
): NodeEntry | undefined {
  if (page.children.length !== 1) return undefined;
  const node = draft.node(page.children[0]);
  const definition = draft.read(node.definitionId);
  return definition?.kind === "definition" && definition.usage === "layout"
    ? node
    : undefined;
}
/** A layout whose template root is a body: applied, the page body itself becomes its instance. */
function bodyLayout(draft: CommandDraft, definition: DefinitionEntry): boolean {
  const root = definition.templateRootId
    ? draft.reader.getEntry(definition.templateRootId)
    : undefined;
  return root?.kind === "node" && root.definitionId === BODY_DEFINITION;
}
/**
 * The slot a page's content fills by default: the slot whose role (name) is `content`, else the
 * first required slot, else the first (the Builder's insert target on a page with a layout too).
 */
export function layoutContentSlotPath(
  reader: CatalogReader,
  definitionId: EntryId<"definition">,
): readonly TemplateId[] | undefined {
  const definition = reader.getEntry(definitionId);
  if (definition?.kind !== "definition" || !definition.templateRootId)
    return undefined;
  const slots: {
    path: readonly TemplateId[];
    slot: NonNullable<NodeEntry["slot"]>;
  }[] = [];
  const visit = (path: readonly TemplateId[]) => {
    const id = path[path.length - 1];
    const node = id.startsWith("lib:")
      ? reader.library.templates.get(id as `lib:template:${string}`)
      : reader.getEntry(id);
    if (!node || !("children" in node)) return;
    if ("slot" in node && node.slot) slots.push({ path, slot: node.slot });
    for (const child of node.children) visit([...path, child as TemplateId]);
  };
  visit([definition.templateRootId]);
  return (
    slots.find((item) => item.slot.name.trim().toLowerCase() === "content") ??
    slots.find((item) => item.slot.required) ??
    slots[0]
  )?.path;
}
/**
 * Page content back out of a layout instance: every slot's children, in slot order. A body layout
 * gives the body back (the same node, its content as children); otherwise the instance goes and
 * the content becomes the page's roots. A page whose whole body was put in a slot (the earlier
 * shape) gets that body back.
 */
function releaseLayout(draft: CommandDraft, page: PageEntry): PageEntry {
  const instance = pageLayoutInstance(draft, page);
  if (!instance) return page;
  const content = instance.descendantOverrides.flatMap((item) =>
    item.kind === "fillSlot" ? item.childIds : [],
  );
  const definition = draft.read(instance.definitionId) as DefinitionEntry;
  const nestedBody =
    content.length === 1 &&
    draft.node(content[0]).definitionId === BODY_DEFINITION;
  if (bodyLayout(draft, definition) && !nestedBody) {
    draft.write({
      ...instance,
      definitionId: BODY_DEFINITION,
      children: content,
      descendantOverrides: [],
    });
    return draft.page(page.id);
  }
  const next = { ...page, children: content };
  draft.write({ ...instance, descendantOverrides: [] });
  draft.write(next);
  removeWithReferrers(draft, [instance.id]);
  return next;
}

/**
 * Apply a reusable layout to a page (or remove it with `definitionId` undefined). A page whose
 * one root is a body and a layout whose template root is a body (every layout the Builder makes):
 * the body itself becomes the layout's instance — the layout's slots sit right under the page body
 * (the same node: its id, own props and styles stay) and its content fills the content slot
 * (`slotPath`, else the slot named `content`, else the first required, else the first). Other
 * pages: a new instance is the page's one root and the page's roots fill the slot. Removing puts
 * every slot's content back.
 */
export const applyLayout =
  (input: {
    pageId: EntryId<"page">;
    definitionId: EntryId<"definition"> | undefined;
    slotPath?: readonly TemplateId[];
    newId: NewId;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const page = releaseLayout(draft, draft.page(input.pageId));
    if (input.definitionId) {
      const definition = draft.read(input.definitionId);
      if (
        definition?.kind !== "definition" ||
        definition.usage !== "layout" ||
        !definition.templateRootId
      )
        return fail("NOT_A_LAYOUT", input.definitionId);
      const slots = slotPaths(draft, definition.templateRootId);
      const slotPath =
        input.slotPath ?? layoutContentSlotPath(draft.reader, definition.id);
      if (!slotPath || !slots.some((path) => path.join() === slotPath.join()))
        fail("LAYOUT_SLOT_NOT_FOUND", input.definitionId);
      const body =
        page.children.length === 1 ? draft.node(page.children[0]) : undefined;
      if (
        body?.definitionId === BODY_DEFINITION &&
        bodyLayout(draft, definition)
      ) {
        const address: InstanceAddress = {
          instances: [body.id],
          templatePath: [...slotPath!],
        };
        draft.write({
          ...body,
          definitionId: input.definitionId,
          children: [],
          // An empty body keeps a chosen slot (later content goes there); otherwise the slot
          // shows the layout's own children.
          descendantOverrides:
            body.children.length || input.slotPath
              ? [{ kind: "fillSlot", address, childIds: [...body.children] }]
              : [],
        });
        return { label: input.label ?? "Page layout", ops: draft.ops() };
      }
      const instanceId = input.newId("node");
      const address: InstanceAddress = {
        instances: [instanceId],
        templatePath: [...slotPath!],
      };
      draft.create({
        kind: "node",
        id: instanceId,
        definitionId: input.definitionId,
        children: [],
        props: {},
        visual: {},
        sizing: {},
        descendantOverrides: page.children.length
          ? [{ kind: "fillSlot", address, childIds: [...page.children] }]
          : [],
      });
      draft.write({ ...page, children: [instanceId] });
    }
    return { label: input.label ?? "Page layout", ops: draft.ops() };
  };

/** Delete a layout: pages that use it get their content back, then the definition goes. */
export const deleteLayout =
  (input: {
    definitionId: EntryId<"definition">;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const definition = draft.read(input.definitionId);
    if (definition?.kind !== "definition" || definition.usage !== "layout")
      return fail("NOT_A_LAYOUT", input.definitionId);
    for (const id of reader.instancesOf(input.definitionId)) {
      const ownerId = reader.ownerOf(id);
      const owner = ownerId ? draft.read(ownerId) : undefined;
      if (owner?.kind !== "page") fail("LAYOUT_USED_OUTSIDE_PAGE", id);
      else releaseLayout(draft, owner);
    }
    const template = definition.templateRootId
      ? subtree(draft, definition.templateRootId)
      : [];
    removeWithReferrers(draft, [input.definitionId, ...template]);
    const project = draft.project();
    draft.write({
      ...project,
      definitionIds: project.definitionIds.filter(
        (id) => id !== input.definitionId,
      ),
    });
    return { label: input.label ?? "Delete layout", ops: draft.ops() };
  };

/** Rename a project definition (component or layout). */
export const renameDefinition =
  (input: {
    id: EntryId<"definition">;
    name: string;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const definition = draft.read(input.id);
    if (definition?.kind !== "definition")
      return fail("DANGLING_DEFINITION", input.id);
    draft.write({
      ...definition,
      name: input.name.trim() || fail("NAME_REQUIRED", input.id),
    });
    return { label: input.label ?? "Rename", ops: draft.ops() };
  };

// ── Themes and tokens ─────────────────────────────────────────────────────

export const createTheme =
  (input: {
    theme: ThemeEntry;
    tokens?: readonly TokenEntry[];
    activate?: boolean;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    for (const token of input.tokens ?? []) draft.create(token);
    draft.create(input.theme);
    const project = draft.project();
    draft.write({
      ...project,
      themeIds: [...project.themeIds, input.theme.id],
      tokenIds: [
        ...project.tokenIds,
        ...(input.tokens ?? []).map((token) => token.id),
      ],
      ...(input.activate ? { activeThemeId: input.theme.id } : {}),
    });
    return { label: input.label ?? "Add theme", ops: draft.ops() };
  };

/** Copy a theme with its tokens (the old "add theme from active"). */
export const duplicateTheme =
  (input: {
    id: EntryId<"theme">;
    name: string;
    newId: NewId;
    activate?: boolean;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const theme = draft.read(input.id);
    if (theme?.kind !== "theme") return fail("DANGLING_THEME", input.id);
    const tokens = theme.tokenIds.map((id) => {
      const token = draft.read(id);
      if (token?.kind !== "token") return fail("DANGLING_TOKEN", id);
      return { ...structuredClone(token), id: input.newId("token") };
    });
    return createTheme({
      theme: {
        ...structuredClone(theme),
        id: input.newId("theme"),
        name: input.name,
        tokenIds: tokens.map((token) => token.id),
      },
      tokens,
      activate: input.activate,
      label: input.label ?? "Duplicate theme",
    })(reader);
  };

export const removeTheme =
  (input: { id: EntryId<"theme">; label?: string }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const theme = draft.read(input.id);
    if (theme?.kind !== "theme") return fail("DANGLING_THEME", input.id);
    const project = draft.project();
    const themeIds = project.themeIds.filter((id) => id !== input.id);
    const gone = new Set<string>(theme.tokenIds);
    const { activeThemeId: _active, ...rest } = project;
    draft.write({
      ...rest,
      themeIds,
      tokenIds: project.tokenIds.filter((id) => !gone.has(id)),
      ...(project.activeThemeId && project.activeThemeId !== input.id
        ? { activeThemeId: project.activeThemeId }
        : themeIds.length
          ? { activeThemeId: themeIds[0] }
          : {}),
    });
    // A token still in use fails validation (DANGLING_TOKEN): removal never rewrites values.
    for (const id of [input.id, ...theme.tokenIds]) draft.remove(id);
    return { label: input.label ?? "Delete theme", ops: draft.ops() };
  };

export const updateTheme =
  (input: {
    id: EntryId<"theme">;
    name?: string;
    preset?: Partial<ThemePreset>;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const theme = draft.read(input.id);
    if (theme?.kind !== "theme") return fail("DANGLING_THEME", input.id);
    draft.write({
      ...theme,
      ...(input.name !== undefined
        ? { name: input.name.trim() || fail("NAME_REQUIRED", input.id) }
        : {}),
      preset: { ...theme.preset, ...input.preset },
    });
    return { label: input.label ?? "Edit theme", ops: draft.ops() };
  };

export const setActiveTheme =
  (input: { id: EntryId<"theme">; label?: string }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const project = draft.project();
    if (!project.themeIds.includes(input.id)) fail("DANGLING_THEME", input.id);
    draft.write({ ...project, activeThemeId: input.id });
    return { label: input.label ?? "Switch theme", ops: draft.ops() };
  };

/**
 * A theme's named token value (a color, a length, base typography keys …). `null` removes the
 * theme's own value so the seed value shows again (the old delta rule, ADR-143).
 */
export const setThemeToken =
  (input: {
    themeId: EntryId<"theme">;
    name: string;
    value: { tokenType: TokenType; value: Scalar } | null;
    newId: NewId;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const theme = draft.read(input.themeId);
    if (theme?.kind !== "theme") return fail("DANGLING_THEME", input.themeId);
    const existing = theme.tokenIds
      .map((id) => draft.read(id))
      .find(
        (token): token is TokenEntry =>
          token?.kind === "token" && token.name === input.name,
      );
    const project = draft.project();
    if (!input.value) {
      if (!existing) return fail("TOKEN_NOT_FOUND", input.name);
      draft.write({
        ...theme,
        tokenIds: theme.tokenIds.filter((id) => id !== existing.id),
      });
      draft.write({
        ...project,
        tokenIds: project.tokenIds.filter((id) => id !== existing.id),
      });
      draft.remove(existing.id);
    } else if (existing) {
      draft.write({ ...existing, ...input.value });
    } else {
      const token: TokenEntry = {
        kind: "token",
        id: input.newId("token"),
        name: input.name,
        tokenType: input.value.tokenType,
        value: input.value.value,
        source: "user-defined",
      };
      draft.create(token);
      draft.write({ ...theme, tokenIds: [...theme.tokenIds, token.id] });
      draft.write({ ...project, tokenIds: [...project.tokenIds, token.id] });
    }
    return { label: input.label ?? "Edit token", ops: draft.ops() };
  };

// ── State variables and interactions ──────────────────────────────────────

type ProjectRecord = StateVariableEntry | InteractionEntry;
const listKey = (entry: ProjectRecord) =>
  entry.kind === "stateVariable" ? "stateVariableIds" : "interactionIds";

export const addRecord =
  (input: { entry: ProjectRecord; label?: string }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    draft.create(input.entry);
    const project = draft.project();
    const key = listKey(input.entry);
    draft.write({
      ...project,
      [key]: [...listed(project, key), input.entry.id],
    } as ProjectEntry);
    return {
      label:
        input.label ??
        (input.entry.kind === "stateVariable"
          ? "Add variable"
          : "Add interaction"),
      ops: draft.ops(),
    };
  };

export const updateRecord =
  (input: { entry: ProjectRecord; label?: string }): CatalogCommand =>
  (reader) => {
    const current = reader.getEntry(input.entry.id);
    if (current?.kind !== input.entry.kind)
      return fail("ENTRY_NOT_FOUND", input.entry.id);
    return {
      label: input.label ?? "Edit",
      ops: [{ kind: "put", entry: input.entry }],
    };
  };

/** Remove state variables / interactions; interactions that set a removed variable go too. */
export const removeRecords =
  (input: {
    ids: readonly (EntryId<"stateVariable"> | EntryId<"interaction">)[];
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    for (const id of input.ids)
      if (!draft.read(id)) fail("ENTRY_NOT_FOUND", id);
    const project = draft.project();
    const gone = new Set<string>(input.ids);
    draft.write({
      ...project,
      stateVariableIds: project.stateVariableIds.filter((id) => !gone.has(id)),
      interactionIds: project.interactionIds.filter((id) => !gone.has(id)),
    });
    removeWithReferrers(draft, input.ids);
    return { label: input.label ?? "Delete", ops: draft.ops() };
  };

/**
 * A node's interaction list as a whole (the old per-element rules editor): records not in the
 * list are removed, the rest are added or replaced, all owned by `ownerId` at `address`.
 */
export const setNodeInteractions =
  (input: {
    ownerId: NodeId;
    address?: InstanceAddress;
    entries: readonly InteractionEntry[];
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    draft.node(input.ownerId);
    const same = (address: InstanceAddress | undefined) =>
      address === input.address ||
      (!!address && !!input.address && sameAddress(address, input.address));
    for (const entry of input.entries)
      if (entry.ownerId !== input.ownerId || !same(entry.address))
        fail("INTERACTION_OWNER_MISMATCH", entry.id);
    const keep = new Set<string>(input.entries.map((entry) => entry.id));
    const stale: EntryId<"interaction">[] = [];
    for (const referrerId of reader.referrersOf(input.ownerId)) {
      const entry = draft.read(referrerId);
      if (
        entry?.kind === "interaction" &&
        entry.ownerId === input.ownerId &&
        same(entry.address) &&
        !keep.has(entry.id)
      )
        stale.push(entry.id);
    }
    const project = draft.project();
    const added = input.entries.filter((entry) => !draft.read(entry.id));
    for (const entry of input.entries) {
      if (draft.read(entry.id)) draft.write(entry);
      else draft.create(entry);
    }
    const gone = new Set<string>(stale);
    draft.write({
      ...project,
      interactionIds: [
        ...project.interactionIds.filter((id) => !gone.has(id)),
        ...added.map((entry) => entry.id),
      ],
    });
    removeWithReferrers(draft, stale);
    return { label: input.label ?? "Edit interactions", ops: draft.ops() };
  };
