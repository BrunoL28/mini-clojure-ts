# ROADMAP — Mini-Clojure-TS (Interpretador + Compilador)

Este roadmap transforma o plano em **milestones executáveis**, com **Definition of Done**, **dependências**, **checklists** e **tags** para organização.

> ## Convenções:
>
> **[INT]** interpretador

    **[COMP]** compilador/transpiler
    **[DX]** CLI/REPL/dev experience
    **[LIB]** stdlib/core
    **[QA]** testes/CI
    **[SEC]** segurança/sandbox
    **[DOC]** documentação

---

## Visão de produto

Entregar uma linguagem “mini” inspirada em Clojure que seja **confiável para uso real**:

- Rodar código via **REPL** e **arquivos** com mensagens de erro boas.
- Ter um **core/stdlib** suficiente para programas pequenos/médios.
- Ter um **compilador** (transpiler evoluído) que gere JS utilizável, com **paridade mínima** e **source maps**.
- Ser instalável/embeddable (biblioteca + CLI), com **versionamento**, **testes**, **CI** e **docs**.

---

## Como usar este roadmap (processo recomendado)

1. Cada **Release (R1…R7)** vira uma **Milestone** no GitHub.
2. Cada **Épico** vira uma **Issue** (com checklist).
3. Cada PR deve:
    - referenciar a issue
    - incluir testes/validação
    - atualizar este roadmap marcando itens concluídos

---

## Não-objetivos (para evitar scope creep)

Estes itens são explicitamente **fora de escopo** até pelo menos depois de R5:

- Compatibilidade total com Clojure (namespaces completos, protocols, multimétodos, lazy seqs, transients, etc.)
- Concurrency avançada (core.async, STM, agents)
- Macro sistema “100% Clojure” (higiene perfeita etc.)
- Performance “nível VM/JIT” (o objetivo é previsível, não máximo throughput)
- Ecosistema/gerenciador de deps estilo Lein/Tools.deps

---

## Regras de qualidade (gates) por release

Um item só conta como “feito” quando:

- ✅ tem teste (ou repro + validação automatizável)
- ✅ tem documentação mínima (README/Docs)
- ✅ não quebra exemplos existentes
- ✅ se impacta compilador e interpretador, a decisão de paridade está documentada

---

# R1 — Fundação de Produto (qualidade, previsibilidade e DX)

**Objetivo:** tornar o projeto confiável: erros bons, testes, CI, API pública e REPL utilizável.

## Escopo (in)

- [DOC] especificação do subset suportado
- [QA] suíte de testes e harness
- [DX] CLI/REPL mais robustos
- [INT]/[COMP] erros com arquivo/linha/coluna
- [DOC] guia de contribuição + padrões

## Fora do escopo (out)

- Aumentar stdlib de forma grande (isso é R3)
- Módulos/require (isso é R4)
- Source maps (isso é R5)

## Dependências

Nenhuma (primeira release).

## Definition of Done (DoD)

- [ ] Tokenizer/Parser/Ast carregam **posição** (arquivo/linha/coluna) nos nós relevantes
- [ ] Erros de parse e runtime incluem posição e contexto mínimo
- [ ] Existe comando de testes (ex.: `pnpm test`) e roda no CI
- [ ] REPL suporta multiline e histórico básico
- [ ] API pública documentada (ex.: `run`, `compile`, `parse`, `eval`)

## Épicos e tarefas

### E1. Especificação e docs do subset [DOC]

- [ ] Criar `docs/semantics.md` com:
    - formas especiais suportadas
    - truthiness
    - macros + expansão
    - interop JS (regras de `js/`, `new`, `.`)
    - limitações conhecidas (ex.: sem `~@`)
- [ ] Exemplos “canônicos” em `docs/examples.md`

### E2. Posições e erros (linha/coluna) [INT][COMP][DX]

- [ ] Token: incluir `{line, col, index, file?}`
- [ ] AST: cada nó relevante carrega `loc`
- [ ] Parser: mensagens de erro de parênteses/mapas desbalanceados apontam **onde começou**
- [ ] Evaluator: erros incluem stack (sequência de formas) + loc quando disponível
- [ ] REPL/CLI: imprimir erro amigável com:
    - `arquivo:linha:col`
    - trechinho do código (1–2 linhas) + caret `^`

**Checks (aceitação):**

- [ ] Arquivo com string não fechada → erro com linha/coluna
- [ ] `)` extra → erro com contexto e linha/coluna
- [ ] Erro em runtime (ex.: chamar não-função) → mostra loc da forma

### E3. Testes automatizados (harness) [QA]

- [ ] Testes unitários: tokenizer + parser (casos mínimos e edge cases)
- [ ] Testes de integração: rodar `.clj` e comparar stdout
- [ ] Testes de macro: `defmacro`, quasiquote/unquote, `macroexpand` (mesmo que utilitário interno por enquanto)

**Sugestão sem dependência pesada:** usar `node:test` (Node 18).

### E4. CI/CD mínimo [QA][DX]

- [ ] Workflow: lint + build + test em PR
- [ ] Badge de status no README
- [ ] Publicar artifacts (opcional) em release

### E5. API pública e separação engine/CLI [DX]

- [ ] Exportar API clara (ex.: `runFile`, `runSource`, `compileFile`)
- [ ] Manter CLI como camada fina
- [ ] Documentar API no README

### E6. REPL: multiline + histórico + comandos [DX]

- [ ] Multiline com detecção de balanceamento
- [ ] Histórico persistente (arquivo `.mini-clj-history`)
- [ ] Comandos: `:quit`, `:load <arquivo>`, `:help` (mínimo)

---

# R2 — Semântica e tipos de dados confiáveis

**Objetivo:** linguagem consistente: igualdade estrutural, coleções previsíveis, reader mais robusto, destructuring completo e ferramentas de macros.

## Escopo (in)

- [INT][LIB] igualdade estrutural e predicados básicos
- [INT] impressão (pr-str/prn) consistente
- [INT] reader de strings/escapes mais confiável
- [INT] destructuring de mapas
- [INT] macro tools: `macroexpand-1`/`macroexpand`

## Dependências

- R1 (posição/erros/testes) concluído.

## DoD

- [ ] `=` funciona estruturalmente para vetores/listas/mapas/keywords
- [ ] `pr-str` e `read-string` (ou equivalente) permitem roundtrip básico em literais
- [ ] destructuring de mapas cobre `:keys`, `:as`, `:or` (subset definido)
- [ ] `macroexpand` disponível e testado

## Épicos

### E1. Igualdade estrutural + identidade [INT][LIB]

- [ ] Implementar `=` estrutural
- [ ] Adicionar `identical?` (ou equivalente) para identidade
- [ ] Testes de igualdade para nested maps/vectors/keywords

### E2. Impressão e leitura confiáveis [INT][LIB]

- [ ] `pr-str` (representação legível) para:
    - números, strings (com escapes), keywords
    - listas, vetores, mapas
- [ ] `read-string` (parser de string) com erros bons

### E3. Reader: escapes e erros melhores [INT]

- [ ] Suporte consistente a `\"`, `\\`, `\n`, `\t` (definir subset)
- [ ] String não terminada → erro com loc (R1 já habilita)

### E4. Destructuring de mapas [INT]

- [ ] `{:keys [a b] :as m :or {a 1}}` (subset)
- [ ] Testes com `let` e args de função

### E5. Ferramentas de macro [INT][DX]

- [ ] `macroexpand-1`, `macroexpand`
- [ ] Opcional: `*print-macroexpand*` (flag de debug)

---

# R3 — Stdlib/Core (linguagem usável no dia a dia)

**Objetivo:** parar de “reinventar tudo” em cada programa: ter core mínimo útil.

## Dependências

- R2 (semântica e printing) concluído.

## DoD

- [x] Conjunto mínimo de funções de seq/coleção implementado e testado
- [x] Macros utilitárias padrão disponíveis (mesmo subset)
- [x] Docs da stdlib (tabela no README + docs/stdlib.md)

## Épicos

### E1. Seq/core functions [LIB]

Adicionar (com testes):

- [x] `reduce`, `filter`, `some`, `every?`
- [x] `take`, `drop`, `range`, `repeat`
- [x] `apply`, `comp`, `partial`, `identity`
- [x] `into`, `seq`, `reverse` (se fizer sentido)
- [x] `contains?`, `dissoc`, `merge`, `update`, `assoc-in/get-in/update-in` (subset)

### E2. Predicados e tipos [LIB]

- [x] `map?`, `seq?`, `list?`, `keyword?`, `number?`, `string?`, `fn?`, `nil?`
- [x] Testes para cada predicado

### E3. Macros utilitárias [LIB]

- [x] `when`, `when-not`
- [x] `and`, `or` (como formas especiais, com short-circuit)
- [x] `cond`
- [x] `->`, `->>` (threading macros)
- [x] `defn`

### E4. IO/util [LIB][DX]

- [x] `assert` (com mensagem)
- [x] `time` (medição simples)
- [x] (Node) `slurp` / `spit` (Node-only, documentado)

---

# R4 — Módulos e empacotamento

**Objetivo:** permitir projetos reais: organização por arquivos, require/load, isolamento e empacotamento.

## Dependências

- R1 (CLI/API) e R3 (core suficiente) concluídos.

## DoD

- [x] `load-file` funciona e mantém cache/isolamento conforme definido
- [x] Existe um mecanismo mínimo de `require`/módulos (mesmo simples)
- [x] CLI suporta `--eval`, `--file`, `--repl`, `--transpile`, `--out`
- [x] Distribuição como pacote: CLI + API

## Épicos

### E1. Loader e cache [DX][INT]

- [x] `load-file` (executa arquivo, no env atual, sem cache)
- [x] `require` (subset):
    - [x] resolução por path relativo (a partir do arquivo que requer)
    - [x] cache (não recarrega se já carregou)
- [x] Definir política de ambiente: **env por módulo + alias**
    - [x] módulo tem seu próprio env (filho da raiz)
    - [x] exporta tudo que define; acesso via `alias/membro` ou refer-all

### E2. Namespaces mínimos (opcional) [INT][DX]

Escolher um dos caminhos:

- [x] (A) Sem `ns`, apenas `require` + alias — **escolhido**
- [ ] (B) `ns` simplificado (`(ns foo.bar)`), com `in-ns` — descartado

### E3. Empacotamento [DX]

- [x] Entrypoint ESM definido (com tipos); CJS fora de escopo
- [x] `bin` do CLI no `package.json` (`mini-clj`)
- [x] `CHANGELOG.md` + semver

---

# R5 — Compilador de verdade (paridade + runtime + source maps)

**Objetivo:** transpiler deixar de ser demo e virar compilador útil.

## Dependências

- R1 (loc), R2 (semântica), R4 (módulos) recomendados.

## DoD

- [x] Pipeline: parse → macroexpand → desugar → codegen
- [x] Compila `let`, mapas, keywords, try/catch, atoms (subset definido)
- [x] Output com targets (`cjs`/`esm`/`iife`) e sem `globalThis` por padrão
- [x] Source maps funcionando para stack traces no Node
- [x] Testes de equivalência (interpretado vs compilado) em um conjunto de programas

## Épicos

### E1. Paridade mínima com interpretador [COMP]

- [x] `let` + destructuring (sequência e mapa)
- [x] mapas `{}` + keywords
- [x] `try/catch`
- [x] atoms (`atom`, `deref`, `reset!`, `swap!`)
- [x] decisão documentada: quote/quasiquote **compile-time only**

### E2. Runtime de suporte [COMP]

- [x] Introduzir runtime em `src/runtime/` para:
    - [x] Keyword (internada)
    - [x] ClojureVector / ClojureMap
    - [x] igualdade estrutural — a stdlib do interpretador é reusada
- [x] Semântica equivalente ao interpretador; divergências em `docs/compiler.md`

### E3. Macroexpand em compile-time [COMP][INT]

- [x] Macros definidas no arquivo expandem durante compilação
- [x] Expansão testada (macro simples, aninhada e com quasiquote)
- [x] Erros na expansão apontam loc

### E4. Output e targets [COMP][DX]

- [x] `--target esm|cjs|iife`
- [x] `--out-file` / `--out-dir`
- [x] `globalThis` somente no `iife`

### E5. Source maps [COMP]

- [x] Mapear formas de nível superior com loc → linhas no JS
- [x] Gerar `.map` (v3, com sourcesContent) e linkar no output
- [x] Teste: erro em runtime do JS aponta linha do `.clj`

### E6. Watch mode [DX]

- [x] `--watch` recompila em mudança (debounce de 100 ms)
- [x] Mensagens claras de erro/diagnóstico; erro não derruba o watch

---

# R6 — Segurança, sandbox e interop

**Objetivo:** tornar interop JS controlável e seguro para rodar código “não confiável”.

## Dependências

- R1 (erros) recomendado. R5 se quiser sandbox também no compilado.

## DoD

- [x] Modo sandbox para interpretador (whitelist)
- [x] Política de interop documentada e testada (`docs/interop.md`)
- [x] Build browser + separação de runtime Node vs browser

## Épicos

### E1. Sandbox/whitelist [SEC][INT]

- [x] `--sandbox` desabilita acesso direto a `globalThis`
- [x] whitelist configurável via `--allow`
- [x] bloquear `Function`, `eval`, `process`, `require`, `slurp`/`spit` e `constructor`

### E2. Política de interop [SEC][DOC]

- [x] Doc “Interop Contract” em `docs/interop.md`:
    - [x] como `js/...` resolve símbolos (com caminho pontuado)
    - [x] como `.` acessa propriedade vs método, e o novo `.-`
    - [x] como `new` funciona
- [x] Testes cobrindo edge cases, interpretado e compilado

### E3. Compatibilidade browser (opcional) [DX]

- [x] build sem fs/readline (abstração de host)
- [x] Runner web em `examples/browser/index.html`

---

# R7 — Performance, observabilidade e manutenção

**Objetivo:** manter evolução saudável: desempenho previsível, tracing, profiling, limites e governança.

## Dependências

- Pode ser incremental; ideal após R3/R5.

## DoD

- [x] Benchmarks básicos (`pnpm bench`) com comparação contra medição anterior
- [x] Tracing opcional e profiler simples
- [x] Limites configuráveis de tempo e impressão (memória fora de escopo)
- [x] Qualidade de repo: templates, contribuição, releases consistentes

## Épicos

### E1. Performance do evaluator [INT]

- [x] Otimizar lookups de env (objeto sem protótipo + laço)
- [x] Laços O(n) removidos do destructuring; `into`/`conj` deixaram de ser quadráticos
- [x] Benchmarks: macroexpand, map/reduce, TCO, destructuring, interop

### E2. Observabilidade [DX]

- [x] `--trace-eval`, `--trace-macroexpand`, `--trace-depth`
- [x] `--profile`: contagem por operador e formas por segundo

### E3. Limites e robustez [SEC][DX]

- [x] limite de tempo de execução (`--timeout`)
- [x] limite de impressão (`--print-length`, `set-print-length!`, `set-print-level!`)
- [x] diagnóstico de laço infinito via `--timeout`, com mensagem explicando o motivo

### E4. Manutenção/Repo hygiene [DOC][QA]

- [x] `CONTRIBUTING.md`
- [x] templates de issue/PR
- [x] `CHANGELOG.md` (keep-a-changelog)
- [x] semver, política de breaking changes e notas de release

---

## Backlog (ideias futuras, sem compromisso)

- [ ] `~@` (unquote-splicing)
- [ ] lazy seqs (subset)
- [ ] transducers (subset)
- [ ] melhor pretty-printer / formatter
- [ ] LSP (syntax highlight + completions) para editor
