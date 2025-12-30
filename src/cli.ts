import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import * as os from "os";
import {
    runFile,
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

    console.log("\x1b[36m%s\x1b[0m", "Mini-Clojure REPL v1.2");
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

function handleCompilation(filepath: string) {
    try {
        const outFile = filepath.replace(".clj", ".js");
        compileFile(filepath, { outFile });

        console.log(`\x1b[32m✔ Sucesso! Compilado para: ${outFile}\x1b[0m`);
        console.log(`Execute com: node ${outFile}`);
    } catch (error: any) {
        console.error("\x1b[31mErro de Compilação:\x1b[0m", error.message);
        process.exit(1);
    }
}

// --- Entry Point ---

const rawArgs = process.argv.slice(2);
const isCompile = rawArgs.includes("-t") || rawArgs.includes("--transpile");
const fileArgs = rawArgs.filter(
    (arg) => arg !== "-t" && arg !== "--transpile" && !arg.startsWith("-"),
);

if (fileArgs.length > 0) {
    const filename = fileArgs[0];
    const filepath = path.resolve(process.cwd(), filename!);

    if (isCompile) {
        handleCompilation(filepath);
    } else {
        handleFileExecution(filepath);
    }
} else {
    startRepl();
}
