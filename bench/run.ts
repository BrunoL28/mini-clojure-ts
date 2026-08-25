/**
 * Benchmarks do interpretador.
 *
 * ```sh
 * pnpm bench                          # mede e imprime
 * pnpm bench --save base.json         # grava os números
 * pnpm bench --baseline base.json     # compara com uma medição anterior
 * ```
 *
 * Reporta o **mínimo** de várias amostras, não a média: numa máquina
 * compartilhada o ruído só atrasa, então a amostra mais rápida é a menos
 * contaminada. Cada amostra é calibrada para durar tempo suficiente para o
 * relógio ser confiável.
 */
import * as fs from "fs";
import { createGlobalEnv, parse } from "../src/index.js";
import { evaluate } from "../src/core/Evaluator.js";
import { trampoline } from "../src/core/Trampoline.js";
import type { Env } from "../src/core/Environment.js";
import type { Expression } from "../src/types/index.js";

interface Caso {
    nome: string;
    /** Executado uma vez, fora da medição. */
    setup?: string;
    codigo: string;
}

const CASOS: Caso[] = [
    {
        nome: "env: lookup em escopo profundo",
        setup: "(def alvo 42)",
        codigo: `(let [a 1] (let [b 2] (let [c 3] (let [d 4] (let [e 5]
                  (+ a b c d e alvo))))))`,
    },
    {
        nome: "env: chamada de função de usuário",
        setup: "(defn somar3 [a b c] (+ a b c))",
        codigo: "(somar3 1 2 3)",
    },
    {
        nome: "seq: map + filter + reduce (1k)",
        setup: "(def dados (range 1000))",
        codigo: "(reduce + 0 (map inc (filter even? dados)))",
    },
    {
        nome: "tco: recursão de cauda (10k)",
        setup: "(defn conta [n] (if (<= n 0) :fim (conta (- n 1))))",
        codigo: "(conta 10000)",
    },
    {
        nome: "macro: expansão em loop",
        setup: "(defmacro unless (p a b) `(if (not ~p) ~a ~b))",
        codigo: "(unless false :sim :nao)",
    },
    {
        nome: "mapa: assoc + get encadeados",
        setup: "(def base {:a 1 :b 2 :c 3})",
        codigo: "(get (assoc (assoc base :d 4) :e 5) :c)",
    },
    {
        nome: "mapa: destructuring com :keys",
        setup: '(def pessoa {:nome "ana" :idade 30 :cidade "sp"})',
        codigo: "(let [{:keys [nome idade cidade]} pessoa] idade)",
    },
    {
        nome: "destructuring: vetor com rest",
        codigo: "(let [[a b & r] [1 2 3 4 5 6 7 8]] (+ a b))",
    },
    {
        // Regressão de #28: `into` era quadrático em vetores.
        nome: "coleção: into de 1k elementos",
        setup: "(def dados (range 1000))",
        codigo: "(into [] dados)",
    },
    {
        nome: "interop: acesso a js/",
        codigo: '(. "abs" js/Math -5)',
    },
];

const AMOSTRAS = 9;
const ALVO_MS = 50;

function rodar(formas: Expression[], env: Env, vezes: number): number {
    const inicio = performance.now();
    for (let i = 0; i < vezes; i++) {
        for (const forma of formas) trampoline(evaluate(forma, env));
    }
    return performance.now() - inicio;
}

/** Descobre quantas repetições fazem uma amostra durar ~ALVO_MS. */
function calibrar(formas: Expression[], env: Env): number {
    let vezes = 1;
    for (;;) {
        const ms = rodar(formas, env, vezes);
        if (ms >= ALVO_MS || vezes >= 1_000_000) return vezes;
        const fator = Math.max(
            2,
            Math.ceil((ALVO_MS / Math.max(ms, 0.01)) * 1.2),
        );
        vezes = Math.min(vezes * fator, 1_000_000);
    }
}

const argv = process.argv.slice(2);
const valorDe = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
};

const baselinePath = valorDe("--baseline");
const savePath = valorDe("--save");
const baseline: Record<string, number> = baselinePath
    ? JSON.parse(fs.readFileSync(baselinePath, "utf-8"))
    : {};

const resultados: Record<string, number> = {};

console.log(
    `Mini-Clojure-TS — benchmarks (melhor de ${AMOSTRAS} amostras de ~${ALVO_MS} ms)\n`,
);
const cabecalho =
    "caso".padEnd(36) +
    "ops/s".padStart(14) +
    (baselinePath ? "  vs base" : "");
console.log(cabecalho);
console.log("-".repeat(cabecalho.length));

for (const caso of CASOS) {
    const env = createGlobalEnv();
    if (caso.setup) {
        for (const forma of parse(caso.setup)) trampoline(evaluate(forma, env));
    }
    const formas = parse(caso.codigo);

    const vezes = calibrar(formas, env);
    rodar(formas, env, vezes); // aquecimento pós-calibração

    let melhor = Infinity;
    for (let i = 0; i < AMOSTRAS; i++) {
        melhor = Math.min(melhor, rodar(formas, env, vezes));
    }

    const ops = Math.round((vezes / melhor) * 1000);
    resultados[caso.nome] = ops;

    let delta = "";
    const anterior = baseline[caso.nome];
    if (anterior) {
        const pct = ((ops - anterior) / anterior) * 100;
        const sinal = pct >= 0 ? "+" : "";
        delta = `  ${sinal}${pct.toFixed(1)}%`;
    }

    console.log(
        caso.nome.padEnd(36) + ops.toLocaleString("pt-BR").padStart(14) + delta,
    );
}

if (savePath) {
    fs.writeFileSync(savePath, JSON.stringify(resultados, null, 4) + "\n");
    console.log(`\nGravado em ${savePath}`);
}
