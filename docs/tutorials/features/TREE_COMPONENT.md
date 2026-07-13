# Tree Component User Guide

**Version:** 1.0
**Last Updated:** 2025-10-23

## Overview

The Tree component is a hierarchical data display component built with React Aria Components. It supports both static and dynamic data binding modes, making it ideal for displaying component trees, file systems, organization charts, or any nested data structure.

## Table of Contents

1. [Features](#features)
2. [Usage Modes](#usage-modes)
3. [Static Mode](#static-mode)
4. [DataBinding Mode](#databinding-mode)
5. [Mock Data API](#mock-data-api)
6. [Configuration Options](#configuration-options)
7. [Examples](#examples)
8. [Troubleshooting](#troubleshooting)

---

## Features

- **Static Mode**: Manually add TreeItem children in Builder
- **DataBinding Mode**: Automatically load hierarchical data from API
- **Recursive Rendering**: Automatically renders nested `children` arrays at unlimited depth
- **MOCK_DATA Support**: Built-in mock endpoints for development and testing
- **Accessibility**: Built on React Aria with full keyboard navigation and ARIA attributes
- **Selection Modes**: Single or multiple selection support
- **Expand/Collapse**: Interactive expand/collapse of tree nodes

---

## Usage Modes

### Static Mode

Manually add TreeItem components as children in the Builder interface.

**When to use:**
- Fixed tree structure
- Small number of nodes
- Custom nested components

### DataBinding Mode

Automatically load tree data from an API endpoint.

**When to use:**
- Dynamic tree structure from API
- Large hierarchical datasets
- Real-time data updates
- Component trees, file systems, org charts

---

## Static Mode

### Adding Tree Items Manually

1. Drag the **Tree** component onto the canvas
2. Select the Tree component
3. Drag **TreeItem** components into the Tree
4. Nest TreeItems by dragging them into other TreeItems

### Example Structure

```
Tree
├── TreeItem: "Root 1"
│   ├── TreeItem: "Child 1-1"
│   └── TreeItem: "Child 1-2"
│       └── TreeItem: "Grandchild 1-2-1"
└── TreeItem: "Root 2"
    └── TreeItem: "Child 2-1"
```

### TreeItem Properties

| Property | Type | Description |
|----------|------|-------------|
| `title` | string | Display text for the tree item |
| `hasChildren` | boolean | Whether the item can be expanded |
| `showInfoButton` | boolean | Show info button (for static mode) |
| `isDisabled` | boolean | Disable the tree item |

---

## DataBinding Mode

### Configuration in Inspector

1. Select the **Tree** component
2. Open **Inspector** panel
3. Navigate to **Data Section**
4. Select **API Collection** as binding source
5. Configure API settings:
   - **Base URL**: `MOCK_DATA` (for mock data) or your API URL
   - **Endpoint**: `/component-tree` (or your custom endpoint)
   - **Parameters**: Optional query parameters (e.g., `{ "engineId": "engine-1" }`)

### API Data Requirements

The API must return an array of objects with this structure:

```json
[
  {
    "id": "unique-id",
    "name": "Display Name",
    "children": [
      {
        "id": "child-id",
        "name": "Child Name",
        "children": []
      }
    ]
  }
]
```

### Field Mapping

The Tree component automatically maps these fields:

| API Field | Purpose | Fallback Chain |
|-----------|---------|----------------|
| Display Text | Tree item label | `name` → `label` → `title` → `id` |
| Item ID | Unique identifier | `id` → `name` → random |
| Children | Nested items | `children` array |

### Example API Response

```json
[
  {
    "id": "comp-1",
    "name": "Root Component",
    "type": "Container",
    "parentId": null,
    "level": 0,
    "children": [
      {
        "id": "comp-2",
        "name": "Header",
        "type": "Header",
        "parentId": "comp-1",
        "level": 1,
        "children": [
          {
            "id": "comp-3",
            "name": "Logo",
            "type": "Image",
            "parentId": "comp-2",
            "level": 2,
            "children": []
          }
        ]
      },
      {
        "id": "comp-4",
        "name": "Main Content",
        "type": "Main",
        "parentId": "comp-1",
        "level": 1,
        "children": []
      }
    ]
  }
]
```

---

## Mock Data API

### Available Endpoints

#### 1. `/component-tree` - Component Hierarchy

Returns a hierarchical tree of UI components organized by engine.

**Parameters:**
- `engineId` (optional): Filter by specific engine ID

**Response Structure:**
```json
[
  {
    "id": "comp-123",
    "name": "Button",
    "type": "Button",
    "engineId": "engine-1",
    "assemblyId": "assembly-5",
    "parentId": "comp-100",
    "level": 2,
    "children": [...]
  }
]
```

**Use Case:** Displaying component trees in a design system or UI builder.

#### 2. `/engine-summary` - Engine Statistics

Returns summary statistics for engines.

**Response Structure:**
```json
[
  {
    "engine": "Engine 1",
    "assembliesCount": 20,
    "totalPartsCount": 450
  }
]
```

**Use Case:** Dashboard or overview displays (not typically used for Tree component).

### Using Mock Data

**Step 1:** Configure in Inspector
- Base URL: `MOCK_DATA`
- Endpoint: `/component-tree`
- Parameters: `{ "engineId": "engine-1" }` (optional)

**Step 2:** Tree automatically:
1. Fetches data from mock endpoint
2. Parses the `children` arrays recursively
3. Renders TreeItem components dynamically
4. Handles expand/collapse state

---

## Configuration Options

### Tree Component Props

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `selectionMode` | `"none"` \| `"single"` \| `"multiple"` | `"single"` | Selection behavior |
| `selectionBehavior` | `"replace"` \| `"toggle"` | `"replace"` | How selections work |
| `expandedKeys` | `string[]` | `[]` | IDs of expanded nodes |
| `selectedKeys` | `string[]` | `[]` | IDs of selected nodes |
| `aria-label` | `string` | `"Tree"` | Accessibility label |
| `dataBinding` | `DataBinding` | - | API configuration |

### DataBinding Config

```typescript
dataBinding: {
  type: "collection",
  source: "api",
  config: {
    baseUrl: "MOCK_DATA",
    endpoint: "/component-tree",
    params: {
      engineId: "engine-1",  // Optional
      // Add any custom parameters
    }
  }
}
```

---

## Examples

### Example 1: Simple File System

**Static Mode:**

```tsx
<Tree aria-label="File System">
  <TreeItem id="1" title="Documents" hasChildren>
    <TreeItem id="1-1" title="Resume.pdf" />
    <TreeItem id="1-2" title="Cover Letter.docx" />
  </TreeItem>
  <TreeItem id="2" title="Pictures" hasChildren>
    <TreeItem id="2-1" title="Vacation" hasChildren>
      <TreeItem id="2-1-1" title="beach.jpg" />
      <TreeItem id="2-1-2" title="sunset.jpg" />
    </TreeItem>
  </TreeItem>
</Tree>
```

### Example 2: Component Tree (DataBinding)

**Configuration:**
- Base URL: `MOCK_DATA`
- Endpoint: `/component-tree`
- Parameters: `{ "engineId": "engine-1" }`

**Result:** Displays all components in engine-1 with their hierarchical relationships.

### Example 3: Organization Chart

**API Data:**
```json
[
  {
    "id": "ceo",
    "name": "CEO - John Smith",
    "title": "Chief Executive Officer",
    "children": [
      {
        "id": "cto",
        "name": "CTO - Jane Doe",
        "title": "Chief Technology Officer",
        "children": [
          {
            "id": "dev-1",
            "name": "Dev Team Lead",
            "children": []
          }
        ]
      }
    ]
  }
]
```

### Example 4: Multiple Selection

**Inspector Configuration:**
- Selection Mode: `multiple`
- Selection Behavior: `toggle`

**Behavior:**
- Users can select multiple nodes
- Clicking toggles selection (doesn't replace)

---

## Troubleshooting

### Children Not Displaying

**Problem:** Tree shows parent items but no children.

**Solutions:**
1. ✅ Verify `dataBinding` prop is passed in renderer ([CollectionRenderers.tsx:82](../../../packages/shared/src/renderers/CollectionRenderers.tsx#L82))
2. ✅ Check API response has `children` arrays
3. ✅ Ensure `children` is a non-empty array (not `null` or `undefined`)
4. ✅ Verify `hasChildren` is calculated correctly

### Loading State

**Problem:** Tree shows "Loading..." indefinitely.

**Solutions:**
1. Check browser console for API errors
2. Verify `baseUrl: "MOCK_DATA"` is correct
3. Check endpoint exists (`/component-tree`)
4. Verify mock data service is loaded

### Empty Tree

**Problem:** Tree renders but shows no items.

**Solutions:**
1. Check API returns non-empty array
2. Verify `id` and `name`/`label`/`title` fields exist
3. Check browser console for errors
4. Test API endpoint directly in browser

### Incorrect Hierarchy

**Problem:** Tree structure doesn't match expected hierarchy.

**Solutions:**
1. Verify `children` arrays are correctly nested in API response
2. Check `parentId` fields match parent `id` values
3. Ensure no circular references in data
4. Validate data structure matches expected format

---

## Technical Implementation

### Files

| File | Purpose |
|------|---------|
| [src/builder/components/Tree.tsx](../../../packages/react-aria-starter/src/Tree.tsx) | Tree component with DataBinding support |
| [src/builder/preview/renderers/CollectionRenderers.tsx](../../../packages/shared/src/renderers/CollectionRenderers.tsx) | Tree renderer in preview iframe |
| [src/builder/components/metadata.ts](../../../packages/shared/src/components/metadata.ts) | Tree metadata (enables Data Section) |
| [src/services/api/index.ts](../../../apps/publish/src/index.ts) | Mock data endpoints |

### Key Functions

#### `renderTreeItemsRecursively` (Tree.tsx:64-82)

Recursively renders tree items from API data:

```typescript
const renderTreeItemsRecursively = (items: any[]): React.ReactNode => {
  return items.map((item) => {
    const itemId = String(item.id || item.name || Math.random());
    const displayTitle = String(
      item.name || item.label || item.title || itemId
    );
    const hasChildren = Array.isArray(item.children) && item.children.length > 0;

    return (
      <TreeItem
        key={itemId}
        id={itemId}
        title={displayTitle}
        hasChildren={hasChildren}
        childItems={hasChildren ? renderTreeItemsRecursively(item.children) : undefined}
      />
    );
  });
};
```

---

## Related Documentation

- [CLAUDE.md](../../../CLAUDE.md) - Full project documentation
- Mock Data API - Mock data endpoints
- [Component Metadata](../../../packages/shared/src/components/metadata.ts) - Component configuration
- [React Aria Tree Docs](https://react-spectrum.adobe.com/react-aria/Tree.html) - Official React Aria documentation

---

## Changelog

### Version 1.0 (2025-10-23)
- Initial Tree component DataBinding implementation
- Added recursive children rendering
- Integrated MOCK_DATA support
- Added `/component-tree` and `/engine-summary` endpoints
- Updated renderers to pass `dataBinding` prop

---

## Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section
2. Review [CLAUDE.md](../../../CLAUDE.md) documentation
3. Examine existing implementations (ListBox.tsx, Select.tsx)
4. Check browser console for errors
