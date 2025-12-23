import * as fs from "fs";
import * as path from "path";
import { Env } from "./core/Environment.js";
import { tokenize } from "./core/Tokenizer.js";
import { parse } from "./core/Parser.js";
import { evaluate } from "./core/Evaluator.js";
import { initialConfig } from "./stdlib/index.js";

const globalEnv = new Env();
Object.keys(initialConfig).forEach((key) => {
    globalEnv.set(key, initialConfig[key]);
});

function run(source: string) {
    const tokens = tokenize(source);
    while (tokens.length > 0) {
        try {
            const ast = parse(tokens);
            evaluate(ast, globalEnv);
        } catch (e: any) {
            console.error("Erro:", e.message);
            break;
        }
    }
}

const rawArgs = process.argv.slice(2);
const args = rawArgs.filter((arg) => arg !== "--" && !arg.startsWith("-"));

if (args.length > 0) {
    const filename = args[0];
    const filepath = path.resolve(process.cwd(), filename!);
    console.log(`> Executando: ${filename}`);

    try {
        if (!fs.existsSync(filepath))
            throw new Error(`Arquivo não encontrado: ${filepath}`);
        const fileContent = fs.readFileSync(filepath, "utf-8");
        run(fileContent);
    } catch (error: any) {
        console.error(error.message);
    }
} else {
    console.log("Mini-Clojure (Modular)");
    console.log("Uso: pnpm start -- arquivo.clj");
}
