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
    var path: [GeneratedShowcaseComponentId] = []

    init(nodeTypeRef: String) {
        self.nodeTypeRef = nodeTypeRef
    }

    func open(_ componentId: GeneratedShowcaseComponentId) {
        precondition(
            GeneratedShowcaseProduct.portBindings.contains(where: {
                $0.kind == "component-event" &&
                    $0.from.rawValue == "\(componentId.rawValue).open" &&
                    $0.to.rawValue.hasPrefix("navigation.")
            }),
            "Product IR has no navigation event binding for \(componentId.rawValue)"
        )
        path.append(componentId)
    }
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
        navigation = ShowcaseNavigationController(nodeTypeRef: navigationNode.typeRef)
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
