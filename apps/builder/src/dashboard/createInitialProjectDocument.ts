import type { CompositionDocument } from "@composition/shared";
import { ensureListBoxTemplateOrigins } from "../builder/components/listbox/listBoxTemplateOrigins";
import { ensureGridListTemplateOrigins } from "../builder/components/gridlist/gridListTemplateOrigins";
import { ensureMenuTemplateOrigins } from "../builder/components/menu/menuTemplateOrigins";
import { ensureReusableCompositeOrigins } from "../builder/components/reusableCompositeOrigins";

type PageSeed = {
  id: string;
  title: string;
  slug?: string | null;
};

type BodySeed = {
  id: string;
  type: string;
  props?: unknown;
};

type CanonicalNodeType = CompositionDocument["children"][number]["type"];

function asCanonicalProps(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function createInitialProjectDocument(
  page: PageSeed,
  body: BodySeed,
): CompositionDocument {
  // ADR-148 Phase 4: GridListItem/MenuItem collection item slot origin — ListBox 동형 체인.
  return ensureReusableCompositeOrigins(
    ensureMenuTemplateOrigins(
      ensureGridListTemplateOrigins(
        ensureListBoxTemplateOrigins({
          version: "composition-1.0",
          children: [
            {
              id: page.id,
              type: "frame",
              name: page.title,
              metadata: {
                type: "legacy-page",
                pageId: page.id,
                slug: page.slug ?? null,
                parent_id: null,
              },
              children: [
                {
                  id: body.id,
                  type: body.type as CanonicalNodeType,
                  props: asCanonicalProps(body.props),
                },
              ],
            },
          ],
        }),
      ),
    ),
  );
}
