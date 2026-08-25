import {
    ClojureVector,
    ClojureKeyword,
    ClojureSymbol,
    ClojureMap,
} from "../types/index.js";
import type { Expression } from "../types/index.js";
import { Env } from "./Environment.js";
import { evaluate, macroexpand1 } from "./Evaluator.js";
import { trampoline } from "./Trampoline.js";
import { initialConfig } from "../stdlib/index.js";
import { ClojureError } from "../errors/ClojureError.js";
import { InvalidParamError } from "../errors/InvalidParamError.js";

/** Identificador do namespace do runtime dentro do código gerado. */
const RT = "$rt";

/** Especificador de import padrão do runtime. */
export const DEFAULT_RUNTIME_IMPORT = "mini-clojure-ts/runtime";

export interface CompileProgramOptions {
    /** De onde importar o runtime. Ignorado quando `emitImport` é `false`. */
    runtimeImport?: string;
    /**
     * Quando `false`, omite a linha de import e o código gerado assume que
     * `$rt` já existe no escopo. Usado pelos testes, que injetam o runtime
     * diretamente em vez de resolver um módulo.
     */
    emitImport?: boolean;
}

/** Palavras reservadas do JavaScript, que não podem virar identificadores. */
const RESERVED_WORDS = new Set([
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "enum",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "function",
    "if",
    "implements",
    "import",
    "in",
    "instanceof",
    "interface",
    "let",
    "new",
    "null",
    "package",
    "private",
    "protected",
    "public",
    "return",
    "static",
    "super",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "with",
    "yield",
    "arguments",
    "eval",
]);

/**
 * Converte um nome do Mini-Clojure em um identificador JavaScript válido.
 *
 * Só se aplica a **identificadores**. Aplicar isso a um literal de string
 * corrompe o literal — foi o que gerou a issue #38.
 *
 * @param {string} name O nome a converter.
 * @return {string} Um identificador JavaScript válido.
 */
function mangle(name: string): string {
    let out = name
        .replace(/-/g, "_")
        .replace(/\?/g, "$q")
        .replace(/!/g, "$b")
        .replace(/\*/g, "$s")
        .replace(/</g, "$lt")
        .replace(/>/g, "$gt")
        .replace(/=/g, "$eq")
        .replace(/\+/g, "$plus")
        .replace(/\//g, "$div")
        .replace(/%/g, "$pct")
        .replace(/\./g, "$dot")
        .replace(/&/g, "$amp")
        .replace(/:/g, "$colon");

    // Rede de segurança: qualquer caractere que ainda não sirva num
    // identificador JS vira `$`.
    out = out.replace(/[^A-Za-z0-9_$]/g, "$");

    // `throw`, `new`, `class`... sao nomes validos no Mini-Clojure e
    // reservados no JavaScript. O prefixo resolve sem inventar apelidos.
    if (out.length === 0 || /^[0-9]/.test(out) || RESERVED_WORDS.has(out)) {
        out = "$" + out;
    }
    return out;
}

/** Nome da operação na cabeça de uma lista, se houver. */
function headName(form: any): string | null {
    if (!Array.isArray(form) || form.length === 0) return null;
    const head = form[0];
    if (head instanceof ClojureSymbol) return head.value;
    return null;
}

function isList(form: any): boolean {
    return Array.isArray(form) && !(form instanceof ClojureVector);
}

function symbolName(node: any): string | null {
    if (node instanceof ClojureSymbol) return node.value;
    return null;
}

class Compiler {
    /** Env de compile-time: guarda as macros definidas no arquivo. */
    private macroEnv: Env;
    /** Nomes de `def` do programa — declarados de uma vez no preâmbulo. */
    private globals = new Set<string>();
    /** Nomes da stdlib efetivamente usados, ligados no preâmbulo. */
    private usedCore = new Set<string>();
    /** Pilha de escopos léxicos (parâmetros de `fn` e bindings de `let`). */
    private scopes: Set<string>[] = [];
    private gensymCounter = 0;

    constructor() {
        this.macroEnv = new Env();
        for (const key of Object.keys(initialConfig)) {
            this.macroEnv.set(key, initialConfig[key]);
        }
    }

    private gensym(prefix: string): string {
        return `$${prefix}${this.gensymCounter++}`;
    }

    private inScope(name: string): boolean {
        return this.scopes.some((scope) => scope.has(name));
    }

    private declareLocal(name: string) {
        const current = this.scopes[this.scopes.length - 1];
        if (current) current.add(name);
    }

    // ======================================================
    // Fase 1 — macroexpansão (R5/E3, issue #21)
    // ======================================================

    /**
     * Expande macros recursivamente, de fora para dentro.
     *
     * `quote` interrompe a descida: seu conteúdo é dado, não código.
     */
    private macroexpandAll(form: any): any {
        let current = form;
        let expanded = macroexpand1(current, this.macroEnv);
        while (expanded !== current) {
            current = expanded;
            expanded = macroexpand1(current, this.macroEnv);
        }

        if (headName(current) === "quote") return current;

        if (current instanceof ClojureVector) {
            const items = current.map((item) => this.macroexpandAll(item));
            return ClojureVector.of(...items);
        }

        if (Array.isArray(current)) {
            const items = current.map((item) => this.macroexpandAll(item));
            (items as any).loc = (current as any).loc;
            return items;
        }

        if (current instanceof ClojureMap) {
            let result = new ClojureMap();
            for (const [k, v] of current) {
                result = result.assoc(
                    this.macroexpandAll(k),
                    this.macroexpandAll(v),
                );
            }
            return result;
        }

        return current;
    }

    /**
     * Coleta todos os nomes de `def`/`defn` do programa ANTES do codegen.
     *
     * Sem isso, o preâmbulo poderia emitir `const println = ...` (stdlib) e
     * `let println` (um def do usuário), o que é SyntaxError — e um `def` que
     * sombreia a stdlib só passaria a valer da linha dele em diante.
     */
    private collectGlobals(form: any) {
        if (!Array.isArray(form)) return;
        if (headName(form) === "quote") return;

        const op = headName(form);
        if (op === "def" || op === "defn") {
            const name = symbolName((form as any[])[1]);
            if (name !== null) this.globals.add(name);
        }

        for (const child of form) this.collectGlobals(child);
    }

    /** Registra uma `defmacro` no env de compile-time. */
    private registerMacro(form: any[]) {
        trampoline(evaluate(form as Expression, this.macroEnv));
    }

    // ======================================================
    // Fase 2 — desaçúcar para as formas do núcleo
    // ======================================================

    /**
     * Reescreve formas derivadas em `if`/`do`/`fn`, para o codegen lidar com
     * um núcleo pequeno. Espelha o que o interpretador faz nas formas especiais.
     */
    private desugar(form: any): any {
        const op = headName(form);
        if (op === null) return form;

        const args = (form as any[]).slice(1);
        const sym = (name: string) => new ClojureSymbol(name);
        const withLoc = (list: any[]) => {
            (list as any).loc = (form as any).loc;
            return list;
        };

        switch (op) {
            case "defn": {
                const [name, params, ...body] = args;
                const fnBody =
                    body.length === 1 ? body[0] : [sym("do"), ...body];
                return withLoc([sym("def"), name, [sym("fn"), params, fnBody]]);
            }

            case "when": {
                const [test, ...body] = args;
                return withLoc([
                    sym("if"),
                    test,
                    body.length === 1 ? body[0] : [sym("do"), ...body],
                ]);
            }

            case "when-not": {
                const [test, ...body] = args;
                return withLoc([
                    sym("if"),
                    test,
                    null,
                    body.length === 1 ? body[0] : [sym("do"), ...body],
                ]);
            }

            case "cond": {
                if (args.length % 2 !== 0) {
                    throw new InvalidParamError(
                        "cond requer um número par de formas (teste expressão)",
                    );
                }
                let result: any = null;
                for (let i = args.length - 2; i >= 0; i -= 2) {
                    result = [sym("if"), args[i], args[i + 1], result];
                }
                return result === null ? null : withLoc(result);
            }

            case "->":
            case "->>": {
                if (args.length === 0) {
                    throw new InvalidParamError(
                        `${op} requer ao menos o valor inicial`,
                    );
                }
                const threadLast = op === "->>";
                let acc: any = args[0];
                for (let i = 1; i < args.length; i++) {
                    const step = args[i];
                    if (isList(step) && step.length > 0) {
                        const [head, ...rest] = step as any[];
                        acc = threadLast
                            ? [head, ...rest, acc]
                            : [head, acc, ...rest];
                    } else {
                        acc = [step, acc];
                    }
                }
                return acc;
            }

            default:
                return form;
        }
    }

    // ======================================================
    // Fase 3 — geração de código
    // ======================================================

    /** Serializa uma forma como dado (para `quote`). */
    private emitQuoted(form: any): string {
        if (form === null || form === undefined) return "null";
        if (typeof form === "number") return form.toString();
        if (typeof form === "boolean") return String(form);
        if (typeof form === "string") return JSON.stringify(form);
        if (form instanceof ClojureSymbol) {
            return `${RT}.sym(${JSON.stringify(form.value)})`;
        }
        if (form instanceof ClojureKeyword) {
            return `${RT}.kw(${JSON.stringify(form.value)})`;
        }
        if (form instanceof ClojureVector) {
            const items = form.map((i) => this.emitQuoted(i)).join(", ");
            return `${RT}.vec([${items}])`;
        }
        if (form instanceof ClojureMap) {
            const pairs: string[] = [];
            for (const [k, v] of form) {
                pairs.push(this.emitQuoted(k), this.emitQuoted(v));
            }
            return `${RT}.map([${pairs.join(", ")}])`;
        }
        if (Array.isArray(form)) {
            const items = form.map((i) => this.emitQuoted(i)).join(", ");
            return `${RT}.list([${items}])`;
        }
        return "null";
    }

    /** Igual a `emitQuoted`, mas `(unquote x)` volta a ser código. */
    private emitQuasi(form: any): string {
        if (headName(form) === "unquote") {
            return this.emit((form as any[])[1]);
        }

        if (form instanceof ClojureVector) {
            const items = form.map((i) => this.emitQuasi(i)).join(", ");
            return `${RT}.vec([${items}])`;
        }
        if (form instanceof ClojureMap) {
            const pairs: string[] = [];
            for (const [k, v] of form) {
                pairs.push(this.emitQuasi(k), this.emitQuasi(v));
            }
            return `${RT}.map([${pairs.join(", ")}])`;
        }
        if (Array.isArray(form)) {
            const items = form.map((i) => this.emitQuasi(i)).join(", ");
            return `${RT}.list([${items}])`;
        }
        return this.emitQuoted(form);
    }

    /**
     * Gera as declarações de um binding, cobrindo destructuring de sequência
     * (com `&`) e de mapa (`:keys`, `:as`, `:or`, renomeação).
     */
    private emitBindings(shape: any, valueExpr: string): string[] {
        const name = symbolName(shape);
        if (name !== null) {
            this.declareLocal(name);
            return [`const ${mangle(name)} = ${valueExpr};`];
        }

        if (Array.isArray(shape)) {
            const tmp = this.gensym("d");
            const out = [`const ${tmp} = ${valueExpr};`];

            for (let i = 0; i < shape.length; i++) {
                const part = shape[i];
                if (symbolName(part) === "&") {
                    const restShape = shape[i + 1];
                    if (restShape === undefined) {
                        throw new InvalidParamError("Esperado símbolo após &");
                    }
                    out.push(
                        ...this.emitBindings(
                            restShape,
                            `${RT}.restFrom(${tmp}, ${i})`,
                        ),
                    );
                    break;
                }
                out.push(
                    ...this.emitBindings(part, `${RT}.nth_(${tmp}, ${i})`),
                );
            }
            return out;
        }

        if (shape instanceof ClojureMap) {
            const tmp = this.gensym("d");
            const out = [`const ${tmp} = ${valueExpr};`];

            let defaults: ClojureMap | null = null;
            for (const [k, v] of shape) {
                if (k instanceof ClojureKeyword && k.value === ":or") {
                    defaults = v as ClojureMap;
                }
            }

            const defaultFor = (target: any): string => {
                if (!defaults) return "null";
                for (const [dk, dv] of defaults) {
                    if (
                        dk instanceof ClojureSymbol &&
                        dk.value === symbolName(target)
                    ) {
                        return this.emit(dv);
                    }
                }
                return "null";
            };

            for (const [target, source] of shape) {
                if (target instanceof ClojureKeyword) {
                    if (target.value === ":or") continue;
                    if (target.value === ":as") {
                        out.push(...this.emitBindings(source, tmp));
                        continue;
                    }
                    if (target.value === ":keys") {
                        for (const keySym of source as any[]) {
                            const keyName = symbolName(keySym);
                            if (keyName === null) continue;
                            this.declareLocal(keyName);
                            out.push(
                                `const ${mangle(keyName)} = ${RT}.getKw(${tmp}, ${JSON.stringify(":" + keyName)}, ${defaultFor(keySym)});`,
                            );
                        }
                        continue;
                    }
                }

                // Renomeação: {v :chave}
                out.push(
                    ...this.emitBindings(
                        target,
                        `${RT}.getKey(${tmp}, ${this.emit(source)}, ${defaultFor(target)})`,
                    ),
                );
            }
            return out;
        }

        throw new InvalidParamError(
            `Forma de binding não suportada pelo compilador: ${String(shape)}`,
        );
    }

    /** Gera o corpo de uma `fn`. */
    private emitFn(params: any, bodyForms: any[]): string {
        if (!(params instanceof ClojureVector)) {
            throw new InvalidParamError(
                "Os parâmetros de 'fn' devem ser um vetor.",
            );
        }

        this.scopes.push(new Set());
        try {
            const simple = params.every(
                (p) => symbolName(p) !== null && symbolName(p) !== "&",
            );

            if (simple) {
                // Parâmetros entram no escopo ANTES de gerar o corpo.
                const names = params.map((p) => {
                    const name = symbolName(p)!;
                    this.declareLocal(name);
                    return mangle(name);
                });
                return `((${names.join(", ")}) => ${this.emitBody(bodyForms)})`;
            }

            // Destructuring ou `&`: recebe tudo em rest args e desmonta.
            const argsName = this.gensym("args");
            const bindings = this.emitBindings(params, argsName);
            return `((...${argsName}) => { ${bindings.join(" ")} return ${this.emitBody(bodyForms)}; })`;
        } finally {
            this.scopes.pop();
        }
    }

    /** Sequência de expressões: avalia todas, devolve a última. */
    private emitBody(forms: any[]): string {
        if (forms.length === 0) return "null";
        if (forms.length === 1) return this.emit(forms[0]);
        const statements = forms
            .slice(0, -1)
            .map((f) => `${this.emit(f)};`)
            .join(" ");
        return `(() => { ${statements} return ${this.emit(forms[forms.length - 1])}; })()`;
    }

    /** Resolve um símbolo para um identificador JavaScript. */
    private emitSymbol(node: ClojureSymbol): string {
        const name = node.value;

        if (name.startsWith("js/")) return name.slice(3);

        if (this.inScope(name) || this.globals.has(name)) {
            return mangle(name);
        }

        if (Object.prototype.hasOwnProperty.call(initialConfig, name)) {
            this.usedCore.add(name);
            return mangle(name);
        }

        // Pode ser uma referência adiante; o JS resolve (ou falha) em runtime.
        return mangle(name);
    }

    /** Gera o JavaScript de uma forma qualquer. */
    private emit(form: any): string {
        if (form === null || form === undefined) return "null";
        if (typeof form === "number") return form.toString();
        if (typeof form === "boolean") return String(form);

        // Uma `string` crua no AST é SEMPRE um literal (ver #38).
        if (typeof form === "string") return JSON.stringify(form);

        if (form instanceof ClojureSymbol) return this.emitSymbol(form);

        if (form instanceof ClojureKeyword) {
            return `${RT}.kw(${JSON.stringify(form.value)})`;
        }

        if (form instanceof ClojureVector) {
            const items = form.map((i) => this.emit(i)).join(", ");
            return `${RT}.vec([${items}])`;
        }

        if (form instanceof ClojureMap) {
            const pairs: string[] = [];
            for (const [k, v] of form) {
                pairs.push(this.emit(k), this.emit(v));
            }
            return `${RT}.map([${pairs.join(", ")}])`;
        }

        if (!Array.isArray(form)) return "null";
        if (form.length === 0) return "null";

        const desugared = this.desugar(form);
        if (desugared !== form) return this.emit(desugared);

        const op = headName(form);
        const args = form.slice(1);

        switch (op) {
            case "def": {
                const name = symbolName(args[0]);
                if (name === null) {
                    throw new InvalidParamError(
                        "Nome de variável inválido no def",
                    );
                }
                this.globals.add(name);
                const value = args.length > 1 ? this.emit(args[1]) : "null";
                return `(${mangle(name)} = ${value})`;
            }

            case "if": {
                const [test, thenExpr, elseExpr] = args;
                const elseStr =
                    elseExpr === undefined ? "null" : this.emit(elseExpr);
                return `(${RT}.truthy(${this.emit(test)}) ? ${this.emit(thenExpr)} : ${elseStr})`;
            }

            case "do":
                return this.emitBody(args);

            case "fn":
                return this.emitFn(args[0], args.slice(1));

            case "let": {
                const [bindings, ...body] = args;
                if (!Array.isArray(bindings) || bindings.length % 2 !== 0) {
                    throw new InvalidParamError(
                        "let requer número par de itens no vetor de bindings",
                    );
                }
                this.scopes.push(new Set());
                try {
                    const decls: string[] = [];
                    for (let i = 0; i < bindings.length; i += 2) {
                        decls.push(
                            ...this.emitBindings(
                                bindings[i],
                                this.emit(bindings[i + 1]),
                            ),
                        );
                    }
                    const rendered =
                        body.length === 0 ? "null" : this.emitBody(body);
                    return `(() => { ${decls.join(" ")} return ${rendered}; })()`;
                } finally {
                    this.scopes.pop();
                }
            }

            case "try": {
                const bodyForms: any[] = [];
                let catchClause: any[] | null = null;
                for (const arg of args) {
                    if (headName(arg) === "catch") catchClause = arg as any[];
                    else bodyForms.push(arg);
                }

                const tryBody =
                    bodyForms.length === 0 ? "null" : this.emitBody(bodyForms);

                if (!catchClause) {
                    return `(() => { return ${tryBody}; })()`;
                }

                const errName = symbolName(catchClause[1]);
                if (errName === null) {
                    throw new InvalidParamError(
                        "Nome da variável de erro inválido no catch",
                    );
                }

                const raw = this.gensym("e");
                this.scopes.push(new Set([errName]));
                try {
                    const handler = this.emitBody(catchClause.slice(2));
                    return `(() => { try { return ${tryBody}; } catch (${raw}) { const ${mangle(errName)} = ${RT}.errMsg(${raw}); return ${handler}; } })()`;
                } finally {
                    this.scopes.pop();
                }
            }

            case "and": {
                if (args.length === 0) return "true";
                return args.slice(0, -1).reduceRight(
                    (acc: string, arg: any) => {
                        const t = this.gensym("t");
                        return `(() => { const ${t} = ${this.emit(arg)}; return ${RT}.truthy(${t}) ? ${acc} : ${t}; })()`;
                    },
                    this.emit(args[args.length - 1]),
                );
            }

            case "or": {
                if (args.length === 0) return "null";
                return args.slice(0, -1).reduceRight(
                    (acc: string, arg: any) => {
                        const t = this.gensym("t");
                        return `(() => { const ${t} = ${this.emit(arg)}; return ${RT}.truthy(${t}) ? ${t} : ${acc}; })()`;
                    },
                    this.emit(args[args.length - 1]),
                );
            }

            case "quote":
                return this.emitQuoted(args[0]);

            case "quasiquote":
                return this.emitQuasi(args[0]);

            case "defmacro":
                // Já registrada na fase de macroexpansão; não gera código.
                return "null";

            case "time": {
                const t = this.gensym("t");
                const v = this.gensym("v");
                return `(() => { const ${t} = performance.now(); const ${v} = ${this.emit(args[0])}; console.log(\`Elapsed time: \${(performance.now() - ${t}).toFixed(4)} msecs\`); return ${v}; })()`;
            }

            case "require":
            case "load-file":
            case "macroexpand":
            case "macroexpand-1":
                throw new ClojureError(
                    `'${op}' não é suportado no código compilado (ver docs/compiler.md)`,
                    (form as any).loc,
                );
        }

        // Chamada comum.
        const callee = form[0];
        const argList = args.map((a: any) => this.emit(a)).join(", ");

        // Keyword na posição de função: (:chave mapa)
        if (callee instanceof ClojureKeyword) {
            return `${RT}.call(${this.emit(callee)}, ${argList})`;
        }

        return `${this.emit(callee)}(${argList})`;
    }

    // ======================================================
    // Orquestração
    // ======================================================

    /** Compila uma forma isolada, sem preâmbulo. */
    compileForm(form: Expression): string {
        return this.emit(this.macroexpandAll(form));
    }

    compile(forms: Expression[], opts: CompileProgramOptions = {}): string {
        // Fase 1: registrar macros e expandir tudo.
        const expanded: any[] = [];
        for (const form of forms) {
            if (headName(form) === "defmacro") {
                this.registerMacro(form as any[]);
                continue;
            }
            expanded.push(this.macroexpandAll(form));
        }

        // Fase 2: descobrir os `def` antes de gerar código.
        for (const form of expanded) this.collectGlobals(form);

        // Fase 3: gerar o corpo (popula usedCore).
        const body = expanded.map((form) => `${this.emit(form)};`);

        // Preâmbulo, montado depois porque depende do que o corpo usou.
        const prelude: string[] = [];
        if (opts.emitImport !== false) {
            const spec = opts.runtimeImport ?? DEFAULT_RUNTIME_IMPORT;
            prelude.push(`import * as ${RT} from ${JSON.stringify(spec)};`, "");
        }

        // Um `def` do usuário sombreia a stdlib: o nome é declarado uma vez só.
        const coreNames = [...this.usedCore]
            .filter((name) => !this.globals.has(name))
            .sort();
        if (coreNames.length > 0) {
            prelude.push("// Funções da stdlib usadas por este módulo.");
            for (const name of coreNames) {
                prelude.push(
                    `const ${mangle(name)} = ${RT}.core[${JSON.stringify(name)}];`,
                );
            }
            prelude.push("");
        }

        const globalNames = [...this.globals].map(mangle);
        if (globalNames.length > 0) {
            prelude.push(`let ${globalNames.join(", ")};`, "");
        }

        return [...prelude, ...body].join("\n") + "\n";
    }
}

/**
 * Compila um programa inteiro para JavaScript.
 *
 * Pipeline: parse (já feito) → macroexpand → desugar → codegen.
 *
 * @param {Expression[]} forms As formas de nível superior já parseadas.
 * @param {CompileProgramOptions} [opts] Opções de emissão.
 * @return {string} O módulo JavaScript gerado.
 */
export function compileProgram(
    forms: Expression[],
    opts: CompileProgramOptions = {},
): string {
    return new Compiler().compile(forms, opts);
}

/**
 * Compila uma única forma. Atalho para testes e inspeção.
 *
 * @param {Expression} form A forma a compilar.
 * @return {string} A expressão JavaScript correspondente, sem preâmbulo.
 */
export function transpile(form: Expression): string {
    return new Compiler().compileForm(form);
}
