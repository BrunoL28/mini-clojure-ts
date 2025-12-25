import type { Expression } from "../types/index.js";
import type { UserFunction } from "../types/index.js";
import {
    ClojureVector,
    ClojureKeyword,
    ClojureMap,
    ClojureMacro,
} from "../types/index.js";
import { Env } from "./Environment.js";
import { InvalidParamError } from "../errors/InvalidParamError.js";
import { Bounce, trampoline } from "./Trampoline.js";

function evalQuasiquote(ast: any, env: Env): any {
    if (Array.isArray(ast)) {
        if (ast.length === 0) return [];

        if (ast[0] === "unquote") {
            return evaluate(ast[1], env);
        }

        return ast.map((item) => evalQuasiquote(item, env));
    }
    if (ast instanceof ClojureVector) {
        return new ClojureVector(
            ...ast.map((item) => evalQuasiquote(item, env)),
        );
    }
    return ast;
}

export function evaluate(x: Expression, env: Env): any {
    if (typeof x === "string") {
        if (x.startsWith('"') && x.endsWith('"')) return x.slice(1, -1);
        if (x.startsWith("js/")) {
            const jsSymbol = x.slice(3);
            const value = (globalThis as any)[jsSymbol];
            if (value === undefined) {
                throw new InvalidParamError(
                    `Global JavaScript 'js/${jsSymbol}' não encontrado.`,
                );
            }
            return value;
        }
        return env.get(x);
    }
    if (typeof x === "number") return x;

    if (x instanceof ClojureKeyword) return x;

    if (x instanceof ClojureMap) {
        const newMap = new ClojureMap();
        for (const [key, val] of x) {
            const evalKey = trampoline(evaluate(key, env));
            const evalVal = trampoline(evaluate(val, env));
            newMap.set(evalKey, evalVal);
        }
        return newMap;
    }

    if (x instanceof ClojureVector) {
        const evaluatedItems = x.map((item) => trampoline(evaluate(item, env)));
        return new ClojureVector(...evaluatedItems);
    }

    if (Array.isArray(x)) {
        if (x.length === 0) return null;
        const [op, ...args] = x;

        if (op === "def") {
            const [name, valueExpr] = args;
            if (typeof name !== "string")
                throw new InvalidParamError("Nome de variável inválido no def");
            const value = trampoline(evaluate(valueExpr!, env));
            env.set(name, value);
            return value;
        }

        if (op === "if") {
            const [test, thenExpr, elseExpr] = args;
            const condition = trampoline(evaluate(test!, env));
            if (condition !== false && condition !== null)
                return evaluate(thenExpr!, env);
            return elseExpr ? evaluate(elseExpr!, env) : null;
        }

        if (op === "quote") return args[0];

        if (op === "do") {
            let result = null;
            for (let i = 0; i < args.length - 1; i++) {
                trampoline(evaluate(args[i]!, env));
            }
            if (args.length > 0) {
                return evaluate(args[args.length - 1]!, env);
            }
            return null;
        }

        if (op === "fn") {
            const [params, body] = args;
            return {
                params: params as string[],
                body: body!,
                env: env,
            } as UserFunction;
        }

        if (op === "let") {
            const [bindings, ...body] = args;
            if (!Array.isArray(bindings))
                throw new InvalidParamError("let requer bindings");

            const letEnv = new Env(env);
            for (let i = 0; i < bindings.length; i += 2) {
                const name = bindings[i];
                const val = trampoline(evaluate(bindings[i + 1]!, env));
                if (typeof name !== "string")
                    throw new InvalidParamError("Nome inválido no let");
                letEnv.set(name, val);
            }

            for (let i = 0; i < body.length - 1; i++) {
                trampoline(evaluate(body[i]!, letEnv));
            }
            if (body.length > 0)
                return evaluate(body[body.length - 1]!, letEnv);
            return null;
        }

        if (op === "defmacro") {
            const [name, params, body] = args;
            if (typeof name !== "string")
                throw new InvalidParamError("Nome de macro inválido");
            const macro = new ClojureMacro(params as string[], body!, env);
            env.set(name, macro);
            return name;
        }

        if (op === "quasiquote") {
            return evalQuasiquote(args[0], env);
        }

        if (op === "unquote") {
            throw new InvalidParamError(
                "Unquote (~) só pode ser usado dentro de Quasiquote (`)",
            );
        }

        const func = trampoline(evaluate(op!, env));

        if (func instanceof ClojureMacro) {
            const macroEnv = new Env(func.env, func.params, args);
            const expandedCode = trampoline(evaluate(func.body, macroEnv));
            return evaluate(expandedCode, env);
        }

        const argsVal = args.map((arg) => trampoline(evaluate(arg!, env)));
        if (typeof func === "function") return func(...argsVal);

        if (
            func &&
            typeof func === "object" &&
            "params" in func &&
            "body" in func
        ) {
            const userFunc = func as UserFunction;
            const functionEnv = new Env(userFunc.env, userFunc.params, argsVal);
            return new Bounce(() => evaluate(userFunc.body, functionEnv));
        }

        throw new InvalidParamError(`'${op}' não é uma função válida.`);
    }

    return x;
}
