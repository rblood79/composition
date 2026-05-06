/**
 * Page Parent Selector
 *
 * ADR-111/116: reusable frame 목록은 canonical document surface 에서 읽는다.
 */

import { memo, useMemo, useCallback, useState } from "react";
import { FolderTree, AlertCircle } from "lucide-react";
import {
  PropertySelect,
  PropertySection,
  PropertyInput,
} from "../../../components";
import { useStore } from "../../../stores";
import { getDB } from "../../../../lib/db";
import {
  hasCircularReference,
  getNestingDepth,
  generatePageUrl,
} from "../../../../utils/urlGenerator";
import {
  validateSlug,
  generateSlugFromTitle,
} from "../../../../utils/slugValidator";
import { useCanonicalReusableFrameLayouts } from "../../../stores/canonical/canonicalFrameStore";
import { iconSmall } from "../../../../utils/ui/uiConstants";
import {
  getNullablePageFrameBindingId,
  withPageFrameBinding,
} from "../../../../adapters/canonical/frameMirror";
import type { Page } from "../../../../types/builder/unified.types";

interface PageParentSelectorProps {
  pageId: string;
}

const MAX_NESTING_DEPTH = 5;

function toUrlPage(page: Page) {
  return withPageFrameBinding(
    {
      id: page.id,
      title: page.title,
      slug: page.slug,
      project_id: page.project_id,
      parent_id: page.parent_id,
      order_num: page.order_num,
    },
    getNullablePageFrameBindingId(page),
  );
}

export const PageParentSelector = memo(function PageParentSelector({
  pageId,
}: PageParentSelectorProps) {
  const page = useStore((state) => state.pages.find((p) => p.id === pageId));
  const pages = useStore((state) => state.pages);

  const layouts = useCanonicalReusableFrameLayouts();

  const [slugError, setSlugError] = useState<string | null>(null);

  const currentParentId = page?.parent_id || "";
  const currentParent = useMemo(
    () => pages.find((p) => p.id === currentParentId),
    [pages, currentParentId],
  );

  const currentSlug = page?.slug || "";

  const previewUrl = useMemo(() => {
    if (!page) return "/";

    const pageLayoutId = getNullablePageFrameBindingId(page);
    const layout = pageLayoutId
      ? layouts.find((l) => l.id === pageLayoutId)
      : null;

    return generatePageUrl({
      page: toUrlPage(page),
      layout: layout
        ? {
            id: layout.id,
            name: layout.name,
            project_id: layout.project_id,
            slug: layout.slug || undefined,
          }
        : null,
      allPages: pages.map(toUrlPage),
    });
  }, [page, pages, layouts]);

  const parentOptions = useMemo(() => {
    const options = [{ value: "", label: "No Parent (Root)" }];

    const getChildPageIds = (parentId: string): string[] => {
      const children = pages.filter((p) => p.parent_id === parentId);
      const childPageIds: string[] = children.map((c) => c.id);
      children.forEach((child) => {
        childPageIds.push(...getChildPageIds(child.id));
      });
      return childPageIds;
    };

    const childPageIds = getChildPageIds(pageId);

    pages.forEach((p) => {
      if (p.id === pageId) return;
      if (childPageIds.includes(p.id)) return;

      const depthIfSelected = getNestingDepth(p.id, pages.map(toUrlPage)) + 1;

      if (depthIfSelected >= MAX_NESTING_DEPTH) return;

      const depth = getNestingDepth(p.id, pages.map(toUrlPage));
      const indent = "  ".repeat(depth);

      options.push({ value: p.id, label: `${indent}${p.title}` });
    });

    return options;
  }, [pages, pageId]);

  const handleParentChange = useCallback(
    async (newParentId: string) => {
      if (
        newParentId &&
        hasCircularReference(pageId, newParentId, pages.map(toUrlPage))
      ) {
        console.error("[PageParentSelector] Circular reference detected");
        return;
      }

      try {
        const { pages: currentPages, setPages } = useStore.getState();
        const db = await getDB();

        const updatedPages = currentPages.map((p) =>
          p.id === pageId ? { ...p, parent_id: newParentId || null } : p,
        );
        setPages(updatedPages);

        await db.pages.update(pageId, { parent_id: newParentId || null });
      } catch (error) {
        console.error(
          "[PageParentSelector] Failed to update page parent:",
          error,
        );
      }
    },
    [pageId, pages],
  );

  const handleSlugChange = useCallback(
    async (newSlug: string) => {
      const validation = validateSlug(newSlug);
      if (!validation.valid) {
        setSlugError(validation.error || "Invalid slug");
        return;
      }
      setSlugError(null);

      try {
        const { pages: currentPages, setPages } = useStore.getState();
        const db = await getDB();

        const updatedPages = currentPages.map((p) =>
          p.id === pageId ? { ...p, slug: newSlug || "" } : p,
        );
        setPages(updatedPages);

        await db.pages.update(pageId, { slug: newSlug || "" });
      } catch (error) {
        console.error(
          "[PageParentSelector] Failed to update page slug:",
          error,
        );
      }
    },
    [pageId],
  );

  const handleGenerateSlug = useCallback(() => {
    if (!page) return;
    const generatedSlug = generateSlugFromTitle(page.title);
    handleSlugChange(generatedSlug);
  }, [page, handleSlugChange]);

  if (!page) return null;

  return (
    <PropertySection title="Nested Routes" icon={FolderTree}>
      <PropertySelect
        label="Parent Page"
        value={currentParentId}
        onChange={handleParentChange}
        options={parentOptions}
        icon={FolderTree}
        description={
          currentParent
            ? `Child of "${currentParent.title}"`
            : "This page is at root level"
        }
      />

      <div className="page-slug-input">
        <PropertyInput
          label="Slug"
          value={currentSlug}
          onChange={handleSlugChange}
          placeholder={generateSlugFromTitle(page.title)}
          description="URL path segment for this page"
        />
        {slugError && (
          <div className="page-slug-error">
            <AlertCircle size={iconSmall.size} />
            <span>{slugError}</span>
          </div>
        )}
        <button
          type="button"
          className="page-slug-generate"
          onClick={handleGenerateSlug}
          title="Generate slug from title"
        >
          Generate from Title
        </button>
      </div>

      <div className="page-url-preview">
        <span className="page-url-label">Preview URL:</span>
        <code className="page-url-value">{previewUrl}</code>
      </div>
    </PropertySection>
  );
});

export default PageParentSelector;
