import {
  configField,
  configInput,
  contextPort,
  demandPort,
  derive,
  field,
  finiteValueRef,
  port,
  service,
  valueRef,
} from "@v1d/product-spec";

export const positionObservationContract = {
  id: "position.observation",
  kind: "observation",
  boundary: "service-internal",
  fields: [
    field("timeEpochMs", "integer", { unit: "si.millisecond", clockDomain: "wall" }),
    field("elapsedRealtimeNanos", "integer", { unit: "si.nanosecond", clockDomain: "monotonic" }),
    field("latitude", "number", { unit: "geo.degree" }),
    field("longitude", "number", { unit: "geo.degree" }),
    field("altitudeMslM", "number", { unit: "si.meter", nullable: true }),
    field("accuracyM", "number", { unit: "si.meter", nullable: true }),
    field("verticalAccuracyM", "number", { unit: "si.meter", nullable: true }),
    field("bearingDeg", "number", { unit: "geo.degree", nullable: true }),
    field("speedMs", "number", { unit: "si.meter-per-second", nullable: true }),
    field("provider", "string"),
  ],
} as const;

export const positionPresentationContract = {
  id: "position.presentation",
  kind: "state",
  boundary: "presentation",
  fields: [
    field("availability", finiteValueRef("position.availability")),
    field("observation", valueRef(positionObservationContract.id), { nullable: true }),
  ],
} as const;

export const positionWeatherReadinessContract = {
  id: "position.weather-fetch-readiness",
  kind: "state",
  boundary: "service-internal",
  fields: [field("status", finiteValueRef("position.weather-readiness"))],
} as const;

export const positionFlightFixContract = {
  id: "position.flight-fix",
  kind: "observation",
  boundary: "service-internal",
  fields: [
    field("observation", valueRef(positionObservationContract.id)),
    field("breakBefore", "boolean"),
    field("gpsStatus", "string"),
  ],
} as const;

/** Strict accepted fix joined with the durable HOME needed by flight policy. */
export const flightLocationStateContract = {
  id: "position.flight-location-state",
  kind: "state",
  boundary: "service-internal",
  fields: [
    field("fix", valueRef(positionFlightFixContract.id), { nullable: true }),
    field("homeLatitude", "number", { unit: "geo.degree", nullable: true }),
    field("homeLongitude", "number", { unit: "geo.degree", nullable: true }),
    field("distanceFromHomeM", "number", { unit: "si.meter" }),
    field("bearingToHomeDeg", "number", { unit: "geo.degree" }),
  ],
} as const;

/** HOME is durable user-owned state, independent of the physical subscription. */
export const positionHomePointContract = {
  id: "home.reference-point",
  kind: "state",
  boundary: "presentation",
  fields: [
    field("latitude", "number", { unit: "geo.degree", nullable: true }),
    field("longitude", "number", { unit: "geo.degree", nullable: true }),
    field("altitudeMslM", "number", { unit: "si.meter", nullable: true }),
  ],
} as const;

/** The dial asks the HOME owner to latch the currently accepted position. */
export const homeSetCurrentRequestContract = {
  id: "home.set-current-request",
  kind: "event",
  boundary: "ui-event",
  fields: [],
} as const;

/** The map asks the HOME owner to resolve and persist its current crosshair. */
export const homeSetMapCenterRequestContract = {
  id: "home.set-map-center-request",
  kind: "event",
  boundary: "ui-event",
  fields: [
    field("eastM", "number", { unit: "si.meter" }),
    field("northM", "number", { unit: "si.meter" }),
  ],
} as const;

export const homeGuidancePresentationContract = {
  id: "home.guidance-presentation",
  kind: "snapshot",
  boundary: "presentation",
  fields: [
    field("position", valueRef(positionPresentationContract.id)),
    field("homeLatitude", "number", { unit: "geo.degree", nullable: true }),
    field("homeLongitude", "number", { unit: "geo.degree", nullable: true }),
    field("homeAltitudeM", "number", { unit: "si.meter", nullable: true }),
    field("distanceToHomeM", "number", { unit: "si.meter", nullable: true }),
    field("bearingToHomeDeg", "number", { unit: "geo.degree", nullable: true }),
  ],
} as const;

export const serviceDemandContract = {
  id: "service.demand",
  kind: "event",
  boundary: "service-internal",
  fields: [
    field("owner", "string"),
    field("active", "boolean"),
  ],
} as const;

/** One native service owns subscription, normalization, policy views and demand. */
export const positionService = service({
  id: "position.service",
  inputs: [demandPort("demand", serviceDemandContract)],
  outputs: [
    port("presentation", positionPresentationContract),
    port("flightFix", positionFlightFixContract),
  ],
  configInputs: [
    configInput("acquisition", [
      configField("highIntervalMs", "integer", { unit: "si.millisecond", positive: true }),
      configField("balancedIntervalMs", "integer", { unit: "si.millisecond", positive: true }),
    ]),
    configInput("presentationPolicy", [
      configField("maxAccuracyM", "number", { unit: "si.meter", positive: true }),
      configField("staleFixAgeMs", "integer", { unit: "si.millisecond", positive: true }),
      configField("coarseAccuracyM", "number", { unit: "si.meter", positive: true }),
      configField("displayStaleAgeMs", "integer", { unit: "si.millisecond", positive: true }),
    ]),
    configInput("flightPolicy"),
  ],
  runtime: {
    stateOwner: "instance",
    lifetime: "process",
    durability: "transient",
    clockDomain: "monotonic",
    contextInputs: ["device.location", "permission.location", "clock.monotonic", "recording.policy"],
    effects: ["location.subscription"],
  },
});

/**
 * HOME is durable user-owned state, not another view of the physical GPS
 * subscription. Its native runtime owns restore, mutation and persistence.
 */
export const homeReference = service({
  id: "home.reference",
  inputs: [
    port("position", positionPresentationContract),
    port("setCurrentFromDial", homeSetCurrentRequestContract),
    port("setCurrentFromCapacity", homeSetCurrentRequestContract),
    port("setMapCenter", homeSetMapCenterRequestContract),
  ],
  outputs: [port("point", positionHomePointContract)],
  runtime: {
    stateOwner: "instance",
    lifetime: "process",
    durability: "durable",
    clockDomain: "wall",
    contextInputs: ["storage.home-reference", "position.accepted-fix", "map.camera"],
    effects: ["storage.home-reference-write"],
  },
});

/** Pure derivation joining the service presentation and its one HOME reference. */
export const homeGuidance = derive({
  id: "home.guidance",
  inputs: [
    port("position", positionPresentationContract),
    port("home", positionHomePointContract),
  ],
  outputs: [port("presentation", homeGuidancePresentationContract)],
  runtime: {
    stateOwner: "instance",
    lifetime: "process",
    durability: "transient",
    clockDomain: "monotonic",
    contextInputs: [],
    effects: [],
  },
});

/** Weather depends only on durable HOME; GPS permission is an independent safety/presentation state. */
export const positionWeatherReadiness = derive({
  id: "position.weather-readiness",
  inputs: [port("home", positionHomePointContract)],
  outputs: [contextPort("state", positionWeatherReadinessContract)],
  runtime: {
    stateOwner: "instance",
    lifetime: "process",
    durability: "transient",
    clockDomain: "monotonic",
    contextInputs: [],
    effects: [],
  },
});

/** Safety-only HOME-relative flight context; recording keeps the raw fix. */
export const flightLocationContext = derive({
  id: "position.flight-context",
  inputs: [
    port("fix", positionFlightFixContract),
    port("home", positionHomePointContract),
  ],
  outputs: [port("state", flightLocationStateContract)],
  runtime: {
    stateOwner: "instance",
    lifetime: "process",
    durability: "transient",
    clockDomain: "monotonic",
    contextInputs: [],
    effects: [],
  },
});
