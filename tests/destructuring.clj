(print "--- Teste de Destructuring ---")

(print "1. Destructuring em LET (Vetores):")
(let [[a b] [10 20]]
  (print "A:" a)
  (print "B:" b))

(print "2. Destructuring com Rest (&):")
(let [[head & tail] [1 2 3 4]]
  (print "Head:" head)
  (print "Tail:" tail))

(print "3. Destructuring em Argumentos de Função:")
(def somar-ponto (fn [[x y]]
  (+ x y)))

(print "Soma:" (somar-ponto [5 7]))

(print "4. Função Variadic (com &):")
(def print-todos (fn [titulo & nomes]
  (print titulo)
  (print nomes)))

(print-todos "Lista de Convidados:" "Bruno" "Ana" "Carlos")

(print "5. Aninhado (Nested):")
(let [[x [y z]] [1 [2 3]]]
  (print "X:" x "Y:" y "Z:" z))