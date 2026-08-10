package io.v1d.circlekit.showcase.catalog

import androidx.compose.ui.graphics.vector.ImageVector
import com.adelost.designkit.ui.RingIcons
import kotlin.reflect.KClass

const val SHOWCASE_PHONE_PROFILE = "phone-full-ui"
const val SHOWCASE_WEAR_PROFILE = "wear-full-ui"

enum class ShowcaseNativeRenderer(
    val id: String,
    val navigationInputPort: String? = null,
    val pageRef: String? = null,
    val interactive: Boolean = true,
) {
    COLORS("colors", "foundationColors", "section.foundations", interactive = false),
    GEOMETRY("geometry", "foundationGeometry", "section.foundations", interactive = false),
    ICON_ACTIONS("icon-actions", "atomIconAction", "section.atoms"),
    ACTION_ROWS("action-rows", "controlActionRow", "section.controls"),
    CHOICE_ROWS("choice-rows", "controlChoiceRow", "section.controls"),
    ADJUSTMENT("adjustment", "controlAdjustment", "section.controls"),
    PROGRESS("progress", "controlProgress", "section.controls"),
    PRESS("press", "controlPressRing", "section.controls"),
    TEXT("text", "inputText", "section.input"),
    CAPTURE("capture", "mediaCapture", "section.media"),
    PLAYBACK("playback", "mediaPlayback", "section.media"),
    SCREEN_TEMPLATES("screen-templates", "templateScreens", "section.templates"),
    SOURCE("source", "flowSource", "section.flows"),
    UPDATE("update", "flowUpdate", "section.flows"),
    SERVICE("service", "flowService", "section.flows"),
    PAGE_HOST("page-host"),
    PAGE_MENU("page-menu"),
}

data class ShowcaseNativeComponentBinding(
    val componentId: String,
    val componentTypeRef: String,
    val renderer: ShowcaseNativeRenderer,
    val mounts: List<ShowcaseNativeMountBinding>,
    val immutableInputs: List<ShowcaseNativeInputBinding>,
    val eventEmitter: ShowcaseNativeEventEmitterBinding,
) {
    val profiles: Set<String> = mounts.mapTo(linkedSetOf(), ShowcaseNativeMountBinding::profileRef)
}

data class ShowcaseNativeMountBinding(
    val profileRef: String,
    val pageRef: String,
    val surface: String,
    val mountRef: String,
    val mount: (ShowcaseGeneratedImmutableInputBundle, ShowcaseRendererEmitter) -> Any,
)

data class ShowcaseNativeInputBinding(
    val consumerPortRef: String,
    val producerPortRef: String,
    val contractRef: String,
    val required: Boolean,
    val read: (ShowcaseRendererProducerPorts) -> Any,
)

data class ShowcaseNativeEventBinding(
    val sourcePortRef: String,
    val targetPortRef: String,
    val contractRef: String,
    val emit: (ShowcaseRendererProducerPorts, ShowcaseRendererEventPayload) -> Unit,
)

sealed interface ShowcaseNativeEventEmitterBinding {
    data class Empty(val emit: (Nothing) -> Nothing) : ShowcaseNativeEventEmitterBinding
    data class Typed(val bindings: List<ShowcaseNativeEventBinding>) : ShowcaseNativeEventEmitterBinding
}

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

/**
 * Android adapter truth. Pages, back behavior and component dispatch are the
 * executable registrations consumed by the UI. The JSON snapshot serializes
 * these registrations; it never aliases the generated ProductSpec expectation.
 */
object ShowcaseNativeBindings {
    const val SCHEMA_VERSION = 6
    const val SOURCE_FILE =
        "showcase-catalog/src/main/java/io/v1d/circlekit/showcase/catalog/ShowcaseNativeBindings.kt"

    private val bothProfiles = setOf(SHOWCASE_PHONE_PROFILE, SHOWCASE_WEAR_PROFILE)

    private val pages: List<ShowcaseNativePageRegistration> = ShowcaseFamily.entries.map { family ->
        val entry = family == ShowcaseFamily.FOUNDATIONS
        ShowcaseNativePageRegistration(
            page = ShowcaseNativePageValue.entries.single { it.name == family.name },
            restore = if (entry) "root" else "process",
            back = if (entry) ShowcaseNativePageBack.SYSTEM else ShowcaseNativePageBack.PREVIOUS,
        )
    }

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
        pageHost(),
        pageMenu(),
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
        ShowcaseNativeNodeBinding(
            nodeId = "renderer",
            nativeType = ShowcaseRendererProducerPorts::class,
            profiles = bothProfiles,
            inputPorts = listOf(
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
            outputPorts = listOf("model"),
        ),
        ShowcaseNativeNodeBinding(
            nodeId = "renderer.presentation",
            nativeType = ShowcaseRendererProducerPorts::class,
            profiles = bothProfiles,
            inputPorts = listOf("model"),
            outputPorts = listOf("model"),
        ),
    )

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
        val menuEvents = (requireComponent("page.menu").eventEmitter as ShowcaseNativeEventEmitterBinding.Typed)
            .bindings
        listOf(ShowcaseNavigationActionGroup(
            artifactRef = profile,
            componentInstanceRef = "page.menu",
            actions = menuEvents.map { event ->
                ShowcaseNavigationAction(
                    event.sourcePortRef,
                    event.targetPortRef,
                    if (event.sourcePortRef == "page.menu.route") "push" else "dispatch",
                )
            },
        )) + components.filter { it.renderer.interactive && it.renderer !in setOf(
            ShowcaseNativeRenderer.PAGE_HOST,
            ShowcaseNativeRenderer.PAGE_MENU,
        ) }.map { registration ->
            val event = (registration.eventEmitter as ShowcaseNativeEventEmitterBinding.Typed).bindings.single()
            ShowcaseNavigationActionGroup(
                artifactRef = profile,
                componentInstanceRef = registration.componentId,
                actions = listOf(ShowcaseNavigationAction(
                    event.sourcePortRef,
                    event.targetPortRef,
                    "dispatch",
                )),
            )
        }
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
    ): Boolean {
        val component = requireComponent(caseId.value)
        require(session.artifactProfile.id in component.profiles)
        val target = requireNotNull(component.renderer.navigationInputPort)
        val pageMenu = requireComponent("page.menu")
        val emitter = pageMenu.eventEmitter as ShowcaseNativeEventEmitterBinding.Typed
        val binding = requireNotNull(emitter.bindings.singleOrNull {
            it.sourcePortRef == "page.menu.$target" && it.targetPortRef == "navigation.$target"
        }) { "No native open registration for ${session.artifactProfile.id}/${caseId.value}" }
        binding.emit(
            ShowcaseRendererProducerPorts(session, ShowcaseDestination(), null),
            ShowcaseRendererEventPayload("navigation.open", "${caseId.value}|${scenarioId.value}"),
        )
        return true
    }

    fun route(session: ShowcaseSession, pageRef: String): Boolean {
        if (pages.none { it.pageRef == pageRef }) return false
        requireAction(session.artifactProfile.id, "page.menu", "page.menu.route", "push")
        val pageMenu = requireComponent("page.menu")
        val emitter = pageMenu.eventEmitter as ShowcaseNativeEventEmitterBinding.Typed
        emitter.bindings.single { it.sourcePortRef == "page.menu.route" }.emit(
            ShowcaseRendererProducerPorts(session, ShowcaseDestination(), null),
            ShowcaseRendererEventPayload("navigation.route", pageRef),
        )
        return true
    }

    fun mountRenderer(
        session: ShowcaseSession,
        destination: ShowcaseDestination,
        surface: com.adelost.designkit.ui.CircleSurfaceClass,
        textEntryPort: com.adelost.ringkit.ui.RingTextEntryPort?,
    ): ShowcaseMountedRenderer {
        val componentId = requireNotNull(destination.caseId).value
        val registration = requireComponent(componentId)
        val wireSurface = when (surface) {
            com.adelost.designkit.ui.CircleSurfaceClass.ROUND -> "round"
            com.adelost.designkit.ui.CircleSurfaceClass.PHONE_COMPACT -> "compact"
            com.adelost.designkit.ui.CircleSurfaceClass.PHONE_WIDE -> "wide"
        }
        val mount = requireNotNull(registration.mounts.singleOrNull {
            it.profileRef == session.artifactProfile.id && it.surface == wireSurface
        }) { "No native mount for ${session.artifactProfile.id}/$wireSurface/$componentId" }
        val producer = ShowcaseRendererProducerPorts(session, destination, textEntryPort)
        val values = registration.immutableInputs.associate { input ->
            input.consumerPortRef to input.read(producer)
        }
        val contract = requireNotNull(ShowcaseManifest.rendererContracts.singleOrNull {
            it.componentInstanceRef == componentId
        }) { "No generated renderer contract for $componentId" }
        val inputs = ShowcaseGeneratedImmutableInputBundle.exact(contract, values)
        val emitter: ShowcaseRendererEmitter = when (val registered = registration.eventEmitter) {
            is ShowcaseNativeEventEmitterBinding.Empty -> ShowcaseEmptyRendererEmitter()
            is ShowcaseNativeEventEmitterBinding.Typed -> {
                val binding = registered.bindings.single()
                ShowcaseTypedRendererEmitter { payload -> binding.emit(producer, payload) }
            }
        }
        return mount.mount(inputs, emitter) as ShowcaseMountedRenderer
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

    private fun component(id: String, renderer: ShowcaseNativeRenderer): ShowcaseNativeComponentBinding {
        val commonInputs = listOf(
            input("$id.catalog", "catalog.model", "showcase.catalog-presentation"),
            input("$id.navigation", "navigation.presentation.model", "showcase.navigation-presentation"),
        )
        return ShowcaseNativeComponentBinding(
            componentId = id,
            componentTypeRef = id,
            renderer = renderer,
            mounts = mounts(id, listOf(requireNotNull(renderer.pageRef))),
            immutableInputs = if (renderer.interactive) {
                commonInputs + input("$id.renderer", "renderer.presentation.model", "showcase.renderer-presentation")
            } else {
                commonInputs
            },
            eventEmitter = if (renderer.interactive) {
                ShowcaseNativeEventEmitterBinding.Typed(listOf(event(
                    source = "$id.action",
                    target = "renderer.${requireNotNull(renderer.navigationInputPort)}",
                    contract = "showcase.renderer-action",
                    componentId = id,
                )))
            } else {
                emptyEmitter()
            },
        )
    }

    private fun pageHost() = ShowcaseNativeComponentBinding(
        componentId = "page.host",
        componentTypeRef = "showcase.page-host",
        renderer = ShowcaseNativeRenderer.PAGE_HOST,
        mounts = mounts("page.host", pages.map(ShowcaseNativePageRegistration::pageRef)),
        immutableInputs = listOf(input(
            "page.host.activePage",
            "navigation.activePage",
            "showcase.navigation.active-page",
        )),
        eventEmitter = emptyEmitter(),
    )

    private fun pageMenu() = ShowcaseNativeComponentBinding(
        componentId = "page.menu",
        componentTypeRef = "showcase.page-menu",
        renderer = ShowcaseNativeRenderer.PAGE_MENU,
        mounts = mounts("page.menu", pages.map(ShowcaseNativePageRegistration::pageRef)),
        immutableInputs = emptyList(),
        eventEmitter = ShowcaseNativeEventEmitterBinding.Typed(
            listOf(ShowcaseNativeEventBinding(
                sourcePortRef = "page.menu.route",
                targetPortRef = "navigation.route",
                contractRef = "showcase.navigation.route-intent",
                emit = { producer, payload -> producer.emitNavigation("navigation.route", payload) },
            )) + ShowcaseNativeRenderer.entries.mapNotNull { renderer ->
                renderer.navigationInputPort?.let(::navigationEvent)
            },
        ),
    )

    private fun mounts(componentId: String, pageRefs: List<String>): List<ShowcaseNativeMountBinding> =
        pageRefs.flatMap { pageRef ->
            listOf(
                nativeMount(SHOWCASE_PHONE_PROFILE, pageRef, "compact", componentId),
                nativeMount(SHOWCASE_PHONE_PROFILE, pageRef, "wide", componentId),
                nativeMount(SHOWCASE_WEAR_PROFILE, pageRef, "round", componentId),
            )
        }

    private fun nativeMount(profile: String, page: String, surface: String, componentId: String) =
        ShowcaseNativeMountBinding(profile, page, surface, componentId, mountEndpoint(componentId))

    private fun mountEndpoint(componentId: String): (ShowcaseGeneratedImmutableInputBundle, ShowcaseRendererEmitter) -> Any =
        when (componentId) {
            "foundation.colors" -> { inputs, emitter -> ShowcaseRendererMounts.colors(inputs, emitter as ShowcaseEmptyRendererEmitter) }
            "foundation.geometry" -> { inputs, emitter -> ShowcaseRendererMounts.geometry(inputs, emitter as ShowcaseEmptyRendererEmitter) }
            "atom.icon-action" -> { inputs, emitter -> ShowcaseRendererMounts.iconActions(inputs, emitter as ShowcaseTypedRendererEmitter) }
            "control.action-row" -> { inputs, emitter -> ShowcaseRendererMounts.actionRows(inputs, emitter as ShowcaseTypedRendererEmitter) }
            "control.choice-row" -> { inputs, emitter -> ShowcaseRendererMounts.choiceRows(inputs, emitter as ShowcaseTypedRendererEmitter) }
            "control.adjustment" -> { inputs, emitter -> ShowcaseRendererMounts.adjustment(inputs, emitter as ShowcaseTypedRendererEmitter) }
            "control.progress" -> { inputs, emitter -> ShowcaseRendererMounts.progress(inputs, emitter as ShowcaseTypedRendererEmitter) }
            "control.press-ring" -> { inputs, emitter -> ShowcaseRendererMounts.press(inputs, emitter as ShowcaseTypedRendererEmitter) }
            "input.text" -> { inputs, emitter -> ShowcaseRendererMounts.text(inputs, emitter as ShowcaseTypedRendererEmitter) }
            "media.capture" -> { inputs, emitter -> ShowcaseRendererMounts.capture(inputs, emitter as ShowcaseTypedRendererEmitter) }
            "media.playback" -> { inputs, emitter -> ShowcaseRendererMounts.playback(inputs, emitter as ShowcaseTypedRendererEmitter) }
            "template.screens" -> { inputs, emitter -> ShowcaseRendererMounts.screens(inputs, emitter as ShowcaseTypedRendererEmitter) }
            "flow.source" -> { inputs, emitter -> ShowcaseRendererMounts.source(inputs, emitter as ShowcaseTypedRendererEmitter) }
            "flow.update" -> { inputs, emitter -> ShowcaseRendererMounts.update(inputs, emitter as ShowcaseTypedRendererEmitter) }
            "flow.service" -> { inputs, emitter -> ShowcaseRendererMounts.service(inputs, emitter as ShowcaseTypedRendererEmitter) }
            "page.host", "page.menu" -> { inputs, _ -> inputs }
            else -> error("No compile-bound Showcase mount for $componentId")
        }

    private fun input(consumer: String, producer: String, contract: String) = ShowcaseNativeInputBinding(
        consumerPortRef = consumer,
        producerPortRef = producer,
        contractRef = contract,
        required = true,
        read = { ports -> ports.read(producer) },
    )

    private fun event(source: String, target: String, contract: String, componentId: String) =
        ShowcaseNativeEventBinding(source, target, contract) { ports, payload -> ports.emit(componentId, payload) }

    private fun navigationEvent(target: String) = ShowcaseNativeEventBinding(
        sourcePortRef = "page.menu.$target",
        targetPortRef = "navigation.$target",
        contractRef = "showcase.open-action",
        emit = { producer, payload -> producer.emitNavigation("navigation.$target", payload) },
    )

    private fun emptyEmitter(): ShowcaseNativeEventEmitterBinding.Empty {
        val endpoint = ShowcaseEmptyRendererEmitter()
        return ShowcaseNativeEventEmitterBinding.Empty(endpoint::emit)
    }

    private fun icon(id: String, symbol: String, value: ImageVector) =
        ShowcaseNativeIconBinding(id, symbol, value)
}
