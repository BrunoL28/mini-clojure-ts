import { Env } from "./Environment.js";
import { tokenize } from "./Tokenizer.js";
import { parse as parseExpr } from "./Parser.js";
import { evaluate } from "./Evaluator.js";
import { initialConfig } from "../stdlib/index.js";
import { trampoline } from "./Trampoline.js";
import { compileProgram, DEFAULT_RUNTIME_IMPORT } from "./Compiler.js";
import type { CompileProgramOptions } from "./Compiler.js";
import { type Expression } from "../types/index.js";
import { prStr } from "./Printer.js";
import { clearModuleCache, CURRENT_FILE } from "./Modules.js";
import {
    setInteropPolicy,
    createSandboxPolicy,
    OPEN_POLICY,
    accessMember,
    readProperty,
    construct,
    DEFAULT_ALLOWED_GLOBALS,
} from "./Interop.js";
import type { InteropPolicy, SandboxOptions } from "./Interop.js";
import { ClojureError } from "../errors/ClojureError.js";
import {
    startTimeLimit,
    clearTimeLimit,
    setPrintLimits,
    getPrintLimits,
} from "./Limits.js";

// ----- API Types ----- //

export interface RunOptions extends GlobalEnvOptions {
    env?: Env;
    /** Interrompe a execução depois de N ms. `0` ou ausente = sem limite. */
    timeoutMs?: number;
}

export interface GlobalEnvOptions {
    /** Liga o modo sandbox: interop restrito, sem IO nem módulos. */
    sandbox?: boolean;
    /** Ajustes da whitelist do sandbox. */
    sandboxOptions?: SandboxOptions;
}

export interface CompileOptions extends CompileProgramOptions {
    outFile?: string;
}

// ----- Public API ----- //

/**
 * Cria um novo ambiente global com a configuração inicial (stdlib).
 *
 * @return {Env} Um novo ambiente global configurado.
 */
export function createGlobalEnv(opts: GlobalEnvOptions = {}): Env {
    const env = new Env();
    Object.keys(initialConfig).forEach((key) => {
        env.set(key, initialConfig[key]);
    });

    const policy: InteropPolicy = opts.sandbox
        ? createSandboxPolicy(opts.sandboxOptions ?? {})
        : OPEN_POLICY;

    setInteropPolicy(env, policy);

    if (policy !== OPEN_POLICY) {
        // O interop precisa enxergar a política. As entradas da stdlib são
        // fechadas sobre `OPEN_POLICY`, então são substituídas aqui.
        env.set("new", (ClassRef: any, ...args: any[]) =>
            construct(policy, ClassRef, args),
        );
        env.set(".", (member: any, target: any, ...args: any[]) =>
            accessMember(policy, member, target, args),
        );
        env.set(".-", (member: any, target: any) =>
            readProperty(policy, member, target),
        );

        if (!policy.allowFileIO) {
            // Um sandbox que bloqueia `js/process` mas deixa `slurp` aberto
            // não bloqueia nada.
            for (const name of ["slurp", "spit"]) {
                env.set(name, () => {
                    throw new ClojureError(
                        `Sandbox: '${name}' bloqueado (acesso ao sistema de arquivos).`,
                    );
                });
            }
        }
    }

    return env;
}

/**
 * Tokeniza e analisa uma string de código-fonte em expressões Clojure.
 *
 * @param {string} source A string de código-fonte a ser analisada.
 * @return {Expression[]} Um array de expressões analisadas.
 */
export function parse(source: string): Expression[] {
    const tokens = tokenize(source);
    const expressions: Expression[] = [];
    while (tokens.length > 0) {
        expressions.push(parseExpr(tokens));
    }
    return expressions;
}

/**
 * Executa o código-fonte fornecido em um ambiente Clojure.
 *
 * @param {string} source O código-fonte a ser executado.
 * @param {RunOptions} [opts] Opções para execução, incluindo o ambiente.
 * @return {any} O resultado da última expressão avaliada.
 */
export function runSource(source: string, opts: RunOptions = {}): any {
    const env = opts.env || createGlobalEnv(opts);
    const expressions = parse(source);
    let lastResult = null;

    if (opts.timeoutMs) startTimeLimit(opts.timeoutMs);
    try {
        for (const expr of expressions) {
            lastResult = trampoline(evaluate(expr, env));
        }
    } finally {
        if (opts.timeoutMs) clearTimeLimit();
    }

    return lastResult;
}

/**
 * Compila o código-fonte fornecido para JavaScript.
 *
 * @param {string} source O código-fonte a ser compilado.
 * @param {CompileProgramOptions} [opts] Opções de emissão.
 * @return {string} O código JavaScript compilado.
 */
export function compileSource(
    source: string,
    opts: CompileProgramOptions = {},
): string {
    return compileProgram(parse(source), opts).code;
}

/**
 * Formata o resultado de uma avaliação para uma string legível.
 *
 * @param {any} result O resultado a ser formatado.
 * @return {string} O resultado formatado como string.
 */
export function formatResult(result: any): string {
    return prStr(result, true);
}

export {
    Env,
    evaluate,
    tokenize,
    trampoline,
    clearModuleCache,
    compileProgram,
    createSandboxPolicy,
    setInteropPolicy,
    DEFAULT_ALLOWED_GLOBALS,
    DEFAULT_RUNTIME_IMPORT,
    CURRENT_FILE,
    setPrintLimits,
    getPrintLimits,
    startTimeLimit,
    clearTimeLimit,
};
