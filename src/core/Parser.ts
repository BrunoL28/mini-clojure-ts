import type { Token, Expression, ClojureList } from "../types/index.js";
import {
    ClojureVector,
    ClojureKeyword,
    ClojureMap,
    ClojureSymbol,
} from "../types/index.js";
import { ClojureError } from "../errors/ClojureError.js";

export function parse(tokens: Token[]): Expression {
    if (tokens.length === 0) {
        throw new ClojureError("Fim inesperado da entrada");
    }

    const token = tokens.shift()!;

    if (token.value === "(") {
        const list: ClojureList = [];
        list.loc = token.loc;

        while (tokens.length > 0 && tokens[0]!.value !== ")") {
            list.push(parse(tokens));
        }

        if (tokens.length === 0) {
            throw new ClojureError("Lista desbalanceada: falta ')'", token.loc);
        }
        tokens.shift();
        return list;
    }

    if (token.value === ")") {
        throw new ClojureError("Parênteses ')' inesperado", token.loc);
    }

    if (token.value === "[") {
        const vector = new ClojureVector();
        vector.loc = token.loc;

        while (tokens.length > 0 && tokens[0]!.value !== "]") {
            vector.push(parse(tokens));
        }

        if (tokens.length === 0) {
            throw new ClojureError("Vetor desbalanceado: falta ']'", token.loc);
        }
        tokens.shift();
        return vector;
    }

    if (token.value === "]") {
        throw new ClojureError("Colchete ']' inesperado", token.loc);
    }

    if (token.value === "{") {
        const map = new ClojureMap();
        map.loc = token.loc;

        while (tokens.length > 0 && tokens[0]!.value !== "}") {
            const key = parse(tokens);

            if (tokens.length === 0 || tokens[0]!.value === "}") {
                throw new ClojureError(
                    "Mapa desbalanceado: falta valor para a última chave",
                    token.loc,
                );
            }

            const value = parse(tokens);
            map.set(key, value);
        }

        if (tokens.length === 0) {
            throw new ClojureError("Mapa desbalanceado: falta '}'", token.loc);
        }

        tokens.shift();
        return map;
    }

    if (token.value === "}") {
        throw new ClojureError("Chaveta '}' inesperada", token.loc);
    }

    if (token.value === "'") {
        const nextExpr = parse(tokens);
        const list: ClojureList = [new ClojureSymbol("quote"), nextExpr];
        list.loc = token.loc;
        return list;
    }

    if (token.value === "`") {
        const nextExpr = parse(tokens);
        const list: ClojureList = [new ClojureSymbol("quasiquote"), nextExpr];
        list.loc = token.loc;
        return list;
    }

    if (token.value === "~") {
        const nextExpr = parse(tokens);
        const list: ClojureList = [new ClojureSymbol("unquote"), nextExpr];
        list.loc = token.loc;
        return list;
    }

    if (token.value === "@") {
        const nextExpr = parse(tokens);
        const list: ClojureList = [new ClojureSymbol("deref"), nextExpr];
        list.loc = token.loc;
        return list;
    }

    if (token.value.startsWith(":") && token.value.length > 1) {
        const kw = new ClojureKeyword(token.value);
        kw.loc = token.loc;
        return kw;
    }

    const number = parseFloat(token.value);
    if (!isNaN(number)) {
        return number;
    }

    if (token.value.startsWith('"') && token.value.endsWith('"')) {
        return token.value;
    }

    if (token.value === "true") return true;
    if (token.value === "false") return false;
    if (token.value === "nil") return null;

    const sym = new ClojureSymbol(token.value);
    sym.loc = token.loc;
    return sym;
}
