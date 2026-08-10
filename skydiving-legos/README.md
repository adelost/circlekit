# @v1d/skydiving-legos

The skydiving domain as a ProductSpec library catalog: the contracts, node types
and finite spaces a skydiving product is assembled from.

```ts
import { defineProduct } from "@v1d/product-spec";
import { skydivingLegoCatalog } from "@v1d/skydiving-legos";

export const product = defineProduct(declaration, assets, [skydivingLegoCatalog]);
```

Passing the catalog does two things at once. Everything in it becomes available
to the declaration, and every id in it becomes **reserved**: a product that
re-declares `flight.phase` or `attitude.compass-state` fails to compile even if
its copy is character-for-character identical. That is the point. A domain that
can be quietly forked is a domain that will be, and the second copy drifts.

## What is in it

Fourteen lego modules — attitude, clock, complication, flight, location,
logbook, map-data, pressure, recording, runtime-services, settings, simulation,
sync, weather — plus the finite spaces they name by wire id.

Membership is derived from the modules rather than hand-listed, because a
written list is a second place to forget a file and the failure is silent: the
lego still compiles, the catalog just stops reserving its ids, and the collision
this package exists to cause never happens.

## Four contracts ship unreserved

`attitude.observation`, `recording.host-command`, `runtime.battery-observation`
and `runtime.incident` are exported but not in the catalog, and the two node
types carrying them (`runtime.battery-source`, `runtime.supervisor`) follow them
out.

Each names a finite space — `attitude.source`, `recording.command-kind`,
`recording.source`, `runtime.battery-provider`, `runtime.incident-kind` — that is
declared nowhere: not in Skyvw's appspec, not in ProductSpec, not in any native
enum. Skyvw compiles today only because all four contracts have zero consumers,
so the reference never reaches a validator. A catalog validates its own
contracts, so including them fails outright.

Their members are a domain decision with no ground truth to read off, and
guessing enum members is how a wrong answer gets frozen into a published
package. Declare the spaces and the contracts move in; the test
`every unreserved contract is unreserved for a live reason` fails the moment one
becomes declarable, which is the signal to do exactly that.
