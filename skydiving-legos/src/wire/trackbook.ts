/**
 * The trackbook HTTP bodies a skydiving watch sends and reads, declared once: the trackbook server reads them with
 * `readContractPayload`, and the app's Kotlin comes from `emitWireContractsKotlin`.
 *
 * Every body ignores an unknown key and a read leaves it out of the checked copy. A receipt does so the server can
 * add fields before released watches know them. A request does so a newer watch can add an optional field before
 * trackbook knows it, because watches auto-update from a release while trackbook deploys by hand. Only code
 * generated from these contracts writes the two requests, so an unknown key there is a newer field, never a misspelt
 * one. Only field laws live here. The rules that are not (which scopes a pairing may ask for, the shape of an
 * operation id, label trimming, time normalisation, the echo check) stay with their owners; the package README
 * lists them.
 */
import { contractRef, field, finiteValueRef, finiteValues, listOf, validateContract } from "@v1d/product-spec";

export const trackbookDevicePlatforms = finiteValues("trackbook.device-platform", ["wear-os", "apple-watch", "garmin"]);
export const trackbookDeviceScopes = finiteValues("trackbook.device-scope", ["jumps:read", "jumps:write"]);
export const trackbookLiveGrantScopes = finiteValues("trackbook.live-grant-scope", ["jumps:write"]);
export const trackbookLiveSharingOn = finiteValues("trackbook.live-sharing-on", ["ON"]);
export const trackbookLiveSharingOff = finiteValues("trackbook.live-sharing-off", ["OFF"]);

const deviceScopes = listOf(finiteValueRef("trackbook.device-scope"), { distinct: true });

/**
 * POST /api/devices/pair/start. Releases v0.5.330 to v0.5.1580 send no operationId or pollSecret, and only a
 * read-access pairing sends scopes, so those three keys may be absent; the server reads an absent key as null.
 */
export const pairingStartRequestContract = {
  id: "trackbook.pairing-start-request", kind: "event", boundary: "wire", unknownFields: "ignore",
  fields: [
    field("platform", finiteValueRef("trackbook.device-platform")),
    field("label", "string"),
    field("operationId", "string", { optional: true }),
    field("pollSecret", "string", { optional: true }),
    field("scopes", deviceScopes, { optional: true }),
  ],
} as const;

/** The pairing start receipt, since trackbook 5e14264. */
export const pairingStartReceiptContract = {
  id: "trackbook.pairing-start-receipt", kind: "snapshot", boundary: "wire", unknownFields: "ignore",
  fields: [
    field("id", "string"),
    field("pollSecret", "string"),
    field("code", "string"),
    field("expiresAt", "string"),
    field("requestedScopes", deviceScopes),
  ],
} as const;

const livePositionFields = [
  field("sequence", "integer", { min: 0 }),
  field("sampleTime", "string"),
  field("latitude", "number", { min: -90, max: 90 }),
  field("longitude", "number", { min: -180, max: 180 }),
  field("altitudeM", "number", { nullable: true, min: -20_000, max: 100_000 }),
  field("accuracyM", "number", { nullable: true, min: 0 }),
  field("phase", "string", { nullable: true }),
] as const;

/** PUT /api/mobile/live/position: one point of this jumper's live lane. Every key is sent, unknown as null. */
export const livePositionContract = {
  id: "trackbook.live-position", kind: "observation", boundary: "wire", unknownFields: "ignore",
  fields: livePositionFields,
} as const;

/** The point as a receipt echoes it: the same fields, read by the watch, so the server may add one. */
export const livePositionEchoContract = {
  id: "trackbook.live-position-echo", kind: "snapshot", boundary: "wire", unknownFields: "ignore",
  fields: livePositionFields,
} as const;

export const liveGrantContract = {
  id: "trackbook.live-grant", kind: "snapshot", boundary: "wire", unknownFields: "ignore",
  fields: [field("deviceId", "string"), field("scope", finiteValueRef("trackbook.live-grant-scope"))],
} as const;

/** The PUT receipt; `accepted` is false when the same point was sent again. */
export const livePositionReceiptContract = {
  id: "trackbook.live-position-receipt", kind: "snapshot", boundary: "wire", unknownFields: "ignore",
  fields: [
    field("schemaVersion", "integer", { min: 1, max: 1 }),
    field("accountKey", "string"),
    field("accepted", "boolean"),
    field("sharing", finiteValueRef("trackbook.live-sharing-on")),
    field("position", contractRef(livePositionEchoContract)),
    field("grant", contractRef(liveGrantContract)),
  ],
} as const;

/** The DELETE receipt. The request has no body: its fence is the query `?sequence=`. */
export const liveStopReceiptContract = {
  id: "trackbook.live-stop-receipt", kind: "snapshot", boundary: "wire", unknownFields: "ignore",
  fields: [
    field("schemaVersion", "integer", { min: 1, max: 1 }),
    field("accountKey", "string"),
    field("sharing", finiteValueRef("trackbook.live-sharing-off")),
  ],
} as const;

/** Every trackbook body a watch exchanges; nested contracts come with their holders. */
export const trackbookWireContracts = [
  pairingStartRequestContract, pairingStartReceiptContract,
  livePositionContract, livePositionReceiptContract, liveStopReceiptContract,
] as const;

/** The finite declarations those contracts name: pass them to every read and to the emitter. */
export const trackbookWireValues = [
  trackbookDevicePlatforms, trackbookDeviceScopes, trackbookLiveGrantScopes,
  trackbookLiveSharingOn, trackbookLiveSharingOff,
] as const;

// Refused at declaration: importing this module checks every contract's laws, nested ones included.
trackbookWireContracts.forEach(validateContract);
