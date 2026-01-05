import { Env } from "../core/Environment.js";
import { evaluate } from "../core/Evaluator.js";
import { InvalidParamError } from "../errors/InvalidParamError.js";
import { trampoline } from "../core/Trampoline.js";
import {
    ClojureVector,
    ClojureKeyword,
    ClojureMap,
    ClojureAtom,
    ClojureSymbol,
} from "../types/index.js";
import { prStr } from "../core/Printer.js";
import { equals } from "../core/Runtime.js";
import { parse } from "../core/Parser.js";
import { tokenize } from "../core/Tokenizer.js";

function assertNumber(val: any, operation: string) {
    if (typeof val !== "number" || isNaN(val)) {
        throw new InvalidParamError(
            `Erro em '${operation}': esperava número, recebeu ${prStr(val)} (${typeof val})`,
        );
    }
}

function resolveKey(map: ClojureMap, key: any): any {
    if (key instanceof ClojureKeyword || key instanceof ClojureSymbol) {
        if (map.has(key)) return key;

        for (const k of map.keys()) {
            if (
                (k instanceof ClojureKeyword &&
                    key instanceof ClojureKeyword &&
                    k.value === key.value) ||
                (k instanceof ClojureSymbol &&
                    key instanceof ClojureSymbol &&
                    k.value === key.value)
            ) {
                return k;
            }
        }
    }
    return key;
}

export const initialConfig: { [key: string]: any } = {
    "+": (...args: any[]) => {
        return args.reduce((a, b) => {
            assertNumber(a, "+");
            assertNumber(b, "+");
            return a + b;
        }, 0);
    },
    "-": (a: any, b: any) => {
        assertNumber(a, "-");
        assertNumber(b, "-");
        return a - b;
    },
    "*": (...args: any[]) => {
        return args.reduce((a, b) => {
            assertNumber(a, "*");
            assertNumber(b, "*");
            return a * b;
        }, 1);
    },
    "/": (a: any, b: any) => {
        assertNumber(a, "/");
        assertNumber(b, "/");
        if (b === 0) throw new Error("Divisão por zero");
        return a / b;
    },
    "%": (a: any, b: any) => {
        assertNumber(a, "%");
        assertNumber(b, "%");
        return a % b;
    },
    ">": (a: any, b: any) => {
        assertNumber(a, ">");
        assertNumber(b, ">");
        return a > b;
    },
    "<": (a: any, b: any) => {
        assertNumber(a, "<");
        assertNumber(b, "<");
        return a < b;
    },
    ">=": (a: any, b: any) => {
        assertNumber(a, ">=");
        assertNumber(b, ">=");
        return a >= b;
    },
    "<=": (a: any, b: any) => {
        assertNumber(a, "<=");
        assertNumber(b, "<=");
        return a <= b;
    },

    // --- LÓGICA / COMPARAÇÃO ---
    "=": (a: any, b: any) => equals(a, b),
    "identical?": (a: any, b: any) => a === b,
    "not=": (a: any, b: any) => !equals(a, b),
    not: (a: any) => (a === false || a === null ? true : false),

    // --- STRING / IO ---
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
        const output = args.map((a) => prStr(a, false)).join(" ");
        console.log(output);
        return null;
    },
    println: (...args: any[]) => {
        const output = args.map((a) => prStr(a, false)).join(" ");
        console.log(output);
        return null;
    },
    prn: (...args: any[]) => {
        const output = args.map((a) => prStr(a, true)).join(" ");
        console.log(output);
        return null;
    },

    // --- COLEÇÕES ---
    list: (...args: any[]) => args,
    first: (a: any[]) => (Array.isArray(a) && a.length > 0 ? a[0] : null),
    second: (a: any[]) => (Array.isArray(a) && a.length > 1 ? a[1] : null),
    rest: (a: any[]) => (Array.isArray(a) && a.length > 0 ? a.slice(1) : []),
    count: (a: any[]) => (Array.isArray(a) ? a.length : 0),
    "empty?": (a: any[]) => Array.isArray(a) && a.length === 0,
    cons: (item: any, list: any[]) => {
        const tail = Array.isArray(list) ? list : [];
        return [item, ...tail];
    },
    conj: (coll: any, item: any) => {
        if (coll instanceof ClojureVector) {
            return new ClojureVector(...coll, item);
        }
        if (Array.isArray(coll)) {
            return [item, ...coll];
        }
        return [item];
    },
    concat: (list1: any[], list2: any[]) => {
        if (!Array.isArray(list1) || !Array.isArray(list2)) {
            throw new InvalidParamError("Concat requer duas listas.");
        }
        return [...list1, ...list2];
    },
    map: (func: any, list: any[]) => {
        if (!Array.isArray(list))
            throw new InvalidParamError("Map requer lista");

        return list.map((item) => {
            if (typeof func === "function") {
                return func(item);
            } else if (
                typeof func === "object" &&
                "params" in func &&
                "body" in func
            ) {
                const fnEnv = new Env(func.env, func.params, [item]);
                return trampoline(evaluate(func.body, fnEnv));
            }
            throw new InvalidParamError("Map requer função");
        });
    },
    vector: (...args: any[]) => new ClojureVector(...args),
    nth: (coll: any[], index: number) => {
        if (!Array.isArray(coll)) throw new Error("nth requer uma coleção");
        return coll[index];
    },
    "vector?": (x: any) => x instanceof ClojureVector,

    // --- MAPAS ---
    "hash-map": (...args: any[]) => {
        const map = new ClojureMap();
        for (let i = 0; i < args.length; i += 2) {
            const key = args[i];
            const val = args[i + 1];
            const existingKey = resolveKey(map, key);
            map.set(existingKey, val);
        }
        return map;
    },

    get: (map: any, key: any, notFound: any = null) => {
        if (!(map instanceof ClojureMap)) return notFound;
        if (map.has(key)) return map.get(key);
        const existingKey = resolveKey(map, key);
        if (map.has(existingKey)) return map.get(existingKey);

        return notFound;
    },

    assoc: (map: any, ...args: any[]) => {
        if (!(map instanceof ClojureMap))
            throw new Error("assoc requer um mapa");
        const newMap = new ClojureMap(map);
        for (let i = 0; i < args.length; i += 2) {
            const key = args[i];
            const val = args[i + 1];
            const keyToSet = resolveKey(newMap, key);

            newMap.set(keyToSet, val);
        }
        return newMap;
    },
    keys: (map: any) => {
        if (!(map instanceof ClojureMap)) return [];
        return new ClojureVector(...map.keys());
    },
    vals: (map: any) => {
        if (!(map instanceof ClojureMap)) return [];
        return new ClojureVector(...map.values());
    },

    // --- INTEROP & ATOMS ---
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
    "atom?": (x: any) => x instanceof ClojureAtom,
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
    "swap!": (atm: any, func: any, ...args: any[]) => {
        if (!(atm instanceof ClojureAtom))
            throw new InvalidParamError("swap! requer um átomo");

        let newVal;
        if (typeof func === "function") {
            newVal = func(atm.value, ...args);
        } else if (
            typeof func === "object" &&
            "params" in func &&
            "body" in func
        ) {
            const fnEnv = new Env(func.env, func.params, [atm.value, ...args]);
            newVal = trampoline(evaluate(func.body, fnEnv));
        } else {
            throw new InvalidParamError(
                "swap! requer uma função como segundo argumento",
            );
        }

        atm.value = newVal;
        return newVal;
    },
    throw: (msg: string) => {
        throw new Error(msg);
    },

    true: true,
    false: false,
    nil: null,
};
