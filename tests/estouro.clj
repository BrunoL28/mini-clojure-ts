(def somatorio (fn (n)
  (if (<= n 0)
      0
      (+ n (somatorio (- n 1))))))

(print "Tentando somar 20000 números (Isto deve falhar):")
(print (somatorio 20000))