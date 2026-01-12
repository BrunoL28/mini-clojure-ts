import {
    ClojureVector,
    ClojureKeyword,
    ClojureSymbol,
    ClojureMap,
    type ClojureList,
} from "../types/index.js";

function stringHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return hash;
}

function numberHash(n: number): number {
    if (Number.isInteger(n)) return n | 0;
    return stringHash(n.toString());
}

export function hash(o: any): number {
    if (o === null || o === undefined) return 0;
    if (o === true) return 1231;
    if (o === false) return 1237;
    if (typeof o === "number") return numberHash(o);
    if (typeof o === "string") return stringHash(o);

    if (typeof o.hashCode === "function") {
        return o.hashCode();
    }

    if (o instanceof ClojureKeyword) return stringHash(o.value) + 0x9e3779b9;
    if (o instanceof ClojureSymbol) return stringHash(o.value);

    if (o instanceof ClojureVector || Array.isArray(o)) {
        let h = 1;
        for (const item of o) {
            h = 31 * h + hash(item);
            h |= 0;
        }
        return h;
    }

    if (o instanceof ClojureMap) {
        let h = 0;
        for (const [k, v] of o) {
            h ^= hash(k) ^ hash(v);
        }
        return h;
    }

    return 0;
}
