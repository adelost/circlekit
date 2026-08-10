package io.v1d.circlekit.showcase.catalog

import java.nio.file.Files
import java.nio.file.Path
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
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
    fun `native navigation registrations are consumed by the page host`() {
        val source = Files.readAllBytes(findRepoRoot().resolve(ShowcaseNativeBindings.SOURCE_FILE))
            .toString(Charsets.UTF_8)
        val screens = Files.readAllBytes(findRepoRoot().resolve(
            "showcase-catalog/src/main/java/io/v1d/circlekit/showcase/catalog/ShowcaseScreens.kt",
        )).toString(Charsets.UTF_8)
        assertFalse(source.contains("product.navigation"))
        assertTrue(source.contains("ShowcaseManifest.navigationArtifacts"))
        assertTrue(screens.contains("ShowcaseNativeBindings.navigationArtifacts"))
        assertTrue(screens.contains("session.route(screen)"))
    }

    private fun snapshot(): String {
        val components = ShowcaseNativeBindings.components.joinToString(",\n") { binding ->
            val profiles = binding.profiles.joinToString(", ") { it.json() }
            "    { \"componentId\": ${binding.componentId.json()}, \"rendererId\": ${binding.renderer.id.json()}, \"profiles\": [$profiles] }"
        }
        val icons = ShowcaseNativeBindings.icons.joinToString(",\n") { binding ->
            "    { \"iconId\": ${binding.iconId.json()}, \"nativeSymbol\": ${binding.nativeSymbol.json()} }"
        }
        val nodes = ShowcaseNativeBindings.nodes.joinToString(",\n") { binding ->
            val profiles = binding.profiles.joinToString(", ") { it.json() }
            val inputs = binding.inputPorts.joinToString(", ") { it.json() }
            val outputs = binding.outputPorts.joinToString(", ") { it.json() }
            "    { \"nodeId\": ${binding.nodeId.json()}, \"nativePortId\": ${binding.nativePortId.json()}, " +
                "\"profiles\": [$profiles], \"inputPorts\": [$inputs], \"outputPorts\": [$outputs] }"
        }
        val hostProfiles = ShowcaseNativeBindings.profiles.sorted().joinToString(", ") { it.json() }
        val finiteValues = ShowcaseNativeBindings.finiteValues.joinToString(",\n") { binding ->
            val values = binding.values.joinToString(", ") { it.json() }
            "    { \"id\": ${binding.id.json()}, \"values\": [$values] }"
        }
        val navigationArtifacts = ShowcaseNativeBindings.navigationArtifacts.joinToString(",\n") { artifact ->
            val pages = artifact.pages.joinToString(", ") { page ->
                "{ \"pageRef\": ${page.pageRef.json()}, \"restore\": ${page.restore.json()}, " +
                    "\"back\": ${page.back.json()}, \"guardContractRef\": ${page.guardContractRef.jsonNullable()} }"
            }
            "      { \"artifactRef\": ${artifact.artifactRef.json()}, " +
                "\"entryPageRef\": ${artifact.entryPageRef.json()}, \"pages\": [$pages] }"
        }
        val activePageBindings = ShowcaseNativeBindings.activePageBindings.joinToString(",\n") { binding ->
            "      { \"publisherPortRef\": ${binding.publisherPortRef.json()}, " +
                "\"pageHostPortRef\": ${binding.pageHostPortRef.json()} }"
        }
        val actionGroups = ShowcaseNativeBindings.navigationActionGroups.joinToString(",\n") { group ->
            val actions = group.actions.joinToString(", ") { action ->
                "{ \"sourcePortRef\": ${action.sourcePortRef.json()}, " +
                    "\"targetPortRef\": ${action.targetPortRef.json()}, \"effect\": ${action.effect.json()} }"
            }
            "      { \"artifactRef\": ${group.artifactRef.json()}, " +
                "\"componentInstanceRef\": ${group.componentInstanceRef.json()}, \"actions\": [$actions] }"
        }
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
            |  "nodes": [
            |$nodes
            |  ],
            |  "finiteValues": [
            |$finiteValues
            |  ],
            |  "navigation": {
            |    "artifacts": [
            |$navigationArtifacts
            |    ],
            |    "activePageBindings": [
            |$activePageBindings
            |    ],
            |    "actionGroups": [
            |$actionGroups
            |    ]
            |  }
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

    private fun String?.jsonNullable(): String = this?.json() ?: "null"
}
