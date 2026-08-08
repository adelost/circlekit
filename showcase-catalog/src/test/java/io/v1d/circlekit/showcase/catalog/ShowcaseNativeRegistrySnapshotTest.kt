package io.v1d.circlekit.showcase.catalog

import java.nio.file.Files
import java.nio.file.Path
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class ShowcaseNativeRegistrySnapshotTest {
    @Test
    fun `compiled native bindings match the ProductSpec input snapshot`() {
        val root = findRepoRoot()
        val target = root.resolve("showcase-product/native-registry/showcase.json")
        val snapshot = snapshot()
        if (System.getenv("SHOWCASE_UPDATE_NATIVE_REGISTRY") == "1") {
            Files.createDirectories(target.parent)
            Files.write(target, snapshot.toByteArray(Charsets.UTF_8))
        }
        assertEquals(
            "Run this focused test with SHOWCASE_UPDATE_NATIVE_REGISTRY=1 after an intentional binding change.",
            snapshot,
            Files.readAllBytes(target).toString(Charsets.UTF_8),
        )
    }

    @Test
    fun `native registry is independent of generated product output`() {
        val source = Files.readAllBytes(findRepoRoot().resolve(ShowcaseNativeBindings.SOURCE_FILE))
            .toString(Charsets.UTF_8)
        assertFalse(source.contains("GeneratedShowcaseProduct"))
        assertFalse(source.contains("ShowcaseManifest"))
    }

    private fun snapshot(): String {
        val components = ShowcaseNativeBindings.components.joinToString(",\n") { binding ->
            val profiles = binding.profiles.joinToString(", ") { it.json() }
            "    { \"componentId\": ${binding.componentId.json()}, \"rendererId\": ${binding.renderer.id.json()}, \"profiles\": [$profiles] }"
        }
        val icons = ShowcaseNativeBindings.icons.joinToString(",\n") { binding ->
            "    { \"iconId\": ${binding.iconId.json()}, \"nativeSymbol\": ${binding.nativeSymbol.json()} }"
        }
        val services = ShowcaseNativeBindings.services.joinToString(",\n") { binding ->
            val profiles = binding.profiles.joinToString(", ") { it.json() }
            val inputs = binding.inputPorts.joinToString(", ") { it.json() }
            val outputs = binding.outputPorts.joinToString(", ") { it.json() }
            "    { \"serviceId\": ${binding.serviceId.json()}, \"nativePortId\": ${binding.nativePortId.json()}, " +
                "\"profiles\": [$profiles], \"inputPorts\": [$inputs], \"outputPorts\": [$outputs] }"
        }
        val hostProfiles = ShowcaseNativeBindings.profiles.sorted().joinToString(", ") { it.json() }
        // Finite values are declared EMPTY, not omitted. An omitted section means "not
        // checked", which is a different claim from "binds none".
        return """
            |{
            |  "stage": "native-export",
            |  "schemaVersion": ${ShowcaseNativeBindings.SCHEMA_VERSION},
            |  "sourceFile": ${ShowcaseNativeBindings.SOURCE_FILE.json()},
            |  "profiles": [$hostProfiles],
            |  "components": [
            |$components
            |  ],
            |  "icons": [
            |$icons
            |  ],
            |  "services": [
            |$services
            |  ],
            |  "finiteValues": []
            |}
        """.trimMargin() + "\n"
    }

    private fun findRepoRoot(): Path = generateSequence(
        Path.of(System.getProperty("user.dir")).toAbsolutePath(),
    ) { it.parent }.first { Files.exists(it.resolve("settings.gradle.kts")) }

    private fun String.json(): String = buildString {
        append('"')
        for (char in this@json) when (char) {
            '\\' -> append("\\\\")
            '"' -> append("\\\"")
            '\n' -> append("\\n")
            '\r' -> append("\\r")
            '\t' -> append("\\t")
            else -> append(char)
        }
        append('"')
    }
}
