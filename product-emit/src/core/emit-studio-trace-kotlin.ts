/** A dormant, dependency-free sink emitted beside test-observable Kotlin decisions. */
export function emitStudioTraceSinkKotlin(name: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/u.test(name)) throw new Error(`invalid Kotlin trace sink '${name}'`);
  return `/** Writes only when v1d-studio record gives this test process a private trace directory. */
internal object ${name} {
    private val output = System.getenv("V1D_STUDIO_TRACE_DIR")?.takeIf { it.isNotBlank() }?.let {
        java.io.File(it, "kotlin-" + java.util.UUID.randomUUID() + ".jsonl")
    }
    val enabled: Boolean get() = output != null

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
    private fun append(row: String) { output?.appendText(row + "\\n") }

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
}
`;
}
