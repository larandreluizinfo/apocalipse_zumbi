(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const ui = {
    hud: document.getElementById('hud'),
    round: document.getElementById('round'),
    remaining: document.getElementById('remaining'),
    kills: document.getElementById('kills'),
    score: document.getElementById('score'),
    hpFill: document.getElementById('hp-fill'),
    hpText: document.getElementById('hp-text'),
    weaponName: document.getElementById('weapon-name'),
    bossBar: document.getElementById('boss-bar'),
    bossFill: document.getElementById('boss-fill'),
    prompt: document.getElementById('prompt'),
    toast: document.getElementById('toast'),
    menu: document.getElementById('menu'),
    loot: document.getElementById('loot'),
    end: document.getElementById('end'),
    lootCards: document.getElementById('loot-cards'),
    lootHint: document.getElementById('loot-hint'),
    vehicleCar: document.getElementById('vehicle-car'),
    vehicleMoto: document.getElementById('vehicle-moto'),
    escapeBtn: document.getElementById('escape-btn'),
    continueBtn: document.getElementById('continue-btn'),
    endEyebrow: document.getElementById('end-eyebrow'),
    endTitle: document.getElementById('end-title'),
    endMessage: document.getElementById('end-message'),
    endStats: document.getElementById('end-stats'),
    startBtn: document.getElementById('start-btn'),
    restartBtn: document.getElementById('restart-btn'),
  };

  const TAU = Math.PI * 2;

  const WEAPONS = {
    faca: {
      name: 'Faca', kind: 'melee', kindLabel: 'Corpo a corpo',
      damage: 30, cooldown: 0.3, range: 64, arc: 1.15, color: '#cfd8dc',
    },
    espada: {
      name: 'Espada', kind: 'melee', kindLabel: 'Corpo a corpo',
      damage: 45, cooldown: 0.45, range: 86, arc: 1.25, color: '#b0bec5',
    },
    lanca: {
      name: 'Lança Humana', kind: 'melee', kindLabel: 'Corpo a corpo',
      damage: 65, cooldown: 0.6, range: 136, arc: 0.5, color: '#d7ccc8',
    },
    machado: {
      name: 'Machado Gigante', kind: 'melee', kindLabel: 'Corpo a corpo',
      damage: 105, cooldown: 0.85, range: 108, arc: 1.95, color: '#ffb74d',
    },
    arco: {
      name: 'Arco e Flechas', kind: 'ranged', kindLabel: 'Distância',
      damage: 60, cooldown: 0.72, speed: 860, radius: 5, color: '#c5e1a5',
    },
    metralhadora: {
      name: 'Metralhadora', kind: 'ranged', kindLabel: 'Distância',
      damage: 16, cooldown: 0.085, speed: 1000, radius: 3, spread: 0.1, color: '#ffd54f',
    },
  };

  const ORDER = ['faca', 'espada', 'lanca', 'machado', 'arco', 'metralhadora'];

  const ENEMIES = {
    normal: { hp: 42, speed: 78, damage: 10, score: 10, r: 16, color: '#6f9e4a' },
    fast: { hp: 26, speed: 128, damage: 7, score: 15, r: 13, color: '#c9b23f' },
    tank: { hp: 130, speed: 55, damage: 18, score: 30, r: 24, color: '#9e4a4a' },
    boss: { hp: 900, speed: 66, damage: 26, score: 1000, r: 46, color: '#8e3aa8' },
  };

  const keys = new Set();
  const mouse = { x: window.innerWidth / 2 + 120, y: window.innerHeight / 2, down: false };

  let W = window.innerWidth;
  let H = window.innerHeight;
  let DPR = 1;
  let state = null;
  let muted = false;
  let audio = null;
  let toastTimer = null;
  let lastTime = 0;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function angleDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    return d;
  }

  function statBlock(label, value) {
    return `<div><span class="label">${label}</span><strong>${value}</strong></div>`;
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (state && state.player) {
      state.player.x = clamp(state.player.x, 24, W - 24);
      state.player.y = clamp(state.player.y, 24, H - 24);
    }
  }

  function createState() {
    return {
      mode: 'menu',
      time: 0,
      round: 1,
      kills: 0,
      score: 0,
      roundKills: 0,
      totalToSpawn: 0,
      spawned: 0,
      spawnTimer: 0,
      bossSpawned: false,
      endless: false,
      intermission: 0,
      shake: 0,
      lootOpened: false,
      arsenalUnlocked: false,
      vehicle: null,
      chest: null,
      player: {
        x: W / 2, y: H / 2, r: 16,
        hp: 100, maxHp: 100, speed: 220,
        angle: 0, fireCd: 0, iframe: 0,
        weapon: 'faca',
      },
      enemies: [],
      bullets: [],
      particles: [],
      decals: [],
      pickups: [],
      swings: [],
    };
  }

  function initAudio() {
    if (audio) return;
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      audio = new AudioCtor();
    } catch (error) {
      audio = null;
    }
  }

  function tone(freq, duration, type, volume, endFreq) {
    if (!audio || muted) return;
    const now = audio.currentTime;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type || 'square';
    oscillator.frequency.setValueAtTime(freq, now);
    if (endFreq) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(volume || 0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  function sfx(name) {
    if (!audio || muted) return;
    switch (name) {
      case 'melee': tone(190, 0.07, 'sawtooth', 0.03, 90); break;
      case 'shoot': tone(640, 0.045, 'square', 0.022, 240); break;
      case 'bow': tone(330, 0.11, 'triangle', 0.03, 130); break;
      case 'hit': tone(95, 0.07, 'triangle', 0.03, 55); break;
      case 'kill': tone(80, 0.11, 'sawtooth', 0.028, 42); break;
      case 'hurt': tone(130, 0.17, 'square', 0.045, 60); break;
      case 'pickup': tone(620, 0.08, 'sine', 0.035, 900); break;
      case 'level': tone(520, 0.12, 'sine', 0.035, 780); setTimeout(() => tone(800, 0.16, 'sine', 0.035, 1040), 110); break;
      case 'chest': tone(440, 0.1, 'triangle', 0.04, 660); setTimeout(() => tone(660, 0.12, 'triangle', 0.04, 880), 100); setTimeout(() => tone(880, 0.18, 'triangle', 0.04, 1320), 210); break;
      case 'boss': tone(150, 0.4, 'sawtooth', 0.05, 45); setTimeout(() => tone(100, 0.5, 'square', 0.04, 35), 180); break;
      case 'win': tone(523, 0.14, 'sine', 0.04, 659); setTimeout(() => tone(659, 0.14, 'sine', 0.04, 784), 130); setTimeout(() => tone(784, 0.26, 'sine', 0.04, 1046), 260); break;
      case 'lose': tone(220, 0.25, 'sawtooth', 0.045, 110); setTimeout(() => tone(150, 0.4, 'sawtooth', 0.04, 60), 180); break;
      default: break;
    }
  }

  function showToast(title, subtitle) {
    ui.toast.innerHTML = `${title}<span>${subtitle || ''}</span>`;
    ui.toast.classList.remove('show');
    void ui.toast.offsetWidth;
    ui.toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 2700);
  }

  function startGame() {
    initAudio();
    if (audio && audio.state === 'suspended') audio.resume();
    state = createState();
    state.mode = 'playing';
    ui.menu.classList.add('hidden');
    ui.loot.classList.add('hidden');
    ui.end.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    ui.bossBar.classList.add('hidden');
    ui.prompt.classList.add('hidden');
    mouse.x = W / 2 + 120;
    mouse.y = H / 2;
    mouse.down = false;
    startRound(1);
  }

  function startRound(round) {
    state.round = round;
    state.roundKills = 0;
    state.spawned = 0;
    state.bossSpawned = false;
    state.spawnTimer = 1;
    state.totalToSpawn = round === 10 ? 9 : 4 + round * 2;
    state.intermission = 0;
    if (round === 10) {
      showToast('RODADA 10', 'O chefe despertou');
    } else {
      showToast(`RODADA ${round}`, `${state.totalToSpawn} zumbis na horda`);
    }
  }

  function pickZombieType(round) {
    const roll = Math.random();
    if (round >= 4 && roll < 0.15) return 'tank';
    if (round >= 2 && roll < 0.44) return 'fast';
    return 'normal';
  }

  function spawnPosition(radius) {
    const margin = radius + 14;
    let point = { x: W / 2, y: margin };
    for (let attempt = 0; attempt < 12; attempt++) {
      const side = Math.floor(Math.random() * 4);
      if (side === 0) point = { x: rand(margin, W - margin), y: margin };
      else if (side === 1) point = { x: W - margin, y: rand(margin, H - margin) };
      else if (side === 2) point = { x: rand(margin, W - margin), y: H - margin };
      else point = { x: margin, y: rand(margin, H - margin) };
      const dx = point.x - state.player.x;
      const dy = point.y - state.player.y;
      if (dx * dx + dy * dy > 230 * 230) break;
    }
    return point;
  }

  function spawnEnemy(type) {
    const base = ENEMIES[type];
    const position = spawnPosition(base.r);
    const hpScale = type === 'boss' ? 1 : 1 + Math.max(0, state.round - 1) * 0.065;
    const enemy = {
      type,
      boss: type === 'boss',
      x: position.x,
      y: position.y,
      r: base.r,
      speed: base.speed * (1 + Math.min(0.4, (state.round - 1) * 0.025)),
      hp: base.hp * hpScale,
      maxHp: base.hp * hpScale,
      damage: base.damage,
      score: base.score,
      color: base.color,
      flash: 0,
      hitCd: 0,
      dead: false,
    };
    state.enemies.push(enemy);
    burst(enemy.x, enemy.y, enemy.boss ? '#d17bff' : enemy.color, enemy.boss ? 24 : 6, enemy.boss ? 220 : 80, 2, 0.35);
    if (enemy.boss) {
      state.bossSpawned = true;
      state.shake = Math.max(state.shake, 16);
      sfx('boss');
    }
  }

  function addDecal(x, y, r, color) {
    state.decals.push({
      x, y, r,
      color,
      rotation: Math.random() * TAU,
      alpha: rand(0.18, 0.34),
    });
    if (state.decals.length > 140) state.decals.shift();
  }

  function burst(x, y, color, count, speed, size, life) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * TAU;
      const velocity = rand(speed * 0.25, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        size: rand(size * 0.5, size),
        color,
        life: rand(life * 0.5, life),
        maxLife: life,
      });
    }
  }

  function damageEnemy(enemy, amount, hitX, hitY) {
    if (enemy.dead) return;
    enemy.hp -= amount;
    enemy.flash = 0.08;
    burst(hitX || enemy.x, hitY || enemy.y, enemy.boss ? '#d17bff' : '#aed581', 3, 100, 2, 0.3);
    sfx('hit');
    if (enemy.hp <= 0) killEnemy(enemy);
  }

  function killEnemy(enemy) {
    if (enemy.dead) return;
    enemy.dead = true;
    state.kills += 1;
    state.roundKills += 1;
    state.score += enemy.score;
    addDecal(enemy.x, enemy.y, enemy.r * rand(1, 1.7), enemy.boss ? '#4a1259' : '#3b1c1c');
    burst(enemy.x, enemy.y, enemy.boss ? '#c77dff' : '#7cb342', enemy.boss ? 44 : 12, enemy.boss ? 300 : 170, enemy.boss ? 5 : 3, 0.6);
    sfx('kill');

    if (enemy.boss) {
      state.chest = {
        x: clamp(enemy.x, 80, W - 80),
        y: clamp(enemy.y, 80, H - 80),
      };
      state.lootOpened = false;
      state.spawned = state.totalToSpawn;
      state.roundKills = state.totalToSpawn;
      state.intermission = 0;
      state.shake = 28;
      for (const other of state.enemies) {
        if (other !== enemy && !other.dead) {
          other.dead = true;
          addDecal(other.x, other.y, other.r, '#3b1c1c');
          burst(other.x, other.y, '#7cb342', 10, 150, 3, 0.5);
        }
      }
      showToast('CHEFE DERROTADO', 'O baú de guerra apareceu');
      sfx('chest');
    } else if (Math.random() < 0.11 && state.pickups.length < 8) {
      state.pickups.push({
        x: enemy.x,
        y: enemy.y,
        r: 12,
        life: 14,
        phase: Math.random() * TAU,
      });
    }
  }

  function damagePlayer(amount) {
    const player = state.player;
    if (player.iframe > 0 || state.mode !== 'playing') return;
    player.hp -= amount;
    player.iframe = 0.55;
    state.shake = Math.max(state.shake, 12);
    burst(player.x, player.y, '#ff5252', 10, 160, 3, 0.45);
    sfx('hurt');
    if (player.hp <= 0) {
      player.hp = 0;
      burst(player.x, player.y, '#ff5252', 30, 260, 4, 0.9);
      endGame(false);
    }
  }

  function attack() {
    const player = state.player;
    const weapon = WEAPONS[player.weapon];
    player.fireCd = weapon.cooldown;

    if (weapon.kind === 'melee') {
      state.swings.push({
        angle: player.angle,
        range: weapon.range,
        arc: weapon.arc,
        color: weapon.color,
        life: 0.16,
        maxLife: 0.16,
      });
      sfx('melee');
      for (const enemy of state.enemies) {
        if (enemy.dead) continue;
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const distance = Math.hypot(dx, dy) || 1;
        if (distance > weapon.range + enemy.r) continue;
        const difference = Math.abs(angleDiff(Math.atan2(dy, dx), player.angle));
        if (difference <= weapon.arc / 2 + enemy.r / distance) {
          damageEnemy(enemy, weapon.damage, player.x + dx * 0.7, player.y + dy * 0.7);
        }
      }
      return;
    }

    const baseAngle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    const spread = weapon.spread || 0;
    const angle = baseAngle + (Math.random() - 0.5) * spread;
    state.bullets.push({
      x: player.x + Math.cos(angle) * (player.r + 8),
      y: player.y + Math.sin(angle) * (player.r + 8),
      vx: Math.cos(angle) * weapon.speed,
      vy: Math.sin(angle) * weapon.speed,
      r: weapon.radius,
      damage: weapon.damage,
      color: weapon.color,
      life: 1.4,
    });
    sfx(player.weapon === 'arco' ? 'bow' : 'shoot');
    burst(player.x + Math.cos(angle) * (player.r + 10), player.y + Math.sin(angle) * (player.r + 10), weapon.color, 2, 60, 2, 0.14);
  }

  function updateEnemies(dt) {
    const player = state.player;

    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      enemy.hitCd = Math.max(0, enemy.hitCd - dt);
      enemy.flash = Math.max(0, enemy.flash - dt);

      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distance = Math.hypot(dx, dy) || 1;
      enemy.x += (dx / distance) * enemy.speed * dt;
      enemy.y += (dy / distance) * enemy.speed * dt;
    }

    for (let i = 0; i < state.enemies.length; i++) {
      const a = state.enemies[i];
      if (a.dead) continue;
      for (let j = i + 1; j < state.enemies.length; j++) {
        const b = state.enemies[j];
        if (b.dead) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const distance = Math.hypot(dx, dy) || 1;
        const overlap = a.r + b.r - distance;
        if (overlap > 0) {
          const push = overlap * 0.35;
          dx /= distance;
          dy /= distance;
          if (!a.boss) { a.x -= dx * push; a.y -= dy * push; }
          if (!b.boss) { b.x += dx * push; b.y += dy * push; }
        }
      }
    }

    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      if (Math.hypot(dx, dy) < enemy.r + player.r + 2 && enemy.hitCd <= 0) {
        enemy.hitCd = 0.85;
        damagePlayer(enemy.damage);
      }
    }

    state.enemies = state.enemies.filter((enemy) => !enemy.dead);
  }

  function updateBullets(dt) {
    for (const bullet of state.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.x < -60 || bullet.x > W + 60 || bullet.y < -60 || bullet.y > H + 60) {
        bullet.life = 0;
      }
      if (bullet.life <= 0) continue;
      for (const enemy of state.enemies) {
        if (enemy.dead) continue;
        const dx = bullet.x - enemy.x;
        const dy = bullet.y - enemy.y;
        if (dx * dx + dy * dy <= (enemy.r + bullet.r) * (enemy.r + bullet.r)) {
          damageEnemy(enemy, bullet.damage, bullet.x, bullet.y);
          bullet.life = 0;
          break;
        }
      }
    }
    state.bullets = state.bullets.filter((bullet) => bullet.life > 0);
  }

  function updatePickups(dt) {
    const player = state.player;
    for (const pickup of state.pickups) {
      pickup.life -= dt;
      pickup.phase += dt * 4;
      if (pickup.life <= 0) continue;
      if (Math.hypot(player.x - pickup.x, player.y - pickup.y) < pickup.r + player.r + 6) {
        if (player.hp < player.maxHp) {
          player.hp = Math.min(player.maxHp, player.hp + 15);
          pickup.life = 0;
          burst(pickup.x, pickup.y, '#69f0ae', 12, 120, 3, 0.5);
          sfx('pickup');
        }
      }
    }
    state.pickups = state.pickups.filter((pickup) => pickup.life > 0);
  }

  function updateParticles(dt) {
    for (const particle of state.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.94;
      particle.vy *= 0.94;
    }
    state.particles = state.particles.filter((particle) => particle.life > 0);

    for (const swing of state.swings) swing.life -= dt;
    state.swings = state.swings.filter((swing) => swing.life > 0);
  }

  function update(dt) {
    state.time += dt;
    state.shake = Math.max(0, state.shake - dt * 45);
    updateParticles(dt);

    if (state.mode !== 'playing') return;

    const player = state.player;
    player.iframe = Math.max(0, player.iframe - dt);
    player.fireCd = Math.max(0, player.fireCd - dt);

    let moveX = 0;
    let moveY = 0;
    if (keys.has('d') || keys.has('arrowright')) moveX += 1;
    if (keys.has('a') || keys.has('arrowleft')) moveX -= 1;
    if (keys.has('s') || keys.has('arrowdown')) moveY += 1;
    if (keys.has('w') || keys.has('arrowup')) moveY -= 1;
    const moveLength = Math.hypot(moveX, moveY);
    if (moveLength > 0) {
      moveX /= moveLength;
      moveY /= moveLength;
    }
    const speedMultiplier = state.vehicle === 'carro' ? 1.12 : state.vehicle === 'moto' ? 1.3 : 1;
    player.x = clamp(player.x + moveX * player.speed * speedMultiplier * dt, 22, W - 22);
    player.y = clamp(player.y + moveY * player.speed * speedMultiplier * dt, 22, H - 22);
    player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);

    if (mouse.down && player.fireCd <= 0) attack();

    updateEnemies(dt);
    updateBullets(dt);
    updatePickups(dt);

    if (state.intermission > 0) {
      state.intermission -= dt;
      if (state.intermission <= 0 && state.round < 10) startRound(state.round + 1);
      return;
    }

    if (state.endless) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0 && state.enemies.length < 32) {
        const difficulty = 10 + Math.min(20, state.time / 25);
        spawnEnemy(pickZombieType(difficulty));
        state.spawnTimer = Math.max(0.22, 0.85 - state.time * 0.004);
      }
      return;
    }

    if (state.chest) return;

    if (state.spawned < state.totalToSpawn && state.enemies.length < 30) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        if (state.round === 10 && !state.bossSpawned) spawnEnemy('boss');
        else spawnEnemy(pickZombieType(state.round));
        state.spawned += 1;
        state.spawnTimer = Math.max(0.35, (state.round === 10 ? 1.05 : 0.95) - state.round * 0.04);
      }
    }

    if (state.spawned >= state.totalToSpawn && state.enemies.length === 0) {
      state.intermission = 4;
      state.score += 100 * state.round;
      showToast(`RODADA ${state.round} LIMPA`, 'Prepare-se para a próxima');
      sfx('level');
    }
  }

  function selectWeapon(key) {
    if (!WEAPONS[key]) return;
    if (!state.arsenalUnlocked && key !== 'faca') return;
    state.player.weapon = key;
    ui.weaponName.textContent = WEAPONS[key].name;
    if (state.mode === 'loot') renderLoot();
  }

  function chooseVehicle(type) {
    if (state.vehicle) return;
    state.vehicle = type;
    if (type === 'carro') {
      state.player.maxHp += 60;
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + 60);
    }
    showToast(type === 'carro' ? 'CARRO BLINDADO' : 'MOTO', type === 'carro' ? '+60 de vida e +12% de velocidade' : '+30% de velocidade');
    if (state.mode === 'loot') {
      ui.lootHint.textContent = 'Veículo pronto. Agora você pode fugir ou continuar lutando.';
      renderLoot();
    }
    sfx('pickup');
  }

  function renderLoot() {
    ui.lootCards.innerHTML = '';
    ORDER.forEach((key, index) => {
      const weapon = WEAPONS[key];
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'loot-card' + (state.player.weapon === key ? ' selected' : '');
      card.innerHTML = `
        <span class="key">${index + 1}</span>
        <strong>${weapon.name}</strong>
        <span class="tag">${weapon.kindLabel}</span>
        <span class="stat">Dano ${weapon.damage} &middot; Recarga ${weapon.cooldown.toFixed(2)}s</span>
      `;
      card.addEventListener('click', () => selectWeapon(key));
      ui.lootCards.appendChild(card);
    });
    ui.vehicleCar.classList.toggle('used', state.vehicle === 'carro');
    ui.vehicleMoto.classList.toggle('used', state.vehicle === 'moto');
    ui.escapeBtn.classList.toggle('offscreen', !state.vehicle);
  }

  function openLoot() {
    if (!state.chest) return;
    state.mode = 'loot';
    state.lootOpened = true;
    state.arsenalUnlocked = true;
    ui.loot.classList.remove('hidden');
    ui.lootHint.textContent = 'Escolha uma arma. Para fugir, pegue um carro ou uma moto antes.';
    renderLoot();
    sfx('chest');
  }

  function continueFighting() {
    if (state.mode !== 'loot') return;
    ui.loot.classList.add('hidden');
    state.mode = 'playing';
    if (!state.endless) {
      state.endless = true;
      state.spawnTimer = 0.6;
      showToast('MODO INFINITO', 'Use o baú para fugir quando quiser');
    }
  }

  function escapeNow() {
    if (!state.vehicle) {
      ui.lootHint.textContent = 'Pegue um carro ou uma moto para iniciar a fuga.';
      return;
    }
    endGame(true);
  }

  function tryOpenChest() {
    if (state.mode !== 'playing' || !state.chest) return;
    const player = state.player;
    if (Math.hypot(player.x - state.chest.x, player.y - state.chest.y) < 100) openLoot();
  }

  function endGame(won) {
    state.mode = won ? 'victory' : 'gameover';
    ui.loot.classList.add('hidden');
    ui.prompt.classList.add('hidden');
    ui.hud.classList.add('hidden');
    ui.bossBar.classList.add('hidden');

    if (won) {
      ui.endEyebrow.textContent = 'Rota de fuga';
      ui.endTitle.textContent = 'Você escapou!';
      ui.endTitle.style.color = 'var(--green)';
      ui.endMessage.textContent = `A ${state.vehicle === 'carro' ? 'carro blindado' : 'moto'} cortou a horda e deixou a cidade para trás.`;
    } else {
      ui.endEyebrow.textContent = 'Fim da linha';
      ui.endTitle.textContent = 'Você caiu';
      ui.endTitle.style.color = '#ff8a80';
      ui.endMessage.textContent = `A horda te alcançou na rodada ${state.round}.`;
    }

    const stats = [
      statBlock('RODADAS', won ? '10 / 10' : `${state.round} / 10`),
      statBlock('ABATES', state.kills),
      statBlock('PONTOS', state.score),
      statBlock('ARMA FINAL', WEAPONS[state.player.weapon].name),
    ];
    if (state.vehicle) stats.push(statBlock('VEÍCULO', state.vehicle === 'carro' ? 'Carro blindado' : 'Moto'));
    ui.endStats.innerHTML = stats.join('');
    ui.end.classList.remove('hidden');
    sfx(won ? 'win' : 'lose');
  }

  function updateHud() {
    if (!state) return;
    const player = state.player;
    ui.round.textContent = state.endless ? 'INFINITO' : `${state.round} / 10`;
    ui.remaining.textContent = state.endless ? state.enemies.length : Math.max(0, state.totalToSpawn - state.roundKills);
    ui.kills.textContent = state.kills;
    ui.score.textContent = state.score;
    const hpPercent = Math.max(0, (player.hp / player.maxHp) * 100);
    ui.hpFill.style.width = `${hpPercent}%`;
    ui.hpFill.style.background = hpPercent <= 30
      ? 'linear-gradient(90deg, #b71c1c, #ff5252)'
      : 'linear-gradient(90deg, #4caf50, #9dff3c)';
    ui.hpText.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
    ui.weaponName.textContent = WEAPONS[player.weapon].name;

    const boss = state.enemies.find((enemy) => enemy.boss && !enemy.dead);
    if (boss) {
      ui.bossBar.classList.remove('hidden');
      ui.bossFill.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
    } else {
      ui.bossBar.classList.add('hidden');
    }

    if (state.chest && state.mode === 'playing') {
      const distance = Math.hypot(player.x - state.chest.x, player.y - state.chest.y);
      if (distance < 100) {
        ui.prompt.innerHTML = state.lootOpened
          ? 'Pressione <b>E</b> para acessar o baú'
          : 'Pressione <b>E</b> para abrir o baú';
        ui.prompt.classList.remove('hidden');
      } else {
        ui.prompt.classList.add('hidden');
      }
    } else {
      ui.prompt.classList.add('hidden');
    }
  }

  function drawBackground() {
    ctx.fillStyle = '#070b08';
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    glow.addColorStop(0, 'rgba(70, 125, 55, 0.09)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(115, 160, 110, 0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const step = 64;
    for (let x = 0; x <= W; x += step) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, H);
    }
    for (let y = 0; y <= H; y += step) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
    }
    ctx.stroke();
  }

  function drawDecals() {
    for (const decal of state.decals) {
      ctx.globalAlpha = decal.alpha;
      ctx.fillStyle = decal.color;
      ctx.beginPath();
      ctx.ellipse(decal.x, decal.y, decal.r, decal.r * 0.7, decal.rotation, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function roundRectPath(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function drawChest() {
    if (!state.chest) return;
    const chest = state.chest;
    const pulse = 0.5 + 0.5 * Math.sin(state.time * 4);
    ctx.save();
    ctx.translate(chest.x, chest.y);
    ctx.shadowColor = '#ffd54f';
    ctx.shadowBlur = 16 + pulse * 12;
    ctx.fillStyle = '#6d4517';
    roundRectPath(-29, -21, 58, 42, 6);
    ctx.fill();
    ctx.fillStyle = '#ffd54f';
    ctx.fillRect(-29, -4, 58, 8);
    ctx.fillRect(-6, -21, 12, 42);
    ctx.fillStyle = '#2a1a08';
    ctx.fillRect(-7, -5, 14, 10);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffecb3';
    ctx.lineWidth = 2;
    roundRectPath(-29, -21, 58, 42, 6);
    ctx.stroke();
    ctx.restore();
  }

  function drawPickups() {
    for (const pickup of state.pickups) {
      const bob = Math.sin(pickup.phase) * 3;
      ctx.save();
      ctx.translate(pickup.x, pickup.y + bob);
      ctx.shadowColor = '#69f0ae';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#1b3a26';
      roundRectPath(-13, -13, 26, 26, 5);
      ctx.fill();
      ctx.fillStyle = '#69f0ae';
      ctx.fillRect(-3, -9, 6, 18);
      ctx.fillRect(-9, -3, 18, 6);
      ctx.restore();
    }
  }

  function drawEnemy(enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, enemy.r * 0.75, enemy.r * 0.95, enemy.r * 0.4, 0, 0, TAU);
    ctx.fill();

    const bodyColor = enemy.flash > 0 ? '#ffffff' : enemy.color;
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(8, 14, 8, 0.75)';
    ctx.lineWidth = enemy.boss ? 5 : 3;
    ctx.stroke();

    if (enemy.boss) {
      ctx.strokeStyle = '#c77dff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * TAU;
        ctx.moveTo(Math.cos(angle) * (enemy.r + 3), Math.sin(angle) * (enemy.r + 3));
        ctx.lineTo(Math.cos(angle) * (enemy.r + 15), Math.sin(angle) * (enemy.r + 15));
      }
      ctx.stroke();
      ctx.fillStyle = '#ffd54f';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * enemy.r * 0.35 - 8, -enemy.r - 4);
        ctx.lineTo(i * enemy.r * 0.35, -enemy.r - 22);
        ctx.lineTo(i * enemy.r * 0.35 + 8, -enemy.r - 4);
        ctx.closePath();
        ctx.fill();
      }
    }

    const lookAngle = Math.atan2(state.player.y - enemy.y, state.player.x - enemy.x);
    const eyeX = Math.cos(lookAngle) * enemy.r * 0.48;
    const eyeY = Math.sin(lookAngle) * enemy.r * 0.48;
    const sideX = Math.cos(lookAngle + Math.PI / 2) * enemy.r * 0.32;
    const sideY = Math.sin(lookAngle + Math.PI / 2) * enemy.r * 0.32;
    ctx.fillStyle = '#ff5252';
    ctx.beginPath();
    ctx.arc(eyeX + sideX, eyeY + sideY, Math.max(2, enemy.r * 0.11), 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eyeX - sideX, eyeY - sideY, Math.max(2, enemy.r * 0.11), 0, TAU);
    ctx.fill();

    if (enemy.hp < enemy.maxHp) {
      const width = enemy.r * 1.8;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(-width / 2, -enemy.r - 12, width, 4);
      ctx.fillStyle = enemy.boss ? '#e040fb' : '#8bc34a';
      ctx.fillRect(-width / 2, -enemy.r - 12, width * Math.max(0, enemy.hp / enemy.maxHp), 4);
    }

    ctx.restore();
  }

  function drawPlayer() {
    const player = state.player;
    const weapon = WEAPONS[player.weapon];

    ctx.save();
    ctx.translate(player.x, player.y);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, player.r * 0.8, player.r * 1.05, player.r * 0.42, 0, 0, TAU);
    ctx.fill();

    if (player.iframe > 0) {
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(state.time * 40);
    }

    ctx.rotate(player.angle);

    ctx.lineCap = 'round';
    if (weapon.kind === 'melee') {
      const length = Math.min(48, weapon.range * 0.5);
      ctx.strokeStyle = weapon.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(10 + length, 0);
      ctx.stroke();
      if (player.weapon === 'machado') {
        ctx.fillStyle = '#ffb74d';
        ctx.beginPath();
        ctx.moveTo(10 + length, -13);
        ctx.lineTo(10 + length + 13, 0);
        ctx.lineTo(10 + length, 13);
        ctx.closePath();
        ctx.fill();
      }
      if (player.weapon === 'lanca') {
        ctx.fillStyle = '#fff8e1';
        ctx.beginPath();
        ctx.moveTo(10 + length, -5);
        ctx.lineTo(10 + length + 12, 0);
        ctx.lineTo(10 + length, 5);
        ctx.closePath();
        ctx.fill();
      }
    } else if (player.weapon === 'arco') {
      ctx.strokeStyle = weapon.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(20, 0, 13, -1.1, 1.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(25, -12);
      ctx.lineTo(25, 12);
      ctx.stroke();
    } else {
      ctx.fillStyle = weapon.color;
      ctx.fillRect(8, -3, 27, 6);
      ctx.fillRect(13, -7, 9, 4);
      ctx.fillRect(13, 3, 9, 4);
    }

    ctx.fillStyle = '#3fa7d6';
    ctx.beginPath();
    ctx.arc(0, 0, player.r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#e8f6ff';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#e8f6ff';
    ctx.beginPath();
    ctx.arc(0, 0, player.r * 0.38, -0.7, 0.7);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawSwings() {
    const player = state.player;
    for (const swing of state.swings) {
      const alpha = swing.life / swing.maxLife;
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(swing.angle);
      ctx.globalAlpha = alpha * 0.75;
      ctx.strokeStyle = swing.color;
      ctx.lineWidth = 14 * alpha;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, swing.range * 0.72, -swing.arc / 2, swing.arc / 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawParticles() {
    for (const particle of state.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawVignette() {
    const gradient = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.72);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.62)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawBackground();

    ctx.save();
    if (state.shake > 0.5) {
      ctx.translate(rand(-state.shake, state.shake), rand(-state.shake, state.shake));
    }

    drawDecals();
    drawChest();
    drawPickups();
    drawSwings();
    for (const enemy of state.enemies) {
      if (!enemy.dead) drawEnemy(enemy);
    }

    for (const bullet of state.bullets) {
      ctx.strokeStyle = bullet.color;
      ctx.lineWidth = bullet.r * 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bullet.x, bullet.y);
      ctx.lineTo(bullet.x - bullet.vx * 0.018, bullet.y - bullet.vy * 0.018);
      ctx.stroke();
    }

    drawPlayer();
    drawParticles();
    ctx.restore();

    drawVignette();
  }

  function loop(timestamp) {
    const dt = Math.min(0.05, (timestamp - lastTime) / 1000 || 0.016);
    lastTime = timestamp;
    update(dt);
    render();
    updateHud();
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
      event.preventDefault();
    }
    keys.add(key);

    if (key === 'm') {
      muted = !muted;
      if (!muted) initAudio();
      showToast(muted ? 'SOM DESLIGADO' : 'SOM LIGADO', '');
    }
    if (key === 'e' && state.mode === 'playing') tryOpenChest();
    if (key === 'escape' && state.mode === 'loot') continueFighting();
    if (/^[1-6]$/.test(key) && (state.mode === 'playing' || state.mode === 'loot')) {
      selectWeapon(ORDER[Number(key) - 1]);
    }
  });

  window.addEventListener('keyup', (event) => {
    keys.delete(event.key.toLowerCase());
  });

  window.addEventListener('blur', () => {
    keys.clear();
    mouse.down = false;
  });

  canvas.addEventListener('mousemove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  });

  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    initAudio();
    if (audio && audio.state === 'suspended') audio.resume();
    mouse.down = true;
  });

  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });

  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  ui.startBtn.addEventListener('click', startGame);
  ui.restartBtn.addEventListener('click', startGame);
  ui.continueBtn.addEventListener('click', continueFighting);
  ui.escapeBtn.addEventListener('click', escapeNow);
  ui.vehicleCar.addEventListener('click', () => chooseVehicle('carro'));
  ui.vehicleMoto.addEventListener('click', () => chooseVehicle('moto'));

  resize();
  state = createState();
  requestAnimationFrame((timestamp) => {
    lastTime = timestamp;
    requestAnimationFrame(loop);
  });
})();
