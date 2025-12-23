(print "--- Teste de TCO (Tail Call Optimization) ---")

(def somatorio (fn (n acc)
  (if (<= n 0)
      acc
      (somatorio (- n 1) (+ n acc))))) 
      ;; Nota: Mudei para recursão de cauda (acumulador) para ser eficiente

(print "Calculando somatório de 20.000 (Antes isto explodia):")
(print (somatorio 20000 0))

(print "Vamos abusar? 1.000.000 iterações:")
(print (somatorio 1000000 0))