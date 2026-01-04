import {
    ClojureVector,
    ClojureKeyword,
    ClojureMap,
    ClojureMacro,
    ClojureAtom,
} from "../types/index.js";

export function prStr(data: any, readably: boolean = false): string {
    if (data === null) return "nil";
    if (data === undefined) return "nil";
    if (data === true) return "true";
    if (data === false) return "false";

    if (data instanceof ClojureKeyword) {
        return data.value;
    }

    if (data instanceof ClojureVector) {
        const items = data.map((item) => prStr(item, readably)).join(" ");
        return `[${items}]`;
    }

    if (data instanceof ClojureMap) {
        const entries: string[] = [];
        for (const [k, v] of data) {
            entries.push(`${prStr(k, readably)} ${prStr(v, readably)}`);
        }
        return `{${entries.join(" ")}}`;
    }

    if (data instanceof ClojureMacro) {
        return `#<Macro params:[${data.params}]>`;
    }

    if (data instanceof ClojureAtom) {
        return `#<Atom ${prStr(data.value, readably)}>`;
    }

    if (Array.isArray(data)) {
        const items = data.map((item) => prStr(item, readably)).join(" ");
        return `(${items})`;
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
