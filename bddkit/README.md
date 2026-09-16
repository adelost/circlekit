# bddkit

JUnit 4 scenarios with hard time limits and required descriptions, for every
Kotlin consumer of CircleKit. The limit and the assertion requirement live in
the test itself, so a slow or assertion-free test fails where it is written,
not in a gate that may not run.

```kotlin
class FlightLedgerApproveTest {
    @Test
    fun `approve persists the flag and emits once`() = host("approve on a two-era ledger") {
        given("a ledger with records from two app versions") { seededLedger() }
            .whenever("APPROVE is dispatched through the real port runtime") { ledger -> ledger.approve("f1") }
            .then("the flag is persisted and jumpEvents emitted once") { result, ledger ->
                assertTrue(ledger.flag("f1"))
                assertEquals(1, result.emits)
            }
    }
}
```

| Level | Warn | Limit | Use for |
|---|---|---|---|
| `unit` | 50 ms | 100 ms | pure logic, no I/O, no Android |
| `component` | 500 ms | 1 s | one component or composable on the JVM, fakes at its edges |
| `host` | 2 s | 5 s | real runtime code across a service or process boundary, hardware faked |
| `scene` | 60 s | 120 s | a whole page or scene under Robolectric or on an emulator |

- **Descriptions are required.** A blank one fails before the phase runs.
- **Assertions are required.** The scenario body must return a `Then`, and only
  `then` can produce one, so a scenario without an assertion does not compile.
- **Levels are required.** There is no generic `scenario`. Past the limit the
  test fails with `[UNIT] 'name' took 340 ms, limit 100 ms; wrong level?`.
  Between warn and limit it prints a nudge; `slow = true` silences the nudge,
  never the limit.
- **Failures name the phase:** `[then] it is three: expected:<3> but was:<2>`,
  with the original assertion as the cause.
- **Thread:** the body runs on the calling thread, so JUnit rules, Robolectric
  and Compose test hosts keep working. A watchdog interrupts the caller once
  the limit passes, so a hung scenario fails instead of blocking the suite.

Consumers add `testImplementation("io.v1d.circlekit:bddkit:<version>")`.
