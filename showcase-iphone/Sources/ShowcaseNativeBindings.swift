import Observation

protocol ShowcaseNativeBinding {
    var nodeTypeRef: String { get }
}

struct ShowcaseCatalogSource: ShowcaseNativeBinding {
    let nodeTypeRef: String
    let artifact: ShowcaseArtifact

    func trees(preferredSurface: String) -> [ShowcaseTree] {
        let scoped = GeneratedShowcaseProduct.trees.filter {
            $0.artifactId == artifact.id && $0.surface.rawValue == preferredSurface
        }
        precondition(!scoped.isEmpty, "Product IR has no artifact scope for the selected surface")
        return artifact.screenRefs.compactMap { screen in scoped.first(where: { $0.screenId == screen }) }
    }

    func component(_ id: GeneratedShowcaseComponentId) -> ShowcaseComponent {
        let component = GeneratedShowcaseProduct.components.first(where: { $0.id == id })!
        precondition(GeneratedShowcaseProduct.nativeComponents.contains(where: {
            $0.componentInstanceRef == id && $0.componentTypeRef == id.rawValue
        }))
        return component
    }

    func icon(_ id: String) -> ShowcaseIconAsset {
        let icon = GeneratedShowcaseProduct.icons.first(where: { $0.id == id })!
        precondition(icon.nativeSymbol == "ShowcaseVectorIcon")
        return icon
    }
}

struct ShowcaseRendererSource: ShowcaseNativeBinding {
    let nodeTypeRef: String
}

@MainActor
@Observable
final class ShowcaseNavigationController: ShowcaseNativeBinding {
    let nodeTypeRef: String
    let artifact: ShowcaseNavigationArtifact
    var path: [ShowcaseNavigationDestination] = [] {
        didSet {
            activePage = path.reversed().compactMap { destination in
                if case .page(let pageRef) = destination { return pageRef }
                return nil
            }.first ?? artifact.entryPageRef
        }
    }
    var activePage: String

    init(nodeTypeRef: String, artifactId: GeneratedShowcaseArtifactId) {
        self.nodeTypeRef = nodeTypeRef
        artifact = GeneratedShowcaseProduct.navigationArtifacts.first(where: { $0.artifactId == artifactId })!
        activePage = artifact.entryPageRef
        precondition(
            GeneratedShowcaseProduct.activePageBindings.contains(where: {
                $0.publisherPortRef.rawValue == "navigation.activePage" &&
                    $0.pageHostPortRef.rawValue == "page.host.activePage"
            }),
            "Product IR has no active-page/page-host binding"
        )
        precondition(GeneratedShowcaseProduct.nativeComponents.contains(where: {
            $0.componentInstanceRef == .pageHost && $0.componentTypeRef == "showcase.page-host" &&
                $0.mounts.contains(where: { $0.profileId == artifactId })
        }))
        precondition(GeneratedShowcaseProduct.nativeComponents.contains(where: {
            $0.componentInstanceRef == .pageMenu && $0.componentTypeRef == "showcase.page-menu" &&
                $0.mounts.contains(where: { $0.profileId == artifactId })
        }))
    }

    func route(_ pageRef: String) {
        precondition(artifact.pages.contains(where: { $0.pageRef == pageRef }))
        requireAction(componentId: .pageMenu, sourcePort: "page.menu.route", effect: "push")
        activePage = pageRef
        path.append(.page(pageRef))
    }

    func open(_ componentId: GeneratedShowcaseComponentId) {
        let component = GeneratedShowcaseProduct.components.first(where: { $0.id == componentId })!
        requireAction(componentId: .pageMenu, sourcePort: "page.menu.\(component.openPort)", effect: "dispatch")
        path.append(.component(componentId))
    }

    private func requireAction(componentId: GeneratedShowcaseComponentId, sourcePort: String, effect: String) {
        precondition(
            GeneratedShowcaseProduct.navigationActionGroups.contains(where: { group in
                group.artifactId == artifact.artifactId && group.componentId == componentId &&
                    group.actions.contains(where: {
                        $0.sourcePortRef.rawValue == sourcePort && $0.effect == effect
                    })
            }),
            "Product IR has no \(effect) action binding for \(componentId.rawValue)"
        )
    }
}

enum ShowcaseNavigationDestination: Hashable {
    case page(String)
    case component(GeneratedShowcaseComponentId)
}

@MainActor
@Observable
final class ShowcaseNativeEnvironment {
    let catalog: ShowcaseCatalogSource
    let navigation: ShowcaseNavigationController
    let renderer: ShowcaseRendererSource

    init() {
        let artifact = GeneratedShowcaseProduct.artifacts.first(where: {
            $0.rendererId == ShowcaseNativePlatform.rendererId
        })!
        let catalogNode = GeneratedShowcaseProduct.nodes.first(where: { $0.id == .catalog })!
        let navigationNode = GeneratedShowcaseProduct.nodes.first(where: { $0.id == .navigation })!
        let rendererNode = GeneratedShowcaseProduct.nodes.first(where: { $0.id == .renderer })!
        catalog = ShowcaseCatalogSource(nodeTypeRef: catalogNode.typeRef, artifact: artifact)
        navigation = ShowcaseNavigationController(nodeTypeRef: navigationNode.typeRef, artifactId: artifact.id)
        renderer = ShowcaseRendererSource(nodeTypeRef: rendererNode.typeRef)
        GeneratedShowcaseNodeId.allCases.forEach { _ = binding(for: $0) }
    }

    func binding(for id: GeneratedShowcaseNodeId) -> any ShowcaseNativeBinding {
        let registration = GeneratedShowcaseProduct.nodes.first(where: { $0.id == id })!
        switch id {
        case .catalog:
            precondition(registration.nativePortId == "ShowcaseCatalogSource")
            return catalog
        case .navigation, .navigationPresentation:
            precondition(registration.nativePortId == "ShowcaseNavigationController")
            return navigation
        case .renderer, .rendererPresentation:
            precondition(registration.nativePortId == "ShowcaseNativeEnvironment")
            return renderer
        }
    }

    func mountComponent(_ id: GeneratedShowcaseComponentId) -> ShowcaseMountedRenderer {
        let registration = GeneratedShowcaseProduct.nativeComponents.first(where: {
            $0.componentInstanceRef == id && $0.mounts.contains(where: { $0.profileId == catalog.artifact.id })
        })!
        let values = Dictionary(uniqueKeysWithValues: registration.immutableInputs.map { input in
            (input.consumerPortRef, input.read(self))
        })
        let mounted = registration.mounts.first(where: { $0.profileId == catalog.artifact.id })!.mount(self)
        guard let component = mounted as? ShowcaseComponent else {
            preconditionFailure("Native Showcase mount \(id.rawValue) did not return its immutable component model")
        }
        let emitter: ShowcaseRendererEmitter
        switch registration.eventEmitter {
        case .empty(let endpoint):
            emitter = .empty(endpoint)
        case .typed(let bindings):
            emitter = .typed(bindings.map { binding in
                ShowcaseBoundEventBinding(
                    sourcePortRef: binding.sourcePortRef,
                    targetPortRef: binding.targetPortRef,
                    contractRef: binding.contractRef,
                    emit: { payload in binding.emit(self, payload) }
                )
            })
        }
        return ShowcaseMountedRenderer(
            componentId: component.id,
            inputs: ShowcaseImmutableInputBundle(values: values),
            emitter: emitter
        )
    }

    func componentValue(_ id: GeneratedShowcaseComponentId) -> Any {
        switch id {
        case .pageHost:
            return navigation.activePage
        case .pageMenu:
            return navigation.artifact.pages
        default:
            return catalog.component(id)
        }
    }

    func read(producerPortRef: String) -> Any {
        switch producerPortRef {
        case "catalog.model":
            return GeneratedShowcaseProduct.components
        case "navigation.presentation.model":
            return navigation.path
        case "renderer.presentation.model":
            return GeneratedShowcaseProduct.components
        case "navigation.activePage":
            return navigation.activePage
        default:
            preconditionFailure("No native Showcase reader for \(producerPortRef)")
        }
    }

    func emit(componentId: GeneratedShowcaseComponentId, sourcePortRef: String, payload: Any) {
        let registration = GeneratedShowcaseProduct.nativeComponents.first(where: {
            $0.componentInstanceRef == componentId
        })!
        switch registration.eventEmitter {
        case .empty:
            preconditionFailure("Read-only Showcase renderer \(componentId.rawValue) cannot emit")
        case .typed(let bindings):
            bindings.first(where: { $0.sourcePortRef == sourcePortRef })!.emit(self, payload)
        }
    }

    func dispatch(sourcePortRef: String, payload: Any) {
        if sourcePortRef == "page.menu.route", let pageRef = payload as? String {
            navigation.route(pageRef)
        } else if sourcePortRef.hasPrefix("page.menu."), let componentId = payload as? GeneratedShowcaseComponentId {
            navigation.open(componentId)
        } else {
            precondition(sourcePortRef.hasSuffix(".action"), "Unknown Showcase event \(sourcePortRef)")
        }
    }
}

enum ShowcaseNativePlatform {
    static var rendererId: String {
#if os(watchOS)
        "apple-watchos-swiftui"
#else
        "apple-iphone-swiftui"
#endif
    }

    static func preferredSurface(width: CGFloat) -> String {
#if os(watchOS)
        "round"
#else
        width >= 700 ? "wide" : "compact"
#endif
    }
}
