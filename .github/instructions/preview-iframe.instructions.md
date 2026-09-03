---
applyTo: "apps/builder/src/preview/**"
---

# Preview / iframe Messaging

- Validate event.origin on receive.
- Queue messages until PREVIEW_READY then flush.
- Full document sync: UPDATE_CANONICAL_DOCUMENT only.
- Other active message types include ELEMENT_SELECTED and UPDATE_ELEMENT_PROPS.
- **Collect computed styles**: Use getComputedStyle() on DOM elements on selection.
- Send computed styles (layout, flexbox, typography, colors, spacing, borders) back to Builder.
