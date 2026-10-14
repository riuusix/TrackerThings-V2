import SwiftUI

public struct DashboardView: View {
    @Bindable var viewModel: DashboardViewModel
    @State private var isPresentingAddTask = false
    @State private var isPresentingAddReplacement = false

    public init(viewModel: DashboardViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Header Card
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text("Semester Aktif")
                                .font(.caption.weight(.bold))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(Color.blue.opacity(0.12))
                                .foregroundStyle(.blue)
                                .clipShape(Capsule())

                            Spacer()

                            Text("2026/2027")
                                .font(.caption.weight(.medium))
                                .foregroundStyle(.secondary)
                        }

                        Text("TrackerThings")
                            .font(.system(.largeTitle, design: .rounded, weight: .bold))
                            .foregroundStyle(.primary)

                        Text("Pantau jadwal harian, target tugas akademik, dan persiapan ujian Anda.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.horizontal)

                    // Offline Status Banner
                    if viewModel.isOffline {
                        OfflineBannerView(
                            lastUpdatedText: viewModel.lastCacheDateText
                        ) {
                            Task {
                                await viewModel.loadDashboardData()
                            }
                        }
                    }

                    // Day Selector Segment
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(viewModel.daysOfWeek, id: \.self) { day in
                                let isSelected = viewModel.selectedDay == day
                                Button {
                                    withAnimation(.snappy) {
                                        viewModel.selectedDay = day
                                    }
                                } label: {
                                    VStack(spacing: 4) {
                                        Text(day)
                                            .font(.subheadline.weight(isSelected ? .bold : .medium))
                                    }
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 10)
                                    .background(isSelected ? Color.blue : Color(uiColor: .secondarySystemGroupedBackground))
                                    .foregroundStyle(isSelected ? .white : .primary)
                                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                    .shadow(color: isSelected ? Color.blue.opacity(0.3) : .clear, radius: 6, x: 0, y: 3)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal)
                    }

                    // Schedules List
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Label("Jadwal Kuliah: \(viewModel.selectedDay)", systemImage: "calendar.badge.clock")
                                .font(.headline)
                            Spacer()
                            Text("\(viewModel.schedulesForSelectedDay.count) Kelas")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal)

                        if viewModel.isLoading && viewModel.courses.isEmpty {
                            VStack(spacing: 12) {
                                SkeletonCardView(lines: 3)
                                SkeletonCardView(lines: 2)
                            }
                            .padding(.horizontal)
                        } else if let error = viewModel.errorMessage, viewModel.courses.isEmpty {
                            ErrorRetryView(
                                title: "Gagal Memuat Jadwal",
                                message: error
                            ) {
                                await viewModel.loadDashboardData()
                            }
                            .padding(.vertical, 12)
                        } else if viewModel.schedulesForSelectedDay.isEmpty {
                            ContentUnavailableView(
                                "Tidak Ada Kuliah",
                                systemImage: "sparkles",
                                description: Text("Hari \(viewModel.selectedDay) bebas perkuliahan. Waktunya belajar mandiri atau menyelesaikan tugas.")
                            )
                            .padding(.vertical, 20)
                        } else {
                            LazyVStack(spacing: 12) {
                                ForEach(viewModel.schedulesForSelectedDay) { schedule in
                                    ScheduleCardView(item: schedule, isOffline: viewModel.isOffline) {
                                        await viewModel.markReplacementCompleted(item: schedule)
                                    }
                                }
                            }
                            .padding(.horizontal)
                        }
                    }

                    // Upcoming Exam Highlight
                    if let exam = viewModel.upcomingExam {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Label("Ujian Terdekat", systemImage: "graduationcap.fill")
                                    .font(.headline)
                                    .foregroundStyle(.primary)
                                Spacer()
                            }
                            .padding(.horizontal)

                            VStack(alignment: .leading, spacing: 10) {
                                HStack {
                                    Text(exam.jenisUjian)
                                        .font(.caption2.weight(.bold))
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(Color.red.opacity(0.15))
                                        .foregroundStyle(.red)
                                        .clipShape(Capsule())

                                    Spacer()

                                    Text(exam.tanggal.formatted(date: .abbreviated, time: .omitted))
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(.red)
                                }

                                Text(exam.jadwal?.namaMatkul ?? "Ujian Akademik")
                                    .font(.headline)

                                if let room = exam.ruangan {
                                    Label("Ruangan: \(room)", systemImage: "mappin")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding(16)
                            .background {
                                RoundedRectangle(cornerRadius: 18, style: .continuous)
                                    .fill(Color(uiColor: .secondarySystemGroupedBackground))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 18)
                                            .stroke(Color.red.opacity(0.25), lineWidth: 1)
                                    )
                            }
                            .padding(.horizontal)
                        }
                    }

                    // Urgent Tasks Section
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Label("Tugas Aktif", systemImage: "checklist")
                                .font(.headline)
                            Spacer()
                            Text("\(viewModel.urgentTasks.count) Tugas")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal)

                        if viewModel.isLoading && viewModel.urgentTasks.isEmpty && viewModel.courses.isEmpty {
                            VStack(spacing: 12) {
                                SkeletonCardView(lines: 2)
                                SkeletonCardView(lines: 2)
                            }
                            .padding(.horizontal)
                        } else if let error = viewModel.errorMessage, viewModel.urgentTasks.isEmpty && viewModel.courses.isEmpty {
                            ErrorRetryView(
                                title: "Gagal Memuat Tugas",
                                message: error
                            ) {
                                await viewModel.loadDashboardData()
                            }
                            .padding(.vertical, 12)
                        } else if viewModel.urgentTasks.isEmpty {
                            ContentUnavailableView(
                                "Semua Tugas Selesai",
                                systemImage: "checkmark.circle",
                                description: Text("Bagus sekali! Tidak ada tugas yang tertunda saat ini.")
                            )
                            .padding(.vertical, 20)
                        } else {
                            LazyVStack(spacing: 12) {
                                ForEach(viewModel.urgentTasks) { task in
                                    TaskCardView(task: task, isOffline: viewModel.isOffline) { newProg in
                                        Task {
                                            await viewModel.updateTaskProgress(task: task, progress: newProg)
                                        }
                                    }
                                }
                            }
                            .padding(.horizontal)
                        }
                    }
                }
                .padding(.vertical)
            }
            .navigationTitle("Home")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            isPresentingAddTask = true
                        } label: {
                            Label("Tambah Tugas", systemImage: "plus.circle")
                        }

                        Button {
                            isPresentingAddReplacement = true
                        } label: {
                            Label("Kelas Pengganti", systemImage: "sparkles")
                        }
                    } label: {
                        Image(systemName: "plus")
                            .font(.headline)
                    }
                }
            }
            .refreshable {
                await viewModel.loadDashboardData()
            }
            .task {
                await viewModel.loadDashboardData()
            }
            .sheet(isPresented: $isPresentingAddTask) {
                TaskFormSheet(viewModel: viewModel)
            }
            .sheet(isPresented: $isPresentingAddReplacement) {
                KelasPenggantiFormSheet(viewModel: viewModel)
            }
            .feedbackToast(toast: $viewModel.toast)
        }
    }
}

