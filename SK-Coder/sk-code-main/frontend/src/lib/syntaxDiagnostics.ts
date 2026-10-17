import type { ErrorEntry } from "@/types/ide";
const supported = new Set(["javascript", "typescript", "jsx", "tsx", "python", "java", "cpp", "c", "rust", "go", "php", "ruby", "kotlin", "json", "css", "html", "xml"]);
const closers: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
function entry(path: string, line: number, col: number, message: string): ErrorEntry {
    return { id: `syntax-${line}-${col}-${message}`, file: path, line, col, message, severity: "error" };
}
export function analyzeSourceSyntax(content: string, language: string | undefined, path: string): ErrorEntry[] {
    if (!supported.has((language || "").toLowerCase()))
        return [];
    const diagnostics: ErrorEntry[] = [];
    const stack: {
        char: string;
        line: number;
        col: number;
    }[] = [];
    let inBlockComment = false;
    let quote: "'" | '"' | "`" | null = null;
    let quoteLine = 1;
    let quoteCol = 1;
    const lines = content.split("\n");
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        for (let index = 0; index < line.length; index++) {
            const char = line[index];
            const next = line[index + 1];
            const lineNumber = lineIndex + 1;
            const col = index + 1;
            if (inBlockComment) {
                if (char === "*" && next === "/") {
                    inBlockComment = false;
                    index++;
                }
                continue;
            }
            if (!quote && char === "/" && next === "*") {
                inBlockComment = true;
                index++;
                continue;
            }
            if (!quote && ((char === "/" && next === "/") || (char === "#" && ["python", "ruby"].includes((language || "").toLowerCase()))))
                break;
            if (quote) {
                if (char === "\\") {
                    index++;
                    continue;
                }
                if (char === quote)
                    quote = null;
                continue;
            }
            if (char === "'" || char === '"' || char === "`") {
                quote = char;
                quoteLine = lineNumber;
                quoteCol = col;
                continue;
            }
            if (char === "(" || char === "[" || char === "{")
                stack.push({ char, line: lineNumber, col });
            if (closers[char]) {
                const open = stack.at(-1);
                if (!open || open.char !== closers[char])
                    diagnostics.push(entry(path, lineNumber, col, `Unexpected '${char}'`));
                else
                    stack.pop();
            }
        }
        if (quote && quote !== "`") {
            diagnostics.push(entry(path, quoteLine, quoteCol, `Unterminated ${quote === "'" ? "single" : "double"}-quoted string`));
            quote = null;
        }
    }
    if (inBlockComment)
        diagnostics.push(entry(path, lines.length, Math.max(1, lines.at(-1)?.length || 1), "Unterminated block comment"));
    for (const open of stack.slice(-20))
        diagnostics.push(entry(path, open.line, open.col, `Unclosed '${open.char}'`));
    return diagnostics.slice(0, 50);
}
