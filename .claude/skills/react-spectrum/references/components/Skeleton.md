<!-- Source: https://react-spectrum.adobe.com/s2/ (S2) + GitHub @react-spectrum/s2/src/Skeleton.tsx -->
<!-- Last fetched: 2026-04-05 -->

# Skeleton

A Skeleton wraps around content to render it as a placeholder with an animated loading effect.

```tsx
import { Skeleton, SkeletonCollection } from "@react-spectrum/s2";
```

## Examples

### Basic

```jsx
<Skeleton isLoading>
  <Card>
    <Image src="placeholder.jpg" />
    <Heading>Card Title</Heading>
    <Content>Card content goes here</Content>
  </Card>
</Skeleton>
```

### With Collections (SkeletonCollection)

SkeletonCollection generates placeholder content within collection components like CardView:

```jsx
<CardView>
  <SkeletonCollection>
    {() => (
      <Card>
        <Image src="placeholder.jpg" />
        <Heading>Loading...</Heading>
      </Card>
    )}
  </SkeletonCollection>
</CardView>
```

## Props

### SkeletonProps

| Name        | Type        | Default | Description                        |
| ----------- | ----------- | ------- | ---------------------------------- |
| `children`  | `ReactNode` | --      | Content to render as placeholder   |
| `isLoading` | `boolean`   | --      | Controls placeholder display state |

### SkeletonCollectionProps

| Name       | Type              | Default | Description                                   |
| ---------- | ----------------- | ------- | --------------------------------------------- |
| `children` | `() => ReactNode` | --      | Render function returning placeholder content |

## Hooks

### useIsSkeleton

Returns whether the component is within a Skeleton loading context.

```tsx
import { useIsSkeleton } from "@react-spectrum/s2";

function MyComponent() {
  const isSkeleton = useIsSkeleton(); // boolean
  // ...
}
```

### useLoadingAnimation

Manages Web Animation API for synchronized loading effects across all skeleton elements on the page.

```tsx
const animationRef = useLoadingAnimation(isAnimating);
// Returns a ref callback for the animated element
```

### useSkeletonText

Wraps text content with skeleton styling when in loading state.

```tsx
const [children, style] = useSkeletonText(children, style);
```

### useSkeletonIcon

Adds default border radius to icons in skeleton mode.

```tsx
const mergedStyles = useSkeletonIcon(styles);
```

## Key Features

- Uses Web Animation API for synchronized animations across multiple skeleton elements
- Respects `prefers-reduced-motion` media query
- Hides content visibility while maintaining layout dimensions
- Disables form components within skeleton context (via `inert` attribute)
- SkeletonCollection uses WeakMap cache to preserve randomized content across re-renders

## Context

### SkeletonContext

```tsx
import { SkeletonContext } from "@react-spectrum/s2";
// createContext<boolean | null>(null)
```

Provides skeleton state to descendant components. When `true`, children render as animated placeholders.
