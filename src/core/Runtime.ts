import {
    ClojureMap,
    ClojureKeyword,
    ClojureSymbol,
    ClojureVector,
} from "../types/index.js";
import { InvalidParamError } from "../errors/InvalidParamError.js";

export function equals(a: any, b: any): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;

    if (a instanceof ClojureKeyword && b instanceof ClojureKeyword) {
        return a.value === b.value;
    }

    if (a instanceof ClojureSymbol && b instanceof ClojureSymbol) {
        return a.value === b.value;
    }

    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            return false;
        }
        for (let i = 0; i < a.length; i++) {
            if (!equals(a[i], b[i])) {
                return false;
            }
        }
        return true;
    }

    if (a instanceof ClojureMap && b instanceof ClojureMap) {
        if (a.size !== b.size) {
            return false;
        }

        for (const [keyA, valA] of a) {
            if (b.has(keyA)) {
                if (!equals(valA, b.get(keyA))) {
                    return false;
                }
                continue;
            }

            let found = false;
            for (const [keyB, valB] of b) {
                if (equals(keyA, keyB)) {
                    if (!equals(valA, valB)) {
                        return false;
                    }
                    found = true;
                    break;
                }
            }
            if (!found) {
                return false;
            }
        }
        return true;
    }
    return false;
}

/**
 * Converte o valor de um `~@` na sequência a ser intercalada.
 *
 * Mora aqui porque interpretador e código compilado precisam concordar: o
 * `evalQuasiquote` e o runtime chamam esta mesma função.
 *
 * @param {any} value O valor avaliado no `~@`.
 * @throws {InvalidParamError} Se o valor não for sequencial.
 * @return {any[]} Os itens a intercalar.
 */
export function spliceItems(value: any): any[] {
    if (value === null || value === undefined) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "string") return value.split("");
    if (value instanceof ClojureMap) {
        return value.entries().map(([k, v]) => ClojureVector.fromArray([k, v]));
    }
    throw new InvalidParamError(
        `unquote-splicing (~@) requer uma sequência, recebeu ${String(value)}`,
    );
}

/**
 * Concatena os pedaços de uma sequência com `~@` já resolvido.
 *
 * @param {any[][]} chunks Um array por posição: item solto vira `[item]`,
 *     `~@` vira a sequência inteira.
 * @return {any[]} A sequência final.
 */
export function splice(chunks: any[][]): any[] {
    const saida: any[] = [];
    for (const chunk of chunks) {
        for (let i = 0; i < chunk.length; i++) saida.push(chunk[i]);
    }
    return saida;
}
