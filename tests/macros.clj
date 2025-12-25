(print "--- Teste de Metaprogramação (Macros) ---")

(defmacro unless (teste corpo)
  ` (if (not ~teste) 
        ~corpo 
        nil) )

(def x 10)

(print "Teste 1 (Condição Falsa):")
;; Certifica-te que aqui tens espaços: (> x 20)
(unless (> x 20) 
  (print "Sucesso: X é pequeno!"))

(print "Teste 2 (Condição Verdadeira):")
;; x < 20 é verdadeiro. O 'unless' não deve fazer nada.
(unless (< x 20)
  (print "ERRO: Isto não devia aparecer!"))


;; 3. Macro INFIX (Matemática normal)
;; Transforma (1 + 1) em (+ 1 1)
(defmacro infix (esq op dir)
  ` (~op ~esq ~dir))

(print "Teste Infix 1 + 2:")
(print (infix 1 + 2)) ;; vira (+ 1 2) -> 3