# Compilador — Mini-Clojure-TS

O compilador transforma um arquivo `.clj` num **módulo ESM** que importa um
runtime e roda no Node. Ele deixou de ser um demo de transpilação e passou a ter
**paridade verificada** com o interpretador ([#19], [#20], [#21]).

```sh
mini-clj -t app.clj -o build/app.js
node build/app.js
```

---

## Pipeline

```
fonte .clj
   │
   ├─ 1. parse ................ tokens → AST (Tokenizer + Parser)
   ├─ 2. macroexpand .......... registra `defmacro` e expande tudo (#21)
   ├─ 3. desugar .............. defn/when/when-not/cond/->/->> → núcleo
   ├─ 4. coleta de globais .... descobre todos os `def` antes do codegen
   └─ 5. codegen .............. núcleo → JavaScript + preâmbulo
```

O **núcleo** que o codegen precisa conhecer é pequeno: `def`, `if`, `do`, `fn`,
`let`, `try`, `and`, `or`, `quote`, `quasiquote`. Todo o resto é reescrito na
fase de desaçúcar.

---

## Runtime ([#20])

O JS gerado importa `mini-clojure-ts/runtime`:

```js
// Gerado por Mini-Clojure-TS. Não edite à mão.
import * as $rt from "mini-clojure-ts/runtime";

// Funções da stdlib usadas por este módulo.
const $plus = $rt.core["+"];
const println = $rt.core["println"];

let total;

total = $plus(1, 2);
println("total:", total);
```

> **A decisão de design mais importante:** o runtime **reusa a stdlib do
> interpretador** (`initialConfig`) em vez de manter uma segunda implementação
> em JavaScript. É isso que faz a paridade ser real e não aspiracional — não
> existem duas listas de funções para manter em sincronia. Como funções
> compiladas são funções JS de verdade, e a stdlib já sabe invocar tanto essas
> quanto as do interpretador, ela funciona sem adaptação.

O runtime também fornece os construtores que preservam a semântica:

| Símbolo                                                  | Papel                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| `$rt.core`                                               | A stdlib, indexada pelo nome original (`every?`, `assoc-in`) |
| `$rt.kw(":a")`                                           | Keyword **internada**                                        |
| `$rt.vec([...])`                                         | Vetor (`ClojureVector`)                                      |
| `$rt.map([k,v,...])`                                     | Mapa persistente (HAMT)                                      |
| `$rt.list([...])`                                        | Lista                                                        |
| `$rt.sym("a")`                                           | Símbolo (usado por `quote`)                                  |
| `$rt.truthy(x)`                                          | Truthiness de Clojure — `0` e `""` são **verdadeiros**       |
| `$rt.call(f, ...)`                                       | Chamada genérica, cobre keyword-como-função                  |
| `$rt.nth_` / `$rt.restFrom` / `$rt.getKw` / `$rt.getKey` | Destructuring                                                |
| `$rt.errMsg(e)`                                          | Liga a **mensagem** do erro no `catch`, como o interpretador |

**Sem `globalThis`.** Cada `def` vira um `let` no escopo do módulo.

---

## Nomes

Identificadores do Mini-Clojure não são identificadores válidos em JavaScript,
então passam por uma conversão:

| Origem  | Vira        |     | Origem | Vira    |
| ------- | ----------- | --- | ------ | ------- |
| `-`     | `_`         |     | `=`    | `$eq`   |
| `?`     | `$q`        |     | `+`    | `$plus` |
| `!`     | `$b`        |     | `/`    | `$div`  |
| `*`     | `$s`        |     | `%`    | `$pct`  |
| `<` `>` | `$lt` `$gt` |     | `.`    | `$dot`  |

Nomes que colidem com **palavras reservadas do JavaScript** ganham um `$` na
frente: `throw` → `$throw`, `new` → `$new`. Qualquer caractere restante que não
sirva num identificador vira `$`.

> **Cuidado histórico:** essa conversão vale **só para identificadores**.
> Aplicá-la a literais de string foi exatamente o bug [#38], que gerava
> `console.log(___ oi ___)` — JavaScript que nem parseia.

---

## Macros em compile-time ([#21])

`defmacro` é executado **durante a compilação**, num ambiente de compile-time, e
**não gera código**. As chamadas da macro são expandidas antes do codegen:

```clojure
(defmacro unless (p a b) `(if (not ~p) ~a ~b))
(println (unless false :sim :nao))
```

```js
println($rt.truthy($not(false)) ? $rt.kw(":sim") : $rt.kw(":nao"));
```

A expansão é recursiva e de fora para dentro, então macros que expandem para
outras macros funcionam. Erros durante a expansão carregam a `loc` da forma.

---

## Decisão: `quote` e `quasiquote` são **compile-time only**

Formas citadas são **serializadas em construtores do runtime durante a
compilação**. Não existe leitor (reader) no código gerado:

```clojure
(quote (a [1 :b]))
```

```js
$rt.list([$rt.sym("a"), $rt.vec([1, $rt.kw(":b")])]);
```

Consequência: `quasiquote` com `unquote` funciona (o `~x` vira o código
compilado de `x`), mas **não há como construir formas novas a partir de strings
em runtime** — para isso é preciso o interpretador.

---

## Divergências conhecidas

| Forma                             | Interpretado | Compilado             | Motivo                                                     |
| --------------------------------- | ------------ | --------------------- | ---------------------------------------------------------- |
| `require` / `load-file`           | ✅           | ❌ erro de compilação | Módulos compilados são assunto de [#22]                    |
| `macroexpand` / `macroexpand-1`   | ✅           | ❌ erro de compilação | Introspecção em runtime exige o interpretador              |
| `defmacro`                        | runtime      | compile-time          | Não gera código; a macro só existe durante a compilação    |
| Macro que chama função do arquivo | ✅           | ❌                    | Só `defmacro` é avaliado em compile-time; `def`/`defn` não |
| `time`                            | stdlib       | inline                | Gera `performance.now()` direto, sem passar pelo runtime   |

Formas não suportadas **falham na compilação com mensagem explícita**, nunca
silenciosamente.

Fora isso, a paridade é verificada: `tests/integration/compiler-parity.test.ts`
roda dezenas de programas **interpretados e compilados** e exige saída
idêntica. Qualquer divergência quebra o CI.

---

## Ainda não implementado

Estes itens são o restante do R5:

- **[#22]** targets `esm` / `cjs` / `iife` (hoje só ESM) e `--out-dir`
- **[#23]** source maps
- **[#24]** modo `--watch`

[#19]: https://github.com/BrunoL28/mini-clojure-ts/issues/19
[#20]: https://github.com/BrunoL28/mini-clojure-ts/issues/20
[#21]: https://github.com/BrunoL28/mini-clojure-ts/issues/21
[#22]: https://github.com/BrunoL28/mini-clojure-ts/issues/22
[#23]: https://github.com/BrunoL28/mini-clojure-ts/issues/23
[#24]: https://github.com/BrunoL28/mini-clojure-ts/issues/24
[#38]: https://github.com/BrunoL28/mini-clojure-ts/issues/38
