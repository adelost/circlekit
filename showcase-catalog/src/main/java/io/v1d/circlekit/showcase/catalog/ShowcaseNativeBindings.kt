package io.v1d.circlekit.showcase.catalog

import androidx.compose.ui.graphics.vector.ImageVector
import com.adelost.designkit.ui.RingIcons
import kotlin.reflect.KClass

const val SHOWCASE_PHONE_PROFILE = "phone-full-ui"
const val SHOWCASE_WEAR_PROFILE = "wear-full-ui"

enum class ShowcaseNativeRenderer(val id: String) {
    COLORS("colors"),
    GEOMETRY("geometry"),
    ICON_ACTIONS("icon-actions"),
    ACTION_ROWS("action-rows"),
    CHOICE_ROWS("choice-rows"),
    ADJUSTMENT("adjustment"),
    PROGRESS("progress"),
    PRESS("press"),
    TEXT("text"),
    CAPTURE("capture"),
    PLAYBACK("playback"),
    SCREEN_TEMPLATES("screen-templates"),
    SOURCE("source"),
    UPDATE("update"),
    SERVICE("service"),
}

data class ShowcaseNativeComponentBinding(
    val componentId: String,
    val renderer: ShowcaseNativeRenderer,
    val profiles: Set<String>,
)

data class ShowcaseNativeIconBinding(
    val iconId: String,
    val nativeSymbol: String,
    val icon: ImageVector,
)

data class ShowcaseNativeNodeBinding(
    val nodeId: String,
    val nativeType: KClass<*>,
    val profiles: Set<String>,
    val inputPorts: List<String>,
    val outputPorts: List<String>,
) {
    val nativePortId: String = requireNotNull(nativeType.qualifiedName)
}

/**
 * Handwritten Android binding truth. It deliberately has no dependency on
 * generated product classes; the ProductSpec compiler consumes its exported
 * snapshot and rejects missing, orphan or profile-drifted bindings.
 */
object ShowcaseNativeBindings {
    const val SCHEMA_VERSION = 4
    const val SOURCE_FILE =
        "showcase-catalog/src/main/java/io/v1d/circlekit/showcase/catalog/ShowcaseNativeBindings.kt"

    private val bothProfiles = setOf(SHOWCASE_PHONE_PROFILE, SHOWCASE_WEAR_PROFILE)

    /**
     * The artifact profiles THIS host renders, which is two of the product's five.
     * The iPhone, watchOS and Garmin artifacts belong to other hosts, and saying so
     * out loud is what lets a shared comparison tell "another host's job" apart from
     * "nobody renders this".
     */
    val profiles: Set<String> = bothProfiles

    val components: List<ShowcaseNativeComponentBinding> = listOf(
        component("foundation.colors", ShowcaseNativeRenderer.COLORS),
        component("foundation.geometry", ShowcaseNativeRenderer.GEOMETRY),
        component("atom.icon-action", ShowcaseNativeRenderer.ICON_ACTIONS),
        component("control.action-row", ShowcaseNativeRenderer.ACTION_ROWS),
        component("control.choice-row", ShowcaseNativeRenderer.CHOICE_ROWS),
        component("control.adjustment", ShowcaseNativeRenderer.ADJUSTMENT),
        component("control.progress", ShowcaseNativeRenderer.PROGRESS),
        component("control.press-ring", ShowcaseNativeRenderer.PRESS),
        component("input.text", ShowcaseNativeRenderer.TEXT),
        component("media.capture", ShowcaseNativeRenderer.CAPTURE),
        component("media.playback", ShowcaseNativeRenderer.PLAYBACK),
        component("template.screens", ShowcaseNativeRenderer.SCREEN_TEMPLATES),
        component("flow.source", ShowcaseNativeRenderer.SOURCE),
        component("flow.update", ShowcaseNativeRenderer.UPDATE),
        component("flow.service", ShowcaseNativeRenderer.SERVICE),
    )

    val icons: List<ShowcaseNativeIconBinding> = listOf(
        icon("palette", "RingIcons.Palette", RingIcons.Palette),
        icon("grid", "RingIcons.Grid", RingIcons.Grid),
        icon("touchdown-run", "RingIcons.TouchdownRun", RingIcons.TouchdownRun),
        icon("pencil", "RingIcons.Pencil", RingIcons.Pencil),
        icon("play", "RingIcons.Play", RingIcons.Play),
        icon("layers", "RingIcons.Layers", RingIcons.Layers),
        icon("wifi", "RingIcons.Wifi", RingIcons.Wifi),
        icon("watch", "RingIcons.Watch", RingIcons.Watch),
        icon("sliders", "RingIcons.Sliders", RingIcons.Sliders),
        icon("download", "RingIcons.Download", RingIcons.Download),
        icon("record", "RingIcons.Record", RingIcons.Record),
        icon("wrench", "RingIcons.Wrench", RingIcons.Wrench),
    )

    val nodes: List<ShowcaseNativeNodeBinding> = listOf(
        ShowcaseNativeNodeBinding(
            nodeId = "catalog",
            nativeType = ShowcaseCatalogRuntime::class,
            profiles = bothProfiles,
            inputPorts = emptyList(),
            outputPorts = listOf("model"),
        ),
        ShowcaseNativeNodeBinding(
            nodeId = "navigation",
            nativeType = ShowcaseSession::class,
            profiles = bothProfiles,
            inputPorts = listOf(
                "foundationColors",
                "foundationGeometry",
                "atomIconAction",
                "controlActionRow",
                "controlChoiceRow",
                "controlAdjustment",
                "controlProgress",
                "controlPressRing",
                "inputText",
                "mediaCapture",
                "mediaPlayback",
                "templateScreens",
                "flowSource",
                "flowUpdate",
                "flowService",
            ),
            outputPorts = listOf("destination"),
        ),
        ShowcaseNativeNodeBinding(
            nodeId = "navigation.presentation",
            nativeType = ShowcaseSession::class,
            profiles = bothProfiles,
            inputPorts = listOf("destination"),
            outputPorts = listOf("model"),
        ),
    )

    fun requireComponent(componentId: String): ShowcaseNativeComponentBinding =
        requireNotNull(components.singleOrNull { it.componentId == componentId }) {
            "No native Showcase binding for $componentId"
        }

    fun requireIcon(iconId: String): ImageVector =
        requireNotNull(icons.singleOrNull { it.iconId == iconId }) {
            "No native Showcase icon for $iconId"
        }.icon

    fun requireProfile(profileId: String) {
        require(components.all { profileId in it.profiles }) {
            "Showcase profile $profileId is not bound for every component"
        }
        require(nodes.all { profileId in it.profiles }) {
            "Showcase profile $profileId is not bound for every node"
        }
    }

    private fun component(id: String, renderer: ShowcaseNativeRenderer) =
        ShowcaseNativeComponentBinding(id, renderer, bothProfiles)

    private fun icon(id: String, symbol: String, value: ImageVector) =
        ShowcaseNativeIconBinding(id, symbol, value)
}
