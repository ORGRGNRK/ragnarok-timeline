import SwiftUI
import AppKit
import TimelineCore

struct MainView: View {
    @EnvironmentObject var store: Store
    @State private var hiddenActors: Set<String> = []
    @State private var host = "all"
    @State private var search = ""
    @State private var follow = true
    @State private var selection: Event.ID?

    private var filtered: [Event] {
        store.events.filter { e in
            !hiddenActors.contains(e.actor)
            && (host == "all" || e.host == host)
            && (search.isEmpty || e.title.localizedCaseInsensitiveContains(search) || e.body.localizedCaseInsensitiveContains(search))
        }
    }

    private var actorCounts: [(String, Int)] {
        var c: [String: Int] = [:]
        for e in store.events { c[e.actor, default: 0] += 1 }
        return c.sorted { (Actors.order.firstIndex(of: $0.key) ?? 99, $0.key) < (Actors.order.firstIndex(of: $1.key) ?? 99, $1.key) }
    }

    var body: some View {
        HSplitView {
            sidebar.frame(minWidth: 210, idealWidth: 230, maxWidth: 300)
            timeline.frame(minWidth: 420)
            detail.frame(minWidth: 320, idealWidth: 420)
        }
    }

    private var sidebar: some View {
        List {
            Section("Who") {
                ForEach(actorCounts, id: \.0) { actor, n in
                    Toggle(isOn: Binding(get: { !hiddenActors.contains(actor) },
                                         set: { on in if on { hiddenActors.remove(actor) } else { hiddenActors.insert(actor) } })) {
                        HStack { Circle().fill(Palette.color(actor)).frame(width: 9, height: 9); Text(actor); Spacer(); Text("\(n)").foregroundStyle(.secondary).monospacedDigit() }
                    }
                }
            }
            Section("Where") {
                Picker("Host", selection: $host) { Text("All").tag("all"); Text("Mac").tag("mac"); Text("Remote").tag("remote") }
                    .pickerStyle(.segmented).labelsHidden()
            }
            Section("Feeds") {
                ForEach(store.feedStatus.sorted { $0.key < $1.key }, id: \.key) { name, status in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(name).font(.caption.bold())
                        Text(status).font(.caption2).foregroundStyle(status.hasPrefix("live") ? .green : .orange)
                    }
                }
            }
            Section("Build") {
                Text(Self.buildLabel)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
                    .textSelection(.enabled)
            }
        }
        .listStyle(.sidebar)
    }

    /// Running build: "v<CFBundleShortVersionString> · <commit>" ('dev' if the bundle's commit file is missing).
    private static let buildLabel: String = {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "?"
        let commit = Bundle.main.url(forResource: "commit", withExtension: nil)
            .flatMap { try? String(contentsOf: $0, encoding: .utf8) }?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let shown = (commit?.isEmpty == false) ? commit! : "dev"
        return "v\(version) · \(shown)"
    }()

    private var timeline: some View {
        VStack(spacing: 0) {
            HStack {
                TextField("Search everything", text: $search).textFieldStyle(.roundedBorder)
                Toggle("Follow live", isOn: $follow).toggleStyle(.switch).controlSize(.small)
                Text("\(filtered.count)").foregroundStyle(.secondary).monospacedDigit()
            }
            .padding(8)
            Divider()
            ScrollViewReader { proxy in
                List(filtered, selection: $selection) { e in
                    Row(e: e).id(e.id)
                        .contextMenu {
                            Button("Copy Title") { Clipboard.copy(e.title) }
                            Button("Copy Body") { Clipboard.copy(e.body) }
                            Button("Copy Event") { Clipboard.copy(e.asText) }
                            Button("Copy Event as Image") { Clipboard.copy(image: EventCard(e: e).frame(width: 520)) }
                        }
                }
                .listStyle(.plain)
                // ⌘C on the selected row copies the whole event as text.
                .onCopyCommand {
                    guard let id = selection, let e = store.events.first(where: { $0.id == id }) else { return [] }
                    return [NSItemProvider(object: e.asText as NSString)]
                }
                .onChange(of: store.events.count) {
                    if follow, let last = filtered.last { proxy.scrollTo(last.id, anchor: .bottom) }
                }
            }
            Divider()
            Text("Local activity records · attribution is reported, not authenticated · coverage depends on your hooks")
                .font(.caption).foregroundStyle(.secondary).padding(8)
        }
    }

    private var detail: some View {
        Group {
            if let id = selection, let e = store.events.first(where: { $0.id == id }) {
                VStack(spacing: 0) {
                    HStack(spacing: 6) {
                        Spacer()
                        Button { Clipboard.copy(e.body) } label: { Label("Copy Body", systemImage: "doc.on.doc") }
                        Button { Clipboard.copy(e.asText) } label: { Label("Copy Event", systemImage: "doc.plaintext") }
                        Button { Clipboard.copy(image: EventCard(e: e).frame(width: 520)) } label: { Label("Copy as Image", systemImage: "photo") }
                    }
                    .controlSize(.small)
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    Divider()
                    ScrollView {
                        VStack(alignment: .leading, spacing: 8) {
                            EventCard(e: e).textSelection(.enabled)

                        }
                        .padding(12)
                    }
                }
            } else {
                Text("Pick an event to read all of it.").foregroundStyle(.secondary).frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
}

/// The readable part of an event; shown in the detail pane and rendered for "Copy as Image".
struct EventCard: View {
    let e: Event
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(e.actor).bold().foregroundStyle(Palette.color(e.actor))
                Text("· \(e.host) · \(e.source) · \(e.kind)").foregroundStyle(.secondary)
            }
            Text(e.time.formatted(date: .abbreviated, time: .standard)).font(.caption).foregroundStyle(.secondary)
            Text("session \(e.session)").font(.caption).foregroundStyle(.secondary)
            Divider()
            Text(e.body).font(.system(.body, design: .monospaced))
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

enum Clipboard {
    static func copy(_ text: String) {
        let pb = NSPasteboard.general
        pb.clearContents()
        pb.setString(text, forType: .string)
    }

    static func copy(nsImage: NSImage) {
        let pb = NSPasteboard.general
        pb.clearContents()
        pb.writeObjects([nsImage])
    }

    /// Renders a view to a bitmap and puts it on the clipboard.
    @MainActor
    static func copy<V: View>(image view: V) {
        let r = ImageRenderer(content: view.padding(16).background(Color(nsColor: .windowBackgroundColor)))
        r.scale = NSScreen.main?.backingScaleFactor ?? 2
        if let img = r.nsImage { copy(nsImage: img) }
    }

    /// Absolute paths to existing image files mentioned in a body (e.g. screenshots an AI read or wrote).
    static func imagePaths(in body: String) -> [String] {
        let exts: Set<String> = ["png", "jpg", "jpeg", "gif", "heic", "webp", "tiff", "tif", "bmp"]
        let seps = CharacterSet.whitespacesAndNewlines.union(CharacterSet(charactersIn: "\"'`,()[]{}<>"))
        var found: [String] = []
        for raw in body.components(separatedBy: seps) {
            var t = raw.trimmingCharacters(in: CharacterSet(charactersIn: ".:;"))
            if t.hasPrefix("~/") { t = (t as NSString).expandingTildeInPath }
            guard t.hasPrefix("/"), exts.contains((t as NSString).pathExtension.lowercased()),
                  !found.contains(t), FileManager.default.fileExists(atPath: t) else { continue }
            found.append(t)
            if found.count >= 8 { break }
        }
        return found
    }
}

extension Event {
    /// Whole event as plain text, for the clipboard.
    var asText: String {
        "\(time.formatted(date: .abbreviated, time: .standard)) · \(actor) · \(host) · \(source) · \(kind) · session \(session)\n\(body)"
    }
}

struct Row: View {
    let e: Event
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(e.time.formatted(date: .omitted, time: .standard)).font(.caption.monospacedDigit()).foregroundStyle(.secondary)
            Text(e.actor).font(.caption.bold()).foregroundStyle(Palette.color(e.actor)).frame(width: 58, alignment: .leading)
            Text(e.host == "mac" ? "MAC" : e.host.uppercased()).font(.caption2).foregroundStyle(.secondary)
            Text(e.kind).font(.caption2).padding(.horizontal, 4).background(.quaternary, in: Capsule())
            Text(e.title).lineLimit(1).truncationMode(.tail)
        }
    }
}

enum Palette {
    static func color(_ actor: String) -> Color {
        switch actor {
        case "human": return .blue
        case "claude": return .orange
        case "antigravity": return .purple
        case "grok": return .gray
        case "codex": return .green
        case "gemini": return .indigo
        default: return .secondary
        }
    }
}
