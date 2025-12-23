import type { Expression } from "../types/index.js";
import type { UserFunction } from "../types/index.js";
import { Env } from "./Environment.js";
import { InvalidParamError } from "../errors/InvalidParamError.js";

export function evaluate(x: Expression, env: Env): any {
    if (typeof x === "string") {
        if (x.startsWith('"') && x.endsWith('"')) return x.slice(1, -1);
        return env.get(x);
    }
    if (typeof x === "number") return x;

    if (Array.isArray(x)) {
        if (x.length === 0) return null;
        const [op, ...args] = x;

        if (op === "def") {
            const [name, valueExpr] = args;
            if (typeof name !== "string")
                throw new InvalidParamError("Nome de variável inválido no def");
            const value = evaluate(valueExpr!, env);
            env.set(name, value);
            return value;
        }

        if (op === "if") {
            const [test, thenExpr, elseExpr] = args;
            const condition = evaluate(test!, env);
            if (condition !== false && condition !== null)
                return evaluate(thenExpr!, env);
            return elseExpr ? evaluate(elseExpr!, env) : null;
        }

        if (op === "quote") return args[0];

        if (op === "do") {
            let result = null;
            for (const arg of args) result = evaluate(arg!, env);
            return result;
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
                throw new InvalidParamError("let requer uma lista de bindings");

            const letEnv = new Env(env);
            for (let i = 0; i < bindings.length; i += 2) {
                const name = bindings[i];
                const val = evaluate(bindings[i + 1]!, env);
                if (typeof name !== "string")
                    throw new InvalidParamError(
                        "Nome de variável inválido no let",
                    );
                letEnv.set(name, val);
            }

            let res = null;
            for (const expr of body) res = evaluate(expr!, letEnv);
            return res;
        }

        const func = evaluate(op!, env);
        const argsVal = args.map((arg) => evaluate(arg!, env));

        if (typeof func === "function") return func(...argsVal);

        if (
            func &&
            typeof func === "object" &&
            "params" in func &&
            "body" in func
        ) {
            const userFunc = func as UserFunction;
            const functionEnv = new Env(userFunc.env, userFunc.params, argsVal);
            return evaluate(userFunc.body, functionEnv);
        }

        throw new InvalidParamError(`'${op}' não é uma função válida.`);
    }
}
