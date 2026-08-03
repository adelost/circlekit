import Observation

protocol ShowcaseNativeBinding {
    var legoSpecId: String { get }
}

struct ShowcaseCatalogSource: ShowcaseNativeBinding {
    let legoSpecId: String
    let artifact: ShowcaseArtifact

    func tree(preferredSurface: String) -> ShowcaseTree {
        let trees = GeneratedShowcaseProduct.trees.filter { $0.artifactId == artifact.id }
        return trees.first(where: { $0.surface.rawValue == preferredSurface }) ?? trees[0]
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
    let legoSpecId: String
    var path: [GeneratedShowcaseComponentId] = []

    init(legoSpecId: String) {
        self.legoSpecId = legoSpecId
    }

    func open(_ componentId: GeneratedShowcaseComponentId) {
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
        let catalogMount = GeneratedShowcaseProduct.nativeMounts.first(where: { $0.id == .catalog })!
        let navigationMount = GeneratedShowcaseProduct.nativeMounts.first(where: { $0.id == .navigation })!
        catalog = ShowcaseCatalogSource(legoSpecId: catalogMount.legoSpecId, artifact: artifact)
        navigation = ShowcaseNavigationController(legoSpecId: navigationMount.legoSpecId)
        GeneratedShowcaseNativeMountId.allCases.forEach { _ = binding(for: $0) }
    }

    func binding(for id: GeneratedShowcaseNativeMountId) -> any ShowcaseNativeBinding {
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
