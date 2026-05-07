import type { CompositionDocument } from "@composition/shared";

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
  return {
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
          order_num: 0,
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
  };
}
