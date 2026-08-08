import Observation

protocol ShowcaseNativeBinding {
    var serviceTypeRef: String { get }
}

struct ShowcaseCatalogSource: ShowcaseNativeBinding {
    let serviceTypeRef: String
    let artifact: ShowcaseArtifact

    func trees(preferredSurface: String) -> [ShowcaseTree] {
        let scoped = GeneratedShowcaseProduct.trees.filter {
            $0.artifactId == artifact.id && $0.surface.rawValue == preferredSurface
        }
        precondition(!scoped.isEmpty, "Product IR has no artifact scope for the selected surface")
        return artifact.screenRefs.compactMap { screen in scoped.first(where: { $0.screenId == screen }) }
    }

    func component(_ id: GeneratedShowcaseComponentId) -> ShowcaseComponent {
        GeneratedShowcaseProduct.components.first(where: { $0.id == id })!
    }

    func icon(_ id: String) -> ShowcaseIconAsset {
        GeneratedShowcaseProduct.icons.first(where: { $0.id == id })!
    }
}

@MainActor
@Observable
final class ShowcaseNavigationController: ShowcaseNativeBinding {
    let serviceTypeRef: String
    var path: [GeneratedShowcaseComponentId] = []

    init(serviceTypeRef: String) {
        self.serviceTypeRef = serviceTypeRef
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
        let catalogService = GeneratedShowcaseProduct.services.first(where: { $0.id == .catalog })!
        let navigationService = GeneratedShowcaseProduct.services.first(where: { $0.id == .navigation })!
        catalog = ShowcaseCatalogSource(serviceTypeRef: catalogService.typeRef, artifact: artifact)
        navigation = ShowcaseNavigationController(serviceTypeRef: navigationService.typeRef)
        GeneratedShowcaseServiceId.allCases.forEach { _ = binding(for: $0) }
    }

    func binding(for id: GeneratedShowcaseServiceId) -> any ShowcaseNativeBinding {
        switch id {
        case .catalog: catalog
        case .navigation: navigation
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
