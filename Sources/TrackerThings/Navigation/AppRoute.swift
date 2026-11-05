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
    case exams = 2
    case settings = 3

    public var title: String {
        switch self {
        case .home: return "Home"
        case .courses: return "Mata Kuliah"
        case .exams: return "Ujian"
        case .settings: return "Pengaturan"
        }
    }
}
