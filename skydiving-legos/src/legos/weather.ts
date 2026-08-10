import {
  configField,
  configInput,
  contextPort,
  demandPort,
  service,
  field,
  finiteValueRef,
  port,
  valueRef,
} from "@v1d/product-spec";
import { positionHomePointContract, positionWeatherReadinessContract } from "./location.js";
import { wallClockPresentationContract } from "./clock.js";

export const weatherDemandContract = {
  id: "weather.demand",
  kind: "event",
  boundary: "service-internal",
  fields: [field("active", "boolean")],
} as const;

export const weatherPriorityContextContract = {
  id: "weather.priority-context",
  kind: "state",
  boundary: "service-internal",
  fields: [field("priority", finiteValueRef("weather.priority"))],
} as const;

/**
 * One current-weather truth. Its complete snapshot is independent of the
 * latest operation, so failed refresh + stale data is one legal case.
 */
export const weatherServiceStateContract = {
  id: "weather.state",
  kind: "state",
  boundary: "presentation",
  fields: [
    field("presentationCase", finiteValueRef("weather.presentation-case")),
    field("snapshot", valueRef("weather.current-snapshot"), { nullable: true }),
  ],
} as const;

export const weatherSelectedTimeQueryContract = {
  id: "weather.selected-time-query",
  kind: "event",
  boundary: "ui-event",
  fields: [
    field("latitude", "number", { unit: "geo.degree" }),
    field("longitude", "number", { unit: "geo.degree" }),
    field("selectedTime", "string", { unit: "iso-8601.local-date-time" }),
  ],
} as const;

export const weatherSelectedTimeResultContract = {
  id: "weather.selected-time-result",
  kind: "state",
  boundary: "presentation",
  fields: [
    field("status", finiteValueRef("weather.selected-time-state")),
    field("snapshot", valueRef("weather.selected-time-snapshot"), { nullable: true }),
    // The only dynamic failure detail allowed across the presentation boundary.
    field("httpCode", "integer", { nullable: true }),
  ],
} as const;

export const weatherManualInputContract = {
  id: "weather.manual-input-presentation",
  kind: "state",
  boundary: "presentation",
  fields: [field("input", valueRef("weather.manual-input"))],
} as const;

export const weatherDevWindPresentationContract = {
  id: "weather.dev-wind-presentation",
  kind: "state",
  boundary: "presentation",
  fields: [field("value", valueRef("weather.dev-wind-rung"))],
} as const;

/**
 * The product sees one weather service. Repository, scheduling and cache
 * mechanics are native implementation details of this single lifecycle.
 */
export const weatherService = service({
  id: "weather.service",
  inputs: [
    demandPort("demand", weatherDemandContract),
    contextPort("priorityContext", weatherPriorityContextContract),
    port("selectedTimeQuery", weatherSelectedTimeQueryContract),
    port("point", positionHomePointContract),
    contextPort("readiness", positionWeatherReadinessContract),
    port("clock", wallClockPresentationContract),
  ],
  outputs: [
    port("state", weatherServiceStateContract),
    port("selectedTime", weatherSelectedTimeResultContract),
    port("manualInput", weatherManualInputContract),
    port("devWind", weatherDevWindPresentationContract),
  ],
  configInputs: [
    configInput("fetchPolicy", [
      configField("staleAgeMs", "integer", { unit: "si.millisecond", positive: true }),
      configField("recacheThresholdM", "number", { unit: "si.meter", positive: true }),
    ]),
    configInput("provider"),
  ],
  runtime: {
    stateOwner: "instance",
    lifetime: "process",
    durability: "durable",
    clockDomain: "wall",
    contextInputs: ["network.open-meteo", "storage.weather-cache", "runtime.coroutine-scope"],
    effects: ["network.weather-request", "storage.weather-cache-read", "storage.weather-cache-write"],
  },
});
