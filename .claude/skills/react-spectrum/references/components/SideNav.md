# SideNav

A SideNav provides users with a way to navigate nested hierarchical set of links.

```tsx
import {SideNav, SideNavItem, SideNavItemContent, SideNavItemLink} from '@react-spectrum/s2/SideNav';
import {RoutedSideNav} from './RoutedSideNav';
import {style} from '@react-spectrum/s2/style' with {type: 'macro'};

<RoutedSideNav defaultSelectedRoute="/guidelines">
  {({selectedRoute}) => (
    <SideNav
      aria-label="Files"
      
      selectedRoute={selectedRoute}
      styles={style({height: 240, width: 210})}
      defaultExpandedKeys={['guidelines', 'color']}>
      <SideNavItem href="/guidelines" id="guidelines" textValue="Guidelines">
        <SideNavItemContent><SideNavItemLink>Guidelines</SideNavItemLink></SideNavItemContent>
        <SideNavItem href="/style" id="style" textValue="Style">
          <SideNavItemContent><SideNavItemLink>Style</SideNavItemLink></SideNavItemContent>
        </SideNavItem>
        <SideNavItem href="/color" id="color" textValue="Color">
          <SideNavItemContent><SideNavItemLink>Color</SideNavItemLink></SideNavItemContent>
          <SideNavItem href="/background-layers" id="background-layers" textValue="Background Layers">
            <SideNavItemContent><SideNavItemLink>Background Layers</SideNavItemLink></SideNavItemContent>
          </SideNavItem>
        </SideNavItem>
      </SideNavItem>
      <SideNavItem id="support" textValue="Support">
        <SideNavItemContent>Support</SideNavItemContent>
        <SideNavItem href="/contact-us" id="contact-us" textValue="Contact Us">
          <SideNavItemContent><SideNavItemLink>Contact Us</SideNavItemLink></SideNavItemContent>
        </SideNavItem>
      </SideNavItem>
    </SideNav>
  )}
</RoutedSideNav>
```

## Content

`SideNav` follows the [Collection Components API](collections.md), accepting both static and dynamic collections. This example shows a dynamic collection, passing a list of objects to the `items` prop, and a recursive function to render the children.

```tsx
import {SideNav, SideNavItem, SideNavItemContent, SideNavItemLink, Collection} from '@react-spectrum/s2/SideNav';
import {RoutedSideNav} from './RoutedSideNav';
import {style} from '@react-spectrum/s2/style' with {type: 'macro'};

interface Item {
  id: number;
  title: string;
  type: 'directory' | 'file';
  href?: string;
  children?: Item[];
}

let items: Item[] = [
  {id: 1, title: 'Documents', type: 'directory', children: [
    {id: 2, title: 'Project', type: 'directory', children: [
      {id: 3, title: 'Notes', type: 'file', href: '/notes'},
      {id: 4, title: 'Budget', type: 'file', href: '/budget'}
    ]}
  ]},
  {id: 5, title: 'Photos', type: 'directory', children: [
    {id: 6, title: 'Image 1', type: 'file', href: '/image-1'},
    {id: 7, title: 'Image 2', type: 'file', href: '/image-2'}
  ]}
];

<RoutedSideNav defaultSelectedRoute="/notes">
  {({selectedRoute}) => (
    <SideNav
      aria-label="Files"
      styles={style({height: 260, width: 210})}
      selectedRoute={selectedRoute}
      defaultExpandedKeys={[1, 2, 5]}
      items={items}>
      {function renderItem(item) {
        return (
          <SideNavItem textValue={item.title} href={item.href}>
            <SideNavItemContent>{item.href ? <SideNavItemLink>{item.title}</SideNavItemLink> : item.title}</SideNavItemContent>
            {/*- begin highlight -*/}
            {/* recursively render children */}
            {item.children && <Collection items={item.children}>
              {renderItem}
            </Collection>}
            {/*- end highlight -*/}
          </SideNavItem>
        );
      }}
    </SideNav>
  )}
</RoutedSideNav>
```

### Slots

`SideNavItemContent` supports icons, `Text`, [SideNavItemLink](#sidenavitemlink), [ActionMenu](ActionMenu.md), and [ActionButtonGroup](ActionButtonGroup.md) as children.

```tsx
import {SideNav, SideNavItem, SideNavItemContent, SideNavItemLink, Collection, Text} from '@react-spectrum/s2/SideNav';
import {RoutedSideNav} from './RoutedSideNav';
import {ActionMenu, MenuItem} from '@react-spectrum/s2/ActionMenu';
import Folder from '@react-spectrum/s2/icons/Folder';
import File from '@react-spectrum/s2/icons/File';
import Edit from '@react-spectrum/s2/icons/Edit';
import Delete from '@react-spectrum/s2/icons/Delete';
import {style} from '@react-spectrum/s2/style' with {type: 'macro'};

interface Item {
  id: number;
  title: string;
  type: 'directory' | 'file';
  href?: string;
  children?: Item[];
}
let items: Item[] = [
  {id: 1, title: 'Documents', type: 'directory', children: [
    {id: 2, title: 'Project', type: 'directory', children: [
      {id: 3, title: 'Notes', type: 'file', href: '/notes'},
      {id: 4, title: 'Budget', type: 'file', href: '/budget'}
    ]}
  ]},
  {id: 5, title: 'Photos', type: 'directory', children: [
    {id: 6, title: 'Image 1', type: 'file', href: '/image-1'},
    {id: 7, title: 'Image 2', type: 'file', href: '/image-2'}
  ]}
];

<RoutedSideNav defaultSelectedRoute="/notes">
  {({selectedRoute}) => (
    <SideNav
      aria-label="Files"
      styles={style({height: 300, width: 210})}
      selectedRoute={selectedRoute}
      defaultExpandedKeys={[1, 2, 5]}
      items={items}>
      {function renderItem(item) {
        return (
          <SideNavItem textValue={item.title} href={item.href}>
            <SideNavItemContent>
              {/*- begin highlight -*/}
              {
                item.href ? <SideNavItemLink>
                  {item.type === 'directory' ? <Folder /> : <File />}
                  <Text>{item.title}</Text>
                </SideNavItemLink> : <>
                  {item.type === 'directory' ? <Folder /> : <File />}
                  <Text>{item.title}</Text>
                </>
              }
              {/*- end highlight -*/}
              <ActionMenu>
                <MenuItem>
                  <Edit />
                  <Text>Edit</Text>
                </MenuItem>
                <MenuItem>
                  <Delete />
                  <Text>Delete</Text>
                </MenuItem>
              </ActionMenu>
            </SideNavItemContent>
            {item.children && <Collection items={item.children}>
              {renderItem}
            </Collection>}
          </SideNavItem>
        );
      }}
    </SideNav>
  )}
</RoutedSideNav>
```

## Routing

SideNavs do not support an uncontrolled selection state, you are responsible for managing it through the `selectedRoute` prop. You may wire this up
to a router or other state management solution. The example below derives `selectedRoute` from the router's current location,
and provides React Aria's `RouterProvider` with the router's `navigate` function so that clicking an item performs a client side navigation.

If a SideNavItem has an `href`, then you must pass a `SideNavItemLink` as a child of the `SideNavItemContent`.

See Routing setup in [Getting Started](./getting-started.md) for more info.

```tsx
import {SideNav, SideNavItem, SideNavItemContent, SideNavItemLink, Text} from '@react-spectrum/s2/SideNav';
import {RouterProvider} from 'react-aria-components';
import {MemoryRouter, useLocation, useNavigate} from './router';
import {style} from '@react-spectrum/s2/style' with {type: 'macro'};
import CCLibrary from '@react-spectrum/s2/icons/CCLibrary';
import Files from '@react-spectrum/s2/icons/Files';
import Images from '@react-spectrum/s2/icons/Images';

function FilesSideNav() {
  /*- begin highlight -*/
  let navigate = useNavigate();
  let {pathname} = useLocation();

  return (
    <RouterProvider navigate={navigate}>
      <SideNav aria-label="Files" defaultExpandedKeys={['your-libraries']} selectedRoute={pathname} styles={style({height: 120, width: 210})}>
      {/*- end highlight -*/}
        <SideNavItem href="/files" textValue="Files">
          <SideNavItemContent>
            <SideNavItemLink>
              <Files />
              <Text>Files</Text>
            </SideNavItemLink>
          </SideNavItemContent>
        </SideNavItem>
        <SideNavItem id="your-libraries" href="/your-libraries" textValue="Your Libraries">
          <SideNavItemContent>
            <SideNavItemLink>
              <CCLibrary />
              <Text>Your Libraries</Text>
            </SideNavItemLink>
          </SideNavItemContent>
          <SideNavItem id="photos" href="/photos" textValue="Photos">
            <SideNavItemContent>
              <SideNavItemLink>
                <Images />
                <Text>Photos</Text>
              </SideNavItemLink>
            </SideNavItemContent>
          </SideNavItem>
        </SideNavItem>
      </SideNav>
    </RouterProvider>
  );
}

<MemoryRouter initialEntries={['/files']}>
  <FilesSideNav />
</MemoryRouter>
```

## Sections

A SideNav can contain sections to group items together. They are non-collapsible and non-interactive.

```tsx
import {SideNav, SideNavItem, SideNavItemContent, SideNavItemLink, SideNavSection, SideNavHeader, Text} from '@react-spectrum/s2/SideNav';
import {RoutedSideNav} from './RoutedSideNav';
import {style} from '@react-spectrum/s2/style' with {type: 'macro'};
import UserGroup from '@react-spectrum/s2/icons/UserGroup';
import CCLibrary from '@react-spectrum/s2/icons/CCLibrary';
import Files from '@react-spectrum/s2/icons/Files';
import Images from '@react-spectrum/s2/icons/Images';
import Animation from '@react-spectrum/s2/icons/Animation';
import Download from '@react-spectrum/s2/icons/Download';
import Apps from '@react-spectrum/s2/icons/Apps';

<RoutedSideNav defaultSelectedRoute="/files">
  {({selectedRoute}) => (
    <SideNav aria-label="Files" selectedRoute={selectedRoute} styles={style({height: 260, width: 210})}>
      {/*- begin highlight -*/}
      <SideNavSection>
        <SideNavHeader>Favorites</SideNavHeader>
      {/*- end highlight -*/}
        <SideNavItem href="/applications" textValue="Applications">
          <SideNavItemContent>
            <SideNavItemLink>
              <Apps />
              <Text>Applications</Text>
            </SideNavItemLink>
          </SideNavItemContent>
        </SideNavItem>
        <SideNavItem href="/downloads" textValue="Downloads">
          <SideNavItemContent>
            <SideNavItemLink>
              <Download />
              <Text>Downloads</Text>
            </SideNavItemLink>
          </SideNavItemContent>
        </SideNavItem>
      </SideNavSection>
      <SideNavSection>
        <SideNavHeader>Workspaces</SideNavHeader>
        <SideNavItem href="/files" textValue="Files">
          <SideNavItemContent>
            <SideNavItemLink>
              <Files />
              <Text>Files</Text>
            </SideNavItemLink>
          </SideNavItemContent>
        </SideNavItem>
        <SideNavItem href="/your-libraries" textValue="Your Libraries">
          <SideNavItemContent>
            <SideNavItemLink>
              <CCLibrary />
              <Text>Your Libraries</Text>
            </SideNavItemLink>
          </SideNavItemContent>
          <SideNavItem href="/photos" textValue="Photos">
            <SideNavItemContent>
              <SideNavItemLink>
                <Images />
                <Text>Photos</Text>
              </SideNavItemLink>
            </SideNavItemContent>
          </SideNavItem>
        </SideNavItem>
        <SideNavItem href="/shared-with-you" id="shared-with-you" textValue="Shared with You">
          <SideNavItemContent>
            <SideNavItemLink>
              <UserGroup />
              <Text>Shared with You</Text>
            </SideNavItemLink>
          </SideNavItemContent>
          <SideNavItem href="/animations" textValue="Animations">
            <SideNavItemContent>
              <SideNavItemLink>
                <Animation />
                <Text>Animations</Text>
              </SideNavItemLink>
            </SideNavItemContent>
          </SideNavItem>
        </SideNavItem>
      </SideNavSection>
    </SideNav>
  )}
</RoutedSideNav>
```

## API

```tsx
<SideNav>
  <SideNavItem>
    <SideNavItemContent>
      <Icon />
      <Text />
      <ActionMenu /> or <ActionButtonGroup />
    </SideNavItemContent>
  </SideNavItem>
  <SideNavItem href>
    <SideNavItemContent>
      <SideNavItemLink>
        <Icon />
        <Text />
      </SideNavItemLink>
      <ActionMenu /> or <ActionButtonGroup />
    </SideNavItemContent>
  </SideNavItem>
</SideNav>
```

### SideNav

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `aria-describedby` | `string | undefined` | — | Identifies the element (or elements) that describes the object. |
| `aria-details` | `string | undefined` | — | Identifies the element (or elements) that provide a detailed, extended description for the object. |
| `aria-label` | `string | undefined` | — | Defines a string value that labels the current element. |
| `aria-labelledby` | `string | undefined` | — | Identifies the element (or elements) that labels the current element. |
| `autoFocus` | `boolean | FocusStrategy | undefined` | — | Whether to auto focus the gridlist or an option. |
| `children` | `((item: T) => ReactNode) | ReactNode` | — | The contents of the collection. |
| `defaultExpandedKeys` | `Iterable<Key> | undefined` | — | The initial expanded keys in the collection (uncontrolled). |
| `dependencies` | `readonly any[] | undefined` | — | Values that should invalidate the item cache when using dynamic collections. |
| `disabledKeys` | `Iterable<Key> | undefined` | — | The item keys that are disabled. These items cannot be selected, focused, or otherwise interacted with. |
| `expandedKeys` | `Iterable<Key> | undefined` | — | The currently expanded keys in the collection (controlled). |
| `id` | `string | undefined` | — | The element's unique identifier. See [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/id). |
| `items` | `Iterable<T> | undefined` | — | Item objects in the collection. |
| `onExpandedChange` | `((keys: Set<Key>) => any) | undefined` | — | Handler that is called when items are expanded or collapsed. |
| `selectedRoute` | `string | null | undefined` | — | The route that is currently selected. |
| `slot` | `string | null | undefined` | — | A slot name for the component. Slots allow the component to receive props from a parent component. An explicit `null` value indicates that the local props completely override all props received from a parent. |
| `styles` | `StylesPropWithHeight | undefined` | — | Spectrum-defined styles, returned by the `style()` macro. |
| `UNSAFE_className` | `UnsafeClassName | undefined` | — | Sets the CSS [className](https://developer.mozilla.org/en-US/docs/Web/API/Element/className) for the element. Only use as a **last resort**. Use the `style` macro via the `styles` prop instead. |
| `UNSAFE_style` | `CSSProperties | undefined` | — | Sets inline [style](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/style) for the element. Only use as a **last resort**. Use the `style` macro via the `styles` prop instead. |

### SideNavItem

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `aria-label` | `string | undefined` | — | An accessibility label for this tree item. |
| `children` | `ReactNode` | — | The content of the tree item along with any nested children. Supports static nested tree items or use of a Collection to dynamically render nested tree items. |
| `download` | `boolean | string | undefined` | — | Causes the browser to download the linked URL. A string may be provided to suggest a file name. See [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#download). |
| `hasChildItems` | `boolean | undefined` | — | Whether this item has children. |
| `href` | `string | undefined` | — | A URL to link to. See [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#href). |
| `hrefLang` | `string | undefined` | — | Hints at the human language of the linked URL. See[MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#hreflang). |
| `id` | `Key | undefined` | — | The unique id of the tree row. |
| `isDisabled` | `boolean | undefined` | — | Whether the item is disabled. |
| `onHoverChange` | `((isHovering: boolean) => void) | undefined` | — | Handler that is called when the hover state changes. |
| `onHoverEnd` | `((e: HoverEvent) => void) | undefined` | — | Handler that is called when a hover interaction ends. |
| `onHoverStart` | `((e: HoverEvent) => void) | undefined` | — | Handler that is called when a hover interaction starts. |
| `onPress` | `((e: PressEvent) => void) | undefined` | — | Handler that is called when the press is released over the target. |
| `onPressChange` | `((isPressed: boolean) => void) | undefined` | — | Handler that is called when the press state changes. |
| `onPressEnd` | `((e: PressEvent) => void) | undefined` | — | Handler that is called when a press interaction ends, either over the target or when the pointer leaves the target. |
| `onPressStart` | `((e: PressEvent) => void) | undefined` | — | Handler that is called when a press interaction starts. |
| `onPressUp` | `((e: PressEvent) => void) | undefined` | — | Handler that is called when a press is released over the target, regardless of whether it started on the target or not. |
| `ping` | `string | undefined` | — | A space-separated list of URLs to ping when the link is followed. See [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#ping). |
| `referrerPolicy` | `HTMLAttributeReferrerPolicy | undefined` | — | How much of the referrer to send when following the link. See [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#referrerpolicy). |
| `rel` | `string | undefined` | — | The relationship between the linked resource and the current page. See [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel). |
| `routerOptions` | `undefined` | — | Options for the configured client side router. |
| `target` | `HTMLAttributeAnchorTarget | undefined` | — | The target window for the link. See [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#target). |
| `textValue` | `string` | — | A string representation of the side nav item's contents, used for features like typeahead. |

### SideNavItemContent

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Rendered contents of the side nav item or child items. |

### SideNavItemLink

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Rendered contents of the link. |

### SideNavSection

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `aria-label` | `string | undefined` | — | An accessibility label for the section. |
| `children` | `((item: T) => ReactElement) | ReactNode` | — | Static child items or a function to render children. |
| `dependencies` | `readonly any[] | undefined` | — | Values that should invalidate the item cache when using dynamic collections. |
| `dir` | `string | undefined` | — |  |
| `hidden` | `boolean | undefined` | — |  |
| `id` | `Key | undefined` | — | The unique id of the section. |
| `inert` | `boolean | undefined` | — |  |
| `items` | `Iterable<T> | undefined` | — | Item objects in the section. |
| `lang` | `string | undefined` | — |  |
| `onAnimationEnd` | `AnimationEventHandler<HTMLElement> | undefined` | — |  |
| `onAnimationEndCapture` | `AnimationEventHandler<HTMLElement> | undefined` | — |  |
| `onAnimationIteration` | `AnimationEventHandler<HTMLElement> | undefined` | — |  |
| `onAnimationIterationCapture` | `AnimationEventHandler<HTMLElement> | undefined` | — |  |
| `onAnimationStart` | `AnimationEventHandler<HTMLElement> | undefined` | — |  |
| `onAnimationStartCapture` | `AnimationEventHandler<HTMLElement> | undefined` | — |  |
| `onAuxClick` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onAuxClickCapture` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onClick` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onClickCapture` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onContextMenu` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onContextMenuCapture` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onDoubleClick` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onDoubleClickCapture` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onGotPointerCapture` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onGotPointerCaptureCapture` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onLostPointerCapture` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onLostPointerCaptureCapture` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onMouseDown` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onMouseDownCapture` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onMouseEnter` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onMouseLeave` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onMouseMove` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onMouseMoveCapture` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onMouseOut` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onMouseOutCapture` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onMouseOver` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onMouseOverCapture` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onMouseUp` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onMouseUpCapture` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerCancel` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerCancelCapture` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerDown` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerDownCapture` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerEnter` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerLeave` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerMove` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerMoveCapture` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerOut` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerOutCapture` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerOver` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerOverCapture` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerUp` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerUpCapture` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onScroll` | `UIEventHandler<HTMLElement> | undefined` | — |  |
| `onScrollCapture` | `UIEventHandler<HTMLElement> | undefined` | — |  |
| `onTouchCancel` | `TouchEventHandler<HTMLElement> | undefined` | — |  |
| `onTouchCancelCapture` | `TouchEventHandler<HTMLElement> | undefined` | — |  |
| `onTouchEnd` | `TouchEventHandler<HTMLElement> | undefined` | — |  |
| `onTouchEndCapture` | `TouchEventHandler<HTMLElement> | undefined` | — |  |
| `onTouchMove` | `TouchEventHandler<HTMLElement> | undefined` | — |  |
| `onTouchMoveCapture` | `TouchEventHandler<HTMLElement> | undefined` | — |  |
| `onTouchStart` | `TouchEventHandler<HTMLElement> | undefined` | — |  |
| `onTouchStartCapture` | `TouchEventHandler<HTMLElement> | undefined` | — |  |
| `onTransitionCancel` | `TransitionEventHandler<HTMLElement> | undefined` | — |  |
| `onTransitionCancelCapture` | `TransitionEventHandler<HTMLElement> | undefined` | — |  |
| `onTransitionEnd` | `TransitionEventHandler<HTMLElement> | undefined` | — |  |
| `onTransitionEndCapture` | `TransitionEventHandler<HTMLElement> | undefined` | — |  |
| `onTransitionRun` | `TransitionEventHandler<HTMLElement> | undefined` | — |  |
| `onTransitionRunCapture` | `TransitionEventHandler<HTMLElement> | undefined` | — |  |
| `onTransitionStart` | `TransitionEventHandler<HTMLElement> | undefined` | — |  |
| `onTransitionStartCapture` | `TransitionEventHandler<HTMLElement> | undefined` | — |  |
| `onWheel` | `WheelEventHandler<HTMLElement> | undefined` | — |  |
| `onWheelCapture` | `WheelEventHandler<HTMLElement> | undefined` | — |  |
| `translate` | `"no" | "yes" | undefined` | — |  |

### SideNavHeader

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | The children of the component. |
| `dir` | `string | undefined` | — |  |
| `hidden` | `boolean | undefined` | — |  |
| `id` | `string | undefined` | — | The element's unique identifier. See [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/id). |
| `inert` | `boolean | undefined` | — |  |
| `lang` | `string | undefined` | — |  |
| `onAnimationEnd` | `AnimationEventHandler<HTMLElement> | undefined` | — |  |
| `onAnimationEndCapture` | `AnimationEventHandler<HTMLElement> | undefined` | — |  |
| `onAnimationIteration` | `AnimationEventHandler<HTMLElement> | undefined` | — |  |
| `onAnimationIterationCapture` | `AnimationEventHandler<HTMLElement> | undefined` | — |  |
| `onAnimationStart` | `AnimationEventHandler<HTMLElement> | undefined` | — |  |
| `onAnimationStartCapture` | `AnimationEventHandler<HTMLElement> | undefined` | — |  |
| `onAuxClick` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onAuxClickCapture` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onClick` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onClickCapture` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onContextMenu` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onContextMenuCapture` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onDoubleClick` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onDoubleClickCapture` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onGotPointerCapture` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onGotPointerCaptureCapture` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onLostPointerCapture` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onLostPointerCaptureCapture` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onMouseDown` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onMouseDownCapture` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onMouseEnter` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onMouseLeave` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onMouseMove` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onMouseMoveCapture` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onMouseOut` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onMouseOutCapture` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onMouseOver` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onMouseOverCapture` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onMouseUp` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onMouseUpCapture` | `MouseEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerCancel` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerCancelCapture` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerDown` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerDownCapture` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerEnter` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerLeave` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerMove` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerMoveCapture` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerOut` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerOutCapture` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerOver` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerOverCapture` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerUp` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onPointerUpCapture` | `PointerEventHandler<HTMLElement> | undefined` | — |  |
| `onScroll` | `UIEventHandler<HTMLElement> | undefined` | — |  |
| `onScrollCapture` | `UIEventHandler<HTMLElement> | undefined` | — |  |
| `onTouchCancel` | `TouchEventHandler<HTMLElement> | undefined` | — |  |
| `onTouchCancelCapture` | `TouchEventHandler<HTMLElement> | undefined` | — |  |
| `onTouchEnd` | `TouchEventHandler<HTMLElement> | undefined` | — |  |
| `onTouchEndCapture` | `TouchEventHandler<HTMLElement> | undefined` | — |  |
| `onTouchMove` | `TouchEventHandler<HTMLElement> | undefined` | — |  |
| `onTouchMoveCapture` | `TouchEventHandler<HTMLElement> | undefined` | — |  |
| `onTouchStart` | `TouchEventHandler<HTMLElement> | undefined` | — |  |
| `onTouchStartCapture` | `TouchEventHandler<HTMLElement> | undefined` | — |  |
| `onTransitionCancel` | `TransitionEventHandler<HTMLElement> | undefined` | — |  |
| `onTransitionCancelCapture` | `TransitionEventHandler<HTMLElement> | undefined` | — |  |
| `onTransitionEnd` | `TransitionEventHandler<HTMLElement> | undefined` | — |  |
| `onTransitionEndCapture` | `TransitionEventHandler<HTMLElement> | undefined` | — |  |
| `onTransitionRun` | `TransitionEventHandler<HTMLElement> | undefined` | — |  |
| `onTransitionRunCapture` | `TransitionEventHandler<HTMLElement> | undefined` | — |  |
| `onTransitionStart` | `TransitionEventHandler<HTMLElement> | undefined` | — |  |
| `onTransitionStartCapture` | `TransitionEventHandler<HTMLElement> | undefined` | — |  |
| `onWheel` | `WheelEventHandler<HTMLElement> | undefined` | — |  |
| `onWheelCapture` | `WheelEventHandler<HTMLElement> | undefined` | — |  |
| `translate` | `"no" | "yes" | undefined` | — |  |
