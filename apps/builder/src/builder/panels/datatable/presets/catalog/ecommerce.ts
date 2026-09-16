/**
 * E-commerce — dummyjson `/products` `/carts` 스키마를 따랐다.
 *
 * - products: title · description · category · price · discountPercentage · rating · stock ·
 *   brand · sku · weight · dimensions{width,height,depth} · availabilityStatus · thumbnail ·
 *   images[] (picsum seed 는 sku 라 같은 상품이면 같은 사진)
 * - carts: products[{id,title,price,quantity,total,discountPercentage,discountedTotal}] ·
 *   total · discountedTotal · totalProducts · totalQuantity — 합계는 formula 파생
 * - reviews: dummyjson product.reviews[] 를 별 테이블로 (productId FK 1..N)
 */

import { definePreset, type DataTablePreset } from "../types";
import { col, idCol } from "./column";

const round2 = (value: number): number => Math.round(value * 100) / 100;

export const products: DataTablePreset = definePreset({
  id: "products",
  name: "Products",
  descriptionKey: "presetMeta.products",
  category: "ecommerce",
  icon: "Package",
  defaultSampleCount: 20,
  columns: [
    idCol(),
    col(
      "title",
      "string",
      "productName",
      { kind: "productName" },
      { required: true },
    ),
    col("description", "string", "description", {
      kind: "sentence",
      words: 12,
    }),
    col("category", "string", "category", { kind: "productCategory" }),
    col("brand", "string", "brand", { kind: "brand" }, { blank: 0.15 }),
    col("sku", "string", "sku", { kind: "sku" }),
    col("price", "number", "price", { kind: "price", min: 5, max: 1500 }),
    col("discountPercentage", "number", "discount", {
      kind: "weighted",
      options: [
        { value: 0, weight: 4 },
        { value: 5, weight: 2 },
        { value: 10, weight: 2 },
        { value: 15, weight: 1 },
        { value: 25, weight: 1 },
      ],
    }),
    col("rating", "number", "rating", {
      kind: "decimal",
      min: 2.5,
      max: 5,
      precision: 1,
    }),
    // 10% 품절 · 20% 소량 (1~9) · 나머지 10~500
    col("stock", "number", "stock", {
      kind: "formula",
      compute: ({ mock }) => {
        const bucket = mock.random.weighted([
          { value: "out", weight: 1 },
          { value: "low", weight: 2 },
          { value: "ok", weight: 7 },
        ]);
        return bucket === "out"
          ? 0
          : bucket === "low"
            ? mock.random.int(1, 9)
            : mock.random.int(10, 500);
      },
    }),
    col("availabilityStatus", "string", "availability", {
      kind: "formula",
      compute: ({ row, mock }) => {
        const statuses = mock.helpers.poolAll("availabilityStatuses");
        const stock = Number(row.stock ?? 0);
        const index = stock === 0 ? 2 : stock < 10 ? 1 : 0;
        return statuses[Math.min(index, statuses.length - 1)];
      },
    }),
    col("weight", "number", "weight", {
      kind: "decimal",
      min: 0.1,
      max: 25,
      precision: 2,
    }),
    col("dimensions", "object", "dimensions", {
      kind: "object",
      fields: [
        {
          key: "width",
          rule: { kind: "decimal", min: 5, max: 120, precision: 1 },
        },
        {
          key: "height",
          rule: { kind: "decimal", min: 5, max: 120, precision: 1 },
        },
        {
          key: "depth",
          rule: { kind: "decimal", min: 5, max: 120, precision: 1 },
        },
      ],
    }),
    col("tags", "array", "tags", {
      kind: "list",
      pool: "tags",
      min: 1,
      max: 3,
    }),
    col("thumbnail", "image", "thumbnail", {
      kind: "image",
      seedKey: "sku",
      picsum: { width: 200, height: 200 },
    }),
    col("images", "array", "images", {
      kind: "imageList",
      min: 1,
      max: 4,
      picsum: { width: 640, height: 480 },
    }),
    col("isActive", "boolean", "isActive", { kind: "boolean", trueRatio: 0.8 }),
    col("createdAt", "datetime", "createdAt", { kind: "pastDate", years: 2 }),
  ],
});

export const categories: DataTablePreset = definePreset({
  id: "categories",
  name: "Categories",
  descriptionKey: "presetMeta.categories",
  category: "ecommerce",
  icon: "Tag",
  defaultSampleCount: 10,
  columns: [
    idCol({ kind: "id", prefix: "cat_" }),
    col(
      "name",
      "string",
      "categoryName",
      { kind: "pool", name: "productCategories", selection: "sequential" },
      { required: true },
    ),
    col("slug", "string", "slug", {
      kind: "formula",
      compute: ({ index, row }) =>
        `${String(row.name ?? "category")
          .toLowerCase()
          .replace(/\s+/g, "-")}-${index + 1}`,
    }),
    col("parentId", "string", "parentCategoryId", {
      kind: "formula",
      compute: ({ index, mock }) => (index > 3 ? mock.string.id("cat_") : null),
    }),
    col("description", "string", "description", {
      kind: "formula",
      compute: ({ row, t }) =>
        t("presetData.categoryDescription", { name: String(row.name ?? "") }),
    }),
    col("order", "number", "order", { kind: "rowNumber" }),
    col("isActive", "boolean", "isActive", { kind: "constant", value: true }),
  ],
});

export const orders: DataTablePreset = definePreset({
  id: "orders",
  name: "Orders",
  descriptionKey: "presetMeta.orders",
  category: "ecommerce",
  icon: "ShoppingCart",
  defaultSampleCount: 15,
  columns: [
    idCol({ kind: "id", prefix: "ord_" }),
    col("userId", "string", "userId", { kind: "id", prefix: "usr_" }),
    col("items", "array", "orderItems", {
      kind: "array",
      min: 1,
      max: 5,
      item: [
        { key: "productId", rule: { kind: "id", prefix: "prod_" } },
        { key: "quantity", rule: { kind: "int", min: 1, max: 10 } },
        { key: "price", rule: { kind: "int", min: 1000, max: 50000 } },
      ],
    }),
    col("total", "number", "total", {
      kind: "formula",
      compute: ({ row }) =>
        ((row.items as { quantity: number; price: number }[]) ?? []).reduce(
          (sum, item) => sum + item.quantity * item.price,
          0,
        ),
    }),
    col("status", "string", "status", {
      kind: "weightedPool",
      name: "orderStatuses",
      weights: [2, 3, 3, 6, 1],
    }),
    col("shippingAddress", "string", "shippingAddress", { kind: "address" }),
    col("createdAt", "datetime", "orderedAt", { kind: "pastDate", years: 1 }),
  ],
});

export const carts: DataTablePreset = definePreset({
  id: "carts",
  name: "Carts",
  descriptionKey: "presetMeta.carts",
  category: "ecommerce",
  icon: "ShoppingBasket",
  defaultSampleCount: 10,
  columns: [
    idCol(),
    col("userId", "number", "userId", { kind: "int", min: 1, max: 30 }),
    col("products", "array", "cartProducts", {
      kind: "array",
      min: 1,
      max: 4,
      item: [
        { key: "id", rule: { kind: "int", min: 1, max: 100 } },
        { key: "title", rule: { kind: "productName" } },
        { key: "price", rule: { kind: "price", min: 5, max: 500 } },
        { key: "quantity", rule: { kind: "int", min: 1, max: 5 } },
        {
          key: "total",
          rule: {
            kind: "formula",
            compute: ({ row }) =>
              round2(Number(row.price) * Number(row.quantity)),
          },
        },
        {
          key: "discountPercentage",
          rule: {
            kind: "weighted",
            options: [
              { value: 0, weight: 4 },
              { value: 5, weight: 2 },
              { value: 10, weight: 2 },
              { value: 15, weight: 1 },
            ],
          },
        },
        {
          key: "discountedTotal",
          rule: {
            kind: "formula",
            compute: ({ row }) =>
              round2(
                Number(row.total) * (1 - Number(row.discountPercentage) / 100),
              ),
          },
        },
        {
          key: "thumbnail",
          rule: { kind: "image", picsum: { width: 120, height: 120 } },
        },
      ],
    }),
    col("total", "number", "total", {
      kind: "formula",
      compute: ({ row }) =>
        round2(
          ((row.products as { total: number }[]) ?? []).reduce(
            (sum, item) => sum + item.total,
            0,
          ),
        ),
    }),
    col("discountedTotal", "number", "discountedTotal", {
      kind: "formula",
      compute: ({ row }) =>
        round2(
          ((row.products as { discountedTotal: number }[]) ?? []).reduce(
            (sum, item) => sum + item.discountedTotal,
            0,
          ),
        ),
    }),
    col("totalProducts", "number", "totalProducts", {
      kind: "formula",
      compute: ({ row }) => ((row.products as unknown[]) ?? []).length,
    }),
    col("totalQuantity", "number", "totalQuantity", {
      kind: "formula",
      compute: ({ row }) =>
        ((row.products as { quantity: number }[]) ?? []).reduce(
          (sum, item) => sum + item.quantity,
          0,
        ),
    }),
    col("updatedAt", "datetime", "updatedAt", { kind: "pastDate", days: 30 }),
  ],
});

export const reviews: DataTablePreset = definePreset({
  id: "reviews",
  name: "Reviews",
  descriptionKey: "presetMeta.reviews",
  category: "ecommerce",
  icon: "Star",
  defaultSampleCount: 20,
  columns: [
    idCol(),
    col("productId", "number", "productId", { kind: "int", min: 1, max: 20 }),
    col("rating", "number", "rating", {
      kind: "weighted",
      options: [
        { value: 5, weight: 5 },
        { value: 4, weight: 4 },
        { value: 3, weight: 2 },
        { value: 2, weight: 1 },
        { value: 1, weight: 1 },
      ],
    }),
    col("comment", "string", "comment", { kind: "reviewComment" }),
    col("gender", "string", "gender", { kind: "gender" }),
    col("reviewerName", "string", "reviewer", {
      kind: "fullName",
      genderKey: "gender",
    }),
    col("reviewerEmail", "email", "reviewerEmail", {
      kind: "formula",
      compute: ({ index, mock }) =>
        `reviewer${index + 1}@${mock.internet.domain()}`,
    }),
    col("reviewerAvatar", "image", "avatar", {
      kind: "avatar",
      genderKey: "gender",
      size: "thumbnail",
    }),
    col("verified", "boolean", "verifiedPurchase", {
      kind: "boolean",
      trueRatio: 0.65,
    }),
    col("date", "datetime", "reviewDate", { kind: "pastDate", days: 365 }),
  ],
});

export const ECOMMERCE_PRESETS = {
  products,
  categories,
  orders,
  carts,
  reviews,
};
