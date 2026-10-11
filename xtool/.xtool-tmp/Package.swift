// swift-tools-version: 6.0
import PackageDescription
let package = Package(
    name: "TrackerThings-Builder",
    platforms: [
        .iOS("18.0"),
    ],
    dependencies: [
        .package(name: "RootPackage", path: "../.."),
    ],
    targets: [
        .executableTarget(
    name: "TrackerThings-App",
    dependencies: [
        .product(name: "TrackerThings", package: "RootPackage"),
    ],
    linkerSettings: [
    .unsafeFlags([
        "-Xlinker", "-rpath", "-Xlinker", "@executable_path/Frameworks",
    ]),
]
)
    ]
)
