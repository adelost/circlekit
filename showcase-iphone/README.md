# CircleKit Showcase · iPhone PoC

This is a non-shipping SwiftUI portability proof for iPhone and watchOS. The generated
`Sources/Generated/GeneratedShowcaseProduct.swift` consumes the same compiled
CircleKit Showcase ProductSpec and output manifest as the Android hosts.

The TypeScript emitter chooses the artifact served by each native SwiftUI
renderer binding. Their entry screens, supported surfaces, component
identity/order, default palette, scenarios, ports and native Lego mounts all
come from compiled product data. Swift owns only responsive layout, rendering
and exhaustive native implementations for the generated Lego mount IDs. Icon
geometry comes from the injected CircleKit asset catalog; no SF Symbol mapping
duplicates the product icons.

On a Mac with Xcode and XcodeGen:

```sh
npm --prefix showcase-product run generate
cd showcase-iphone
xcodegen generate
xcodebuild -project CircleKitShowcase.xcodeproj \
  -scheme CircleKitShowcase \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' build
xcodebuild -project CircleKitShowcase.xcodeproj \
  -scheme CircleKitShowcaseWatch \
  -destination 'platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)' build
```

An iPhone and watchOS generated-source build plus one SwiftUI simulator smoke
are required before this PoC can be called complete.
