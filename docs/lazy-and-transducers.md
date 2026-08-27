# Sequências preguiçosas e transdutores

Duas features complementares: **preguiça** ([#33]) permite sequências
infinitas e terminação antecipada; **transdutores** ([#34]) permitem compor
transformações sem alocar as coleções intermediárias.

---

## Sequências preguiçosas ([#33])

O subset é conservador de propósito.

**Produzem sequência preguiçosa:**

| Construtores                          | Transformações                                                        |
| ------------------------------------- | --------------------------------------------------------------------- |
| `range`, `repeat`, `iterate`, `cycle` | `map`, `filter`, `remove`, `take`, `drop`, `take-while`, `drop-while` |

```clojure
(take 5 (map (fn [x] (* x x)) (range)))    ;=> (0 1 4 9 16)
(take 4 (filter even? (range)))            ;=> (0 2 4 6)
(take 3 (iterate (fn [x] (* x 2)) 1))      ;=> (1 2 4)
(take 4 (cycle [:a :b]))                   ;=> (:a :b :a :b)
(first (range))                            ;=> 0
```

`(range)`, `(repeat x)`, `(iterate f x)` e `(cycle coll)` são **infinitas**.

### O que produz sob demanda

`first`, `second`, `rest`, `nth`, `empty?`, `seq` e `take` produzem só o que
precisam. `(first (range))` termina.

### O que força a realização

`count`, `=`, `reverse`, `into` sem transdutor, destructuring, hash e a
impressão sem `*print-length*`.

```clojure
(count (range))     ;; não termina
(take 3 (range))    ;; termina
```

> Imprimir infinita funciona **com** `*print-length*` — o padrão do REPL:
>
> ```clojure
> (set-print-length! 5)
> (range)   ;=> (0 1 2 3 4 ...)
> ```
>
> `--timeout` é a rede de segurança: a realização respeita o limite de tempo.

### Memoização

Os elementos produzidos ficam em cache. Percorrer duas vezes não recalcula.

```clojure
(def xs (map caro (range 5)))
(count xs)   ;; chama `caro` 5 vezes
(count xs)   ;; não chama de novo
```

---

## Transdutores ([#34])

Um transdutor é uma transformação **independente da coleção**. Chamadas sem a
coleção, as funções de sequência devolvem um transdutor:

```clojure
(map inc)              ;=> transdutor
(filter even?)         ;=> transdutor
(take 3)               ;=> transdutor
```

Disponíveis: `map`, `filter`, `remove`, `take`, `drop`, `take-while`,
`drop-while`.

### Compondo

`comp` compõe transdutores, e os dados fluem na **ordem em que você escreve**:

```clojure
(def xf (comp (map inc) (filter even?)))

(transduce xf + 0 (range 10))              ;=> 30
(into [] xf (range 10))                    ;=> [2 4 6 8 10]
(into [] (sequence xf (range 10)))         ;=> [2 4 6 8 10]
```

> Note que `comp` aplica funções normais da direita para a esquerda, mas
> transdutores da esquerda para a direita. Não é inconsistência: um transdutor
> transforma a **função de redução**, então compor as transformações ao
> contrário faz os dados fluírem na ordem escrita.

### Consumindo

| Forma                           | O que faz                                          |
| ------------------------------- | -------------------------------------------------- |
| `(transduce xform f init coll)` | Reduz aplicando o transdutor                       |
| `(transduce xform f coll)`      | Idem, usando `(f)` como valor inicial              |
| `(into to xform from)`          | Constrói a coleção, sem intermediárias             |
| `(sequence xform coll)`         | Sequência **preguiçosa** com o transdutor aplicado |

### Terminação antecipada

`(reduced x)` marca o valor como resultado final. É o que faz `(take n)`
terminar sobre sequência infinita:

```clojure
(into [] (comp (filter odd?) (take 4)) (range))   ;=> [1 3 5 7]

(reduce (fn [acc x] (if (> x 3) (reduced acc) (+ acc x))) 0 (range))
;=> 6
```

Também há `reduced?` e `unreduced`.

### Estado não vaza

Transdutores com estado (`take`, `drop`, `drop-while`) criam o estado a cada
aplicação, então reusar o mesmo transdutor é seguro:

```clojure
(def pegar2 (take 2))
[(into [] pegar2 (range 5)) (into [] pegar2 (range 5))]   ;=> [[0 1] [0 1]]
```

---

## Desempenho: o compromisso

Medido contra a `9.2.0`, em processos separados:

| Caso                                       | Efeito     |
| ------------------------------------------ | ---------- |
| `(take 5 …)` de pipeline sobre 100k        | **+7400×** |
| `(reduce + (map inc (filter even? coll)))` | **−25%**   |
| Todo o resto                               | ±2%        |

**A preguiça não é de graça.** Um pipeline eager sobre coleção já
materializada ficou ~25% mais lento: a cadeia produz elemento a elemento em
vez de rodar três laços apertados. Em troca, terminação antecipada deixou de
ser proporcional ao tamanho da coleção, e sequência infinita passou a existir.

`transduce` custa o mesmo que o pipeline preguiçoso e evita as coleções
intermediárias — é a forma recomendada quando o pipeline importa.

### Duas decisões de implementação

**O protocolo é closure, não gerador.** Medido: geradores encadeados do
JavaScript custam ~8× um laço eager; closures pull custam ~2,5×. A primeira
versão usava geradores e o pipeline caía 52%.

**O consumo é em blocos de 32**, o mesmo valor e a mesma razão do Clojure com
seqs chunked: reduzir através de uma closure por elemento custa caro. O preço
é idêntico ao do Clojure — uma redução que termina cedo pode ter produzido
até 31 elementos a mais do que estritamente necessário. Se o produtor tiver
efeito colateral, isso é observável.

[#33]: https://github.com/BrunoL28/mini-clojure-ts/issues/33
[#34]: https://github.com/BrunoL28/mini-clojure-ts/issues/34
