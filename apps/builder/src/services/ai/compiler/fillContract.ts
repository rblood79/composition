/** 기존 FillItem 타입과 연결한 AI wire schema. 값 기본 생성은 기존 fill factory가 소유한다. */
import { z } from "zod";
import { FillType, type BlendMode } from "../../../types/builder/fill.types";

const blendModes = {
  normal: true,
  multiply: true,
  screen: true,
  overlay: true,
  darken: true,
  lighten: true,
  "color-dodge": true,
  "color-burn": true,
  "hard-light": true,
  "soft-light": true,
  difference: true,
  exclusion: true,
} satisfies Record<BlendMode, true>;
const color = z.string().regex(/^#[\da-f]{6}([\da-f]{2})?$/i);
const fraction = z.number().min(0).max(1);
const center = z.strictObject({ x: fraction, y: fraction });
const stops = z.array(z.strictObject({ color, position: fraction })).min(2);
const pair = z.tuple([z.number(), z.number()]);
const base = {
  id: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  opacity: fraction.optional(),
  blendMode: z
    .enum(Object.keys(blendModes) as [BlendMode, ...BlendMode[]])
    .optional(),
};
const variants = {
  [FillType.Color]: z.strictObject({
    ...base,
    type: z.literal(FillType.Color),
    color,
  }),
  [FillType.LinearGradient]: z.strictObject({
    ...base,
    type: z.literal(FillType.LinearGradient),
    stops,
    rotation: z.number().optional(),
  }),
  [FillType.RadialGradient]: z.strictObject({
    ...base,
    type: z.literal(FillType.RadialGradient),
    stops,
    center: center.optional(),
    radius: z
      .strictObject({
        width: z.number().positive(),
        height: z.number().positive(),
      })
      .optional(),
  }),
  [FillType.AngularGradient]: z.strictObject({
    ...base,
    type: z.literal(FillType.AngularGradient),
    stops,
    center: center.optional(),
    rotation: z.number().optional(),
  }),
  [FillType.Image]: z.strictObject({
    ...base,
    type: z.literal(FillType.Image),
    url: z.string().min(1),
    mode: z.enum(["stretch", "fill", "fit"]).optional(),
  }),
  [FillType.MeshGradient]: z.strictObject({
    ...base,
    type: z.literal(FillType.MeshGradient),
    rows: z.number().int().min(2),
    columns: z.number().int().min(2),
    points: z
      .array(
        z.strictObject({
          position: pair,
          color,
          leftHandle: pair.optional(),
          rightHandle: pair.optional(),
          topHandle: pair.optional(),
          bottomHandle: pair.optional(),
        }),
      )
      .min(4),
  }),
} satisfies Record<FillType, z.ZodObject>;
export const fillContract = z.union(Object.values(variants));
