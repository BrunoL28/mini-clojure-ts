;; Teste de Semântica Automatizado
(print "--- INICIO SUITE ---")

;; 1. Macros e Quasiquote
(defmacro teste-macro (condicao corpo)
  `(if ~condicao ~corpo "falso"))

(print (teste-macro true "verdadeiro"))
(print (teste-macro false "verdadeiro"))

;; 2. Destructuring e &
(def test-rest (fn [a & b] b))
(print "Rest:" (test-rest 1 2 3)) ;; Deve imprimir vetor [2 3]

(let [[x y] [10 20]]
  (print "Let Destruct:" (+ x y)))

;; 3. Atoms
(def a (atom 5))
(swap! a + 5)
(print "Atom:" @a)

;; 4. Try/Catch
(try
  (throw "ErroTeste")
  (catch e (print "Capturado:" e)))

;; 5. TCO (Simples)
(def rec-tail (fn [n]
  (if (<= n 0) "fim" (rec-tail (- n 1)))))
(print "TCO:" (rec-tail 100))

(print "--- FIM SUITE ---")