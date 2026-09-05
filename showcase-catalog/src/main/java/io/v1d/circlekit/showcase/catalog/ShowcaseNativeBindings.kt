package io.v1d.circlekit.showcase.catalog

import androidx.compose.ui.graphics.vector.ImageVector
import com.adelost.designkit.ui.RingIcons
import kotlin.reflect.KClass

const val SHOWCASE_PHONE_PROFILE = "phone-full-ui"
const val SHOWCASE_WEAR_PROFILE = "wear-full-ui"

enum class ShowcaseNativeRenderer(val id: String, val navigationInputPort: String? = null) {
    COLORS("colors", "foundationColors"),
    GEOMETRY("geometry", "foundationGeometry"),
    ICON_ACTIONS("icon-actions", "atomIconAction"),
    ACTION_ROWS("action-rows", "controlActionRow"),
    CHOICE_ROWS("choice-rows", "controlChoiceRow"),
    ADJUSTMENT("adjustment", "controlAdjustment"),
    PROGRESS("progress", "controlProgress"),
    PRESS("press", "controlPressRing"),
    TEXT("text", "inputText"),
    CAPTURE("capture", "mediaCapture"),
    PLAYBACK("playback", "mediaPlayback"),
    SCREEN_TEMPLATES("screen-templates", "templateScreens"),
    SOURCE("source", "flowSource"),
    UPDATE("update", "flowUpdate"),
    SERVICE("service", "flowService"),
    PAGE_HOST("page-host"),
    PAGE_MENU("page-menu"),
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

enum class ShowcaseNativePageBack(val wireValue: String) {
    SYSTEM("system") {
        override fun execute(previous: () -> Boolean): Boolean = false
    },
    PREVIOUS("previous") {
        override fun execute(previous: () -> Boolean): Boolean = previous()
    };

    abstract fun execute(previous: () -> Boolean): Boolean
}

/** Native closed page value compiled into Android; conformance catches drift. */
enum class ShowcaseNativePageValue(val wireValue: String) {
    FOUNDATIONS("section.foundations"),
    ATOMS("section.atoms"),
    CONTROLS("section.controls"),
    INPUT("section.input"),
    MEDIA("section.media"),
    TEMPLATES("section.templates"),
    FLOWS("section.flows"),
    GARMIN_LIMITED("artifact.garmin-limited-ui"),
}

data class ShowcaseNativePageRegistration(
    val page: ShowcaseNativePageValue,
    val restore: String,
    val back: ShowcaseNativePageBack,
) {
    val pageRef: String get() = page.wireValue
}

data class ShowcaseNativeOpenRegistration(
    val component: ShowcaseNativeComponentBinding,
    val sourcePortRef: String,
    val targetPortRef: String,
) {
    fun dispatch(session: ShowcaseSession, caseId: ShowcaseCaseId, scenarioId: ShowcaseScenarioId): Boolean =
        session.commitOpen(caseId, scenarioId)
}

/**
 * Android adapter truth. Pages, back behavior and component dispatch are the
 * executable registrations consumed by the UI. The JSON snapshot serializes
 * these registrations; it never aliases the generated ProductSpec expectation.
 */
object ShowcaseNativeBindings {
    const val SCHEMA_VERSION = 5
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
        component("showcase.page-host", ShowcaseNativeRenderer.PAGE_HOST),
        component("showcase.page-menu", ShowcaseNativeRenderer.PAGE_MENU),
    )

    val icons: List<ShowcaseNativeIconBinding> = listOf(
        icon("palette", "RingIcons.Palette", RingIcons.Palette),
        icon("grid", "RingIcons.Grid", RingIcons.Grid),
        icon("touchdown-run", "RingIcons.TouchdownRun", RingIcons.TouchdownRun),
        icon("pencil", "RingIcons.Pencil", RingIcons.Pencil),
        icon("play", "RingIcons.Play", RingIcons.Play),
        icon("layers", "RingIcons.Layers", RingIcons.Layers),
        icon("data", "RingIcons.Data", RingIcons.Data),
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
                "route",
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
            outputPorts = listOf("activePage", "destination"),
        ),
        ShowcaseNativeNodeBinding(
            nodeId = "navigation.presentation",
            nativeType = ShowcaseSession::class,
            profiles = bothProfiles,
            inputPorts = listOf("destination"),
            outputPorts = listOf("model"),
        ),
    )

    private val pages: List<ShowcaseNativePageRegistration> = ShowcaseFamily.entries.map { family ->
        val entry = family == ShowcaseFamily.FOUNDATIONS
        ShowcaseNativePageRegistration(
            page = ShowcaseNativePageValue.entries.single { it.name == family.name },
            restore = if (entry) "root" else "process",
            back = if (entry) ShowcaseNativePageBack.SYSTEM else ShowcaseNativePageBack.PREVIOUS,
        )
    }

    private val openRegistrations: List<ShowcaseNativeOpenRegistration> = components.mapNotNull { component ->
        component.renderer.navigationInputPort?.let { targetPort ->
            ShowcaseNativeOpenRegistration(
                component = component,
                sourcePortRef = "${component.componentId}.open",
                targetPortRef = "navigation.$targetPort",
            )
        }
    }

    val finiteValues: List<ShowcaseFiniteValueBinding> = listOf(
        ShowcaseFiniteValueBinding(
            id = "showcase.navigation.page",
            values = ShowcaseNativePageValue.entries.map(ShowcaseNativePageValue::wireValue),
        ),
    )

    val navigationArtifacts: List<ShowcaseNavigationArtifact> = profiles.map { profile ->
        ShowcaseNavigationArtifact(
            artifactRef = profile,
            entryPageRef = pages.first().pageRef,
            pages = pages.map { page ->
                ShowcaseNavigationPage(page.pageRef, page.restore, page.back.wireValue, null)
            },
        )
    }

    val activePageBindings: List<ShowcaseActivePageBinding> = listOf(
        ShowcaseActivePageBinding("navigation.activePage", "page.host.activePage"),
    )

    val navigationActionGroups: List<ShowcaseNavigationActionGroup> = profiles.flatMap { profile ->
        openRegistrations.map { registration ->
            ShowcaseNavigationActionGroup(
                artifactRef = profile,
                componentInstanceRef = registration.component.componentId,
                actions = listOf(
                    ShowcaseNavigationAction(
                        registration.sourcePortRef,
                        registration.targetPortRef,
                        "dispatch",
                    ),
                ),
            )
        } + ShowcaseNavigationActionGroup(
            artifactRef = profile,
            componentInstanceRef = "page.menu",
            actions = listOf(ShowcaseNavigationAction("page.menu.route", "navigation.route", "push")),
        )
    }

    fun requireAction(
        profileId: String,
        componentInstanceRef: String,
        sourcePortRef: String,
        effect: String,
    ) {
        require(navigationActionGroups.any { group ->
            group.artifactRef == profileId && group.componentInstanceRef == componentInstanceRef &&
                group.actions.any { action ->
                    action.sourcePortRef == sourcePortRef && action.effect == effect
                }
        }) {
            "No $effect action binding for $profileId/$componentInstanceRef/$sourcePortRef"
        }
    }

    fun dispatchOpen(
        session: ShowcaseSession,
        caseId: ShowcaseCaseId,
        scenarioId: ShowcaseScenarioId,
    ): Boolean = requireNotNull(openRegistrations.singleOrNull { registration ->
        registration.component.componentId == caseId.value && session.artifactProfile.id in registration.component.profiles
    }) { "No native open registration for ${session.artifactProfile.id}/${caseId.value}" }
        .dispatch(session, caseId, scenarioId)

    fun route(session: ShowcaseSession, pageRef: String): Boolean {
        if (pages.none { it.pageRef == pageRef }) return false
        requireAction(session.artifactProfile.id, "page.menu", "page.menu.route", "push")
        session.commitRoute(pageRef)
        return true
    }

    fun back(pageRef: String, previous: () -> Boolean): Boolean =
        requireNotNull(pages.singleOrNull { it.pageRef == pageRef }) {
            "No native page registration for $pageRef"
        }.back.execute(previous)

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
