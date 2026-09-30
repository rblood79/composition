import { memo, useCallback, useState, useSyncExternalStore } from "react";
import { Button as RACButton } from "react-aria-components/Button";
import { CircleAlert, Layout, X } from "lucide-react";
import { translateKey, useI18n } from "@/i18n";
import type { EntryId } from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogPageCommands,
  catalogPageLayoutId,
  catalogPageLayouts,
  catalogPageRouteEdit,
  catalogParentPageOptions,
  type CatalogRouteRefusal,
} from "../../../catalogRuntime/pageSettings";
import {
  useCatalogPages,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import {
  PropertyInput,
  PropertySection,
  PropertySelect,
} from "../../../components";
import { iconEditProps, iconSmall } from "../../../../utils/ui/uiConstants";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";
import "../editors/styles/pageSelectors.css";

const ROUTE_MESSAGES: Record<CatalogRouteRefusal, string> = {
  ROUTE_EMPTY: "Route cannot be empty",
  ROUTE_CHARACTERS:
    "Route can only contain letters, numbers, hyphens, and slashes",
  ROUTE_SLASHES: "Route cannot contain consecutive slashes or end with a slash",
  ROUTE_TAKEN: "Another page already uses this route",
};

/**
 * ADR-248 Phase 4e-4: the page section over the catalog document (the old PageBody editors) — a
 * page root edits its page: the reusable layout it uses (applied or removed — the content stays),
 * its parent page (nested route; never itself or a descendant) and its route (refused with a
 * message when malformed or taken). Each edit is one step.
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
    }),
  );
  const { layouts, current } = JSON.parse(layoutKey) as {
    layouts: ReturnType<typeof catalogPageLayouts>;
    current: string;
  };
  const [routeError, setRouteError] = useState<string | null>(null);

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
  const changeParent = useCallback(
    (value: string) => {
      const entry = graph.getEntry(pageId);
      if (entry?.kind !== "page" || (entry.parentId ?? "") === value) return;
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

  if (!page) return null;
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
        {currentLayout && (
          <div className="page-layout-info">
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
        <div className="fieldset-row page-slug-input" data-wide="true">
          <PropertyInput
            label="Route"
            value={page.route}
            onChange={changeRoute}
            description="URL path of this page"
          />
        </div>
        {routeError && (
          <div className="page-slug-error" role="alert">
            <CircleAlert size={iconSmall.size} />
            <span>{routeError}</span>
          </div>
        )}
      </PropertySection>
    </>
  );
});
