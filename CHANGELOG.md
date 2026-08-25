# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e o versionamento segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Não lançado]

## [7.0.0] — 2026-08-25

Primeira parte do **R5 — Compilador de verdade**. O transpilador deixou de ser
um demo: agora existe um pipeline real e **paridade verificada** com o
interpretador.

### Adicionado

- **Pipeline de compilação** ([#19], [#21]): parse → macroexpand → desugar →
  coleta de globais → codegen, em `src/core/Compiler.ts`.
- **Runtime de suporte** ([#20]) em `src/runtime/`, publicado no subpath
  `mini-clojure-ts/runtime`. **Reusa a stdlib do interpretador** em vez de
  manter uma segunda implementação em JS — é o que torna a paridade real.
- **Paridade de formas** ([#19]): `let` (com destructuring de sequência e de
  mapa, incluindo `:keys`, `:as`, `:or` e renomeação), mapas `{}`, keywords,
  `try/catch`, atoms, `and`/`or` com short-circuit, `cond`, `when`, `when-not`,
  `->`, `->>`, `defn`, `quote` e `quasiquote`.
- **Macros em compile-time** ([#21]): `defmacro` é executado durante a
  compilação e não gera código; as chamadas expandem antes do codegen,
  recursivamente.
- `compileSource` aceita `runtimeImport` e `emitImport`.
- Novo **[`docs/compiler.md`](docs/compiler.md)** com o pipeline, a decisão
  sobre `quote`/`quasiquote` e a tabela de divergências.

### Modificado

- **O formato do JavaScript gerado mudou por completo** (por isso a major).
  O código emitido é um módulo ESM que importa o runtime.
- **`globalThis` eliminado** ([#20]): cada `def` vira um `let` no escopo do
  módulo.
- `if` passa a usar a truthiness de Clojure (`$rt.truthy`), então `0` e `""`
  são verdadeiros no compilado, como já eram no interpretado.
- Conversão de nomes agora escapa **palavras reservadas do JavaScript**
  (`throw` → `$throw`) e qualquer caractere inválido em identificador.
- Um `def` que sombreia a stdlib passa a ser declarado uma única vez — antes
  geraria `const` e `let` para o mesmo nome, que é `SyntaxError`.
- `tests/compilador.clj` corrigido: usava `(. log js/console ...)`, forma que o
  `.` nunca aceitou. Com `(. "log" js/console ...)` o arquivo passa a rodar
  **interpretado**, o que nunca tinha acontecido.

### Removido

- `src/core/Transpiler.ts`, substituído por `src/core/Compiler.ts`.
- `runtimeScript` de `src/core/Runtime.ts` — o runtime inline em string foi
  substituído pelo módulo `src/runtime/`.

### Divergências documentadas

`require`, `load-file`, `macroexpand` e `macroexpand-1` **não** são suportados
no código compilado e falham na compilação com mensagem explícita. A lista
completa está em [`docs/compiler.md`](docs/compiler.md).

## [6.0.1] — 2026-08-25

### Corrigido

- **Transpilador emitia literal de string como identificador** ([#38]). A guarda
  `ast.startsWith('"')` pressupunha que o literal ainda carregava as aspas do
  fonte, mas o `Parser` faz `JSON.parse` nos literais — então toda string caía
  na mangling de identificador e saía sem aspas e com `-` virando `_`:
  `(print "--- oi ---")` gerava `console.log(___ oi ___)`, um JS que nem parseia.
  Como identificadores hoje são `ClojureSymbol`, uma `string` crua no AST só pode
  ser um literal, e agora é emitida com `JSON.stringify`.
- `if` sem ramo `else` passa a emitir `null` de verdade — antes dependia do
  comportamento acidental acima para converter a string `"null"` em identificador.
- Parâmetros de `fn` passam a usar a mesma mangling dos símbolos do corpo:
  `(fn [ok?] ok?)` gerava o parâmetro inválido `ok?` enquanto o corpo usava `ok$q`.
- `tests/compilador.js` deixou de ser versionado. O artefato commitado era
  anterior ao bug e mascarava a quebra — quem olhasse o repo via a saída
  correta, enquanto o transpilador gerava JS inválido. É saída de build,
  regenerável com `mini-clj -t tests/compilador.clj`, e o comportamento agora
  é coberto por teste que executa o JS gerado num contexto isolado.

## [6.0.0] — 2026-08-25

Release **R4 — Módulos e empacotamento**.

### Adicionado

- **Sistema de módulos** ([#16], [#17]) — política: **um `Env` por módulo, exposto por alias**.
    - `(require "./math.clj" :as math)` carrega o módulo em ambiente isolado e o
      expõe pelo alias; símbolos `alias/membro` (`math/soma`) resolvem no módulo.
    - `(require "./math.clj")` sem `:as` traz os nomes públicos para o env atual.
    - **Cache:** um mesmo arquivo é executado no máximo uma vez por sessão.
    - **Isolamento:** `def` de um módulo não vaza para quem o requer, e o alias
      não expõe símbolos herdados da stdlib.
    - Caminhos relativos resolvem a partir do **arquivo que está requerendo**;
      a extensão `.clj` é opcional. Ciclos de `require` são detectados.
    - `(load-file "./setup.clj")` executa no **env atual** e **sempre reexecuta**.
    - Var dinâmica `*file*` com o arquivo em execução.
    - Decisão de [#17]: **sem `ns`/`in-ns`** — `require` + alias cobre o caso de uso.
- **CLI completa** ([#18]): `-e/--eval`, `-f/--file`, `-t/--transpile`,
  `-o/--out`, `--repl`, `-h/--help`, `-v/--version`.
- **Empacotamento** ([#18]): `bin` (`mini-clj`), entrypoint ESM com tipos
  (`exports`/`types`), `files`, `engines` e build em `dist/`.
- Script `pnpm typecheck`, que checa `src` **e** `tests`.

### Modificado

- `pnpm build` passa a emitir em `dist/` (antes emitia ao lado dos fontes).
- `runFile` resolve o caminho absoluto e publica `*file*` no ambiente.
- `-t` passa a aceitar `-o` e cria o diretório de saída quando necessário.
- O banner do REPL passa a mostrar a versão real do pacote.

## [5.0.0] — 2026-08-25

Release **R3 — Stdlib/Core**.

### Adicionado

- **Funções de sequência** ([#12]): `reduce`, `filter`, `remove`, `some`,
  `every?`, `not-any?`, `take`, `drop`, `range`, `repeat`, `reverse`, `seq`,
  `into`, `apply`, `comp`, `partial`, `identity`.
- **Funções de mapa** ([#12]): `contains?`, `merge`, `update`, `get-in`,
  `assoc-in`, `update-in`.
- **Aritmética** ([#12]): `rem`, `mod`, `quot`, `inc`, `dec`, `max`, `min`,
  `abs`, `last`. `+ - * /` e as comparações passaram a ser variádicas.
- **Predicados** ([#13]): `map?`, `seq?`, `list?`, `keyword?`, `symbol?`,
  `number?`, `string?`, `fn?`, `nil?`, `some?`, `boolean?`, `true?`, `false?`,
  `coll?`, `macro?`, `zero?`, `pos?`, `neg?`, `even?`, `odd?`.
- **Macros utilitárias** ([#14]), como formas especiais com short-circuit:
  `when`, `when-not`, `and`, `or`, `cond`, `->`, `->>`.
- **IO/util** ([#15]): `assert`, `time`, `slurp` e `spit` (os dois últimos Node-only).
- `docs/stdlib.md` com a referência completa do core.

### Corrigido

- Funções de ordem superior da stdlib quebravam ao receber funções de usuário
  (`fn`/`defn`), que são objetos `{params, body, env}` e não funções JS.
  Introduzido `callFn` (`src/core/Invoke.ts`) para invocação uniforme.
- `ClojureVector` estende `Array`, então `new ClojureVector(5)` caía no
  construtor `Array(length)`: `[1]` imprimia `[]`, `(vector 5)` gerava cinco
  buracos e `(conj [] 1)` devolvia `[nil]`. Corrigido com `ClojureVector.of()`.
- Funções de sequência devolviam `ClojureVector` por herança de espécie, então
  `(seq? (filter ...))` era `false`. Agora devolvem listas, como em Clojure.

## Versões anteriores

Este changelog começa na `5.0.0`. As versões anteriores estão documentadas nas
[releases do GitHub](https://github.com/BrunoL28/mini-clojure-ts/releases):

| Versão   | Marco                                                                   |
| -------- | ----------------------------------------------------------------------- |
| [4.1.0]  | **R2** — mapas persistentes (HAMT), destructuring de mapas, macroexpand |
| [v3.0.0] | **R1** — erros com linha/coluna, CI, API pública, REPL                  |
| [v2.0.0] | Performance nativa                                                      |
| [v1.3.0] | Elegant Code                                                            |
| [v1.2.0] | Safety Net                                                              |
| [v1.1.0] | State & Safety                                                          |
| [v1.0.0] | Metaprogramação e TCO                                                   |

> **Nota sobre versionamento:** o `package.json` ficou parado em `1.0.0` enquanto
> as tags avançavam até `4.1.0`. A partir da `5.0.0` ele acompanha as releases.
> A numeração segue a convenção do roadmap no README: uma major por milestone
> (R3 → 5.0.0, R4 → 6.0.0).

[não lançado]: https://github.com/BrunoL28/mini-clojure-ts/compare/v7.0.0...HEAD
[7.0.0]: https://github.com/BrunoL28/mini-clojure-ts/compare/v6.0.1...v7.0.0
[6.0.1]: https://github.com/BrunoL28/mini-clojure-ts/compare/v6.0.0...v6.0.1
[6.0.0]: https://github.com/BrunoL28/mini-clojure-ts/compare/v5.0.0...v6.0.0
[5.0.0]: https://github.com/BrunoL28/mini-clojure-ts/compare/4.1.0...v5.0.0
[4.1.0]: https://github.com/BrunoL28/mini-clojure-ts/releases/tag/4.1.0
[v3.0.0]: https://github.com/BrunoL28/mini-clojure-ts/releases/tag/v3.0.0
[v2.0.0]: https://github.com/BrunoL28/mini-clojure-ts/releases/tag/v2.0.0
[v1.3.0]: https://github.com/BrunoL28/mini-clojure-ts/releases/tag/v1.3.0
[v1.2.0]: https://github.com/BrunoL28/mini-clojure-ts/releases/tag/v1.2.0
[v1.1.0]: https://github.com/BrunoL28/mini-clojure-ts/releases/tag/v1.1.0
[v1.0.0]: https://github.com/BrunoL28/mini-clojure-ts/releases/tag/v1.0.0
[#12]: https://github.com/BrunoL28/mini-clojure-ts/issues/12
[#13]: https://github.com/BrunoL28/mini-clojure-ts/issues/13
[#14]: https://github.com/BrunoL28/mini-clojure-ts/issues/14
[#15]: https://github.com/BrunoL28/mini-clojure-ts/issues/15
[#16]: https://github.com/BrunoL28/mini-clojure-ts/issues/16
[#17]: https://github.com/BrunoL28/mini-clojure-ts/issues/17
[#18]: https://github.com/BrunoL28/mini-clojure-ts/issues/18
[#19]: https://github.com/BrunoL28/mini-clojure-ts/issues/19
[#20]: https://github.com/BrunoL28/mini-clojure-ts/issues/20
[#21]: https://github.com/BrunoL28/mini-clojure-ts/issues/21
[#38]: https://github.com/BrunoL28/mini-clojure-ts/issues/38
