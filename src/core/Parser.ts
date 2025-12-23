import type { Expression } from "../types/index.js";
import type { List } from "../types/index.js";
import { ClojureVector } from "../types/index.js";
import { ClojureError } from "../errors/ClojureError.js";

export function parse(tokens: string[]): Expression {
    if (tokens.length === 0) {
        throw new ClojureError("Fim inesperado da entrada");
    }

    const token = tokens.shift()!;

    if (token === "(") {
        const list: List = [];
        while (tokens.length > 0 && tokens[0] !== ")") {
            list.push(parse(tokens));
        }
        tokens.shift();
        return list;
    }

    if (token === ")") {
        throw new ClojureError("Parênteses ')' inesperado");
    }

    if (token === "[") {
        const vector = new ClojureVector();
        while (tokens.length > 0 && tokens[0] !== "]") {
            vector.push(parse(tokens));
        }
        tokens.shift();
        return vector;
    }

    if (token === "]") {
        throw new ClojureError("Colchete ']' inesperado");
    }

    if (token === "'") {
        const nextExpr = parse(tokens);
        return ["quote", nextExpr];
    }

    const number = parseFloat(token);
    if (!isNaN(number)) {
        return number;
    }

    if (token.startsWith('"') && token.endsWith('"')) {
        return token;
    }

    return token;
}
