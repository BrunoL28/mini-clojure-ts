;; Teste de Sequências e Coleções [R3/E1]

;; 1. Reduce
(if (= (reduce + [1 2 3]) 6) (println "Reduce 1 PASS") (println "Reduce 1 FAIL"))
(if (= (reduce + 10 [1 2 3]) 16) (println "Reduce 2 PASS") (println "Reduce 2 FAIL"))
(if (= (reduce (fn [acc x] (+ acc (* x x))) 0 [2 3]) 13) (println "Reduce 3 PASS") (println "Reduce 3 FAIL"))

;; 2. Filter
(def nums [1 2 3 4 5 6])
(def evens (filter (fn [x] (= (rem x 2) 0)) nums))
(if (= (count evens) 3) (println "Filter 1 PASS") (println "Filter 1 FAIL"))
(if (= (first evens) 2) (println "Filter 2 PASS") (println "Filter 2 FAIL"))
(if (= (count (filter (fn [x] false) nums)) 0) (println "Filter 3 PASS") (println "Filter 3 FAIL"))

;; 3. Some
(if (= (some (fn [x] (= x 3)) [1 2 3 4]) true) (println "Some 1 PASS") (println "Some 1 FAIL"))
(if (= (some (fn [x] (> x 10)) [1 2 3]) nil) (println "Some 2 PASS") (println "Some 2 FAIL"))
(if (= (some identity [false nil 5 nil]) 5) (println "Some 3 PASS") (println "Some 3 FAIL"))

;; 4. Every?
(if (= (every? (fn [x] (> x 0)) [1 2 3]) true) (println "Every? 1 PASS") (println "Every? 1 FAIL"))
(if (= (every? (fn [x] (= (rem x 2) 0)) [2 4 5]) false) (println "Every? 2 PASS") (println "Every? 2 FAIL"))
(if (= (every? identity []) true) (println "Every? 3 PASS") (println "Every? 3 FAIL"))

;; 5. Take & Drop
(if (= (count (take 2 [1 2 3 4])) 2) (println "Take 1 PASS") (println "Take 1 FAIL"))
(if (= (count (take 10 [1 2])) 2) (println "Take 2 PASS") (println "Take 2 FAIL"))
(if (= (first (drop 2 [1 2 3 4])) 3) (println "Drop 1 PASS") (println "Drop 1 FAIL"))
(if (= (count (drop 10 [1 2])) 0) (println "Drop 2 PASS") (println "Drop 2 FAIL"))

;; 6. Range
(if (= (last (range 5)) 4) (println "Range 1 PASS") (println "Range 1 FAIL"))
(if (= (first (range 5 10)) 5) (println "Range 2 PASS") (println "Range 2 FAIL"))
(if (= (count (range 0 10 2)) 5) (println "Range 3 PASS") (println "Range 3 FAIL"))

;; 7. Apply
(if (= (apply + [1 2 3]) 6) (println "Apply 1 PASS") (println "Apply 1 FAIL"))
(if (= (apply + 1 [2 3]) 6) (println "Apply 2 PASS") (println "Apply 2 FAIL"))
(if (= (apply max [1 5 2]) 5) (println "Apply 3 PASS") (println "Apply 3 FAIL"))

;; 8. Comp & Partial & Identity
(def add1 (partial + 1))
(if (= (add1 5) 6) (println "Partial 1 PASS") (println "Partial 1 FAIL"))

(def double (fn [x] (* x 2)))
(def process (comp add1 double)) ;; (x * 2) + 1
(if (= (process 3) 7) (println "Comp 1 PASS") (println "Comp 1 FAIL"))
(if (= (identity 42) 42) (println "Identity 1 PASS") (println "Identity 1 FAIL"))

;; 9. Into & Seq & Reverse
(if (= (count (into [1] [2 3])) 3) (println "Into 1 PASS") (println "Into 1 FAIL"))
(if (= (seq []) nil) (println "Seq 1 PASS") (println "Seq 1 FAIL"))
(if (= (first (reverse [1 2 3])) 3) (println "Reverse 1 PASS") (println "Reverse 1 FAIL"))

(println "--- End of Stdlib Sequence Tests ---")