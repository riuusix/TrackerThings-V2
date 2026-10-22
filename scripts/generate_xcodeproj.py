import os
import hashlib

def make_uuid(name: str) -> str:
    # PBX UUIDs are 24-character hexadecimal strings
    return hashlib.md5(name.encode('utf-8')).hexdigest()[:24].upper()

def generate_project(repo_root: str):
    sources_dir = os.path.join(repo_root, "Sources", "TrackerThings")
    
    # 1. Collect all Swift files relative to repo_root
    swift_files = []
    for root, dirs, files in os.walk(sources_dir):
        dirs.sort()
        for f in sorted(files):
            if f.endswith(".swift"):
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, repo_root).replace("\\", "/")
                swift_files.append(rel_path)

    print(f"Discovered {len(swift_files)} Swift source files.")

    # Asset catalog and Info.plist
    assets_rel = "xtool/assets/Assets.xcassets"
    infoplist_rel = "xtool/assets/Info.plist"
    loaders_rel = "xtool/assets/Loaders"

    # UUIDs
    proj_uuid = make_uuid("PROJECT_ROOT")
    target_uuid = make_uuid("TARGET_TrackerThings")
    config_list_proj_uuid = make_uuid("CONFIG_LIST_PROJ")
    config_list_target_uuid = make_uuid("CONFIG_LIST_TARGET")
    
    cfg_proj_debug_uuid = make_uuid("CFG_PROJ_DEBUG")
    cfg_proj_release_uuid = make_uuid("CFG_PROJ_RELEASE")
    cfg_target_debug_uuid = make_uuid("CFG_TARGET_DEBUG")
    cfg_target_release_uuid = make_uuid("CFG_TARGET_RELEASE")

    main_group_uuid = make_uuid("GROUP_MAIN")
    sources_root_group_uuid = make_uuid("GROUP_Sources")
    products_group_uuid = make_uuid("GROUP_Products")
    xtool_group_uuid = make_uuid("GROUP_xtool")
    xtool_assets_group_uuid = make_uuid("GROUP_xtool_assets")

    sources_phase_uuid = make_uuid("PHASE_SOURCES")
    frameworks_phase_uuid = make_uuid("PHASE_FRAMEWORKS")
    resources_phase_uuid = make_uuid("PHASE_RESOURCES")
    product_app_uuid = make_uuid("PRODUCT_APP_TrackerThings")

    file_refs = {}
    build_files = {}

    for sf in swift_files:
        f_uuid = make_uuid(f"FILE_{sf}")
        bf_uuid = make_uuid(f"BUILDFILE_{sf}")
        file_refs[sf] = f_uuid
        build_files[sf] = bf_uuid

    assets_file_uuid = make_uuid(f"FILE_{assets_rel}")
    assets_build_uuid = make_uuid(f"BUILDFILE_{assets_rel}")
    infoplist_file_uuid = make_uuid(f"FILE_{infoplist_rel}")
    loaders_file_uuid = make_uuid(f"FILE_{loaders_rel}")
    loaders_build_uuid = make_uuid(f"BUILDFILE_{loaders_rel}")

    # Build PBX objects
    pbx_objects = []

    # 1. PBXBuildFile section
    pbx_objects.append("/* Begin PBXBuildFile section */")
    for sf in swift_files:
        basename = os.path.basename(sf)
        pbx_objects.append(f"\t\t{build_files[sf]} /* {basename} in Sources */ = {{isa = PBXBuildFile; fileRef = {file_refs[sf]} /* {basename} */; }};")
    pbx_objects.append(f"\t\t{assets_build_uuid} /* Assets.xcassets in Resources */ = {{isa = PBXBuildFile; fileRef = {assets_file_uuid} /* Assets.xcassets */; }};")
    pbx_objects.append(f"\t\t{loaders_build_uuid} /* Loaders in Resources */ = {{isa = PBXBuildFile; fileRef = {loaders_file_uuid} /* Loaders */; }};")
    pbx_objects.append("/* End PBXBuildFile section */\n")

    # 2. PBXFileReference section
    pbx_objects.append("/* Begin PBXFileReference section */")
    pbx_objects.append(f"\t\t{product_app_uuid} /* TrackerThings.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = TrackerThings.app; sourceTree = BUILT_PRODUCTS_DIR; }};")
    for sf in swift_files:
        basename = os.path.basename(sf)
        pbx_objects.append(f"\t\t{file_refs[sf]} /* {basename} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {basename}; sourceTree = \"<group>\"; }};")
    pbx_objects.append(f"\t\t{assets_file_uuid} /* Assets.xcassets */ = {{isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = \"<group>\"; }};")
    pbx_objects.append(f"\t\t{infoplist_file_uuid} /* Info.plist */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = \"<group>\"; }};")
    pbx_objects.append(f"\t\t{loaders_file_uuid} /* Loaders */ = {{isa = PBXFileReference; lastKnownFileType = folder; path = Loaders; sourceTree = \"<group>\"; }};")
    pbx_objects.append("/* End PBXFileReference section */\n")

    # 3. PBXFrameworksBuildPhase section
    pbx_objects.append("/* Begin PBXFrameworksBuildPhase section */")
    pbx_objects.append(f"\t\t{frameworks_phase_uuid} /* Frameworks */ = {{")
    pbx_objects.append("\t\t\tisa = PBXFrameworksBuildPhase;")
    pbx_objects.append("\t\t\tbuildActionMask = 2147483647;")
    pbx_objects.append("\t\t\tfiles = (")
    pbx_objects.append("\t\t\t);")
    pbx_objects.append("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    pbx_objects.append("\t\t};")
    pbx_objects.append("/* End PBXFrameworksBuildPhase section */\n")

    # 4. Group hierarchy construction
    dir_groups = {}
    all_dirs = set()
    for sf in swift_files:
        d = os.path.dirname(sf)
        all_dirs.add(d)

    for d in list(all_dirs):
        curr = d
        while curr and curr != "Sources/TrackerThings":
            curr = os.path.dirname(curr)
            if curr:
                all_dirs.add(curr)

    for d in all_dirs:
        dir_groups[d] = make_uuid(f"GROUP_{d}")

    pbx_objects.append("/* Begin PBXGroup section */")
    
    # Main group
    pbx_objects.append(f"\t\t{main_group_uuid} = {{")
    pbx_objects.append("\t\t\tisa = PBXGroup;")
    pbx_objects.append("\t\t\tchildren = (")
    pbx_objects.append(f"\t\t\t\t{sources_root_group_uuid} /* Sources */,")
    pbx_objects.append(f"\t\t\t\t{xtool_group_uuid} /* xtool */,")
    pbx_objects.append(f"\t\t\t\t{products_group_uuid} /* Products */,")
    pbx_objects.append("\t\t\t);")
    pbx_objects.append("\t\t\tsourceTree = \"<group>\";")
    pbx_objects.append("\t\t};")

    # Products group
    pbx_objects.append(f"\t\t{products_group_uuid} /* Products */ = {{")
    pbx_objects.append("\t\t\tisa = PBXGroup;")
    pbx_objects.append("\t\t\tchildren = (")
    pbx_objects.append(f"\t\t\t\t{product_app_uuid} /* TrackerThings.app */,")
    pbx_objects.append("\t\t\t);")
    pbx_objects.append("\t\t\tname = Products;")
    pbx_objects.append("\t\t\tsourceTree = \"<group>\";")
    pbx_objects.append("\t\t};")

    # xtool group
    pbx_objects.append(f"\t\t{xtool_group_uuid} /* xtool */ = {{")
    pbx_objects.append("\t\t\tisa = PBXGroup;")
    pbx_objects.append("\t\t\tchildren = (")
    pbx_objects.append(f"\t\t\t\t{xtool_assets_group_uuid} /* assets */,")
    pbx_objects.append("\t\t\t);")
    pbx_objects.append("\t\t\tpath = xtool;")
    pbx_objects.append("\t\t\tsourceTree = \"<group>\";")
    pbx_objects.append("\t\t};")

    # xtool/assets group
    pbx_objects.append(f"\t\t{xtool_assets_group_uuid} /* assets */ = {{")
    pbx_objects.append("\t\t\tisa = PBXGroup;")
    pbx_objects.append("\t\t\tchildren = (")
    pbx_objects.append(f"\t\t\t\t{assets_file_uuid} /* Assets.xcassets */,")
    pbx_objects.append(f"\t\t\t\t{infoplist_file_uuid} /* Info.plist */,")
    pbx_objects.append(f"\t\t\t\t{loaders_file_uuid} /* Loaders */,")
    pbx_objects.append("\t\t\t);")
    pbx_objects.append("\t\t\tpath = assets;")
    pbx_objects.append("\t\t\tsourceTree = \"<group>\";")
    pbx_objects.append("\t\t};")

    # Sources group
    pbx_objects.append(f"\t\t{sources_root_group_uuid} /* Sources */ = {{")
    pbx_objects.append("\t\t\tisa = PBXGroup;")
    pbx_objects.append("\t\t\tchildren = (")
    pbx_objects.append(f"\t\t\t\t{dir_groups['Sources/TrackerThings']} /* TrackerThings */,")
    pbx_objects.append("\t\t\t);")
    pbx_objects.append("\t\t\tpath = Sources;")
    pbx_objects.append("\t\t\tsourceTree = \"<group>\";")
    pbx_objects.append("\t\t};")

    # Groups for all directories inside Sources/TrackerThings
    for d in sorted(all_dirs):
        g_uuid = dir_groups[d]
        basename = os.path.basename(d)
        
        subdirs = [sd for sd in all_dirs if os.path.dirname(sd) == d]
        subdirs.sort()

        files_in_d = [sf for sf in swift_files if os.path.dirname(sf) == d]
        files_in_d.sort()

        children = []
        for sd in subdirs:
            children.append(f"{dir_groups[sd]} /* {os.path.basename(sd)} */")
        for sf in files_in_d:
            children.append(f"{file_refs[sf]} /* {os.path.basename(sf)} */")

        pbx_objects.append(f"\t\t{g_uuid} /* {basename} */ = {{")
        pbx_objects.append("\t\t\tisa = PBXGroup;")
        pbx_objects.append("\t\t\tchildren = (")
        for ch in children:
            pbx_objects.append(f"\t\t\t\t{ch},")
        pbx_objects.append("\t\t\t);")
        pbx_objects.append(f"\t\t\tpath = {basename};")
        pbx_objects.append("\t\t\tsourceTree = \"<group>\";")
        pbx_objects.append("\t\t};")

    pbx_objects.append("/* End PBXGroup section */\n")

    # 5. PBXNativeTarget section
    pbx_objects.append("/* Begin PBXNativeTarget section */")
    pbx_objects.append(f"\t\t{target_uuid} /* TrackerThings */ = {{")
    pbx_objects.append("\t\t\tisa = PBXNativeTarget;")
    pbx_objects.append(f"\t\t\tbuildConfigurationList = {config_list_target_uuid} /* Build configuration list for PBXNativeTarget \"TrackerThings\" */;")
    pbx_objects.append("\t\t\tbuildPhases = (")
    pbx_objects.append(f"\t\t\t\t{sources_phase_uuid} /* Sources */,")
    pbx_objects.append(f"\t\t\t\t{frameworks_phase_uuid} /* Frameworks */,")
    pbx_objects.append(f"\t\t\t\t{resources_phase_uuid} /* Resources */,")
    pbx_objects.append("\t\t\t);")
    pbx_objects.append("\t\t\tbuildRules = (")
    pbx_objects.append("\t\t\t);")
    pbx_objects.append("\t\t\tdependencies = (")
    pbx_objects.append("\t\t\t);")
    pbx_objects.append("\t\t\tname = TrackerThings;")
    pbx_objects.append("\t\t\tproductName = TrackerThings;")
    pbx_objects.append(f"\t\t\tproductReference = {product_app_uuid} /* TrackerThings.app */;")
    pbx_objects.append("\t\t\tproductType = \"com.apple.product-type.application\";")
    pbx_objects.append("\t\t};")
    pbx_objects.append("/* End PBXNativeTarget section */\n")

    # 6. PBXProject section
    pbx_objects.append("/* Begin PBXProject section */")
    pbx_objects.append(f"\t\t{proj_uuid} /* Project object */ = {{")
    pbx_objects.append("\t\t\tisa = PBXProject;")
    pbx_objects.append("\t\t\tattributes = {")
    pbx_objects.append("\t\t\t\tBuildIndependentTargetsInParallel = 1;")
    pbx_objects.append("\t\t\t\tLastSwiftUpdateCheck = 1600;")
    pbx_objects.append("\t\t\t\tLastUpgradeCheck = 1600;")
    pbx_objects.append("\t\t\t\tTargetAttributes = {")
    pbx_objects.append(f"\t\t\t\t\t{target_uuid} = {{")
    pbx_objects.append("\t\t\t\t\t\tCreatedOnToolsVersion = 16.0;")
    pbx_objects.append("\t\t\t\t\t};")
    pbx_objects.append("\t\t\t\t};")
    pbx_objects.append("\t\t\t};")
    pbx_objects.append(f"\t\t\tbuildConfigurationList = {config_list_proj_uuid} /* Build configuration list for PBXProject \"TrackerThings\" */;")
    pbx_objects.append("\t\t\tcompatibilityVersion = \"Xcode 14.0\";")
    pbx_objects.append("\t\t\tdevelopmentRegion = en;")
    pbx_objects.append("\t\t\thasScannedForEncodings = 0;")
    pbx_objects.append("\t\t\tknownRegions = (")
    pbx_objects.append("\t\t\t\ten,")
    pbx_objects.append("\t\t\t\tBase,")
    pbx_objects.append("\t\t\t);")
    pbx_objects.append(f"\t\t\tmainGroup = {main_group_uuid};")
    pbx_objects.append(f"\t\t\tproductRefGroup = {products_group_uuid} /* Products */;")
    pbx_objects.append("\t\t\tprojectDirPath = \"\";")
    pbx_objects.append("\t\t\tprojectRoot = \"\";")
    pbx_objects.append("\t\t\ttargets = (")
    pbx_objects.append(f"\t\t\t\t{target_uuid} /* TrackerThings */,")
    pbx_objects.append("\t\t\t);")
    pbx_objects.append("\t\t};")
    pbx_objects.append("/* End PBXProject section */\n")

    # 7. PBXResourcesBuildPhase section
    pbx_objects.append("/* Begin PBXResourcesBuildPhase section */")
    pbx_objects.append(f"\t\t{resources_phase_uuid} /* Resources */ = {{")
    pbx_objects.append("\t\t\tisa = PBXResourcesBuildPhase;")
    pbx_objects.append("\t\t\tbuildActionMask = 2147483647;")
    pbx_objects.append("\t\t\tfiles = (")
    pbx_objects.append(f"\t\t\t\t{assets_build_uuid} /* Assets.xcassets in Resources */,")
    pbx_objects.append(f"\t\t\t\t{loaders_build_uuid} /* Loaders in Resources */,")
    pbx_objects.append("\t\t\t);")
    pbx_objects.append("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    pbx_objects.append("\t\t};")
    pbx_objects.append("/* End PBXResourcesBuildPhase section */\n")

    # 8. PBXSourcesBuildPhase section
    pbx_objects.append("/* Begin PBXSourcesBuildPhase section */")
    pbx_objects.append(f"\t\t{sources_phase_uuid} /* Sources */ = {{")
    pbx_objects.append("\t\t\tisa = PBXSourcesBuildPhase;")
    pbx_objects.append("\t\t\tbuildActionMask = 2147483647;")
    pbx_objects.append("\t\t\tfiles = (")
    for sf in swift_files:
        pbx_objects.append(f"\t\t\t\t{build_files[sf]} /* {os.path.basename(sf)} in Sources */,")
    pbx_objects.append("\t\t\t);")
    pbx_objects.append("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    pbx_objects.append("\t\t};")
    pbx_objects.append("/* End PBXSourcesBuildPhase section */\n")

    # 9. XCBuildConfiguration section
    pbx_objects.append("/* Begin XCBuildConfiguration section */")
    
    # Project Debug
    pbx_objects.append(f"\t\t{cfg_proj_debug_uuid} /* Debug */ = {{")
    pbx_objects.append("\t\t\tisa = XCBuildConfiguration;")
    pbx_objects.append("\t\t\tbuildSettings = {")
    pbx_objects.append("\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;")
    pbx_objects.append("\t\t\t\tCLANG_ANALYZER_NONNULL = YES;")
    pbx_objects.append("\t\t\t\tCLANG_ANALYZER_NUMBER_OBJECT_CONVERSION = YES_AGGRESSIVE;")
    pbx_objects.append("\t\t\t\tCLANG_CXX_LANGUAGE_STANDARD = \"gnu++20\";")
    pbx_objects.append("\t\t\t\tCLANG_ENABLE_MODULES = YES;")
    pbx_objects.append("\t\t\t\tCLANG_ENABLE_OBJC_ARC = YES;")
    pbx_objects.append("\t\t\t\tCLANG_ENABLE_OBJC_WEAK = YES;")
    pbx_objects.append("\t\t\t\tCOPY_PHASE_STRIP = NO;")
    pbx_objects.append("\t\t\t\tDEBUG_INFORMATION_FORMAT = dwarf;")
    pbx_objects.append("\t\t\t\tENABLE_STRICT_OBJC_MSGSEND = YES;")
    pbx_objects.append("\t\t\t\tENABLE_TESTABILITY = YES;")
    pbx_objects.append("\t\t\t\tGCC_DYNAMIC_NO_PIC = NO;")
    pbx_objects.append("\t\t\t\tGCC_NO_COMMON_BLOCKS = YES;")
    pbx_objects.append("\t\t\t\tGCC_OPTIMIZATION_LEVEL = 0;")
    pbx_objects.append("\t\t\t\tGCC_PREPROCESSOR_DEFINITIONS = (")
    pbx_objects.append("\t\t\t\t\t\"DEBUG=1\",")
    pbx_objects.append("\t\t\t\t\t\"$(inherited)\",")
    pbx_objects.append("\t\t\t\t);")
    pbx_objects.append("\t\t\t\tGCC_WARN_64_TO_32_BIT_CONVERSION = YES;")
    pbx_objects.append("\t\t\t\tGCC_WARN_ABOUT_RETURN_TYPE = YES_ERROR;")
    pbx_objects.append("\t\t\t\tGCC_WARN_UNDECLARED_SELECTOR = YES;")
    pbx_objects.append("\t\t\t\tGCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;")
    pbx_objects.append("\t\t\t\tGCC_WARN_UNUSED_FUNCTION = YES;")
    pbx_objects.append("\t\t\t\tGCC_WARN_UNUSED_VARIABLE = YES;")
    pbx_objects.append("\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 18.0;")
    pbx_objects.append("\t\t\t\tMTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;")
    pbx_objects.append("\t\t\t\tMTL_FAST_MATH = YES;")
    pbx_objects.append("\t\t\t\tONLY_ACTIVE_ARCH = YES;")
    pbx_objects.append("\t\t\t\tSDKROOT = iphoneos;")
    pbx_objects.append("\t\t\t\tSWIFT_ACTIVE_COMPILATION_CONDITIONS = \"DEBUG $(inherited)\";")
    pbx_objects.append("\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = \"-Onone\";")
    pbx_objects.append("\t\t\t};")
    pbx_objects.append("\t\t\tname = Debug;")
    pbx_objects.append("\t\t};")

    # Project Release
    pbx_objects.append(f"\t\t{cfg_proj_release_uuid} /* Release */ = {{")
    pbx_objects.append("\t\t\tisa = XCBuildConfiguration;")
    pbx_objects.append("\t\t\tbuildSettings = {")
    pbx_objects.append("\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;")
    pbx_objects.append("\t\t\t\tCLANG_ANALYZER_NONNULL = YES;")
    pbx_objects.append("\t\t\t\tCLANG_ANALYZER_NUMBER_OBJECT_CONVERSION = YES_AGGRESSIVE;")
    pbx_objects.append("\t\t\t\tCLANG_CXX_LANGUAGE_STANDARD = \"gnu++20\";")
    pbx_objects.append("\t\t\t\tCLANG_ENABLE_MODULES = YES;")
    pbx_objects.append("\t\t\t\tCLANG_ENABLE_OBJC_ARC = YES;")
    pbx_objects.append("\t\t\t\tCLANG_ENABLE_OBJC_WEAK = YES;")
    pbx_objects.append("\t\t\t\tCOPY_PHASE_STRIP = NO;")
    pbx_objects.append("\t\t\t\tDEBUG_INFORMATION_FORMAT = \"dwarf-with-dsym\";")
    pbx_objects.append("\t\t\t\tENABLE_NS_ASSERTIONS = NO;")
    pbx_objects.append("\t\t\t\tENABLE_STRICT_OBJC_MSGSEND = YES;")
    pbx_objects.append("\t\t\t\tGCC_NO_COMMON_BLOCKS = YES;")
    pbx_objects.append("\t\t\t\tGCC_WARN_64_TO_32_BIT_CONVERSION = YES;")
    pbx_objects.append("\t\t\t\tGCC_WARN_ABOUT_RETURN_TYPE = YES_ERROR;")
    pbx_objects.append("\t\t\t\tGCC_WARN_UNDECLARED_SELECTOR = YES;")
    pbx_objects.append("\t\t\t\tGCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;")
    pbx_objects.append("\t\t\t\tGCC_WARN_UNUSED_FUNCTION = YES;")
    pbx_objects.append("\t\t\t\tGCC_WARN_UNUSED_VARIABLE = YES;")
    pbx_objects.append("\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 18.0;")
    pbx_objects.append("\t\t\t\tMTL_ENABLE_DEBUG_INFO = NO;")
    pbx_objects.append("\t\t\t\tMTL_FAST_MATH = YES;")
    pbx_objects.append("\t\t\t\tSDKROOT = iphoneos;")
    pbx_objects.append("\t\t\t\tSWIFT_COMPILATION_MODE = \"wholemodule\";")
    pbx_objects.append("\t\t\t\tVALIDATE_PRODUCT = YES;")
    pbx_objects.append("\t\t\t};")
    pbx_objects.append("\t\t\tname = Release;")
    pbx_objects.append("\t\t};")

    # Target Debug
    pbx_objects.append(f"\t\t{cfg_target_debug_uuid} /* Debug */ = {{")
    pbx_objects.append("\t\t\tisa = XCBuildConfiguration;")
    pbx_objects.append("\t\t\tbuildSettings = {")
    pbx_objects.append("\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;")
    pbx_objects.append("\t\t\t\tCODE_SIGN_STYLE = Automatic;")
    pbx_objects.append("\t\t\t\tCURRENT_PROJECT_VERSION = 1;")
    pbx_objects.append("\t\t\t\tENABLE_PREVIEWS = YES;")
    pbx_objects.append("\t\t\t\tGENERATE_INFOPLIST_FILE = NO;")
    pbx_objects.append("\t\t\t\tINFOPLIST_FILE = xtool/assets/Info.plist;")
    pbx_objects.append("\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 18.0;")
    pbx_objects.append("\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (")
    pbx_objects.append("\t\t\t\t\t\"$(inherited)\",")
    pbx_objects.append("\t\t\t\t\t\"@executable_path/Frameworks\",")
    pbx_objects.append("\t\t\t\t);")
    pbx_objects.append("\t\t\t\tMARKETING_VERSION = 1.0.0;")
    pbx_objects.append("\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.trackerthings.app;")
    pbx_objects.append("\t\t\t\tPRODUCT_NAME = \"$(TARGET_NAME)\";")
    pbx_objects.append("\t\t\t\tSUPPORTED_PLATFORMS = \"iphoneos iphonesimulator\";")
    pbx_objects.append("\t\t\t\tSUPPORTS_MACCATALYST = NO;")
    pbx_objects.append("\t\t\t\tSUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD = NO;")
    pbx_objects.append("\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;")
    pbx_objects.append("\t\t\t\tSWIFT_VERSION = 6.0;")
    pbx_objects.append("\t\t\t\tTARGETED_DEVICE_FAMILY = \"1,2\";")
    pbx_objects.append("\t\t\t};")
    pbx_objects.append("\t\t\tname = Debug;")
    pbx_objects.append("\t\t};")

    # Target Release
    pbx_objects.append(f"\t\t{cfg_target_release_uuid} /* Release */ = {{")
    pbx_objects.append("\t\t\tisa = XCBuildConfiguration;")
    pbx_objects.append("\t\t\tbuildSettings = {")
    pbx_objects.append("\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;")
    pbx_objects.append("\t\t\t\tCODE_SIGN_STYLE = Automatic;")
    pbx_objects.append("\t\t\t\tCURRENT_PROJECT_VERSION = 1;")
    pbx_objects.append("\t\t\t\tENABLE_PREVIEWS = YES;")
    pbx_objects.append("\t\t\t\tGENERATE_INFOPLIST_FILE = NO;")
    pbx_objects.append("\t\t\t\tINFOPLIST_FILE = xtool/assets/Info.plist;")
    pbx_objects.append("\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 18.0;")
    pbx_objects.append("\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (")
    pbx_objects.append("\t\t\t\t\t\"$(inherited)\",")
    pbx_objects.append("\t\t\t\t\t\"@executable_path/Frameworks\",")
    pbx_objects.append("\t\t\t\t);")
    pbx_objects.append("\t\t\t\tMARKETING_VERSION = 1.0.0;")
    pbx_objects.append("\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.trackerthings.app;")
    pbx_objects.append("\t\t\t\tPRODUCT_NAME = \"$(TARGET_NAME)\";")
    pbx_objects.append("\t\t\t\tSUPPORTED_PLATFORMS = \"iphoneos iphonesimulator\";")
    pbx_objects.append("\t\t\t\tSUPPORTS_MACCATALYST = NO;")
    pbx_objects.append("\t\t\t\tSUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD = NO;")
    pbx_objects.append("\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;")
    pbx_objects.append("\t\t\t\tSWIFT_VERSION = 6.0;")
    pbx_objects.append("\t\t\t\tTARGETED_DEVICE_FAMILY = \"1,2\";")
    pbx_objects.append("\t\t\t};")
    pbx_objects.append("\t\t\tname = Release;")
    pbx_objects.append("\t\t};")
    pbx_objects.append("/* End XCBuildConfiguration section */\n")

    # 10. XCConfigurationList section
    pbx_objects.append("/* Begin XCConfigurationList section */")
    pbx_objects.append(f"\t\t{config_list_proj_uuid} /* Build configuration list for PBXProject \"TrackerThings\" */ = {{")
    pbx_objects.append("\t\t\tisa = XCConfigurationList;")
    pbx_objects.append("\t\t\tbuildConfigurations = (")
    pbx_objects.append(f"\t\t\t\t{cfg_proj_debug_uuid} /* Debug */,")
    pbx_objects.append(f"\t\t\t\t{cfg_proj_release_uuid} /* Release */,")
    pbx_objects.append("\t\t\t);")
    pbx_objects.append("\t\t\tdefaultConfigurationIsVisible = 0;")
    pbx_objects.append("\t\t\tdefaultConfigurationName = Release;")
    pbx_objects.append("\t\t};")

    pbx_objects.append(f"\t\t{config_list_target_uuid} /* Build configuration list for PBXNativeTarget \"TrackerThings\" */ = {{")
    pbx_objects.append("\t\t\tisa = XCConfigurationList;")
    pbx_objects.append("\t\t\tbuildConfigurations = (")
    pbx_objects.append(f"\t\t\t\t{cfg_target_debug_uuid} /* Debug */,")
    pbx_objects.append(f"\t\t\t\t{cfg_target_release_uuid} /* Release */,")
    pbx_objects.append("\t\t\t);")
    pbx_objects.append("\t\t\tdefaultConfigurationIsVisible = 0;")
    pbx_objects.append("\t\t\tdefaultConfigurationName = Release;")
    pbx_objects.append("\t\t};")
    pbx_objects.append("/* End XCConfigurationList section */\n")

    # Assemble full project.pbxproj content
    content = "// !$*UTF8*$!\n{\n"
    content += "\tarchiveVersion = 1;\n"
    content += "\tclasses = {\n\t};\n"
    content += "\tobjectVersion = 56;\n"
    content += "\tobjects = {\n"
    content += "\n".join(pbx_objects)
    content += "\t};\n"
    content += f"\trootObject = {proj_uuid} /* Project object */;\n"
    content += "}\n"

    # Write files
    proj_dir = os.path.join(repo_root, "TrackerThings.xcodeproj")
    os.makedirs(proj_dir, exist_ok=True)
    
    pbxproj_path = os.path.join(proj_dir, "project.pbxproj")
    with open(pbxproj_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Generated {pbxproj_path}")

    # project.xcworkspace
    workspace_dir = os.path.join(proj_dir, "project.xcworkspace")
    os.makedirs(workspace_dir, exist_ok=True)
    workspace_data = """<?xml version="1.0" encoding="UTF-8"?>
<Workspace
   version = "1.0">
   <FileRef
      location = "self:">
   </FileRef>
</Workspace>
"""
    with open(os.path.join(workspace_dir, "contents.xcworkspacedata"), "w", encoding="utf-8") as f:
        f.write(workspace_data)

    # xcshareddata/xcschemes/TrackerThings.xcscheme
    schemes_dir = os.path.join(proj_dir, "xcshareddata", "xcschemes")
    os.makedirs(schemes_dir, exist_ok=True)
    scheme_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "1600"
   version = "1.7">
   <BuildAction
      parallelizeBuildables = "YES"
      buildImplicitDependencies = "YES"
      buildArchitectures = "Automatic">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{target_uuid}"
               BuildableName = "TrackerThings.app"
               BlueprintName = "TrackerThings"
               ReferencedContainer = "container:TrackerThings.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      shouldUseLaunchSchemeArgsEnv = "YES"
      shouldAutocreateTestPlan = "YES">
   </TestAction>
   <LaunchAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      launchStyle = "0"
      useCustomWorkingDirectory = "NO"
      ignoresPersistentStateOnLaunch = "NO"
      debugDocumentVersioning = "YES"
      debugServiceExtension = "internal"
      allowLocationSimulation = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "{target_uuid}"
            BuildableName = "TrackerThings.app"
            BlueprintName = "TrackerThings"
            ReferencedContainer = "container:TrackerThings.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction
      buildConfiguration = "Release"
      shouldUseLaunchSchemeArgsEnv = "YES"
      savedToolIdentifier = ""
      useCustomWorkingDirectory = "NO"
      debugDocumentVersioning = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "{target_uuid}"
            BuildableName = "TrackerThings.app"
            BlueprintName = "TrackerThings"
            ReferencedContainer = "container:TrackerThings.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>
"""
    with open(os.path.join(schemes_dir, "TrackerThings.xcscheme"), "w", encoding="utf-8") as f:
        f.write(scheme_content)
    print(f"Generated scheme at {os.path.join(schemes_dir, 'TrackerThings.xcscheme')}")

if __name__ == "__main__":
    import sys
    repo = sys.argv[1] if len(sys.argv) > 1 else "."
    generate_project(repo)

