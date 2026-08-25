;; =========================================================
;; [R3/E2] Predicados e tipos — issue #13
;; =========================================================
(println "--- INICIO PREDICATES SUITE ---")

(def um-mapa {:a 1})
(def um-vetor [1 2])
(def uma-lista '(1 2))
(def uma-fn (fn [x] x))

;; --- nil? / some? ---
(assert (= (nil? nil) true) "nil? de nil")
(assert (= (nil? false) false) "nil? de false é false")
(assert (= (nil? 0) false) "nil? de 0 é false")
(assert (= (some? nil) false) "some? de nil")
(assert (= (some? false) true) "some? de false é true")
(assert (= (some? 1) true) "some? de número")

;; --- map? ---
(assert (= (map? um-mapa) true) "map? de mapa")
(assert (= (map? um-vetor) false) "map? de vetor")
(assert (= (map? nil) false) "map? de nil")

;; --- vector? ---
(assert (= (vector? um-vetor) true) "vector? de vetor")
(assert (= (vector? uma-lista) false) "vector? de lista")
(assert (= (vector? "abc") false) "vector? de string")

;; --- list? / seq?  (vetores NÃO são seqs, como em Clojure) ---
(assert (= (list? uma-lista) true) "list? de lista")
(assert (= (list? um-vetor) false) "list? de vetor")
(assert (= (list? um-mapa) false) "list? de mapa")
(assert (= (seq? uma-lista) true) "seq? de lista")
(assert (= (seq? um-vetor) false) "seq? de vetor")
(assert (= (seq? (map inc [1 2])) true) "seq? do resultado de map")

;; --- coll? ---
(assert (= (coll? um-vetor) true) "coll? de vetor")
(assert (= (coll? um-mapa) true) "coll? de mapa")
(assert (= (coll? 42) false) "coll? de número")

;; --- keyword? / symbol? ---
(assert (= (keyword? :a) true) "keyword? de keyword")
(assert (= (keyword? "a") false) "keyword? de string")
(assert (= (keyword? 'a) false) "keyword? de símbolo")
(assert (= (symbol? 'a) true) "symbol? de símbolo")
(assert (= (symbol? :a) false) "symbol? de keyword")
(assert (= (symbol? 1) false) "symbol? de número")

;; --- number? ---
(assert (= (number? 42) true) "number? de inteiro")
(assert (= (number? 1.5) true) "number? de decimal")
(assert (= (number? "42") false) "number? de string")

;; --- string? ---
(assert (= (string? "abc") true) "string? de string")
(assert (= (string? :abc) false) "string? de keyword")
(assert (= (string? 1) false) "string? de número")

;; --- fn? ---
(assert (= (fn? uma-fn) true) "fn? de fn de usuário")
(assert (= (fn? +) true) "fn? de fn nativa")
(assert (= (fn? 42) false) "fn? de número")

;; --- boolean? / true? / false? ---
(assert (= (boolean? true) true) "boolean? de true")
(assert (= (boolean? nil) false) "boolean? de nil")
(assert (= (true? true) true) "true? de true")
(assert (= (true? 1) false) "true? de 1 é false")
(assert (= (false? false) true) "false? de false")
(assert (= (false? nil) false) "false? de nil é false")

;; --- numéricos ---
(assert (= (zero? 0) true) "zero?")
(assert (= (zero? 1) false) "zero? de 1")
(assert (= (pos? 3) true) "pos?")
(assert (= (pos? -3) false) "pos? de negativo")
(assert (= (neg? -3) true) "neg?")
(assert (= (neg? 0) false) "neg? de 0")
(assert (= (even? 4) true) "even?")
(assert (= (even? 3) false) "even? de ímpar")
(assert (= (odd? 3) true) "odd?")

;; --- empty? / contains? ---
(assert (= (empty? []) true) "empty? de vetor vazio")
(assert (= (empty? [1]) false) "empty? de vetor com item")
(assert (= (empty? nil) true) "empty? de nil")
(assert (= (empty? {}) true) "empty? de mapa vazio")

(println "--- FIM PREDICATES SUITE ---")
