import type { PropContractMap, ReusableCatalogDocument } from "../types";

export const sectionPropsSchema: PropContractMap = {
  title: {
    kind: "string",
    label: "Title",
    section: "content",
    default: "Section title",
  },
  description: {
    kind: "string",
    label: "Description",
    section: "content",
    default: "Section description",
    multiline: true,
  },
};

export const sectionReusableDocument: ReusableCatalogDocument = {
  version: "composition-1.0",
  children: [
    {
      id: "catalog-reusable-section",
      type: "Section",
      name: "Section",
      reusable: true,
      props: {
        title: "Section title",
        description: "Section description",
      },
      "x-composition": {
        catalog: {
          source: "catalog-library",
          phase: "ADR-142-Phase2",
          propsSchema: sectionPropsSchema,
        },
      },
      children: [
        {
          id: "section-heading",
          type: "Heading",
          props: { children: "Section title" },
        },
        {
          id: "section-description",
          type: "Text",
          props: { children: "Section description" },
        },
      ],
    },
  ],
};
