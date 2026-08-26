<div id="top">

<div align="center">

# MINI-CLOJURE-TS

<em>Um interpretador e transpilador de Clojure robusto e modular escrito em TypeScript.</em>

[![CI](https://github.com/BrunoL28/mini-clojure-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/BrunoL28/mini-clojure-ts/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/BrunoL28/mini-clojure-ts?style=default&logo=opensourceinitiative&logoColor=white&color=A931EC)](https://github.com/BrunoL28/mini-clojure-ts/blob/master/LICENSE)
[![last-commit](https://img.shields.io/github/last-commit/BrunoL28/mini-clojure-ts?style=default&logo=git&logoColor=white&color=A931EC)](https://github.com/BrunoL28/mini-clojure-ts/commits/master)
[![repo-top-language](https://img.shields.io/github/languages/top/BrunoL28/mini-clojure-ts?style=default&color=A931EC)](https://github.com/BrunoL28/mini-clojure-ts)
[![repo-language-count](https://img.shields.io/github/languages/count/BrunoL28/mini-clojure-ts?style=default&color=A931EC)](https://github.com/BrunoL28/mini-clojure-ts)

</div>

---

## Table of Contents

<details>
<summary>Table of Contents</summary>

- [Overview](#overview)
- [Features](#features)
- [Project Structure](#project-structure)
- [Project Index](#project-index)
- [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Usage](#usage)
    - [Testing](#testing)
- [Documentação](#documentação)
- [Biblioteca Padrão](#biblioteca-padrão)
- [Módulos](#módulos)
- [Compilador](#compilador)
- [Interop e Sandbox](#interop-e-sandbox)
- [No Browser](#no-browser)
- [Desempenho e Limites](#desempenho-e-limites)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

</details>

---

## Overview

**Mini-Clojure-TS** é um interpretador e transpilador de Lisp moderno inspirado em Clojure, construído inteiramente em TypeScript. Este projeto foi desenvolvido com foco em arquitetura modular, performance e extensibilidade. Ele suporta recursos avançados como otimização de chamada de cauda (TCO), metaprogramação via Macros, interoperabilidade direta com JavaScript e agora também transpilação para código JavaScript executável.

---

## Features

|     | Componente                    | Detalhes                                                                                                                                                                                                                                                   |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ⚙️  | **Arquitetura**               | <ul><li>Design modular que separa Tokenizador, Analisador Sintático, Avaliador, Ambiente e Transpilador</li><li>Sistema de tratamento de erros tipado com classes de erro personalizadas</li><li>Separação clara da Biblioteca Padrão (`stdlib`)</li></ul> |
| ⚡️  | **Desempenho**                | <ul><li>**Otimização de Chamada de Cauda (TCO):** Implementa a técnica de Trampolim para lidar com recursão infinita sem estouro de pilha</li><li>Processamento e avaliação eficientes da AST</li></ul>                                                    |
| 🧠  | **Metaprogramação**           | <ul><li>Suporte completo a macros (`defmacro`, `quasiquote`, `unquote`)</li><li>Expansão de macros em tempo de execução</li><li>Capacidade de estender a sintaxe da linguagem dinamicamente</li></ul>                                                      |
| 🌐  | **Interoperabilidade com JS** | <ul><li>Acesso direto a `globalThis` via `js/Namespace`</li><li>Instanciação de classes JS (`new`)</li><li>Encadeamento de métodos e acesso a propriedades (operador `.`)</li></ul>                                                                        |
| 📦  | **Estruturas de Dados**       | <ul><li>Suporte para listas `()`, vetores `[]` e mapas de hash `{}`</li><li>Palavras-chave (`:key`), átomos (estado mutável) e tipos primitivos</li><li>Operações no estilo imutável via funções da `stdlib`</li></ul>                                     |
| 🛡️  | **Tratamento de Erros**       | <ul><li>Tratamento de exceções Try/Catch</li><li>Tipos de erro personalizados (`ClojureError`, `InvalidParamError`, `ClojureReferenceError`)</li><li>Relatórios de erro detalhados com contexto</li></ul>                                                  |
| 🔄  | **Gerenciamento de Estado**   | <ul><li>Átomos para estado mutável com `atom`, `deref`, `reset!`, `swap!`</li><li>Atualizações de estado thread-safe</li></ul>                                                                                                                             |
| 🎯  | **Desestruturação**           | <ul><li>Suporte completo à desestruturação em vinculações `let` e parâmetros de função</li><li>Suporte para parâmetros rest `&`</li><li>Padrões de desestruturação aninhados</li></ul>                                                                     |
| ⚙️  | **Transpilador**              | <ul><li>Compila código Clojure para JavaScript executável</li><li>Suporte à transpilação pela linha de comando</li><li>Gera código JS limpo e executável</li></ul>                                                                                         |
| 💻  | **REPL**                      | <ul><li>Loop interativo de leitura-avaliação-impressão com realce de sintaxe</li><li>Estado de ambiente persistente</li><li>Relatório de erros detalhado</li></ul>                                                                                         |

---

## Project Structure

```sh
└── mini-clojure-ts/
    ├── .github
    │   └── workflows
    ├── src/
    │   ├── core/
    │   │   ├── Environment.ts
    │   │   ├── Evaluator.ts
    │   │   ├── Parser.ts
    │   │   ├── Tokenizer.ts
    │   │   ├── Trampoline.ts
    │   │   └── Transpiler.ts
    │   ├── errors/
    │   │   ├── ClojureError.ts
    │   │   ├── InvalidParamError.ts
    │   │   └── ReferenceError.ts
    │   ├── stdlib/
    │   │   └── index.ts
    │   ├── types/
    │   │   └── index.ts
    │   └── index.ts
    ├── tests/
    │   ├── atomos.clj
    │   ├── compilador.clj
    │   ├── destructuring.clj
    │   ├── erros.clj
    │   ├── estouro.clj
    │   ├── filtro.clj
    │   ├── final.clj
    │   ├── interop.clj
    │   ├── listas.clj
    │   ├── macros.clj
    │   ├── main.clj
    │   ├── map.clj
    │   ├── multiplo.clj
    │   └── soma.clj
    ├── README.md
    ├── LICENSE
    ├── package.json
    ├── tsconfig.json
    ├── .eslintrc.json
    ├── .prettierrc
    └── pnpm-lock.yaml
```

### Project Index

<details open>
<summary><b><code>MINI-CLOJURE-TS/</code></b></summary>
<details>
<summary><b>src</b></summary>
<blockquote>
<div class='directory-path' style='padding: 8px 0; color: #666;'>
<code><b>⦿ src</b></code>
<table style='width: 100%; border-collapse: collapse;'>
<thead>
<tr style='background-color: #f8f9fa;'>
<th style='width: 30%; text-align: left; padding: 8px;'>File Name</th>
<th style='text-align: left; padding: 8px;'>Summary</th>
</tr>
</thead>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b><a href='https://github.com/BrunoL28/mini-clojure-ts/blob/master/src/index.ts'>index.ts</a></b></td>
<td style='padding: 8px;'>- Ponto de entrada principal da aplicação<br>- Gerencia argumentos CLI para executar arquivos, iniciar REPL ou transpilar código<br>- Implementa REPL interativo com highlighting de sintaxe<br>- Suporte a transpilação para JavaScript</td>
</tr>
</table>
<details>
<summary><b>core</b></summary>
<blockquote>
<div class='directory-path' style='padding: 8px 0; color: #666;'>
<code><b>⦿ src.core</b></code>
<table style='width: 100%; border-collapse: collapse;'>
<thead>
<tr style='background-color: #f8f9fa;'>
<th style='width: 30%; text-align: left; padding: 8px;'>File Name</th>
<th style='text-align: left; padding: 8px;'>Summary</th>
</tr>
</thead>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>Environment.ts</b></td>
<td style='padding: 8px;'>- Gerencia escopo de variáveis e closures<br>- Implementa cadeia de escopos (scope chain)<br>- Suporte a destructuring em bindings</td>
</tr>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>Evaluator.ts</b></td>
<td style='padding: 8px;'>- Cérebro do interpretador<br>- Processa AST, lida com forms especiais (`def`, `if`, `fn`, `let`, `try/catch`)<br>- Expansão de macros e execução de código<br>- Suporte a destructuring e TCO</td>
</tr>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>Parser.ts</b></td>
<td style='padding: 8px;'>- Converte tokens em Abstract Syntax Tree (AST)<br>- Lida com estruturas recursivas (Lists, Vectors, Maps)<br>- Suporte a reader macros (`'`, `` ` ``, `~`, `@`)</td>
</tr>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>Tokenizer.ts</b></td>
<td style='padding: 8px;'>- Análise léxica usando Regex<br>- Lida com comentários, strings, símbolos e caracteres especiais<br>- Suporte a keywords e números</td>
</tr>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>Trampoline.ts</b></td>
<td style='padding: 8px;'>- Implementa padrão Trampoline para Tail Call Optimization (TCO)<br>- Permite recursão infinita sem stack overflow</td>
</tr>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>Transpiler.ts</b></td>
<td style='padding: 8px;'>- <strong>NOVO:</strong> Compila AST Clojure para código JavaScript executável<br>- Suporte a forms básicos, funções, condicionais e interop JS<br>- Gera código limpo e otimizado</td>
</tr>
</table>
</blockquote>
</details>
<details>
<summary><b>errors</b></summary>
<blockquote>
<div class='directory-path' style='padding: 8px 0; color: #666;'>
<code><b>⦿ src.errors</b></code>
<table style='width: 100%; border-collapse: collapse;'>
<thead>
<tr style='background-color: #f8f9fa;'>
<th style='width: 30%; text-align: left; padding: 8px;'>File Name</th>
<th style='text-align: left; padding: 8px;'>Summary</th>
</tr>
</thead>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>ClojureError.ts</b></td>
<td style='padding: 8px;'>- Classe base para todos os erros do interpretador</td>
</tr>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>InvalidParamError.ts</b></td>
<td style='padding: 8px;'>- Erro para parâmetros inválidos em funções e forms especiais</td>
</tr>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>ReferenceError.ts</b></td>
<td style='padding: 8px;'>- Erro para símbolos não encontrados no ambiente</td>
</tr>
</table>
</blockquote>
</details>
<details>
<summary><b>stdlib</b></summary>
<blockquote>
<div class='directory-path' style='padding: 8px 0; color: #666;'>
<code><b>⦿ src.stdlib</b></code>
<table style='width: 100%; border-collapse: collapse;'>
<thead>
<tr style='background-color: #f8f9fa;'>
<th style='width: 30%; text-align: left; padding: 8px;'>File Name</th>
<th style='text-align: left; padding: 8px;'>Summary</th>
</tr>
</thead>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>index.ts</b></td>
<td style='padding: 8px;'>- Biblioteca padrão com funções essenciais (`map`, `filter`, `+`, `str`, etc.)<br>- Funções de interoperação JavaScript<br>- Operações com átomos (`atom`, `deref`, `reset!`, `swap!`)<br>- Funções para manipulação de coleções</td>
</tr>
</table>
</blockquote>
</details>
<details>
<summary><b>types</b></summary>
<blockquote>
<div class='directory-path' style='padding: 8px 0; color: #666;'>
<code><b>⦿ src.types</b></code>
<table style='width: 100%; border-collapse: collapse;'>
<thead>
<tr style='background-color: #f8f9fa;'>
<th style='width: 30%; text-align: left; padding: 8px;'>File Name</th>
<th style='text-align: left; padding: 8px;'>Summary</th>
</tr>
</thead>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>index.ts</b></td>
<td style='padding: 8px;'>- Tipos de dados fundamentais do Clojure<br>- `ClojureVector`, `ClojureKeyword`, `ClojureMap`, `ClojureAtom`, `ClojureMacro`<br>- Interfaces e tipos para AST e funções de usuário</td>
</tr>
</table>
</blockquote>
</details>
</blockquote>
</details>
<details>
<summary><b>tests</b></summary>
<blockquote>
<div class='directory-path' style='padding: 8px 0; color: #666;'>
<code><b>⦿ tests</b></code>
<table style='width: 100%; border-collapse: collapse;'>
<thead>
<tr style='background-color: #f8f9fa;'>
<th style='width: 30%; text-align: left; padding: 8px;'>File Name</th>
<th style='text-align: left; padding: 8px;'>Summary</th>
</tr>
</thead>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>atomos.clj</b></td>
<td style='padding: 8px;'>- Testes de átomos e estado mutável</td>
</tr>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>compilador.clj</b></td>
<td style='padding: 8px;'>- Programa de exemplo para transpilação</td>
</tr>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>destructuring.clj</b></td>
<td style='padding: 8px;'>- Testes de destructuring em let e funções</td>
</tr>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>erros.clj</b></td>
<td style='padding: 8px;'>- Testes de try/catch e tratamento de erros</td>
</tr>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>estouro.clj</b></td>
<td style='padding: 8px;'>- Testes de Tail Call Optimization (TCO)</td>
</tr>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>filtro.clj</b></td>
<td style='padding: 8px;'>- Implementação da função filter</td>
</tr>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>final.clj</b></td>
<td style='padding: 8px;'>- Teste final integrado</td>
</tr>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>interop.clj</b></td>
<td style='padding: 8px;'>- Testes de interoperabilidade JavaScript</td>
</tr>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>listas.clj</b></td>
<td style='padding: 8px;'>- Manipulação básica de listas</td>
</tr>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>macros.clj</b></td>
<td style='padding: 8px;'>- Testes de metaprogramação com macros</td>
</tr>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>main.clj</b></td>
<td style='padding: 8px;'>- Programa principal de exemplo</td>
</tr>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>map.clj</b></td>
<td style='padding: 8px;'>- Testes da função map</td>
</tr>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>multiplo.clj</b></td>
<td style='padding: 8px;'>- Testes de blocos do e strings</td>
</tr>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>soma.clj</b></td>
<td style='padding: 8px;'>- Testes de recursão básica</td>
</tr>
</table>
</blockquote>
</details>
</details>

---

## Getting Started

### Prerequisites

This project requires the following dependencies:

- **Runtime:** [Node.js](https://nodejs.org/) (v18+)
- **Package Manager:** [pnpm](https://pnpm.io/) (recommended) or npm

### Installation

1. **Clone the repository:**

```
❯ git clone https://github.com/BrunoL28/mini-clojure-ts.git
```

2. **Navigate to the project directory:**

```
❯ cd mini-clojure-ts
```

3. **Install the dependencies:**
   **Using pnpm:**

```
❯ pnpm install
```

**Using npm:**

```
❯ npm install
```

### Usage

**Start the REPL (Interactive Mode):**

```
❯ pnpm start
```

**Execute a Clojure file:**

```
❯ pnpm start -- tests/final.clj
```

**Transpile a Clojure file to JavaScript:**

```
❯ pnpm start -- -t tests/compilador.clj
```

or

```
❯ pnpm start -- --transpile tests/compilador.clj
```

### CLI

```sh
mini-clj                              # REPL
mini-clj app.clj                      # executa um arquivo
mini-clj --sandbox app.clj            # executa código não confiável
mini-clj -e '(reduce + [1 2 3])'      # avalia e imprime
mini-clj -t app.clj                   # compila para app.mjs
mini-clj -t app.clj --target cjs --out-dir build -s -w
mini-clj --help                       # todas as opções
```

| Opção                   | Descrição                                        |
| ----------------------- | ------------------------------------------------ |
| `-e`, `--eval <código>` | Avalia uma expressão e imprime o resultado       |
| `-f`, `--file <arq>`    | Executa um arquivo `.clj`                        |
| `--sandbox`             | Interop restrito: sem IO, sem módulos, whitelist |
| `--allow <a,b>`         | Libera globais extras no sandbox                 |
| `--timeout <ms>`        | Interrompe a execução depois de N ms             |
| `--print-length <n>`    | Máximo de itens por coleção ao imprimir          |
| `--trace-eval`          | Imprime cada forma avaliada (stderr)             |
| `--trace-macroexpand`   | Imprime cada expansão de macro (stderr)          |
| `--trace-depth <n>`     | Profundidade máxima impressa no trace            |
| `--profile`             | Conta formas e mede o tempo ao final             |
| `--repl`                | Força o REPL                                     |
| `-h`, `--help`          | Ajuda                                            |
| `-v`, `--version`       | Versão                                           |

**Compilação** (com `-t`):

| Opção                    | Descrição                                     |
| ------------------------ | --------------------------------------------- |
| `-t`, `--transpile`      | Compila em vez de executar                    |
| `--target <alvo>`        | `esm` (padrão), `cjs` ou `iife`               |
| `-o`, `--out-file <arq>` | Arquivo de saída                              |
| `--out-dir <dir>`        | Diretório de saída (nome derivado da entrada) |
| `--runtime-global <n>`   | Global de onde o `iife` lê o runtime          |
| `-s`, `--source-map`     | Gera o `.map` e linka no arquivo compilado    |
| `-w`, `--watch`          | Recompila a cada mudança                      |

---

### Testing

The project includes a comprehensive suite of `.clj` files to test various features:

```
# Test Tail Call Optimization
❯ pnpm start -- tests/estouro.clj

# Test Macros
❯ pnpm start -- tests/macros.clj

# Test Atoms and State Management
❯ pnpm start -- tests/atomos.clj

# Test Destructuring
❯ pnpm start -- tests/destructuring.clj

# Test Error Handling
❯ pnpm start -- tests/erros.clj

# Test JavaScript Interop
❯ pnpm start -- tests/interop.clj

# Test Transpilation
❯ pnpm start -- -t tests/compilador.clj
```

As **suítes de aceitação** (executadas no CI) ficam em `tests/fixtures/` e rodam via `node:test`:

```
❯ pnpm test
```

| Fixture                 | Cobre                                        |
| ----------------------- | -------------------------------------------- |
| `semantics_suite.clj`   | Macros, destructuring, atoms, try/catch, TCO |
| `stdlib_seq_suite.clj`  | Sequências, helpers funcionais e mapas       |
| `predicates_suite.clj`  | Predicados e tipos                           |
| `core_macros_suite.clj` | `defn` `when` `and` `or` `cond` `->` `->>`   |
| `io_util_suite.clj`     | `assert` `time` `slurp` `spit`               |

---

## Documentação

| Documento                                  | Sobre                                           |
| ------------------------------------------ | ----------------------------------------------- |
| **[docs/semantics.md](docs/semantics.md)** | Especificação do subset e diferenças vs Clojure |
| [docs/stdlib.md](docs/stdlib.md)           | Referência completa do core                     |
| [docs/modules.md](docs/modules.md)         | `require`, `load-file` e a política de módulos  |
| [docs/compiler.md](docs/compiler.md)       | Pipeline, targets, source maps e watch          |
| [docs/interop.md](docs/interop.md)         | Contrato de interop e sandbox                   |
| [docs/browser.md](docs/browser.md)         | Bundles e limitações no browser                 |
| [docs/performance.md](docs/performance.md) | Benchmarks, limites e observabilidade           |

---

## Biblioteca Padrão

O core do Mini-Clojure-TS está documentado em **[docs/stdlib.md](docs/stdlib.md)** — a referência completa de aritmética, predicados, coleções, sequências, mapas, macros utilitárias e IO.

Resumo do que existe hoje:

| Grupo                  | Formas                                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Aritmética**         | `+` `-` `*` `/` `rem` `mod` `quot` `inc` `dec` `max` `min` `abs`                                                                                                                                             |
| **Comparação/lógica**  | `=` `not=` `identical?` `<` `>` `<=` `>=` `not`                                                                                                                                                              |
| **Predicados**         | `nil?` `some?` `true?` `false?` `boolean?` `number?` `string?` `keyword?` `symbol?` `fn?` `macro?` `map?` `vector?` `list?` `seq?` `coll?` `atom?` `zero?` `pos?` `neg?` `even?` `odd?` `empty?` `contains?` |
| **Coleções**           | `list` `vector` `hash-map` `first` `second` `last` `rest` `count` `nth` `cons` `conj` `concat`                                                                                                               |
| **Sequências**         | `map` `filter` `remove` `reduce` `some` `every?` `not-any?` `take` `drop` `range` `repeat` `reverse` `seq` `into`                                                                                            |
| **Helpers funcionais** | `identity` `apply` `comp` `partial`                                                                                                                                                                          |
| **Mapas**              | `get` `assoc` `dissoc` `keys` `vals` `merge` `update` `get-in` `assoc-in` `update-in`                                                                                                                        |
| **Macros utilitárias** | `defn` `when` `when-not` `and` `or` `cond` `->` `->>`                                                                                                                                                        |
| **IO/util**            | `print` `println` `prn` `pr-str` `str` `read-string` `assert` `time` `slurp`¹ `spit`¹                                                                                                                        |
| **Átomos/interop**     | `atom` `deref`/`@` `reset!` `swap!` `new` `.` `js/…` `throw`                                                                                                                                                 |

¹ Node-only (usa `fs`).

> **Truthiness:** apenas `false` e `nil` são falsos — `0`, `""` e `[]` são verdadeiros.
> `and`, `or`, `cond`, `when`, `when-not`, `->` e `->>` são formas especiais com avaliação preguiçosa (short-circuit garantido).

---

## Módulos

Referência completa em **[docs/modules.md](docs/modules.md)**.

Um módulo é só um arquivo `.clj`. **Não há namespaces** (`ns`/`in-ns`): cada
módulo roda num ambiente isolado e é exposto por alias.

```clojure
;; math.clj
(def pi 3.14)
(defn soma [a b] (+ a b))

;; main.clj
(require "./math.clj" :as math)
(math/soma 1 2)   ;=> 3
math/pi           ;=> 3.14

;; sem :as, os nomes públicos entram no ambiente atual
(require "./math.clj")
(soma 1 2)        ;=> 3

;; load-file: env atual, sempre reexecuta
(load-file "./setup.clj")
```

| Regra           | Comportamento                                                 |
| --------------- | ------------------------------------------------------------- |
| **Isolamento**  | `def` do módulo não vaza; o alias não expõe a stdlib herdada  |
| **Cache**       | Um arquivo executa no máximo uma vez por sessão               |
| **Caminhos**    | Relativos ao **arquivo que requer**; extensão `.clj` opcional |
| **Superfície**  | Tudo que o módulo define é público (sem `export`)             |
| **Ciclos**      | Detectados e rejeitados com erro explícito                    |
| **`load-file`** | Env atual, **sem** cache, devolve a última expressão          |

---

## Compilador

Referência completa em **[docs/compiler.md](docs/compiler.md)**.

O compilador gera um **módulo ESM** que importa um runtime — sem `globalThis`:

```sh
mini-clj -t app.clj -o build/app.js
node build/app.js
```

```js
// Gerado por Mini-Clojure-TS. Não edite à mão.
import * as $rt from "mini-clojure-ts/runtime";

const println = $rt.core["println"];
let total;

total = $rt.core["+"](1, 2);
println("total:", total);
```

**Pipeline:** parse → macroexpand → desugar → codegen.

O runtime **reusa a stdlib do interpretador** em vez de reimplementá-la em JS —
é o que torna a paridade real. A suíte
`tests/integration/compiler-parity.test.ts` roda dezenas de programas
interpretados **e** compilados e exige saída idêntica.

Compila: `let` com destructuring, mapas, keywords, `try/catch`, atoms,
`and`/`or` com short-circuit, `cond`, `when`, threading macros, `quote`,
`quasiquote` e macros (expandidas em compile-time).

Não compila (falha com erro explícito): `require`, `load-file`, `macroexpand`.

**Targets:** `esm` (padrão, `.mjs`), `cjs` (`.cjs`) e `iife` (`.js`).
`globalThis` aparece **só** no `iife`. O runtime é publicado nos dois formatos,
então `import` e `require` funcionam de verdade.

**Source maps:** `--source-map` gera um `.map` v3 autocontido. Com
`node --enable-source-maps`, o stack trace aponta a linha do `.clj`.

**Watch:** `--watch` recompila a cada mudança e **não morre em erro de
compilação**.

---

## Interop e Sandbox

Contrato completo em **[docs/interop.md](docs/interop.md)**.

```clojure
js/Math.PI                  ;=> 3.14159...   (caminho com ponto)
(. "repeat" "ab" 3)         ;=> "ababab"     (. chama quando é função)
(.- "toUpperCase" "abc")    ;=> #<Function>  (.- nunca chama)
(new js/Date 2020 0 1)
```

Para rodar código não confiável:

```sh
mini-clj --sandbox app.clj
mini-clj --sandbox --allow Intl app.clj
```

| No sandbox                 | Comportamento                                         |
| -------------------------- | ----------------------------------------------------- |
| `js/...`                   | Só a whitelist (`Math`, `Date`, `JSON`, `console`, …) |
| `slurp` / `spit`           | Bloqueados                                            |
| `require` / `load-file`    | Bloqueados                                            |
| `constructor`, `__proto__` | Bloqueados — são a rota para `Function`/`eval`        |

> ⚠️ O sandbox roda **no mesmo realm** do host. Ele eleva o custo de um escape
> e cobre as rotas conhecidas, mas **não é uma fronteira de segurança** contra
> código adversário, e não protege contra laço infinito. Para isolamento real,
> use `node:vm` com contexto separado, um Worker ou um processo. O código
> **compilado não é sandboxado**.

---

## No Browser

Guia completo em **[docs/browser.md](docs/browser.md)**. Demo em
[`examples/browser/index.html`](examples/browser/index.html).

```html
<script src="dist/mini-clojure.global.js"></script>
<script>
    console.log(MiniClojure.runSource("(reduce + [1 2 3])")); // 6
</script>
```

Interpretador, macros, estruturas persistentes, sandbox e **compilador**
funcionam igual. Só o que depende de sistema de arquivos não vai: `slurp`,
`spit`, `require` e `load-file` — e falham com mensagem explícita.

Via bundler, a condição `browser` do `package.json` escolhe a variante certa
sozinha:

```js
import { runSource } from "mini-clojure-ts/browser";
```

---

## Desempenho e Limites

Guia completo em **[docs/performance.md](docs/performance.md)**.

```sh
pnpm bench                        # benchmarks do interpretador
pnpm bench --save antes.json      # grava para comparar depois
pnpm bench --baseline antes.json  # compara com a medição anterior
```

Para não travar em código com bug ou hostil:

```sh
mini-clj --timeout 5000 app.clj        # interrompe com erro explicando o motivo
mini-clj --print-length 20 app.clj     # trunca coleções ao imprimir
```

```clojure
(set-print-length! 10)    ; itens por coleção; nil = sem limite
(set-print-level! 3)      ; profundidade de aninhamento
```

Para entender o que o avaliador está fazendo (tudo em stderr):

```sh
mini-clj --trace-eval --trace-depth 3 app.clj
mini-clj --trace-macroexpand app.clj
mini-clj --profile app.clj
```

```
— perfil —
formas avaliadas: 37.625
tempo total:      33.69 ms
formas por segundo: 1.116.674

mais avaliadas:
  fib                       8.361   22.2%
  if                        8.361   22.2%
```

> **Não há limite de memória.** Um programa que aloca sem parar continua capaz
> de derrubar o processo — `--timeout` só interrompe quem está avaliando formas.

---

### API Pública (Embed)

O Mini-Clojure-TS pode ser usado como uma biblioteca em outros projetos TypeScript/JavaScript.

```typescript
import { runSource, createGlobalEnv, parse } from "./src/index.js";

// 1. Execução Simples
const code = "(+ 10 20)";
const result = runSource(code);
console.log(result); // 30

// 2. Ambiente Personalizado
const env = createGlobalEnv();
runSource("(def x 42)", { env });
const x = runSource("x", { env });
console.log(x); // 42

// 3. Acesso à AST
const ast = parse('(print "Ola")');
console.log(ast);
// [ ['print', "Ola"] ]
```

---

## Roadmap

- [x] **v3.0:** Rastreabilidade de Erros, CI e testes automatizados, Separação Engine/CLI, Multiline + Histórico no REPL
- [x] **v4.0:** Escapes e erros melhores, `identical` (para ponteiros), Printing legível, Ferramentas de Macro, Destructuring de Mapas
- [x] **v5.0:** Sec/Core Functions, Predicados e Tipos, Macros Utilitárias, Utilitários e IO básicos para uso no Node
- [x] **v6.0:** Loader e Cache, Namespaces (decisão: sem `ns`), Empacotamento
- [x] **v7.0:** Transpiler como Compilador Útil, Runtime de Suporte, Macroexpand em Compile-Time
- [x] **v7.1:** Output e Targets (`esm`/`cjs`/`iife`), Source Maps, Watch Mode
- [x] **v8.0:** Sandbox/Whitelist, Política de Interop, Build para Browser
- [x] **v9.0:** Performance do Evaluator, Observabilidade, Limites, Higiene do Repo

---

## Contributing

- **💬 [Join the Discussions](https://github.com/BrunoL28/mini-clojure-ts/discussions):** Share your insights, provide feedback, or ask questions.
- **🐛 [Report Issues](https://github.com/BrunoL28/mini-clojure-ts/issues):** Submit bugs found or log feature requests.
- **💡 [Submit Pull Requests](https://github.com/BrunoL28/mini-clojure-ts/pulls):** Review open PRs, and submit your own PRs.

<details closed>
<summary>Contributing Guidelines</summary>

1. **Fork the Repository**: Start by forking the project repository to your github account.
2. **Clone Locally**: Clone the forked repository to your local machine.
3. **Create a New Branch**: Always work on a new branch.

```
git checkout -b feature/my-new-feature
```

4. **Make Your Changes**: Develop and test your changes locally.
5. **Commit Your Changes**: Commit with a clear message.
6. **Push to github**: Push the changes to your forked repository.
7. **Submit a Pull Request**: Create a PR against the original project repository.

</details>

---

## License

Distributed under the MIT License. See `LICENSE` for more information.

---

## Acknowledgments

- Inspired by **Rich Hickey's Clojure**.
- Built with TypeScript for type safety and developer experience.
- Thanks to all contributors and testers who helped shape this project.

<div id="bottom">

<div align="right">

[⬆ Back to Top](#top)

</div>
