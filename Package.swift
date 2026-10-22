// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "TrackerThings",
    platforms: [
        .iOS(.v18),
    ],
    products: [
        .library(
            name: "TrackerThings",
            targets: ["TrackerThings"]
        ),
    ],
    targets: [
        .target(
            name: "TrackerThings",
            path: "Sources/TrackerThings",
            resources: [
                .process("Resources")
            ]
        ),
        .testTarget(
            name: "TrackerThingsTests",
            dependencies: ["TrackerThings"],
            path: "tests/TrackerThingsTests"
        ),
    ]
)
