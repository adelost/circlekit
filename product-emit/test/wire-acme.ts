import { contractRef, field, finiteValueRef, finiteValues, listOf } from "@v1d/product-spec";

// A product-neutral wire set with every field kind the Kotlin wire emitter writes: finite values with capitals and
// a colon, a distinct finite list, a string list, nested records and a list of them, optional and nullable keys,
// integer and number bounds, a sibling law, and both unknown-field policies.
export const acmeSizes = finiteValues("shop.size", ["S", "M", "L"]);
export const acmeToppings = finiteValues("shop.topping", ["cheese", "basil", "olive:black"]);

export const acmeAddress = { id: "shop.address", kind: "snapshot", boundary: "wire", fields: [
  field("street", "string"), field("floor", "integer", { nullable: true, min: 0, max: 200 })] } as const;

/** A request the server reads: an unknown key is refused. */
export const acmeOrder = { id: "shop.order", kind: "event", boundary: "wire", fields: [
  field("size", finiteValueRef(acmeSizes.id)),
  field("toppings", listOf(finiteValueRef(acmeToppings.id), { distinct: true })),
  field("notes", listOf("string"), { optional: true }),
  field("deliverTo", contractRef(acmeAddress)),
  field("tipPercent", "number", { nullable: true, min: 0, max: 100 }),
  field("sequence", "integer", { min: 0 }),
  field("express", "boolean"),
  field("coupon", "string", { optional: true }),
] } as const;

export const acmeReceiptLine = { id: "shop.receipt-line", kind: "snapshot", boundary: "wire", unknownFields: "ignore",
  fields: [field("name", "string"), field("cents", "integer", { min: 0 })] } as const;

/** A response clients read: the server may add keys. */
export const acmeReceipt = { id: "shop.receipt", kind: "snapshot", boundary: "wire", unknownFields: "ignore", fields: [
  field("schemaVersion", "integer", { min: 1, max: 1 }),
  field("orderId", "string"),
  field("lines", listOf(contractRef(acmeReceiptLine))),
  field("totalCents", "integer", { min: 0 }),
  field("paidCents", "integer", { gteField: "totalCents" }),
  field("deliverTo", contractRef(acmeAddress), { nullable: true }),
  field("size", finiteValueRef(acmeSizes.id)),
] } as const;

/** A distinct list of numbers, where 0 and -0.0 are one value, as JavaScript reads them. */
export const acmeScale = { id: "shop.scale", kind: "observation", boundary: "wire", fields: [
  field("readings", listOf("number", { distinct: true })), field("tare", "number")] } as const;

/** Fields named like the generated code's own words, which must still read and write their own values. */
export const acmeBlob = { id: "shop.blob", kind: "snapshot", boundary: "wire", fields: [
  field("json", "string"), field("read", "string"), field("place", "string"), field("it", "string", { nullable: true }),
  field("out", "string", { optional: true })] } as const;

export const acmeWireContracts = [acmeOrder, acmeReceipt, acmeScale, acmeBlob] as const;
export const acmeWireValues = [acmeSizes, acmeToppings] as const;
