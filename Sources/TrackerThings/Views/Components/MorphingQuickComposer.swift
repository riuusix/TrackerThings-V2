import SwiftUI

/// Signature Interaction 02 — Button-to-Panel Morphing Quick Composer.
/// Panel kontekstual yang bermorfosis langsung dari pil aksi Gooey Action Dock (`matchedGeometryEffect`),
/// menggantikan tampilan `Form` generik dengan komposisi editorial yang ringkas, taktil, dan tervalidasi.
public struct MorphingQuickComposer: View {
    @Bindable var controller: QuickActionDockController
    var kind: QuickComposerKind
    var morphNamespace: Namespace.ID

    @Bindable var dashboardViewModel: DashboardViewModel
    @Bindable var courseViewModel: CourseViewModel
    @Bindable var examViewModel: ExamViewModel

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme

    // MARK: - Shared Course Selection
    @State private var selectedCourseId: Int = 0

    // MARK: - Task Composer State
    @State private var taskTitle: String = ""
    @State private var taskDeadline: Date = Calendar.current.date(byAdding: .day, value: 2, to: Date()) ?? Date()
    @State private var taskPriority: TugasItem.PrioritasTugas = .sedang
    @State private var taskType: TugasItem.JenisTugas = .individu

    // MARK: - Replacement Class Composer State
    @State private var repDate: Date = Date()
    @State private var repStartTime: Date = MorphingQuickComposer.defaultTime(hour: 10, minute: 0)
    @State private var repEndTime: Date = MorphingQuickComposer.defaultTime(hour: 11, minute: 40)
    @State private var repLocation: String = ""
    @State private var repNotes: String = ""

    // MARK: - Course Composer State
    @State private var courseName: String = ""
    @State private var courseDay: String = "Senin"
    @State private var courseCategory: String = "Wajib"
    @State private var courseStartTime: Date = MorphingQuickComposer.defaultTime(hour: 8, minute: 0)
    @State private var courseEndTime: Date = MorphingQuickComposer.defaultTime(hour: 9, minute: 40)
    @State private var courseLocation: String = ""
    @State private var courseLecturer: String = ""

    // MARK: - Exam Composer State
    @State private var examType: String = "UTS"
    @State private var examDate: Date = Calendar.current.date(byAdding: .day, value: 7, to: Date()) ?? Date()
    @State private var examStartTime: Date = MorphingQuickComposer.defaultTime(hour: 9, minute: 0)
    @State private var examEndTime: Date = MorphingQuickComposer.defaultTime(hour: 11, minute: 0)
    @State private var examRoom: String = ""
    @State private var examNotes: String = ""

    // MARK: - Validation & Submission
    @State private var validationMessage: String? = nil
    @State private var isSubmitting: Bool = false

    private let daysOfWeek = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]
    private let courseCategories = ["Wajib", "Pilihan", "Praktikum", "Seminar"]
    private let examTypes = ["UTS", "UAS", "Kuis", "Praktikum", "Responsi"]

    public init(
        controller: QuickActionDockController,
        kind: QuickComposerKind,
        morphNamespace: Namespace.ID,
        dashboardViewModel: DashboardViewModel,
        courseViewModel: CourseViewModel,
        examViewModel: ExamViewModel
    ) {
        self.controller = controller
        self.kind = kind
        self.morphNamespace = morphNamespace
        self.dashboardViewModel = dashboardViewModel
        self.courseViewModel = courseViewModel
        self.examViewModel = examViewModel
    }

    private var availableCourses: [JadwalItem] {
        if !dashboardViewModel.courses.isEmpty {
            return dashboardViewModel.courses
        }
        return courseViewModel.courses
    }

    public var body: some View {
        ZStack(alignment: .bottom) {
            // Backdrop Scrim
            Color.black
                .opacity(colorScheme == .dark ? 0.54 : 0.28)
                .ignoresSafeArea()
                .transition(.opacity)
                .onTapGesture {
                    guard !isSubmitting else { return }
                    controller.dismissComposer(reduceMotion: reduceMotion)
                }
                .accessibilityLabel("Tutup panel komposer")
                .accessibilityAddTraits(.isButton)
                .accessibilityAction(.escape) {
                    guard !isSubmitting else { return }
                    controller.dismissComposer(reduceMotion: reduceMotion)
                }

            // Morphing Editor Card
            VStack(alignment: .leading, spacing: 0) {
                composerHeader

                modeSwitcherBar
                    .padding(.horizontal, 18)
                    .padding(.bottom, 12)

                Divider()
                    .overlay(AppTheme.Colors.divider)

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 16) {
                        if let validationMessage {
                            HStack(spacing: 8) {
                                Image(systemName: "exclamationmark.circle.fill")
                                    .foregroundStyle(AppTheme.Colors.danger)
                                Text(validationMessage)
                                    .font(.caption.weight(.medium))
                                    .foregroundStyle(AppTheme.Colors.danger)
                                Spacer()
                            }
                            .padding(10)
                            .background(AppTheme.Colors.dangerMuted)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .transition(.opacity.combined(with: .scale(scale: 0.96)))
                        }

                        switch kind {
                        case .task:
                            taskComposerFields
                        case .replacement:
                            replacementComposerFields
                        case .course:
                            courseComposerFields
                        case .exam:
                            examComposerFields
                        }
                    }
                    .padding(18)
                }
                .frame(maxHeight: 380)

                Divider()
                    .overlay(AppTheme.Colors.divider)

                composerFooter
            }
            .background(
                RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusPanel, style: .continuous)
                    .fill(AppTheme.Colors.secondarySurface)
                    .matchedGeometryEffect(id: "composer-surface-\(kind.rawValue)", in: morphNamespace)
            )
            .overlay(
                RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusPanel, style: .continuous)
                    .strokeBorder(kind.accentColor.opacity(0.28), lineWidth: 1)
            )
            .shadow(
                color: Color.black.opacity(colorScheme == .dark ? 0.45 : 0.16),
                radius: 26,
                x: 0,
                y: 12
            )
            .padding(.horizontal, 14)
            .padding(.bottom, 16)
            .transition(
                reduceMotion
                    ? .opacity
                    : .asymmetric(
                        insertion: .scale(scale: 0.94, anchor: .bottomTrailing).combined(with: .opacity),
                        removal: .scale(scale: 0.94, anchor: .bottomTrailing).combined(with: .opacity)
                    )
            )
        }
        .onAppear {
            if selectedCourseId == 0, let first = availableCourses.first {
                selectedCourseId = first.id
            }
        }
        .onChange(of: kind) { _, _ in
            validationMessage = nil
            if selectedCourseId == 0, let first = availableCourses.first {
                selectedCourseId = first.id
            }
        }
    }

    // MARK: - Contextual Header

    private var composerHeader: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(kind.accentColor.opacity(0.15))
                    .frame(width: 42, height: 42)

                Image(systemName: kind.iconName)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(kind.accentColor)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(kind.title)
                    .font(.system(.headline, design: .rounded).weight(.bold))
                    .foregroundStyle(AppTheme.Colors.textPrimary)

                Text(kind.subtitle)
                    .font(.caption)
                    .foregroundStyle(AppTheme.Colors.textSecondary)
                    .lineLimit(1)
            }

            Spacer()

            Button {
                guard !isSubmitting else { return }
                controller.dismissComposer(reduceMotion: reduceMotion)
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(AppTheme.Colors.textSecondary)
                    .frame(width: 32, height: 32)
                    .background(AppTheme.Colors.tertiarySurface)
                    .clipShape(Circle())
            }
            .buttonStyle(PressableScaleButtonStyle())
            .accessibilityLabel("Batal dan tutup komposer")
        }
        .padding(.horizontal, 18)
        .padding(.top, 16)
        .padding(.bottom, 10)
    }

    // MARK: - Mode Switcher Bar

    private var modeSwitcherBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(QuickComposerKind.allCases) { item in
                    let isSelected = item == kind
                    Button {
                        guard !isSubmitting, item != kind else { return }
                        controller.selectAction(item, reduceMotion: reduceMotion)
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: item.iconName)
                                .font(.system(size: 11, weight: .semibold))
                            Text(shortLabel(for: item))
                                .font(.caption.weight(isSelected ? .bold : .medium))
                        }
                        .padding(.horizontal, 11)
                        .padding(.vertical, 6)
                        .foregroundStyle(isSelected ? .white : AppTheme.Colors.textSecondary)
                        .background(
                            Capsule()
                                .fill(isSelected ? item.accentColor : AppTheme.Colors.tertiarySurface)
                        )
                    }
                    .buttonStyle(PressableScaleButtonStyle())
                }
            }
        }
    }

    private func shortLabel(for item: QuickComposerKind) -> String {
        switch item {
        case .task: return "Tugas"
        case .replacement: return "Pengganti"
        case .course: return "Mata Kuliah"
        case .exam: return "Ujian"
        }
    }

    // MARK: - 1. Task Composer Fields

    private var taskComposerFields: some View {
        VStack(alignment: .leading, spacing: 14) {
            editorialTextField(
                label: "JUDUL TUGAS",
                placeholder: "Contoh: Analisis Kompleksitas Algoritma",
                text: $taskTitle,
                icon: "pencil.line"
            )

            courseSelectorSection

            VStack(alignment: .leading, spacing: 6) {
                fieldLabel("TENGGAT PENGUMPULAN")
                DatePicker(
                    "Pilih tanggal dan waktu tenggat",
                    selection: $taskDeadline,
                    displayedComponents: [.date, .hourAndMinute]
                )
                .labelsHidden()
                .environment(\.locale, Locale(identifier: "id_ID"))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AppTheme.Colors.tertiarySurface)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    fieldLabel("PRIORITAS")
                    HStack(spacing: 6) {
                        ForEach(TugasItem.PrioritasTugas.allCases, id: \.rawValue) { priority in
                            let selected = taskPriority == priority
                            Button {
                                HapticsHelper.selectionChanged()
                                taskPriority = priority
                            } label: {
                                Text(priority.rawValue)
                                    .font(.caption.weight(.semibold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 8)
                                    .foregroundStyle(selected ? .white : AppTheme.Colors.textSecondary)
                                    .background(
                                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                                            .fill(selected ? priorityColor(priority) : AppTheme.Colors.tertiarySurface)
                                    )
                            }
                            .buttonStyle(PressableScaleButtonStyle())
                        }
                    }
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                fieldLabel("JENIS PENGERJAAN")
                HStack(spacing: 8) {
                    ForEach(TugasItem.JenisTugas.allCases, id: \.rawValue) { jenis in
                        let selected = taskType == jenis
                        Button {
                            HapticsHelper.selectionChanged()
                            taskType = jenis
                        } label: {
                            HStack(spacing: 5) {
                                Image(systemName: jenis == .kelompok ? "person.2.fill" : "person.fill")
                                    .font(.caption2)
                                Text(jenis.rawValue)
                                    .font(.caption.weight(.semibold))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                            .foregroundStyle(selected ? AppTheme.Colors.primary : AppTheme.Colors.textSecondary)
                            .background(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .fill(selected ? AppTheme.Colors.primaryMuted : AppTheme.Colors.tertiarySurface)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .strokeBorder(selected ? AppTheme.Colors.primary.opacity(0.45) : .clear, lineWidth: 1)
                            )
                        }
                        .buttonStyle(PressableScaleButtonStyle())
                    }
                }
            }
        }
    }

    // MARK: - 2. Replacement Class Composer Fields

    private var replacementComposerFields: some View {
        VStack(alignment: .leading, spacing: 14) {
            courseSelectorSection

            VStack(alignment: .leading, spacing: 6) {
                fieldLabel("TANGGAL KELAS PENGGANTI")
                DatePicker(
                    "Tanggal kelas pengganti",
                    selection: $repDate,
                    displayedComponents: [.date]
                )
                .labelsHidden()
                .environment(\.locale, Locale(identifier: "id_ID"))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AppTheme.Colors.tertiarySurface)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            timeRangeRow(startTime: $repStartTime, endTime: $repEndTime)

            editorialTextField(
                label: "RUANGAN / TAUTAN DARING",
                placeholder: "Contoh: Lab 302 atau Zoom Meeting",
                text: $repLocation,
                icon: "mappin.and.ellipse"
            )

            editorialTextField(
                label: "CATATAN SESI (OPSIONAL)",
                placeholder: "Materi tambahan atau instruksi dosen",
                text: $repNotes,
                icon: "note.text"
            )
        }
    }

    // MARK: - 3. Course Composer Fields

    private var courseComposerFields: some View {
        VStack(alignment: .leading, spacing: 14) {
            editorialTextField(
                label: "NAMA MATA KULIAH",
                placeholder: "Contoh: Kecerdasan Buatan",
                text: $courseName,
                icon: "book.closed"
            )

            VStack(alignment: .leading, spacing: 6) {
                fieldLabel("HARI PERKULIAHAN")
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(daysOfWeek, id: \.self) { day in
                            let selected = courseDay == day
                            Button {
                                HapticsHelper.selectionChanged()
                                courseDay = day
                            } label: {
                                Text(day)
                                    .font(.caption.weight(.semibold))
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 7)
                                    .foregroundStyle(selected ? .white : AppTheme.Colors.textSecondary)
                                    .background(
                                        Capsule()
                                            .fill(selected ? AppTheme.Colors.success : AppTheme.Colors.tertiarySurface)
                                    )
                            }
                            .buttonStyle(PressableScaleButtonStyle())
                        }
                    }
                }
            }

            timeRangeRow(startTime: $courseStartTime, endTime: $courseEndTime)

            HStack(spacing: 10) {
                editorialTextField(
                    label: "RUANGAN",
                    placeholder: "Gd. D R.204",
                    text: $courseLocation,
                    icon: "mappin"
                )

                editorialTextField(
                    label: "DOSEN PENGAMPU",
                    placeholder: "Nama dosen",
                    text: $courseLecturer,
                    icon: "person.text.rectangle"
                )
            }

            VStack(alignment: .leading, spacing: 6) {
                fieldLabel("KATEGORI")
                HStack(spacing: 6) {
                    ForEach(courseCategories, id: \.self) { category in
                        let selected = courseCategory == category
                        Button {
                            HapticsHelper.selectionChanged()
                            courseCategory = category
                        } label: {
                            Text(category)
                                .font(.caption2.weight(.semibold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 7)
                                .foregroundStyle(selected ? AppTheme.Colors.success : AppTheme.Colors.textSecondary)
                                .background(
                                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                                        .fill(selected ? AppTheme.Colors.successMuted : AppTheme.Colors.tertiarySurface)
                                )
                        }
                        .buttonStyle(PressableScaleButtonStyle())
                    }
                }
            }
        }
    }

    // MARK: - 4. Exam Composer Fields

    private var examComposerFields: some View {
        VStack(alignment: .leading, spacing: 14) {
            courseSelectorSection

            VStack(alignment: .leading, spacing: 6) {
                fieldLabel("JENIS UJIAN")
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(examTypes, id: \.self) { type in
                            let selected = examType == type
                            Button {
                                HapticsHelper.selectionChanged()
                                examType = type
                            } label: {
                                Text(type)
                                    .font(.caption.weight(.bold))
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 7)
                                    .foregroundStyle(selected ? .white : AppTheme.Colors.textSecondary)
                                    .background(
                                        Capsule()
                                            .fill(selected ? AppTheme.Colors.danger : AppTheme.Colors.tertiarySurface)
                                    )
                            }
                            .buttonStyle(PressableScaleButtonStyle())
                        }
                    }
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                fieldLabel("TANGGAL PELAKSANAAN")
                DatePicker(
                    "Tanggal ujian",
                    selection: $examDate,
                    displayedComponents: [.date]
                )
                .labelsHidden()
                .environment(\.locale, Locale(identifier: "id_ID"))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AppTheme.Colors.tertiarySurface)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            timeRangeRow(startTime: $examStartTime, endTime: $examEndTime)

            HStack(spacing: 10) {
                editorialTextField(
                    label: "RUANGAN / KURSI",
                    placeholder: "Aula Barat / R.101",
                    text: $examRoom,
                    icon: "building.2"
                )

                editorialTextField(
                    label: "CATATAN",
                    placeholder: "Bawa kartu ujian",
                    text: $examNotes,
                    icon: "doc.plaintext"
                )
            }
        }
    }

    // MARK: - Shared Subcomponents

    private var courseSelectorSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            fieldLabel("MATA KULIAH TERKAIT")

            if availableCourses.isEmpty {
                HStack(spacing: 8) {
                    Image(systemName: "info.circle")
                        .foregroundStyle(AppTheme.Colors.warning)
                    Text("Belum ada mata kuliah. Tambahkan mata kuliah terlebih dahulu.")
                        .font(.caption)
                        .foregroundStyle(AppTheme.Colors.textSecondary)
                    Spacer()
                    Button("Buat Kuliah") {
                        controller.selectAction(.course, reduceMotion: reduceMotion)
                    }
                    .font(.caption.weight(.bold))
                    .foregroundStyle(AppTheme.Colors.primary)
                }
                .padding(10)
                .background(AppTheme.Colors.warningMuted)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(availableCourses) { course in
                            let isSelected = selectedCourseId == course.id
                            let accent = AppTheme.Colors.courseAccent(for: course.namaMatkul)
                            Button {
                                HapticsHelper.selectionChanged()
                                selectedCourseId = course.id
                            } label: {
                                HStack(spacing: 6) {
                                    Circle()
                                        .fill(isSelected ? .white : accent)
                                        .frame(width: 7, height: 7)
                                    Text(course.namaMatkul)
                                        .font(.caption.weight(isSelected ? .bold : .medium))
                                        .lineLimit(1)
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .foregroundStyle(isSelected ? .white : AppTheme.Colors.textPrimary)
                                .background(
                                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                                        .fill(isSelected ? accent : AppTheme.Colors.tertiarySurface)
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                                        .strokeBorder(isSelected ? accent : accent.opacity(0.25), lineWidth: 1)
                                )
                            }
                            .buttonStyle(PressableScaleButtonStyle())
                        }
                    }
                }
            }
        }
    }

    private func timeRangeRow(startTime: Binding<Date>, endTime: Binding<Date>) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                fieldLabel("MULAI")
                DatePicker("Waktu mulai", selection: startTime, displayedComponents: .hourAndMinute)
                    .labelsHidden()
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(AppTheme.Colors.tertiarySurface)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }

            VStack(alignment: .leading, spacing: 6) {
                fieldLabel("SELESAI")
                DatePicker("Waktu selesai", selection: endTime, displayedComponents: .hourAndMinute)
                    .labelsHidden()
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(AppTheme.Colors.tertiarySurface)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
        }
    }

    private func editorialTextField(
        label: String,
        placeholder: String,
        text: Binding<String>,
        icon: String
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            fieldLabel(label)
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.caption)
                    .foregroundStyle(AppTheme.Colors.textTertiary)
                    .frame(width: 16)
                TextField(placeholder, text: text)
                    .font(.subheadline)
                    .foregroundStyle(AppTheme.Colors.textPrimary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(AppTheme.Colors.tertiarySurface)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 10, weight: .bold, design: .rounded))
            .tracking(0.7)
            .foregroundStyle(AppTheme.Colors.textSecondary)
    }

    private func priorityColor(_ priority: TugasItem.PrioritasTugas) -> Color {
        switch priority {
        case .tinggi: return AppTheme.Colors.danger
        case .sedang: return AppTheme.Colors.warning
        case .rendah: return AppTheme.Colors.primary
        }
    }

    // MARK: - Footer & Save Action

    private var composerFooter: some View {
        HStack(spacing: 12) {
            Button {
                guard !isSubmitting else { return }
                controller.dismissComposer(reduceMotion: reduceMotion)
            } label: {
                Text("Batal")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(AppTheme.Colors.textSecondary)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 12)
                    .background(AppTheme.Colors.tertiarySurface)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(PressableScaleButtonStyle())
            .disabled(isSubmitting)

            Button {
                Task {
                    await submitCurrentForm()
                }
            } label: {
                SubmitButtonLabel(
                    state: isSubmitting ? .loading("Menyimpan...") : .idle,
                    idleTitle: saveButtonTitle,
                    idleIcon: "checkmark.circle.fill"
                )
                .font(.subheadline.weight(.bold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(kind.accentColor)
                )
            }
            .buttonStyle(PressableScaleButtonStyle())
            .disabled(isSubmitting)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
    }

    private var saveButtonTitle: String {
        switch kind {
        case .task: return "Simpan Tugas"
        case .replacement: return "Jadwalkan Pengganti"
        case .course: return "Simpan Mata Kuliah"
        case .exam: return "Simpan Ujian"
        }
    }

    // MARK: - Submission Logic

    private func submitCurrentForm() async {
        validationMessage = nil
        let timeFormatter = DateFormatter()
        timeFormatter.dateFormat = "HH:mm"
        timeFormatter.locale = Locale(identifier: "en_US_POSIX")

        switch kind {
        case .task:
            let trimmedTitle = taskTitle.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmedTitle.isEmpty else {
                validationMessage = "Judul tugas tidak boleh kosong."
                HapticsHelper.notificationWarning()
                return
            }
            let targetCourseId = selectedCourseId != 0 ? selectedCourseId : (availableCourses.first?.id ?? 0)
            guard targetCourseId > 0 else {
                validationMessage = "Pilih mata kuliah terlebih dahulu."
                HapticsHelper.notificationWarning()
                return
            }

            isSubmitting = true
            dashboardViewModel.editingTask = nil
            let ok = await dashboardViewModel.saveTask(
                namaTugas: trimmedTitle,
                idJadwal: targetCourseId,
                deadline: taskDeadline,
                prioritas: taskPriority,
                jenis: taskType
            )
            isSubmitting = false
            if ok {
                HapticsHelper.notificationSuccess()
                controller.dismissComposer(reduceMotion: reduceMotion)
            }

        case .replacement:
            let targetCourseId = selectedCourseId != 0 ? selectedCourseId : (availableCourses.first?.id ?? 0)
            guard targetCourseId > 0 else {
                validationMessage = "Pilih mata kuliah yang digantikan."
                HapticsHelper.notificationWarning()
                return
            }
            let startStr = timeFormatter.string(from: repStartTime)
            let endStr = timeFormatter.string(from: repEndTime)
            guard startStr < endStr else {
                validationMessage = "Waktu selesai harus setelah waktu mulai."
                HapticsHelper.notificationWarning()
                return
            }

            isSubmitting = true
            dashboardViewModel.editingReplacement = nil
            let ok = await dashboardViewModel.saveKelasPengganti(
                idJadwal: targetCourseId,
                tanggal: repDate,
                waktuMulai: startStr,
                waktuSelesai: endStr,
                lokasi: repLocation.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : repLocation.trimmingCharacters(in: .whitespacesAndNewlines),
                catatan: repNotes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : repNotes.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            isSubmitting = false
            if ok {
                HapticsHelper.notificationSuccess()
                controller.dismissComposer(reduceMotion: reduceMotion)
            }

        case .course:
            let trimmedCourse = courseName.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmedCourse.isEmpty else {
                validationMessage = "Nama mata kuliah wajib diisi."
                HapticsHelper.notificationWarning()
                return
            }
            let startStr = timeFormatter.string(from: courseStartTime)
            let endStr = timeFormatter.string(from: courseEndTime)
            guard startStr < endStr else {
                validationMessage = "Waktu selesai kuliah harus setelah waktu mulai."
                HapticsHelper.notificationWarning()
                return
            }

            isSubmitting = true
            courseViewModel.editingCourse = nil
            let ok = await courseViewModel.saveCourse(
                namaMatkul: trimmedCourse,
                dosen: courseLecturer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : courseLecturer.trimmingCharacters(in: .whitespacesAndNewlines),
                kategori: courseCategory,
                lokasi: courseLocation.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : courseLocation.trimmingCharacters(in: .whitespacesAndNewlines),
                hari: courseDay,
                waktuMulai: startStr,
                waktuSelesai: endStr
            )
            if ok {
                await dashboardViewModel.loadDashboardData()
                await examViewModel.fetchExams()
            }
            isSubmitting = false
            if ok {
                HapticsHelper.notificationSuccess()
                controller.dismissComposer(reduceMotion: reduceMotion)
            }

        case .exam:
            let targetCourseId = selectedCourseId != 0 ? selectedCourseId : (availableCourses.first?.id ?? 0)
            guard targetCourseId > 0 else {
                validationMessage = "Pilih mata kuliah untuk jadwal ujian ini."
                HapticsHelper.notificationWarning()
                return
            }
            let startStr = timeFormatter.string(from: examStartTime)
            let endStr = timeFormatter.string(from: examEndTime)
            guard startStr < endStr else {
                validationMessage = "Waktu selesai ujian harus setelah waktu mulai."
                HapticsHelper.notificationWarning()
                return
            }

            isSubmitting = true
            examViewModel.editingExam = nil
            let ok = await examViewModel.saveExam(
                idJadwal: targetCourseId,
                jenisUjian: examType,
                tanggal: examDate,
                waktuMulai: startStr,
                waktuSelesai: endStr,
                ruangan: examRoom.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : examRoom.trimmingCharacters(in: .whitespacesAndNewlines),
                catatan: examNotes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : examNotes.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            if ok {
                await dashboardViewModel.loadDashboardData()
            }
            isSubmitting = false
            if ok {
                HapticsHelper.notificationSuccess()
                controller.dismissComposer(reduceMotion: reduceMotion)
            }
        }
    }

    private static func defaultTime(hour: Int, minute: Int) -> Date {
        Calendar.current.date(bySettingHour: hour, minute: minute, second: 0, of: Date()) ?? Date()
    }
}
