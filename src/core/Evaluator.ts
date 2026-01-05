import type { Expression } from "../types/index.js";
import type { UserFunction } from "../types/index.js";
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

function validateBindingShape(shape: any) {
    if (shape instanceof ClojureSymbol) return;
    if (typeof shape === "string") {
        if (shape === "&") return;
        throw new InvalidParamError(
            `Parâmetro inválido: string '${shape}' não permitida. Use símbolos.`,
        );
    }
    if (shape instanceof ClojureVector || Array.isArray(shape)) {
        for (const item of shape) validateBindingShape(item);
        return;
    }
    if (shape instanceof ClojureMap) {
        for (const [key, val] of shape) {
            if (key instanceof ClojureKeyword) {
                if (key.value === ":keys") {
                    if (!(val instanceof ClojureVector) && !Array.isArray(val))
                        throw new InvalidParamError(":keys requer vetor.");
                    return;
                }
                if (key.value === ":as") {
                    if (!(val instanceof ClojureSymbol))
                        throw new InvalidParamError(":as requer símbolo.");
                    return;
                }
                if (key.value === ":or") {
                    if (!(val instanceof ClojureMap))
                        throw new InvalidParamError(":or requer um mapa.");
                    return;
                }
                throw new InvalidParamError(
                    `Keyword '${key}' desconhecida em binding.`,
                );
            }
            validateBindingShape(key);
        }
        return;
    }
    throw new InvalidParamError(`Forma de binding inválida: ${shape}`);
}

function resolveDefault(
    env: Env,
    defaults: ClojureMap | null,
    keySymbol: ClojureSymbol,
): any {
    if (!defaults) return null;
    let defaultExpr = defaults.get(keySymbol);
    if (defaultExpr === undefined) {
        for (const [k, v] of defaults) {
            if (k instanceof ClojureSymbol && k.value === keySymbol.value) {
                defaultExpr = v;
                break;
            }
        }
    }

    if (defaultExpr !== undefined) {
        return trampoline(evaluate(defaultExpr, env));
    }

    return null;
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
        if (
            value !== null &&
            !Array.isArray(value) &&
            !(value instanceof ClojureVector)
        ) {
            throw new InvalidParamError(
                `Destructuring: esperava sequência, recebeu ${value}`,
            );
        }

        const listValue = value === null ? [] : value;

        let valIndex = 0;
        for (let i = 0; i < shape.length; i++) {
            const param = shape[i];
            const paramName =
                param instanceof ClojureSymbol ? param.value : param;

            if (paramName === "&") {
                const nextParam = shape[i + 1];
                if (!nextParam)
                    throw new InvalidParamError("Esperado símbolo após &");

                const remaining = listValue.slice(valIndex);
                bind(env, nextParam, new ClojureVector(...remaining));
                break;
            }

            const valToBind =
                valIndex < listValue.length ? listValue[valIndex] : null;
            bind(env, param, valToBind);
            valIndex++;
        }
        return;
    }

    if (shape instanceof ClojureMap) {
        if (value !== null && !(value instanceof ClojureMap)) {
            throw new InvalidParamError(
                `Destructuring: esperava mapa, recebeu ${value}`,
            );
        }
        const mapValue = value === null ? new ClojureMap() : value;
        let defaults: ClojureMap | null = null;
        for (const [k, v] of shape) {
            if (k instanceof ClojureKeyword) {
                if (k.value === ":or") {
                    defaults = v as ClojureMap;
                } else if (k.value === ":as") {
                    bind(env, v, mapValue);
                }
            }
        }

        for (const [target, source] of shape) {
            if (target instanceof ClojureKeyword) {
                if (target.value === ":or" || target.value === ":as") continue;
                if (target.value === ":keys") {
                    const keysVector = source as any[];
                    for (const sym of keysVector) {
                        if (sym instanceof ClojureSymbol) {
                            const lookupKey = new ClojureKeyword(
                                ":" + sym.value,
                            );
                            let val = mapValue.get(lookupKey);
                            if (val === undefined) {
                                for (const [mk, mv] of mapValue) {
                                    if (
                                        mk instanceof ClojureKeyword &&
                                        mk.value === lookupKey.value
                                    ) {
                                        val = mv;
                                        break;
                                    }
                                }
                            }
                            if (val === undefined) {
                                const def = resolveDefault(env, defaults, sym);
                                val = def !== null ? def : null;
                            }

                            bind(env, sym, val);
                        }
                    }
                    continue;
                }
            }

            const lookupKey = source;
            let val = mapValue.get(lookupKey);
            if (val === undefined) {
                for (const [mk, mv] of mapValue) {
                    if (
                        (mk instanceof ClojureKeyword &&
                            lookupKey instanceof ClojureKeyword &&
                            mk.value === lookupKey.value) ||
                        (typeof mk === "string" &&
                            typeof lookupKey === "string" &&
                            mk === lookupKey)
                    ) {
                        val = mv;
                        break;
                    }
                }
            }

            if (val === undefined && target instanceof ClojureSymbol) {
                const def = resolveDefault(env, defaults, target);
                val = def !== null ? def : null;
            }

            bind(env, target, val ?? null);
        }
        return;
    }

    throw new InvalidParamError(`Forma inválida: ${shape}`);
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
            return x;
        }

        if (typeof x === "number") return x;
        if (typeof x === "boolean") return x;
        if (x === null) return null;
        if (x instanceof ClojureKeyword) return x;
        if (x instanceof ClojureAtom) return x;

        if (x instanceof ClojureMap) {
            const newMap = new ClojureMap();
            if (x.loc) newMap.loc = x.loc;
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
            const v = new ClojureVector(...evaluatedItems);
            if (x.loc) v.loc = x.loc;
            return v;
        }

        if (Array.isArray(x)) {
            if (x.length === 0) return null;
            const [op, ...args] = x;

            let opName = op;
            if (op instanceof ClojureSymbol) opName = op.value;

            if (opName === "defn") {
                const [name, params, ...body] = args;

                let fnName = name;
                if (name instanceof ClojureSymbol) fnName = name.value;

                if (typeof fnName !== "string") {
                    throw new InvalidParamError(
                        "O primeiro argumento de 'defn' deve ser um símbolo (nome).",
                    );
                }

                if (!(params instanceof ClojureVector)) {
                    throw new InvalidParamError(
                        "O segundo argumento de 'defn' deve ser um VETOR [...] de parâmetros.",
                    );
                }

                validateBindingShape(params);

                let fnBody: any = null;
                if (body.length > 1) {
                    fnBody = ["do", ...body];
                } else if (body.length === 1) {
                    fnBody = body[0];
                }

                const fnExpr = ["fn", params, fnBody];
                const fnValue = trampoline(evaluate(fnExpr, env));

                env.set(fnName, fnValue);

                return fnName;
            }

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
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const result = null;
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

                if (!(params instanceof ClojureVector)) {
                    throw new InvalidParamError(
                        "Os parâmetros de 'fn' devem ser um vetor.",
                    );
                }
                validateBindingShape(params);

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

                if (bindings.length % 2 !== 0) {
                    throw new InvalidParamError(
                        "let requer número par de itens no vetor de bindings",
                    );
                }

                const letEnv = new Env(env);
                for (let i = 0; i < bindings.length; i += 2) {
                    const shape = bindings[i];
                    const valExpr = bindings[i + 1];
                    const val = trampoline(evaluate(valExpr!, letEnv));
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
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

            if (func instanceof ClojureKeyword) {
                const [target, notFound] = argsVal;

                if (target === null || target === undefined) {
                    return notFound ?? null;
                }

                if (target instanceof ClojureMap) {
                    if (target.has(func)) return target.get(func);
                    for (const [k, v] of target) {
                        if (
                            k instanceof ClojureKeyword &&
                            k.value === func.value
                        ) {
                            return v;
                        }
                    }
                    return notFound ?? null;
                }

                return notFound ?? null;
            }

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
