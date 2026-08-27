<!-- Source: https://react-spectrum.adobe.com/react-spectrum/IllustratedMessage.html -->
<!-- Last fetched: 2026-04-05 -->

# IllustratedMessage

An IllustratedMessage displays an illustration and a message, usually for an empty state or an error page.

## Import

```javascript
import { IllustratedMessage } from "@adobe/react-spectrum";
```

## Basic Usage

```jsx
import NotFound from "@spectrum-icons/illustrations/NotFound";

<IllustratedMessage>
  <NotFound />
  <Heading>No results</Heading>
  <Content>Try another search</Content>
</IllustratedMessage>;
```

## Component Structure

The IllustratedMessage consists of three sections:

1. **Illustration** - An SVG graphic providing visual context
2. **Title** - A `Heading` component describing the state
3. **Body** - A `Content` component with supporting text

```jsx
import Upload from "@spectrum-icons/illustrations/Upload";

<IllustratedMessage>
  <Upload />
  <Heading>Drag and Drop your file</Heading>
  <Content>
    Select a File from your computer
    <br />
    or Search Adobe Stock
  </Content>
</IllustratedMessage>;
```

## Common Examples

### No Search Results

```jsx
import NoSearchResults from "@spectrum-icons/illustrations/NoSearchResults";

<IllustratedMessage>
  <NoSearchResults />
  <Heading>No matching results</Heading>
  <Content>Try another search.</Content>
</IllustratedMessage>;
```

### 403 Forbidden Error

```jsx
import Unauthorized from "@spectrum-icons/illustrations/Unauthorized";

<IllustratedMessage>
  <Unauthorized />
  <Heading>Error 403: Access not allowed</Heading>
  <Content>You do not have permission to access this page.</Content>
</IllustratedMessage>;
```

### 404 Not Found

```jsx
import NotFound from "@spectrum-icons/illustrations/NotFound";

<IllustratedMessage>
  <NotFound />
  <Heading>Error 404: Page not found</Heading>
  <Content>This page isn't available. Try checking the URL.</Content>
</IllustratedMessage>;
```

### 500 Server Error

```jsx
import Error from "@spectrum-icons/illustrations/Error";

<IllustratedMessage>
  <Error />
  <Heading>Error 500: Internal server error</Heading>
  <Content>Something went wrong. Please try again later.</Content>
</IllustratedMessage>;
```

### 503 Service Unavailable

```jsx
import Unavailable from "@spectrum-icons/illustrations/Unavailable";

<IllustratedMessage>
  <Unavailable />
  <Heading>Error 503: Service unavailable</Heading>
  <Content>This page isn't working. Try again later.</Content>
</IllustratedMessage>;
```

### 504 Gateway Timeout

```jsx
import Timeout from "@spectrum-icons/illustrations/Timeout";

<IllustratedMessage>
  <Timeout />
  <Heading>Error 504: Server timeout</Heading>
  <Content>The server took too long. Please try again later.</Content>
</IllustratedMessage>;
```

## Props API

### Core Props

| Name       | Type        | Description                            |
| ---------- | ----------- | -------------------------------------- |
| `children` | `ReactNode` | The contents of the IllustratedMessage |
| `id`       | `string`    | Unique element identifier              |

### Layout/Spacing/Sizing/Positioning Props (Responsive)

All standard Spectrum layout props: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd`, `margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`, `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`, `position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`

### Advanced Props

| Name               | Type            | Description                  |
| ------------------ | --------------- | ---------------------------- |
| `UNSAFE_className` | `string`        | CSS class name (last resort) |
| `UNSAFE_style`     | `CSSProperties` | Inline styles (last resort)  |

## Accessibility

### SVG with Heading

When pairing an SVG with a Heading, set `aria-hidden="true"` and `role="presentation"` on the SVG:

```jsx
<IllustratedMessage>
  <NotFound aria-hidden="true" role="presentation" />
  <Heading>No results</Heading>
  <Content>Try another search</Content>
</IllustratedMessage>
```

### SVG without Heading

If no Heading is provided, the SVG must have an `aria-label` and `role="img"`:

```jsx
<IllustratedMessage>
  <NotFound aria-label="No results" role="img" />
</IllustratedMessage>
```
