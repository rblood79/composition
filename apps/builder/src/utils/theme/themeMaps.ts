/**
 * The specs token maps a resolved theme is installed into (ADR-227 Phase 2 step 1) — Skia paint,
 * layout, text measure and the catalog library token reads (`catalogTokenValue`) read these maps
 * through `resolveToken`.
 *
 * The code catalog's own values are copied at module load (before any install): `null` puts them
 * back (a project without a theme), and every install starts from them so no key of an earlier
 * theme remains.
 */
import {
  borderWidth,
  darkColors,
  darkShadows,
  lightColors,
  lightShadows,
  radius,
  typography,
} from "@composition/specs";
import type { ResolvedThemeSnapshot } from "./resolveThemeSnapshot";

type TokenMap = Record<string, unknown>;

const MAPS = {
  lightColors: lightColors as unknown as TokenMap,
  darkColors: darkColors as unknown as TokenMap,
  typography: typography as unknown as TokenMap,
  radius: radius as unknown as TokenMap,
  borderWidth: borderWidth as unknown as TokenMap,
  lightShadows: lightShadows as unknown as TokenMap,
  darkShadows: darkShadows as unknown as TokenMap,
};
type MapName = keyof typeof MAPS;

const CODE_VALUES = Object.fromEntries(
  Object.entries(MAPS).map(([name, map]) => [name, { ...map }]),
) as Record<MapName, Readonly<TokenMap>>;

function replace(name: MapName, source: Readonly<TokenMap> = {}): void {
  const target = MAPS[name];
  for (const key of Object.keys(target))
    if (!(key in CODE_VALUES[name])) delete target[key];
  Object.assign(target, CODE_VALUES[name], source);
}

/** Install a resolved theme into the specs maps, or the code catalog's values for `null`. */
export function installThemeMaps(snapshot: ResolvedThemeSnapshot | null): void {
  replace("lightColors", snapshot?.colors.light);
  replace("darkColors", snapshot?.colors.dark);
  replace("typography", snapshot?.typography);
  replace("radius", snapshot?.radius);
  replace("borderWidth", snapshot?.border);
  replace("lightShadows", snapshot?.shadows.light);
  replace("darkShadows", snapshot?.shadows.dark);
}
