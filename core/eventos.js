window.Eventos = (() => {
  const ouvintesPorEvento = new Map();

  function registrar(nome, callback, umaVez) {
    if (typeof callback !== 'function') {
      throw new TypeError('O ouvinte de um evento deve ser uma função.');
    }

    const entrada = { callback, umaVez };
    let ouvintes = ouvintesPorEvento.get(nome);
    if (!ouvintes) {
      ouvintes = new Set();
      ouvintesPorEvento.set(nome, ouvintes);
    }
    ouvintes.add(entrada);

    return () => {
      ouvintes.delete(entrada);
      if (ouvintes.size === 0) ouvintesPorEvento.delete(nome);
    };
  }

  return {
    escutar(nome, callback) {
      return registrar(nome, callback, false);
    },

    escutarUmaVez(nome, callback) {
      return registrar(nome, callback, true);
    },

    emitir(nome, dados) {
      const ouvintes = ouvintesPorEvento.get(nome);
      if (!ouvintes) return;

      const payload = dados === undefined ? {} : dados;
      for (const entrada of [...ouvintes]) {
        if (!ouvintes.has(entrada)) continue;
        if (entrada.umaVez) ouvintes.delete(entrada);
        try {
          entrada.callback(payload);
        } catch (erro) {
          console.warn(`Eventos: falha em ouvinte do evento "${nome}".`, erro);
        }
      }
      if (ouvintes.size === 0) ouvintesPorEvento.delete(nome);
    },

    limpar(nome) {
      if (arguments.length === 0) {
        ouvintesPorEvento.clear();
        return;
      }
      ouvintesPorEvento.delete(nome);
    },

    ouvintes(nome) {
      return ouvintesPorEvento.get(nome)?.size || 0;
    }
  };
})();
