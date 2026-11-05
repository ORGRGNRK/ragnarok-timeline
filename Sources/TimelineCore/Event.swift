import Foundation
public struct Event: Identifiable, Hashable, Sendable {
    public let id: String
    public let time: Date
    public let actor, host, source, kind, title, body, session: String
    public init(id: String, time: Date, actor: String, host: String, source: String, kind: String, title: String, body: String, session: String) {
        self.id=id;self.time=time;self.actor=actor;self.host=host;self.source=source;self.kind=kind
        self.title=title;self.body=body;self.session=session
    }
}
public enum Actors {
    public static let order=["human","claude","codex","gemini","antigravity","grok","unknown"]
    public static func normalize(_ raw:String)->String {
        switch raw.lowercased() {
        case "claude code","claude": return "claude"
        case "codex": return "codex"
        case "gemini cli","gemini": return "gemini"
        case "antigravity","argon": return "antigravity"
        case "grok cli","grok": return "grok"
        case "human-terminal","human": return "human"
        case "": return "unknown"
        default: return raw.lowercased()
        }
    }
}
public extension String {
    func oneLine(_ limit:Int=160)->String {
        let text=replacingOccurrences(of:"\n",with:" ").trimmingCharacters(in:.whitespacesAndNewlines)
        return text.count>limit ? String(text.prefix(limit))+"…" : text
    }
}
