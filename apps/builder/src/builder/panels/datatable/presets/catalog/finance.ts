/**
 * Finance — mockaroo 의 Money · Credit Card # / Type · Formula 조합과 dummyjson `bank`.
 * Media — picsum `/v2/list` 항목 (id · author · width · height · url · download_url) +
 * 효과 파라미터 (`?grayscale` · `?blur`).
 */

import { definePreset, type DataTablePreset } from "../types";
import { col, idCol } from "./column";

const round2 = (value: number): number => Math.round(value * 100) / 100;

export const transactions: DataTablePreset = definePreset({
  id: "transactions",
  name: "Transactions",
  descriptionKey: "presetMeta.transactions",
  category: "finance",
  icon: "ArrowLeftRight",
  defaultSampleCount: 25,
  columns: [
    idCol({ kind: "sequence", prefix: "TXN-", pad: 6 }),
    col("accountId", "string", "accountId", { kind: "accountNumber" }),
    col("type", "string", "transactionType", {
      kind: "weightedPool",
      name: "transactionTypes",
      weights: [7, 2, 1],
    }),
    // 출금은 음수, 입금·환불은 양수
    col("amount", "number", "amount", {
      kind: "formula",
      compute: ({ row, mock }) => {
        const types = mock.helpers.poolAll("transactionTypes");
        const isDebit = String(row.type) === types[0];
        const value = mock.finance.amount({ min: 1, max: 2500 });
        return isDebit ? -value : value;
      },
    }),
    col("currency", "string", "currency", { kind: "currency" }),
    col("merchant", "string", "merchant", { kind: "merchant" }),
    col("category", "string", "category", { kind: "transactionCategory" }),
    col(
      "description",
      "string",
      "description",
      { kind: "words", count: 4 },
      { blank: 0.3 },
    ),
    col("status", "string", "status", {
      kind: "weighted",
      options: [
        { value: "settled", weight: 8 },
        { value: "pending", weight: 1 },
        { value: "failed", weight: 1 },
      ],
    }),
    col("balanceAfter", "number", "balance", {
      kind: "formula",
      compute: ({ row, mock }) =>
        round2(mock.random.float(500, 20000) + Number(row.amount)),
    }),
    col("reference", "string", "reference", { kind: "uuid" }),
    col("transactedAt", "datetime", "transactedAt", {
      kind: "pastDate",
      days: 90,
    }),
  ],
});

export const paymentCards: DataTablePreset = definePreset({
  id: "paymentCards",
  name: "Payment Cards",
  descriptionKey: "presetMeta.paymentCards",
  category: "finance",
  icon: "CreditCard",
  defaultSampleCount: 8,
  columns: [
    idCol(),
    col("userId", "number", "userId", { kind: "int", min: 1, max: 30 }),
    col(
      "cardholder",
      "string",
      "cardholder",
      { kind: "fullName" },
      { required: true },
    ),
    col("cardType", "string", "cardType", { kind: "cardType" }),
    // 실제 Luhn 유효 번호 — 마스킹은 표시 컬럼이 따로
    col("cardNumber", "string", "cardNumber", {
      kind: "creditCardNumber",
      typeKey: "cardType",
    }),
    col("cardNumberMasked", "string", "cardNumberMasked", {
      kind: "formula",
      compute: ({ row, mock }) =>
        mock.finance.maskCard(String(row.cardNumber ?? "")),
    }),
    col("last4", "string", "last4", {
      kind: "formula",
      compute: ({ row }) => String(row.cardNumber ?? "").slice(-4),
    }),
    col("expiry", "string", "expiry", { kind: "cardExpiry" }),
    col("currency", "string", "currency", { kind: "currency" }),
    col("billingAddress", "string", "billingAddress", { kind: "address" }),
    col("isDefault", "boolean", "isDefault", {
      kind: "formula",
      compute: ({ index }) => index === 0,
    }),
    col("createdAt", "datetime", "createdAt", { kind: "pastDate", years: 3 }),
  ],
});

export const invoices: DataTablePreset = definePreset({
  id: "invoices",
  name: "Invoices",
  descriptionKey: "presetMeta.invoices",
  category: "finance",
  icon: "Receipt",
  defaultSampleCount: 12,
  columns: [
    idCol({ kind: "sequence", prefix: "INV-2026-", pad: 4 }),
    col(
      "customer",
      "string",
      "customer",
      { kind: "company" },
      { required: true },
    ),
    col("contactEmail", "email", "email", { kind: "email", unique: true }),
    col("items", "array", "invoiceItems", {
      kind: "array",
      min: 1,
      max: 4,
      item: [
        { key: "description", rule: { kind: "productName" } },
        { key: "quantity", rule: { kind: "int", min: 1, max: 12 } },
        { key: "unitPrice", rule: { kind: "price", min: 20, max: 900 } },
        {
          key: "amount",
          rule: {
            kind: "formula",
            compute: ({ row }) =>
              round2(Number(row.quantity) * Number(row.unitPrice)),
          },
        },
      ],
    }),
    col("subtotal", "number", "subtotal", {
      kind: "formula",
      compute: ({ row }) =>
        round2(
          ((row.items as { amount: number }[]) ?? []).reduce(
            (sum, item) => sum + item.amount,
            0,
          ),
        ),
    }),
    col("taxRate", "number", "taxRate", { kind: "constant", value: 0.1 }),
    col("tax", "number", "tax", {
      kind: "formula",
      compute: ({ row }) => round2(Number(row.subtotal) * Number(row.taxRate)),
    }),
    col("total", "number", "total", {
      kind: "formula",
      compute: ({ row }) => round2(Number(row.subtotal) + Number(row.tax)),
    }),
    col("currency", "string", "currency", { kind: "currency" }),
    col("status", "string", "status", {
      kind: "weighted",
      options: [
        { value: "paid", weight: 5 },
        { value: "sent", weight: 3 },
        { value: "overdue", weight: 1 },
        { value: "draft", weight: 1 },
      ],
    }),
    col("issuedAt", "date", "issuedAt", {
      kind: "pastDate",
      days: 120,
      withTime: false,
    }),
    col("dueDate", "date", "dueDate", {
      kind: "formula",
      compute: ({ row, mock }) => {
        const issued = Date.parse(String(row.issuedAt ?? ""));
        return mock.date.iso(
          new Date(
            (Number.isNaN(issued) ? Date.now() : issued) +
              30 * 24 * 3600 * 1000,
          ),
          false,
        );
      },
    }),
    // 결제된 청구서만 결제일
    col("paidAt", "datetime", "paidAt", {
      kind: "formula",
      compute: ({ row, mock }) =>
        row.status === "paid"
          ? mock.date.iso(mock.date.past({ days: 60 }))
          : null,
    }),
  ],
});

export const images: DataTablePreset = definePreset({
  id: "images",
  name: "Images",
  descriptionKey: "presetMeta.images",
  category: "media",
  icon: "Image",
  defaultSampleCount: 12,
  columns: [
    idCol(),
    // picsum 사진 id 0~1084 — /id/{id}/{w}/{h} 는 seed 없이도 항상 같은 사진
    col("picsumId", "number", "picsumId", { kind: "int", min: 0, max: 1084 }),
    col("author", "string", "author", { kind: "fullName" }),
    col("title", "string", "title", { kind: "title", words: 3 }),
    col("width", "number", "width", {
      kind: "weighted",
      options: [1920, 2560, 3000, 4000].map((value) => ({ value, weight: 1 })),
    }),
    col("height", "number", "height", {
      kind: "weighted",
      options: [1080, 1440, 2000, 2667].map((value) => ({ value, weight: 1 })),
    }),
    col("url", "image", "url", {
      kind: "formula",
      compute: ({ row, mock }) =>
        mock.image.picsum({
          id: Number(row.picsumId),
          width: Number(row.width),
          height: Number(row.height),
        }),
    }),
    col("thumbnail", "image", "thumbnail", {
      kind: "formula",
      compute: ({ row, mock }) =>
        mock.image.picsum({
          id: Number(row.picsumId),
          width: 300,
          height: 200,
        }),
    }),
    col("grayscale", "boolean", "grayscale", {
      kind: "boolean",
      trueRatio: 0.25,
    }),
    col("blur", "number", "blur", {
      kind: "weighted",
      options: [
        { value: 0, weight: 6 },
        { value: 2, weight: 2 },
        { value: 5, weight: 1 },
        { value: 10, weight: 1 },
      ],
    }),
    col("previewUrl", "image", "previewUrl", {
      kind: "formula",
      compute: ({ row, mock }) =>
        mock.image.picsum({
          id: Number(row.picsumId),
          width: 600,
          height: 400,
          grayscale: Boolean(row.grayscale),
          blur: Number(row.blur) > 0 ? Number(row.blur) : undefined,
        }),
    }),
    col("dominantColor", "string", "color", { kind: "colorHex" }),
    col("tags", "array", "tags", {
      kind: "list",
      pool: "words",
      min: 1,
      max: 3,
    }),
    col("uploadedAt", "datetime", "uploadedAt", { kind: "pastDate", years: 1 }),
  ],
});

export const FINANCE_PRESETS = { transactions, paymentCards, invoices };
export const MEDIA_PRESETS = { images };
