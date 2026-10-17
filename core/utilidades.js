window.Utilidades = {
  clamp(valor, minimo, maximo) {
    return Math.max(minimo, Math.min(maximo, valor));
  },

  distancia(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  },

  angulo(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
  },

  normalizarVetor(x, y) {
    const comprimento = Math.hypot(x, y);
    if (comprimento === 0) return { x: 0, y: 0 };
    return { x: x / comprimento, y: y / comprimento };
  },

  interpolar(inicio, fim, fracao) {
    return inicio + (fim - inicio) * fracao;
  },

  escolherAleatorio(array) {
    return array[Math.floor(Math.random() * array.length)];
  },

  timestamp() {
    return window.performance.now();
  }
};
