import * as fs from "fs";
import { InvalidParamError } from "../errors/InvalidParamError.js";
import { ClojureError } from "../errors/ClojureError.js";
import {
    ClojureVector,
    ClojureKeyword,
    ClojureMap,
    ClojureAtom,
    ClojureSymbol,
    ClojureMacro,
} from "../types/index.js";
import { prStr } from "../core/Printer.js";
import { equals } from "../core/Runtime.js";
import { parse } from "../core/Parser.js";
import { tokenize } from "../core/Tokenizer.js";
import { callFn, isCallable, truthy } from "../core/Invoke.js";

// ==========================================
// Helpers internos
// ==========================================

function assertNumber(val: any, operation: string) {
    if (typeof val !== "number" || isNaN(val)) {
        throw new InvalidParamError(
            `Erro em '${operation}': esperava número, recebeu ${prStr(val)} (${typeof val})`,
        );
    }
}

function assertFn(val: any, operation: string) {
    if (!isCallable(val)) {
        throw new InvalidParamError(
            `Erro em '${operation}': esperava uma função, recebeu ${prStr(val)}`,
        );
    }
}

/** Lista (seq) é qualquer Array que NÃO seja um ClojureVector. */
function isList(x: any): boolean {
    return Array.isArray(x) && !(x instanceof ClojureVector);
}

function isColl(x: any): boolean {
    return Array.isArray(x) || x instanceof ClojureMap;
}

/**
 * Normaliza qualquer coleção para um array JS.
 * Strings viram arrays de caracteres e mapas viram arrays de pares [k v].
 * Retorna `null` para valores não sequenciais (inclusive `nil`).
 */
function toSeq(x: any): any[] | null {
    if (x === null || x === undefined) return null;
    if (Array.isArray(x)) return x;
    if (typeof x === "string") return x.split("");
    if (x instanceof ClojureMap) {
        return x.entries().map(([k, v]) => ClojureVector.of(k, v));
    }
    return null;
}

/**
 * Converte o resultado de uma operação de sequência numa lista "pura".
 * Métodos de Array (`slice`, `filter`, ...) herdam a espécie do receptor, então
 * sem isso `(filter ... [1 2 3])` devolveria um vetor em vez de uma seq.
 */
function asList(items: any[]): any[] {
    return items instanceof ClojureVector ? [...items] : items;
}

/** Igual a `toSeq`, mas lança erro nomeando a operação quando o valor não é sequencial. */
function seqOrThrow(x: any, operation: string): any[] {
    const s = toSeq(x);
    if (s === null) {
        if (x === null || x === undefined) return [];
        throw new InvalidParamError(
            `Erro em '${operation}': esperava uma coleção, recebeu ${prStr(x)}`,
        );
    }
    return s;
}

/** Adiciona um item preservando o tipo da coleção (vetor no fim, lista no início). */
function conjOne(coll: any, item: any): any {
    if (coll === null || coll === undefined) return [item];
    if (coll instanceof ClojureVector) return ClojureVector.of(...coll, item);
    if (coll instanceof ClojureMap) {
        const pair = toSeq(item);
        if (!pair || pair.length !== 2) {
            throw new InvalidParamError(
                "conj em um mapa requer um par [chave valor]",
            );
        }
        return coll.assoc(pair[0], pair[1]);
    }
    if (Array.isArray(coll)) return [item, ...coll];
    throw new InvalidParamError(
        `conj requer uma coleção, recebeu ${prStr(coll)}`,
    );
}

/** Sentinela interna para distinguir "chave ausente" de um `nil` armazenado. */
const MISSING = Symbol("missing");

function getIn(coll: any, path: any[], notFound: any): any {
    let current: any = coll;
    for (const key of path) {
        current = lookup(current, key, MISSING);
        if (current === MISSING) return notFound;
    }
    return current;
}

/** `get` genérico: mapas por chave, sequências e strings por índice. */
function lookup(coll: any, key: any, notFound: any): any {
    if (coll instanceof ClojureMap) {
        const val = coll.get(key);
        return val === undefined ? notFound : val;
    }
    if (Array.isArray(coll) || typeof coll === "string") {
        if (typeof key !== "number" || key < 0 || key >= coll.length) {
            return notFound;
        }
        return coll[key];
    }
    return notFound;
}

function assocOne(coll: any, key: any, val: any): any {
    if (coll === null || coll === undefined) {
        return new ClojureMap().assoc(key, val);
    }
    if (coll instanceof ClojureMap) return coll.assoc(key, val);
    if (Array.isArray(coll)) {
        assertNumber(key, "assoc");
        if (key < 0 || key > coll.length) {
            throw new InvalidParamError(
                `assoc: índice ${key} fora dos limites do vetor (tamanho ${coll.length})`,
            );
        }
        const copy = coll.slice();
        copy[key] = val;
        return coll instanceof ClojureVector ? ClojureVector.of(...copy) : copy;
    }
    throw new InvalidParamError(
        `assoc requer um mapa ou vetor, recebeu ${prStr(coll)}`,
    );
}

function assocIn(coll: any, path: any[], val: any): any {
    if (path.length === 0) return val;
    const [key, ...rest] = path;
    if (rest.length === 0) return assocOne(coll, key, val);
    const child = lookup(coll, key, null);
    return assocOne(coll, key, assocIn(child, rest, val));
}

export const initialConfig: { [key: string]: any } = {
    // ==========================================
    // Aritmética
    // ==========================================

    "+": (...args: any[]) => {
        return args.reduce((a, b) => {
            assertNumber(a, "+");
            assertNumber(b, "+");
            return a + b;
        }, 0);
    },
    "-": (...args: any[]) => {
        if (args.length === 0)
            throw new InvalidParamError("'-' requer ao menos 1 argumento");
        args.forEach((a) => assertNumber(a, "-"));
        if (args.length === 1) return -args[0];
        return args.slice(1).reduce((a, b) => a - b, args[0]);
    },
    "*": (...args: any[]) => {
        return args.reduce((a, b) => {
            assertNumber(a, "*");
            assertNumber(b, "*");
            return a * b;
        }, 1);
    },
    "/": (...args: any[]) => {
        if (args.length === 0)
            throw new InvalidParamError("'/' requer ao menos 1 argumento");
        args.forEach((a) => assertNumber(a, "/"));
        const divisors = args.length === 1 ? args : args.slice(1);
        let acc = args.length === 1 ? 1 : args[0];
        for (const d of divisors) {
            if (d === 0) throw new InvalidParamError("Divisão por zero");
            acc = acc / d;
        }
        return acc;
    },
    rem: (a: any, b: any) => {
        assertNumber(a, "rem");
        assertNumber(b, "rem");
        if (b === 0) throw new InvalidParamError("Divisão por zero");
        return a % b;
    },
    // Alias histórico de `rem`, mantido para compatibilidade.
    "%": (a: any, b: any) => {
        assertNumber(a, "%");
        assertNumber(b, "%");
        if (b === 0) throw new InvalidParamError("Divisão por zero");
        return a % b;
    },
    mod: (a: any, b: any) => {
        assertNumber(a, "mod");
        assertNumber(b, "mod");
        if (b === 0) throw new InvalidParamError("Divisão por zero");
        return ((a % b) + b) % b;
    },
    quot: (a: any, b: any) => {
        assertNumber(a, "quot");
        assertNumber(b, "quot");
        if (b === 0) throw new InvalidParamError("Divisão por zero");
        return Math.trunc(a / b);
    },
    inc: (a: any) => {
        assertNumber(a, "inc");
        return a + 1;
    },
    dec: (a: any) => {
        assertNumber(a, "dec");
        return a - 1;
    },
    max: (...args: any[]) => {
        if (args.length === 0)
            throw new InvalidParamError("max requer ao menos 1 argumento");
        args.forEach((a) => assertNumber(a, "max"));
        return Math.max(...args);
    },
    min: (...args: any[]) => {
        if (args.length === 0)
            throw new InvalidParamError("min requer ao menos 1 argumento");
        args.forEach((a) => assertNumber(a, "min"));
        return Math.min(...args);
    },
    abs: (a: any) => {
        assertNumber(a, "abs");
        return Math.abs(a);
    },

    // ==========================================
    // Comparação e lógica
    // ==========================================

    ">": (...args: any[]) => compareChain(args, ">", (a, b) => a > b),
    "<": (...args: any[]) => compareChain(args, "<", (a, b) => a < b),
    ">=": (...args: any[]) => compareChain(args, ">=", (a, b) => a >= b),
    "<=": (...args: any[]) => compareChain(args, "<=", (a, b) => a <= b),

    "=": (...args: any[]) => {
        if (args.length < 2) return true;
        for (let i = 1; i < args.length; i++) {
            if (!equals(args[i - 1], args[i])) return false;
        }
        return true;
    },
    "identical?": (a: any, b: any) => a === b,
    "not=": (...args: any[]) => {
        if (args.length < 2) return false;
        for (let i = 1; i < args.length; i++) {
            if (!equals(args[i - 1], args[i])) return true;
        }
        return false;
    },
    not: (a: any) => !truthy(a),

    // ==========================================
    // Predicados e tipos (R3/E2)
    // ==========================================

    "nil?": (x: any) => x === null || x === undefined,
    "some?": (x: any) => x !== null && x !== undefined,
    "true?": (x: any) => x === true,
    "false?": (x: any) => x === false,
    "boolean?": (x: any) => typeof x === "boolean",
    "number?": (x: any) => typeof x === "number" && !isNaN(x),
    "string?": (x: any) => typeof x === "string",
    "keyword?": (x: any) => x instanceof ClojureKeyword,
    "symbol?": (x: any) => x instanceof ClojureSymbol,
    "fn?": (x: any) => isCallable(x) && !(x instanceof ClojureKeyword),
    "macro?": (x: any) => x instanceof ClojureMacro,
    "map?": (x: any) => x instanceof ClojureMap,
    "vector?": (x: any) => x instanceof ClojureVector,
    "list?": (x: any) => isList(x),
    // Neste subset, vetores NÃO são seqs (assim como em Clojure).
    "seq?": (x: any) => isList(x),
    "coll?": (x: any) => isColl(x),
    "atom?": (x: any) => x instanceof ClojureAtom,
    "zero?": (x: any) => {
        assertNumber(x, "zero?");
        return x === 0;
    },
    "pos?": (x: any) => {
        assertNumber(x, "pos?");
        return x > 0;
    },
    "neg?": (x: any) => {
        assertNumber(x, "neg?");
        return x < 0;
    },
    "even?": (x: any) => {
        assertNumber(x, "even?");
        return x % 2 === 0;
    },
    "odd?": (x: any) => {
        assertNumber(x, "odd?");
        return Math.abs(x % 2) === 1;
    },
    "empty?": (coll: any) => {
        if (coll === null || coll === undefined) return true;
        if (coll instanceof ClojureMap) return coll.size === 0;
        const s = toSeq(coll);
        return s === null ? true : s.length === 0;
    },
    "contains?": (coll: any, key: any) => {
        if (coll === null || coll === undefined) return false;
        if (coll instanceof ClojureMap) return coll.has(key);
        if (Array.isArray(coll) || typeof coll === "string") {
            return typeof key === "number" && key >= 0 && key < coll.length;
        }
        return false;
    },

    // ==========================================
    // String / IO
    // ==========================================

    str: (...args: any[]) => args.map((a) => prStr(a, false)).join(""),
    "pr-str": (...args: any[]) => args.map((a) => prStr(a, true)).join(" "),
    "read-string": (s: any) => {
        if (typeof s !== "string") {
            throw new InvalidParamError("read-string espera uma string");
        }
        const tokens = tokenize(s, "read-string");
        return parse(tokens);
    },

    print: (...args: any[]) => {
        console.log(args.map((a) => prStr(a, false)).join(" "));
        return null;
    },
    println: (...args: any[]) => {
        console.log(args.map((a) => prStr(a, false)).join(" "));
        return null;
    },
    prn: (...args: any[]) => {
        console.log(args.map((a) => prStr(a, true)).join(" "));
        return null;
    },

    // (assert expr) ou (assert expr msg)
    // Função (não macro): a expressão já chega avaliada, por isso a mensagem
    // opcional é o que dá contexto ao erro.
    assert: (value: any, msg?: any) => {
        if (!truthy(value)) {
            throw new ClojureError(
                msg === undefined
                    ? `Assert falhou: ${prStr(value, true)}`
                    : `Assert falhou: ${prStr(msg, false)}`,
            );
        }
        return null;
    },

    // (slurp path) — Node-only
    slurp: (path: any) => {
        if (typeof path !== "string") {
            throw new InvalidParamError("slurp espera um caminho (string)");
        }
        try {
            return fs.readFileSync(path, "utf-8");
        } catch (e: any) {
            throw new ClojureError(
                `slurp: não foi possível ler '${path}': ${e.message}`,
            );
        }
    },

    // (spit path content) — Node-only
    spit: (path: any, content: any) => {
        if (typeof path !== "string") {
            throw new InvalidParamError("spit espera um caminho (string)");
        }
        try {
            fs.writeFileSync(path, prStr(content, false), "utf-8");
            return null;
        } catch (e: any) {
            throw new ClojureError(
                `spit: não foi possível escrever '${path}': ${e.message}`,
            );
        }
    },

    // ==========================================
    // Coleções
    // ==========================================

    list: (...args: any[]) => args,
    vector: (...args: any[]) => ClojureVector.of(...args),
    first: (coll: any) => {
        const s = toSeq(coll);
        return s && s.length > 0 ? s[0] : null;
    },
    second: (coll: any) => {
        const s = toSeq(coll);
        return s && s.length > 1 ? s[1] : null;
    },
    last: (coll: any) => {
        const s = toSeq(coll);
        return s && s.length > 0 ? s[s.length - 1] : null;
    },
    rest: (coll: any) => {
        const s = toSeq(coll);
        return s && s.length > 0 ? asList(s.slice(1)) : [];
    },
    count: (coll: any) => {
        if (coll === null || coll === undefined) return 0;
        if (coll instanceof ClojureMap) return coll.size;
        const s = toSeq(coll);
        return s === null ? 0 : s.length;
    },
    nth: (coll: any, index: number, notFound?: any) => {
        const s = toSeq(coll);
        if (s === null)
            throw new InvalidParamError("nth requer uma coleção sequencial");
        if (index < 0 || index >= s.length) {
            if (notFound !== undefined) return notFound;
            throw new InvalidParamError(
                `nth: índice ${index} fora dos limites (tamanho ${s.length})`,
            );
        }
        return s[index];
    },
    cons: (item: any, coll: any) => {
        const s = toSeq(coll);
        return s === null ? [item] : [item, ...s];
    },
    conj: (coll: any, ...items: any[]) => {
        return items.reduce((acc, item) => conjOne(acc, item), coll);
    },
    concat: (...colls: any[]) => {
        const out: any[] = [];
        for (const c of colls) {
            if (c === null || c === undefined) continue;
            out.push(...seqOrThrow(c, "concat"));
        }
        return out;
    },

    // ==========================================
    // Sequências (R3/E1)
    // ==========================================

    // (map f coll) ou (map f coll1 coll2 ...)
    map: (f: any, ...colls: any[]) => {
        assertFn(f, "map");
        if (colls.length === 0)
            throw new InvalidParamError("map requer ao menos uma coleção");

        const seqs = colls.map((c) => seqOrThrow(c, "map"));
        const size = Math.min(...seqs.map((s) => s.length));

        const out: any[] = [];
        for (let i = 0; i < size; i++) {
            out.push(callFn(f, ...seqs.map((s) => s[i])));
        }
        return out;
    },

    // (filter pred coll)
    filter: (pred: any, coll: any) => {
        assertFn(pred, "filter");
        return asList(
            seqOrThrow(coll, "filter").filter((item) =>
                truthy(callFn(pred, item)),
            ),
        );
    },

    // (remove pred coll)
    remove: (pred: any, coll: any) => {
        assertFn(pred, "remove");
        return asList(
            seqOrThrow(coll, "remove").filter(
                (item) => !truthy(callFn(pred, item)),
            ),
        );
    },

    // (reduce f coll) ou (reduce f init coll)
    reduce: (f: any, ...args: any[]) => {
        assertFn(f, "reduce");

        if (args.length === 1) {
            const coll = seqOrThrow(args[0], "reduce");
            if (coll.length === 0) return callFn(f);
            let acc = coll[0];
            for (let i = 1; i < coll.length; i++) acc = callFn(f, acc, coll[i]);
            return acc;
        }

        if (args.length === 2) {
            const coll = seqOrThrow(args[1], "reduce");
            let acc = args[0];
            for (const item of coll) acc = callFn(f, acc, item);
            return acc;
        }

        throw new InvalidParamError(
            `Número inválido de argumentos para reduce (${args.length + 1})`,
        );
    },

    // (some pred coll) -> primeiro valor verdadeiro retornado por pred, ou nil
    some: (pred: any, coll: any) => {
        assertFn(pred, "some");
        for (const item of seqOrThrow(coll, "some")) {
            const res = callFn(pred, item);
            if (truthy(res)) return res;
        }
        return null;
    },

    // (every? pred coll)
    "every?": (pred: any, coll: any) => {
        assertFn(pred, "every?");
        for (const item of seqOrThrow(coll, "every?")) {
            if (!truthy(callFn(pred, item))) return false;
        }
        return true;
    },

    // (not-any? pred coll)
    "not-any?": (pred: any, coll: any) => {
        assertFn(pred, "not-any?");
        for (const item of seqOrThrow(coll, "not-any?")) {
            if (truthy(callFn(pred, item))) return false;
        }
        return true;
    },

    // (take n coll)
    take: (n: any, coll: any) => {
        assertNumber(n, "take");
        if (n <= 0) return [];
        return asList(seqOrThrow(coll, "take").slice(0, n));
    },

    // (drop n coll)
    drop: (n: any, coll: any) => {
        assertNumber(n, "drop");
        const s = seqOrThrow(coll, "drop");
        return asList(n <= 0 ? s.slice() : s.slice(n));
    },

    // (range end) | (range start end) | (range start end step)
    range: (...args: any[]) => {
        args.forEach((a) => assertNumber(a, "range"));

        let start = 0;
        let end = 0;
        let step = 1;

        if (args.length === 0) {
            throw new InvalidParamError(
                "range infinito não é suportado neste subset (use (range n))",
            );
        } else if (args.length === 1) {
            end = args[0];
        } else if (args.length === 2) {
            start = args[0];
            end = args[1];
        } else if (args.length === 3) {
            start = args[0];
            end = args[1];
            step = args[2];
        } else {
            throw new InvalidParamError(
                `Número inválido de argumentos para range (${args.length})`,
            );
        }

        if (step === 0)
            throw new InvalidParamError("range: step não pode ser 0");

        const out: number[] = [];
        if (step > 0) for (let i = start; i < end; i += step) out.push(i);
        else for (let i = start; i > end; i += step) out.push(i);
        return out;
    },

    // (repeat n x) — versão eager (não há lazy seqs neste subset)
    repeat: (n: any, x: any) => {
        assertNumber(n, "repeat");
        if (n <= 0) return [];
        return Array(n).fill(x);
    },

    // (reverse coll)
    reverse: (coll: any) =>
        asList(seqOrThrow(coll, "reverse").slice().reverse()),

    // (seq coll) -> a sequência, ou nil se vazia
    seq: (coll: any) => {
        const s = toSeq(coll);
        if (s === null) {
            if (coll === null || coll === undefined) return null;
            throw new InvalidParamError(
                `Erro em 'seq': esperava uma coleção, recebeu ${prStr(coll)}`,
            );
        }
        return s.length > 0 ? asList(s) : null;
    },

    // (into to from) — preserva o tipo de `to`
    into: (to: any, from: any) => {
        if (from === null || from === undefined) return to;
        const items = seqOrThrow(from, "into");
        return items.reduce((acc, item) => conjOne(acc, item), to);
    },

    // ==========================================
    // Helpers funcionais (R3/E1)
    // ==========================================

    identity: (x: any) => (x === undefined ? null : x),

    // (apply f args) ou (apply f x y ... args)
    apply: (f: any, ...args: any[]) => {
        assertFn(f, "apply");
        if (args.length === 0) {
            throw new InvalidParamError(
                "apply requer uma sequência como último argumento",
            );
        }
        const tail = seqOrThrow(args[args.length - 1], "apply");
        return callFn(f, ...args.slice(0, -1), ...tail);
    },

    // (comp f g h) -> (fn [& args] (f (g (apply h args))))
    comp: (...fns: any[]) => {
        if (fns.length === 0) return (x: any) => (x === undefined ? null : x);
        fns.forEach((f) => assertFn(f, "comp"));
        return (...args: any[]) => {
            let result = callFn(fns[fns.length - 1], ...args);
            for (let i = fns.length - 2; i >= 0; i--) {
                result = callFn(fns[i], result);
            }
            return result;
        };
    },

    // (partial f arg1 arg2 ...)
    partial: (f: any, ...fixedArgs: any[]) => {
        assertFn(f, "partial");
        return (...rest: any[]) => callFn(f, ...fixedArgs, ...rest);
    },

    // ==========================================
    // Mapas
    // ==========================================

    "hash-map": (...args: any[]) => {
        if (args.length % 2 !== 0) {
            throw new InvalidParamError(
                "hash-map requer um número par de argumentos",
            );
        }
        let map = new ClojureMap();
        for (let i = 0; i < args.length; i += 2) {
            map = map.assoc(args[i], args[i + 1]);
        }
        return map;
    },
    get: (coll: any, key: any, notFound: any = null) =>
        lookup(coll, key, notFound),
    assoc: (coll: any, ...args: any[]) => {
        if (args.length === 0 || args.length % 2 !== 0) {
            throw new InvalidParamError("assoc requer pares chave/valor");
        }
        let out = coll;
        for (let i = 0; i < args.length; i += 2) {
            out = assocOne(out, args[i], args[i + 1]);
        }
        return out;
    },
    dissoc: (map: any, ...keys: any[]) => {
        if (map === null || map === undefined) return null;
        if (!(map instanceof ClojureMap)) {
            throw new InvalidParamError("dissoc requer um mapa");
        }
        return keys.reduce((acc, k) => acc.dissoc(k), map);
    },
    keys: (map: any) => {
        if (!(map instanceof ClojureMap)) return null;
        return map.size === 0 ? null : map.keys();
    },
    vals: (map: any) => {
        if (!(map instanceof ClojureMap)) return null;
        return map.size === 0 ? null : map.values();
    },
    merge: (...maps: any[]) => {
        let out: ClojureMap | null = null;
        for (const m of maps) {
            if (m === null || m === undefined) continue;
            if (!(m instanceof ClojureMap)) {
                throw new InvalidParamError(
                    `merge requer mapas, recebeu ${prStr(m)}`,
                );
            }
            if (out === null) {
                out = m;
                continue;
            }
            for (const [k, v] of m) out = out.assoc(k, v);
        }
        return out;
    },

    // (update m k f & args)
    update: (coll: any, key: any, f: any, ...args: any[]) => {
        assertFn(f, "update");
        const current = lookup(coll, key, null);
        return assocOne(coll, key, callFn(f, current, ...args));
    },

    // (get-in m [k1 k2] notFound?)
    "get-in": (coll: any, path: any, notFound: any = null) =>
        getIn(coll, seqOrThrow(path, "get-in"), notFound),

    // (assoc-in m [k1 k2] v)
    "assoc-in": (coll: any, path: any, val: any) => {
        const ks = seqOrThrow(path, "assoc-in");
        if (ks.length === 0) {
            throw new InvalidParamError("assoc-in requer um caminho não vazio");
        }
        return assocIn(coll, ks, val);
    },

    // (update-in m [k1 k2] f & args)
    "update-in": (coll: any, path: any, f: any, ...args: any[]) => {
        assertFn(f, "update-in");
        const ks = seqOrThrow(path, "update-in");
        if (ks.length === 0) {
            throw new InvalidParamError(
                "update-in requer um caminho não vazio",
            );
        }
        const current = getIn(coll, ks, null);
        return assocIn(coll, ks, callFn(f, current, ...args));
    },

    // ==========================================
    // Interop & Atoms
    // ==========================================

    new: (ClassRef: any, ...args: any[]) => {
        if (typeof ClassRef !== "function") {
            throw new InvalidParamError(
                "O primeiro argumento de 'new' deve ser uma classe/função construtora.",
            );
        }
        return new ClassRef(...args);
    },
    ".": (member: string | ClojureKeyword, target: any, ...args: any[]) => {
        if (target === undefined || target === null) {
            throw new InvalidParamError(
                "Alvo do operador '.' é nulo ou indefinido.",
            );
        }

        let propName = member.toString();
        if (member instanceof ClojureKeyword) propName = member.value.slice(1);
        else if (propName.startsWith('"')) propName = propName.slice(1, -1);

        const value = target[propName];

        if (typeof value === "function") {
            return value.apply(target, args);
        }

        return value;
    },
    atom: (val: any) => new ClojureAtom(val),
    deref: (atm: any) => {
        if (!(atm instanceof ClojureAtom))
            throw new InvalidParamError("deref requer um átomo");
        return atm.value;
    },
    "reset!": (atm: any, newVal: any) => {
        if (!(atm instanceof ClojureAtom))
            throw new InvalidParamError("reset! requer um átomo");
        atm.value = newVal;
        return newVal;
    },
    "swap!": (atm: any, f: any, ...args: any[]) => {
        if (!(atm instanceof ClojureAtom))
            throw new InvalidParamError("swap! requer um átomo");
        assertFn(f, "swap!");
        atm.value = callFn(f, atm.value, ...args);
        return atm.value;
    },
    throw: (msg: any) => {
        throw new ClojureError(prStr(msg, false));
    },

    true: true,
    false: false,
    nil: null,
};

function compareChain(
    args: any[],
    op: string,
    cmp: (a: any, b: any) => boolean,
): boolean {
    if (args.length < 2) {
        if (args.length === 1) {
            assertNumber(args[0], op);
            return true;
        }
        throw new InvalidParamError(`'${op}' requer ao menos 1 argumento`);
    }
    args.forEach((a) => assertNumber(a, op));
    for (let i = 1; i < args.length; i++) {
        if (!cmp(args[i - 1], args[i])) return false;
    }
    return true;
}
