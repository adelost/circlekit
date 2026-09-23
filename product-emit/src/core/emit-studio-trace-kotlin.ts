/** WHAT: Builds a dormant Kotlin trace sink beside generated decisions. WHY: Keeps test evidence out of the release execution path. */
export function emitStudioTraceSinkKotlin(name: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/u.test(name)) throw new Error(`invalid Kotlin trace sink '${name}'`);
  return `/** Optional test-file or debug observer, never an application decision source. */
object ${name} {
    private val output = System.getenv("V1D_STUDIO_TRACE_DIR")?.takeIf { it.isNotBlank() }?.let {
        java.io.File(it, "kotlin-" + java.util.UUID.randomUUID() + ".jsonl")
    }
    @Volatile var observer: ((String) -> Unit)? = null
    val enabled: Boolean get() = output != null || observer != null

    private fun quoted(text: String): String = buildString {
        append('"')
        for (char in text) when (char) {
            '"' -> append("\\\\\\\"")
            '\\\\' -> append("\\\\\\\\")
            '\\n' -> append("\\\\n")
            '\\r' -> append("\\\\r")
            '\\t' -> append("\\\\t")
            else -> if (char.code < 0x20) append("\\\\u" + char.code.toString(16).padStart(4, '0')) else append(char)
        }
        append('"')
    }
    private fun strings(values: Map<String, String>): String = values.entries.joinToString(",", "{", "}") {
        quoted(it.key) + ":" + quoted(it.value)
    }
    private fun booleans(values: Map<String, Boolean>): String = values.entries.joinToString(",", "{", "}") {
        quoted(it.key) + ":" + it.value
    }
    private fun observe(row: String, phase: String) {
        try { observer?.invoke(row.dropLast(1) + ",\\\"phase\\\":" + quoted(phase) + "}") } catch (failure: Exception) {
            System.err.println("Studio observation unavailable: " + failure.javaClass.simpleName)
        }
    }
    private fun append(row: String) {
        try { output?.appendText(row + "\\n") } catch (failure: Exception) {
            System.err.println("Studio test trace unavailable: " + failure.javaClass.simpleName)
        }
        observe(row, "evaluated")
    }

    fun decision(facetId: String, cellId: String, facts: Map<String, String>, valuesJson: String) {
        append("{\\\"kind\\\":\\\"decision\\\",\\\"facetId\\\":" + quoted(facetId)
            + ",\\\"cellId\\\":" + quoted(cellId) + ",\\\"facts\\\":" + strings(facts)
            + ",\\\"values\\\":" + valuesJson + "}")
    }
    fun transition(facetId: String, cellId: String?, from: String, to: String, input: String,
        guards: Map<String, Boolean>) {
        append("{\\\"kind\\\":\\\"transition\\\",\\\"facetId\\\":" + quoted(facetId)
            + ",\\\"cellId\\\":" + (cellId?.let(::quoted) ?: "null")
            + ",\\\"from\\\":" + quoted(from) + ",\\\"to\\\":" + quoted(to)
            + ",\\\"input\\\":" + quoted(input) + ",\\\"guards\\\":" + booleans(guards) + "}")
    }
    fun appliedTransition(facetId: String, from: String, to: String, input: String,
        guards: Map<String, Boolean>, instanceId: String) {
        observe("{\\\"kind\\\":\\\"transition\\\",\\\"facetId\\\":" + quoted(facetId)
            + ",\\\"cellId\\\":null,\\\"from\\\":" + quoted(from) + ",\\\"to\\\":" + quoted(to)
            + ",\\\"input\\\":" + quoted(input) + ",\\\"guards\\\":" + booleans(guards)
            + ",\\\"instanceId\\\":" + quoted(instanceId) + "}", "applied")
    }
}
`;
}
