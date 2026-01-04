/* eslint-disable no-useless-escape */
import type { Token, SourceLocation } from "../types/index.js";
import { ClojureError } from "../errors/ClojureError.js";

function validateString(tokenValue: string, loc: SourceLocation) {
    if (tokenValue.length < 2 || !tokenValue.endsWith('"')) {
        throw new ClojureError("String não terminada.", loc);
    }

    const content = tokenValue.slice(1, -1);

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (char === "\\") {
            if (i + 1 >= content.length) {
                continue;
            }
            const nextChar = content[i + 1];
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const validEscapes = ['"', "\\", "n", "t", "r", "b", "f"];
            const strictEscapes = ['"', "\\", "n", "t"];
            if (!strictEscapes.includes(nextChar!)) {
                const errorCol = loc.start.col + 1 + i;
                const errorLoc = {
                    ...loc,
                    start: {
                        ...loc.start,
                        col: errorCol,
                        index: loc.start.index + 1 + i,
                    },
                    end: {
                        ...loc.start,
                        col: errorCol + 2,
                        index: loc.start.index + 1 + i + 2,
                    },
                };

                throw new ClojureError(
                    `Escape inválido: \\${nextChar}`,
                    errorLoc,
                );
            }
            i++;
        }
    }
}

export function tokenize(input: string, filename: string = "unknown"): Token[] {
    const tokens: Token[] = [];
    let current = 0;
    let line = 1;
    let col = 1;

    const regex =
        /"(?:\\.|[^\\"\n])*"?|[\(\)\[\]\{\}'`~@]|;.*|[^\s,()\[\]\{\}'`~@]+/y;

    while (current < input.length) {
        const char = input[current];

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

            if (value.startsWith('"')) {
                validateString(value, loc);
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
