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
        precondition(component.rendererId == "ShowcaseComponentScreen")
        return component
    }

    func icon(_ id: String) -> ShowcaseIconAsset {
        let icon = GeneratedShowcaseProduct.icons.first(where: { $0.id == id })!
        precondition(icon.nativeSymbol == "ShowcaseVectorIcon")
        return icon
    }
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
            $0.componentTypeRef == "showcase.page-host" && $0.rendererId == "ShowcasePageHost" &&
                $0.profiles.contains(artifactId)
        }))
        precondition(GeneratedShowcaseProduct.nativeComponents.contains(where: {
            $0.componentTypeRef == "showcase.page-menu" && $0.rendererId == "ShowcasePageMenu" &&
                $0.profiles.contains(artifactId)
        }))
    }

    func route(_ pageRef: String) {
        precondition(artifact.pages.contains(where: { $0.pageRef == pageRef }))
        requireAction(componentId: .pageMenu, sourcePort: "page.menu.route", effect: "push")
        activePage = pageRef
        path.append(.page(pageRef))
    }

    func open(_ componentId: GeneratedShowcaseComponentId) {
        requireAction(componentId: componentId, sourcePort: "\(componentId.rawValue).open", effect: "dispatch")
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

    init() {
        let artifact = GeneratedShowcaseProduct.artifacts.first(where: {
            $0.rendererId == ShowcaseNativePlatform.rendererId
        })!
        let catalogNode = GeneratedShowcaseProduct.nodes.first(where: { $0.id == .catalog })!
        let navigationNode = GeneratedShowcaseProduct.nodes.first(where: { $0.id == .navigation })!
        catalog = ShowcaseCatalogSource(nodeTypeRef: catalogNode.typeRef, artifact: artifact)
        navigation = ShowcaseNavigationController(nodeTypeRef: navigationNode.typeRef, artifactId: artifact.id)
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
