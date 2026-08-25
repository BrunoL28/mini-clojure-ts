;; =========================================================
;; [R3/E3] Macros utilitárias — issue #14
;; =========================================================
(println "--- INICIO MACROS SUITE ---")

;; --- defn ---
(defn quadrado [x] (* x x))
(assert (= (quadrado 4) 16) "defn simples")

(defn soma-tudo [& nums] (reduce + 0 nums))
(assert (= (soma-tudo 1 2 3) 6) "defn com rest args")

(def visto (atom nil))
(defn com-corpo-multiplo [x]
  (reset! visto x)
  (+ x 1))
(assert (= (com-corpo-multiplo 5) 6) "defn com corpo de várias formas")
(assert (= @visto 5) "defn executa todas as formas do corpo")

;; --- when ---
(assert (= (when true :sim) :sim) "when verdadeiro")
(assert (= (when false :sim) nil) "when falso retorna nil")
(assert (= (when nil :sim) nil) "when com nil retorna nil")
(assert (= (when true 1 2 3) 3) "when retorna a última forma do corpo")

;; --- when-not ---
(assert (= (when-not false :sim) :sim) "when-not falso")
(assert (= (when-not true :sim) nil) "when-not verdadeiro retorna nil")
(assert (= (when-not nil 1 2) 2) "when-not com corpo múltiplo")

;; --- and ---
(assert (= (and) true) "and sem argumentos é true")
(assert (= (and 1 2 3) 3) "and retorna o último valor")
(assert (= (and 1 false 3) false) "and retorna o primeiro falso")
(assert (= (and 1 nil 3) nil) "and retorna nil quando encontra nil")

;; --- or ---
(assert (= (or) nil) "or sem argumentos é nil")
(assert (= (or nil false 7) 7) "or retorna o primeiro verdadeiro")
(assert (= (or false nil) nil) "or retorna o último quando tudo é falso")
(assert (= (or 1 2) 1) "or curto-circuita no primeiro verdadeiro")

;; --- short-circuit (DoD: não avaliar o desnecessário) ---
(def contador (atom 0))
(defn marca [] (do (swap! contador inc) true))
(and false (marca))
(assert (= @contador 0) "and NÃO avalia argumentos após um falso")
(or true (marca))
(assert (= @contador 0) "or NÃO avalia argumentos após um verdadeiro")
(and true (marca))
(assert (= @contador 1) "and avalia o que precisa")

;; --- cond ---
(assert (= (cond false :a true :b) :b) "cond escolhe o primeiro teste verdadeiro")
(assert (= (cond false :a) nil) "cond sem match retorna nil")
(assert (= (cond false :a :else :padrao) :padrao) "cond com :else")
(assert (= (cond) nil) "cond vazio é nil")

(cond true :primeiro (marca) :segundo)
(assert (= @contador 1) "cond não avalia testes após o match")

;; --- -> (thread-first) ---
(assert (= (-> 5 inc) 6) "-> com símbolo simples")
(assert (= (-> 5 inc (* 2)) 12) "-> insere como primeiro argumento")
(assert (= (-> {:a 1} (assoc :b 2) (get :b)) 2) "-> encadeado em mapas")
(assert (= (-> 10) 10) "-> só com o valor inicial")

;; --- ->> (thread-last) ---
(assert (= (->> [1 2 3] (map inc)) '(2 3 4)) "->> insere como último argumento")
(assert (= (->> [1 2 3] (map inc) (reduce +)) 9) "->> encadeado")
(assert (= (->> [1 2 3 4] (filter even?) (map (fn [x] (* x 10))) (reduce + 0)) 60) "->> pipeline completo")

(println "--- FIM MACROS SUITE ---")
