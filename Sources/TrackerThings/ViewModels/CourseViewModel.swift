import Foundation
import SwiftUI

@Observable
@MainActor
public final class CourseViewModel {
    public var courses: [JadwalItem] = []
    public var searchText: String = ""
    public var isLoading: Bool = false
    public var errorMessage: String?
    public var isPresentingSheet: Bool = false
    public var editingCourse: JadwalItem?

    private let dataService: TrackerDataServiceProtocol

    public init(dataService: TrackerDataServiceProtocol = TrackerDataService()) {
        self.dataService = dataService
    }

    public var filteredCourses: [JadwalItem] {
        if searchText.trimmingCharacters(in: .whitespaces).isEmpty {
            return courses
        }
        let term = searchText.lowercased()
        return courses.filter {
            $0.namaMatkul.lowercased().contains(term) ||
            ($0.dosen?.lowercased().contains(term) ?? false) ||
            $0.hari.lowercased().contains(term)
        }
    }

    public func fetchCourses() async {
        isLoading = true
        errorMessage = nil
        do {
            courses = try await dataService.getJadwalList()
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }

    public func saveCourse(
        namaMatkul: String,
        dosen: String?,
        kategori: String?,
        lokasi: String?,
        hari: String,
        waktuMulai: String,
        waktuSelesai: String
    ) async -> Bool {
        isLoading = true
        errorMessage = nil

        let newItem = JadwalItem(
            id: editingCourse?.id ?? 0,
            namaMatkul: namaMatkul,
            dosen: dosen,
            kategori: kategori,
            lokasi: lokasi,
            hari: hari,
            waktuMulai: waktuMulai,
            waktuSelesai: waktuSelesai
        )

        do {
            if let editing = editingCourse {
                _ = try await dataService.updateJadwal(newItem)
            } else {
                _ = try await dataService.createJadwal(newItem)
            }
            await fetchCourses()
            isPresentingSheet = false
            editingCourse = nil
            isLoading = false
            return true
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
            return false
        }
    }

    public func deleteCourse(id: Int) async {
        do {
            _ = try await dataService.deleteJadwal(id: id)
            courses.removeAll { $0.id == id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

