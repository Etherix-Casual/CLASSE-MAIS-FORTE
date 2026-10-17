window.createBattleConfig = function (scope) {
  with (scope) {
  function normalizeConfig(saved) {
    const normalized = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    if (!saved || typeof saved !== 'object') return normalized;
    for (const side of ['azul', 'vermelho']) {
      const player = saved.personagens && saved.personagens[side];
      if (player && typeof player === 'object') {
        const legacyClasses = { swordsman: 'espadachim', martial: 'espadachim', lutador: 'espadachim' };
        const classKey = legacyClasses[player.classe] || player.classe;
        if (Classes[classKey]) normalized.personagens[side].classe = classKey;
        const level = Number(player.nivel);
        if (Number.isFinite(level)) normalized.personagens[side].nivel = Math.max(1, Math.min(7, Math.round(level)));
        if (typeof player.jogador === 'boolean') normalized.personagens[side].jogador = player.jogador;
        const reflex = Number(player.reflexo);
        if (Number.isFinite(reflex)) normalized.personagens[side].reflexo = Math.max(0, Math.min(100, reflex));
        if (['pequeno', 'padrao', 'grande', 'colossal'].includes(player.variant)) normalized.personagens[side].variant = player.variant;
        if (typeof player.nome === 'string') normalized.personagens[side].nome = player.nome.trim().slice(0, 24);
        if (typeof player.cor === 'string' && /^#[0-9a-f]{6}$/i.test(player.cor)) normalized.personagens[side].cor = player.cor;
      }
      const abilities = saved.habilidades && saved.habilidades[side];
      if (abilities && typeof abilities === 'object') {
        for (const key of ABILITY_KEYS) {
          if (abilities[key] === 'unlocked' || abilities[key] === 'blocked' || abilities[key] === 'hidden') {
            normalized.habilidades[side][key] = abilities[key];
          } else if (typeof abilities[key] === 'boolean') {
            normalized.habilidades[side][key] = abilities[key] ? 'blocked' : 'unlocked';
          }
        }
      }
    }
    const effects = saved.efeitos || {};
    if (Number.isFinite(Number(effects.shake))) normalized.efeitos.shake = Math.max(0, Math.min(100, Number(effects.shake)));
    if (Number.isFinite(Number(effects.particulas))) normalized.efeitos.particulas = Math.max(0, Math.min(100, Number(effects.particulas)));
    for (const key of ['flash', 'slowMo', 'focus', 'trail']) {
      if (typeof effects[key] === 'boolean') normalized.efeitos[key] = effects[key];
    }
    const cameraConfig = saved.camera || {};
    if (Number.isFinite(Number(cameraConfig.zoom))) normalized.camera.zoom = Math.max(40, Math.min(150, Number(cameraConfig.zoom)));
    if (Number.isFinite(Number(cameraConfig.tracking))) normalized.camera.tracking = Math.max(1, Math.min(5, Number(cameraConfig.tracking)));
    if (typeof cameraConfig.focus === 'boolean') normalized.camera.focus = cameraConfig.focus;
    const world = saved.mundo || {};
    if (['espaco', 'ceu', 'grid', 'vazio'].includes(world.cenario)) normalized.mundo.cenario = world.cenario;
    if (Number.isFinite(Number(world.estrelas))) normalized.mundo.estrelas = Math.max(0, Math.min(200, Number(world.estrelas)));
    if (typeof world.borda === 'boolean') normalized.mundo.borda = world.borda;
    if (Number.isFinite(Number(world.cor))) normalized.mundo.cor = Math.max(0, Math.min(360, Number(world.cor)));
    if (Number.isFinite(Number(world.tamanho))) normalized.mundo.tamanho = Math.max(80, Math.min(200, Number(world.tamanho)));
    for (const key of Object.keys(normalized.recursos)) {
      const resource = saved.recursos && saved.recursos[key];
      if (!resource || typeof resource !== 'object') continue;
      if (Number.isFinite(Number(resource.max))) normalized.recursos[key].max = Math.max(0, Math.min(300, Number(resource.max)));
      if (Number.isFinite(Number(resource.regen))) normalized.recursos[key].regen = Math.max(0, Math.min(300, Number(resource.regen)));
    }
    return normalized;
  }
  function loadConfig() {
    try {
      const stored = localStorage.getItem(CONFIG_KEY);
      const legacyStored = stored ? null : localStorage.getItem('batalha_config_v1');
      config = stored
        ? normalizeConfig(JSON.parse(stored))
        : legacyStored ? normalizeConfig(JSON.parse(legacyStored)) : normalizeConfig(null);
      if (legacyStored) {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
        localStorage.removeItem('batalha_config_v1');
      }
    } catch (error) {
      console.error(`Não foi possível carregar ${CONFIG_KEY}; usando configuração padrão.`, error);
      config = normalizeConfig(null);
    }
    applyConfigToControls();
    applyConfigRuntime();
  }
  function saveConfig() {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch (error) {
      console.error(`Não foi possível salvar ${CONFIG_KEY}.`, error);
    }
  }
  function setConfigValue(path, value) {
    const keys = path.split('.');
    let target = config;
    for (let i = 0; i < keys.length - 1; i++) target = target[keys[i]];
    target[keys[keys.length - 1]] = value;
  }
  function hexToHue(hex) {
    const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
    const max = Math.max(...channels), min = Math.min(...channels);
    if (max === min) return 0;
    const delta = max - min;
    const hue = max === channels[0]
      ? ((channels[1] - channels[2]) / delta) % 6
      : max === channels[1]
        ? (channels[2] - channels[0]) / delta + 2
        : (channels[0] - channels[1]) / delta + 4;
    return Math.round((hue * 60 + 360) % 360);
  }
  function applyConfigToControls() {
    const values = {
      'personagens.azul.classe': config.personagens.azul.classe,
      'personagens.azul.nivel': config.personagens.azul.nivel,
      'personagens.azul.jogador': config.personagens.azul.jogador,
      'personagens.azul.reflexo': config.personagens.azul.reflexo,
      'personagens.azul.variant': config.personagens.azul.variant,
      'personagens.azul.nome': config.personagens.azul.nome,
      'personagens.azul.cor': config.personagens.azul.cor || '#66ccff',
      'personagens.vermelho.classe': config.personagens.vermelho.classe,
      'personagens.vermelho.nivel': config.personagens.vermelho.nivel,
      'personagens.vermelho.jogador': config.personagens.vermelho.jogador,
      'personagens.vermelho.reflexo': config.personagens.vermelho.reflexo,
      'personagens.vermelho.variant': config.personagens.vermelho.variant,
      'personagens.vermelho.nome': config.personagens.vermelho.nome,
      'personagens.vermelho.cor': config.personagens.vermelho.cor || '#ff6666',
      'efeitos.shake': config.efeitos.shake, 'efeitos.flash': config.efeitos.flash,
      'efeitos.slowMo': config.efeitos.slowMo, 'efeitos.focus': config.efeitos.focus,
      'efeitos.particulas': config.efeitos.particulas, 'efeitos.trail': config.efeitos.trail,
      'camera.zoom': config.camera.zoom, 'camera.tracking': config.camera.tracking,
      'camera.focus': config.camera.focus, 'mundo.cenario': config.mundo.cenario,
      'mundo.estrelas': config.mundo.estrelas, 'mundo.borda': config.mundo.borda,
      'mundo.cor': config.mundo.cor, 'mundo.tamanho': config.mundo.tamanho
    };
    for (const [path, value] of Object.entries(values)) {
      const input = document.querySelector(`[data-config="${path}"]`);
      if (input) {
        if (input.type === 'checkbox') input.checked = value;
        else input.value = String(value);
        updateRangeOutput(input);
      }
    }
    for (const side of ['azul', 'vermelho']) {
      for (const key of ABILITY_KEYS) {
        const input = document.querySelector(`[data-ability-side="${side}"][data-ability="${key}"]`);
        if (input) input.value = config.habilidades[side][key];
      }
    }
    const hueControl = document.querySelector('[data-config="mundo.cor"]');
    if (hueControl) hueControl.style.setProperty('--hue-color', `hsl(${config.mundo.cor}, 100%, 55%)`);
  }
  function updateRangeOutput(input) {
    if (!input || input.type !== 'range' || !input.dataset.output) return;
    const output = document.getElementById(input.dataset.output);
    if (output) output.textContent = `${input.value}${input.dataset.suffix || ''}`;
  }
  function applyConfigRuntime() {
    camera.zoomMul = config.camera.zoom / 100;
    camera.tracking = config.camera.tracking;
    camera.focusEnabled = config.camera.focus;
    WORLD.w = 3200 * config.mundo.tamanho / 100;
    WORLD.h = 1800 * config.mundo.tamanho / 100;
    BattleFX.configure({
      shake: config.efeitos.shake / 100,
      flash: config.efeitos.flash,
      slowMo: config.efeitos.slowMo,
      focus: config.efeitos.focus && config.camera.focus
    });
    if (blueF && redF) {
      for (const [fighter, side] of [[blueF, 'azul'], [redF, 'vermelho']]) {
        fighter.aiLevel = config.personagens[side].nivel;
        fighter.reflex = config.personagens[side].reflexo / 100;
        fighter.abilityModes = config.habilidades[side];
        fighter.abilities = Object.fromEntries(ABILITY_KEYS.map(key => [
          key, config.habilidades[side][key] !== 'unlocked'
        ]));
        fighter.isPlayer = config.personagens[side].jogador;
        fighter.resources.define(fighter.resourceDefinitions(), config.recursos, true);
        fighter.name = config.personagens[side].nome;
        const sizeFactors = { pequeno: 0.72, padrao: 1, grande: 1.3, colossal: 1.75 };
        fighter.sizeMul = sizeFactors[config.personagens[side].variant] || 1;
        fighter.bodyRadius = 40 * fighter.sizeMul;
        fighter.hue = config.personagens[side].cor
          ? hexToHue(config.personagens[side].cor)
          : fighter.classCfg.hue;
      }
      updateControlButtons();
      updateHUD();
    }
  }
  function resetAllConfig() {
    try {
      localStorage.removeItem(CONFIG_KEY);
    } catch (error) {
      console.error(`Não foi possível limpar ${CONFIG_KEY}.`, error);
    }
    config = normalizeConfig(null);
    applyConfigToControls();
    BattleGame.reset();
    const preset = document.getElementById('cfgPreset');
    if (preset) preset.value = 'ia_vs_ia';
    updatePresetButtons('ia_vs_ia');
    const panel = document.getElementById('cfgPanel');
    if (panel) panel.querySelectorAll('details').forEach(section => { section.open = section.dataset.defaultOpen === 'true'; });
    if (window.openBattleConfigTab) window.openBattleConfigTab('geral');
    debug.open = false;
  }
  function applyPreset(name) {
    if (!['ia_vs_ia', 'duelo', 'sandbox', 'espectador'].includes(name)) return;
    config = normalizeConfig(null);
    if (name === 'duelo') {
      config.personagens.azul.jogador = true;
      config.efeitos.slowMo = true;
    } else if (name === 'espectador') {
    config.efeitos.slowMo = false;
    config.efeitos.focus = false;
    } else if (name === 'sandbox') {
      config.personagens.azul.jogador = true;
      config.personagens.azul.nivel = 1;
      config.personagens.vermelho.nivel = 1;
      config.efeitos.slowMo = false;
      config.efeitos.shake = 35;
    }
    applyConfigToControls();
    applyConfigRuntime();
    saveConfig();
    BattleGame.reset();
    updatePresetButtons(name);
  }
  function bindConfigControls() {
    const update = (input) => {
      const path = input.dataset.config;
      if (!path) return;
      let value = input.type === 'checkbox' ? input.checked : input.value;
      if (input.type === 'range' || input.type === 'number') value = Number(value);
      if (path.endsWith('.nivel')) value = Number(value);

      if (path.endsWith('.jogador') && value) {
        const otherSide = path.includes('.azul.') ? 'vermelho' : 'azul';
        config.personagens[otherSide].jogador = false;
      }
      setConfigValue(path, value);
      if (path === 'personagens.azul.jogador' || path === 'personagens.vermelho.jogador') {
        applyConfigToControls();
      }
      updateRangeOutput(input);
      if (path === 'mundo.cor') input.style.setProperty('--hue-color', `hsl(${value}, 100%, 55%)`);
      saveConfig();
      if (path.endsWith('.classe') || path === 'mundo.tamanho') BattleGame.reset();
      else applyConfigRuntime();
    };

    document.querySelectorAll('[data-config]').forEach(input => {
      const eventName = input.dataset.config === 'mundo.tamanho' || input.type !== 'range' ? 'change' : 'input';
      input.addEventListener(eventName, () => update(input));
    });
    document.querySelectorAll('[data-ability-side][data-ability]').forEach(input => {
      input.addEventListener('change', () => {
        const side = input.dataset.abilitySide;
        const key = input.dataset.ability;
        config.habilidades[side][key] = input.value;
        saveConfig();
        applyConfigRuntime();
      });
    });
  }
    return { normalizeConfig, loadConfig, saveConfig, setConfigValue, hexToHue, applyConfigToControls, updateRangeOutput, applyConfigRuntime, resetAllConfig, applyPreset, bindConfigControls };
  }
};
