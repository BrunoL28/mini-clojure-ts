import { Env } from "../core/Environment.js";
import { evaluate } from "../core/Evaluator.js";
import { InvalidParamError } from "../errors/InvalidParamError.js";
import { trampoline } from "../core/Trampoline.js";
import { ClojureVector } from "../types/index.js";

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

    true: true,
    false: false,
    nil: null,
};
