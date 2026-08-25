# Módulos — Mini-Clojure-TS

> **Decisão de produto ([#16], [#17]):** um **`Env` por módulo, exposto por alias**.
> **Não existem namespaces** — não há `ns` nem `in-ns`. Um módulo é simplesmente
> um arquivo `.clj`, e `require` + alias cobre o caso de uso sem introduzir
> resolução de símbolos por namespace.

---

## `require`

### Com alias (recomendado)

```clojure
;; math.clj
(def pi 3.14)
(defn soma [a b] (+ a b))

;; main.clj
(require "./math.clj" :as math)

(math/soma 1 2)   ;=> 3
math/pi           ;=> 3.14
```

O alias vira um valor de primeira classe no ambiente. Símbolos na forma
`alias/membro` resolvem dentro do módulo — o mesmo mecanismo que `js/Foo` usa
para globais JavaScript.

### Sem alias

```clojure
(require "./math.clj")

(soma 1 2)        ;=> 3
pi                ;=> 3.14
```

Sem `:as`, **todos** os nomes públicos do módulo são copiados para o ambiente
atual. É conveniente para scripts curtos e arriscado em projetos maiores, porque
um `def` do módulo sobrescreve silenciosamente um nome existente.

---

## Regras

### Isolamento

Cada módulo executa num `Env` próprio, **filho da raiz**. Na prática:

- O módulo enxerga a stdlib.
- O módulo **não** enxerga os locais de quem o requereu.
- Os `def` do módulo **não vazam** quando o require usa `:as`.
- O alias **não** expõe símbolos herdados: `math/reduce` é erro, mesmo `reduce`
  existindo na stdlib que o módulo enxerga.

```clojure
(require "./math.clj" :as math)

soma              ;=> erro: símbolo não encontrado (não vazou)
(math/reduce + [1 2])  ;=> erro: 'reduce' não é definido no módulo 'math'
```

### Superfície pública

**Tudo que o módulo define é público.** Não há `export` nem `defn-`. Para marcar
algo como interno, use convenção de nome (`-helper`, `impl-*`) e documente.

### Cache

Um arquivo é executado **no máximo uma vez por sessão**. O segundo `require` do
mesmo caminho devolve o módulo já carregado, sem reexecutar efeitos colaterais:

```clojure
(require "./contador.clj" :as c1)   ; executa
(require "./contador.clj" :as c2)   ; vem do cache
;; c1 e c2 apontam para o MESMO módulo
```

A chave do cache é o **caminho absoluto resolvido**, então `"./math"` e
`"./math.clj"` são o mesmo módulo.

### Resolução de caminhos

- Caminhos relativos resolvem a partir do **diretório do arquivo que está
  requerendo** — não do `cwd`. Um módulo que requer outro usa o próprio caminho
  como base.
- A extensão `.clj` é **opcional**: `"./math"` e `"./math.clj"` são equivalentes.
- Caminhos absolutos são usados como estão.
- Fora de um arquivo (REPL, `--eval`), a base é o `cwd`.

### Ciclos

`require` circular é **detectado e rejeitado** com erro explícito, em vez de
entrar em recursão infinita ou devolver um módulo meio construído.

---

## `load-file`

```clojure
(load-file "./setup.clj")
```

Diferente de `require` em dois pontos deliberados:

|                      | `require`               | `load-file`                  |
| -------------------- | ----------------------- | ---------------------------- |
| **Ambiente**         | `Env` isolado do módulo | **Env atual** de quem chamou |
| **Cache**            | Sim — executa uma vez   | **Não** — sempre reexecuta   |
| **Alias**            | Suporta `:as`           | Não se aplica                |
| **Valor de retorno** | `nil`                   | Valor da última expressão    |

Use `load-file` para scripts de setup, fixtures e recarga durante
desenvolvimento; use `require` para código de biblioteca.

---

## `*file*`

Var dinâmica com o **caminho absoluto do arquivo em execução**. É o que permite
a resolução relativa. Dentro de um módulo, vale o caminho do próprio módulo.

```clojure
(println *file*)  ;=> /caminho/absoluto/para/main.clj
```

No REPL e em `--eval` ela aponta para um caminho sintético dentro do `cwd`.

---

## Limitações conhecidas

- **Sem `ns`/`in-ns`.** Decisão de [#17], caminho (A).
- **Sem `:refer`/`:only`** — ou tudo (sem `:as`) ou nada (com `:as`).
- **Sem `export`/privados.** Tudo que o módulo define é público.
- **Sem resolução por nome de pacote** (`node_modules`, classpath): só caminhos
  de arquivo.
- O alias é apenas uma ligação no ambiente: `(def math 42)` depois de um
  `require ... :as math` sobrescreve o alias.

---

## Exemplos

Os módulos de exemplo e a suíte de aceitação vivem em:

- `tests/fixtures/modules/` — módulos de exemplo (`math.clj`, `contador.clj`,
  `usa-math.clj`, `privado.clj`, `efeito.clj`)
- `tests/fixtures/modules_suite.clj` — suíte que roda no CI

[#16]: https://github.com/BrunoL28/mini-clojure-ts/issues/16
[#17]: https://github.com/BrunoL28/mini-clojure-ts/issues/17
