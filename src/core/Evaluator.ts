import type { Expression } from "../types/index.js";
import type { UserFunction, ClojureList } from "../types/index.js";
import {
    ClojureVector,
    ClojureKeyword,
    ClojureMap,
    ClojureMacro,
    ClojureAtom,
    ClojureSymbol,
} from "../types/index.js";
import { Env } from "./Environment.js";
import { InvalidParamError } from "../errors/InvalidParamError.js";
import { ClojureReferenceError } from "../errors/ReferenceError.js";
import { ClojureError } from "../errors/ClojureError.js";
import { Bounce, trampoline } from "./Trampoline.js";

function evalQuasiquote(ast: any, env: Env): any {
    if (Array.isArray(ast)) {
        if (ast.length === 0) return [];

        const op = ast[0];
        const isUnquote =
            (op instanceof ClojureSymbol && op.value === "unquote") ||
            op === "unquote";

        if (isUnquote) {
            return evaluate(ast[1], env);
        }

        return ast.map((item) => evalQuasiquote(item, env));
    }
    if (ast instanceof ClojureVector) {
        return new ClojureVector(
            ...ast.map((item) => evalQuasiquote(item, env)),
        );
    }
    if (ast instanceof ClojureSymbol) {
        return ast;
    }
    return ast;
}

function bind(env: Env, shape: any, value: any) {
    let key = shape;
    if (shape instanceof ClojureSymbol) key = shape.value;

    if (typeof key === "string") {
        if (key === "&") return;
        env.set(key, value);
        return;
    }

    if (Array.isArray(shape) || shape instanceof ClojureVector) {
        if (!Array.isArray(value) && !(value instanceof ClojureVector)) {
            throw new InvalidParamError(
                `Destructuring: esperava uma coleção, recebeu ${value}`,
            );
        }

        let valIndex = 0;
        for (let i = 0; i < shape.length; i++) {
            let param = shape[i];

            const paramName =
                param instanceof ClojureSymbol ? param.value : param;

            if (paramName === "&") {
                const nextParam = shape[i + 1];
                if (!nextParam)
                    throw new InvalidParamError("Esperado nome após '&'");
                const remaining = value.slice(valIndex);
                bind(env, nextParam, new ClojureVector(...remaining));
                break;
            }

            const valToBind = valIndex < value.length ? value[valIndex] : null;
            bind(env, param, valToBind);
            valIndex++;
        }
    }
}

export function evaluate(x: Expression, env: Env): any {
    try {
        if (x instanceof ClojureSymbol) {
            if (x.value.startsWith("js/")) {
                const jsSymbol = x.value.slice(3);
                const value = (globalThis as any)[jsSymbol];
                if (value === undefined) {
                    throw new InvalidParamError(
                        `Global JavaScript 'js/${jsSymbol}' não encontrado.`,
                    );
                }
                return value;
            }

            try {
                return env.get(x.value);
            } catch (e) {
                if (e instanceof ClojureReferenceError && !e.loc) {
                    e.loc = x.loc;
                }
                throw e;
            }
        }

        if (typeof x === "string") {
            if (x.startsWith('"') && x.endsWith('"')) return x.slice(1, -1);
            return env.get(x);
        }

        if (typeof x === "number") return x;
        if (typeof x === "boolean") return x;
        if (x === null) return null;
        if (x instanceof ClojureKeyword) return x;
        if (x instanceof ClojureAtom) return x;

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
            const evaluatedItems = x.map((item) =>
                trampoline(evaluate(item, env)),
            );
            return new ClojureVector(...evaluatedItems);
        }

        if (Array.isArray(x)) {
            if (x.length === 0) return null;
            const [op, ...args] = x;

            let opName = op;
            if (op instanceof ClojureSymbol) opName = op.value;

            if (opName === "def") {
                const [name, valueExpr] = args;
                let varName = name;
                if (name instanceof ClojureSymbol) varName = name.value;

                if (typeof varName !== "string")
                    throw new InvalidParamError(
                        "Nome de variável inválido no def",
                    );

                const value = trampoline(evaluate(valueExpr!, env));
                env.set(varName, value);
                return value;
            }

            if (opName === "if") {
                const [test, thenExpr, elseExpr] = args;
                const condition = trampoline(evaluate(test!, env));
                if (condition !== false && condition !== null)
                    return evaluate(thenExpr!, env);
                return elseExpr ? evaluate(elseExpr!, env) : null;
            }

            if (opName === "quote") return args[0];

            if (opName === "do") {
                let result = null;
                for (let i = 0; i < args.length - 1; i++) {
                    trampoline(evaluate(args[i]!, env));
                }
                if (args.length > 0) {
                    return evaluate(args[args.length - 1]!, env);
                }
                return null;
            }

            if (opName === "fn") {
                const [params, body] = args;
                return {
                    params: params as any[],
                    body: body!,
                    env: env,
                } as UserFunction;
            }

            if (opName === "let") {
                const [bindings, ...body] = args;
                if (!Array.isArray(bindings))
                    throw new InvalidParamError("let requer bindings");

                const letEnv = new Env(env);
                for (let i = 0; i < bindings.length; i += 2) {
                    const shape = bindings[i];
                    const valExpr = bindings[i + 1];
                    const val = trampoline(evaluate(valExpr!, env));
                    bind(letEnv, shape, val);
                }

                for (let i = 0; i < body.length - 1; i++) {
                    trampoline(evaluate(body[i]!, letEnv));
                }
                if (body.length > 0)
                    return evaluate(body[body.length - 1]!, letEnv);
                return null;
            }

            if (opName === "try") {
                const tryBody = [];
                let catchClause = null;

                for (const arg of args) {
                    const isCatch =
                        Array.isArray(arg) &&
                        arg.length > 0 &&
                        ((arg[0] instanceof ClojureSymbol &&
                            arg[0].value === "catch") ||
                            arg[0] === "catch");

                    if (isCatch) {
                        catchClause = arg;
                    } else {
                        tryBody.push(arg);
                    }
                }

                try {
                    let result = null;
                    for (const expr of tryBody) {
                        result = trampoline(evaluate(expr!, env));
                    }
                    return result;
                } catch (e: any) {
                    if (catchClause) {
                        const [_, errVarName, errBody] = catchClause;
                        let varName = errVarName;
                        if (errVarName instanceof ClojureSymbol)
                            varName = errVarName.value;

                        if (typeof varName !== "string") {
                            throw new InvalidParamError(
                                "Nome da variável de erro inválido no catch",
                            );
                        }

                        const errorMessage =
                            e instanceof Error ? e.message : String(e);

                        const catchEnv = new Env(
                            env,
                            [varName],
                            [errorMessage],
                        );

                        return evaluate(errBody!, catchEnv);
                    }
                    throw e;
                }
            }

            if (opName === "defmacro") {
                const [name, params, body] = args;
                let macroName = name;
                if (name instanceof ClojureSymbol) macroName = name.value;

                if (typeof macroName !== "string")
                    throw new InvalidParamError("Nome de macro inválido");

                const paramNames = (params as any[]).map((p) =>
                    p instanceof ClojureSymbol ? p.value : p,
                );

                const macro = new ClojureMacro(paramNames, body!, env);
                env.set(macroName, macro);
                return macroName;
            }

            if (opName === "quasiquote") {
                return evalQuasiquote(args[0], env);
            }

            const func = trampoline(evaluate(op!, env));

            if (func instanceof ClojureMacro) {
                const macroEnv = new Env(func.env, func.params, args);
                const expandedCode = trampoline(evaluate(func.body, macroEnv));
                return evaluate(expandedCode, env);
            }

            const argsVal = args.map((arg) => trampoline(evaluate(arg!, env)));

            if (typeof func === "function") {
                return func(...argsVal);
            }

            if (
                func &&
                typeof func === "object" &&
                "params" in func &&
                "body" in func
            ) {
                const userFunc = func as UserFunction;
                const functionEnv = new Env(userFunc.env, [], []);

                const paramDefs = userFunc.params;

                bind(functionEnv, paramDefs, argsVal);
                return new Bounce(() => evaluate(userFunc.body, functionEnv));
            }

            throw new InvalidParamError(
                `'${opName}' (${typeof func}) não é uma função válida.`,
            );
        }

        return x;
    } catch (e: any) {
        if (e instanceof ClojureError) {
            if (!e.loc && (x as any).loc) {
                e.loc = (x as any).loc;
            }
        }
        throw e;
    }
}
