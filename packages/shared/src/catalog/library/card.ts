import type { PropContractMap, ReusableCatalogDocument } from "../types";

export const cardPropsSchema: PropContractMap = {
  title: {
    kind: "string",
    label: "Title",
    section: "content",
    default: "Card title",
  },
  body: {
    kind: "string",
    label: "Body",
    section: "content",
    default: "Use this card to group related content.",
    multiline: true,
  },
  tone: {
    kind: "enum",
    label: "Tone",
    section: "appearance",
    default: "neutral",
    options: [
      { value: "neutral", label: "Neutral" },
      { value: "accent", label: "Accent" },
    ],
  },
};

export const cardReusableDocument: ReusableCatalogDocument = {
  version: "composition-1.0",
  children: [
    {
      id: "catalog-reusable-card",
      type: "Card",
      name: "Card",
      reusable: true,
      props: {
        title: "Card title",
        body: "Use this card to group related content.",
        tone: "neutral",
      },
      "x-composition": {
        catalog: {
          source: "catalog-library",
          phase: "ADR-142-Phase2",
          propsSchema: cardPropsSchema,
        },
      },
      children: [
        {
          id: "card-header",
          type: "CardHeader",
          children: [
            {
              id: "card-title",
              type: "Heading",
              props: { children: "Card title" },
            },
          ],
        },
        {
          id: "card-content",
          type: "CardContent",
          slot: ["catalog-reusable-section"],
          children: [
            {
              id: "card-body",
              type: "Text",
              props: { children: "Use this card to group related content." },
            },
          ],
        },
        {
          id: "card-footer",
          type: "CardFooter",
          children: [
            {
              id: "card-action",
              type: "Button",
              props: { children: "Action", variant: "primary" },
            },
          ],
        },
      ],
    },
  ],
};
