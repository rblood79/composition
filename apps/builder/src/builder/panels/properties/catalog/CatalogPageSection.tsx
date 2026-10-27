import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useState,
  useSyncExternalStore,
} from "react";
import { Button as RACButton } from "react-aria-components/Button";
import { CircleAlert, Layout, RefreshCw, WandSparkles, X } from "lucide-react";
import { translateKey, useI18n } from "@/i18n";
import { ACTION_ICONS } from "../../../config/actionIcons";
import type { EntryId } from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogGeneratedRoute,
  catalogPageCommands,
  catalogPageLayoutId,
  catalogPageLayoutSlots,
  catalogPageLayouts,
  catalogPageRouteEdit,
  catalogParentPageOptions,
  catalogResolvedRoute,
  catalogRouteFollowEdit,
  type CatalogRouteRefusal,
} from "../../../catalogRuntime/pageSettings";
import {
  useCatalogPages,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { Section as PropertySection } from "../../../components/panel/Section";
import { PropertySelect } from "../../../components/property/PropertySelect";
import {
  iconEditProps,
  iconProps,
  iconSmall,
} from "../../../../utils/ui/uiConstants";
import { SwatchIconButton } from "../../../components/ui/SwatchIconButton";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";
import "../editors/styles/pageSelectors.css";

// ADR-286 — the page's search · sharing settings (and its image picker) load with the section
// (below the route fields), not with the Builder's first screen.
const CatalogPageMetaSection = lazy(() =>
  import("./CatalogPageMetaSection").then((m) => ({
    default: m.CatalogPageMetaSection,
  })),
);

const ROUTE_MESSAGES: Record<CatalogRouteRefusal, string> = {
  ROUTE_EMPTY: "Route cannot be empty",
  ROUTE_CHARACTERS:
    "Route segments are letters, numbers and hyphens, or a :param",
  ROUTE_SLASHES: "Route cannot contain consecutive slashes or end with a slash",
  ROUTE_TAKEN: "Another page already uses this route",
};

/**
 * ADR-248 Phase 4e-4: the page section over the catalog document (the old PageBody editors) — a
 * page root edits its page: the reusable layout it uses (applied or removed — the content stays),
 * its parent page (nested route; never itself or a descendant) and its route (refused with a
 * message when malformed or taken). Each edit is one step. A route out of line with the parent
 * shows the route the parent gives (the old "Resolved URL") with one step that brings it — and
 * the routes under it — along; the stored route never changes on its own (stable URLs).
 */
export const CatalogPageSection = memo(function CatalogPageSection({
  pageId,
}: {
  pageId: EntryId<"page">;
}) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const graph = workspace.runtime.graph;
  const pages = useCatalogPages();
  const page = pages.find((entry) => entry.id === pageId);
  const subscribe = useCallback(
    (notify: () => void) => workspace.runtime.subscribeSteps(() => notify()),
    [workspace],
  );
  const layoutKey = useSyncExternalStore(subscribe, () =>
    JSON.stringify({
      layouts: catalogPageLayouts(graph),
      current: catalogPageLayoutId(graph, pageId) ?? "",
      slots: catalogPageLayoutSlots(graph, pageId),
    }),
  );
  const { layouts, current, slots } = JSON.parse(layoutKey) as {
    layouts: ReturnType<typeof catalogPageLayouts>;
    current: string;
    slots: ReturnType<typeof catalogPageLayoutSlots>;
  };
  const [routeError, setRouteError] = useState<string | null>(null);
  // A root page has no parent to follow; offer it only right after it left one.
  const [leftParent, setLeftParent] = useState<string | null>(null);

  const changeLayout = useCallback(
    (value: string) => {
      if (value === (catalogPageLayoutId(graph, pageId) ?? "")) return;
      run(
        catalogPageCommands.layout(
          pageId,
          (value || undefined) as EntryId<"definition"> | undefined,
          workspace.newId,
        ),
      );
    },
    [graph, pageId, run, workspace],
  );
  // A layout with several slots: the one the page's content fills (re-applying the layout moves
  // the content there — the old page's slot choice).
  const changeSlot = useCallback(
    (value: string) => {
      const layout = catalogPageLayoutId(graph, pageId);
      const choice = catalogPageLayoutSlots(graph, pageId);
      const slot = choice?.slots.find((item) => item.path.join() === value);
      if (!layout || !slot || choice?.current === value) return;
      run(
        catalogPageCommands.layout(pageId, layout, workspace.newId, slot.path),
      );
    },
    [graph, pageId, run, workspace],
  );
  const changeParent = useCallback(
    (value: string) => {
      const entry = graph.getEntry(pageId);
      if (entry?.kind !== "page" || (entry.parentId ?? "") === value) return;
      setLeftParent(value ? null : pageId);
      run(
        catalogPageCommands.parent(
          pageId,
          (value || undefined) as EntryId<"page"> | undefined,
        ),
      );
    },
    [graph, pageId, run],
  );
  const changeRoute = useCallback(
    (value: string) => {
      const entry = graph.getEntry(pageId);
      if (entry?.kind !== "page" || value.trim() === entry.route)
        return setRouteError(null);
      const edit = catalogPageRouteEdit(
        workspace.readModel.pages(),
        pageId,
        value,
      );
      if ("refused" in edit) return setRouteError(ROUTE_MESSAGES[edit.refused]);
      setRouteError(null);
      run(edit.command);
    },
    [graph, pageId, run, workspace],
  );

  const followRoute = useCallback(() => {
    const edit = catalogRouteFollowEdit(workspace.readModel.pages(), [pageId]);
    if (!edit) return;
    if ("refused" in edit) return setRouteError(ROUTE_MESSAGES[edit.refused]);
    setRouteError(null);
    run(edit.command);
  }, [pageId, run, workspace]);

  if (!page) return null;
  const resolvedRoute = catalogResolvedRoute(pages, pageId);
  const routeOutOfLine =
    resolvedRoute !== undefined &&
    resolvedRoute !== page.route &&
    (page.parentId !== undefined || leftParent === pageId);
  const currentLayout = layouts.find((layout) => layout.id === current);
  const layoutOptions = [
    { value: "", label: translateKey(t, "properties.noLayout", "No Layout") },
    ...layouts.map((layout) => ({ value: layout.id, label: layout.name })),
  ];
  const parent = pages.find((entry) => entry.id === page.parentId);
  const parentOptions = [
    { value: "", label: "No Parent (Root)" },
    ...catalogParentPageOptions(pages, pageId).map(
      ({ page: option, depth }) => ({
        value: option.id,
        label: `${"  ".repeat(depth)}${option.name}`,
      }),
    ),
  ];

  return (
    <>
      <PropertySection title="Layout">
        <PropertySelect
          label="Apply Layout"
          value={current}
          onChange={changeLayout}
          options={layoutOptions}
          icon={Layout}
          description={
            currentLayout
              ? translateKey(
                  t,
                  "properties.usingLayout",
                  `Using "${currentLayout.name}" layout`,
                  { name: currentLayout.name },
                )
              : translateKey(
                  t,
                  "properties.selectReusableLayout",
                  "Select a reusable layout for this page",
                )
          }
        />
        {currentLayout && slots && slots.slots.length > 1 && (
          <PropertySelect
            label={translateKey(t, "properties.contentSlot", "Content Slot")}
            value={slots.current ?? ""}
            onChange={changeSlot}
            options={slots.slots.map((slot) => ({
              value: slot.path.join(),
              label: slot.name,
            }))}
          />
        )}
        {currentLayout && (
          <div className="page-layout-info">
            <RACButton
              className="control-button"
              onPress={() =>
                workspace.showDefinition(
                  currentLayout.id as EntryId<"definition">,
                )
              }
            >
              <ACTION_ICONS.goToOrigin
                aria-hidden="true"
                size={iconEditProps.size}
              />
              <span>{t("catalogProject.editLayout")}</span>
            </RACButton>
            <RACButton
              className="control-button"
              onPress={() => changeLayout("")}
            >
              <X aria-hidden="true" size={iconEditProps.size} />
              <span>
                {translateKey(t, "properties.removeLayout", "Remove Layout")}
              </span>
            </RACButton>
          </div>
        )}
      </PropertySection>
      <PropertySection title="Nested Routes">
        <div className="fieldset-row" data-wide="true">
          <PropertySelect
            label="Parent Page"
            value={page.parentId ?? ""}
            onChange={changeParent}
            options={parentOptions}
            description={
              parent
                ? `Child of "${parent.name}"`
                : "This page is at root level"
            }
          />
        </div>
        {/* The 28 action column: "Generate from Title" (the old Slug row's action). */}
        <div className="fieldset-row page-slug-input" data-wide="true">
          <PropertyInput
            label="Route"
            value={page.route}
            onChange={changeRoute}
            placeholder={catalogGeneratedRoute(pages, pageId)}
            description="URL path of this page"
          />
          <div className="fieldset-actions actions-slug">
            <SwatchIconButton
              aria-label="Generate from Title"
              onPress={() => changeRoute(catalogGeneratedRoute(pages, pageId))}
            >
              <WandSparkles aria-hidden="true" size={iconProps.size} />
            </SwatchIconButton>
          </div>
        </div>
        {routeOutOfLine && (
          <>
            <div className="fieldset-row" data-wide="true">
              <fieldset className="properties-aria page-resolved-url">
                <legend className="fieldset-legend">
                  {translateKey(t, "properties.resolvedUrl", "Resolved URL")}
                </legend>
                <div className="react-aria-control react-aria-Group">
                  <code className="page-resolved-url-value">
                    {resolvedRoute}
                  </code>
                </div>
              </fieldset>
            </div>
            <RACButton className="control-button" onPress={followRoute}>
              <RefreshCw aria-hidden="true" size={iconEditProps.size} />
              <span>
                {translateKey(
                  t,
                  "properties.updateRoute",
                  "Update route (incl. children)",
                )}
              </span>
            </RACButton>
          </>
        )}
        {routeError && (
          <div className="page-slug-error" role="alert">
            <CircleAlert size={iconSmall.size} />
            <span>{routeError}</span>
          </div>
        )}
      </PropertySection>
      <Suspense fallback={null}>
        <CatalogPageMetaSection pageId={pageId} />
      </Suspense>
    </>
  );
});
