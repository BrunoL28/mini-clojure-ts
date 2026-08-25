import { describe, it, after } from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as path from "path";
import { createGlobalEnv, parse, clearModuleCache } from "../../src/index.js";
import { evaluate } from "../../src/core/Evaluator.js";
import { trampoline } from "../../src/core/Trampoline.js";
import { CURRENT_FILE } from "../../src/core/Modules.js";

const FIXTURES_DIR = path.join(process.cwd(), "tests", "fixtures");
const TMP_IO_FILE = path.join(FIXTURES_DIR, ".tmp-io-suite.txt");

/**
 * Executa uma fixture `.clj` capturando o stdout.
 *
 * As suítes usam `assert` da própria stdlib: qualquer falha lança e o teste
 * quebra com a mensagem descritiva da asserção.
 */
function runFixture(filename: string): string {
    const fixturePath = path.join(FIXTURES_DIR, filename);
    assert.ok(
        fs.existsSync(fixturePath),
        `Fixture não encontrada: ${fixturePath}`,
    );

    const source = fs.readFileSync(fixturePath, "utf-8");
    const env = createGlobalEnv();
    // Sem isso, `require "./modules/..."` resolveria a partir do cwd.
    env.set(CURRENT_FILE, fixturePath);
    const logs: string[] = [];
    const originalLog = console.log;

    try {
        console.log = (...args: any[]) => {
            logs.push(args.map((a) => String(a)).join(" "));
        };
        for (const expr of parse(source)) {
            trampoline(evaluate(expr, env));
        }
    } finally {
        console.log = originalLog;
    }

    return logs.join("\n");
}

describe("Stdlib R3 — suítes de aceitação", () => {
    after(() => {
        if (fs.existsSync(TMP_IO_FILE)) fs.unlinkSync(TMP_IO_FILE);
    });

    it("[R3/E1] seq/core functions (#12)", () => {
        const output = runFixture("stdlib_seq_suite.clj");
        assert.match(output, /--- FIM SEQ SUITE ---/);
    });

    it("[R3/E2] predicados e tipos (#13)", () => {
        const output = runFixture("predicates_suite.clj");
        assert.match(output, /--- FIM PREDICATES SUITE ---/);
    });

    it("[R3/E3] macros utilitárias (#14)", () => {
        const output = runFixture("core_macros_suite.clj");
        assert.match(output, /--- FIM MACROS SUITE ---/);
    });

    it("[R3/E4] IO/util (#15)", () => {
        const output = runFixture("io_util_suite.clj");
        assert.match(output, /--- FIM IO SUITE ---/);
        assert.match(output, /Elapsed time: [\d.]+ msecs/);
    });

    it("[R4/E1+E2] módulos: loader, cache e alias (#16, #17)", () => {
        // O cache de módulos é global ao processo; zerar mantém o teste
        // independente da ordem de execução das suítes.
        clearModuleCache();
        const output = runFixture("modules_suite.clj");
        assert.match(output, /--- FIM MODULES SUITE ---/);
    });

    it("assert falha com a mensagem da asserção", () => {
        const env = createGlobalEnv();
        assert.throws(() => {
            for (const expr of parse('(assert (= 1 2) "um não é dois")')) {
                trampoline(evaluate(expr, env));
            }
        }, /Assert falhou: um não é dois/);
    });
});
