import XCTest
@testable import TimelineCore
final class CoreTests:XCTestCase {
    func testActorAndReadKind() {
        let e=ReceiptParser.parse(#"{"rid":"r","at":"2026-11-04T20:00:00Z","actor":"Codex","kind":"Read","command":"pwd","exit_code":0}"#)
        XCTAssertEqual(e?.actor,"codex");XCTAssertEqual(e?.kind,"read");XCTAssertTrue(e?.title.contains("exit 0")==true)
    }
    func testUnknownExitIsUnknown() {
        let e=ReceiptParser.parse(#"{"at":"2026-11-04T20:00:00Z","actor":"Claude Code","tool":"MCP","command":"tool","exit_code":null}"#)
        XCTAssertTrue(e?.title.contains("exit unknown")==true);XCTAssertEqual(e?.kind,"command")
        XCTAssertNil(ReceiptParser.parse("not json"));XCTAssertNil(ReceiptParser.parse(#"{"at":"bad"}"#))
    }
    func testPrivateDataScrubbed() {
        let key="sk-proj-"+String(repeating:"a",count:32)
        let e=ReceiptParser.parse("{\"at\":\"2026-11-04T20:00:00Z\",\"command\":\"echo \(key)\"}")
        XCTAssertFalse(e!.title.contains(key));XCTAssertFalse(e!.body.contains(key))
    }
    func testCodexMetadataOnly() {
        let e=CodexParser.parse(#"{"type":"event_msg","timestamp":"2026-11-04T20:00:00Z","payload":{"type":"item_completed","thread_id":"s","item":{"id":"call1","type":"McpToolCall","server":"cua_repl","tool":"js","status":"completed","arguments":{"code":"PRIVATE"},"result":"PRIVATE"}}}"#)
        XCTAssertEqual(e?.actor,"codex");XCTAssertEqual(e?.kind,"tool");XCTAssertTrue(e!.title.contains("cua_repl.js"));XCTAssertFalse(e!.body.contains("PRIVATE"))
        XCTAssertNil(CodexParser.parse(#"{"type":"event_msg","payload":{"type":"item_completed","item":{"type":"Reasoning","raw_content":"PRIVATE"}}}"#))
    }
    func testTailPartialUTF8AndTruncate()throws {
        let folder=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true);defer{try? FileManager.default.removeItem(at:folder)}
        let file=folder.appendingPathComponent("events.jsonl"),tail=TailReader()
        let bytes=Data("phone 📱\n".utf8)
        try bytes.dropLast(3).write(to:file);XCTAssertEqual(try tail.read(file),[])
        let handle=try FileHandle(forWritingTo:file);try handle.seekToEnd();try handle.write(contentsOf:bytes.suffix(3));try handle.close()
        XCTAssertEqual(try tail.read(file),["phone 📱"]);XCTAssertEqual(try tail.read(file),[])
        try Data("x\n".utf8).write(to:file);XCTAssertEqual(try tail.read(file),["x"])
    }
    func testRotation()throws {
        let folder=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true);defer{try? FileManager.default.removeItem(at:folder)}
        let file=folder.appendingPathComponent("events.jsonl"),tail=TailReader()
        try Data("a\n".utf8).write(to:file);XCTAssertEqual(try tail.read(file),["a"])
        try FileManager.default.moveItem(at:file,to:folder.appendingPathComponent("old"))
        try Data("b\n".utf8).write(to:file);XCTAssertEqual(try tail.read(file),["b"])
    }
}
