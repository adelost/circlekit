import {
  demandPort,
  derive,
  service,
  field,
  finiteValueRef,
  port,
  valueRef,
} from "@v1d/product-spec";
import { homeGuidancePresentationContract, serviceDemandContract } from "./location.js";
import { mapBaseStateContract } from "./settings.js";

/** Exact public fields of mapkit's SkyvwMapScene. Complex native values use stable semantic refs. */
export const mapSceneContract = {
  id: "map.scene",
  kind: "snapshot",
  boundary: "presentation",
  fields: [
    field("enabledLayers", valueRef("map.layer-set")),
    field("tileSet", valueRef("map.tile-set"), { nullable: true }),
    field("rasterReady", "boolean"),
    field("vectorShapes", valueRef("map.shape-list")),
    field("midVectorShapes", valueRef("map.shape-list")),
    field("placeLabels", valueRef("map.place-label-list")),
    field("landingTargets", valueRef("map.landing-target-list")),
    field("traffic", valueRef("map.aircraft-track-list")),
    field("aviationWeather", valueRef("map.aviation-weather-list")),
    field("cloudContours", valueRef("map.cloud-contour-list")),
    field("flightRings", valueRef("map.flight-ring-list")),
    field("anchorLat", "number", { unit: "geo.degree" }),
    field("anchorLon", "number", { unit: "geo.degree" }),
    field("cacheRadiusM", "integer", { unit: "si.meter" }),
    field("paletteId", "string"),
  ],
} as const;

export const mapCapabilitiesContract = {
  id: "map.capabilities",
  kind: "snapshot",
  boundary: "presentation",
  fields: [field("layers", valueRef("map.layer-set"))],
} as const;

/** Weather layers that are owned by the map runtime but rendered by spatial tools. */
export const mapSpatialWeatherContract = {
  id: "map.spatial-weather",
  kind: "snapshot",
  boundary: "presentation",
  fields: [
    field("cloudFrame", valueRef("weather.cloud-overlay"), { nullable: true }),
    field("stations", valueRef("weather.aviation-station-list")),
  ],
} as const;

/** Exact pull-based cache aggregate exposed by MapCoordinator. */
export const mapCacheStatsContract = {
  id: "map.cache-stats",
  kind: "snapshot",
  boundary: "presentation",
  fields: [
    field("tileCount", "integer"),
    field("tileBytes", "integer", { unit: "si.byte" }),
    field("vectorCount", "integer"),
    field("vectorBytes", "integer", { unit: "si.byte" }),
    field("terrainBytes", "integer", { unit: "si.byte" }),
    field("overviewBytes", "integer", { unit: "si.byte" }),
    field("midBytes", "integer", { unit: "si.byte" }),
    field("detailBytes", "integer", { unit: "si.byte" }),
  ],
} as const;

export const mapCacheCoverageContract = {
  id: "map.cache-coverage",
  kind: "snapshot",
  boundary: "presentation",
  fields: [field("coverage", valueRef("map.cache-coverage-grid"), { nullable: true })],
} as const;

export const cloudOverlayPresentationContract = {
  id: "map.cloud-overlay-presentation",
  kind: "snapshot",
  boundary: "presentation",
  fields: [field("frame", valueRef("weather.cloud-overlay"), { nullable: true })],
} as const;

/** Exact map-runtime frame consumed by the visited-places surface. */
export const jumpPlacesSceneContract = {
  id: "map.jump-places-scene",
  kind: "snapshot",
  boundary: "presentation",
  fields: [
    field("land", valueRef("map.world-land"), { nullable: true }),
    field("baseRelief", valueRef("map.world-relief-grid"), { nullable: true }),
    field("detailRelief", valueRef("map.world-relief-grid"), { nullable: true }),
    field("detailLoading", "boolean"),
  ],
} as const;

/** Existing sealed PipelineState value; its closed variants remain native. */
export const mapPipelineStateContract = {
  id: "map.pipeline-state",
  kind: "state",
  boundary: "presentation",
  fields: [field("value", valueRef("map.pipeline-state.variant"))],
} as const;

export const replayGroundSceneContract = {
  id: "replay.ground-scene",
  kind: "snapshot",
  boundary: "presentation",
  fields: [
    field("context", valueRef("replay.ground-context")),
    field("initialVisualMode", valueRef("replay.ground-visual-mode")),
  ],
} as const;

export const replayGroundSceneActionContract = {
  id: "replay.ground-scene-action",
  kind: "event",
  boundary: "ui-event",
  fields: [field("event", valueRef("replay.ground-scene-event"))],
} as const;

/** Closed renderer interaction. Present/spec is owned by the projection runtime. */
export const replayGroundInteractionContract = {
  id: "replay.ground-interaction",
  kind: "event",
  boundary: "ui-event",
  fields: [field("event", valueRef("replay.ground-interaction-event"))],
} as const;

/** Local ATMOS selection and measured viewport scale, never an IO request/spec. */
export const atmosGroundViewportContract = {
  id: "ui.atmos-ground-viewport",
  kind: "event",
  boundary: "ui-event",
  fields: [
    field("location", valueRef("ui.atmos-location"), { nullable: true }),
    field("radiusM", "integer", { unit: "si.meter" }),
    field("mapPxPerM", "number"),
    field("isoPxPerM", "number", { nullable: true }),
  ],
} as const;

export const mapRenderScaleContract = {
  id: "map.render-scale-event",
  kind: "event",
  boundary: "ui-event",
  fields: [field("event", valueRef("map.render-scale"))],
} as const;

/** One portable product answer to map.base, shared by live and replay maps. */
export const mapProductSelectionContract = {
  id: "map.product-selection",
  kind: "state",
  boundary: "service-internal",
  fields: [
    field("baseId", valueRef("map.base")),
    field("providerId", "string", { nullable: true }),
    field("product", valueRef("map.product-snapshot")),
  ],
} as const;

/** Pure map.base -> declared product selection; no renderer may rebuild it. */
export const mapSelection = derive({
  id: "map.selection",
  inputs: [port("mapBase", mapBaseStateContract)],
  outputs: [port("snapshot", mapProductSelectionContract)],
  runtime: {
    stateOwner: "instance",
    lifetime: "process",
    durability: "transient",
    clockDomain: "none",
    contextInputs: [],
    effects: [],
  },
});

/** Coarse owner matching the real MapRuntime -> Coordinator -> sources construction chain. */
export const mapRuntimeOwner = service({
  id: "map.runtime-owner",
  inputs: [
    demandPort("demand", serviceDemandContract),
    port("guidance", homeGuidancePresentationContract),
    port("selection", mapProductSelectionContract),
    port("renderScale", mapRenderScaleContract),
  ],
  outputs: [
    port("scene", mapSceneContract),
    port("capabilities", mapCapabilitiesContract),
    port("spatialWeather", mapSpatialWeatherContract),
    port("tilePipeline", mapPipelineStateContract),
    port("vectorPipeline", mapPipelineStateContract),
    port("cacheStats", mapCacheStatsContract),
    port("cacheCoverage", mapCacheCoverageContract),
    port("jumpPlaces", jumpPlacesSceneContract),
    port("cloudOverlay", cloudOverlayPresentationContract),
  ],
  runtime: {
    stateOwner: "instance",
    lifetime: "process",
    durability: "transient",
    clockDomain: "wall",
    contextInputs: [
      "device.storage",
      "network.connectivity",
      "app.lifecycle",
      "map.fetch-permission",
      "runtime.coroutine-scope",
    ],
    effects: ["network.map-data", "storage.map-cache"],
  },
});

/**
 * Coarse native owner by design. SVW-0099 debt: the closed value vocabulary
 * cannot yet name ReplayGroundRequest + ReplayGroundInputs + previous
 * ReplayGroundContext -> context-update callback without free valueRefs.
 * AndroidReplayGroundSources therefore remains an internal implementation and
 * this Lego exposes no fabricated interface-handle or pass-through edge.
 */
export const replayGroundOperation = service({
  id: "map.replay-ground-operation",
  inputs: [
    port("selection", mapProductSelectionContract),
    port("action", replayGroundInteractionContract),
  ],
  outputs: [port("scene", replayGroundSceneContract)],
  runtime: {
    stateOwner: "external",
    lifetime: "operation",
    durability: "transient",
    clockDomain: "none",
    contextInputs: [
      "replay.ground-request",
      "device.storage",
      "network.connectivity",
      "service.telemetry",
    ],
    effects: ["network.replay-ground-data", "storage.map-cache", "replay.ground-context-update"],
  },
});
