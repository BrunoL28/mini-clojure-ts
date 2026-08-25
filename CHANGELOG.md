# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e o versionamento segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Não lançado]

## [1.2.0] — 2026-08-25

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

## [1.1.0] — 2026-08-25

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

## [1.0.0]

Releases **R1 — Fundação de Produto** e **R2 — Semântica e tipos**:
posições e erros com linha/coluna, harness de testes, CI, API pública,
REPL com multiline e histórico, igualdade estrutural, `pr-str`/`read-string`,
escapes do reader, destructuring de mapas e ferramentas de macro.

[não lançado]: https://github.com/BrunoL28/mini-clojure-ts/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/BrunoL28/mini-clojure-ts/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/BrunoL28/mini-clojure-ts/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/BrunoL28/mini-clojure-ts/releases/tag/v1.0.0
[#12]: https://github.com/BrunoL28/mini-clojure-ts/issues/12
[#13]: https://github.com/BrunoL28/mini-clojure-ts/issues/13
[#14]: https://github.com/BrunoL28/mini-clojure-ts/issues/14
[#15]: https://github.com/BrunoL28/mini-clojure-ts/issues/15
[#16]: https://github.com/BrunoL28/mini-clojure-ts/issues/16
[#17]: https://github.com/BrunoL28/mini-clojure-ts/issues/17
[#18]: https://github.com/BrunoL28/mini-clojure-ts/issues/18
