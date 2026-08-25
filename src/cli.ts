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

function startRepl() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "\x1b[33muser>\x1b[0m ",
        terminal: true,
    });

    loadHistory(rl);

    const replEnv = createGlobalEnv();

    let buffer = "";

    console.log("\x1b[36m%s\x1b[0m", `Mini-Clojure REPL v${readVersion()}`);
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

function handleFileExecution(filepath: string) {
    try {
        runFile(filepath);
    } catch (error: any) {
        console.error(error.message);
        process.exit(1);
    }
}

function handleCompilation(filepath: string, outFileOpt: string | null) {
    try {
        const outFile = outFileOpt ?? filepath.replace(/\.clj$/, "") + ".js";
        const outDir = path.dirname(outFile);
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        compileFile(filepath, { outFile });

        console.log(`\x1b[32m✔ Sucesso! Compilado para: ${outFile}\x1b[0m`);
        console.log(`Execute com: node ${outFile}`);
    } catch (error: any) {
        console.error("\x1b[31mErro de Compilação:\x1b[0m", error.message);
        process.exit(1);
    }
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
  mini-clj -f <arquivo.clj>      Idem (explícito)
  mini-clj -e "<código>"         Avalia o código e imprime o resultado
  mini-clj -t <arquivo.clj>      Transpila para JavaScript
  mini-clj --repl                Força o REPL

Opções:
  -e, --eval <código>    Avalia uma expressão e imprime o resultado
  -f, --file <arquivo>   Executa um arquivo .clj
  -t, --transpile        Transpila em vez de executar
  -o, --out <arquivo>    Arquivo de saída da transpilação (padrão: <entrada>.js)
      --repl             Inicia o REPL mesmo com outros argumentos
  -h, --help             Mostra esta ajuda
  -v, --version          Mostra a versão

Exemplos:
  mini-clj -e '(->> (range 10) (filter even?) (reduce + 0))'
  mini-clj -t src/app.clj -o build/app.js`);
}

interface CliOptions {
    evalCode: string | null;
    file: string | null;
    outFile: string | null;
    transpile: boolean;
    repl: boolean;
    help: boolean;
    version: boolean;
}

function parseArgs(argv: string[]): CliOptions {
    const opts: CliOptions = {
        evalCode: null,
        file: null,
        outFile: null,
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
                opts.outFile = requireValue(arg);
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

    return opts;
}

function handleEval(code: string) {
    const env = createGlobalEnv();
    env.set(CURRENT_FILE, path.join(process.cwd(), "--eval"));
    try {
        const result = runSource(code, { env });
        console.log(formatResult(result));
    } catch (error: any) {
        console.error(`\x1b[31m${error.message}\x1b[0m`);
        process.exit(1);
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

    if (opts.help) return printHelp();
    if (opts.version) return console.log(readVersion());

    if (opts.repl || (!opts.file && !opts.evalCode)) return startRepl();

    if (opts.evalCode !== null) return handleEval(opts.evalCode);

    const filepath = path.resolve(process.cwd(), opts.file!);
    if (opts.transpile) return handleCompilation(filepath, opts.outFile);
    return handleFileExecution(filepath);
}

main();
