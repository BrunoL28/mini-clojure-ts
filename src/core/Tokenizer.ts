import type { Token, SourceLocation } from "../types/index.js";
import { ClojureError } from "../errors/ClojureError.js";

export function tokenize(input: string, filename: string = "unknown"): Token[] {
    const tokens: Token[] = [];
    let current = 0;
    let line = 1;
    let col = 1;

    const regex =
        /"(?:\\.|[^\\"])*"?|[\(\)\[\]\{\}'`~@]|;.*|[^\s,()\[\]\{\}'`~@]+/y;

    while (current < input.length) {
        let char = input[current];

        if (/\s/.test(char!) || char === ",") {
            if (char === "\n") {
                line++;
                col = 1;
            } else {
                col++;
            }
            current++;
            continue;
        }

        regex.lastIndex = current;
        const match = regex.exec(input);

        if (match) {
            const value = match[0];
            const startLoc = { line, col, index: current };

            const linesInToken = value.split("\n");
            if (linesInToken.length > 1) {
                line += linesInToken.length - 1;
                col = linesInToken[linesInToken.length - 1]!.length + 1;
            } else {
                col += value.length;
            }
            current += value.length;

            const endLoc = { line, col, index: current };

            const loc: SourceLocation = {
                file: filename,
                start: startLoc,
                end: endLoc,
            };

            if (value.startsWith(";")) {
                continue;
            }

            if (
                value.startsWith('"') &&
                !value.endsWith('"') &&
                value.length > 1
            ) {
                throw new ClojureError(
                    `String não terminada na linha ${loc.start.line}`,
                    loc,
                );
            }

            tokens.push({
                type: "token",
                value,
                loc,
            });
        } else {
            throw new ClojureError(
                `Caractere inesperado '${char}' na linha ${line}:${col}`,
            );
        }
    }

    return tokens;
}
