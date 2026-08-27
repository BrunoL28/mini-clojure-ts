import {
    ClojureVector,
    ClojureKeyword,
    ClojureMap,
    ClojureMacro,
    ClojureAtom,
    ClojureNamespace,
} from "../types/index.js";
import { getPrintLimits } from "./Limits.js";
import { LazySeq } from "./LazySeq.js";

/**
 * Aplica o limite de itens, acrescentando `...` quando corta.
 *
 * @param {string[]} itens Os itens já formatados.
 * @param {number | null} limite O máximo de itens, ou `null`.
 * @return {string[]} Os itens, possivelmente truncados.
 */
function aplicarLimite(itens: string[], limite: number | null): string[] {
    if (limite === null || itens.length <= limite) return itens;
    return [...itens.slice(0, limite), "..."];
}

export function prStr(
    data: any,
    readably: boolean = false,
    profundidade: number = 0,
): string {
    const limites = getPrintLimits();

    // `*print-level*` corta a **coleção** inteira, não os escalares dentro
    // dela: com nível 2, `{:a {:b {:c 1}}}` vira `{:a {:b #}}`.
    if (
        limites.level !== null &&
        profundidade >= limites.level &&
        (Array.isArray(data) ||
            data instanceof ClojureMap ||
            data instanceof LazySeq)
    ) {
        return "#";
    }

    if (data === null) return "nil";
    if (data === undefined) return "nil";
    if (data === true) return "true";
    if (data === false) return "false";

    if (data instanceof ClojureKeyword) {
        return data.value;
    }

    if (data instanceof ClojureVector) {
        const visiveis =
            limites.length === null
                ? (data as any[])
                : (data.slice(0, limites.length + 1) as any[]);
        const items = aplicarLimite(
            visiveis.map((item) => prStr(item, readably, profundidade + 1)),
            limites.length,
        );
        return `[${items.join(" ")}]`;
    }

    if (data instanceof ClojureMap) {
        const entries: string[] = [];
        for (const [k, v] of data) {
            entries.push(
                `${prStr(k, readably, profundidade + 1)} ${prStr(v, readably, profundidade + 1)}`,
            );
            // Para de formatar ao atingir o limite: numa coleção enorme, o
            // custo está em montar as strings, não em juntá-las.
            if (limites.length !== null && entries.length > limites.length) {
                break;
            }
        }
        return `{${aplicarLimite(entries, limites.length).join(" ")}}`;
    }

    if (data instanceof ClojureMacro) {
        return `#<Macro params:[${data.params}]>`;
    }

    if (data instanceof ClojureNamespace) {
        return `#<ns ${data.name} (${data.path})>`;
    }

    if (data instanceof ClojureAtom) {
        return `#<Atom ${prStr(data.value, readably, profundidade + 1)}>`;
    }

    // Sequência preguiçosa: com limite de impressão, só produz o que vai
    // mostrar. É o que permite imprimir uma sequência infinita.
    if (data instanceof LazySeq) {
        const itens =
            limites.length === null
                ? data.realizar()
                : data.primeiros(limites.length + 1);
        const textos = aplicarLimite(
            itens.map((item) => prStr(item, readably, profundidade + 1)),
            limites.length,
        );
        return `(${textos.join(" ")})`;
    }

    if (Array.isArray(data)) {
        const visiveis =
            limites.length === null ? data : data.slice(0, limites.length + 1);
        const items = aplicarLimite(
            visiveis.map((item) => prStr(item, readably, profundidade + 1)),
            limites.length,
        );
        return `(${items.join(" ")})`;
    }

    if (typeof data === "string") {
        if (readably) {
            return JSON.stringify(data);
        }
        return data;
    }

    if (typeof data === "function") {
        return "#<Function>";
    }

    if (data && typeof data === "object" && "params" in data) {
        return `#<Function params:[${data.params}]>`;
    }

    return String(data);
}
