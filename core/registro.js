window.Registro = (() => {
  const classes = new Map();
  const efeitos = new Map();
  const problemas = [];
  const efeitosDesativados = new Set();

  function avisar(tipo, nome, erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    problemas.push({ tipo, nome, mensagem });
  }

  function fallbackClasse(nome) {
    return {
      name: `${nome} (indisponível)`,
      hue: 0,
      stats: {
        hp: 1,
        resistance: 0,
        maxSpeed: 0,
        basicRange: 0,
        resources: { vida: 1, stamina: 0, mana: 0, eter: 0, regen: {} }
      },
      moveset: {},
      aiArchetype: { style: { desiredMin: 0, desiredMax: 0, keepDistance: false } }
    };
  }

  function efeitoNoop() {
    return {
      atualizar() {},
      desenhar() {},
      limpar() {},
      estaAtivo() { return false; },
      buscarDono() { return null; }
    };
  }

  function normalizarEfeito(entrada, nome) {
    if (!entrada || (typeof entrada !== 'object' && typeof entrada !== 'function')) {
      throw new TypeError(`Efeito "${nome}" deve ser um singleton ou função de fábrica.`);
    }
    if (typeof entrada.criar !== 'function' ||
        typeof entrada.atualizar !== 'function' ||
        typeof entrada.desenhar !== 'function' ||
        typeof entrada.limpar !== 'function') {
      throw new TypeError(`Efeito "${nome}" deve implementar criar, atualizar, desenhar e limpar.`);
    }
    return entrada;
  }

  return {
    registrarClasse(nome, fabrica) {
      classes.set(nome, fabrica);
    },

    criarClasse(nome, contexto) {
      const fabrica = classes.get(nome);
      if (!fabrica) {
        avisar('classe', nome, 'Classe não registrada.');
        return fallbackClasse(nome);
      }
      try {
        return fabrica(contexto);
      } catch (erro) {
        avisar('classe', nome, erro);
        return fallbackClasse(nome);
      }
    },

    listarClasses() {
      return [...classes.keys()];
    },

    obterFallback() {
      return fallbackClasse('indisponível');
    },

    registrarEfeito(nome, efeito) {
      const singleton = normalizarEfeito(efeito, nome);
      efeitos.set(nome, singleton);
    },

    obterEfeito(nome) {
      const efeito = efeitos.get(nome);
      if (efeito && !efeitosDesativados.has(nome)) return efeito;
      if (efeito) return efeitoNoop();
      avisar('efeito', nome, 'Efeito não registrado.');
      const noop = efeitoNoop();
      noop.criar = efeitoNoop;
      return noop;
    },

    criarEfeito(nome, args) {
      const efeito = this.obterEfeito(nome);
      if (!efeito || typeof efeito.criar !== 'function') return efeitoNoop();
      try {
        const valores = args === undefined ? [] : Array.isArray(args) ? args : [args];
        return efeito.criar(...valores);
      } catch (erro) {
        avisar('efeito', nome, erro);
        return efeitoNoop();
      }
    },

    listarEfeitos() {
      return [...efeitos.keys()];
    },

    atualizarEfeitos(dt, contexto) {
      for (const [nome, efeito] of efeitos) {
        if (efeitosDesativados.has(nome)) continue;
        try {
          efeito.atualizar(dt, contexto);
        } catch (erro) {
          avisar('efeito', nome, erro);
          efeitosDesativados.add(nome);
          try {
            efeito.limpar();
          } catch (erroAoLimpar) {
            avisar('efeito', nome, erroAoLimpar);
          }
        }
      }
    },

    desenharEfeitos(ctx, contexto) {
      for (const [nome, efeito] of efeitos) {
        if (efeitosDesativados.has(nome)) continue;
        try {
          efeito.desenhar(ctx, contexto);
        } catch (erro) {
          avisar('efeito', nome, erro);
          efeitosDesativados.add(nome);
          try {
            efeito.limpar();
          } catch (erroAoLimpar) {
            avisar('efeito', nome, erroAoLimpar);
          }
        }
      }
    },

    limparEfeitos() {
      for (const [nome, efeito] of efeitos) {
        try {
          efeito.limpar();
        } catch (erro) {
          avisar('efeito', nome, erro);
        }
      }
      efeitosDesativados.clear();
    },

    avisos() {
      return problemas.map(problema => ({ ...problema }));
    },

    limparAvisos() {
      problemas.length = 0;
    }
  };
})();

setTimeout(() => {
  console.log(`Registro: ${window.Registro.listarClasses().length} classes, ${window.Registro.listarEfeitos().length} efeitos, ${window.Registro.avisos().length} avisos`);
}, 0);
