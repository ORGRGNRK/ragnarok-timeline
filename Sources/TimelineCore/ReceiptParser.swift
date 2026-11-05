import Foundation
public enum ReceiptParser {
    public static func parse(_ line:String)->Event? {
        guard let data=line.data(using:.utf8),let d=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any],
              let stamp=d["at"] as? String else{return nil}
        let iso=ISO8601DateFormatter();iso.formatOptions=[.withInternetDateTime,.withFractionalSeconds]
        let basic=ISO8601DateFormatter()
        guard let time=iso.date(from:stamp) ?? basic.date(from:stamp) else{return nil}
        let actor=Actors.normalize(d["actor"] as? String ?? "")
        let rawKind=(d["kind"] as? String ?? "command").lowercased()
        let kind=["read","change","command","tool"].contains(rawKind) ? rawKind:"command"
        let command=Privacy.clean(d["command"] as? String ?? d["record_ref"] as? String ?? "Tool observation")
        let tool=Privacy.clean(d["tool"] as? String ?? "Command")
        let exit=(d["exit_code"] as? NSNumber).map{String($0.intValue)} ?? "unknown"
        // Null is unknown: a tool's completion event is not proof of exit 0.
        let bodyData=try? JSONSerialization.data(withJSONObject:d,options:[.prettyPrinted,.sortedKeys])
        let body=Privacy.clean(bodyData.flatMap{String(data:$0,encoding:.utf8)} ?? line)
        return Event(id:d["rid"] as? String ?? line, time:time, actor:actor, host:"mac",
                     source:Privacy.clean(d["source"] as? String ?? "hook"),kind:kind,
                     title:"\(tool) exit \(exit): \(command.oneLine())",body:body,
                     session:Privacy.clean(d["session"] as? String ?? "unknown"))
    }
}
