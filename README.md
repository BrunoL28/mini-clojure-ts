<div id="top">

<div align="center">

# MINI-CLOJURE-TS

<em>Um interpretador e transpilador de Clojure robusto e modular escrito em TypeScript.</em>

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

| | Componente | Detalhes |
| --- | --- | --- |
| ⚙️ | **Arquitetura** | <ul><li>Design modular que separa Tokenizador, Analisador Sintático, Avaliador, Ambiente e Transpilador</li><li>Sistema de tratamento de erros tipado com classes de erro personalizadas</li><li>Separação clara da Biblioteca Padrão (`stdlib`)</li></ul> |
| ⚡️ | **Desempenho** | <ul><li>**Otimização de Chamada de Cauda (TCO):** Implementa a técnica de Trampolim para lidar com recursão infinita sem estouro de pilha</li><li>Processamento e avaliação eficientes da AST</li></ul> |
| 🧠 | **Metaprogramação** | <ul><li>Suporte completo a macros (`defmacro`, `quasiquote`, `unquote`)</li><li>Expansão de macros em tempo de execução</li><li>Capacidade de estender a sintaxe da linguagem dinamicamente</li></ul> |
| 🌐 | **Interoperabilidade com JS** | <ul><li>Acesso direto a `globalThis` via `js/Namespace`</li><li>Instanciação de classes JS (`new`)</li><li>Encadeamento de métodos e acesso a propriedades (operador `.`)</li></ul> |
| 📦 | **Estruturas de Dados** | <ul><li>Suporte para listas `()`, vetores `[]` e mapas de hash `{}`</li><li>Palavras-chave (`:key`), átomos (estado mutável) e tipos primitivos</li><li>Operações no estilo imutável via funções da `stdlib`</li></ul> |
| 🛡️ | **Tratamento de Erros** | <ul><li>Tratamento de exceções Try/Catch</li><li>Tipos de erro personalizados (`ClojureError`, `InvalidParamError`, `ClojureReferenceError`)</li><li>Relatórios de erro detalhados com contexto</li></ul> |
| 🔄 | **Gerenciamento de Estado** | <ul><li>Átomos para estado mutável com `atom`, `deref`, `reset!`, `swap!`</li><li>Atualizações de estado thread-safe</li></ul> |
| 🎯 | **Desestruturação** | <ul><li>Suporte completo à desestruturação em vinculações `let` e parâmetros de função</li><li>Suporte para parâmetros rest `&`</li><li>Padrões de desestruturação aninhados</li></ul> |
| ⚙️ | **Transpilador** | <ul><li>Compila código Clojure para JavaScript executável</li><li>Suporte à transpilação pela linha de comando</li><li>Gera código JS limpo e executável</li></ul> |
| 💻 | **REPL** | <ul><li>Loop interativo de leitura-avaliação-impressão com realce de sintaxe</li><li>Estado de ambiente persistente</li><li>Relatório de erros detalhado</li></ul> |

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
    │   ├── compilador.js
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
<td style='padding: 8px;'><b>compilador.js</b></td>
<td style='padding: 8px;'>- <strong>NOVO:</strong> Saída transpilada do compilador.clj</td>
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

* **Runtime:** [Node.js](https://nodejs.org/) (v18+)
* **Package Manager:** [pnpm](https://pnpm.io/) (recommended) or npm

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

---

## Roadmap

* [x] **v1.0.0:** TCO, Macros, Maps, Vectors, JS Interop
* [x] **v1.1.0:** Atoms (State Management)
* [x] **v1.2.0:** Try/Catch Error Handling
* [x] **v1.3.0:** Destructuring support
* [x] **v2.0.0:** Transpiler (Compile to JS)

---

## Contributing

* **💬 [Join the Discussions](https://github.com/BrunoL28/mini-clojure-ts/discussions):** Share your insights, provide feedback, or ask questions.
* **🐛 [Report Issues](https://github.com/BrunoL28/mini-clojure-ts/issues):** Submit bugs found or log feature requests.
* **💡 [Submit Pull Requests](https://github.com/BrunoL28/mini-clojure-ts/pulls):** Review open PRs, and submit your own PRs.

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

* Inspired by **Rich Hickey's Clojure**.
* Built with TypeScript for type safety and developer experience.
* Thanks to all contributors and testers who helped shape this project.

<div align="right">
[⬆ Back to Top](#top)
</div>
