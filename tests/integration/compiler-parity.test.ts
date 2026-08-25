import { describe, it } from "node:test";
import assert from "node:assert";
import * as vm from "node:vm";
import {
    compileSource,
    createGlobalEnv,
    parse,
    evaluate,
    trampoline,
} from "../../src/index.js";
import * as runtime from "../../src/runtime/index.js";

function capture(fn: () => void): string[] {
    const logs: string[] = [];
    const original = console.log;
    try {
        console.log = (...args: any[]) =>
            logs.push(args.map((a) => String(a)).join(" "));
        fn();
    } finally {
        console.log = original;
    }
    return logs;
}

function runInterpreted(source: string): string[] {
    return capture(() => {
        const env = createGlobalEnv();
        for (const form of parse(source)) trampoline(evaluate(form, env));
    });
}

function runCompiled(source: string): string[] {
    const code = compileSource(source, { emitImport: false });
    // A stdlib do runtime vive no realm do host, então é o `console` do host
    // que precisa ser capturado — não o do contexto do vm.
    return capture(() => {
        const context = vm.createContext({
            $rt: runtime,
            console,
            performance,
        });
        vm.runInContext(code, context);
    });
}

/**
 * O DoD do #19: um mesmo programa precisa produzir exatamente a mesma saída
 * interpretado e compilado.
 */
const PROGRAMAS: [string, string][] = [
    [
        "aritmética e def",
        `(def x 10) (def y 3) (println (+ x y) (- x y) (* x y) (/ x y) (rem x y))`,
    ],
    ["comparações variádicas", `(println (< 1 2 3) (>= 3 3 1) (= 1 1 1))`],
    [
        "fn e recursão",
        `(defn fat [n] (if (<= n 1) 1 (* n (fat (- n 1))))) (println (fat 6))`,
    ],
    ["let simples", `(println (let [a 1 b 2] (+ a b)))`],
    ["let com corpo múltiplo", `(println (let [a 1] (+ a 1) (+ a 2)))`],
    [
        "let destructuring de sequência",
        `(let [[a b & r] [1 2 3 4]] (println a b r))`,
    ],
    [
        "let destructuring de mapa",
        `(let [{:keys [a b] :or {b 9} :as m} {:a 1}] (println a b m))`,
    ],
    [
        "destructuring com renomeação",
        `(let [{v :chave} {:chave 7}] (println v))`,
    ],
    ["destructuring aninhado", `(let [[[a b] c] [[1 2] 3]] (println a b c))`],
    [
        "fn com destructuring",
        `(defn f [[a b] {:keys [c]}] (println a b c)) (f [1 2] {:c 3})`,
    ],
    [
        "fn variádica",
        `(defn soma [& ns] (reduce + 0 ns)) (println (soma 1 2 3))`,
    ],
    [
        "mapas e keywords",
        `(def m {:a 1 :b [1 2]}) (println (get m :a) (:b m) (assoc m :c 3))`,
    ],
    ["keyword como função", `(println (:k {:k 1}) (:ausente {:k 1}))`],
    ["try/catch", `(println (try (throw "boom") (catch e (str "peguei:" e))))`],
    ["try sem erro", `(println (try (+ 1 2) (catch e :nunca)))`],
    [
        "try com erro da stdlib",
        `(println (try (nth [1] 9) (catch e :capturado)))`,
    ],
    [
        "atoms",
        `(def c (atom 0)) (swap! c + 5) (reset! c (* @c 2)) (println @c)`,
    ],
    [
        "and/or e short-circuit",
        `(println (and 1 2 3) (or nil false 7) (and) (or) (and 1 nil 3))`,
    ],
    [
        "cond",
        `(defn t [x] (cond (neg? x) :neg (zero? x) :zero :else :pos)) (println (t -1) (t 0) (t 5))`,
    ],
    [
        "when e when-not",
        `(println (when true 1 2) (when false 1) (when-not false :ok))`,
    ],
    [
        "threading last",
        `(println (->> [1 2 3 4 5] (filter odd?) (map inc) (reduce + 0)))`,
    ],
    ["threading first", `(println (-> {:a 1} (assoc :b 2) (get :b)))`],
    ["quote", `(println (quote (a b [1 :c])))`],
    [
        "macro simples",
        "(defmacro unless (p a b) `(if (not ~p) ~a ~b)) (println (unless false :sim :nao))",
    ],
    [
        "macro aninhada",
        "(defmacro dobro (x) `(* 2 ~x)) (defmacro quad (x) `(dobro (dobro ~x))) (println (quad 3))",
    ],
    [
        "macro com quasiquote e vetor",
        "(defmacro par (a b) `[~a ~b]) (println (par 1 2))",
    ],
    [
        "igualdade estrutural",
        `(println (= [1 [2 {:a 1}]] [1 [2 {:a 1}]]) (= {:a 1} {:a 2}))`,
    ],
    [
        "predicados",
        `(println (map? {}) (vector? [1]) (list? (list 1)) (seq? (filter odd? [1])) (nil? nil))`,
    ],
    [
        "truthiness de Clojure",
        `(println (if 0 :sim :nao) (if "" :sim :nao) (if nil :a :b) (if false :a :b))`,
    ],
    ["strings com hífen (#38)", `(println "--- oi --- tudo? sim!")`],
    [
        "stdlib de sequências",
        `(println (take 2 (range 10)) (into [1] [2 3]) (reverse [1 2 3]) (last [1 2 3]))`,
    ],
    [
        "get-in e assoc-in",
        `(println (get-in {:a {:b 1}} [:a :b]) (assoc-in {:a {:b 1}} [:a :b] 9))`,
    ],
    ["interop com js/", `(. "log" js/console "interop")`],
    ["nomes reservados do JS", `(println (try (throw "x") (catch e e)))`],
];

describe("Compiler — paridade interpretado × compilado (#19)", () => {
    for (const [nome, source] of PROGRAMAS) {
        it(nome, () => {
            assert.deepStrictEqual(
                runCompiled(source),
                runInterpreted(source),
                `Divergência entre interpretado e compilado em: ${nome}`,
            );
        });
    }
});
