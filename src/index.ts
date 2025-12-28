import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { Env } from "./core/Environment.js";
import { tokenize } from "./core/Tokenizer.js";
import { parse } from "./core/Parser.js";
import { evaluate } from "./core/Evaluator.js";
import { initialConfig } from "./stdlib/index.js";
import { trampoline } from "./core/Trampoline.js";
import {
    ClojureVector,
    ClojureKeyword,
    ClojureMap,
    ClojureMacro,
    ClojureSymbol,
} from "./types/index.js";
import { transpile } from "./core/Transpiler.js";
import { ClojureError } from "./errors/ClojureError.js";

const globalEnv = new Env();
Object.keys(initialConfig).forEach((key) => {
    globalEnv.set(key, initialConfig[key]);
});

function printError(e: any, source?: string) {
    if (e instanceof ClojureError) {
        console.error(`\x1b[31mErro: ${e.message}\x1b[0m`);

        if (e.loc) {
            const { file, start } = e.loc;
            console.error(`   at ${file}:${start.line}:${start.col}`);

            if (source) {
                const lines = source.split("\n");
                const lineIndex = start.line - 1;
                if (lineIndex > 0) {
                    console.error(
                        `\x1b[90m${(start.line - 1).toString().padStart(4)} | ${lines[lineIndex - 1]}\x1b[0m`,
                    );
                }
                console.error(
                    `\x1b[37m${start.line.toString().padStart(4)} | ${lines[lineIndex]}\x1b[0m`,
                );
                const padding = " ".repeat(6 + start.col);
                console.error(`\x1b[31m${padding}^\x1b[0m`);
            }
        }
    } else {
        console.error("Erro Inesperado:", e);
    }
}

function run(source: string, filename: string) {
    try {
        const tokens = tokenize(source, filename);
        const tokensCopy = [...tokens];
        while (tokensCopy.length > 0) {
            const ast = parse(tokensCopy);
            trampoline(evaluate(ast, globalEnv));
        }
    } catch (e: any) {
        printError(e, source);
    }
}

function startRepl() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    console.log("\x1b[36m%s\x1b[0m", "Mini-Clojure REPL v1.0");
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
                    const tokens = tokenize(input, "repl");

                    while (tokens.length > 0) {
                        const ast = parse(tokens);
                        const result = trampoline(evaluate(ast, globalEnv));
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
                    printError(e, input);
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

function formatResult(result: any): string {
    if (result instanceof ClojureVector) {
        return `[${result.map(formatResult).join(" ")}]`;
    }

    if (result instanceof ClojureMap) {
        const entries = [];
        for (const [k, v] of result) {
            entries.push(`${formatResult(k)} ${formatResult(v)}`);
        }
        return `{${entries.join(" ")}}`;
    }

    if (result instanceof ClojureKeyword) {
        return result.value;
    }

    if (result instanceof ClojureSymbol) {
        return result.value;
    }

    if (result instanceof ClojureMacro) {
        return `#<Macro params:[${result.params}]>`;
    }

    if (Array.isArray(result)) {
        return `(${result.map(formatResult).join(" ")})`;
    }

    if (typeof result === "string") {
        return `"${result}"`;
    }

    if (result && typeof result === "object" && "params" in result) {
        return `#<Function params:[${result.params}]>`;
    }

    return String(result);
}

function compileFile(filepath: string) {
    try {
        if (!fs.existsSync(filepath))
            throw new Error(`Arquivo não encontrado: ${filepath}`);

        const source = fs.readFileSync(filepath, "utf-8");
        const tokens = tokenize(source, filepath);

        const expressions = [];
        while (tokens.length > 0) {
            expressions.push(parse(tokens));
        }

        const jsHeader = `// Compilado por Mini-Clojure-TS\n`;
        const jsCode = expressions.map(transpile).join(";\n") + ";";

        const outFile = filepath.replace(".clj", ".js");
        fs.writeFileSync(outFile, jsHeader + jsCode);

        console.log(`\x1b[32m✔ Sucesso! Compilado para: ${outFile}\x1b[0m`);
        console.log(`Execute com: node ${outFile}`);
    } catch (error: any) {
        printError(error, fs.readFileSync(filepath, "utf-8"));
    }
}

const rawArgs = process.argv.slice(2);
const isCompile = rawArgs.includes("-t") || rawArgs.includes("--transpile");
const fileArgs = rawArgs.filter(
    (arg) => arg !== "-t" && arg !== "--transpile" && !arg.startsWith("-"),
);

if (fileArgs.length > 0) {
    const filename = fileArgs[0];
    const filepath = path.resolve(process.cwd(), filename!);

    if (isCompile) {
        compileFile(filepath);
    } else {
        if (fs.existsSync(filepath)) {
            const fileContent = fs.readFileSync(filepath, "utf-8");
            run(fileContent, filename!);
        } else {
            console.error("Arquivo não encontrado.");
        }
    }
} else {
    startRepl();
}
