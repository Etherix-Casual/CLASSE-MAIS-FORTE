/* ============================================================
   data.js — Constantes, tabelas, status
   ============================================================ */
window.BattleData = {

  MODO_INICIAL: 'ia_vs_ia',

  AI_LEVELS: {
    1: { reaction: [0.4, 0.6], aimNear: 0.35, aimFar: 0.35, misread: 0.4, fatigue: 1, panic: 1, observe: 0.15, decision: 2.2 },
    2: { reaction: [0.4, 0.6], aimNear: 0.35, aimFar: 0.35, misread: 0.3, fatigue: 0.85, panic: 0.85, observe: 0.1, decision: 1.9 },
    3: { reaction: [0.25, 0.4], aimNear: 0.05, aimFar: 0.2, misread: 0.25, fatigue: 0.65, panic: 0.65, observe: 0.08, decision: 1.55 },
    4: { reaction: [0.25, 0.4], aimNear: 0.05, aimFar: 0.2, misread: 0.15, fatigue: 0.45, panic: 0.45, observe: 0.06, decision: 1.35 },
    5: { reaction: [0.06, 0.22], aimNear: 0.01, aimFar: 0.02, misread: 0.08, fatigue: 0.25, panic: 0.25, observe: 0.03, decision: 1.15 },
    6: { reaction: [0.06, 0.22], aimNear: 0.01, aimFar: 0.02, misread: 0.04, fatigue: 0.1, panic: 0.1, observe: 0.01, decision: 1.05 },
    7: { reaction: [0, 0], aimNear: 0, aimFar: 0, misread: 0, fatigue: 0, panic: 0, observe: 0, decision: 1 }
  },

  PARAMS: {
    meditHP: 4,
    meditStamina: 20,
    meditMana: 60,
    dodgeDur: 0.22,
    dodgeIframes: 0.35,
    maxUltDur: 14,
    maxSpecialDur: 12,
    staminaRegen: 5
  },

  /* ============================================================
     STATUS EFFECTS — categoria única
     Cada status tem: id, label, hue, dur, e efeitos (dot, slow, etc)
     ============================================================ */
  STATUS: {
    bleeding:   { label: 'BLD',  hue: 0,   dur: 6,  dot: 3,   icon: '🩸' },  // dano por segundo
    burning:    { label: 'BRN',  hue: 20,  dur: 5,  dot: 6,   icon: '🔥' },
    frozen:     { label: 'FRZ',  hue: 190, dur: 3,  slow: 0.4, icon: '❄' },
    slowed:     { label: 'SLOW', hue: 190, dur: 1.5, slow: 0.5, icon: '⌁' },
    electrified:{ label: 'ELT',  hue: 55,  dur: 6,  stunEach: 2, stunDur: 0.4, icon: '⚡' },
    cursed:     { label: 'CRS',  hue: 280, dur: 8,  dmgTakenMul: 1.35, icon: '☠' },
    blessed:    { label: 'BLS',  hue: 50,  dur: 8,  dmgDealtMul: 1.3, heal: 3, icon: '✦' }
  },
  // Ordem de prioridade (aplica todos; status não substituem, coexistem)
  STATUS_ORDER: ['bleeding','burning','frozen','slowed','electrified','cursed','blessed'],

  /* ============================================================
     HABILIDADES — custos e cooldowns
     ============================================================ */
  HABILIDADES: {
    // -- Ataques básicos (sem custo, cd baixo) --
    ataque_basico:    { custo: {},                                   cd: 0.32, label: 'ATK' },
    ataque_secundario:{ custo: {},                                   cd: 0.55, label: 'SEC' },

    // -- Mobilidade --
    dash:             { custo: { stamina: 20 },                      cd: 0.6,  label: 'DSH' },
    super_dash:       { custo: { stamina: 45 },                      cd: 8,    label: 'X'   },
    parry:            { custo: {},                                   cd: 1.4,  label: 'PAR' },
    escudo:           { custo: {},                                   cd: 0.4,  label: 'ESC' },

    // -- Especiais básicos --
    especial_z:       { custo: { stamina: 100 },                    cd: 5,    label: 'Z'   },
    especial_c:       { custo: { stamina: 130 },                    cd: 12,   label: 'C'   },
    especial_v:       { custo: { stamina: 140 },                    cd: 10,   label: 'V'   },
    especial_e:       { custo: { stamina: 200 },                    cd: 8,    label: 'E'   },

    // -- Slots fixos de habilidade --
    skill_z:          { custo: { stamina: 80 },                      cd: 5,    label: 'Z'   },
    skill_x:          { custo: { stamina: 95 },                     cd: 8,    label: 'X'   },
    skill_c:          { custo: { stamina: 150 },                    cd: 12,   label: 'C'   },
    skill_v:          { custo: { stamina: 175 },                    cd: 15,   label: 'V'   },

    // -- Recuperação --
    meditar:          { custo: {},                                   cd: 0,    label: 'R'   },

    // -- Ultimates --
    ult1:             { custo: { stamina: 300 },                    cd: 55,   label: 'Y'   },
    ult2:             { custo: { stamina: 250 },                    cd: 90,   label: 'H'   },

    // -- Transformação --
    transform_t:      { custo: { stamina: 200 },                    cd: 90,   label: 'T'   },
    transform_g:      { custo: { stamina: 160 },                    cd: 45,   label: 'G'   },
    transform_b:      { custo: { stamina: 210 },                    cd: 30,   label: 'B'   }
  },

  /* ============================================================
     TIPOS DE PROJÉTIL
     ============================================================ */
  PROJ_TYPES: {
    // Orbes do mago
    pure_orb:    { hue: 200, radius: 14, life: 2.5, trail: 8 },
    homing_orb:  { hue: 280, radius: 12, life: 4,   trail: 10, homing: true },

    // Elementais
    fire:        { hue: 15,  radius: 18, life: 2.5, trail: 8,  status: { id: 'burning', dur: 5 } },
    ice:         { hue: 190, radius: 16, life: 2.5, trail: 8,  status: { id: 'frozen', dur: 3 } },
    electric:    { hue: 55,  radius: 14, life: 2.5, trail: 8,  status: { id: 'electrified', dur: 6 } },
    shadow:      { hue: 280, radius: 20, life: 3,   trail: 10, unblockable: true, status: { id: 'cursed', dur: 8 } },
    light:       { hue: 50,  radius: 12, life: 2,   trail: 6,  status: { id: 'blessed', dur: 8 } },
    stone:       { hue: 40,  radius: 15, life: 2.5, trail: 6 },
    arcane:      { hue: 300, radius: 24, life: 3,   trail: 12 },
    blackhole:   { hue: 280, radius: 34, life: 7,   trail: 0, unblockable: true, special: true },
    slash:       { hue: 320, radius: 18, life: 1.5, trail: 10 }
  },

  WORLD: { w: 3200, h: 1800 }
};