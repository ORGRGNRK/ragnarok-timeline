import SwiftUI
import TimelineCore
import AppKit
@main struct RagnarokTimelineApp:App {
    @StateObject private var store=Store()
    var body:some Scene {
        WindowGroup("Ragnarok Timeline") {
            MainView().environmentObject(store).frame(minWidth:1000,minHeight:600)
                .onAppear{store.start()}
        }.defaultSize(width:1300,height:800)
    }
}
@MainActor final class Store:ObservableObject {
    @Published private(set) var events:[Event]=[]
    @Published var feedStatus:[String:String]=[:]
    private var timer:Timer?
    private let reader=TailReader()
    private var known=Set<String>()
    private var codexReaders:[String:TailReader]=[:]
    private var ticks=0
    private let folder=FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/Ragnarok Timeline")
    func start() {
        guard timer == nil else{return}
        tick()
        timer=Timer.scheduledTimer(withTimeInterval:1,repeats:true){[weak self] _ in Task{@MainActor in self?.tick()}}
    }
    private func tick() {
        ticks += 1
        if ticks % 5 == 1 {readCodexMetadata()}
        let file=folder.appendingPathComponent("events.jsonl")
        guard FileManager.default.fileExists(atPath:file.path) else {
            feedStatus["Local hooks"]="No records yet. Install hooks, restart your agent, then run a command."
            return
        }
        do {
            let rows=try reader.read(file)
            let incoming=rows.compactMap(ReceiptParser.parse).filter{known.insert($0.id).inserted}
            events.append(contentsOf:incoming);events.sort{$0.time<$1.time}
            if events.count>10000 {events.removeFirst(events.count-10000);known=Set(events.map(\.id))}
            feedStatus["Local hooks"]="live · local file · \(events.count) events loaded"
        } catch {feedStatus["Local hooks"]="Cannot read event file. Check its permissions."}
    }
    private func readCodexMetadata() {
        let root=FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".codex/sessions")
        guard let scan=FileManager.default.enumerator(at:root,includingPropertiesForKeys:[.contentModificationDateKey,.isRegularFileKey,.isSymbolicLinkKey],options:[.skipsHiddenFiles]) else {
            feedStatus["Codex tools"]="No Codex session folder yet";return
        }
        var active=Set<String>()
        for case let file as URL in scan {
            guard file.pathExtension=="jsonl",let info=try? file.resourceValues(forKeys:[.contentModificationDateKey,.isRegularFileKey,.isSymbolicLinkKey]),
                  info.isRegularFile==true,info.isSymbolicLink != true,
                  (info.contentModificationDate ?? .distantPast)>Date().addingTimeInterval(-86400) else{continue}
            active.insert(file.path)
            let tail=codexReaders[file.path] ?? TailReader();codexReaders[file.path]=tail
            if let rows=try? tail.read(file) {
                for event in rows.compactMap(CodexParser.parse) where known.insert(event.id).inserted {events.append(event)}
            }
        }
        codexReaders=codexReaders.filter{active.contains($0.key)}
        events.sort{$0.time<$1.time}
        if events.count>10000 {events.removeFirst(events.count-10000);known=Set(events.map(\.id))}
        feedStatus["Codex tools"]="live · \(active.count) recent transcripts · MCP/web metadata only"
    }

}
