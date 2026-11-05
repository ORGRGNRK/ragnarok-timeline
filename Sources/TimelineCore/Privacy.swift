import Foundation
// Defense in depth for display/import. Hooks scrub before writing. Neither is an exhaustive secret detector.
public enum Privacy {
    public static func clean(_ text:String)->String {
        let rules=[
            #"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|\z)"#,
            #"(?:sk-(?:ant-|proj-|svcacct-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abprs]-[A-Za-z0-9-]{10,})"#,
            #"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]{8,}"#,
            #"(?i)\b[A-Z0-9_]*(?:password|secret|token|api[_-]?key|credential)[A-Z0-9_]*\s*[:=]\s*(?:\"[^\"]*\"|'[^']*'|[^\s,}]+)"#,
            #"(?<=://)[^\s:/@]+:[^\s@/]+(?=@)"#
        ]
        return rules.reduce(text) { out,pattern in
            guard let re=try? NSRegularExpression(pattern:pattern) else{return out}
            return re.stringByReplacingMatches(in:out,range:NSRange(out.startIndex...,in:out),withTemplate:"[redacted]")
        }
    }
}
