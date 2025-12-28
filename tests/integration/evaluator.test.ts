import { describe, it } from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as path from "path";
import { Env } from "../../src/core/Environment.js";
import { tokenize } from "../../src/core/Tokenizer.js";
import { parse } from "../../src/core/Parser.js";
import { evaluate } from "../../src/core/Evaluator.js";
import { initialConfig } from "../../src/stdlib/index.js";
import { trampoline } from "../../src/core/Trampoline.js";

function captureOutput(callback: () => void): string[] {
    const logs: string[] = [];
    const originalLog = console.log;
    try {
        console.log = (...args: any[]) => {
            logs.push(args.map((a) => String(a)).join(" "));
        };
        callback();
    } finally {
        console.log = originalLog;
    }
    return logs;
}

describe("Integration Semantics Tests", () => {
    it("deve executar semantics_suite.clj com o output esperado", () => {
        const fixturePath = path.join(
            process.cwd(),
            "tests",
            "fixtures",
            "semantics_suite.clj",
        );

        // Validação de arquivo
        if (!fs.existsSync(fixturePath)) {
            assert.fail(`Fixture não encontrada: ${fixturePath}`);
        }

        const source = fs.readFileSync(fixturePath, "utf-8");
        // DEBUG: Verificar se leu algo
        // console.error(`[DEBUG] Source length: ${source.length}`);

        const env = new Env();
        Object.keys(initialConfig).forEach((key) => {
            env.set(key, initialConfig[key]);
        });

        let output = "";

        try {
            const logs = captureOutput(() => {
                const tokens = tokenize(source, "semantics_suite.clj");
                // DEBUG: Verificar tokens
                // console.error(`[DEBUG] Tokens count: ${tokens.length}`);

                while (tokens.length > 0) {
                    const ast = parse(tokens);
                    trampoline(evaluate(ast, env));
                }
            });
            output = logs.join("\n");
        } catch (e: any) {
            console.error(
                "\n[DEBUG] Erro durante a execução do teste de integração:",
            );
            console.error(e);
            // Relançar para falhar o teste explicitamente com erro
            throw e;
        }

        // Se falhar, mostre o que veio
        if (!output.includes("--- INICIO SUITE ---")) {
            console.error("\n[DEBUG] Output Capturado (Incompleto/Vazio):");
            console.error(
                "---------------------------------------------------",
            );
            console.error(output || "(Vazio)");
            console.error(
                "---------------------------------------------------",
            );
        }

        assert.ok(
            output.includes("--- INICIO SUITE ---"),
            "Falha: Inicio da suite não encontrado",
        );
        assert.ok(output.includes("verdadeiro"), "Falha: Macro true");
        assert.ok(output.includes("falso"), "Falha: Macro false");
        assert.ok(output.includes("Rest: [2 3]"), "Falha: Rest operator");
        assert.ok(
            output.includes("Let Destruct: 30"),
            "Falha: Let destructuring",
        );
        assert.ok(output.includes("Atom: 10"), "Falha: Atom update");
        assert.ok(output.includes("Capturado: ErroTeste"), "Falha: Try/Catch");
        assert.ok(output.includes("TCO: fim"), "Falha: TCO");
        assert.ok(output.includes("--- FIM SUITE ---"), "Falha: Fim da suite");
    });
});
