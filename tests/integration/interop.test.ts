import { describe, it } from "node:test";
import assert from "node:assert";
import * as vm from "node:vm";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
    runSource,
    createGlobalEnv,
    compileSource,
    parse,
    evaluate,
    trampoline,
} from "../../src/index.js";
import * as runtime from "../../src/runtime/index.js";

/** Avalia e devolve o valor da última forma. */
function run(
    source: string,
    opts: { sandbox?: boolean; allow?: string[] } = {},
) {
    const env = createGlobalEnv(
        opts.sandbox
            ? {
                  sandbox: true,
                  ...(opts.allow
                      ? { sandboxOptions: { extraAllow: opts.allow } }
                      : {}),
              }
            : {},
    );
    let last: any = null;
    for (const form of parse(source)) last = trampoline(evaluate(form, env));
    return last;
}

/** Mensagem do erro lançado, ou `null` se não lançou. */
function errorOf(fn: () => unknown): string | null {
    try {
        fn();
        return null;
    } catch (e: any) {
        return e.message;
    }
}

function runCompiled(source: string): string[] {
    const code = compileSource(source, { emitImport: false });
    const logs: string[] = [];
    const original = console.log;
    try {
        console.log = (...a: any[]) => logs.push(a.map(String).join(" "));
        vm.runInContext(
            code,
            vm.createContext({ $rt: runtime, console, performance }),
        );
    } finally {
        console.log = original;
    }
    return logs;
}

// ==========================================================
// [R6/E2] Contrato de interop — issue #26
// ==========================================================

describe("Interop — resolução de js/", () => {
    it("resolve um global simples", () => {
        assert.strictEqual(run("js/Math"), Math);
    });

    it("resolve caminho com ponto", () => {
        assert.strictEqual(run("js/Math.PI"), Math.PI);
    });

    it("resolve caminho aninhado", () => {
        assert.strictEqual(typeof run("js/JSON.stringify"), "function");
    });

    it("global inexistente lança erro nomeando o símbolo", () => {
        assert.match(
            errorOf(() => run("js/NaoExisteMesmo")) ?? "",
            /js\/NaoExisteMesmo' não encontrado/,
        );
    });

    it("propriedade inexistente no caminho lança erro", () => {
        assert.match(
            errorOf(() => run("js/Math.naoExiste")) ?? "",
            /js\/Math\.naoExiste' não encontrada/,
        );
    });
});

describe("Interop — operador . (chama quando é função)", () => {
    it("lê propriedade que não é função", () => {
        assert.strictEqual(run('(. "PI" js/Math)'), Math.PI);
    });

    it("chama método com argumentos", () => {
        assert.strictEqual(run('(. "repeat" "ab" 3)'), "ababab");
    });

    it("chama método sem argumentos", () => {
        assert.strictEqual(run('(. "toUpperCase" "abc")'), "ABC");
    });

    it("aceita o membro como keyword", () => {
        assert.strictEqual(run('(. :toUpperCase "abc")'), "ABC");
    });

    it("alvo nil lança erro explícito", () => {
        assert.match(
            errorOf(() => run('(. "x" nil)')) ?? "",
            /Alvo do operador '\.' é nulo ou indefinido/,
        );
    });

    it("propriedade ausente devolve nil", () => {
        assert.strictEqual(run('(. "naoExiste" js/Math)'), undefined);
    });
});

describe("Interop — operador .- (nunca chama)", () => {
    it("devolve a função sem invocá-la", () => {
        assert.strictEqual(typeof run('(.- "toUpperCase" "abc")'), "function");
    });

    it("lê propriedade comum igual ao .", () => {
        assert.strictEqual(run('(.- "PI" js/Math)'), Math.PI);
    });

    it("alvo nil lança erro explícito", () => {
        assert.match(
            errorOf(() => run('(.- "x" nil)')) ?? "",
            /Alvo do operador '\.-' é nulo ou indefinido/,
        );
    });
});

describe("Interop — new", () => {
    it("instancia com argumentos", () => {
        assert.strictEqual(
            run('(. "getFullYear" (new js/Date 2020 0 1))'),
            2020,
        );
    });

    it("instancia sem argumentos", () => {
        assert.strictEqual(run('(. "size" (new js/Map))'), 0);
    });

    it("recusa algo que não é construtor", () => {
        assert.match(
            errorOf(() => run("(new 42)")) ?? "",
            /deve ser uma classe\/função construtora/,
        );
    });
});

describe("Interop — paridade interpretado × compilado (#26)", () => {
    for (const [nome, source] of [
        ["propriedade", `(println (. "PI" js/Math))`],
        ["método com args", `(println (. "repeat" "ab" 3))`],
        ["membro por keyword", `(println (. :toUpperCase "abc"))`],
        ["caminho com ponto", `(println js/Math.PI)`],
        ["new", `(println (. "getFullYear" (new js/Date 2020 0 1)))`],
        [".- não chama", `(println (fn? (.- "toUpperCase" "abc")))`],
    ] as [string, string][]) {
        it(nome, () => {
            const interpretado: string[] = [];
            const original = console.log;
            try {
                console.log = (...a: any[]) =>
                    interpretado.push(a.map(String).join(" "));
                run(source);
            } finally {
                console.log = original;
            }
            assert.deepStrictEqual(runCompiled(source), interpretado);
        });
    }
});

// ==========================================================
// [R6/E1] Sandbox — issue #25
// ==========================================================

describe("Sandbox — globais liberados", () => {
    it("js/Math funciona", () => {
        assert.strictEqual(run("js/Math.PI", { sandbox: true }), Math.PI);
    });

    it("métodos de globais liberados funcionam", () => {
        assert.strictEqual(run('(. "abs" js/Math -5)', { sandbox: true }), 5);
    });

    it("--allow libera globais extras", () => {
        assert.strictEqual(
            typeof run("js/Intl.DateTimeFormat", {
                sandbox: true,
                allow: ["Intl"],
            }),
            "function",
        );
    });
});

describe("Sandbox — globais bloqueados", () => {
    for (const nome of [
        "process",
        "eval",
        "Function",
        "globalThis",
        "require",
    ]) {
        it(`js/${nome} é bloqueado`, () => {
            assert.match(
                errorOf(() => run(`js/${nome}`, { sandbox: true })) ?? "",
                new RegExp(`Sandbox: acesso a 'js/${nome}' bloqueado`),
            );
        });
    }

    it("global não listado é bloqueado mesmo sendo inofensivo", () => {
        assert.match(
            errorOf(() => run("js/Intl", { sandbox: true })) ?? "",
            /bloqueado/,
        );
    });
});

describe("Sandbox — escapes por membro", () => {
    it("bloqueia a rota constructor → Function", () => {
        // `"".constructor.constructor` é `Function`, e daí sai `eval`.
        assert.match(
            errorOf(() => run('(. "constructor" "")', { sandbox: true })) ?? "",
            /membro 'constructor' bloqueado/,
        );
    });

    it("bloqueia __proto__", () => {
        assert.match(
            errorOf(() => run('(.- "__proto__" {})', { sandbox: true })) ?? "",
            /membro '__proto__' bloqueado/,
        );
    });

    it("bloqueia prototype", () => {
        assert.match(
            errorOf(() =>
                run('(.- "prototype" js/Array)', { sandbox: true }),
            ) ?? "",
            /membro 'prototype' bloqueado/,
        );
    });

    it("bloqueia constructor também via caminho com ponto", () => {
        assert.match(
            errorOf(() => run("js/Array.constructor", { sandbox: true })) ?? "",
            /membro 'constructor' bloqueado/,
        );
    });
});

describe("Sandbox — IO e módulos", () => {
    it("slurp é bloqueado", () => {
        assert.match(
            errorOf(() => run('(slurp "/etc/hostname")', { sandbox: true })) ??
                "",
            /Sandbox: 'slurp' bloqueado/,
        );
    });

    it("spit é bloqueado", () => {
        const alvo = path.join(
            os.tmpdir(),
            "mclj-sandbox-nao-deve-existir.txt",
        );
        assert.match(
            errorOf(() => run(`(spit "${alvo}" "x")`, { sandbox: true })) ?? "",
            /Sandbox: 'spit' bloqueado/,
        );
        assert.ok(!fs.existsSync(alvo), "o arquivo não pode ter sido criado");
    });

    it("require é bloqueado", () => {
        assert.match(
            errorOf(() => run('(require "./x.clj")', { sandbox: true })) ?? "",
            /Sandbox: 'require' bloqueado/,
        );
    });

    it("load-file é bloqueado", () => {
        assert.match(
            errorOf(() => run('(load-file "./x.clj")', { sandbox: true })) ??
                "",
            /Sandbox: 'load-file' bloqueado/,
        );
    });
});

describe("Sandbox — sem sandbox nada muda", () => {
    it("o interop segue aberto por padrão", () => {
        assert.strictEqual(typeof run("js/process"), "object");
        // `.-` porque `.` chamaria String() e devolveria "".
        assert.strictEqual(run('(.- "constructor" "")'), String);
    });

    it("runSource aceita a opção sandbox", () => {
        assert.match(
            errorOf(() => runSource("js/process", { sandbox: true })) ?? "",
            /bloqueado/,
        );
    });
});
