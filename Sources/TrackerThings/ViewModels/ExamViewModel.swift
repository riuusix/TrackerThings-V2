import Foundation
import SwiftUI

@Observable
@MainActor
public final class ExamViewModel {
    public var exams: [UjianItem] = []
    public var courses: [JadwalItem] = []
    public var isLoading: Bool = false
    public var errorMessage: String?
    public var isPresentingSheet: Bool = false
    public var editingExam: UjianItem?

    private let dataService: TrackerDataServiceProtocol

    public init(dataService: TrackerDataServiceProtocol = TrackerDataService()) {
        self.dataService = dataService
    }

    public func fetchExams() async {
        isLoading = true
        errorMessage = nil
        do {
            async let examTask = dataService.getUjianList()
            async let courseTask = dataService.getJadwalList()
            let (loadedExams, loadedCourses) = try await (examTask, courseTask)
            exams = loadedExams.sorted { $0.tanggal < $1.tanggal }
            courses = loadedCourses
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }

    public func saveExam(
        idJadwal: Int,
        jenisUjian: String,
        tanggal: Date,
        waktuMulai: String?,
        waktuSelesai: String?,
        ruangan: String?,
        catatan: String?
    ) async -> Bool {
        isLoading = true
        errorMessage = nil

        let item = UjianItem(
            id: editingExam?.id ?? 0,
            idJadwal: idJadwal,
            jenisUjian: jenisUjian,
            tanggal: tanggal,
            waktuMulai: waktuMulai,
            waktuSelesai: waktuSelesai,
            ruangan: ruangan,
            catatan: catatan
        )

        do {
            if editingExam != nil {
                _ = try await dataService.updateUjian(item)
            } else {
                _ = try await dataService.createUjian(item)
            }
            await fetchExams()
            isPresentingSheet = false
            editingExam = nil
            isLoading = false
            return true
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
            return false
        }
    }

    public func deleteExam(id: Int) async {
        do {
            _ = try await dataService.deleteUjian(id: id)
            exams.removeAll { $0.id == id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

