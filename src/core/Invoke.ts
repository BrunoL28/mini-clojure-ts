import { Env } from "./Environment.js";
import { evaluate, bind } from "./Evaluator.js";
import { trampoline } from "./Trampoline.js";
import { ClojureKeyword, ClojureMap, ClojureMacro } from "../types/index.js";
import type { UserFunction } from "../types/index.js";
import { InvalidParamError } from "../errors/InvalidParamError.js";

/**
 * Verifica a "verdade" de um valor segundo a semântica de Clojure:
 * apenas `false` e `nil` são falsos. Tudo o mais é verdadeiro.
 *
 * @param {any} x O valor a ser testado.
 * @return {boolean} `true` se o valor for considerado verdadeiro.
 */
export function truthy(x: any): boolean {
    return x !== false && x !== null && x !== undefined;
}

/**
 * Indica se o valor pode ser invocado como função pelo runtime
 * (função nativa JS, função de usuário `fn`/`defn` ou keyword).
 *
 * @param {any} x O valor a ser testado.
 * @return {boolean} `true` se o valor for invocável.
 */
export function isCallable(x: any): boolean {
    if (typeof x === "function") return true;
    if (x instanceof ClojureKeyword) return true;
    if (x instanceof ClojureMacro) return false;
    return !!x && typeof x === "object" && "params" in x && "body" in x;
}

/**
 * Invoca qualquer valor "chamável" do Mini-Clojure de forma uniforme.
 *
 * Isso é o que permite que funções da stdlib de ordem superior
 * (`map`, `filter`, `reduce`, `apply`, ...) recebam tanto funções nativas
 * quanto funções definidas pelo usuário via `fn`/`defn`, que são
 * representadas como objetos `{params, body, env}` e não como funções JS.
 *
 * @param {any} f O valor a ser invocado.
 * @param {any[]} args Os argumentos já avaliados.
 * @throws {InvalidParamError} Se `f` não for invocável.
 * @return {any} O resultado da chamada.
 */
export function callFn(f: any, ...args: any[]): any {
    if (typeof f === "function") {
        return f(...args);
    }

    if (f instanceof ClojureKeyword) {
        const [target, notFound = null] = args;
        if (target instanceof ClojureMap) {
            // O HAMT indexa keywords por valor, então `get` basta.
            const value = target.get(f);
            if (value !== undefined) return value;
        }
        return notFound;
    }

    if (f && typeof f === "object" && "params" in f && "body" in f) {
        const userFunc = f as UserFunction;
        const fnEnv = new Env(userFunc.env, [], []);
        bind(fnEnv, userFunc.params, args);
        return trampoline(evaluate(userFunc.body, fnEnv));
    }

    throw new InvalidParamError(
        `Valor do tipo '${typeof f}' não é uma função válida.`,
    );
}
