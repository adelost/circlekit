import Observation
import SwiftUI

struct ShowcaseRootView: View {
    @State private var environment = ShowcaseNativeEnvironment()

    var body: some View {
        @Bindable var navigation = environment.navigation
        NavigationStack(path: $navigation.path) {
            GeometryReader { geometry in
                let preferredSurface = ShowcaseNativePlatform.preferredSurface(width: geometry.size.width)
                let trees = environment.catalog.trees(preferredSurface: preferredSurface)
                let surface = trees[0].surface
                let metrics = ShowcaseLayoutMetrics(surface: surface)
                ScrollView {
                    LazyVStack(spacing: metrics.rowSpacing) {
                        ShowcaseHeader(artifact: environment.catalog.artifact, surface: surface)
                        ForEach(navigation.artifact.pages, id: \.pageRef) { page in
                            Button {
                                environment.emit(
                                    componentId: .pageMenu,
                                    sourcePortRef: "page.menu.route",
                                    payload: page.pageRef
                                )
                            } label: {
                                ShowcasePageMenuRow(pageRef: page.pageRef, metrics: metrics)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .frame(maxWidth: metrics.contentWidth)
                    .padding(.horizontal, metrics.horizontalPadding)
                    .padding(.vertical, metrics.verticalPadding)
                    .frame(maxWidth: .infinity)
                }
                .background(GeneratedShowcaseProduct.colors.surface)
            }
            .navigationDestination(for: ShowcaseNavigationDestination.self) { destination in
                switch destination {
                case .page(let pageRef):
                    ShowcasePageHostView(pageRef: pageRef, environment: environment)
                case .component(let id):
                    ShowcaseComponentScreen(mounted: environment.mountComponent(id), environment: environment)
                }
            }
        }
        .tint(GeneratedShowcaseProduct.colors.accent)
        .preferredColorScheme(.dark)
    }
}

private struct ShowcasePageHostView: View {
    let pageRef: String
    let environment: ShowcaseNativeEnvironment

    var body: some View {
        @Bindable var navigation = environment.navigation
        GeometryReader { geometry in
            let preferredSurface = ShowcaseNativePlatform.preferredSurface(width: geometry.size.width)
            let tree = environment.catalog.trees(preferredSurface: preferredSurface)
                .first(where: { $0.screenId == navigation.activePage })!
            let metrics = ShowcaseLayoutMetrics(surface: tree.surface)
            ScrollView {
                LazyVStack(spacing: metrics.rowSpacing) {
                    ShowcaseSectionHeader(screenId: tree.screenId)
                    ForEach(tree.mounts.sorted(by: { $0.order < $1.order })) { mount in
                        let component = environment.catalog.component(mount.componentId)
                        Button {
                            environment.emit(
                                componentId: .pageMenu,
                                sourcePortRef: "page.menu.\(component.openPort)",
                                payload: component.id
                            )
                        } label: {
                            ShowcaseMenuRow(
                                component: component,
                                icon: environment.catalog.icon(component.iconId),
                                metrics: metrics
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .frame(maxWidth: metrics.contentWidth)
                .padding(.horizontal, metrics.horizontalPadding)
                .padding(.vertical, metrics.verticalPadding)
                .frame(maxWidth: .infinity)
            }
            .background(GeneratedShowcaseProduct.colors.surface)
        }
        .navigationTitle(pageRef.replacingOccurrences(of: "section.", with: "").uppercased())
    }
}

private struct ShowcasePageMenuRow: View {
    let pageRef: String
    let metrics: ShowcaseLayoutMetrics

    var body: some View {
        HStack {
            Text(pageRef.replacingOccurrences(of: "section.", with: "").uppercased())
                .font(.system(size: 16, weight: .bold, design: .rounded))
                .foregroundStyle(GeneratedShowcaseProduct.colors.action)
            Spacer(minLength: 8)
            Text("›")
                .font(.system(size: 20, weight: .bold, design: .rounded))
                .foregroundStyle(GeneratedShowcaseProduct.colors.accent)
        }
        .padding(.horizontal, 16)
        .frame(minHeight: metrics.rowHeight)
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(GeneratedShowcaseProduct.colors.line, lineWidth: 1)
        }
        .contentShape(Rectangle())
    }
}

private struct ShowcaseSectionHeader: View {
    let screenId: String

    var body: some View {
        Text(screenId.replacingOccurrences(of: "section.", with: "").uppercased())
            .font(.system(size: 11, weight: .bold, design: .monospaced))
            .foregroundStyle(GeneratedShowcaseProduct.colors.muted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 8)
    }
}

private struct ShowcaseHeader: View {
    let artifact: ShowcaseArtifact
    let surface: GeneratedShowcaseSurface

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(GeneratedShowcaseProduct.productId.replacingOccurrences(of: "-", with: " ").uppercased())
                .font(.system(size: 25, weight: .black, design: .rounded))
            Text("\(artifact.id.rawValue.uppercased()) · \(surface.rawValue.uppercased())")
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundStyle(GeneratedShowcaseProduct.colors.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, 8)
    }
}

private struct ShowcaseMenuRow: View {
    let component: ShowcaseComponent
    let icon: ShowcaseIconAsset
    let metrics: ShowcaseLayoutMetrics

    var body: some View {
        HStack(spacing: 14) {
            Circle()
                .stroke(GeneratedShowcaseProduct.colors.accent, lineWidth: 2)
                .frame(width: 42, height: 42)
                .overlay {
                    ShowcaseVectorIcon(asset: icon, color: GeneratedShowcaseProduct.colors.accent)
                        .padding(10)
                }
            VStack(alignment: .leading, spacing: 3) {
                Text(component.title)
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundStyle(GeneratedShowcaseProduct.colors.action)
                Text(component.scenarios.first?.label ?? component.id.rawValue)
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundStyle(GeneratedShowcaseProduct.colors.muted)
            }
            Spacer(minLength: 8)
            Text("›")
                .font(.system(size: 20, weight: .bold, design: .rounded))
                .foregroundStyle(GeneratedShowcaseProduct.colors.accent)
        }
        .padding(.horizontal, 16)
        .frame(minHeight: metrics.rowHeight)
        .background(GeneratedShowcaseProduct.colors.surface)
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(GeneratedShowcaseProduct.colors.line, lineWidth: 1)
        }
        .contentShape(Rectangle())
    }
}

private struct ShowcaseComponentScreen: View {
    let mounted: ShowcaseMountedRenderer
    let environment: ShowcaseNativeEnvironment
    @State private var scenarioIndex = 0

    private var component: ShowcaseComponent { mounted.component }

    init(mounted: ShowcaseMountedRenderer, environment: ShowcaseNativeEnvironment) {
        self.mounted = mounted
        self.environment = environment
        _ = mounted.inputs.require("\(mounted.component.id.rawValue).catalog")
        _ = mounted.inputs.require("\(mounted.component.id.rawValue).navigation")
        if case .typed = mounted.emitter {
            _ = mounted.inputs.require("\(mounted.component.id.rawValue).renderer")
        }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                Circle()
                    .stroke(GeneratedShowcaseProduct.colors.accent.opacity(0.28), lineWidth: 12)
                    .overlay {
                        Circle()
                            .trim(from: 0, to: progress)
                            .stroke(
                                GeneratedShowcaseProduct.colors.accent,
                                style: StrokeStyle(lineWidth: 12, lineCap: .round)
                            )
                            .rotationEffect(.degrees(-90))
                    }
                    .frame(width: 180, height: 180)
                    .overlay {
                        VStack(spacing: 5) {
                            Text(component.title)
                                .font(.system(size: 19, weight: .black, design: .rounded))
                            Text(selectedScenario.label)
                                .font(.system(size: 10, weight: .semibold, design: .monospaced))
                                .foregroundStyle(GeneratedShowcaseProduct.colors.accent)
                        }
                        .multilineTextAlignment(.center)
                        .padding(26)
                    }
                Picker("Scenario", selection: $scenarioIndex) {
                    ForEach(Array(component.scenarios.enumerated()), id: \.offset) { index, scenario in
                        Text(scenario.label).tag(index)
                    }
                }
                .pickerStyle(.wheel)
                .frame(maxHeight: 170)
            }
            .padding(24)
            .frame(maxWidth: .infinity)
        }
        .background(GeneratedShowcaseProduct.colors.surface)
        .navigationTitle(component.title)
        .onChange(of: scenarioIndex) { _, next in
            guard case .typed = mounted.emitter else { return }
            environment.emit(
                componentId: component.id,
                sourcePortRef: "\(component.id.rawValue).action",
                payload: ["actionId": "scenario", "value": component.scenarios[next].id]
            )
        }
    }

    private var selectedScenario: ShowcaseScenario {
        component.scenarios[min(scenarioIndex, max(0, component.scenarios.count - 1))]
    }

    private var progress: CGFloat {
        guard component.scenarios.count > 1 else { return 1 }
        return CGFloat(scenarioIndex + 1) / CGFloat(component.scenarios.count)
    }
}

struct ShowcaseLayoutMetrics {
    let contentWidth: CGFloat
    let horizontalPadding: CGFloat
    let verticalPadding: CGFloat
    let rowHeight: CGFloat
    let rowSpacing: CGFloat

    init(surface: GeneratedShowcaseSurface) {
        switch surface {
        case .round:
            contentWidth = 205
            horizontalPadding = 10
            verticalPadding = 12
            rowHeight = 58
            rowSpacing = 8
        case .compact:
            contentWidth = 520
            horizontalPadding = 20
            verticalPadding = 24
            rowHeight = 68
            rowSpacing = 12
        case .wide:
            contentWidth = 760
            horizontalPadding = 24
            verticalPadding = 28
            rowHeight = 72
            rowSpacing = 12
        }
    }
}
