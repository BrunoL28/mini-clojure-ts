# Semântica — Mini-Clojure-TS

Especificação do subset suportado ([#1]). É a referência para decidir o que é
bug e o que é limitação declarada.

Documentos irmãos: [`stdlib.md`](stdlib.md) (as funções),
[`modules.md`](modules.md), [`compiler.md`](compiler.md),
[`interop.md`](interop.md), [`browser.md`](browser.md),
[`performance.md`](performance.md).

---

## Valores

| Tipo     | Sintaxe           | Representação interna                    |
| -------- | ----------------- | ---------------------------------------- |
| Número   | `42`, `1.5`, `-3` | `number` do JavaScript (ponto flutuante) |
| String   | `"oi"`            | `string` do JavaScript                   |
| Booleano | `true`, `false`   | `boolean`                                |
| Nil      | `nil`             | `null`                                   |
| Keyword  | `:a`, `:nome`     | `ClojureKeyword` (guarda os dois-pontos) |
| Símbolo  | `a`, `soma-tudo`  | `ClojureSymbol`                          |
| Lista    | `(1 2 3)`         | `Array` do JavaScript                    |
| Vetor    | `[1 2 3]`         | `ClojureVector` (estende `Array`)        |
| Mapa     | `{:a 1}`          | `ClojureMap` (HAMT persistente)          |
| Átomo    | `(atom 0)`        | `ClojureAtom`                            |
| Função   | `(fn [x] x)`      | `{params, body, env}`                    |
| Macro    | `(defmacro …)`    | `ClojureMacro`                           |

**Vetor não é lista.** `ClojureVector` estende `Array`, mas os predicados
distinguem: `(list? [1])` é `false` e `(vector? [1])` é `true`. As funções de
sequência devolvem **listas**, então `(seq? (filter odd? [1]))` é `true` —
como em Clojure.

**Números são `double`.** Não há inteiros separados, nem BigInt, nem racionais.
`(/ 1 3)` devolve `0.3333333333333333`.

**Mapas são persistentes.** `assoc`, `dissoc` e `update` devolvem uma nova
estrutura; a original não muda. A **ordem de iteração deriva do hash**, não da
inserção, e não deve ser assumida.

---

## Truthiness

**Apenas `false` e `nil` são falsos.** Todo o resto é verdadeiro — inclusive
`0`, `""`, `[]` e `{}`.

```clojure
(if 0 :sim :nao)    ;=> :sim
(if "" :sim :nao)   ;=> :sim
(if [] :sim :nao)   ;=> :sim
(if nil :sim :nao)  ;=> :nao
```

Vale igualmente no código compilado, que usa `$rt.truthy` em vez da
truthiness do JavaScript.

---

## Igualdade

`=` é **estrutural** e encadeado. Compara conteúdo de vetores, listas, mapas e
keywords, em qualquer profundidade. `identical?` compara referência.

```clojure
(= [1 {:a 1}] [1 {:a 1}])   ;=> true
(= 1 1 1)                    ;=> true
(identical? [1] [1])         ;=> false
```

Vetor e lista com o mesmo conteúdo são iguais: `(= [1 2] (list 1 2))` é `true`.

---

## Formas especiais

São interpretadas diretamente pelo avaliador. **Não são valores** — não dá para
passar `if` para `map`. Em compensação, avaliam os argumentos preguiçosamente,
que é o que garante o short-circuit de `and` e `or`.

### Definição e escopo

| Forma                          | Semântica                                           |
| ------------------------------ | --------------------------------------------------- |
| `(def nome valor)`             | Liga no ambiente atual. Redefinir é permitido       |
| `(defn nome [params] & corpo)` | Açúcar para `(def nome (fn [params] (do & corpo)))` |
| `(fn [params] & corpo)`        | Cria função. Suporta destructuring e `&` rest       |
| `(let [bindings] & corpo)`     | Escopo léxico. Bindings enxergam os anteriores      |

`def` liga no ambiente **em que é avaliado** — dentro de uma função, a
ligação não escapa para o global.

### Controle

| Forma                       | Semântica                                              |
| --------------------------- | ------------------------------------------------------ |
| `(if teste então [senão])`  | Sem `senão`, devolve `nil`                             |
| `(do & formas)`             | Avalia todas, devolve a última                         |
| `(when teste & corpo)`      | `if` sem `senão`, com corpo implícito em `do`          |
| `(when-not teste & corpo)`  | O inverso                                              |
| `(cond t1 e1 t2 e2 …)`      | Pares teste/expressão. Use `:else` como padrão         |
| `(and & xs)`                | `(and)` → `true`. Primeiro falso, ou o último valor    |
| `(or & xs)`                 | `(or)` → `nil`. Primeiro verdadeiro, ou o último valor |
| `(-> x & formas)`           | Insere como **primeiro** argumento                     |
| `(->> x & formas)`          | Insere como **último** argumento                       |
| `(try & corpo (catch e …))` | `e` liga a **mensagem** do erro, não o objeto          |

### Metaprogramação

| Forma                              | Semântica                                           |
| ---------------------------------- | --------------------------------------------------- |
| `(quote x)` / `'x`                 | Devolve `x` sem avaliar                             |
| `` `x ``                           | Quasiquote: literal, exceto onde houver `~` ou `~@` |
| `~x`                               | Unquote: avalia `x` e insere o valor                |
| `~@xs`                             | Unquote-splicing: **intercala** os itens de `xs`    |
| `(defmacro nome [params] & corpo)` | Define macro. Suporta `&` e destructuring           |
| `(macroexpand-1 forma)`            | Expande um nível                                    |
| `(macroexpand forma)`              | Expande até o ponto fixo                            |

### Módulos, tempo e diagnóstico

| Forma                         | Semântica                                                              |
| ----------------------------- | ---------------------------------------------------------------------- |
| `(require "./m.clj" [:as a])` | Carrega em ambiente isolado, com cache. Ver [`modules.md`](modules.md) |
| `(load-file "./m.clj")`       | Executa no ambiente atual, sempre reexecuta                            |
| `(time expr)`                 | Mede e imprime; devolve o valor de `expr`                              |

---

## Avaliação

1. **Símbolo** resolve no ambiente léxico, do escopo mais interno ao mais
   externo. Não encontrado → erro (nunca `nil`).
    - `js/Nome` resolve um global JavaScript. Ver [`interop.md`](interop.md).
    - `alias/membro` resolve num módulo requerido com `:as`.
2. **Literais** (número, string, booleano, `nil`, keyword) avaliam para si.
3. **Vetor e mapa** avaliam cada elemento e devolvem uma nova coleção.
4. **Lista** é chamada:
    - Cabeça é forma especial → regra própria.
    - Cabeça é macro → expande e avalia o resultado.
    - Senão → avalia todos os argumentos, da esquerda para a direita, e aplica.
5. **Keyword na posição de função** busca no mapa: `(:a {:a 1})` → `1`.

### Ordem de resolução

Uma forma especial **sempre vence** um nome ligado no ambiente:
`(def if 1)` liga o símbolo, mas `(if …)` continua sendo a forma especial. A
lista de formas está em `SPECIAL_FORMS`, em `src/core/Evaluator.ts`.

### Recursão de cauda

Chamadas em **posição de cauda** não crescem a pilha, via trampolim:

```clojure
(defn conta [n] (if (<= n 0) :fim (conta (- n 1))))
(conta 1000000)   ;=> :fim
```

Posição de cauda inclui o ramo escolhido de `if`, a última forma de `do` e de
`let`, e o corpo de `when`. **Não** inclui argumento de chamada:
`(+ 1 (conta n))` cresce a pilha.

---

## Macros

Os argumentos chegam **não avaliados**, como estrutura de dados. A macro
devolve uma forma, que é então avaliada no lugar da chamada.

```clojure
(defmacro quando [teste & corpo]
  `(if ~teste (do ~@corpo) nil))

(quando true (println "a") :fim)
;; expande para: (if true (do (println "a") :fim) nil)
```

- `~` insere um valor; `~@` **intercala** os itens de uma sequência.
- `~@` só vale dentro de uma sequência; fora dela é erro.
- `~@` de `nil` ou de coleção vazia não insere nada.
- Macros expandem **recursivamente**: uma macro pode expandir para outra.

**Sem higiene.** Não há `gensym` nem auto-gensym (`x#`): um símbolo introduzido
pela macro pode capturar um binding de quem a chamou. Escolha nomes improváveis
quando isso importar.

No **compilador**, `defmacro` roda em tempo de compilação e não gera código.
Ver [`compiler.md`](compiler.md).

---

## Destructuring

Vale em `let`, em parâmetros de `fn`/`defn` e em parâmetros de `defmacro`.

### Sequências

```clojure
(let [[a b] [1 2]] (+ a b))          ;=> 3
(let [[a & resto] [1 2 3]] resto)    ;=> [2 3]
(let [[[a b] c] [[1 2] 3]] a)        ;=> 1
(let [[a b] [1]] b)                  ;=> nil   (nil punning)
```

Faltando elementos, os nomes ligam `nil` — não é erro.

### Mapas

```clojure
(let [{:keys [a b]} {:a 1 :b 2}] (+ a b))        ;=> 3
(let [{v :chave} {:chave 7}] v)                   ;=> 7
(let [{:keys [a] :or {a 9}} {}] a)                ;=> 9
(let [{:keys [a] :as todo} {:a 1}] todo)          ;=> {:a 1}
```

Destructuring de mapa em `nil` também não quebra: os nomes ligam `nil`.

---

## Erros

Todo erro é um `ClojureError` (ou subclasse) e carrega, quando disponível,
**arquivo, linha e coluna** da forma que o originou.

```
Símbolo 'variavel-fantasma' não encontrado. em 12:8 (app.clj)
```

`catch` liga a **mensagem** (string), não o objeto de erro — no interpretador
e no compilado:

```clojure
(try (throw "boom") (catch e e))   ;=> "boom"
```

---

## Sequências preguiçosas

Um **subset** da linguagem é preguiçoso: os elementos só são produzidos quando
alguém precisa deles, e ficam em cache — percorrer duas vezes não recalcula.

**Produzem sequência preguiçosa:**

| Construtores                          | Transformações                                                        |
| ------------------------------------- | --------------------------------------------------------------------- |
| `range`, `repeat`, `iterate`, `cycle` | `map`, `filter`, `remove`, `take`, `drop`, `take-while`, `drop-while` |

```clojure
(take 5 (map (fn [x] (* x x)) (range)))    ;=> (0 1 4 9 16)
(take 4 (filter even? (range)))            ;=> (0 2 4 6)
(take 3 (iterate (fn [x] (* x 2)) 1))      ;=> (1 2 4)
(take 4 (cycle [:a :b]))                   ;=> (:a :b :a :b)
```

**Sequências infinitas** existem: `(range)`, `(repeat x)`, `(iterate f x)` e
`(cycle coll)` não terminam sozinhas.

### O que força a realização

Tudo que precisa da coleção inteira: `count`, `=`, `reduce`, `into`, `reverse`,
`nth`, destructuring, hash (usar como chave de mapa) e a impressão sem
`*print-length*`.

```clojure
(count (range))     ;; não termina — precisa contar tudo
(take 3 (range))    ;; termina — só produz 3
```

> **Imprimir uma sequência infinita** funciona **com** `*print-length*`, que é
> o padrão do REPL:
>
> ```clojure
> (set-print-length! 5)
> (range)   ;=> (0 1 2 3 4 ...)
> ```
>
> Sem limite, imprimir uma infinita não termina. Use `--timeout` como rede: a
> realização de sequência preguiçosa respeita o limite de tempo.

### O que continua eager

Todo o resto: `reduce`, `into`, `concat`, `reverse`, as funções de mapa,
`conj`, `first`, `rest`. Vetores e mapas nunca são preguiçosos.

`(seq? …)` é `true` para sequência preguiçosa e `(vector? …)` é `false` — como
para qualquer lista.

---

## Diferenças em relação ao Clojure

Nem tentativa de compatibilidade total, nem acidente: as diferenças abaixo são
escolhas registradas.

### Ausente por decisão

| O que falta                           | Situação                                                          |
| ------------------------------------- | ----------------------------------------------------------------- |
| **Namespaces** (`ns`)                 | `require` + alias cobre o caso de uso. [`modules.md`](modules.md) |
| **Lazy seqs completas**               | Só um subset é preguiçoso — ver acima                             |
| **Higiene de macro**                  | Sem `gensym` nem `x#`                                             |
| **Tipos numéricos**                   | Só `double`. Sem inteiros, BigInt ou racionais                    |
| **Protocolos, multimétodos, records** | Fora de escopo                                                    |
| **STM, agents, core.async**           | Só `atom`                                                         |
| **Transients**                        | Fora de escopo                                                    |
| **Sets** (`#{}`)                      | Não implementados                                                 |
| **Metadata** (`^{}`)                  | Não implementada                                                  |
| **Aridade múltipla em `fn`**          | Uma assinatura por função; use `&` e despache no corpo            |

### Comportamento diferente

| Situação    | Clojure                      | Aqui                           |
| ----------- | ---------------------------- | ------------------------------ |
| `catch`     | Liga o objeto de exceção     | Liga a **mensagem** (string)   |
| `catch`     | Exige a classe da exceção    | Só o símbolo: `(catch e …)`    |
| `.` interop | `.metodo` e `.-campo`        | `(. "membro" alvo)` e `(.- …)` |
| `defmacro`  | Vetor de params              | Vetor **ou** lista             |
| Divisão     | Racionais: `(/ 1 3)` → `1/3` | Ponto flutuante                |

### Marcas adicionadas

Coisas que este projeto tem e o Clojure não:

- **`.-`** como forma explícita de ler propriedade sem chamar.
- **`--sandbox`** com whitelist de globais. Ver [`interop.md`](interop.md).
- **`--trace-eval`, `--profile`** e limites de execução.
  Ver [`performance.md`](performance.md).
- **Compilador para JavaScript** com paridade verificada por teste.
  Ver [`compiler.md`](compiler.md).

---

## Exemplos canônicos

```clojure
;; Recursão de cauda: não cresce a pilha
(defn soma-ate [n acc]
  (if (<= n 0) acc (soma-ate (- n 1) (+ acc n))))
(soma-ate 100000 0)                        ;=> 5000050000

;; Pipeline com threading
(->> (range 20)
     (filter even?)
     (map (fn [x] (* x x)))
     (reduce + 0))                          ;=> 1140

;; Estruturas persistentes
(def base {:nome "ana" :tags [:a :b]})
(assoc-in base [:endereco :cidade] "sp")    ;=> mapa novo
base                                         ;=> inalterado

;; Destructuring
(defn saudar [{:keys [nome] :or {nome "mundo"}}]
  (str "olá, " nome))
(saudar {})                                  ;=> "olá, mundo"

;; Macro variádica
(defmacro a-menos-que [teste & corpo]
  `(if ~teste nil (do ~@corpo)))
(a-menos-que false (println "roda") :fim)   ;=> :fim

;; Estado
(def contador (atom 0))
(swap! contador + 5)
@contador                                    ;=> 5

;; Erros
(try (nth [1] 9) (catch e (str "falhou: " e)))

;; Interop
(. "toUpperCase" "abc")                      ;=> "ABC"
js/Math.PI                                   ;=> 3.14159...
```

[#1]: https://github.com/BrunoL28/mini-clojure-ts/issues/1
