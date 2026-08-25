import { ClojureMap, ClojureKeyword, ClojureSymbol } from "../types/index.js";

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
