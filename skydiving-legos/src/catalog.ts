/**
 * The skydiving catalog: every contract and node type the legos declare, plus
 * the finite spaces they name.
 *
 * The membership is DERIVED from the lego modules, never hand-listed. A written
 * list is a second place to forget a file, and the failure is silent: the lego
 * still compiles, the catalog just stops reserving its ids, and the collision
 * this package exists to cause never happens. Adding a lego to `legoModules` is
 * the only registration step, and omitting one is visible as a missing export
 * rather than a missing reservation.
 *
 * A contract carries `fields`; a node type carries `runtime`. That is the whole
 * partition, and it comes from the shapes ProductSpec already defines, so a new
 * lego kind cannot land in the wrong bucket by being named differently.
 */
import { defineProductLibraryCatalog } from "@v1d/product-spec";
import type { LegoContract, ProductNodeType } from "@v1d/product-spec";

import * as attitude from "./legos/attitude.js";
import * as clock from "./legos/clock.js";
import * as complication from "./legos/complication.js";
import * as flight from "./legos/flight.js";
import * as location from "./legos/location.js";
import * as logbook from "./legos/logbook.js";
import * as mapData from "./legos/map-data.js";
import * as pressure from "./legos/pressure.js";
import * as recording from "./legos/recording.js";
import * as runtimeServices from "./legos/runtime-services.js";
import * as settings from "./legos/settings.js";
import * as simulation from "./legos/simulation.js";
import * as sync from "./legos/sync.js";
import * as weather from "./legos/weather.js";

import { skydivingFiniteValues } from "./finite-values.js";

/** Every lego module. The one list this package asks anyone to maintain. */
const legoModules = [
  attitude, clock, complication, flight, location, logbook, mapData,
  pressure, recording, runtimeServices, settings, simulation, sync, weather,
];

export const SKYDIVING_LEGO_MODULE_COUNT = legoModules.length;

type Declared = { readonly id: string };

/**
 * Dedupe by id, because a lego may re-export a sibling's contract for its own
 * callers (runtime-services re-exports the wall clock). Two references to one
 * declaration are the same declaration; two DIFFERENT declarations sharing an id
 * are a bug this package must not paper over, so that case throws.
 */
function collect<T extends Declared>(pick: (value: Declared) => boolean): readonly T[] {
  const byId = new Map<string, T>();
  for (const module of legoModules) {
    for (const exported of Object.values(module)) {
      if (typeof exported !== "object" || exported === null) continue;
      if (!("id" in exported) || typeof exported.id !== "string") continue;
      if (!pick(exported)) continue;
      const value = exported as T;
      const seen = byId.get(value.id);
      if (seen !== undefined && seen !== value) {
        throw new Error(`skydiving legos declare '${value.id}' twice with different values`);
      }
      byId.set(value.id, value);
    }
  }
  return [...byId.values()];
}

/**
 * Contracts that ship in this package but are NOT reserved by the catalog,
 * because each names a finite space that is declared nowhere — not in Skyvw's
 * appspec, not in ProductSpec, not in any native enum.
 *
 * Skyvw compiles today only because all four have zero consumers outside the
 * legos, so the reference never reaches a validator. A catalog validates its
 * own contracts, so including them here fails outright:
 * `library 'skydiving' contract 'attitude.observation' uses undeclared finite
 * value 'attitude.accuracy'`.
 *
 * The missing spaces are attitude.source, recording.command-kind,
 * recording.source, runtime.battery-provider and runtime.incident-kind. Their
 * members are a domain decision with no ground truth to read off, and guessing
 * enum members is how a wrong answer gets frozen into a published package. The
 * fifth orphan, runtime.fetch-source, IS derivable from Kotlin's FetchSource,
 * so `runtime.fetch-request` stays reserved.
 *
 * Consequence, stated rather than hidden: these four ids are not reserved, so a
 * product may still declare them. `every excluded contract is excluded for a
 * live reason` fails the moment a space becomes declarable, which is the signal
 * to delete the entry and let the contract in.
 */
export const unreservedContractIds = {
  "attitude.observation": "attitude.source",
  "recording.host-command": "recording.command-kind",
  "runtime.battery-observation": "runtime.battery-provider",
  "runtime.incident": "runtime.incident-kind",
} as const satisfies Record<string, string>;

export const skydivingContracts = collect<LegoContract>(
  (value) => "fields" in value && !("runtime" in value)
    && !(value.id in unreservedContractIds),
);
/**
 * A node type follows its contracts out. Dropping a contract while keeping a
 * node that carries it on a port only moves the failure one line down --
 * `node type 'runtime.battery-source' uses undeclared contract
 * 'runtime.battery-observation'` -- so the exclusion is DERIVED from the ports
 * rather than written out a second time. The one list stays the one list.
 */
function carriesUnreservedContract(value: Declared): boolean {
  const ports = [
    ...((value as ProductNodeType).inputs ?? []),
    ...((value as ProductNodeType).outputs ?? []),
  ];
  return ports.some((p) => p.contract?.id in unreservedContractIds);
}

export const skydivingNodeTypes = collect<ProductNodeType>(
  (value) => "runtime" in value && !carriesUnreservedContract(value),
);

/** Node types held back only because a contract they carry is unreserved. */
export const unreservedNodeTypeIds = collect<ProductNodeType>(
  (value) => "runtime" in value && carriesUnreservedContract(value),
).map((node) => node.id);

export const skydivingLegoCatalog = defineProductLibraryCatalog({
  id: "skydiving",
  contracts: skydivingContracts,
  nodeTypes: skydivingNodeTypes,
  finiteValues: skydivingFiniteValues,
});
