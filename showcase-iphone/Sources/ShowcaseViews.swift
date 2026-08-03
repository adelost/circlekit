import Observation
import SwiftUI

struct ShowcaseRootView: View {
    @State private var environment = ShowcaseNativeEnvironment()

    var body: some View {
        @Bindable var navigation = environment.navigation
        NavigationStack(path: $navigation.path) {
            GeometryReader { geometry in
                let preferredSurface = ShowcaseNativePlatform.preferredSurface(width: geometry.size.width)
                let tree = environment.catalog.tree(preferredSurface: preferredSurface)
                let metrics = ShowcaseLayoutMetrics(surface: tree.surface)
                ScrollView {
                    LazyVStack(spacing: metrics.rowSpacing) {
                        ShowcaseHeader(artifact: environment.catalog.artifact, surface: tree.surface)
                        ForEach(tree.mounts.sorted(by: { $0.order < $1.order })) { mount in
                            let component = environment.catalog.component(mount.componentId)
                            Button { navigation.open(component.id) } label: {
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
                .background(Color.black)
            }
            .navigationDestination(for: GeneratedShowcaseComponentId.self) { id in
                ShowcaseComponentScreen(component: environment.catalog.component(id))
            }
        }
        .tint(GeneratedShowcaseProduct.palette.accent)
        .preferredColorScheme(.dark)
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
                .foregroundStyle(.secondary)
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
                .stroke(GeneratedShowcaseProduct.palette.accent, lineWidth: 2)
                .frame(width: 42, height: 42)
                .overlay {
                    ShowcaseVectorIcon(asset: icon, color: GeneratedShowcaseProduct.palette.accent)
                        .padding(10)
                }
            VStack(alignment: .leading, spacing: 3) {
                Text(component.title)
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                Text(component.scenarios.first?.label ?? component.id.rawValue)
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(GeneratedShowcaseProduct.palette.accent)
        }
        .padding(.horizontal, 16)
        .frame(minHeight: metrics.rowHeight)
        .background(Color.black)
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.white.opacity(0.24), lineWidth: 1)
        }
        .contentShape(Rectangle())
    }
}

private struct ShowcaseComponentScreen: View {
    let component: ShowcaseComponent
    @State private var scenarioIndex = 0

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                Circle()
                    .stroke(GeneratedShowcaseProduct.palette.accent.opacity(0.28), lineWidth: 12)
                    .overlay {
                        Circle()
                            .trim(from: 0, to: progress)
                            .stroke(
                                GeneratedShowcaseProduct.palette.accent,
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
                                .foregroundStyle(GeneratedShowcaseProduct.palette.accent)
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
        .background(Color.black)
        .navigationTitle(component.title)
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
