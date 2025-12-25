import { Env } from "../core/Environment.js";
import { evaluate } from "../core/Evaluator.js";
import { InvalidParamError } from "../errors/InvalidParamError.js";
import { trampoline } from "../core/Trampoline.js";
import { ClojureVector, ClojureKeyword, ClojureMap } from "../types/index.js";

export const initialConfig: { [key: string]: any } = {
    "+": (...args: number[]) => args.reduce((a, b) => a + b, 0),
    "-": (a: number, b: number) => a - b,
    "*": (...args: number[]) => args.reduce((a, b) => a * b, 1),
    "/": (a: number, b: number) => a / b,
    ">": (a: number, b: number) => a > b,
    "<": (a: number, b: number) => a < b,
    "=": (a: any, b: any) => a === b,
    ">=": (a: number, b: number) => a >= b,
    "<=": (a: number, b: number) => a <= b,
    "%": (a: number, b: number) => a % b,

    str: (...args: any[]) => args.join(""),
    print: (...args: any[]) => {
        console.log(...args);
        return null;
    },

    list: (...args: any[]) => args,
    first: (a: any[]) => (Array.isArray(a) && a.length > 0 ? a[0] : null),
    rest: (a: any[]) => (Array.isArray(a) && a.length > 0 ? a.slice(1) : []),
    count: (a: any[]) => (Array.isArray(a) ? a.length : 0),
    "empty?": (a: any[]) => Array.isArray(a) && a.length === 0,
    cons: (item: any, list: any[]) => {
        const tail = Array.isArray(list) ? list : [];
        return [item, ...tail];
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
    "hash-map": (...args: any[]) => {
        const map = new ClojureMap();
        for (let i = 0; i < args.length; i += 2) {
            map.set(args[i], args[i + 1]);
        }
        return map;
    },
    get: (map: any, key: any, notFound: any = null) => {
        if (!(map instanceof ClojureMap)) return notFound;
        if (map.has(key)) return map.get(key);
        if (key instanceof ClojureKeyword) {
            for (const [k, v] of map) {
                if (k instanceof ClojureKeyword && k.value === key.value)
                    return v;
            }
        }
        return notFound;
    },
    assoc: (map: any, ...args: any[]) => {
        if (!(map instanceof ClojureMap))
            throw new Error("assoc requer um mapa");
        const newMap = new ClojureMap(map);
        for (let i = 0; i < args.length; i += 2) {
            newMap.set(args[i], args[i + 1]);
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

    true: true,
    false: false,
    nil: null,
};
