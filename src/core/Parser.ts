import type { Expression } from "../types/index.js";
import type { List } from "../types/index.js";
import { ClojureVector, ClojureKeyword, ClojureMap } from "../types/index.js";
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

    if (token === "{") {
        const map = new ClojureMap();
        while (tokens.length > 0 && tokens[0] !== "}") {
            const key = parse(tokens);

            if (tokens.length === 0 || tokens[0] === "}") {
                throw new ClojureError(
                    "Mapa desbalanceado: falta valor para a última chave",
                );
            }

            const value = parse(tokens);
            map.set(key, value);
        }
        tokens.shift();
        return map;
    }

    if (token === "}") {
        throw new ClojureError("Chaveta '}' inesperada");
    }

    if (token === "'") {
        const nextExpr = parse(tokens);
        return ["quote", nextExpr];
    }

    if (token === "`") {
        const nextExpr = parse(tokens);
        return ["quasiquote", nextExpr];
    }

    if (token === "~") {
        const nextExpr = parse(tokens);
        return ["unquote", nextExpr];
    }

    if (token.startsWith(":") && token.length > 1) {
        return new ClojureKeyword(token);
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
