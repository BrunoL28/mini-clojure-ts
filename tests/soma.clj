(print "--- Teste de Recursão: Somatório ---")

(def somatorio (fn (n)
  (if (<= n 0)
      0
      (+ n (somatorio (- n 1))))))

(print "Somando de 5 até 0:")
(print (somatorio 5))

(print "Somando de 10 até 0:")
(print (somatorio 10))

(print "--- Fim ---")