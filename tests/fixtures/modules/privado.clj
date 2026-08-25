;; Módulo usado só para provar isolamento: nada daqui pode vazar
;; para o env de quem requer com :as.
(def segredo-do-modulo 99)
(defn funcao-do-modulo [] :ok)
