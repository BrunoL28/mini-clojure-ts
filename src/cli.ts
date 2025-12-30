import * as path from "path";
import * as readline from "readline";
import {
    runFile,
    compileFile,
    createGlobalEnv,
    parse,
    evaluate,
    trampoline,
    formatResult,
} from "./index.js";

// --- Funções Auxiliares CLI ---

function startRepl() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const replEnv = createGlobalEnv();

    console.log("\x1b[36m%s\x1b[0m", "Mini-Clojure REPL v1.1");
    console.log("Digite 'exit' ou pressione Ctrl+C para sair.");
    console.log("-----------------------------------------");

    const prompt = () => {
        rl.question("\x1b[33muser>\x1b[0m ", (line) => {
            const input = line.trim();

            if (input === "exit") {
                rl.close();
                return;
            }

            if (input) {
                try {
                    const expressions = parse(input);
                    for (const ast of expressions) {
                        const result = trampoline(evaluate(ast, replEnv));
                        if (result !== null) {
                            console.log(
                                "\x1b[32m=> %s\x1b[0m",
                                formatResult(result),
                            );
                        } else {
                            console.log("\x1b[90mnil\x1b[0m");
                        }
                    }
                } catch (e: any) {
                    console.error("\x1b[31mErro: %s\x1b[0m", e.message);
                }
            }

            prompt();
        });
    };

    prompt();

    rl.on("close", () => {
        console.log("\nAté logo! 👋");
        process.exit(0);
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

// --- Entry Point Logic ---

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
