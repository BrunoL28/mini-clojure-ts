import { InvalidParamError } from "../errors/InvalidParamError.js";
import { ClojureError } from "../errors/ClojureError.js";
import {
    ClojureVector,
    ClojureKeyword,
    ClojureMap,
    ClojureAtom,
    ClojureSymbol,
    ClojureMacro,
    Reduced,
} from "../types/index.js";
import { prStr } from "../core/Printer.js";
import { equals } from "../core/Runtime.js";
import { parse } from "../core/Parser.js";
import { tokenize } from "../core/Tokenizer.js";
import { callFn, isCallable, truthy } from "../core/Invoke.js";
import { getHost } from "../core/Host.js";
import { setPrintLimits, getPrintLimits } from "../core/Limits.js";
import { ppStr } from "../core/PrettyPrinter.js";
import { LazySeq, lazy, pullDe, FIM } from "../core/LazySeq.js";
import type { Proximo } from "../core/LazySeq.js";
import {
    mapeando,
    filtrando,
    removendo,
    pegando,
    descartando,
    pegandoEnquanto,
    descartandoEnquanto,
    desreduzir,
    garantirReduzido,
    reduzirFonte,
} from "../core/Transducers.js";
import type { Transdutor, RF } from "../core/Transducers.js";
import {
    OPEN_POLICY,
    accessMember,
    readProperty,
    construct,
} from "../core/Interop.js";

// ==========================================
// Helpers internos
// ==========================================

function assertNumber(val: any, operation: string) {
    if (typeof val !== "number" || isNaN(val)) {
        throw new InvalidParamError(
            `Erro em '${operation}': esperava número, recebeu ${prStr(val)} (${typeof val})`,
        );
    }
}

function assertFn(val: any, operation: string) {
    if (!isCallable(val)) {
        throw new InvalidParamError(
            `Erro em '${operation}': esperava uma função, recebeu ${prStr(val)}`,
        );
    }
}

/** Lista (seq) é qualquer Array que NÃO seja um ClojureVector. */
function isList(x: any): boolean {
    if (x instanceof LazySeq) return true;
    return Array.isArray(x) && !(x instanceof ClojureVector);
}

function isColl(x: any): boolean {
    return Array.isArray(x) || x instanceof ClojureMap || x instanceof LazySeq;
}

/**
 * Normaliza qualquer coleção para um array JS.
 * Strings viram arrays de caracteres e mapas viram arrays de pares [k v].
 * Retorna `null` para valores não sequenciais (inclusive `nil`).
 */
function toSeq(x: any): any[] | null {
    if (x === null || x === undefined) return null;
    if (Array.isArray(x)) return x;
    // Ponto único de realização: todo o resto da stdlib passa por aqui, então
    // não precisa saber que sequência preguiçosa existe.
    if (x instanceof LazySeq) return x.realizar();
    if (typeof x === "string") return x.split("");
    if (x instanceof ClojureMap) {
        return x.entries().map(([k, v]) => ClojureVector.fromArray([k, v]));
    }
    return null;
}

/**
 * Converte o resultado de uma operação de sequência numa lista "pura".
 * Métodos de Array (`slice`, `filter`, ...) herdam a espécie do receptor, então
 * sem isso `(filter ... [1 2 3])` devolveria um vetor em vez de uma seq.
 */
function asList(items: any[]): any[] {
    return items instanceof ClojureVector ? [...items] : items;
}

/** Igual a `toSeq`, mas lança erro nomeando a operação quando o valor não é sequencial. */
/**
 * Produtor sobre um valor sequencial, sem realizá-lo, ou erro nomeando a
 * operação.
 *
 * @param {any} x O valor.
 * @param {string} operation Nome da operação, para a mensagem de erro.
 * @return {Proximo} O produtor.
 */
function pullOuFalhar(x: any, operation: string): Proximo {
    if (x instanceof ClojureMap) {
        return pullDe(
            x.entries().map(([k, v]) => ClojureVector.fromArray([k, v])),
        )!;
    }
    const produtor = pullDe(x);
    if (produtor === null) {
        throw new InvalidParamError(
            `Erro em '${operation}': esperava uma coleção, recebeu ${prStr(x)}`,
        );
    }
    return produtor;
}

/**
 * Fonte para redução: devolve a sequência preguiçosa como está, ou o array.
 *
 * @param {any} x O valor.
 * @param {string} operation Nome da operação, para a mensagem de erro.
 * @return {any} A fonte a reduzir.
 */
function fonteDe(x: any, operation: string): any {
    if (x instanceof LazySeq) return x;
    return seqOrThrow(x, operation);
}

/** A cauda de uma sequência preguiçosa, ainda preguiçosa. */
function rest1(fonte: LazySeq): LazySeq {
    return lazy(() => {
        const proximo = fonte.cursor();
        let pulou = false;
        return () => {
            if (!pulou) {
                pulou = true;
                if (proximo() === FIM) return FIM;
            }
            return proximo();
        };
    });
}

function seqOrThrow(x: any, operation: string): any[] {
    const s = toSeq(x);
    if (s === null) {
        if (x === null || x === undefined) return [];
        throw new InvalidParamError(
            `Erro em '${operation}': esperava uma coleção, recebeu ${prStr(x)}`,
        );
    }
    return s;
}

/** Adiciona um item preservando o tipo da coleção (vetor no fim, lista no início). */
function conjOne(coll: any, item: any): any {
    if (coll === null || coll === undefined) return [item];
    if (coll instanceof ClojureVector) {
        const copia = coll.slice() as any[];
        copia.push(item);
        return ClojureVector.fromArray(copia);
    }
    if (coll instanceof ClojureMap) {
        const pair = toSeq(item);
        if (!pair || pair.length !== 2) {
            throw new InvalidParamError(
                "conj em um mapa requer um par [chave valor]",
            );
        }
        return coll.assoc(pair[0], pair[1]);
    }
    if (Array.isArray(coll)) return [item, ...coll];
    throw new InvalidParamError(
        `conj requer uma coleção, recebeu ${prStr(coll)}`,
    );
}

/** Sentinela interna para distinguir "chave ausente" de um `nil` armazenado. */
const MISSING = Symbol("missing");

/**
 * Adiciona vários itens de uma vez, preservando a semântica de `conj`.
 *
 * Existe porque `items.reduce(conjOne, coll)` era **quadrático** em vetores:
 * cada item recriava o vetor inteiro. `(into [] (range 32000))` levava 39 s.
 *
 * @param {any} coll A coleção destino.
 * @param {any[]} items Os itens a adicionar.
 * @return {any} A nova coleção.
 */
function addAll(coll: any, items: any[]): any {
    if (items.length === 0) return coll;

    if (coll instanceof ClojureVector) {
        const saida = coll.slice() as any[];
        for (let i = 0; i < items.length; i++) saida.push(items[i]);
        return ClojureVector.fromArray(saida);
    }

    if (coll instanceof ClojureMap) {
        let mapa = coll;
        for (const item of items) mapa = conjOne(mapa, item);
        return mapa;
    }

    if (coll === null || coll === undefined || isList(coll)) {
        // `conj` numa lista insere no início, então a ordem final é invertida.
        const base = coll === null || coll === undefined ? [] : coll;
        const saida = items.slice().reverse();
        for (let i = 0; i < base.length; i++) saida.push(base[i]);
        return saida;
    }

    return items.reduce((acc, item) => conjOne(acc, item), coll);
}

function getIn(coll: any, path: any[], notFound: any): any {
    let current: any = coll;
    for (const key of path) {
        current = lookup(current, key, MISSING);
        if (current === MISSING) return notFound;
    }
    return current;
}

/** `get` genérico: mapas por chave, sequências e strings por índice. */
function lookup(coll: any, key: any, notFound: any): any {
    if (coll instanceof ClojureMap) {
        const val = coll.get(key);
        return val === undefined ? notFound : val;
    }
    if (Array.isArray(coll) || typeof coll === "string") {
        if (typeof key !== "number" || key < 0 || key >= coll.length) {
            return notFound;
        }
        return coll[key];
    }
    return notFound;
}

function assocOne(coll: any, key: any, val: any): any {
    if (coll === null || coll === undefined) {
        return new ClojureMap().assoc(key, val);
    }
    if (coll instanceof ClojureMap) return coll.assoc(key, val);
    if (Array.isArray(coll)) {
        assertNumber(key, "assoc");
        if (key < 0 || key > coll.length) {
            throw new InvalidParamError(
                `assoc: índice ${key} fora dos limites do vetor (tamanho ${coll.length})`,
            );
        }
        const copy = coll.slice();
        copy[key] = val;
        return coll instanceof ClojureVector
            ? ClojureVector.fromArray(copy)
            : copy;
    }
    throw new InvalidParamError(
        `assoc requer um mapa ou vetor, recebeu ${prStr(coll)}`,
    );
}

function assocIn(coll: any, path: any[], val: any): any {
    if (path.length === 0) return val;
    const [key, ...rest] = path;
    if (rest.length === 0) return assocOne(coll, key, val);
    const child = lookup(coll, key, null);
    return assocOne(coll, key, assocIn(child, rest, val));
}

export const initialConfig: { [key: string]: any } = {
    // ==========================================
    // Aritmética
    // ==========================================

    "+": (...args: any[]) => {
        return args.reduce((a, b) => {
            assertNumber(a, "+");
            assertNumber(b, "+");
            return a + b;
        }, 0);
    },
    "-": (...args: any[]) => {
        if (args.length === 0)
            throw new InvalidParamError("'-' requer ao menos 1 argumento");
        args.forEach((a) => assertNumber(a, "-"));
        if (args.length === 1) return -args[0];
        return args.slice(1).reduce((a, b) => a - b, args[0]);
    },
    "*": (...args: any[]) => {
        return args.reduce((a, b) => {
            assertNumber(a, "*");
            assertNumber(b, "*");
            return a * b;
        }, 1);
    },
    "/": (...args: any[]) => {
        if (args.length === 0)
            throw new InvalidParamError("'/' requer ao menos 1 argumento");
        args.forEach((a) => assertNumber(a, "/"));
        const divisors = args.length === 1 ? args : args.slice(1);
        let acc = args.length === 1 ? 1 : args[0];
        for (const d of divisors) {
            if (d === 0) throw new InvalidParamError("Divisão por zero");
            acc = acc / d;
        }
        return acc;
    },
    rem: (a: any, b: any) => {
        assertNumber(a, "rem");
        assertNumber(b, "rem");
        if (b === 0) throw new InvalidParamError("Divisão por zero");
        return a % b;
    },
    // Alias histórico de `rem`, mantido para compatibilidade.
    "%": (a: any, b: any) => {
        assertNumber(a, "%");
        assertNumber(b, "%");
        if (b === 0) throw new InvalidParamError("Divisão por zero");
        return a % b;
    },
    mod: (a: any, b: any) => {
        assertNumber(a, "mod");
        assertNumber(b, "mod");
        if (b === 0) throw new InvalidParamError("Divisão por zero");
        return ((a % b) + b) % b;
    },
    quot: (a: any, b: any) => {
        assertNumber(a, "quot");
        assertNumber(b, "quot");
        if (b === 0) throw new InvalidParamError("Divisão por zero");
        return Math.trunc(a / b);
    },
    inc: (a: any) => {
        assertNumber(a, "inc");
        return a + 1;
    },
    dec: (a: any) => {
        assertNumber(a, "dec");
        return a - 1;
    },
    max: (...args: any[]) => {
        if (args.length === 0)
            throw new InvalidParamError("max requer ao menos 1 argumento");
        args.forEach((a) => assertNumber(a, "max"));
        return Math.max(...args);
    },
    min: (...args: any[]) => {
        if (args.length === 0)
            throw new InvalidParamError("min requer ao menos 1 argumento");
        args.forEach((a) => assertNumber(a, "min"));
        return Math.min(...args);
    },
    abs: (a: any) => {
        assertNumber(a, "abs");
        return Math.abs(a);
    },

    // ==========================================
    // Comparação e lógica
    // ==========================================

    ">": (...args: any[]) => compareChain(args, ">", (a, b) => a > b),
    "<": (...args: any[]) => compareChain(args, "<", (a, b) => a < b),
    ">=": (...args: any[]) => compareChain(args, ">=", (a, b) => a >= b),
    "<=": (...args: any[]) => compareChain(args, "<=", (a, b) => a <= b),

    "=": (...args: any[]) => {
        if (args.length < 2) return true;
        for (let i = 1; i < args.length; i++) {
            if (!equals(args[i - 1], args[i])) return false;
        }
        return true;
    },
    "identical?": (a: any, b: any) => a === b,
    "not=": (...args: any[]) => {
        if (args.length < 2) return false;
        for (let i = 1; i < args.length; i++) {
            if (!equals(args[i - 1], args[i])) return true;
        }
        return false;
    },
    not: (a: any) => !truthy(a),

    // ==========================================
    // Predicados e tipos (R3/E2)
    // ==========================================

    "nil?": (x: any) => x === null || x === undefined,
    "some?": (x: any) => x !== null && x !== undefined,
    "true?": (x: any) => x === true,
    "false?": (x: any) => x === false,
    "boolean?": (x: any) => typeof x === "boolean",
    "number?": (x: any) => typeof x === "number" && !isNaN(x),
    "string?": (x: any) => typeof x === "string",
    "keyword?": (x: any) => x instanceof ClojureKeyword,
    "symbol?": (x: any) => x instanceof ClojureSymbol,
    "fn?": (x: any) => isCallable(x) && !(x instanceof ClojureKeyword),
    "macro?": (x: any) => x instanceof ClojureMacro,
    "map?": (x: any) => x instanceof ClojureMap,
    "vector?": (x: any) => x instanceof ClojureVector,
    "list?": (x: any) => isList(x),
    // Neste subset, vetores NÃO são seqs (assim como em Clojure).
    "seq?": (x: any) => isList(x),
    "coll?": (x: any) => isColl(x),
    "atom?": (x: any) => x instanceof ClojureAtom,
    "zero?": (x: any) => {
        assertNumber(x, "zero?");
        return x === 0;
    },
    "pos?": (x: any) => {
        assertNumber(x, "pos?");
        return x > 0;
    },
    "neg?": (x: any) => {
        assertNumber(x, "neg?");
        return x < 0;
    },
    "even?": (x: any) => {
        assertNumber(x, "even?");
        return x % 2 === 0;
    },
    "odd?": (x: any) => {
        assertNumber(x, "odd?");
        return Math.abs(x % 2) === 1;
    },
    "empty?": (coll: any) => {
        if (coll === null || coll === undefined) return true;
        if (coll instanceof LazySeq) return coll.vazia();
        if (coll instanceof ClojureMap) return coll.size === 0;
        const s = toSeq(coll);
        return s === null ? true : s.length === 0;
    },
    "contains?": (coll: any, key: any) => {
        if (coll === null || coll === undefined) return false;
        if (coll instanceof ClojureMap) return coll.has(key);
        if (Array.isArray(coll) || typeof coll === "string") {
            return typeof key === "number" && key >= 0 && key < coll.length;
        }
        return false;
    },

    // ==========================================
    // String / IO
    // ==========================================

    str: (...args: any[]) => args.map((a) => prStr(a, false)).join(""),
    "pr-str": (...args: any[]) => args.map((a) => prStr(a, true)).join(" "),
    "read-string": (s: any) => {
        if (typeof s !== "string") {
            throw new InvalidParamError("read-string espera uma string");
        }
        const tokens = tokenize(s, "read-string");
        return parse(tokens);
    },

    print: (...args: any[]) => {
        console.log(args.map((a) => prStr(a, false)).join(" "));
        return null;
    },
    println: (...args: any[]) => {
        console.log(args.map((a) => prStr(a, false)).join(" "));
        return null;
    },
    prn: (...args: any[]) => {
        console.log(args.map((a) => prStr(a, true)).join(" "));
        return null;
    },

    // (assert expr) ou (assert expr msg)
    // Função (não macro): a expressão já chega avaliada, por isso a mensagem
    // opcional é o que dá contexto ao erro.
    assert: (value: any, msg?: any) => {
        if (!truthy(value)) {
            throw new ClojureError(
                msg === undefined
                    ? `Assert falhou: ${prStr(value, true)}`
                    : `Assert falhou: ${prStr(msg, false)}`,
            );
        }
        return null;
    },

    // (pprint x) — imprime com quebras de linha quando não cabe na largura
    pprint: (value: any) => {
        console.log(ppStr(value, { width: getPrintLimits().width }));
        return null;
    },

    // (pprint-str x) — o mesmo, mas devolve a string
    "pprint-str": (value: any) =>
        ppStr(value, { width: getPrintLimits().width }),

    // (set-print-width! n) — largura alvo do pprint
    "set-print-width!": (n: any) => {
        if (typeof n !== "number" || n < 1) {
            throw new InvalidParamError(
                "set-print-width! espera um número >= 1",
            );
        }
        setPrintLimits({ width: n });
        return n;
    },

    // (set-print-length! n) — n itens por coleção, ou nil para sem limite
    "set-print-length!": (n: any) => {
        if (n !== null && (typeof n !== "number" || n < 0)) {
            throw new InvalidParamError(
                "set-print-length! espera um número não negativo ou nil",
            );
        }
        setPrintLimits({ length: n });
        return n;
    },

    // (set-print-level! n) — profundidade de aninhamento, ou nil
    "set-print-level!": (n: any) => {
        if (n !== null && (typeof n !== "number" || n < 0)) {
            throw new InvalidParamError(
                "set-print-level! espera um número não negativo ou nil",
            );
        }
        setPrintLimits({ level: n });
        return n;
    },

    // (print-limits) -> {:length n :level n}
    "print-limits": () => {
        const limites = getPrintLimits();
        return new ClojureMap()
            .assoc(new ClojureKeyword(":length"), limites.length)
            .assoc(new ClojureKeyword(":level"), limites.level)
            .assoc(new ClojureKeyword(":width"), limites.width);
    },

    // (slurp path) — Node-only
    slurp: (path: any) => {
        if (typeof path !== "string") {
            throw new InvalidParamError("slurp espera um caminho (string)");
        }
        const host = getHost();
        if (!host.hasFileSystem) {
            throw new ClojureError(
                `slurp não está disponível neste ambiente (host: ${host.name}).`,
            );
        }
        try {
            return host.readFile(path);
        } catch (e: any) {
            throw new ClojureError(
                `slurp: não foi possível ler '${path}': ${e.message}`,
            );
        }
    },

    // (spit path content) — Node-only
    spit: (path: any, content: any) => {
        if (typeof path !== "string") {
            throw new InvalidParamError("spit espera um caminho (string)");
        }
        const host = getHost();
        if (!host.hasFileSystem) {
            throw new ClojureError(
                `spit não está disponível neste ambiente (host: ${host.name}).`,
            );
        }
        try {
            host.writeFile(path, prStr(content, false));
            return null;
        } catch (e: any) {
            throw new ClojureError(
                `spit: não foi possível escrever '${path}': ${e.message}`,
            );
        }
    },

    // ==========================================
    // Coleções
    // ==========================================

    list: (...args: any[]) => args,
    vector: (...args: any[]) => ClojureVector.fromArray(args),
    first: (coll: any) => {
        // Um elemento basta: realizar a sequência inteira travaria numa
        // infinita, e `(first (range))` é justamente um caso de uso.
        if (coll instanceof LazySeq) {
            const [primeiro] = coll.primeiros(1);
            return primeiro === undefined ? null : primeiro;
        }
        const s = toSeq(coll);
        return s && s.length > 0 ? s[0] : null;
    },
    second: (coll: any) => {
        if (coll instanceof LazySeq) {
            const itens = coll.primeiros(2);
            return itens.length > 1 ? itens[1] : null;
        }
        const s = toSeq(coll);
        return s && s.length > 1 ? s[1] : null;
    },
    last: (coll: any) => {
        const s = toSeq(coll);
        return s && s.length > 0 ? s[s.length - 1] : null;
    },
    rest: (coll: any) => {
        // Segue preguiçoso: `(take 2 (rest (range)))` precisa terminar.
        if (coll instanceof LazySeq) {
            return lazy(() => {
                const proximo = coll.cursor();
                let pulou = false;
                return () => {
                    if (!pulou) {
                        pulou = true;
                        if (proximo() === FIM) return FIM;
                    }
                    return proximo();
                };
            });
        }
        const s = toSeq(coll);
        return s && s.length > 0 ? asList(s.slice(1)) : [];
    },
    count: (coll: any) => {
        if (coll === null || coll === undefined) return 0;
        if (coll instanceof ClojureMap) return coll.size;
        const s = toSeq(coll);
        return s === null ? 0 : s.length;
    },
    nth: (coll: any, index: number, notFound?: any) => {
        // Produz só até o índice pedido.
        const s =
            coll instanceof LazySeq
                ? coll.primeiros(Math.max(0, index + 1))
                : toSeq(coll);
        if (s === null)
            throw new InvalidParamError("nth requer uma coleção sequencial");
        if (index < 0 || index >= s.length) {
            if (notFound !== undefined) return notFound;
            throw new InvalidParamError(
                `nth: índice ${index} fora dos limites (tamanho ${s.length})`,
            );
        }
        return s[index];
    },
    cons: (item: any, coll: any) => {
        const s = toSeq(coll);
        return s === null ? [item] : [item, ...s];
    },
    conj: (coll: any, ...items: any[]) => addAll(coll, items),
    concat: (...colls: any[]) => {
        const out: any[] = [];
        for (const c of colls) {
            if (c === null || c === undefined) continue;
            out.push(...seqOrThrow(c, "concat"));
        }
        return out;
    },

    // ==========================================
    // Sequências (R3/E1)
    // ==========================================

    // (map f coll) ou (map f coll1 coll2 ...) — preguiçosa
    map: (f: any, ...colls: any[]) => {
        assertFn(f, "map");
        // Sem coleção, devolve um transdutor.
        if (colls.length === 0) return mapeando(f);

        if (colls.length === 1) {
            const fonte = colls[0];
            return lazy(() => {
                const proximo = pullOuFalhar(fonte, "map");
                return () => {
                    const v = proximo();
                    return v === FIM ? FIM : callFn(f, v);
                };
            });
        }

        // Com várias coleções, para na mais curta.
        return lazy(() => {
            const produtores = colls.map((c) => pullOuFalhar(c, "map"));
            return () => {
                const valores: any[] = [];
                for (const produtor of produtores) {
                    const v = produtor();
                    if (v === FIM) return FIM;
                    valores.push(v);
                }
                return callFn(f, ...valores);
            };
        });
    },

    // (filter pred coll) — preguiçosa
    filter: (pred: any, ...resto: any[]) => {
        assertFn(pred, "filter");
        if (resto.length === 0) return filtrando(pred);
        const coll = resto[0];
        return lazy(() => {
            const proximo = pullOuFalhar(coll, "filter");
            return () => {
                for (;;) {
                    const v = proximo();
                    if (v === FIM) return FIM;
                    if (truthy(callFn(pred, v))) return v;
                }
            };
        });
    },

    // (remove pred coll) — preguiçosa
    remove: (pred: any, ...resto: any[]) => {
        assertFn(pred, "remove");
        if (resto.length === 0) return removendo(pred);
        const coll = resto[0];
        return lazy(() => {
            const proximo = pullOuFalhar(coll, "remove");
            return () => {
                for (;;) {
                    const v = proximo();
                    if (v === FIM) return FIM;
                    if (!truthy(callFn(pred, v))) return v;
                }
            };
        });
    },

    // (take n coll) — preguiçosa; funciona sobre sequência infinita
    take: (n: any, ...resto: any[]) => {
        assertNumber(n, "take");
        if (resto.length === 0) return pegando(n);
        const coll = resto[0];
        return lazy(() => {
            if (n <= 0) return () => FIM;
            const proximo = pullOuFalhar(coll, "take");
            let restam = n;
            return () => (restam-- > 0 ? proximo() : FIM);
        });
    },

    // (drop n coll) — preguiçosa
    drop: (n: any, ...resto: any[]) => {
        assertNumber(n, "drop");
        if (resto.length === 0) return descartando(n);
        const coll = resto[0];
        return lazy(() => {
            const proximo = pullOuFalhar(coll, "drop");
            let pular = n;
            return () => {
                while (pular > 0) {
                    pular--;
                    if (proximo() === FIM) return FIM;
                }
                return proximo();
            };
        });
    },

    // (take-while pred coll) — para no primeiro que falha
    "take-while": (pred: any, ...resto: any[]) => {
        assertFn(pred, "take-while");
        if (resto.length === 0) return pegandoEnquanto(pred);
        const coll = resto[0];
        return lazy(() => {
            const proximo = pullOuFalhar(coll, "take-while");
            let acabou = false;
            return () => {
                if (acabou) return FIM;
                const v = proximo();
                if (v === FIM || !truthy(callFn(pred, v))) {
                    acabou = true;
                    return FIM;
                }
                return v;
            };
        });
    },

    // (drop-while pred coll) — descarta enquanto o predicado valer
    "drop-while": (pred: any, ...resto: any[]) => {
        assertFn(pred, "drop-while");
        if (resto.length === 0) return descartandoEnquanto(pred);
        const coll = resto[0];
        return lazy(() => {
            const proximo = pullOuFalhar(coll, "drop-while");
            let descartando = true;
            return () => {
                for (;;) {
                    const v = proximo();
                    if (v === FIM) return FIM;
                    if (descartando && truthy(callFn(pred, v))) continue;
                    descartando = false;
                    return v;
                }
            };
        });
    },

    // (reduce f coll) ou (reduce f init coll)
    // Respeita `reduced`, para terminação antecipada.
    reduce: (f: any, ...args: any[]) => {
        assertFn(f, "reduce");
        const passo: RF = (acumulador, item) => callFn(f, acumulador, item);

        // Consome sob demanda: com `reduced`, reduzir uma sequência infinita
        // precisa poder terminar.
        if (args.length === 1) {
            const fonte = args[0];
            if (fonte instanceof LazySeq) {
                const [primeiro] = fonte.primeiros(1);
                if (primeiro === undefined && fonte.vazia()) return callFn(f);
                return reduzirFonte(passo, primeiro, rest1(fonte));
            }
            const coll = seqOrThrow(fonte, "reduce");
            if (coll.length === 0) return callFn(f);
            return reduzirFonte(passo, coll[0], coll.slice(1));
        }

        if (args.length === 2) {
            const fonte = args[1];
            return reduzirFonte(
                passo,
                args[0],
                fonte instanceof LazySeq ? fonte : seqOrThrow(fonte, "reduce"),
            );
        }

        throw new InvalidParamError(
            `Número inválido de argumentos para reduce (${args.length + 1})`,
        );
    },

    // (reduced x) — marca o valor como resultado final da redução
    reduced: (x: any) => garantirReduzido(x),
    "reduced?": (x: any) => x instanceof Reduced,
    unreduced: (x: any) => desreduzir(x),

    // (transduce xform f coll) ou (transduce xform f init coll)
    transduce: (xform: any, f: any, ...args: any[]) => {
        assertFn(f, "transduce");
        if (typeof xform !== "function") {
            throw new InvalidParamError(
                "transduce espera um transdutor como primeiro argumento",
            );
        }

        const passo: RF = (acumulador, item) => callFn(f, acumulador, item);
        const reduzido = (xform as Transdutor)(passo);

        if (args.length === 1) {
            return reduzirFonte(
                reduzido,
                callFn(f),
                fonteDe(args[0], "transduce"),
            );
        }
        if (args.length === 2) {
            return reduzirFonte(
                reduzido,
                args[0],
                fonteDe(args[1], "transduce"),
            );
        }

        throw new InvalidParamError(
            "transduce espera (transduce xform f coll) ou (transduce xform f init coll)",
        );
    },

    // (sequence xform coll) — aplica o transdutor preguiçosamente
    sequence: (xform: any, coll: any) => {
        if (typeof xform !== "function") {
            throw new InvalidParamError(
                "sequence espera um transdutor como primeiro argumento",
            );
        }

        return lazy(() => {
            const proximo = pullOuFalhar(coll, "sequence");
            const pendentes: any[] = [];
            const coletar: RF = (acumulador, item) => {
                pendentes.push(item);
                return acumulador;
            };
            const passo = (xform as Transdutor)(coletar);
            let terminou = false;

            return () => {
                for (;;) {
                    if (pendentes.length > 0) return pendentes.shift();
                    if (terminou) return FIM;

                    const valor = proximo();
                    if (valor === FIM) {
                        terminou = true;
                        continue;
                    }
                    if (passo(null, valor) instanceof Reduced) terminou = true;
                }
            };
        });
    },

    // (some pred coll) -> primeiro valor verdadeiro retornado por pred, ou nil
    some: (pred: any, coll: any) => {
        assertFn(pred, "some");
        for (const item of seqOrThrow(coll, "some")) {
            const res = callFn(pred, item);
            if (truthy(res)) return res;
        }
        return null;
    },

    // (every? pred coll)
    "every?": (pred: any, coll: any) => {
        assertFn(pred, "every?");
        for (const item of seqOrThrow(coll, "every?")) {
            if (!truthy(callFn(pred, item))) return false;
        }
        return true;
    },

    // (not-any? pred coll)
    "not-any?": (pred: any, coll: any) => {
        assertFn(pred, "not-any?");
        for (const item of seqOrThrow(coll, "not-any?")) {
            if (truthy(callFn(pred, item))) return false;
        }
        return true;
    },

    // (range) | (range end) | (range start end) | (range start end step)
    // Preguiçosa: (range) sem argumento é infinita.
    range: (...args: any[]) => {
        args.forEach((a) => assertNumber(a, "range"));

        let start = 0;
        let end = Number.POSITIVE_INFINITY;
        let step = 1;

        if (args.length === 1) {
            end = args[0];
        } else if (args.length === 2) {
            start = args[0];
            end = args[1];
        } else if (args.length === 3) {
            start = args[0];
            end = args[1];
            step = args[2];
        } else if (args.length > 3) {
            throw new InvalidParamError(
                `Número inválido de argumentos para range (${args.length})`,
            );
        }

        if (step === 0) {
            throw new InvalidParamError("range: step não pode ser 0");
        }

        return lazy(() => {
            let atual = start;
            return () => {
                if (step > 0 ? atual >= end : atual <= end) return FIM;
                const valor = atual;
                atual += step;
                return valor;
            };
        });
    },

    // (repeat x) infinito | (repeat n x)
    repeat: (...args: any[]) => {
        if (args.length === 1) {
            const [x] = args;
            return lazy(() => () => x);
        }

        if (args.length !== 2) {
            throw new InvalidParamError(
                "repeat espera (repeat x) ou (repeat n x)",
            );
        }

        const [n, x] = args;
        assertNumber(n, "repeat");
        return lazy(() => {
            let restam = n;
            return () => (restam-- > 0 ? x : FIM);
        });
    },

    // (iterate f x) -> x, (f x), (f (f x)), ... — infinita
    iterate: (f: any, x: any) => {
        assertFn(f, "iterate");
        return lazy(() => {
            let atual = x;
            let primeiro = true;
            return () => {
                if (primeiro) {
                    primeiro = false;
                    return atual;
                }
                atual = callFn(f, atual);
                return atual;
            };
        });
    },

    // (cycle coll) — repete a coleção para sempre
    cycle: (coll: any) => {
        return lazy(() => {
            const itens = seqOrThrow(coll, "cycle");
            if (itens.length === 0) return () => FIM;
            let i = 0;
            return () => {
                const valor = itens[i];
                i = (i + 1) % itens.length;
                return valor;
            };
        });
    },

    // (reverse coll)
    reverse: (coll: any) =>
        asList(seqOrThrow(coll, "reverse").slice().reverse()),

    // (seq coll) -> a sequência, ou nil se vazia
    seq: (coll: any) => {
        if (coll instanceof LazySeq) return coll.vazia() ? null : coll;
        const s = toSeq(coll);
        if (s === null) {
            if (coll === null || coll === undefined) return null;
            throw new InvalidParamError(
                `Erro em 'seq': esperava uma coleção, recebeu ${prStr(coll)}`,
            );
        }
        return s.length > 0 ? asList(s) : null;
    },

    // (into to from) — preserva o tipo de `to`
    // (into to from) ou (into to xform from)
    into: (to: any, ...args: any[]) => {
        if (args.length === 1) {
            const from = args[0];
            if (from === null || from === undefined) return to;
            return addAll(to, seqOrThrow(from, "into"));
        }

        if (args.length !== 2) {
            throw new InvalidParamError(
                "into espera (into to from) ou (into to xform from)",
            );
        }

        const [xform, from] = args;
        if (typeof xform !== "function") {
            throw new InvalidParamError(
                "into com três argumentos espera um transdutor no meio",
            );
        }
        if (from === null || from === undefined) return to;

        // Constrói direto, sem materializar a sequência intermediária.
        const passo: RF = (acumulador, item) => addAll(acumulador, [item]);
        return reduzirFonte(
            (xform as Transdutor)(passo),
            to,
            fonteDe(from, "into"),
        );
    },

    // ==========================================
    // Helpers funcionais (R3/E1)
    // ==========================================

    identity: (x: any) => (x === undefined ? null : x),

    // (apply f args) ou (apply f x y ... args)
    apply: (f: any, ...args: any[]) => {
        assertFn(f, "apply");
        if (args.length === 0) {
            throw new InvalidParamError(
                "apply requer uma sequência como último argumento",
            );
        }
        const tail = seqOrThrow(args[args.length - 1], "apply");
        return callFn(f, ...args.slice(0, -1), ...tail);
    },

    // (comp f g h) -> (fn [& args] (f (g (apply h args))))
    comp: (...fns: any[]) => {
        if (fns.length === 0) return (x: any) => (x === undefined ? null : x);
        fns.forEach((f) => assertFn(f, "comp"));
        return (...args: any[]) => {
            let result = callFn(fns[fns.length - 1], ...args);
            for (let i = fns.length - 2; i >= 0; i--) {
                result = callFn(fns[i], result);
            }
            return result;
        };
    },

    // (partial f arg1 arg2 ...)
    partial: (f: any, ...fixedArgs: any[]) => {
        assertFn(f, "partial");
        return (...rest: any[]) => callFn(f, ...fixedArgs, ...rest);
    },

    // ==========================================
    // Mapas
    // ==========================================

    "hash-map": (...args: any[]) => {
        if (args.length % 2 !== 0) {
            throw new InvalidParamError(
                "hash-map requer um número par de argumentos",
            );
        }
        let map = new ClojureMap();
        for (let i = 0; i < args.length; i += 2) {
            map = map.assoc(args[i], args[i + 1]);
        }
        return map;
    },
    get: (coll: any, key: any, notFound: any = null) =>
        lookup(coll, key, notFound),
    assoc: (coll: any, ...args: any[]) => {
        if (args.length === 0 || args.length % 2 !== 0) {
            throw new InvalidParamError("assoc requer pares chave/valor");
        }
        let out = coll;
        for (let i = 0; i < args.length; i += 2) {
            out = assocOne(out, args[i], args[i + 1]);
        }
        return out;
    },
    dissoc: (map: any, ...keys: any[]) => {
        if (map === null || map === undefined) return null;
        if (!(map instanceof ClojureMap)) {
            throw new InvalidParamError("dissoc requer um mapa");
        }
        return keys.reduce((acc, k) => acc.dissoc(k), map);
    },
    keys: (map: any) => {
        if (!(map instanceof ClojureMap)) return null;
        return map.size === 0 ? null : map.keys();
    },
    vals: (map: any) => {
        if (!(map instanceof ClojureMap)) return null;
        return map.size === 0 ? null : map.values();
    },
    merge: (...maps: any[]) => {
        let out: ClojureMap | null = null;
        for (const m of maps) {
            if (m === null || m === undefined) continue;
            if (!(m instanceof ClojureMap)) {
                throw new InvalidParamError(
                    `merge requer mapas, recebeu ${prStr(m)}`,
                );
            }
            if (out === null) {
                out = m;
                continue;
            }
            for (const [k, v] of m) out = out.assoc(k, v);
        }
        return out;
    },

    // (update m k f & args)
    update: (coll: any, key: any, f: any, ...args: any[]) => {
        assertFn(f, "update");
        const current = lookup(coll, key, null);
        return assocOne(coll, key, callFn(f, current, ...args));
    },

    // (get-in m [k1 k2] notFound?)
    "get-in": (coll: any, path: any, notFound: any = null) =>
        getIn(coll, seqOrThrow(path, "get-in"), notFound),

    // (assoc-in m [k1 k2] v)
    "assoc-in": (coll: any, path: any, val: any) => {
        const ks = seqOrThrow(path, "assoc-in");
        if (ks.length === 0) {
            throw new InvalidParamError("assoc-in requer um caminho não vazio");
        }
        return assocIn(coll, ks, val);
    },

    // (update-in m [k1 k2] f & args)
    "update-in": (coll: any, path: any, f: any, ...args: any[]) => {
        assertFn(f, "update-in");
        const ks = seqOrThrow(path, "update-in");
        if (ks.length === 0) {
            throw new InvalidParamError(
                "update-in requer um caminho não vazio",
            );
        }
        const current = getIn(coll, ks, null);
        return assocIn(coll, ks, callFn(f, current, ...args));
    },

    // ==========================================
    // Interop & Atoms
    // ==========================================

    // Interop. A política é aplicada por `createGlobalEnv`, que substitui
    // estas entradas por versões restritas quando o sandbox está ligado.
    new: (ClassRef: any, ...args: any[]) =>
        construct(OPEN_POLICY, ClassRef, args),

    // (. membro alvo & args) — propriedade se não for função, chamada se for.
    ".": (member: any, target: any, ...args: any[]) =>
        accessMember(OPEN_POLICY, member, target, args),

    // (.- membro alvo) — propriedade SEM chamar, mesmo sendo função.
    ".-": (member: any, target: any) =>
        readProperty(OPEN_POLICY, member, target),

    atom: (val: any) => new ClojureAtom(val),
    deref: (atm: any) => {
        if (!(atm instanceof ClojureAtom))
            throw new InvalidParamError("deref requer um átomo");
        return atm.value;
    },
    "reset!": (atm: any, newVal: any) => {
        if (!(atm instanceof ClojureAtom))
            throw new InvalidParamError("reset! requer um átomo");
        atm.value = newVal;
        return newVal;
    },
    "swap!": (atm: any, f: any, ...args: any[]) => {
        if (!(atm instanceof ClojureAtom))
            throw new InvalidParamError("swap! requer um átomo");
        assertFn(f, "swap!");
        atm.value = callFn(f, atm.value, ...args);
        return atm.value;
    },
    throw: (msg: any) => {
        throw new ClojureError(prStr(msg, false));
    },

    true: true,
    false: false,
    nil: null,
};

function compareChain(
    args: any[],
    op: string,
    cmp: (a: any, b: any) => boolean,
): boolean {
    if (args.length < 2) {
        if (args.length === 1) {
            assertNumber(args[0], op);
            return true;
        }
        throw new InvalidParamError(`'${op}' requer ao menos 1 argumento`);
    }
    args.forEach((a) => assertNumber(a, op));
    for (let i = 1; i < args.length; i++) {
        if (!cmp(args[i - 1], args[i])) return false;
    }
    return true;
}
