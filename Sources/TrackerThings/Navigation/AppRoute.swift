import Foundation

/// Rute navigasi bertipe (type-safe) di dalam TrackerThings V2.
/// Mendukung deep link notifikasi, link universal, dan navigasi programmatic multi-tab.
public enum AppRoute: Hashable, Sendable {
    case taskDetail(id: Int)
    case courseDetail(id: Int)
    case examDetail(id: Int)
    case replacementClassDetail(id: Int)
    case entityNotFound(entityType: String, id: Int, message: String)

    public var title: String {
        switch self {
        case .taskDetail:
            return "Detail Tugas"
        case .courseDetail:
            return "Detail Kuliah"
        case .examDetail:
            return "Detail Ujian"
        case .replacementClassDetail:
            return "Detail Kelas Pengganti"
        case .entityNotFound:
            return "Tidak Ditemukan"
        }
    }
}

public enum AppTab: Int, Hashable, CaseIterable, Sendable {
    case home = 0
    case courses = 1
    case tasks = 2
    case exams = 3
    case settings = 4

    public var title: String {
        switch self {
        case .home: return "Beranda"
        case .courses: return "Mata Kuliah"
        case .tasks: return "Tugas"
        case .exams: return "Ujian"
        case .settings: return "Profil"
        }
    }

    /// Label ringkas untuk Frosted Glide Tab Bar (1 kata, tidak terpotong di iPhone kompak)
    public var shortLabel: String {
        switch self {
        case .home: return "Beranda"
        case .courses: return "Jadwal"
        case .tasks: return "Tugas"
        case .exams: return "Ujian"
        case .settings: return "Profil"
        }
    }

    /// Ikon SF Symbols kanonis untuk masing-masing tab
    public var iconName: String {
        switch self {
        case .home: return "house.fill"
        case .courses: return "book.fill"
        case .tasks: return "checklist"
        case .exams: return "graduationcap.fill"
        case .settings: return "person.crop.circle.fill"
        }
    }

    /// Identifier aksesibilitas deterministik untuk UI testing & VoiceOver
    public var accessibilityIdentifier: String {
        switch self {
        case .home: return "FrostedGlideTab.home"
        case .courses: return "FrostedGlideTab.courses"
        case .tasks: return "FrostedGlideTab.tasks"
        case .exams: return "FrostedGlideTab.exams"
        case .settings: return "FrostedGlideTab.settings"
        }
    }
}
