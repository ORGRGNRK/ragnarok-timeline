// swift-tools-version: 5.10
import PackageDescription
let package = Package(name: "RagnarokTimeline", platforms: [.macOS(.v14)], products: [
    .executable(name: "RagnarokTimeline", targets: ["RagnarokTimeline"])
], targets: [
    .target(name: "TimelineCore"),
    .executableTarget(name: "RagnarokTimeline", dependencies: ["TimelineCore"]),
    .testTarget(name: "TimelineCoreTests", dependencies: ["TimelineCore"])
])
