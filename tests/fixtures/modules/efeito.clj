;; Usado com load-file: roda no env de QUEM chamou, por isso enxerga
;; `carregamentos`, que é definido lá.
(swap! carregamentos inc)
(def veio-do-load-file :sim)
