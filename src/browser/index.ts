/**
 * Entrypoint de browser.
 *
 * Igual à API de Node, menos o que depende de sistema de arquivos: não há
 * `runFile`, `compileFile`, `slurp`, `spit`, `require` nem `load-file`. Tudo
 * o mais — interpretador, stdlib, macros e compilador — funciona.
 *
 * O host padrão (`NO_FILESYSTEM_HOST`) recusa IO com mensagem clara, então
 * um programa que tente `slurp` recebe um erro explicando o ambiente em vez
 * de um `undefined` misterioso.
 */
export * from "../core/Api.js";
export { getHost, setHost, NO_FILESYSTEM_HOST } from "../core/Host.js";
export type { Host } from "../core/Host.js";
