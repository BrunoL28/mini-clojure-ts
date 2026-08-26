import { describe, it } from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { format } from "../../src/core/Formatter.js";
import { parse } from "../../src/index.js";
import { ClojureMap } from "../../src/types/index.js";

/**
 * Normaliza a AST para comparação, descartando `loc` — que muda de propósito
 * quando o código é reformatado.
 */
function forma(x: any): any {
    if (x instanceof ClojureMap) {
        return { mapa: x.entries().map(([k, v]) => [forma(k), forma(v)]) };
    }
    if (Array.isArray(x)) {
        return { tipo: x.constructor.name, itens: x.map(forma) };
    }
    if (x && typeof x === "object" && "value" in x) {
        return { [x.constructor.name]: x.value };
    }
    return x;
}

function mesmaAst(a: string, b: string): boolean {
    return JSON.stringify(forma(parse(a))) === JSON.stringify(forma(parse(b)));
}

/** Todos os `.clj` versionados no repositório. */
function fontesDoRepo(): string[] {
    const dirs = ["tests", "tests/fixtures", "tests/fixtures/modules"];
    return dirs.flatMap((dir) =>
        fs
            .readdirSync(path.join(process.cwd(), dir))
            .filter((f) => f.endsWith(".clj"))
            .map((f) => path.join(dir, f)),
    );
}

describe("Formatter — não altera o programa (#35)", () => {
    it("a AST formatada é idêntica à original, em todo .clj do repo", () => {
        for (const arquivo of fontesDoRepo()) {
            const src = fs.readFileSync(arquivo, "utf-8");
            let formatado: string;
            try {
                formatado = format(src);
            } catch {
                // Fonte inválido de propósito (string não terminada): o
                // formatador recusa, que é o comportamento certo.
                continue;
            }
            assert.ok(
                mesmaAst(src, formatado),
                `formatar mudou o programa em ${arquivo}`,
            );
        }
    });

    it("recusa fonte inválido em vez de produzir lixo", () => {
        assert.throws(
            () => format('(println "sem fim'),
            /String não terminada/,
        );
        assert.throws(() => format("(defn f [x]"), /não fechado/);
    });
});

describe("Formatter — é idempotente (#35)", () => {
    it("formatar duas vezes dá o mesmo resultado, em todo .clj do repo", () => {
        for (const arquivo of fontesDoRepo()) {
            const src = fs.readFileSync(arquivo, "utf-8");
            let uma: string;
            try {
                uma = format(src);
            } catch {
                continue;
            }
            assert.strictEqual(
                format(uma),
                uma,
                `formatar não é idempotente em ${arquivo}`,
            );
        }
    });
});

describe("Formatter — preserva comentários (#35)", () => {
    it("mantém comentário de topo", () => {
        // O tokenizer descartava comentários; sem a opção `keepComments`,
        // formatar apagaria todos eles.
        assert.match(format(";; topo\n(def x 1)\n"), /^;; topo\n/);
    });

    it("mantém comentário pendurado no fim da linha", () => {
        assert.match(format("(def x 1) ; nota\n"), /\(def x 1\) ; nota/);
    });

    it("mantém comentário dentro de uma forma", () => {
        const saida = format("(defn f [x]\n  ;; explica\n  (* x 2))\n");
        assert.match(saida, /;; explica/);
    });

    it("não perde nenhum comentário em nenhum .clj do repo", () => {
        for (const arquivo of fontesDoRepo()) {
            const src = fs.readFileSync(arquivo, "utf-8");
            let saida: string;
            try {
                saida = format(src);
            } catch {
                continue;
            }
            const antes = (src.match(/;/g) ?? []).length;
            const depois = (saida.match(/;/g) ?? []).length;
            assert.ok(
                depois >= antes,
                `${arquivo}: ${antes} ';' antes, ${depois} depois`,
            );
        }
    });
});

describe("Formatter — formatação (#35)", () => {
    it("normaliza espaços em excesso", () => {
        assert.strictEqual(format("(+    1     2)\n"), "(+ 1 2)\n");
    });

    it("junta o que cabe numa linha", () => {
        assert.strictEqual(
            format("(let [a 1\nb 2]\n(+ a b))\n"),
            "(let [a 1 b 2] (+ a b))\n",
        );
    });

    it("indenta o corpo de defn em 2 espaços", () => {
        const longo =
            '(defn f [x] (println "um texto bem longo que nao cabe em oitenta colunas" x "mais texto ainda aqui"))\n';
        assert.ok(
            longo.trim().length > 80,
            "o caso precisa estourar a largura",
        );

        const saida = format(longo).split("\n");
        assert.match(saida[0]!, /^\(defn f \[x\]$/);
        assert.match(saida[1]!, /^ {2}\(println/);
    });

    it("quebra mapa por par chave/valor", () => {
        const saida = format(
            '(def m {:nome "ana" :idade 30 :tags [:a :b :c] :cidade "sao paulo" :pais "brasil"})\n',
        ).split("\n");
        assert.ok(saida.length > 2);
        assert.match(saida[1]!, /^ {2}\{:/);
        for (const linha of saida.slice(2, -1)) {
            assert.match(linha, /^ {3}:/, `esperava par alinhado: ${linha}`);
        }
    });

    it("colapsa várias linhas em branco em uma só", () => {
        assert.strictEqual(
            format("(def a 1)\n\n\n\n(def b 2)\n"),
            "(def a 1)\n\n(def b 2)\n",
        );
    });

    it("termina o arquivo com uma nova linha", () => {
        assert.match(format("(def a 1)"), /\n$/);
    });

    it("respeita a largura escolhida", () => {
        const src = "(println 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15)\n";
        assert.ok(!format(src, { width: 80 }).includes("\n("));
        assert.ok(format(src, { width: 20 }).split("\n").length > 2);
    });
});

describe("Formatter — subcomando fmt (#35)", () => {
    function rodar(args: string[], cwd: string) {
        return spawnSync(
            process.execPath,
            [
                path.join(
                    process.cwd(),
                    "node_modules",
                    "tsx",
                    "dist",
                    "cli.mjs",
                ),
                path.join(process.cwd(), "src", "cli.ts"),
                "fmt",
                ...args,
            ],
            { cwd, encoding: "utf-8" },
        );
    }

    it("--check falha e --write conserta", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mclj-fmt-"));
        const arquivo = path.join(dir, "a.clj");
        fs.writeFileSync(arquivo, ";; topo\n(defn   f [x]\n(* x 2))\n");

        try {
            const antes = rodar(["--check", arquivo], dir);
            assert.notStrictEqual(antes.status, 0, "--check devia falhar");
            assert.match(antes.stderr, /Fora do formato/);

            const escrita = rodar(["--write", arquivo], dir);
            assert.strictEqual(escrita.status, 0);
            assert.match(fs.readFileSync(arquivo, "utf-8"), /^;; topo/);

            const depois = rodar(["--check", arquivo], dir);
            assert.strictEqual(depois.status, 0, "--check devia passar");
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it("sem flag, escreve na saída padrão sem tocar no arquivo", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mclj-fmt-"));
        const arquivo = path.join(dir, "a.clj");
        const original = "(defn   f [x]\n(* x 2))\n";
        fs.writeFileSync(arquivo, original);

        try {
            const r = rodar([arquivo], dir);
            assert.strictEqual(r.status, 0);
            assert.match(r.stdout, /\(defn f \[x\] \(\* x 2\)\)/);
            assert.strictEqual(fs.readFileSync(arquivo, "utf-8"), original);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it("recusa --write junto com --check", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mclj-fmt-"));
        try {
            const r = rodar(["--write", "--check", "x.clj"], dir);
            assert.notStrictEqual(r.status, 0);
            assert.match(r.stderr, /não os dois/);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
