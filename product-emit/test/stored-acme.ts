import { storedChoice, storedFlag, storedInt, storedLong, storedNumber, storedText } from "@v1d/product-spec";

const store = "acme-settings";

/** One stored value per kind, an optional long and an optional number, and bounds on two sides, one side and none. */
export const acmeStoredValues = [
  storedFlag({ id: "acme.sound", wireName: "soundOn", store, property: "soundEnabled", defaultValue: true }),
  storedInt({ id: "acme.cache-radius", wireName: "cacheRadiusM", store, unit: "m", min: 500, max: 30_000, step: 10_000,
    defaultValue: 20_000 }),
  storedLong({ id: "acme.scatter", wireName: "scatterM", store, unit: "m", min: 0, defaultValue: 250 }),
  storedLong({ id: "acme.picked-day", wireName: "pickedEpochDay", store, min: 0, optional: true }),
  storedNumber({ id: "acme.altitude-step", wireName: "altitudeStepM", store, unit: "m", min: 0.1, max: 1.0, step: 0.1,
    defaultValue: 0.5 }),
  storedNumber({ id: "acme.noise", wireName: "noiseP95M", store, unit: "m", min: 0, optional: true }),
  storedNumber({ id: "acme.glide", wireName: "glideRatio", store, max: 20, defaultValue: 2.5 }),
  storedNumber({ id: "acme.drop-altitude", wireName: "dropAltitudeM", store, unit: "m", defaultValue: 4_000 }),
  storedChoice({ id: "acme.icon-style", wireName: "iconStyle", store, values: ["FILLED", "OUTLINE"], defaultValue: "FILLED" }),
  storedText({ id: "acme.vector-source", wireName: "vectorSourceId", store, defaultValue: "tiles-main" }),
] as const;

const emission = { packageName: "dev.acme.stored", symbolPrefix: "Acme", sourceFile: "test/stored-acme.ts", sourceSha: "fixture" };

export const acmeRecordOptions = {
  ...emission, recordName: "Settings", keyValueStore: "dev.acme.store.KeyValueStore",
  nativeTypes: { "acme.icon-style": "dev.acme.ui.IconStyle" }, nativeTypesFile: "test/stored-acme.ts",
} as const;

export const acmeDescriptorOptions = {
  ...emission,
  symbols: {
    storedValue: "dev.acme.store.StoredValue", flag: "dev.acme.store.FlagValue", int: "dev.acme.store.IntValue",
    long: "dev.acme.store.LongValue", number: "dev.acme.store.NumberValue", choice: "dev.acme.store.ChoiceValue",
    text: "dev.acme.store.TextValue", store: "dev.acme.store.AcmeStore",
  },
} as const;
