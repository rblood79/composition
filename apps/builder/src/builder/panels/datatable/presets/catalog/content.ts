/**
 * Content — dummyjson `/posts` `/comments` `/todos` `/recipes` `/quotes` 스키마.
 *
 * - posts: title · body · tags[] · reactions{likes,dislikes} · views · userId
 * - comments: body · postId · likes · user{id,username,fullName}
 * - todos: todo · completed · userId (+ dueDate · priority 는 mockaroo 식 조건 컬럼)
 * - recipes: name · ingredients[] · instructions[] · prepTimeMinutes · cookTimeMinutes ·
 *   servings · difficulty · cuisine · caloriesPerServing · tags · image · rating · reviewCount · mealType
 * - quotes: quote · author
 */

import { definePreset, type DataTablePreset } from "../types";
import { col, idCol } from "./column";

export const posts: DataTablePreset = definePreset({
  id: "posts",
  name: "Posts",
  descriptionKey: "presetMeta.posts",
  category: "content",
  icon: "Newspaper",
  defaultSampleCount: 15,
  columns: [
    idCol(),
    col(
      "title",
      "string",
      "title",
      { kind: "title", words: 5 },
      { required: true },
    ),
    col("body", "string", "body", { kind: "paragraph", sentences: 3 }),
    col("tags", "array", "tags", {
      kind: "list",
      pool: "tags",
      min: 1,
      max: 3,
    }),
    col("coverImage", "image", "coverImage", {
      kind: "image",
      picsum: { width: 800, height: 450 },
    }),
    col("likes", "number", "likes", { kind: "int", min: 0, max: 1200 }),
    col("dislikes", "number", "dislikes", { kind: "int", min: 0, max: 60 }),
    col("views", "number", "views", {
      kind: "formula",
      compute: ({ row, mock }) =>
        Number(row.likes) + Number(row.dislikes) + mock.random.int(50, 5000),
    }),
    col("userId", "number", "userId", { kind: "int", min: 1, max: 30 }),
    col("status", "string", "status", {
      kind: "weighted",
      options: [
        { value: "published", weight: 7 },
        { value: "draft", weight: 2 },
        { value: "archived", weight: 1 },
      ],
    }),
    col("publishedAt", "datetime", "publishedAt", {
      kind: "pastDate",
      years: 1,
    }),
  ],
});

export const comments: DataTablePreset = definePreset({
  id: "comments",
  name: "Comments",
  descriptionKey: "presetMeta.comments",
  category: "content",
  icon: "MessageSquare",
  defaultSampleCount: 20,
  columns: [
    idCol(),
    col("postId", "number", "postId", { kind: "int", min: 1, max: 15 }),
    col(
      "body",
      "string",
      "body",
      { kind: "sentence", words: 10 },
      { required: true },
    ),
    col("likes", "number", "likes", { kind: "int", min: 0, max: 200 }),
    col("user", "object", "author", {
      kind: "object",
      fields: [
        { key: "id", rule: { kind: "int", min: 1, max: 30 } },
        { key: "gender", rule: { kind: "gender" } },
        { key: "fullName", rule: { kind: "fullName", genderKey: "gender" } },
        { key: "username", rule: { kind: "username", unique: false } },
        {
          key: "avatar",
          rule: { kind: "avatar", genderKey: "gender", size: "thumbnail" },
        },
      ],
    }),
    col("createdAt", "datetime", "createdAt", { kind: "pastDate", days: 120 }),
  ],
});

export const todos: DataTablePreset = definePreset({
  id: "todos",
  name: "Todos",
  descriptionKey: "presetMeta.todos",
  category: "content",
  icon: "ListChecks",
  defaultSampleCount: 15,
  columns: [
    idCol(),
    col(
      "todo",
      "string",
      "task",
      { kind: "pool", name: "todoTasks" },
      { required: true },
    ),
    col("completed", "boolean", "completed", {
      kind: "boolean",
      trueRatio: 0.4,
    }),
    col("priority", "string", "priority", {
      kind: "weightedPool",
      name: "priorities",
      weights: [3, 5, 2],
    }),
    col("userId", "number", "userId", { kind: "int", min: 1, max: 30 }),
    // 미완료면 앞으로 30일 안, 완료면 지난 60일 안
    col("dueDate", "date", "dueDate", {
      kind: "formula",
      compute: ({ row, mock }) =>
        mock.date.iso(
          row.completed
            ? mock.date.past({ days: 60 })
            : mock.date.future({ days: 30 }),
          false,
        ),
    }),
    col("createdAt", "datetime", "createdAt", { kind: "pastDate", days: 90 }),
  ],
});

export const recipes: DataTablePreset = definePreset({
  id: "recipes",
  name: "Recipes",
  descriptionKey: "presetMeta.recipes",
  category: "content",
  icon: "ChefHat",
  defaultSampleCount: 10,
  columns: [
    idCol(),
    col(
      "name",
      "string",
      "recipeName",
      { kind: "pool", name: "dishes" },
      { required: true },
    ),
    col("cuisine", "string", "cuisine", { kind: "pool", name: "cuisines" }),
    col("mealType", "array", "mealType", {
      kind: "list",
      pool: "mealTypes",
      min: 1,
      max: 2,
    }),
    col("difficulty", "string", "difficulty", {
      kind: "weightedPool",
      name: "difficulties",
      weights: [5, 3, 1],
    }),
    col("ingredients", "array", "ingredients", {
      kind: "list",
      pool: "words",
      min: 4,
      max: 8,
    }),
    col("instructions", "array", "instructions", {
      kind: "array",
      min: 3,
      max: 6,
      item: { kind: "sentence", words: 8 },
    }),
    col("prepTimeMinutes", "number", "prepTime", {
      kind: "int",
      min: 5,
      max: 40,
    }),
    col("cookTimeMinutes", "number", "cookTime", {
      kind: "int",
      min: 10,
      max: 120,
    }),
    col("servings", "number", "servings", { kind: "int", min: 1, max: 8 }),
    col("caloriesPerServing", "number", "calories", {
      kind: "int",
      min: 120,
      max: 900,
    }),
    col("rating", "number", "rating", {
      kind: "decimal",
      min: 3,
      max: 5,
      precision: 1,
    }),
    col("reviewCount", "number", "reviewCount", {
      kind: "int",
      min: 0,
      max: 400,
    }),
    col("tags", "array", "tags", {
      kind: "list",
      pool: "cuisines",
      min: 1,
      max: 2,
    }),
    col("image", "image", "image", {
      kind: "image",
      picsum: { width: 480, height: 320 },
    }),
    col("userId", "number", "userId", { kind: "int", min: 1, max: 30 }),
  ],
});

export const quotes: DataTablePreset = definePreset({
  id: "quotes",
  name: "Quotes",
  descriptionKey: "presetMeta.quotes",
  category: "content",
  icon: "Quote",
  defaultSampleCount: 8,
  columns: [
    idCol(),
    col("quote", "string", "quote", { kind: "quote" }, { required: true }),
    col(
      "author",
      "string",
      "author",
      { kind: "quoteAuthor" },
      { required: true },
    ),
    col("tags", "array", "tags", {
      kind: "list",
      pool: "tags",
      min: 0,
      max: 2,
    }),
    col("likes", "number", "likes", { kind: "int", min: 0, max: 5000 }),
  ],
});

export const CONTENT_PRESETS = { posts, comments, todos, recipes, quotes };
