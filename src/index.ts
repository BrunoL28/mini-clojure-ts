import * as fs from "fs";
import { Env } from "./core/Environment.js";
import { tokenize } from "./core/Tokenizer.js";
import { parse as parseExpr } from "./core/Parser.js";
import { evaluate } from "./core/Evaluator.js";
import { initialConfig } from "./stdlib/index.js";
import { trampoline } from "./core/Trampoline.js";
import { transpile as transpileExpr } from "./core/Transpiler.js";
import {
    ClojureVector,
    ClojureKeyword,
    ClojureMap,
    ClojureMacro,
    type Expression,
} from "./types/index.js";
import { prStr } from "./core/Printer.js";

// ----- API Types ----- //

export interface RunOptions {
    env?: Env;
}

export interface CompileOptions {
    outFile?: string;
}

// ----- Public API ----- //

/**
 * Cria um novo ambiente global com a configuração inicial (stdlib).
 *
 * @return {Env} Um novo ambiente global configurado.
 */
export function createGlobalEnv(): Env {
    const env = new Env();
    Object.keys(initialConfig).forEach((key) => {
        env.set(key, initialConfig[key]);
    });
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
    const env = opts.env || createGlobalEnv();
    const expressions = parse(source);
    let lastResult = null;

    for (const expr of expressions) {
        lastResult = trampoline(evaluate(expr, env));
    }

    return lastResult;
}

/**
 * Executa o código-fonte de um arquivo em um ambiente Clojure.
 *
 * @param {string} filepath O caminho do arquivo a ser executado.
 * @param {RunOptions} [opts] Opções para execução, incluindo o ambiente.
 * @throws {Error} Se o arquivo não for encontrado.
 * @return {any} O resultado da última expressão avaliada.
 */
export function runFile(filepath: string, opts: RunOptions = {}): any {
    if (!fs.existsSync(filepath)) {
        throw new Error(`Arquivo não encontrado: ${filepath}`);
    }
    const source = fs.readFileSync(filepath, "utf-8");
    return runSource(source, opts);
}

/**
 * Compila o código-fonte fornecido para JavaScript.
 *
 * @param {string} source O código-fonte a ser compilado.
 * @return {string} O código JavaScript compilado.
 */
export function compileSource(source: string): string {
    const expressions = parse(source);
    const jsHeader = `// Compilado por Mini-Clojure-TS\n`;
    const jsBody = expressions.map(transpileExpr).join(";\n") + ";";
    return jsHeader + jsBody;
}

/**
 * Compila o código-fonte de um arquivo para JavaScript.
 *
 * @param {string} filepath O caminho do arquivo a ser compilado.
 * @param {CompileOptions} [opts] Opções para compilação, incluindo o arquivo de saída.
 * @throws {Error} Se o arquivo não for encontrado.
 * @return {string} O código JavaScript compilado.
 */
export function compileFile(
    filepath: string,
    opts: CompileOptions = {},
): string {
    if (!fs.existsSync(filepath)) {
        throw new Error(`Arquivo não encontrado: ${filepath}`);
    }
    const source = fs.readFileSync(filepath, "utf-8");
    const jsCode = compileSource(source);

    if (opts.outFile) {
        fs.writeFileSync(opts.outFile, jsCode);
    }

    return jsCode;
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

export { Env, evaluate, tokenize, trampoline };
