# Trackbook wire fixtures: pairing start and live position

Every `request/*.json` must be accepted by `src/wire/trackbook.ts`; every `response/*.json` must parse.
`test/wire.test.ts` reads all of them. Ids, secrets, codes, account keys and coordinates are synthetic, in the real
formats. Requests are byte-identical to what each Skyvw release sends (its Kotlin compiled and run against a stub);
responses are the output of the real trackbook d3cbc1a route handlers on these requests, clock fixed at
2026-10-01T10:00:00Z (checked for the C1 plan, 2026-10-01).

## pair-start (POST /api/devices/pair/start)

- `request/v0.5.330.json`: v0.5.330 to v0.5.334, the first pairing client, label "Skydive Altimeter".
- `request/v0.5.337.json`: write-only pairing, v0.5.337 to v0.5.1580, label "Skyvw Altimeter".
- `request/v0.5.1194-read.json`: read-access pairing, v0.5.1194 to v0.5.1580.
- `request/v0.5.1581.json`: write-only pairing, v0.5.1581 to v0.5.1590 and main. No `scopes` key: the client adds
  it only for read access.
- `request/v0.5.1581-read.json`: read-access pairing, v0.5.1581 to v0.5.1590 and main.
- `response/trackbook-5e14264.json`, `-read.json`: request without operationId, so the server makes a `pair_` id.
  Produced since 5e14264 (2026-09-11).
- `response/trackbook-19a716c.json`, `-read.json`: request with operationId; `id` and `pollSecret` echo the
  `v0.5.1581` requests. Since 19a716c (2026-09-24).

## live-position (/api/mobile/live/position)

Requests from v0.5.1245 to v0.5.1590 and main; responses from trackbook e8a1a2f to d3cbc1a.

- `request/v0.5.1245.json`: PUT body, a typical fix. `phase` is null in every release.
- `request/v0.5.1245-whole-second.json`: a fix on a whole second, sent as `...:10Z` with no fraction.
- `request/v0.5.1245-no-altitude.json`: altitude and accuracy unknown, sent as explicit nulls.
- `response/trackbook-e8a1a2f.json`: accepted PUT receipt; `-replay.json` the same point again, `accepted:false`.
- `response/trackbook-e8a1a2f-whole-second.json`: the server echoes `sampleTime` as `...:10.000Z`. Releases
  v0.5.1245 to v0.5.1590 refuse this receipt by string equality although the point was stored; the contract
  parses it, and the echo check compares instants.
- `response/trackbook-e8a1a2f-no-altitude.json`: nulls echoed.
- `response/trackbook-e8a1a2f-stop.json`: DELETE receipt. The DELETE itself has no body; its fence is the query
  `sequence=`.
