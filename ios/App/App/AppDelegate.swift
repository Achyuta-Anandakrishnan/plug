import UIKit
import SwiftUI
import AuthenticationServices
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let host = UIHostingController(rootView: NativeRootView())
        host.view.backgroundColor = .clear

        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = host
        window.makeKeyAndVisible()
        self.window = window
        return true
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication,
                     continue userActivity: NSUserActivity,
                     restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}

// MARK: - Models

struct NativeAuthResponse: Decodable {
    let token: String
    let user: NativeSessionUser
}

struct NativeSessionUser: Decodable, Identifiable {
    let id: String
    let email: String?
    let role: String?
    let username: String?
    let displayName: String?
    let image: String?
}

struct NativeCategory: Decodable, Identifiable {
    let id: String
    let name: String
    let slug: String
}

struct NativeAuctionImage: Decodable, Identifiable {
    let id: String
    let url: String
    let isPrimary: Bool?
}

struct NativeAuctionItem: Decodable {
    let images: [NativeAuctionImage]
}

struct NativeAuctionCategory: Decodable {
    let name: String?
}

struct NativeAuctionSellerUser: Decodable {
    let displayName: String?
    let id: String?
}

struct NativeAuctionSeller: Decodable {
    let status: String?
    let user: NativeAuctionSellerUser?
    let userId: String?
}

struct NativeStreamSession: Decodable, Identifiable {
    let id: String
    let auctionId: String?
    let status: String
    let createdAt: String
    let updatedAt: String
}

struct NativeAuction: Decodable, Identifiable {
    let id: String
    let title: String
    let description: String?
    let status: String?
    let currentBid: Int
    let buyNowPrice: Int?
    let currency: String
    let listingType: String
    let watchersCount: Int
    let startTime: String?
    let endTime: String?
    let extendedTime: String?
    let category: NativeAuctionCategory?
    let seller: NativeAuctionSeller?
    let item: NativeAuctionItem?
    let streamSessions: [NativeStreamSession]?
}

struct NativeChatSender: Decodable {
    let displayName: String?
}

struct NativeAuctionChatMessage: Decodable, Identifiable {
    let id: String
    let body: String
    let createdAt: String
    let sender: NativeChatSender?
}

struct NativeConversationParticipantUser: Decodable {
    let id: String
    let username: String?
    let displayName: String?
}

struct NativeConversationParticipant: Decodable, Identifiable {
    let id: String
    let user: NativeConversationParticipantUser
}

struct NativeConversationMessagePreview: Decodable, Identifiable {
    let id: String
    let body: String
    let createdAt: String
}

struct NativeConversation: Decodable, Identifiable {
    let id: String
    let subject: String?
    let participants: [NativeConversationParticipant]
    let messages: [NativeConversationMessagePreview]
}

struct NativeDirectMessageSender: Decodable {
    let id: String
    let displayName: String?
}

struct NativeDirectMessage: Decodable, Identifiable {
    let id: String
    let conversationId: String
    let senderId: String
    let body: String
    let createdAt: String
    let sender: NativeDirectMessageSender?
}

struct NativeProfile: Decodable {
    let id: String
    let email: String?
    let role: String?
    let username: String?
    let displayName: String?
    let bio: String?
    let image: String?
}

private struct APIErrorResponse: Decodable {
    let error: String
}

private enum APIError: Error, LocalizedError {
    case invalidURL
    case requestFailed(String)
    case decodingFailed

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid API URL."
        case .requestFailed(let message):
            return message
        case .decodingFailed:
            return "Unable to parse server response."
        }
    }
}

// MARK: - API Client

struct NativeAPIClient {
    let baseURL: String

    init() {
        if let configured = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
           !configured.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            baseURL = configured
        } else {
            baseURL = "https://plug-chi.vercel.app"
        }
    }

    private func makeURL(path: String, query: [URLQueryItem] = []) -> URL? {
        var normalizedPath = path
        if !normalizedPath.hasPrefix("/") {
            normalizedPath = "/\(normalizedPath)"
        }

        guard var components = URLComponents(string: baseURL + normalizedPath) else {
            return nil
        }
        if !query.isEmpty {
            components.queryItems = query
        }
        return components.url
    }

    func makeExternalURL(path: String, query: [URLQueryItem] = []) -> URL? {
        makeURL(path: path, query: query)
    }

    func request<T: Decodable>(
        path: String,
        method: String = "GET",
        token: String? = nil,
        query: [URLQueryItem] = [],
        bodyData: Data? = nil
    ) async throws -> T {
        guard let url = makeURL(path: path, query: query) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let bodyData {
            request.httpBody = bodyData
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.requestFailed("Network response was invalid.")
        }

        guard (200...299).contains(http.statusCode) else {
            if let payload = try? JSONDecoder().decode(APIErrorResponse.self, from: data) {
                throw APIError.requestFailed(payload.error)
            }
            let message = String(data: data, encoding: .utf8) ?? "Request failed."
            throw APIError.requestFailed(message)
        }

        if T.self == EmptyResponse.self {
            return EmptyResponse() as! T
        }

        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decodingFailed
        }
    }

    func makeJSONBody(_ payload: [String: Any]) throws -> Data {
        try JSONSerialization.data(withJSONObject: payload)
    }
}

private struct EmptyResponse: Decodable {}

final class NativeAuthPresentationContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first(where: { $0.isKeyWindow }) ?? ASPresentationAnchor()
    }
}

// MARK: - App Store

@MainActor
final class NativeAppStore: ObservableObject {
    @Published var sessionUser: NativeSessionUser?
    @Published var profile: NativeProfile?

    @Published var categories: [NativeCategory] = []
    @Published var homeAuctions: [NativeAuction] = []
    @Published var streamAuctions: [NativeAuction] = []
    @Published var scheduledStreamAuctions: [NativeAuction] = []
    @Published var listingAuctions: [NativeAuction] = []

    @Published var conversations: [NativeConversation] = []
    @Published var conversationMessages: [String: [NativeDirectMessage]] = [:]
    @Published var auctionChatMessages: [String: [NativeAuctionChatMessage]] = [:]

    @Published var loading = false
    @Published var bannerMessage: String?

    private let tokenKey = "native.auth.token"
    private let client = NativeAPIClient()
    private let authPresentationContextProvider = NativeAuthPresentationContextProvider()
    private var authSession: ASWebAuthenticationSession?

    var authToken: String? {
        UserDefaults.standard.string(forKey: tokenKey)
    }

    func bootstrap() async {
        if authToken != nil {
            await refreshAll()
            await refreshProfile()
        }
    }

    func signOut() {
        UserDefaults.standard.removeObject(forKey: tokenKey)
        sessionUser = nil
        profile = nil
        categories = []
        homeAuctions = []
        streamAuctions = []
        scheduledStreamAuctions = []
        listingAuctions = []
        conversations = []
        conversationMessages = [:]
        auctionChatMessages = [:]
        bannerMessage = "Signed out."
    }

    func signIn(email: String, displayName: String) async {
        let normalized = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty else {
            bannerMessage = "Email is required."
            return
        }

        loading = true
        defer { loading = false }

        do {
            let body = try client.makeJSONBody([
                "email": normalized,
                "displayName": displayName.trimmingCharacters(in: .whitespacesAndNewlines),
            ])
            let response: NativeAuthResponse = try await client.request(
                path: "/api/native/auth",
                method: "POST",
                bodyData: body
            )

            UserDefaults.standard.set(response.token, forKey: tokenKey)
            sessionUser = response.user
            bannerMessage = "Connected."
            await refreshAll()
            await refreshProfile()
        } catch {
            bannerMessage = error.localizedDescription
        }
    }

    func signInWithGoogle() {
        if loading { return }
        loading = true
        bannerMessage = nil

        guard let authURL = client.makeExternalURL(
            path: "/api/native/auth/google/start",
            query: [URLQueryItem(name: "redirect_uri", value: "dalow://auth/native")]
        ) else {
            loading = false
            bannerMessage = "Invalid Google auth URL."
            return
        }

        let session = ASWebAuthenticationSession(
            url: authURL,
            callbackURLScheme: "dalow"
        ) { [weak self] callbackURL, error in
            Task { @MainActor in
                guard let self else { return }
                defer {
                    self.loading = false
                    self.authSession = nil
                }

                if let sessionError = error as? ASWebAuthenticationSessionError,
                   sessionError.code == .canceledLogin {
                    self.bannerMessage = "Google sign-in canceled."
                    return
                }
                if let error {
                    self.bannerMessage = error.localizedDescription
                    return
                }
                guard let callbackURL else {
                    self.bannerMessage = "Google sign-in did not return a callback."
                    return
                }

                guard let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false) else {
                    self.bannerMessage = "Invalid Google callback."
                    return
                }

                let queryItems = components.queryItems ?? []
                if let authError = queryItems.first(where: { $0.name == "error" })?.value,
                   !authError.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    self.bannerMessage = authError
                    return
                }

                guard let token = queryItems.first(where: { $0.name == "token" })?.value,
                      !token.isEmpty else {
                    self.bannerMessage = "Missing native auth token from Google callback."
                    return
                }

                UserDefaults.standard.set(token, forKey: self.tokenKey)
                self.bannerMessage = "Connected with Google."
                await self.refreshAll()
                await self.refreshProfile()
            }
        }

        session.presentationContextProvider = authPresentationContextProvider
        session.prefersEphemeralWebBrowserSession = true
        authSession = session

        if !session.start() {
            loading = false
            authSession = nil
            bannerMessage = "Unable to open Google sign-in."
        }
    }

    func refreshAll() async {
        guard let token = authToken else { return }
        loading = true
        defer { loading = false }

        async let categoriesTask: [NativeCategory] = fetchCategories(token: token)
        async let homeTask: [NativeAuction] = fetchAuctions(token: token, view: nil, limit: 10)
        async let streamsTask: [NativeAuction] = fetchAuctions(token: token, status: "LIVE", view: "streams", limit: 30)
        async let scheduledStreamsTask: [NativeAuction] = fetchAuctions(token: token, status: "SCHEDULED", view: "streams", limit: 30)
        async let listingsTask: [NativeAuction] = fetchAuctions(token: token, view: "listings", limit: 30)
        async let conversationsTask: [NativeConversation] = fetchConversations(token: token)

        do {
            categories = try await categoriesTask
            homeAuctions = try await homeTask
            streamAuctions = try await streamsTask
            scheduledStreamAuctions = try await scheduledStreamsTask
            listingAuctions = try await listingsTask
            conversations = try await conversationsTask
        } catch {
            bannerMessage = error.localizedDescription
        }
    }

    func refreshProfile() async {
        guard let token = authToken else { return }
        do {
            let response: NativeProfile = try await client.request(path: "/api/profile", token: token)
            profile = response
            if sessionUser == nil {
                sessionUser = NativeSessionUser(
                    id: response.id,
                    email: response.email,
                    role: response.role,
                    username: response.username,
                    displayName: response.displayName,
                    image: response.image
                )
            }
        } catch {
            bannerMessage = error.localizedDescription
        }
    }

    private func fetchCategories(token: String) async throws -> [NativeCategory] {
        try await client.request(path: "/api/categories", token: token)
    }

    private func fetchAuctions(
        token: String,
        status: String = "LIVE",
        view: String?,
        limit: Int
    ) async throws -> [NativeAuction] {
        var query = [
            URLQueryItem(name: "status", value: status),
            URLQueryItem(name: "limit", value: String(limit)),
        ]
        if let view {
            query.append(URLQueryItem(name: "view", value: view))
        }
        return try await client.request(path: "/api/auctions", token: token, query: query)
    }

    private func fetchConversations(token: String) async throws -> [NativeConversation] {
        try await client.request(path: "/api/conversations", token: token)
    }

    func loadConversationMessages(conversationId: String) async {
        guard let token = authToken else { return }
        do {
            let messages: [NativeDirectMessage] = try await client.request(
                path: "/api/conversations/\(conversationId)/messages",
                token: token
            )
            conversationMessages[conversationId] = messages
        } catch {
            bannerMessage = error.localizedDescription
        }
    }

    func sendConversationMessage(conversationId: String, body: String) async {
        guard let token = authToken else { return }
        let text = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }

        do {
            let payload = try client.makeJSONBody(["body": text])
            let _: NativeDirectMessage = try await client.request(
                path: "/api/conversations/\(conversationId)/messages",
                method: "POST",
                token: token,
                bodyData: payload
            )
            await loadConversationMessages(conversationId: conversationId)
            let latestConversations: [NativeConversation] = try await client.request(path: "/api/conversations", token: token)
            conversations = latestConversations
        } catch {
            bannerMessage = error.localizedDescription
        }
    }

    func loadAuctionChat(auctionId: String) async {
        guard let token = authToken else { return }
        do {
            let messages: [NativeAuctionChatMessage] = try await client.request(
                path: "/api/auctions/\(auctionId)/chat",
                token: token
            )
            auctionChatMessages[auctionId] = messages
        } catch {
            bannerMessage = error.localizedDescription
        }
    }

    func sendAuctionChat(auctionId: String, body: String) async {
        guard let token = authToken else { return }
        let text = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }

        do {
            let payload = try client.makeJSONBody(["body": text])
            let _: NativeAuctionChatMessage = try await client.request(
                path: "/api/auctions/\(auctionId)/chat",
                method: "POST",
                token: token,
                bodyData: payload
            )
            await loadAuctionChat(auctionId: auctionId)
        } catch {
            bannerMessage = error.localizedDescription
        }
    }

    func placeBid(auctionId: String, amountCents: Int) async {
        guard let token = authToken else { return }
        guard amountCents > 0 else {
            bannerMessage = "Bid amount must be greater than 0."
            return
        }

        do {
            let payload = try client.makeJSONBody(["amount": amountCents])
            let _: [String: String] = try await client.request(
                path: "/api/auctions/\(auctionId)/bids",
                method: "POST",
                token: token,
                bodyData: payload
            )
            bannerMessage = "Bid sent."
            await refreshAll()
        } catch {
            bannerMessage = error.localizedDescription
        }
    }

    func buyNow(auctionId: String) async {
        guard let token = authToken else { return }
        do {
            let payload = try client.makeJSONBody([:])
            let _: [String: AnyDecodable] = try await client.request(
                path: "/api/auctions/\(auctionId)/buy",
                method: "POST",
                token: token,
                bodyData: payload
            )
            bannerMessage = "Order started."
            await refreshAll()
        } catch {
            bannerMessage = error.localizedDescription
        }
    }

    func startStream(auctionId: String? = nil, scheduleAt: Date? = nil) async -> String? {
        guard let token = authToken else { return nil }
        do {
            var body: [String: Any] = [:]
            if let auctionId, !auctionId.isEmpty {
                body["auctionId"] = auctionId
            }
            if let scheduleAt {
                body["scheduleAt"] = ISO8601DateFormatter().string(from: scheduleAt)
            }

            let payload = try client.makeJSONBody(body)
            let session: NativeStreamSession = try await client.request(
                path: "/api/streams/session",
                method: "POST",
                token: token,
                bodyData: payload
            )
            await refreshAll()
            bannerMessage = scheduleAt == nil ? "Stream ready." : "Stream scheduled."
            return session.auctionId
        } catch {
            bannerMessage = error.localizedDescription
            return nil
        }
    }

    func endStream(auctionId: String) async {
        guard let token = authToken else { return }
        do {
            let payload = try client.makeJSONBody([
                "auctionId": auctionId,
                "status": "ENDED",
            ])
            let _: NativeStreamSession = try await client.request(
                path: "/api/streams/session",
                method: "PATCH",
                token: token,
                bodyData: payload
            )
            bannerMessage = "Stream ended."
            await refreshAll()
        } catch {
            bannerMessage = error.localizedDescription
        }
    }

    func saveProfile(username: String, displayName: String, bio: String) async {
        guard let token = authToken else { return }
        do {
            let payload = try client.makeJSONBody([
                "username": username.trimmingCharacters(in: .whitespacesAndNewlines),
                "displayName": displayName.trimmingCharacters(in: .whitespacesAndNewlines),
                "bio": bio.trimmingCharacters(in: .whitespacesAndNewlines),
            ])
            let updated: NativeProfile = try await client.request(
                path: "/api/profile",
                method: "PUT",
                token: token,
                bodyData: payload
            )
            profile = updated
            bannerMessage = "Profile updated."
        } catch {
            bannerMessage = error.localizedDescription
        }
    }

    func clearBanner() {
        bannerMessage = nil
    }
}

// MARK: - Decoding helpers

struct AnyDecodable: Decodable {}

// MARK: - Theme

enum NativeThemeMode: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    var id: String { rawValue }

    var title: String {
        switch self {
        case .system: return "System"
        case .light: return "Light"
        case .dark: return "Dark"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }
}

// MARK: - UI Modifiers

struct GlassPanelModifier: ViewModifier {
    var cornerRadius: CGFloat = 24

    func body(content: Content) -> some View {
        content
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(Color.white.opacity(0.34), lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.16), radius: 16, y: 8)
    }
}

extension View {
    func glassPanel(_ radius: CGFloat = 24) -> some View {
        modifier(GlassPanelModifier(cornerRadius: radius))
    }
}

struct NativeBackdropView: View {
    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.05, green: 0.06, blue: 0.10), Color(red: 0.01, green: 0.02, blue: 0.04)], startPoint: .topLeading, endPoint: .bottomTrailing)
                .ignoresSafeArea()

            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(Color.white.opacity(0.08))
                .frame(width: 220, height: 180)
                .rotationEffect(.degrees(-15))
                .offset(x: -140, y: -320)

            RoundedRectangle(cornerRadius: 30, style: .continuous)
                .fill(Color(red: 0.18, green: 0.20, blue: 0.27).opacity(0.26))
                .frame(width: 210, height: 170)
                .rotationEffect(.degrees(18))
                .offset(x: 140, y: -260)

            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(Color(red: 0.12, green: 0.14, blue: 0.19).opacity(0.34))
                .frame(width: 150, height: 120)
                .rotationEffect(.degrees(-10))
                .offset(x: 120, y: 330)

            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color.white.opacity(0.12))
                .frame(width: 120, height: 95)
                .rotationEffect(.degrees(9))
                .offset(x: -130, y: 300)
        }
    }
}

// MARK: - Root

struct NativeRootView: View {
    @StateObject private var store = NativeAppStore()
    @AppStorage("native.theme.mode") private var themeModeRaw = NativeThemeMode.system.rawValue

    private var themeMode: NativeThemeMode {
        NativeThemeMode(rawValue: themeModeRaw) ?? .system
    }

    var body: some View {
        ZStack {
            NativeBackdropView()

            if store.authToken == nil {
                NativeAuthView(store: store)
                    .padding(.horizontal, 18)
            } else {
                NativeMainTabView(store: store, themeModeRaw: $themeModeRaw)
            }

            if let banner = store.bannerMessage {
                VStack {
                    Spacer()
                    Text(banner)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(Color.black.opacity(0.72), in: Capsule())
                        .padding(.bottom, 18)
                        .onTapGesture { store.clearBanner() }
                }
                .transition(.opacity)
            }
        }
        .task { await store.bootstrap() }
        .preferredColorScheme(themeMode.colorScheme)
    }
}

// MARK: - Auth

struct NativeCheckersIndicator: View {
    private let pathA: [CGPoint] = [
        CGPoint(x: 0.06, y: 0.06),
        CGPoint(x: 0.28, y: 0.28),
        CGPoint(x: 0.50, y: 0.06),
        CGPoint(x: 0.72, y: 0.28)
    ]

    private let pathB: [CGPoint] = [
        CGPoint(x: 0.72, y: 0.72),
        CGPoint(x: 0.50, y: 0.50),
        CGPoint(x: 0.28, y: 0.72),
        CGPoint(x: 0.06, y: 0.50)
    ]

    var body: some View {
        TimelineView(.animation) { context in
            let a = interpolatedPoint(for: context.date, path: pathA, speed: 2.2)
            let b = interpolatedPoint(for: context.date, path: pathB, speed: 2.5)

            ZStack {
                RoundedRectangle(cornerRadius: 4, style: .continuous)
                    .fill(Color.white.opacity(0.08))

                VStack(spacing: 0) {
                    ForEach(0..<8, id: \.self) { row in
                        HStack(spacing: 0) {
                            ForEach(0..<8, id: \.self) { col in
                                Rectangle()
                                    .fill((row + col).isMultiple(of: 2) ? Color.white.opacity(0.88) : Color.black.opacity(0.9))
                            }
                        }
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))

                GeometryReader { proxy in
                    let width = proxy.size.width
                    let pieceSize = width * 0.14

                    Circle()
                        .fill(Color.white.opacity(0.96))
                        .overlay(Circle().stroke(Color.black.opacity(0.25), lineWidth: 0.5))
                        .frame(width: pieceSize, height: pieceSize)
                        .position(x: width * a.x, y: width * a.y)

                    Circle()
                        .fill(Color.black.opacity(0.95))
                        .overlay(Circle().stroke(Color.white.opacity(0.25), lineWidth: 0.5))
                        .frame(width: pieceSize, height: pieceSize)
                        .position(x: width * b.x, y: width * b.y)
                }
            }
        }
        .frame(width: 18, height: 18)
        .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
    }

    private func interpolatedPoint(for date: Date, path: [CGPoint], speed: Double) -> CGPoint {
        let total = speed
        let steps = Double(path.count)
        let perStep = total / steps
        let now = date.timeIntervalSinceReferenceDate
        let local = now.truncatingRemainder(dividingBy: total)
        let index = Int(local / perStep)
        let nextIndex = (index + 1) % path.count
        let progress = (local - (Double(index) * perStep)) / perStep
        let start = path[index]
        let end = path[nextIndex]
        return CGPoint(
            x: start.x + (end.x - start.x) * progress,
            y: start.y + (end.y - start.y) * progress
        )
    }
}

struct NativeAuthView: View {
    @ObservedObject var store: NativeAppStore
    @State private var email = ""
    @State private var displayName = ""

    var body: some View {
        VStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Text("dalow")
                    .font(.system(size: 34, weight: .black, design: .rounded))
                    .foregroundStyle(.white)
                Text("Native iOS")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .textCase(.uppercase)
                    .tracking(2)
                    .foregroundStyle(.white.opacity(0.75))
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            VStack(spacing: 10) {
                Button {
                    store.signInWithGoogle()
                } label: {
                    HStack {
                        if store.loading {
                            NativeCheckersIndicator()
                        }
                        Image(systemName: "globe")
                            .font(.system(size: 14, weight: .semibold))
                        Text(store.loading ? "Connecting..." : "Continue with Google")
                            .font(.system(size: 15, weight: .bold))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .foregroundStyle(.white)
                    .background(
                        LinearGradient(colors: [Color(red: 0.14, green: 0.17, blue: 0.24), Color(red: 0.05, green: 0.06, blue: 0.10)], startPoint: .leading, endPoint: .trailing),
                        in: RoundedRectangle(cornerRadius: 14, style: .continuous)
                    )
                }
                .disabled(store.loading)

                Text("or email fallback")
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .textCase(.uppercase)
                    .tracking(1.4)
                    .foregroundStyle(Color.white.opacity(0.64))
                    .padding(.top, 2)

                TextField("Email", text: $email)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.emailAddress)
                    .padding(12)
                    .background(Color.white.opacity(0.86), in: RoundedRectangle(cornerRadius: 14, style: .continuous))

                TextField("Display name", text: $displayName)
                    .padding(12)
                    .background(Color.white.opacity(0.86), in: RoundedRectangle(cornerRadius: 14, style: .continuous))

                Button {
                    Task { await store.signIn(email: email, displayName: displayName) }
                } label: {
                    Text(store.loading ? "Connecting..." : "Continue with Email")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .foregroundStyle(.white)
                        .background(Color.white.opacity(0.12), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .disabled(store.loading)
            }
        }
        .padding(18)
        .glassPanel(28)
    }
}

// MARK: - Main tabs

struct NativeMainTabView: View {
    @ObservedObject var store: NativeAppStore
    @Binding var themeModeRaw: String

    var body: some View {
        TabView {
            NavigationStack {
                NativeHomeView(store: store)
            }
            .tabItem {
                Label("Home", systemImage: "house.fill")
            }

            NavigationStack {
                NativeMarketplaceView(title: "Market", mode: .listings, store: store)
            }
            .tabItem {
                Label("Market", systemImage: "square.grid.2x2.fill")
            }

            NavigationStack {
                NativeMessagesView(store: store)
            }
            .tabItem {
                Label("Messages", systemImage: "message.fill")
            }

            NavigationStack {
                NativeSettingsView(store: store, themeModeRaw: $themeModeRaw)
            }
            .tabItem {
                Label("Settings", systemImage: "gearshape.fill")
            }
        }
        .tint(Color(red: 0.82, green: 0.84, blue: 0.90))
    }
}

// MARK: - Home

struct NativeHomeView: View {
    @ObservedObject var store: NativeAppStore

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Anime cards. Minimal flow.")
                        .font(.system(size: 29, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)

                    HStack(spacing: 8) {
                        Chip(text: "Live")
                        Chip(text: "Fast")
                        Chip(text: "Sleek")
                    }

                    NativeWaveDiagram()
                        .frame(height: 94)
                }
                .padding(14)
                .glassPanel(30)

                SectionHeader(title: "Live now")

                NativeAuctionGrid(auctions: store.homeAuctions, store: store)
            }
            .padding(14)
        }
        .navigationTitle("dalow")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await store.refreshAll() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
            }
        }
        .task {
            if store.homeAuctions.isEmpty {
                await store.refreshAll()
            }
        }
    }
}

struct NativeWaveDiagram: View {
    var body: some View {
        GeometryReader { geometry in
            Canvas { context, size in
                let pathA = Path { path in
                    path.move(to: CGPoint(x: 0, y: size.height * 0.65))
                    path.addCurve(
                        to: CGPoint(x: size.width, y: size.height * 0.28),
                        control1: CGPoint(x: size.width * 0.22, y: size.height * 0.05),
                        control2: CGPoint(x: size.width * 0.65, y: size.height * 0.95)
                    )
                }
                context.stroke(pathA, with: .color(Color(red: 0.82, green: 0.84, blue: 0.90)), lineWidth: 4)

                let pathB = Path { path in
                    path.move(to: CGPoint(x: 0, y: size.height * 0.78))
                    path.addCurve(
                        to: CGPoint(x: size.width, y: size.height * 0.52),
                        control1: CGPoint(x: size.width * 0.28, y: size.height * 0.36),
                        control2: CGPoint(x: size.width * 0.72, y: size.height * 0.98)
                    )
                }
                context.stroke(pathB, with: .color(Color.white.opacity(0.56)), lineWidth: 3)
            }
            .background(Color.white.opacity(0.22), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.white.opacity(0.35), lineWidth: 1)
            )
        }
    }
}

// MARK: - Marketplace

enum MarketMode {
    case streams
    case listings
}

struct NativeMarketplaceView: View {
    let title: String
    let mode: MarketMode
    @ObservedObject var store: NativeAppStore

    @State private var selectedCategory = ""
    @State private var streamExpanded = false
    @State private var streamActionLoading = false
    @State private var endingStreamId: String?

    var sourceAuctions: [NativeAuction] {
        mode == .streams ? store.streamAuctions : store.listingAuctions
    }

    var filteredListings: [NativeAuction] {
        guard !selectedCategory.isEmpty else { return sourceAuctions }
        return sourceAuctions.filter { auction in
            let slug = (auction.category?.name ?? "").lowercased()
            return slug.contains(selectedCategory.lowercased())
        }
    }

    var scheduledFutureStreams: [NativeAuction] {
        store.scheduledStreamAuctions.filter { auction in
            guard let startTime = auction.startTime else { return false }
            guard let date = parseISODate(startTime) else { return false }
            return date > Date()
        }
    }

    var railStreams: [NativeAuction] {
        var seen = Set<String>()
        var combined: [NativeAuction] = []
        for stream in (store.streamAuctions + scheduledFutureStreams) {
            if seen.contains(stream.id) { continue }
            seen.insert(stream.id)
            combined.append(stream)
        }
        return combined
    }

    var canManageStreams: Bool {
        let role = store.sessionUser?.role?.uppercased() ?? ""
        return role == "SELLER" || role == "ADMIN"
    }

    private func streamStatusLabel(_ auction: NativeAuction) -> String {
        if auction.streamSessions?.first?.status.uppercased() == "LIVE" {
            return "Live"
        }
        return "Scheduled"
    }

    private func streamMetaLabel(_ auction: NativeAuction) -> String {
        if auction.streamSessions?.first?.status.uppercased() == "LIVE" {
            return "\(auction.watchersCount) watching"
        }
        guard let start = auction.startTime,
              let date = parseISODate(start) else {
            return "Scheduled"
        }
        return date.formatted(date: .abbreviated, time: .shortened)
    }

    private func parseISODate(_ value: String) -> Date? {
        let fractionalFormatter = ISO8601DateFormatter()
        fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractionalFormatter.date(from: value) {
            return date
        }
        return ISO8601DateFormatter().date(from: value)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        FilterChip(label: "All", selected: selectedCategory.isEmpty) {
                            selectedCategory = ""
                        }
                        ForEach(store.categories) { category in
                            FilterChip(label: category.name, selected: selectedCategory == category.slug) {
                                selectedCategory = category.slug
                            }
                        }
                    }
                    .padding(.horizontal, 14)
                }

                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text("Streams")
                            .font(.system(size: 20, weight: .heavy, design: .rounded))
                            .foregroundStyle(.white)
                        Spacer()
                        if canManageStreams {
                            HStack(spacing: 8) {
                                Button(streamActionLoading ? "..." : "Start") {
                                    Task {
                                        streamActionLoading = true
                                        _ = await store.startStream()
                                        streamActionLoading = false
                                    }
                                }
                                .buttonStyle(PrimaryGlassButton())
                                .disabled(streamActionLoading)

                                Button(streamActionLoading ? "..." : "Schedule") {
                                    Task {
                                        streamActionLoading = true
                                        let scheduledTime =
                                            Calendar.current.date(byAdding: .hour, value: 1, to: Date())
                                            ?? Date().addingTimeInterval(3600)
                                        _ = await store.startStream(scheduleAt: scheduledTime)
                                        streamActionLoading = false
                                    }
                                }
                                .buttonStyle(SecondaryGlassButton())
                                .disabled(streamActionLoading)
                            }
                        }
                    }
                    .padding(.horizontal, 14)

                    if railStreams.isEmpty {
                        Text("No live or scheduled streams.")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.white.opacity(0.74))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .glassPanel(16)
                            .padding(.horizontal, 14)
                    } else {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 10) {
                                ForEach(railStreams) { stream in
                                    let streamImage = stream.item?.images.first(where: { $0.isPrimary == true })?.url
                                        ?? stream.item?.images.first?.url
                                    let isLive = stream.streamSessions?.first?.status.uppercased() == "LIVE"
                                    let isHost = store.sessionUser?.id == stream.seller?.user?.id

                                    ZStack(alignment: .topTrailing) {
                                        NavigationLink {
                                            NativeAuctionDetailView(store: store, auction: stream)
                                        } label: {
                                            VStack(alignment: .leading, spacing: 8) {
                                                ZStack(alignment: .bottomLeading) {
                                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                                        .fill(Color.white.opacity(0.08))
                                                        .frame(width: 150, height: 188)
                                                    if let streamImage, let url = URL(string: streamImage) {
                                                        AsyncImage(url: url) { image in
                                                            image.resizable().scaledToFill()
                                                        } placeholder: {
                                                            Rectangle().fill(Color.white.opacity(0.16))
                                                        }
                                                        .frame(width: 150, height: 188)
                                                        .clipped()
                                                        .cornerRadius(14)
                                                    }
                                                    Text(streamStatusLabel(stream))
                                                        .font(.system(size: 10, weight: .bold, design: .rounded))
                                                        .textCase(.uppercase)
                                                        .tracking(1.5)
                                                        .padding(.horizontal, 8)
                                                        .padding(.vertical, 4)
                                                        .background(Color.black.opacity(0.55), in: Capsule())
                                                        .foregroundStyle(.white)
                                                        .padding(8)
                                                }
                                                Text(stream.title)
                                                    .font(.system(size: 13, weight: .bold, design: .rounded))
                                                    .foregroundStyle(.white)
                                                    .lineLimit(2)
                                                Text(streamMetaLabel(stream))
                                                    .font(.system(size: 11, weight: .medium))
                                                    .foregroundStyle(.white.opacity(0.76))
                                                    .lineLimit(1)
                                            }
                                            .frame(width: 150)
                                        }
                                        .buttonStyle(.plain)

                                        if isLive && isHost {
                                            Button(endingStreamId == stream.id ? "..." : "End") {
                                                Task {
                                                    endingStreamId = stream.id
                                                    await store.endStream(auctionId: stream.id)
                                                    endingStreamId = nil
                                                }
                                            }
                                            .buttonStyle(SecondaryGlassButton())
                                            .padding(6)
                                        }
                                    }
                                }
                            }
                            .padding(.horizontal, 14)
                        }
                    }

                    HStack {
                        Spacer()
                        Button(streamExpanded ? "Collapse" : "Expand") {
                            streamExpanded.toggle()
                        }
                        .buttonStyle(SecondaryGlassButton())
                    }
                    .padding(.horizontal, 14)

                    if streamExpanded && !railStreams.isEmpty {
                        NativeAuctionGrid(auctions: railStreams, store: store)
                    }
                }

                if mode != .streams {
                    SectionHeader(title: "Cards")
                        .padding(.horizontal, 14)
                    if filteredListings.isEmpty {
                        Text("No listings.")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.white.opacity(0.74))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .glassPanel(16)
                            .padding(.horizontal, 14)
                    } else {
                        NativeAuctionGrid(auctions: filteredListings, store: store)
                    }
                }
            }
            .padding(.vertical, 10)
        }
        .navigationTitle(title)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await store.refreshAll() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
            }
        }
        .task {
            if sourceAuctions.isEmpty {
                await store.refreshAll()
            }
        }
    }
}

struct NativeAuctionGrid: View {
    let auctions: [NativeAuction]
    @ObservedObject var store: NativeAppStore

    private var columns: [GridItem] {
        [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]
    }

    var body: some View {
        LazyVGrid(columns: columns, spacing: 12) {
            ForEach(auctions) { auction in
                NavigationLink {
                    NativeAuctionDetailView(store: store, auction: auction)
                } label: {
                    NativeAuctionCardView(auction: auction)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 14)
    }
}

struct NativeAuctionCardView: View {
    let auction: NativeAuction

    private var imageURL: URL? {
        guard let url = auction.item?.images.first(where: { $0.isPrimary == true })?.url
            ?? auction.item?.images.first?.url else {
            return nil
        }
        return URL(string: url)
    }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(
                    LinearGradient(colors: [Color.white.opacity(0.16), Color(red: 0.16, green: 0.18, blue: 0.24).opacity(0.32)], startPoint: .topLeading, endPoint: .bottomTrailing)
                )
                .frame(height: 246)

            if let imageURL {
                AsyncImage(url: imageURL) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Rectangle().fill(Color.white.opacity(0.16))
                }
                .frame(height: 246)
                .clipped()
                .cornerRadius(20)
            }

            LinearGradient(colors: [Color.black.opacity(0.78), Color.clear], startPoint: .bottom, endPoint: .top)
                .cornerRadius(20)
                .frame(height: 246)

            VStack(alignment: .leading, spacing: 6) {
                Text(auction.title)
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .lineLimit(2)

                Text(auction.seller?.user?.displayName ?? "Seller")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.white.opacity(0.74))
                    .lineLimit(1)

                HStack {
                    Text(currency(auction.currentBid, code: auction.currency))
                    Spacer()
                    Text(timeLabel(auction))
                }
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundStyle(.white)
            }
            .padding(12)
        }
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(Color.white.opacity(0.32), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.18), radius: 12, y: 7)
    }
}

// MARK: - Auction Detail

struct NativeAuctionDetailView: View {
    @ObservedObject var store: NativeAppStore
    let auction: NativeAuction

    @State private var bidInput = ""
    @State private var chatInput = ""

    private var chatMessages: [NativeAuctionChatMessage] {
        store.auctionChatMessages[auction.id] ?? []
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                NativeAuctionCardView(auction: auction)

                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text(currency(auction.currentBid, code: auction.currency))
                            .font(.system(size: 24, weight: .heavy, design: .rounded))
                        Spacer()
                        if let buyNow = auction.buyNowPrice {
                            Text("Buy \(currency(buyNow, code: auction.currency))")
                                .font(.system(size: 12, weight: .semibold, design: .rounded))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(Color.white.opacity(0.2), in: Capsule())
                        }
                    }
                    .foregroundStyle(.white)

                    TextField("Bid (cents)", text: $bidInput)
                        .keyboardType(.numberPad)
                        .padding(10)
                        .background(Color.white.opacity(0.84), in: RoundedRectangle(cornerRadius: 12, style: .continuous))

                    HStack(spacing: 8) {
                        Button("Place bid") {
                            let cents = Int(bidInput) ?? 0
                            Task { await store.placeBid(auctionId: auction.id, amountCents: cents) }
                        }
                        .buttonStyle(PrimaryGlassButton())

                        if auction.buyNowPrice != nil {
                            Button("Buy now") {
                                Task { await store.buyNow(auctionId: auction.id) }
                            }
                            .buttonStyle(SecondaryGlassButton())
                        }
                    }
                }
                .padding(12)
                .glassPanel(20)

                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Chat")
                            .font(.system(size: 17, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                        Spacer()
                    }

                    if chatMessages.isEmpty {
                        Text("No messages yet")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.white.opacity(0.72))
                    } else {
                        ForEach(chatMessages.prefix(12)) { message in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(message.sender?.displayName ?? "User")
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(.white.opacity(0.68))
                                Text(message.body)
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(.white)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(8)
                            .background(Color.white.opacity(0.12), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                        }
                    }

                    HStack(spacing: 8) {
                        TextField("Type message", text: $chatInput)
                            .padding(10)
                            .background(Color.white.opacity(0.84), in: RoundedRectangle(cornerRadius: 12, style: .continuous))

                        Button("Send") {
                            let body = chatInput
                            chatInput = ""
                            Task { await store.sendAuctionChat(auctionId: auction.id, body: body) }
                        }
                        .buttonStyle(PrimaryGlassButton())
                    }
                }
                .padding(12)
                .glassPanel(20)
            }
            .padding(14)
        }
        .navigationTitle("Auction")
        .task {
            await store.loadAuctionChat(auctionId: auction.id)
        }
    }
}

// MARK: - Messages

struct NativeMessagesView: View {
    @ObservedObject var store: NativeAppStore

    var body: some View {
        List {
            ForEach(store.conversations) { conversation in
                NavigationLink {
                    NativeConversationView(store: store, conversation: conversation)
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(conversation.subject ?? conversationTitle(conversation))
                            .font(.system(size: 15, weight: .bold, design: .rounded))

                        if let last = conversation.messages.first {
                            Text(last.body)
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        } else {
                            Text("No messages yet")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }
                .listRowBackground(Color.white.opacity(0.22))
            }
        }
        .scrollContentBackground(.hidden)
        .navigationTitle("Messages")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await store.refreshAll() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
            }
        }
        .task {
            if store.conversations.isEmpty {
                await store.refreshAll()
            }
        }
    }

    private func conversationTitle(_ conversation: NativeConversation) -> String {
        let names = conversation.participants
            .compactMap { $0.user.displayName ?? $0.user.username }
            .prefix(2)
            .joined(separator: " · ")
        return names.isEmpty ? "Conversation" : names
    }
}

struct NativeConversationView: View {
    @ObservedObject var store: NativeAppStore
    let conversation: NativeConversation

    @State private var bodyText = ""

    private var messages: [NativeDirectMessage] {
        store.conversationMessages[conversation.id] ?? []
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 8) {
                    ForEach(messages) { message in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(message.sender?.displayName ?? "User")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(.secondary)
                            Text(message.body)
                                .font(.system(size: 14, weight: .medium))
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(10)
                        .background(Color.white.opacity(0.18), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                }
                .padding(12)
            }

            HStack(spacing: 8) {
                TextField("Message", text: $bodyText)
                    .padding(10)
                    .background(Color.white.opacity(0.86), in: RoundedRectangle(cornerRadius: 12, style: .continuous))

                Button("Send") {
                    let text = bodyText
                    bodyText = ""
                    Task { await store.sendConversationMessage(conversationId: conversation.id, body: text) }
                }
                .buttonStyle(PrimaryGlassButton())
            }
            .padding(12)
            .background(.ultraThinMaterial)
        }
        .navigationTitle(conversation.subject ?? "Thread")
        .task {
            await store.loadConversationMessages(conversationId: conversation.id)
        }
    }
}

// MARK: - Settings

struct NativeSettingsView: View {
    @ObservedObject var store: NativeAppStore
    @Binding var themeModeRaw: String

    @State private var username = ""
    @State private var displayName = ""
    @State private var bio = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Theme")
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)

                    Picker("Theme", selection: $themeModeRaw) {
                        ForEach(NativeThemeMode.allCases) { mode in
                            Text(mode.title).tag(mode.rawValue)
                        }
                    }
                    .pickerStyle(.segmented)
                }
                .padding(12)
                .glassPanel(20)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Profile")
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)

                    TextField("Username", text: $username)
                        .padding(10)
                        .background(Color.white.opacity(0.86), in: RoundedRectangle(cornerRadius: 12, style: .continuous))

                    TextField("Display name", text: $displayName)
                        .padding(10)
                        .background(Color.white.opacity(0.86), in: RoundedRectangle(cornerRadius: 12, style: .continuous))

                    TextField("Bio", text: $bio, axis: .vertical)
                        .lineLimit(3...5)
                        .padding(10)
                        .background(Color.white.opacity(0.86), in: RoundedRectangle(cornerRadius: 12, style: .continuous))

                    Button("Save") {
                        Task {
                            await store.saveProfile(username: username, displayName: displayName, bio: bio)
                        }
                    }
                    .buttonStyle(PrimaryGlassButton())
                }
                .padding(12)
                .glassPanel(20)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Account")
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)

                    Text(store.profile?.email ?? store.sessionUser?.email ?? "")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white.opacity(0.82))

                    Text("Role: \(store.profile?.role ?? store.sessionUser?.role ?? "-")")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.white.opacity(0.72))

                    Text("API: \(NativeAPIClient().baseURL)")
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.62))
                        .lineLimit(2)

                    Button("Sign out") {
                        store.signOut()
                    }
                    .buttonStyle(SecondaryGlassButton())
                }
                .padding(12)
                .glassPanel(20)
            }
            .padding(14)
        }
        .navigationTitle("Settings")
        .task {
            await store.refreshProfile()
            username = store.profile?.username ?? ""
            displayName = store.profile?.displayName ?? ""
            bio = store.profile?.bio ?? ""
        }
    }
}

// MARK: - UI Components

struct SectionHeader: View {
    let title: String

    var body: some View {
        HStack {
            Text(title)
                .font(.system(size: 20, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
            Spacer()
        }
    }
}

struct Chip: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .bold, design: .rounded))
            .textCase(.uppercase)
            .tracking(1.2)
            .foregroundStyle(.white)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color.white.opacity(0.18), in: Capsule())
    }
}

struct FilterChip: View {
    let label: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 11, weight: .bold, design: .rounded))
                .textCase(.uppercase)
                .tracking(1)
                .foregroundStyle(selected ? Color.white : Color.white.opacity(0.82))
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .background(selected ? Color.white.opacity(0.34) : Color.white.opacity(0.18), in: Capsule())
                .overlay(
                    Capsule().stroke(Color.white.opacity(selected ? 0.3 : 0.22), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}

struct PrimaryGlassButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 13, weight: .bold, design: .rounded))
            .foregroundStyle(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
                LinearGradient(colors: [Color(red: 0.14, green: 0.17, blue: 0.24), Color(red: 0.05, green: 0.06, blue: 0.10)], startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12, style: .continuous)
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}

struct SecondaryGlassButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 13, weight: .bold, design: .rounded))
            .foregroundStyle(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color.white.opacity(0.16), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Color.white.opacity(0.3), lineWidth: 1)
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}

// MARK: - Helpers

private func currency(_ cents: Int, code: String) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = code.uppercased()
    let amount = NSDecimalNumber(value: Double(cents) / 100)
    return formatter.string(from: amount) ?? "\(Double(cents) / 100) \(code.uppercased())"
}

private func timeLabel(_ auction: NativeAuction) -> String {
    let targetRaw = auction.extendedTime ?? auction.endTime
    guard let targetRaw,
          let target = ISO8601DateFormatter().date(from: targetRaw) else {
        return "Live"
    }

    let remaining = max(0, Int(target.timeIntervalSinceNow))
    let minutes = remaining / 60
    let seconds = remaining % 60
    return String(format: "%02d:%02d", minutes, seconds)
}
