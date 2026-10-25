import Foundation

public struct AcademicIntelligenceResponse: Codable, Sendable {
    public let success: Bool
    public let message: String
    public let data: AcademicIntelligenceSummary

    public init(success: Bool, message: String, data: AcademicIntelligenceSummary) {
        self.success = success
        self.message = message
        self.data = data
    }
}

public struct AcademicIntelligenceSummary: Codable, Sendable {
    public let referenceDate: String
    public let timezone: String
    public let upcomingWindowDays: Int
    public let totalItemsEvaluated: Int
    public let totalInsightsGenerated: Int
    public let countsByCategory: AcademicCountsByCategory
    public let insights: [AcademicInsight]
    public let briefing: DailyBriefing?
    public let conflicts: [ScheduleConflict]?

    public init(
        referenceDate: String,
        timezone: String,
        upcomingWindowDays: Int,
        totalItemsEvaluated: Int,
        totalInsightsGenerated: Int,
        countsByCategory: AcademicCountsByCategory,
        insights: [AcademicInsight],
        briefing: DailyBriefing? = nil,
        conflicts: [ScheduleConflict]? = nil
    ) {
        self.referenceDate = referenceDate
        self.timezone = timezone
        self.upcomingWindowDays = upcomingWindowDays
        self.totalItemsEvaluated = totalItemsEvaluated
        self.totalInsightsGenerated = totalInsightsGenerated
        self.countsByCategory = countsByCategory
        self.insights = insights
        self.briefing = briefing
        self.conflicts = conflicts
    }
}

public struct AcademicCountsByCategory: Codable, Sendable {
    public let overdue: Int
    public let due_today: Int
    public let due_tomorrow: Int
    public let upcoming: Int

    public init(overdue: Int, due_today: Int, due_tomorrow: Int, upcoming: Int) {
        self.overdue = overdue
        self.due_today = due_today
        self.due_tomorrow = due_tomorrow
        self.upcoming = upcoming
    }
}

public struct AcademicInsight: Identifiable, Codable, Sendable {
    public let id: String
    public let itemId: StringOrInt
    public let itemType: String // "tugas" | "ujian"
    public let title: String
    public let courseName: String?
    public let category: String // "overdue" | "due_today" | "due_tomorrow" | "upcoming"
    public let priority: String // "urgent" | "high" | "medium" | "low"
    public let priorityScore: Int
    public let daysDifference: Int
    public let targetDate: String
    public let referenceDate: String
    public let timezone: String
    public let reason: String
    public let actionRecommendation: String?

    public init(
        id: String,
        itemId: StringOrInt,
        itemType: String,
        title: String,
        courseName: String?,
        category: String,
        priority: String,
        priorityScore: Int,
        daysDifference: Int,
        targetDate: String,
        referenceDate: String,
        timezone: String,
        reason: String,
        actionRecommendation: String? = nil
    ) {
        self.id = id
        self.itemId = itemId
        self.itemType = itemType
        self.title = title
        self.courseName = courseName
        self.category = category
        self.priority = priority
        self.priorityScore = priorityScore
        self.daysDifference = daysDifference
        self.targetDate = targetDate
        self.referenceDate = referenceDate
        self.timezone = timezone
        self.reason = reason
        self.actionRecommendation = actionRecommendation
    }
}

public struct DailyBriefing: Codable, Sendable {
    public let date: String
    public let dayName: String
    public let todayClassesCount: Int
    public let todayTotalSks: Int
    public let overdueTasksCount: Int
    public let dueTodayTasksCount: Int
    public let upcomingExamsCount: Int
    public let headline: String
    public let status: String // "calm" | "moderate" | "heavy" | "urgent"

    public init(
        date: String,
        dayName: String,
        todayClassesCount: Int,
        todayTotalSks: Int,
        overdueTasksCount: Int,
        dueTodayTasksCount: Int,
        upcomingExamsCount: Int,
        headline: String,
        status: String
    ) {
        self.date = date
        self.dayName = dayName
        self.todayClassesCount = todayClassesCount
        self.todayTotalSks = todayTotalSks
        self.overdueTasksCount = overdueTasksCount
        self.dueTodayTasksCount = dueTodayTasksCount
        self.upcomingExamsCount = upcomingExamsCount
        self.headline = headline
        self.status = status
    }
}

public struct ScheduleConflict: Identifiable, Codable, Sendable {
    public let id: String
    public let day: String
    public let item1: ConflictItem
    public let item2: ConflictItem
    public let reason: String

    public init(id: String, day: String, item1: ConflictItem, item2: ConflictItem, reason: String) {
        self.id = id
        self.day = day
        self.item1 = item1
        self.item2 = item2
        self.reason = reason
    }
}

public struct ConflictItem: Codable, Sendable {
    public let id: Int
    public let title: String
    public let time: String
    public let type: String

    public init(id: Int, title: String, time: String, type: String) {
        self.id = id
        self.title = title
        self.time = time
        self.type = type
    }
}

public enum StringOrInt: Codable, Sendable, Hashable {
    case string(String)
    case int(Int)

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let intVal = try? container.decode(Int.self) {
            self = .int(intVal)
        } else if let strVal = try? container.decode(String.self) {
            self = .string(strVal)
        } else {
            throw DecodingError.typeMismatch(
                StringOrInt.self,
                DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Expected String or Int")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let s):
            try container.encode(s)
        case .int(let i):
            try container.encode(i)
        }
    }

    public var stringValue: String {
        switch self {
        case .string(let s): return s
        case .int(let i): return String(i)
        }
    }
}
