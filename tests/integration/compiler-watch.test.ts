import { describe, it } from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawn } from "child_process";
import type { ChildProcess } from "child_process";

const CLI = path.join(process.cwd(), "src", "cli.ts");

/** Espera até que a condição seja verdadeira, ou estoure o prazo. */
async function waitFor(
    label: string,
    predicate: () => boolean,
    timeoutMs = 15000,
): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.fail(`Tempo esgotado esperando: ${label}`);
}

describe("Compiler — modo watch (#24)", () => {
    it("recompila a cada mudança e sobrevive a erro de compilação", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mclj-watch-"));
        const entrada = path.join(dir, "app.clj");
        const saida = path.join(dir, "app.mjs");
        fs.writeFileSync(entrada, `(println "primeira")\n`);

        let saidaProcesso = "";
        let child: ChildProcess | null = null;

        try {
            child = spawn(
                process.execPath,
                [
                    path.join(
                        process.cwd(),
                        "node_modules",
                        "tsx",
                        "dist",
                        "cli.mjs",
                    ),
                    CLI,
                    "-t",
                    entrada,
                    "-w",
                ],
                { cwd: dir, stdio: ["ignore", "pipe", "pipe"] },
            );
            child.stdout?.on("data", (d) => (saidaProcesso += String(d)));
            child.stderr?.on("data", (d) => (saidaProcesso += String(d)));

            // 1. Compilação inicial. Esperamos também o ✔ no stdout, que só
            // sai depois do watch estar registrado.
            await waitFor(
                "compilação inicial",
                () =>
                    fs.existsSync(saida) &&
                    fs.readFileSync(saida, "utf-8").includes("primeira") &&
                    saidaProcesso.includes("✔"),
            );

            // 2. Mudança válida → recompila.
            fs.writeFileSync(entrada, `(println "segunda")\n`);
            await waitFor("recompilação após mudança", () =>
                fs.readFileSync(saida, "utf-8").includes("segunda"),
            );

            // 3. Código inválido → reporta erro e CONTINUA observando.
            fs.writeFileSync(entrada, `(println "quebrada"\n`);
            await waitFor("erro reportado", () =>
                /✘|Erro|desbalanceada/.test(saidaProcesso),
            );
            assert.strictEqual(
                child.exitCode,
                null,
                "o watch não pode morrer em erro de compilação",
            );

            // 4. Conserto → volta a compilar.
            fs.writeFileSync(entrada, `(println "consertada")\n`);
            await waitFor("recompilação após conserto", () =>
                fs.readFileSync(saida, "utf-8").includes("consertada"),
            );
        } finally {
            child?.kill();
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
