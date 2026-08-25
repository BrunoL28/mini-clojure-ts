import * as fs from "fs";
import * as path from "path";
import { installNodeHost } from "./core/NodeHost.js";
import { compileProgram } from "./core/Compiler.js";
import { evaluateFile, CURRENT_FILE } from "./core/Modules.js";
import { createGlobalEnv, parse } from "./core/Api.js";
import type { RunOptions, CompileOptions } from "./core/Api.js";
import type { CompileProgramOptions } from "./core/Compiler.js";

// Este é o entrypoint de Node, então o host de arquivos entra aqui.
installNodeHost();

// Toda a API browser-safe vive em core/Api.ts e é reexportada daqui.
export * from "./core/Api.js";

/**
 * Executa o código-fonte de um arquivo em um ambiente Clojure.
 *
 * @param {string} filepath O caminho do arquivo a ser executado.
 * @param {RunOptions} [opts] Opções para execução, incluindo o ambiente.
 * @throws {Error} Se o arquivo não for encontrado.
 * @return {any} O resultado da última expressão avaliada.
 */
export function runFile(filepath: string, opts: RunOptions = {}): any {
    const absPath = path.resolve(process.cwd(), filepath);
    if (!fs.existsSync(absPath)) {
        throw new Error(`Arquivo não encontrado: ${absPath}`);
    }

    const env = opts.env || createGlobalEnv(opts);
    // Deixa `*file*` disponível para que `require`/`load-file` resolvam
    // caminhos relativos a partir deste arquivo.
    env.set(CURRENT_FILE, absPath);

    return evaluateFile(absPath, env);
}

/**
 * Compila o código-fonte de um arquivo para JavaScript.
 *
 * Quando `outFile` é informado, grava o `.js` — e também o `.js.map`, se
 * `sourceMap` estiver ligado.
 *
 * @param {string} filepath O caminho do arquivo a ser compilado.
 * @param {CompileOptions} [opts] Opções de compilação e saída.
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
    const outFile = opts.outFile;

    // O source map precisa dos caminhos relativos ao arquivo de saída.
    const programOpts: CompileProgramOptions = {
        ...opts,
        sourceFile:
            opts.sourceFile ??
            (outFile
                ? path.relative(path.dirname(outFile), filepath)
                : path.basename(filepath)),
        sourceContent: opts.sourceContent ?? source,
    };
    const outputFile = opts.outputFile ?? (outFile && path.basename(outFile));
    if (outputFile) programOpts.outputFile = outputFile;

    const result = compileProgram(parse(source), programOpts);

    if (outFile) {
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
        fs.writeFileSync(outFile, result.code);
        if (result.map !== null) {
            fs.writeFileSync(`${outFile}.map`, result.map);
        }
    }

    return result.code;
}
