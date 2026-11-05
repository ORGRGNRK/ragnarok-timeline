import Foundation
// Bounded polling; unfinished UTF-8 lines are retained until newline. Handles rotation and truncation.
public final class TailReader {
    private var offset:UInt64=0
    private var inode:UInt64?
    private var pending=Data()
    private var skipping=false
    public init() {}
    public func read(_ url:URL)throws->[String] {
        let attrs=try FileManager.default.attributesOfItem(atPath:url.path)
        let size=(attrs[.size] as? NSNumber)?.uint64Value ?? 0
        let nextInode=(attrs[.systemFileNumber] as? NSNumber)?.uint64Value ?? 0
        if inode == nil {
            offset=size>262144 ? size-262144:0
            skipping=offset>0
        } else if inode != nextInode || size<offset {
            offset=0;pending.removeAll();skipping=false
        }
        inode=nextInode
        guard size>offset else{return []}
        let file=try FileHandle(forReadingFrom:url);defer{try? file.close()}
        try file.seek(toOffset:offset)
        let data=try file.read(upToCount:262144) ?? Data();offset += UInt64(data.count);pending.append(data)
        var lines:[String]=[]
        while let end=pending.firstIndex(of:10) {
            let line=Data(pending[..<end]);pending.removeSubrange(...end)
            if skipping {skipping=false;continue}
            lines.append(String(decoding:line,as:UTF8.self))
        }
        // Discard an oversized line until its newline, rather than growing without bound.
        if pending.count>1_048_576 {pending.removeAll();skipping=true}
        return lines
    }
}
