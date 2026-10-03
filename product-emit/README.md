# @v1d/product-emit

The consuming product owns the `@v1d/product-spec` version. ProductEmit declares
the peer `>=0.3.92 <0.4.0`, whose floor is the product-spec its own build and tests
run against: devDependencies pin that tarball, and `npm run check:pins` refuses an
installed version outside the peer. Its skydiving-legos 0.1.5 dependency keeps a
private 0.3.52 copy, which is not ProductEmit's public type boundary.

Bump the packages together. product-emit 0.1.59 peers on product-spec 0.3.92,
whose `listOf`, `contractRef` and `optional` its wire emitter writes; 0.1.58 still
loads with 0.3.92. product-emit 0.1.50 to 0.1.57 cannot load with product-spec
0.3.91 or later: `/core` fails with "does not provide an export named
'EFFECT_OUTCOMES'"; product-emit 0.1.39 and 0.1.49 still load with 0.3.91.

Typed, deterministic ProductSpec emitters. Import only the layer a product
uses:

```ts
import { emitThemeKotlin } from "@v1d/product-emit/core";
import { emitSettingsKotlin } from "@v1d/product-emit/skydiving";
```

`core` is product-neutral and cannot depend on `skydiving`. The skydiving
entrypoint owns its closed Phone/Wear settings grammar and requires the product
to supply every native Kotlin symbol explicitly; the package contains no
consumer package names or fallback symbols.

`emitStatePresentationsKotlinFiles` keeps the registry API in `aggregate` and
returns typed declarations, source/presentation payloads, lookup tables and
registry entries through the existing `shards` list. Write every returned
suffix; file boundaries are not API. Complete declarations/entries are packed
below 500 lines without compressing Kotlin. A single oversized declaration or
the public accessor facade fails explicitly instead of emitting a monolith.

`emitDecisionCellsKotlin` and `emitDecisionLookupKotlin` write a product-spec
decision table as Kotlin fragments the product places in its own file: one
constant per cell with its id first, and a lookup that is an exhaustive `when`
per axis in declared order. A branch that one cell covers returns that cell, so
a region over several values is one line. The product names every axis enum and
column argument, and writes record values itself; nothing is guessed.

`emitLanesKotlin` writes a product-spec `defineLanes` declaration as one Android
object. A dedicated lane is a HandlerThread named with the product's prefix and
the lane, a shared lane a single-thread executor on a thread with that name,
and the UI lane the main looper. A process lane is built on first use; an owner
lane is an `open<Lane>()` its owner calls and closes with `close()`. A rider
registers with the handle its lane hands out, and `require()` throws off the
lane only when the product's debug expression is true. `fulfilment()` lists, per
lane, its isolation and ordering, what Android built and how fully.

## Wire contracts in Kotlin

`emitWireContractsKotlin(contracts, finiteValues, options)` writes standalone
wire contracts (product-spec `boundary: "wire"`) as Kotlin over org.json, so an
app reads and writes the HTTP bodies a TypeScript server reads with
`readContractPayload`, from the one declaration. Per contract it writes a data
class with `toJson()`, which writes every key (JSONObject.NULL for a null
nullable key, nothing for a null optional key), and `parse(json)`, which
refuses what the TypeScript read refuses in the order it reads: an unknown key
unless the contract ignores it, then each declared key (missing, mistyped, out
of range, undeclared, repeated in a distinct list), then the sibling laws. The
first fault throws `Generated<Prefix>WireException` with `contractId` (the
contract read) and `field` (the dotted path, such as `lines[1].cents`), as
`ContractPayloadError` does. An absent optional key reads as null. Finite
fields are enums carrying their wire value,
`listOf` is `List<T>` (`Set<T>` when distinct), a nested contract its own data
class, an integer `Long` within ±(2^53−1) and a number a finite `Double`. A field
both optional and nullable is refused, because Kotlin has one null for both.
Every constructor parameter is required, an optional one included: a producer
passes null to leave the key out, so a field added to a contract does not
compile at any producer until it is filled.
`test/wire-contracts-kotlin.test.ts` pins the output for `test/wire-acme.ts`
and runs the TypeScript read on `test/fixtures/wire-acme.json`. With
`V1D_KOTLIN_CLASSPATH` (kotlin-compiler-embeddable and its dependencies) and
`V1D_ORG_JSON` (org.json classpaths separated by `;`) set, it also compiles the
emitted Kotlin and runs every fixture on each org.json, and the decision, the
written value, the contract, the field path and the message must equal the
TypeScript read's; without them that test is skipped by name.

## Actions: one handler per declared action

`emitActionHandlersKotlin(product, options)` turns each declared action of a
compiled product into Kotlin that its native owner implements and its UI calls.
An action is a node input fed by a component event, or a relayed input the
product names in `forwardedInputs` (a node output it handles the same way).
`projectActionModel(product, options)` returns the same model without the text.

- Each node gets one handler interface, `Generated<P><Node>Inputs`, with one
  method per action input, named by the input.
- A node named in `sinks` (one node that many components feed) is grouped by
  the owner that feeds it instead: `Generated<P><Owner>Actions`, methods named
  by the owner's output.
- A group with one method is a `fun interface`, so a one-action handler is one
  line.
- Each component instance with bound outputs gets an events facade,
  `Generated<P><Component>Events`, one method per output. Native code and UI
  emit through it, never through a port token.
- `Generated<P>ActionIndex.handlerByInput` maps each input ref to the
  `Type.method` that handles it; `eventByOutput` maps each output ref to its
  facade method.

A port's Kotlin type is its `types` entry (`{ value, result }` by port ref).
Without one it comes from the contract: no fields is `Unit` in and out; fields
that are all primitive and none optional are the data class
`emitContractTypesKotlin` writes for that contract (`contractTypeName`, result
`Unit`; a property named by a Kotlin keyword is quoted). The product emits
those classes into the same package: `projectActionModel(...).derivedContracts`
lists exactly the contracts to pass. Types are written as given, so pass them
fully qualified unless they share `packageName`.

The `port-runtime` transport binds and emits through a runtime with
`bindInput(port, scope, sink)` and `componentEvent(port, scope).emit(value)`,
one token per port ref in `portsObject` named `kotlinEnumToken(ref)`, and
`scopeType` (default `kotlinx.coroutines.CoroutineScope`). Abridged, with
short names:

```kotlin
/** `jump-details.content` events bound to `ui.surface-interaction`: one method per declared action. */
internal interface GeneratedSkyvwJumpDetailsContentActions {
    fun delete()
    fun retryWeather()
}

internal fun SkyvwProductPortRuntime.bindActions(
    scope: kotlinx.coroutines.CoroutineScope,
    handlers: GeneratedSkyvwJumpDetailsContentActions,
): List<AutoCloseable> = listOf(
    bindInput(GeneratedSkyvwPorts.UI_SURFACE_INTERACTION_FLIGHTDETAILDELETE, scope) { handlers.delete() },
    bindInput(GeneratedSkyvwPorts.UI_SURFACE_INTERACTION_FLIGHTDETAILRETRYWEATHER, scope) { handlers.retryWeather() },
)

internal class GeneratedSkyvwStatusHubContentPortEvents(
    ports: SkyvwProductPortRuntime,
    scope: kotlinx.coroutines.CoroutineScope,
) : GeneratedSkyvwStatusHubContentEvents {
    private val selectAircraftPort = ports.componentEvent(GeneratedSkyvwPorts.STATUS_HUB_CONTENT_SELECTAIRCRAFT, scope)
    override fun selectAircraft(event: SelectHomeAircraft): Boolean = selectAircraftPort.emit(event)
    // one emitter and one override per output
}
```

The owner writes `ports.bindActions(scope, object : GeneratedSkyvwJumpDetailsContentActions { ... })`
where it bound the inputs by hand before, so a missing handler is a compile
error, not a launch failure. The `direct` transport has no runtime: the facade
calls the handler interfaces it is built with, one parameter per target group
named by the group's owner. Complete, for one action:

```kotlin
/** The event inputs of `pressure.service`: one method per declared action. */
fun interface GeneratedBarometerPressureServiceInputs {
    fun reset()
}

/** What `barometer.page` can emit: one method per declared output. */
interface GeneratedBarometerBarometerPageEvents {
    fun reset()
}

class GeneratedBarometerBarometerPageDirectEvents(
    private val pressureService: GeneratedBarometerPressureServiceInputs,
) : GeneratedBarometerBarometerPageEvents {
    override fun reset() = pressureService.reset()
}
```

Refused by name, all problems collected and thrown once:

- a port with neither a `types` entry nor a derivable contract;
- a component event typed apart from the input it feeds;
- a sink that is not a compiled node with inputs;
- a forwarded input that is not an event fed by a node output;
- a method kotlinc refuses: a Kotlin keyword, a member of every object
  (`toString`, `hashCode`, `notify`, `notifyAll`, `wait`) or underscores only;
- two inputs of one group under one method name (one output feeding two
  inputs of a sink);
- two declarations with one Kotlin name (groups, facades and their
  implementations, the index, derived payloads);
- a `types` entry that no action reads;
- a direct handler parameter that is a Kotlin keyword, `event`, or names two
  owners.

The result is `Generated<P>Actions<N>` files packed below 500 lines; write
every one, the boundaries are not API. A group or facade that alone cannot fit
one file is refused: split the node or the component.
`test/action-handlers.test.ts` holds each law on `test/action-acme.ts`. With
`V1D_KOTLIN_CLASSPATH` set it compiles both transports with kotlinc, runs them
to prove each output reaches the handler of the input it feeds, and proves that
an owner leaving out `reset` does not compile (`class 'AcmeCounter' is not
abstract and does not implement abstract member 'reset'`). Without it those two
tests are skipped by name.

## Reading the product as a graph

`core` can draw any compiled product as two Mermaid files, generated from the
same IR Kotlin is generated from:

```ts
import { domainGraphEmitter, validateCapabilities } from "@v1d/product-emit/core";

const diagnostics = validateCapabilities(product, acmeCapabilityTable);
if (diagnostics.length > 0) throw new Error(diagnostics.map(({ message }) => message).join("\n"));

buildOutputManifest(product, [
  productJsonEmitter("generated/acme.product.json"),
  domainGraphEmitter({
    domains: "generated/acme.domains.mmd",
    full: "generated/acme.graph.mmd",
    productJsonPath: "generated/acme.product.json",
  }, acmeCapabilityTable),
], ["generated"]);
```

- `acme.domains.mmd` is the picture to read. Every first id segment of a node
  or component is one box; every port binding that crosses two of them is a
  solid edge labelled with the contract that crosses. A domain nothing binds
  to is drawn dashed red instead of being left out.
- `acme.graph.mmd` is every node, component and decision table (one hexagon
  listing its cell ids) inside its domain, and each declared lane as a subgraph
  with its riders inside, for reading one subgraph at a time.

The `CapabilityTable` is the product's closed host vocabulary: every
`contextInputs` and `effects` string a node type spells must be a row. A row
has a kind; a row may be limited to the artifacts that provide it, so a node
mounted where its need is missing fails compilation
(`capability.not-provided`); and a `STATE_FEEDBACK` row names the domain whose
state is read or written without a port, which is exactly what the dashed
edges draw. That count is the distance between the declared graph and the
running app, and it is meant to fall.

Build and run the bounded contract proof with `npm test`. `npm run
verify:acme` packs the package and compiles a renamed minimal consumer from the
tarball. Publication is local-first from the exact CircleKit source SHA:

```bash
scripts/publish-product-emit.sh 0.1.0 --prepare-only
scripts/publish-product-emit.sh 0.1.0
```
