import Foundation
public enum CodexParser {
    public static func parse(_ line:String)->Event? {
        guard let data=line.data(using:.utf8),let d=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any],
              d["type"] as? String == "event_msg",let p=d["payload"] as? [String:Any],p["type"] as? String == "item_completed",
              let item=p["item"] as? [String:Any],let type=item["type"] as? String,
              let id=item["id"] as? String,let at=d["timestamp"] as? String else{return nil}
        let name:String
        if type=="McpToolCall" {name="MCP: \(item["server"] as? String ?? "unknown").\(item["tool"] as? String ?? "unknown")"}
        else if type=="Extension" {name="Tool: \(item["kind"] as? String ?? "extension")"}
        else{return nil}
        // Reuse the receipt parser's date handling and display scrubbing. No arguments/results are serialized.
        let receipt:[String:Any]=["rid":"codex-trace:"+id,"at":at,"actor":"Codex","source":"codex-transcript-metadata",
            "kind":"Tool","tool":name,"command":"\(name) · \(item["status"] as? String ?? "recorded")",
            "session":p["thread_id"] as? String ?? "unknown","coverage":"Metadata only; no arguments, results or model text"]
        guard let encoded=try? JSONSerialization.data(withJSONObject:receipt),let text=String(data:encoded,encoding:.utf8) else{return nil}
        return ReceiptParser.parse(text)
    }
}
