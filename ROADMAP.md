# ROADMAP — Mini-Clojure-TS (Interpretador + Compilador)

Este roadmap transforma o plano em **milestones executáveis**, com **Definition of Done**, **dependências**, **checklists** e **tags** para organização.

> ## Convenções:  
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

1) Cada **Release (R1…R7)** vira uma **Milestone** no GitHub.  
2) Cada **Épico** vira uma **Issue** (com checklist).  
3) Cada PR deve:
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
- [ ] Conjunto mínimo de funções de seq/coleção implementado e testado
- [ ] Macros utilitárias padrão disponíveis (mesmo subset)
- [ ] Docs da stdlib (tabela no README + docs/stdlib.md)

## Épicos

### E1. Seq/core functions [LIB]
Adicionar (com testes):
- [ ] `reduce`, `filter`, `some`, `every?`
- [ ] `take`, `drop`, `range`, `repeat`
- [ ] `apply`, `comp`, `partial`, `identity`
- [ ] `into`, `seq`, `reverse` (se fizer sentido)
- [ ] `contains?`, `dissoc`, `merge`, `update`, `assoc-in/get-in/update-in` (subset)

### E2. Predicados e tipos [LIB]
- [ ] `map?`, `seq?`, `list?`, `keyword?`, `number?`, `string?`, `fn?`, `nil?`
- [ ] Testes para cada predicado

### E3. Macros utilitárias [LIB]
- [ ] `when`, `when-not`
- [ ] `and`, `or` (como macros, com short-circuit)
- [ ] `cond`
- [ ] `->`, `->>` (threading macros)
- [ ] `defn`

### E4. IO/util [LIB][DX]
- [ ] `assert` (com mensagem)
- [ ] `time` (medição simples)
- [ ] (Node) `slurp` / `spit` (se fizer sentido para produto)

---

# R4 — Módulos e empacotamento

**Objetivo:** permitir projetos reais: organização por arquivos, require/load, isolamento e empacotamento.

## Dependências
- R1 (CLI/API) e R3 (core suficiente) concluídos.

## DoD
- [ ] `load-file` funciona e mantém cache/isolamento conforme definido
- [ ] Existe um mecanismo mínimo de `require`/módulos (mesmo simples)
- [ ] CLI suporta `--eval`, `--file`, `--repl`, `--transpile`, `--out`
- [ ] Distribuição como pacote: CLI + API

## Épicos

### E1. Loader e cache [DX][INT]
- [ ] `load-file` (executa arquivo)
- [ ] `require` (subset):
  - resolução por path relativo
  - cache (não recarrega se já carregou)
- [ ] Definir política de ambiente:
  - módulo tem seu próprio env?
  - exporta symbols? (definir subset)

### E2. Namespaces mínimos (opcional) [INT][DX]
Escolher um dos caminhos:
- [ ] (A) Sem `ns`, apenas `require` + export explícito
- [ ] (B) `ns` simplificado (`(ns foo.bar)`), com `in-ns`

### E3. Empacotamento [DX]
- [ ] Entrypoints ESM/CJS definidos
- [ ] `bin` do CLI no `package.json`
- [ ] `CHANGELOG.md` + semver

---

# R5 — Compilador de verdade (paridade + runtime + source maps)

**Objetivo:** transpiler deixar de ser demo e virar compilador útil.

## Dependências
- R1 (loc), R2 (semântica), R4 (módulos) recomendados.

## DoD
- [ ] Pipeline: parse → macroexpand → IR/AST → codegen
- [ ] Compila `let`, mapas, keywords, try/catch, atoms (subset definido)
- [ ] Output com targets (`cjs`/`esm`/`iife`) e sem `globalThis` por padrão
- [ ] Source maps funcionando para stack traces no Node
- [ ] Testes de equivalência (interpretado vs compilado) em um conjunto de programas

## Épicos

### E1. Paridade mínima com interpretador [COMP]
- [ ] `let` + destructuring
- [ ] mapas `{}` + keywords
- [ ] `try/catch`
- [ ] atoms (`atom`, `deref`, `reset!`, `swap!`)
- [ ] decisão documentada: quote/quasiquote (compile-time only vs runtime)

### E2. Runtime de suporte [COMP]
- [ ] Introduzir runtime leve para:
  - Keyword
  - ClojureVector / ClojureMap (ou abstração equivalente)
  - igualdade estrutural (se necessário no compilado)
- [ ] Garantir semântica equivalente ao interpretador (ou documentar divergências)

### E3. Macroexpand em compile-time [COMP][INT]
- [ ] Macros definidas no arquivo expandem durante compilação
- [ ] `macroexpand` testável
- [ ] Erros na expansão apontam loc

### E4. Output e targets [COMP][DX]
- [ ] `--target esm|cjs|iife`
- [ ] `--out-file` / `--out-dir`
- [ ] Evitar `globalThis` por padrão (somente em `iife` ou opção explícita)

### E5. Source maps [COMP]
- [ ] Mapear nós do AST com loc → posições no JS
- [ ] Gerar `.map` e linkar no output
- [ ] Teste: erro em runtime do JS aponta linha do `.clj` (quando possível)

### E6. Watch mode [DX]
- [ ] `--watch` recompila em mudança
- [ ] Mensagens claras de erro/diagnóstico

---

# R6 — Segurança, sandbox e interop

**Objetivo:** tornar interop JS controlável e seguro para rodar código “não confiável”.

## Dependências
- R1 (erros) recomendado. R5 se quiser sandbox também no compilado.

## DoD
- [ ] Modo sandbox para interpretador (whitelist)
- [ ] Política de interop documentada e testada
- [ ] (Opcional) build browser ou separação de runtime Node vs browser

## Épicos

### E1. Sandbox/whitelist [SEC][INT]
- [ ] `--sandbox` desabilita acesso direto a `globalThis`
- [ ] whitelist configurável: ex.: `Math`, `Date`, `console` (subset)
- [ ] bloquear `Function`, `eval`, `process` (Node), `require` (se aplicável)

### E2. Política de interop [SEC][DOC]
- [ ] Doc “Interop Contract”:
  - como `js/...` resolve símbolos
  - como `.` acessa propriedade vs método
  - como `new` funciona
- [ ] Testes cobrindo edge cases

### E3. Compatibilidade browser (opcional) [DX]
- [ ] build sem fs/readline
- [ ] REPL via web (ou runner simples)

---

# R7 — Performance, observabilidade e manutenção

**Objetivo:** manter evolução saudável: desempenho previsível, tracing, profiling, limites e governança.

## Dependências
- Pode ser incremental; ideal após R3/R5.

## DoD
- [ ] Benchmarks básicos e metas definidas
- [ ] Tracing opcional e profiler simples
- [ ] Limites configuráveis (tempo/memória/impressão)
- [ ] Qualidade de repo: templates, contribuição, releases consistentes

## Épicos

### E1. Performance do evaluator [INT]
- [ ] Otimizar lookups de env
- [ ] Evitar loops custosos em `get`/keyword equivalence
- [ ] Benchmarks: macroexpand, map/reduce em coleções

### E2. Observabilidade [DX]
- [ ] `--trace-eval`, `--trace-macroexpand`
- [ ] profiler simples (tempo por forma / contagem)

### E3. Limites e robustez [SEC][DX]
- [ ] limite de tempo de execução (opcional)
- [ ] limite de impressão (ex.: `*print-length*`)
- [ ] proteção contra loops “absurdos” (diagnóstico, não “magic stop”)

### E4. Manutenção/Repo hygiene [DOC][QA]
- [ ] `CONTRIBUTING.md`
- [ ] templates de issue/PR
- [ ] `CHANGELOG.md` (keep-a-changelog)
- [ ] semver e notas de release

---

## Backlog (ideias futuras, sem compromisso)

- [ ] `~@` (unquote-splicing)
- [ ] lazy seqs (subset)
- [ ] transducers (subset)
- [ ] melhor pretty-printer / formatter
- [ ] LSP (syntax highlight + completions) para editor
