/**
 * Copyright 2024 Adobe. Licensed under Apache-2.0.
 * S2 1.8.2 Search, Cross, Asterisk and Chevron SVG geometry, from @react-spectrum/s2.
 * Original source: https://github.com/adobe/react-spectrum
 * 원래 viewBox를 보존하며 DOM과 Canvas가 같은 경로를 소비한다.
 */
import type { LucideIconData } from "./lucideIcons";

const SEARCH: LucideIconData = {
  viewBoxSize: 20,
  filled: true,
  paths: [
    "m18.53 17.47-5.083-5.084C14.417 11.186 15 9.66 15 8c0-3.86-3.14-7-7-7S1 4.14 1 8s3.14 7 7 7c1.66 0 3.185-.584 4.386-1.553l5.084 5.083c.146.147.338.22.53.22s.384-.073.53-.22c.293-.293.293-.767 0-1.06M8 13.5c-3.032 0-5.5-2.468-5.5-5.5S4.968 2.5 8 2.5s5.5 2.468 5.5 5.5-2.468 5.5-5.5 5.5",
  ],
};
const CROSS: Record<string, LucideIconData> = {
  S: {
    viewBoxSize: 8,
    filled: true,
    paths: [
      "m5.188 4 2.14-2.14A.84.84 0 0 0 6.14.671L4 2.812 1.86.672A.84.84 0 0 0 .672 1.859L2.812 4 .672 6.14A.84.84 0 0 0 1.86 7.329L4 5.188l2.14 2.14a.84.84 0 0 0 1.188 0 .84.84 0 0 0 0-1.187z",
    ],
  },
  M: {
    viewBoxSize: 8,
    filled: true,
    paths: [
      "m5.238 4 2.456-2.456A.876.876 0 0 0 6.457.306L4 2.762 1.543.306A.875.875 0 1 0 .306 1.544L2.762 4 .306 6.456a.876.876 0 0 0 1.237 1.238L4 5.238l2.457 2.456a.871.871 0 0 0 1.237 0 .876.876 0 0 0 0-1.238z",
    ],
  },
  L: {
    viewBoxSize: 10,
    filled: true,
    paths: [
      "m6.289 5 2.922-2.923A.912.912 0 0 0 7.922.788L5 3.711 2.078.788a.912.912 0 0 0-1.29 1.29L3.712 5 .789 7.923a.912.912 0 0 0 1.289 1.289L5 6.289l2.922 2.923a.91.91 0 0 0 1.29 0 .91.91 0 0 0 0-1.29z",
    ],
  },
  XL: {
    viewBoxSize: 12,
    filled: true,
    paths: [
      "m7.342 6 3.396-3.396a.95.95 0 1 0-1.342-1.342L6 4.658 2.604 1.262a.95.95 0 1 0-1.343 1.342L4.659 6 1.262 9.396a.95.95 0 1 0 1.343 1.342L6 7.342l3.396 3.396a.946.946 0 0 0 1.342.001.95.95 0 0 0 0-1.343z",
    ],
  },
};

// Field.tsx maps S fields to the M Asterisk; L and XL keep separate optical paths.
const ASTERISK: Record<string, LucideIconData> = {
  M: {
    viewBoxSize: 8,
    filled: true,
    paths: [
      "M6.575 6.555c.055.056.092.13 0 .2l-1.149.741c-.092.056-.129.019-.166-.074L3.834 4.94 1.963 7c-.019.036-.074.073-.129 0l-.889-.927c-.093-.055-.074-.111 0-.166l2.111-1.76L.648 3.24c-.037 0-.092-.074-.056-.167l.63-1.259a.1.1 0 0 1 .121-.066.1.1 0 0 1 .046.03L3.5 3.148l.13-2.7a.1.1 0 0 1 .081-.11h.03l1.537.2c.093 0 .111.036.093.13l-.723 2.646 2.445-.741c.055-.037.111-.037.148.074l.241 1.37c.018.093 0 .13-.074.13l-2.556.2z",
    ],
  },
  L: {
    viewBoxSize: 10,
    filled: true,
    paths: [
      "M7.861 7.953c.062.063.1.146 0 .23l-1.293.834c-.1.063-.145.021-.187-.083l-1.6-2.793-2.105 2.314c-.021.04-.083.082-.145 0l-1-1.043c-.1-.062-.083-.125 0-.187l2.375-1.981-2.715-1.026c-.042 0-.1-.083-.063-.188l.707-1.412a.11.11 0 0 1 .136-.074q.03.01.052.034l2.378 1.54.146-3.043A.11.11 0 0 1 4.638.95h.034l1.73.23c.1 0 .125.042.1.146l-.814 2.979 2.751-.834c.062-.042.125-.042.167.083l.271 1.542c.02.1 0 .146-.083.146l-2.876.23z",
    ],
  },
  XL: {
    viewBoxSize: 10,
    filled: true,
    paths: [
      "M8.266 8.324c.07.071.116.164 0 .258l-1.454.938c-.116.071-.163.024-.21-.094l-1.8-3.141-2.367 2.6c-.024.045-.094.092-.163 0l-1.13-1.167c-.118-.07-.094-.141 0-.21l2.671-2.227L.766 4.13c-.047 0-.116-.094-.071-.211l.8-1.593a.124.124 0 0 1 .153-.084.13.13 0 0 1 .058.038l2.669 1.738.164-3.422a.124.124 0 0 1 .1-.14h.038l1.945.258c.118 0 .14.047.118.164l-.915 3.349 3.094-.938c.07-.047.14-.047.187.094l.3 1.734c.023.118 0 .164-.094.164l-3.234.258z",
    ],
  },
};

// Breadcrumbs.tsx draws `<ChevronIcon size="M" />` after every crumb's link (ui-icons Chevron M =
// `S2_ChevronSize100`, right-pointing); the crumb's separator Icon defaults to it.
const CHEVRON: LucideIconData = {
  viewBoxSize: 10,
  filled: true,
  paths: [
    "M7.965 5.178C7.978 5.118 8 5.061 8 5s-.021-.118-.034-.178c-.01-.05-.01-.102-.03-.15-.023-.058-.068-.107-.104-.16-.03-.042-.047-.09-.084-.127l-.004-.003-.003-.004L3.615.303a.875.875 0 1 0-1.23 1.244L5.88 5 2.385 8.453a.875.875 0 1 0 1.23 1.244L7.74 5.622l.003-.004.004-.003c.037-.038.055-.085.084-.127.036-.053.08-.102.104-.16.02-.048.02-.1.03-.15",
  ],
};

// Breadcrumbs.tsx `BreadcrumbMenu`: the collapsed crumbs' menu button (`S2_Icon_FolderBreadcrumb_20_N`).
const FOLDER_BREADCRUMB: LucideIconData = {
  viewBoxSize: 20,
  filled: true,
  paths: [
    "M16.75 5h-5.964c-.218 0-.424-.094-.566-.259L8.516 2.777C8.089 2.283 7.47 2 6.816 2H3.25C2.01 2 1 3.01 1 4.25v10.5C1 15.99 2.01 17 3.25 17h13.5c1.24 0 2.25-1.01 2.25-2.25v-7.5C19 6.01 17.99 5 16.75 5M3.25 3.5h3.565c.218 0 .424.094.567.259L8.459 5H2.5v-.75c0-.413.337-.75.75-.75M17.5 14.75c0 .413-.337.75-.75.75H3.25c-.413 0-.75-.337-.75-.75V6.5h14.25c.413 0 .75.337.75.75z",
    "M10 13.65c-.192 0-.384-.073-.53-.22l-3-3c-.293-.292-.293-.767 0-1.06s.767-.293 1.06 0L10 11.84l2.47-2.47c.293-.293.767-.293 1.06 0s.293.768 0 1.06l-3 3c-.146.147-.338.22-.53.22",
  ],
};

export const SPECTRUM_ICON_NAMES = [
  "s2-search",
  "s2-cross",
  "s2-asterisk",
  "s2-chevron",
  "s2-folder-breadcrumb",
] as const;

export function spectrumIconData(
  name: string,
  size: string,
): LucideIconData | undefined {
  if (name === "s2-asterisk") return ASTERISK[size] ?? ASTERISK.M;
  if (name === "s2-search") return SEARCH;
  if (name === "s2-cross") return CROSS[size] ?? CROSS.M;
  if (name === "s2-chevron") return CHEVRON;
  if (name === "s2-folder-breadcrumb") return FOLDER_BREADCRUMB;
}
