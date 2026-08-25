#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import * as os from "os";
import {
    runFile,
    runSource,
    compileFile,
    createGlobalEnv,
    parse,
    evaluate,
    trampoline,
    formatResult,
    tokenize,
    Env,
} from "./index.js";
import { prStr } from "./core/Printer.js";
import { CURRENT_FILE } from "./core/Modules.js";
import type { CompileTarget } from "./core/Compiler.js";
import { setPrintLimits } from "./core/Limits.js";
import { startTracing, stopTracing, printProfile } from "./core/Trace.js";

const HISTORY_FILE = path.join(os.homedir(), ".mini-clj-history");

// --- Auxiliares ---

function isBalanced(source: string): boolean {
    const tokens = tokenize(source);
    let openCount = 0;

    for (const token of tokens) {
        const char = typeof token === "string" ? token : (token as any).value;

        if (char === "(" || char === "[" || char === "{") {
            openCount++;
        } else if (char === ")" || char === "]" || char === "}") {
            openCount--;
        }
    }

    return openCount <= 0;
}

function loadHistory(rl: readline.Interface) {
    if (fs.existsSync(HISTORY_FILE)) {
        const content = fs.readFileSync(HISTORY_FILE, "utf-8");
        const lines = content.split("\n").filter((line) => line.trim());
        // Readline armazena o histórico em ordem reversa (0 é o mais recente)
        // Se a implementação interna do Node mudar, isso pode variar, mas o padrão é push.
        // O array rl.history é populado manualmente aqui.
        if ((rl as any).history instanceof Array) {
            (rl as any).history.push(...lines.reverse());
        }
    }
}

function appendHistory(line: string) {
    if (!line.trim()) return;
    try {
        fs.appendFileSync(HISTORY_FILE, line + "\n");
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
        // Ignora erro de disco para não travar o REPL
    }
}

// --- Comandos do REPL ---

function handleCommand(
    cmd: string,
    args: string,
    env: Env,
    rl: readline.Interface,
): boolean {
    switch (cmd) {
        case ":help":
            console.log("\nComandos disponíveis:");
            console.log(
                "  :load <arq>  Carrega e executa um arquivo .clj no ambiente atual",
            );
            console.log("  :quit, :exit Sair do REPL");
            console.log("  :help        Mostra esta mensagem\n");
            return true;

        case ":quit":
        case ":exit":
            rl.close();
            return true;

        case ":load": {
            const filepath = args.trim();
            if (!filepath) {
                console.log("\x1b[31mUso: :load <caminho-do-arquivo>\x1b[0m");
                return true;
            }
            const absPath = path.resolve(process.cwd(), filepath);
            console.log(`Carregando: ${absPath}...`);
            try {
                runFile(absPath, { env });
                console.log("\x1b[32mArquivo carregado com sucesso.\x1b[0m");
            } catch (e: any) {
                console.error(
                    `\x1b[31mErro ao carregar arquivo: ${e.message}\x1b[0m`,
                );
            }
            return true;
        }

        default:
            console.log(
                `\x1b[31mComando desconhecido: ${cmd}. Digite :help\x1b[0m`,
            );
            return true;
    }
}

// --- Loop Principal ---

function startRepl(opts: CliOptions) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "\x1b[33muser>\x1b[0m ",
        terminal: true,
    });

    loadHistory(rl);

    // O REPL é contexto de exibição: truncar por padrão evita que um
    // `(range 1000000)` sem querer inunde o terminal. Um `--print-length`
    // explícito continua valendo.
    if (opts.printLength === null) setPrintLimits({ length: 100 });

    const replEnv = createGlobalEnv(sandboxOptions(opts));

    let buffer = "";

    console.log("\x1b[36m%s\x1b[0m", `Mini-Clojure REPL v${readVersion()}`);
    if (opts.sandbox) {
        console.log(
            "\x1b[33mModo sandbox: interop restrito, sem IO e sem módulos.\x1b[0m",
        );
    }
    console.log("Digite :help para ver comandos.");
    console.log("-----------------------------------------");

    rl.prompt();

    rl.on("line", (line) => {
        const input = line;

        if (buffer.length === 0 && input.trim().startsWith(":")) {
            const parts = input.trim().split(" ");
            const cmd = parts[0]!;
            const args = parts.slice(1).join(" ");
            handleCommand(cmd, args, replEnv, rl);
            rl.prompt();
            return;
        }

        // Acumula no buffer
        buffer += input + "\n";

        // Verifica balanceamento
        if (isBalanced(buffer)) {
            // Executa
            const code = buffer.trim();

            if (code.length > 0) {
                appendHistory(code.replace(/\n/g, " "));

                try {
                    const expressions = parse(code);
                    for (const ast of expressions) {
                        const result = trampoline(evaluate(ast, replEnv));
                        if (result !== null) {
                            console.log(
                                "\x1b[32m=> %s\x1b[0m",
                                prStr(result, true),
                            );
                        } else {
                            console.log("\x1b[90mnil\x1b[0m");
                        }
                    }
                } catch (e: any) {
                    console.error("\x1b[31mErro: %s\x1b[0m", e.message);
                }
            }

            // Reseta buffer e prompt
            buffer = "";
            rl.setPrompt("\x1b[33muser>\x1b[0m ");
        } else {
            // Continua pedindo input
            rl.setPrompt("\x1b[90m...  \x1b[0m ");
        }

        rl.prompt();
    });

    rl.on("close", () => {
        console.log("\nAté logo! 👋");
        process.exit(0);
    });

    rl.on("SIGINT", () => {
        if (buffer.length > 0) {
            console.log("\n\x1b[90mInput cancelado.\x1b[0m");
            buffer = "";
            rl.setPrompt("\x1b[33muser>\x1b[0m ");
            rl.prompt();
        } else {
            rl.close();
        }
    });
}

function handleFileExecution(filepath: string, opts: CliOptions) {
    const rastreando = iniciarObservabilidade(opts);
    try {
        runFile(filepath, sandboxOptions(opts));
    } catch (error: any) {
        console.error(error.message);
        process.exit(1);
    } finally {
        if (rastreando) {
            printProfile();
            stopTracing();
        }
    }
}

/** Traduz as flags de sandbox da CLI para as opções da API. */
function sandboxOptions(opts: CliOptions) {
    const base: Record<string, unknown> = {};
    if (opts.timeoutMs > 0) base["timeoutMs"] = opts.timeoutMs;
    if (!opts.sandbox) return base;
    return {
        ...base,
        sandbox: true,
        sandboxOptions: opts.allow.length > 0 ? { extraAllow: opts.allow } : {},
    };
}

/**
 * Liga tracing/profiling se alguma das flags foi pedida.
 *
 * @return {boolean} `true` se o tracing foi ligado.
 */
function iniciarObservabilidade(opts: CliOptions): boolean {
    if (!opts.traceEval && !opts.traceMacroexpand && !opts.profile) {
        return false;
    }
    startTracing({
        evalForms: opts.traceEval,
        macroexpand: opts.traceMacroexpand,
        profile: opts.profile,
        ...(opts.traceDepth !== null ? { maxDepth: opts.traceDepth } : {}),
    });
    return true;
}

/** Aplica o limite de impressão pedido na linha de comando. */
function aplicarLimitesDeImpressao(opts: CliOptions) {
    if (opts.printLength !== null) {
        setPrintLimits({ length: opts.printLength });
    }
}

/** Caminho legível: relativo quando ajuda, absoluto quando o relativo piora. */
function displayPath(target: string): string {
    const rel = path.relative(process.cwd(), target);
    return rel.startsWith("..") ? target : rel;
}

/**
 * Compila uma vez. Devolve `true` em caso de sucesso — o watch usa isso para
 * decidir a mensagem, sem derrubar o processo em caso de erro.
 */
function compileOnce(
    filepath: string,
    opts: CliOptions,
    quiet = false,
): boolean {
    const outFile = resolveOutFile(filepath, opts);

    try {
        compileFile(filepath, {
            outFile,
            target: opts.target,
            sourceMap: opts.sourceMap,
            ...(opts.runtimeGlobal
                ? { runtimeGlobal: opts.runtimeGlobal }
                : {}),
        });

        const rel = displayPath(outFile);
        if (quiet) {
            console.log(
                `\x1b[32m✔\x1b[0m ${new Date().toLocaleTimeString()} — ${rel}`,
            );
        } else {
            console.log(`\x1b[32m✔ Sucesso! Compilado para: ${rel}\x1b[0m`);
            if (opts.sourceMap) console.log(`  Source map: ${rel}.map`);
            if (opts.target === "iife") {
                const globalName = opts.runtimeGlobal ?? "MiniClojureRuntime";
                console.log(
                    `  O bundle iife espera o runtime em globalThis.${globalName}`,
                );
            } else {
                console.log(`Execute com: node ${rel}`);
            }
        }
        return true;
    } catch (error: any) {
        if (quiet) {
            console.error(
                `\x1b[31m✘\x1b[0m ${new Date().toLocaleTimeString()} — ${error.message}`,
            );
        } else {
            console.error("\x1b[31mErro de Compilação:\x1b[0m", error.message);
        }
        return false;
    }
}

function handleCompilation(filepath: string, opts: CliOptions) {
    if (!compileOnce(filepath, opts)) process.exit(1);
}

/**
 * Recompila a cada mudança no arquivo.
 *
 * Observa o **diretório** em vez do arquivo: editores costumam salvar criando
 * um temporário e renomeando, o que faz um watch preso ao inode parar de
 * receber eventos. Um erro de compilação nunca derruba o watch.
 */
function handleWatch(filepath: string, opts: CliOptions) {
    const dir = path.dirname(filepath);
    const target = path.basename(filepath);

    console.log(
        `\x1b[36mObservando ${displayPath(filepath)}... (Ctrl+C para sair)\x1b[0m`,
    );

    // O watch é registrado ANTES da compilação inicial: no sentido contrário,
    // uma edição feita durante essa primeira compilação passaria despercebida.
    let timer: NodeJS.Timeout | null = null;
    fs.watch(dir, (_event, filename) => {
        if (filename !== target) return;
        // Debounce: um único save costuma disparar vários eventos.
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            if (!fs.existsSync(filepath)) return;
            compileOnce(filepath, opts, true);
        }, 100);
    });

    compileOnce(filepath, opts, true);
}

// --- Entry Point ---

function readVersion(): string {
    try {
        const pkgUrl = new URL("../package.json", import.meta.url);
        const pkg = JSON.parse(fs.readFileSync(pkgUrl, "utf-8"));
        return pkg.version ?? "0.0.0";
    } catch {
        return "0.0.0";
    }
}

function printHelp() {
    console.log(`Mini-Clojure-TS v${readVersion()}

Uso:
  mini-clj                       Inicia o REPL
  mini-clj <arquivo.clj>         Executa um arquivo
  mini-clj -e "<código>"         Avalia o código e imprime o resultado
  mini-clj -t <arquivo.clj>      Compila para JavaScript

Opções gerais:
  -e, --eval <código>    Avalia uma expressão e imprime o resultado
  -f, --file <arquivo>   Executa um arquivo .clj
      --repl             Inicia o REPL mesmo com outros argumentos
      --sandbox          Interop restrito: sem IO, sem módulos, whitelist de globais
      --allow <a,b>      Libera globais extras no sandbox (ex.: --allow Intl,URL)
      --timeout <ms>     Interrompe a execução depois de N ms (0 = sem limite)
      --print-length <n> Máximo de itens por coleção ao imprimir (nil = sem limite;
                         o REPL usa 100 por padrão)

Observabilidade (saída em stderr):
      --trace-eval       Imprime cada forma avaliada
      --trace-macroexpand  Imprime cada expansão de macro
      --trace-depth <n>  Profundidade máxima impressa no trace
      --profile          Conta formas e mede o tempo ao final
  -h, --help             Mostra esta ajuda
  -v, --version          Mostra a versão

Compilação (com -t):
  -t, --transpile        Compila em vez de executar
      --target <alvo>    esm (padrão) | cjs | iife
  -o, --out-file <arq>   Arquivo de saída
      --out-dir <dir>    Diretório de saída (nome derivado da entrada)
      --runtime-global <n> Global de onde o iife lê o runtime
                         (padrão: MiniClojureRuntime)
  -s, --source-map       Gera o .map e linka no arquivo compilado
  -w, --watch            Recompila a cada mudança no arquivo

Extensão padrão da saída: esm -> .mjs, cjs -> .cjs, iife -> .js
O target iife lê o runtime de globalThis.MiniClojureRuntime; esm e cjs o
importam de "mini-clojure-ts/runtime".

Exemplos:
  mini-clj -e '(->> (range 10) (filter even?) (reduce + 0))'
  mini-clj -t src/app.clj --out-dir build --source-map
  mini-clj -t src/app.clj --target cjs -w`);
}

interface CliOptions {
    evalCode: string | null;
    file: string | null;
    outFile: string | null;
    outDir: string | null;
    target: CompileTarget;
    runtimeGlobal: string | null;
    sourceMap: boolean;
    watch: boolean;
    sandbox: boolean;
    allow: string[];
    timeoutMs: number;
    printLength: number | null;
    traceEval: boolean;
    traceMacroexpand: boolean;
    profile: boolean;
    traceDepth: number | null;
    transpile: boolean;
    repl: boolean;
    help: boolean;
    version: boolean;
}

const TARGETS: CompileTarget[] = ["esm", "cjs", "iife"];

/** Extensão padrão por target, para o arquivo de saída não ficar ambíguo. */
const TARGET_EXTENSION: Record<CompileTarget, string> = {
    esm: ".mjs",
    cjs: ".cjs",
    iife: ".js",
};

function parseArgs(argv: string[]): CliOptions {
    const opts: CliOptions = {
        evalCode: null,
        file: null,
        outFile: null,
        outDir: null,
        target: "esm",
        runtimeGlobal: null,
        sourceMap: false,
        watch: false,
        sandbox: false,
        allow: [],
        timeoutMs: 0,
        printLength: null,
        traceEval: false,
        traceMacroexpand: false,
        profile: false,
        traceDepth: null,
        transpile: false,
        repl: false,
        help: false,
        version: false,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;

        const requireValue = (flag: string): string => {
            const value = argv[++i];
            if (value === undefined) {
                throw new Error(`A opção ${flag} requer um valor.`);
            }
            return value;
        };

        switch (arg) {
            case "-e":
            case "--eval":
                opts.evalCode = requireValue(arg);
                break;
            case "-f":
            case "--file":
                opts.file = requireValue(arg);
                break;
            case "-o":
            case "--out":
            case "--out-file":
                opts.outFile = requireValue(arg);
                break;
            case "--out-dir":
                opts.outDir = requireValue(arg);
                break;
            case "--target": {
                const value = requireValue(arg) as CompileTarget;
                if (!TARGETS.includes(value)) {
                    throw new Error(
                        `Target inválido: ${value}. Use ${TARGETS.join(", ")}.`,
                    );
                }
                opts.target = value;
                break;
            }
            case "--runtime-global":
                opts.runtimeGlobal = requireValue(arg);
                break;
            case "-s":
            case "--source-map":
                opts.sourceMap = true;
                break;
            case "-w":
            case "--watch":
                opts.watch = true;
                break;
            case "--timeout": {
                const valor = Number(requireValue(arg));
                if (!Number.isFinite(valor) || valor < 0) {
                    throw new Error("--timeout espera milissegundos (>= 0).");
                }
                opts.timeoutMs = valor;
                break;
            }
            case "--print-length": {
                const bruto = requireValue(arg);
                if (bruto === "nil" || bruto === "0") {
                    opts.printLength = null;
                    break;
                }
                const valor = Number(bruto);
                if (!Number.isInteger(valor) || valor < 1) {
                    throw new Error(
                        "--print-length espera um inteiro >= 1, ou 'nil'.",
                    );
                }
                opts.printLength = valor;
                break;
            }
            case "--trace-eval":
                opts.traceEval = true;
                break;
            case "--trace-macroexpand":
                opts.traceMacroexpand = true;
                break;
            case "--profile":
                opts.profile = true;
                break;
            case "--trace-depth": {
                const valor = Number(requireValue(arg));
                if (!Number.isInteger(valor) || valor < 0) {
                    throw new Error("--trace-depth espera um inteiro >= 0.");
                }
                opts.traceDepth = valor;
                break;
            }
            case "--sandbox":
                opts.sandbox = true;
                break;
            case "--allow":
                opts.allow.push(
                    ...requireValue(arg)
                        .split(",")
                        .map((n) => n.trim())
                        .filter(Boolean),
                );
                break;
            case "-t":
            case "--transpile":
                opts.transpile = true;
                break;
            case "--repl":
                opts.repl = true;
                break;
            case "-h":
            case "--help":
                opts.help = true;
                break;
            case "-v":
            case "--version":
                opts.version = true;
                break;
            case "--":
                // `pnpm start -- app.clj` repassa o `--` literalmente.
                // Tratamos como ruído do npm/pnpm, não como opção.
                break;
            default:
                if (arg.startsWith("-")) {
                    throw new Error(
                        `Opção desconhecida: ${arg}. Use --help para ver as opções.`,
                    );
                }
                // Primeiro argumento posicional é o arquivo.
                if (opts.file === null) opts.file = arg;
                break;
        }
    }

    if (opts.outFile && opts.outDir) {
        throw new Error("Use --out-file OU --out-dir, não os dois.");
    }

    return opts;
}

/** Decide o caminho de saída a partir das opções e do target. */
function resolveOutFile(filepath: string, opts: CliOptions): string {
    if (opts.outFile) return path.resolve(process.cwd(), opts.outFile);

    const base =
        path.basename(filepath, path.extname(filepath)) +
        TARGET_EXTENSION[opts.target];

    const dir = opts.outDir
        ? path.resolve(process.cwd(), opts.outDir)
        : path.dirname(filepath);

    return path.join(dir, base);
}

function handleEval(code: string, opts: CliOptions) {
    const env = createGlobalEnv(sandboxOptions(opts));
    env.set(CURRENT_FILE, path.join(process.cwd(), "--eval"));
    const rastreando = iniciarObservabilidade(opts);
    try {
        const result = runSource(code, { ...sandboxOptions(opts), env });
        console.log(formatResult(result));
    } catch (error: any) {
        console.error(`\x1b[31m${error.message}\x1b[0m`);
        process.exit(1);
    } finally {
        if (rastreando) {
            printProfile();
            stopTracing();
        }
    }
}

function main() {
    let opts: CliOptions;
    try {
        opts = parseArgs(process.argv.slice(2));
    } catch (error: any) {
        console.error(`\x1b[31m${error.message}\x1b[0m`);
        process.exit(1);
    }

    aplicarLimitesDeImpressao(opts);

    if (opts.help) return printHelp();
    if (opts.version) return console.log(readVersion());

    if (opts.repl || (!opts.file && !opts.evalCode)) return startRepl(opts);

    if (opts.evalCode !== null) return handleEval(opts.evalCode, opts);

    const filepath = path.resolve(process.cwd(), opts.file!);
    if (opts.transpile) {
        if (opts.watch) return handleWatch(filepath, opts);
        return handleCompilation(filepath, opts);
    }
    return handleFileExecution(filepath, opts);
}

main();
