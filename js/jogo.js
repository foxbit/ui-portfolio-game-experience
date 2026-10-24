/* ==========================================================
   JOGO · física, câmera, inimigos, HUD e estados
   O canvas #jogo cobre a janela por cima da página (pointer-events: none).
   O mundo usa coordenadas do documento e a CÂMERA É A ROLAGEM da página:
   quando o personagem desce, a página rola junto.

   Estados: menu → jogando ⇄ pausado → fim
                     ↓  ↑
                    morto (volta ao checkpoint)
            fora = modo leitura depois de ter jogado
            entrando → (outra página) chegando → saindo → jogando   (canos)
   ========================================================== */
(function(){
  'use strict';
  var M = PF.mundo, S = PF.sprites;

  var cv = document.getElementById('jogo');
  var ctx = cv.getContext('2d');
  var painel = document.getElementById('painel');
  var semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var temToque = window.matchMedia('(pointer: coarse)').matches;
  /* textos que aparecem no jogo (troque este bloco para traduzir) */
  var TEXTO = {
    buraco: 'the hole is ', aqui: 'right there', esq: 'to the left ←', dir: 'to the right →',
    sairCano: 'jump on a pipe to leave',
    gameOver: 'GAME OVER', voltando: 'back to the checkpoint', fase: 'STAGE ',
    hud: ['SCORE', 'COINS', 'SKILLS', 'LIVES'],
    dicaToque: '◀ ▶ walk, ▲ jump', dicaTeclado: '← → walk, space jumps',
    pausa: '<h2>Paused</h2><p>← → walk · space jumps · ↓ drop down / stomp in the air</p>' +
      '<button data-p="continuar">Resume</button><button data-p="sair">Quit game</button>',
    fim: 'You made it!', fimItens: ['Score', 'Skills', 'Bugs', 'Time'],
    fimBotoes: '<button data-p="reiniciar">Play again</button><button data-p="sair">Just read the portfolio</button>'
  };
  var FONTE = '"Press Start 2P", ui-monospace, monospace';
  var W = 0, H = 0, DPR = 1;

  /* física no tamanho desktop (pixel da arte = 3 px); no celular tudo vezes k = esc / 3 */
  var C = {
    grav: 2300, pulo: 800, pulo2: 690, corrida: 350,
    acel: 3000, atrito: 2800, acelAr: 1900,
    quedaMax: 1150, socoVel: 1750, quique: 600, quiqueAlto: 820,
    empurraX: 330, empurraY: 440,
    coyote: 0.1, buffer: 0.13, invuln: 1.3
  };

  var E = {
    modo: 'menu', partida: false, terminou: false,
    ents: [], parts: [], textos: [], t: 0, crono: 0,
    pontos: 0, moedas: 0, moedasTotal: 0, skills: [], bugs: 0,
    combo: 0, faseMax: 0, checkpoint: 0, banner: null, dica: null,
    tremor: 0, tx: 0, ty: 0, cam: 0, manualAte: 0, mortoT: 0, batidos: new Set(),
    canoT: 0, navegou: false, coletados: {}
  };

  var p = {
    x: 0, y: 0, w: 30, h: 54, vx: 0, vy: 0, pesAntes: 0,
    chao: null, virado: false, pulosAr: 1, coyote: 0, buffer: 0,
    socando: 0, socoT: 0, invuln: 0, vidas: 3,
    sx: 1, sy: 1, ignorar: null, quicando: false, animT: 0, oculto: false, faceX: 1,
    cano: null                     // o cano em que está entrando ou de onde está saindo
  };

  /* ==========================================================
     PROGRESSO ENTRE PÁGINAS (sessionStorage)
     Ao entrar num cano o estado é salvo com viaCano = true; a página
     seguinte lê, começa já jogando e faz o personagem sair do cano
     que leva de volta para a página de origem.
     ========================================================== */
  var CHAVE = 'pf-estado';
  function caminho(url){ return new URL(url, location.href).pathname.replace(/index\.html$/, ''); }
  var PAGINA = caminho(location.href);
  function lerEstado(){ try { return JSON.parse(sessionStorage.getItem(CHAVE)); } catch(_) { return null; } }
  function gravarEstado(s){
    try { if (s) sessionStorage.setItem(CHAVE, JSON.stringify(s)); else sessionStorage.removeItem(CHAVE); } catch(_) {}
  }
  function estadoAtual(){
    return { pontos: E.pontos, vidas: p.vidas, skills: E.skills, bugs: E.bugs, crono: E.crono, coletados: E.coletados };
  }

  function clamp(v, a, b){ return v < a ? a : (v > b ? b : v); }
  function aproximar(v, alvo, d){ return v < alvo ? Math.min(v + d, alvo) : Math.max(v - d, alvo); }
  function rnd(a, b){ return a + Math.random() * (b - a); }

  /* ==========================================================
     ENTRADA: teclado e botões de toque
     ========================================================== */
  var inp = { esq: false, dir: false, pulo: false, baixo: false, ap: { pulo: false, baixo: false } };
  var TECLAS = {
    ArrowLeft: 'esq', KeyA: 'esq', ArrowRight: 'dir', KeyD: 'dir',
    ArrowUp: 'pulo', KeyW: 'pulo', Space: 'pulo',
    ArrowDown: 'baixo', KeyS: 'baixo'
  };
  // "ap" guarda o aperto (borda de subida) para o pulo com buffer e o soco
  function apertar(a){ if (!inp[a] && inp.ap[a] !== undefined) inp.ap[a] = true; inp[a] = true; }
  function soltar(a){ inp[a] = false; }
  function limparInput(){ inp.esq = inp.dir = inp.pulo = inp.baixo = false; inp.ap.pulo = inp.ap.baixo = false; }
  function emJogo(){ return /^(jogando|morto|entrando|chegando|saindo)$/.test(E.modo); }

  window.addEventListener('keydown', function(e){
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (emJogo()) {
      var a = TECLAS[e.code];
      if (a) { e.preventDefault(); if (!e.repeat) apertar(a); return; }
      if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); pausar(); }
      return;
    }
    if (E.modo === 'pausado' && (e.code === 'Escape' || e.code === 'KeyP')) { e.preventDefault(); continuar(); return; }
    if (e.code === 'Enter' && (E.modo === 'menu' || E.modo === 'fora')) {
      var foco = document.activeElement;
      if (!foco || foco === document.body) { e.preventDefault(); jogar(); }
    }
  });
  window.addEventListener('keyup', function(e){ var a = TECLAS[e.code]; if (a) soltar(a); });
  window.addEventListener('blur', limparInput);
  document.addEventListener('visibilitychange', function(){ if (document.hidden && E.modo === 'jogando') pausar(); });

  document.querySelectorAll('[data-tecla]').forEach(function(b){
    var a = b.dataset.tecla;
    b.addEventListener('pointerdown', function(e){ e.preventDefault(); apertar(a); try { b.setPointerCapture(e.pointerId); } catch(_) {} });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function(ev){ b.addEventListener(ev, function(){ soltar(a); }); });
    b.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  });

  // rolar com a roda/dedo durante o jogo solta a câmera por um instante
  function soltarCamera(){ if (E.modo === 'jogando') E.manualAte = performance.now() + 1400; }
  window.addEventListener('wheel', soltarCamera, { passive: true });
  window.addEventListener('touchmove', function(e){ if (!e.target.closest('.toque')) soltarCamera(); }, { passive: true });

  /* ==========================================================
     MEDIDAS: o layout mudou → mede de novo e reencaixa o personagem
     ========================================================== */
  function ajustarTamanho(){ p.w = 10 * M.esc; p.h = S.ALT * M.esc; }

  function colocarNoPouso(i, caindo){
    var f = M.fases[i], pl = f && f.pouso;
    if (!pl) return;
    p.x = clamp(pl.x + pl.w * (i === 0 ? 0.3 : 0.5) - p.w / 2, 0, M.W - p.w);
    p.vx = 0; p.vy = 0;
    if (caindo) { p.y = pl.y - p.h - 160 * M.esc / 3; sairDoChao(); }
    else { p.y = pl.y - p.h; p.chao = pl; }
  }

  function acharPiso(i, x){
    for (var j = 0; j < M.plats.length; j++) {
      var pl = M.plats[j];
      if (pl.piso === i && x >= pl.x && x <= pl.x + pl.w) return pl;
    }
    return null;
  }

  function remedir(){
    var chaoEl = p.chao && p.chao.el, chaoSeg = p.chao ? p.chao.seg : 0, chaoPiso = p.chao ? p.chao.piso : undefined, meio = p.x + p.w / 2;
    M.medir();
    ajustarTamanho();
    M.posicionar(E.ents);
    if (E.modo === 'menu') { colocarNoPouso(0); return; }
    if (p.cano && p.cano.el) p.cano = M.porEl.get(p.cano.el) || p.cano;   // cano tem um trecho só
    if (p.chao) {
      var novo = chaoEl ? ((M.trechos.get(chaoEl) || [])[chaoSeg] || M.porEl.get(chaoEl)) : acharPiso(chaoPiso, meio);
      if (novo) { p.chao = novo; p.y = novo.y - p.h; } else sairDoChao();
    }
    p.x = clamp(p.x, 0, M.W - p.w);
  }

  var pedido = 0;
  function pedirMedida(){ if (!pedido) pedido = requestAnimationFrame(function(){ pedido = 0; remedir(); }); }

  function redimensionar(){
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    remedir();
  }

  /* ==========================================================
     JOGADOR
     ========================================================== */
  var pisadoEl = null;
  function sairDoChao(){
    p.chao = null;
    if (pisadoEl) { pisadoEl.classList.remove('pisado'); pisadoEl = null; }
  }

  function pular(v, duplo, k){
    sairDoChao();
    p.vy = -v; p.buffer = 0; p.coyote = 0; p.quicando = false;
    p.sx = 0.78; p.sy = 1.24;                         // estica ao pular
    if (duplo) { p.pulosAr--; anel(p.x + p.w / 2, p.y + p.h, 34 * k, '#7c5cff'); }
    else poeira(p.x + p.w / 2, p.y + p.h, 5, k);
  }

  function controlar(dt, k){
    p.coyote -= dt; p.buffer -= dt;
    if (inp.ap.pulo) { inp.ap.pulo = false; p.buffer = C.buffer; }

    var dir = (inp.dir ? 1 : 0) - (inp.esq ? 1 : 0);
    if (p.socando) dir = 0;
    var acel = (p.chao ? (dir ? C.acel : C.atrito) : C.acelAr) * k;
    p.vx = aproximar(p.vx, dir * C.corrida * k, acel * dt);
    if (dir) p.virado = dir < 0;

    // buffer: o pulo apertado um pouco antes de tocar o chão ainda vale; coyote: logo depois de sair também
    if (p.buffer > 0 && !p.socando) {
      if (p.chao || p.coyote > 0) pular(C.pulo * k, false, k);
      else if (p.pulosAr > 0) pular(C.pulo2 * k, true, k);
    }
    // soltar o botão cedo corta o pulo (pulo curto)
    if (!inp.pulo && !p.quicando && p.vy < -C.pulo * k * 0.42) p.vy = -C.pulo * k * 0.42;

    if (inp.ap.baixo) {
      inp.ap.baixo = false;
      if (p.chao) {
        // ↓ no cano: entra; ↓ no chão: atravessa a plataforma (os pisos das fases não deixam)
        if (p.chao.cano) entrarNoCano(p.chao);
        else if (!p.chao.solido) { p.ignorar = p.chao; sairDoChao(); p.y += 2; p.vy = 80 * k; }
        else dizer(TEXTO.buraco + ladoDoBuraco(), 1.8);
      } else if (!p.socando) { p.socando = 1; p.socoT = 0.15; }   // ↓ no ar: soco no chão
    }
  }

  function ladoDoBuraco(){
    var piso = M.pisos[M.faseDe(p.y + p.h - 4)];
    if (!piso || piso.final) return TEXTO.aqui;
    return piso.cx < p.x + p.w / 2 ? TEXTO.esq : TEXTO.dir;
  }

  function fisica(dt, k){
    if (p.invuln > 0) p.invuln -= dt;

    if (p.socando === 1) {                            // fica parado no ar um instante, depois despenca
      p.socoT -= dt; p.vx = 0; p.vy = 0;
      if (p.socoT <= 0) { p.socando = 2; p.vy = C.socoVel * k; }
    } else {
      p.vy += C.grav * k * dt;
      var max = p.socando === 2 ? C.socoVel * k : C.quedaMax * k;
      if (p.vy > max) p.vy = max;
    }

    p.pesAntes = p.y + p.h;
    var xAntes = p.x;
    p.x += p.vx * dt;
    if (p.x < 0) { p.x = 0; p.vx = 0; }
    else if (p.x > M.W - p.w) { p.x = M.W - p.w; p.vx = 0; }
    paredes(xAntes);

    if (p.chao) {
      var c = p.chao;
      if (p.x + p.w < c.x + 4 || p.x > c.x + c.w - 4) { sairDoChao(); p.coyote = C.coyote; }
      else { p.y = c.y - p.h; p.vy = 0; }
    }

    if (!p.chao) {
      var cabecaAntes = p.y;
      p.y += p.vy * dt;
      if (p.vy < 0 && E.modo === 'jogando') cabecadas(cabecaAntes, k);
      // plataformas de mão única: só colidem caindo, quando os pés cruzam a borda de cima neste passo
      if (p.vy >= 0) {
        var pes = p.y + p.h, alvo = null;
        for (var i = 0; i < M.plats.length; i++) {
          var pl = M.plats[i];
          if (pl.y < p.pesAntes - 0.5) continue;
          if (pl.y > pes) break;                      // lista ordenada por y
          if (pl === p.ignorar) continue;
          if (p.x + p.w <= pl.x + 4 || p.x >= pl.x + pl.w - 4) continue;
          alvo = pl; break;
        }
        if (alvo) pousar(alvo, k);
      }
      if (p.ignorar && p.pesAntes > p.ignorar.y + 1) p.ignorar = null;
      if (p.y < -400) { p.y = -400; p.vy = Math.max(p.vy, 0); }
    }

    var vol = Math.min(1, dt * 14);
    p.sx += (1 - p.sx) * vol; p.sy += (1 - p.sy) * vol;
    p.faceX = aproximar(p.faceX, p.virado ? -1 : 1, dt * 11);   // vira "em 3D" em vez de espelhar de uma vez
    p.animT += dt;
  }

  /* os lados dos canos são sólidos: com os pés abaixo da boca, não dá para atravessar */
  function paredes(xAntes){
    for (var i = 0; i < M.paredes.length; i++) {
      var pl = M.paredes[i];
      if (p.y + p.h <= pl.y + 2 || p.y >= pl.base) continue;
      if (p.x + p.w <= pl.x || p.x >= pl.x + pl.w) continue;
      if (xAntes + p.w <= pl.x) { p.x = pl.x - p.w; p.vx = 0; }
      else if (xAntes >= pl.x + pl.w) { p.x = pl.x + pl.w; p.vx = 0; }
    }
  }

  /* ==========================================================
     CANOS: entra, a tela fecha num círculo, abre a outra página
     ========================================================== */
  var CANO = { desce: 0.6, fecha: 0.45, abre: 0.45, sobe: 0.6 };

  function entrarNoCano(pl){
    E.modo = 'entrando'; E.canoT = 0; E.dica = null;
    p.cano = pl; p.vx = 0; p.vy = 0; p.socando = 0; p.virado = false;
    p.x = pl.x + pl.w / 2 - p.w / 2;
    sairDoChao();
    limparInput();
  }

  /* por qual cano aparecer: subpáginas têm um cano de entrada na primeira fase e saem sempre por ele;
     o index não tem, então sai do cano do card que leva de volta à página de origem */
  function acharCanoDeVolta(origem){
    var noTopo = [], deVolta = [];
    M.plats.forEach(function(pl){
      if (!pl.cano) return;
      var volta = caminho(pl.cano) === origem;
      if (M.faseDe(pl.y) === 0) noTopo.push(pl);
      if (volta) deVolta.push(pl);
    });
    return noTopo.filter(function(pl){ return deVolta.indexOf(pl) >= 0; })[0] || noTopo[0] || deVolta[0] || null;
  }

  function chegarPeloCano(pl){
    document.documentElement.classList.remove('chegando');
    E.modo = 'saindo'; E.canoT = 0; E.navegou = false;
    p.cano = pl; p.vx = 0; p.vy = 0; p.oculto = false;
    if (pl) { p.x = pl.x + pl.w / 2 - p.w / 2; p.y = pl.y; sairDoChao(); }
    else colocarNoPouso(0);                           // não achou cano de volta: começa no início da página
    E.cam = alvoCamera(); window.scrollTo(0, E.cam);
  }

  function animarCano(dt){
    E.canoT += dt;
    var pl = p.cano;
    if (E.modo === 'entrando') {
      p.y = pl.y - p.h + p.h * Math.min(1, E.canoT / CANO.desce);
      if (E.canoT >= CANO.desce + CANO.fecha && !E.navegou) {
        E.navegou = true;
        var s = estadoAtual(); s.viaCano = true; s.origem = PAGINA;
        gravarEstado(s);
        location.href = pl.cano;
      }
    } else {
      var sobe = (E.canoT - CANO.abre * 0.7) / CANO.sobe;
      if (pl) p.y = pl.y - p.h * clamp(sobe, 0, 1);
      if (sobe >= 1) {
        E.modo = 'jogando'; p.cano = null;
        if (pl) { p.y = pl.y - p.h; p.chao = pl; }
      }
    }
  }

  // voltar pelo histórico (bfcache) traz a página congelada no meio da entrada: sai do mesmo cano
  window.addEventListener('pageshow', function(e){
    if (!e.persisted || E.modo !== 'entrando') return;
    var s = lerEstado(); if (s) { s.viaCano = false; gravarEstado(s); }
    chegarPeloCano(p.cano);
  });

  /* subindo, a cabeça cruzou a borda de baixo de um bloco: cabeçada (o bloco pula) */
  function cabecadas(antes, k){
    var batidos = [];                                 // vários trechos do mesmo elemento: uma cabeçada só
    for (var i = 0; i < M.plats.length; i++) {
      var pl = M.plats[i];
      if (!pl.el || pl.letras || pl.cano || antes < pl.base || p.y >= pl.base) continue;
      if (p.x + p.w <= pl.x + 6 || p.x >= pl.x + pl.w - 6 || batidos.indexOf(pl.el) >= 0) continue;
      batidos.push(pl.el);
      var cx = p.x + p.w / 2;
      PF.efeitos.cabecada(pl, (cx - pl.x) / pl.w);
      if (!pl.cartao) continue;                       // texto só balança; cartão também solta poeira e pontos
      tremer(4);
      p.vy *= 0.82;
      for (var j = 0; j < 8; j++) particula(cx + rnd(-10, 10), pl.base, rnd(-160, 160) * k, rnd(-40, 140) * k, rnd(0.25, 0.45), '#a5b4c8', rnd(2, 4) * k, 900 * k);
      if (!E.batidos.has(pl.el)) {                    // primeira cabeçada no cartão dá pontos
        E.batidos.add(pl.el);
        E.pontos += 25;
        texto(cx, pl.base - 20 * k, '+25', '#f8fafc');
      }
    }
  }

  function pousar(pl, k){
    var v = p.vy;
    p.chao = pl; p.y = pl.y - p.h; p.vy = 0;
    p.pulosAr = 1; p.quicando = false; p.coyote = 0; E.combo = 0;
    if (p.socando === 2) impactoSoco(pl, k);
    else if (v > 380 * k) { p.sx = 1.26; p.sy = 0.76; poeira(p.x + p.w / 2, pl.y, Math.min(10, 3 + v / 200), k); }
    p.socando = 0;
    // o bloco sente o impacto: quanto mais rápida a queda, mais ele afunda e balança
    if (v > 200 * k) PF.efeitos.pouso(pl, (p.x + p.w / 2 - pl.x) / pl.w, Math.min(1.6, v / 900 / k));
    if (pl.el && pl.cartao) { pisadoEl = pl.el; pl.el.classList.add('pisado'); }
    if (E.modo !== 'jogando') return;
    if (pl.cano) dizer((temToque ? '▼' : '↓') + ' ' + pl.nomeCano, 2.5);
    if (pl.final && document.body.hasAttribute('data-fim')) terminar();
    else if (pl.final && !E.avisouSaida) { E.avisouSaida = true; dizer(TEXTO.sairCano, 2.5); }
  }

  function impactoSoco(pl, k){
    tremer(16);
    var cx = p.x + p.w / 2, y = pl.y;
    anel(cx, y, 200 * k, '#fbbf24', 0.45, 5);
    for (var i = 0; i < 20; i++) particula(cx + rnd(-12, 12), y - 2, rnd(-460, 460) * k, rnd(-650, -160) * k, rnd(0.4, 0.75), i % 3 ? '#7c5cff' : '#f8fafc', rnd(3, 6) * k, 1500 * k);
    E.ents.forEach(function(e){
      if (e.tipo === 'bug' && e.vivo && !e.oculto && Math.abs(e.x + e.w / 2 - cx) < 200 * k && Math.abs(e.y + e.h - y) < 34 * k) { E.combo++; matar(e); }
    });
    if (pl.letras) ondaLetras(pl, cx);
    PF.efeitos.onda(cx, y, 520 * k, 1);
    p.sx = 1.4; p.sy = 0.66;
  }

  function ondaLetras(pl, cx){
    pl.letras.forEach(function(L){
      var d = Math.abs((L.x0 + L.x1) / 2 - cx);
      setTimeout(function(){ L.el.classList.remove('onda'); void L.el.offsetWidth; L.el.classList.add('onda'); }, d * 0.7);
    });
  }

  function machucar(fx, k){
    p.vidas--; p.invuln = C.invuln;
    var lado = p.x + p.w / 2 < fx ? -1 : 1;
    sairDoChao();
    p.vx = lado * C.empurraX * k; p.vy = -C.empurraY * k;
    p.socando = 0; p.quicando = true;
    tremer(10);
    texto(p.x + p.w / 2, p.y - 6, '-1 ♥', '#ff4d7e');
    if (p.vidas <= 0) {
      E.modo = 'morto'; E.mortoT = 1.6; p.oculto = true;
      for (var i = 0; i < 40; i++) particula(p.x + p.w / 2, p.y + p.h / 2, rnd(-500, 500) * k, rnd(-700, -100) * k, rnd(0.8, 1.4), i % 2 ? '#22c55e' : '#7c5cff', rnd(3, 6) * k, 1200 * k);
      banner(TEXTO.gameOver, TEXTO.voltando, 1.6, '#ff4d7e');
    }
  }

  function renascer(){
    p.vidas = 3; p.oculto = false; p.invuln = 1.6; p.socando = 0;
    colocarNoPouso(E.checkpoint, true);
    E.modo = 'jogando';
    limparInput();
  }

  /* ==========================================================
     ENTIDADES
     ========================================================== */
  function atualizarEntidades(dt, k){
    E.ents.forEach(function(e){
      if (e.tipo !== 'bug' || !e.vivo || e.oculto) return;
      var pl = e.plat, span = pl.w - e.w - 8;    // patrulha de ponta a ponta do elemento
      if (span > 4 && E.modo !== 'fim') {
        e.u += e.dir * e.vel * k * dt / span;
        if (e.u >= 1) { e.u = 1; e.dir = -1; } else if (e.u <= 0) { e.u = 0; e.dir = 1; }
      }
      e.x = pl.x + 4 + e.u * Math.max(0, span);
      e.y = pl.y - e.h;
    });
  }

  function colisoes(k){
    var x0 = p.x, x1 = p.x + p.w, y0 = p.y, y1 = p.y + p.h;
    for (var i = 0; i < E.ents.length; i++) {
      var e = E.ents[i];
      if (!e.vivo || e.oculto) continue;
      if (e.tipo === 'bug') {
        var m = 3 * k;
        if (x1 > e.x + m && x0 < e.x + e.w - m && y1 > e.y + m && y0 < e.y + e.h - m) {
          var deCima = p.vy > 0 && p.pesAntes <= e.y + e.h * 0.6;
          if (p.socando === 2 || deCima) {
            E.combo++; matar(e);
            if (p.socando !== 2) { p.vy = -(inp.pulo ? C.quiqueAlto : C.quique) * k; p.quicando = true; p.pulosAr = 1; }
          } else if (p.invuln <= 0) {
            machucar(e.x + e.w / 2, k);
            if (E.modo !== 'jogando') return;
          }
        }
      } else {
        var r = (e.tipo === 'moeda' ? 16 : 26) * k;
        if (e.x > x0 - r && e.x < x1 + r && e.y > y0 - r && e.y < y1 + r) coletar(e, k);
      }
    }
  }

  function matar(e){
    e.vivo = false; E.bugs++;
    var mult = Math.max(1, E.combo), pts = 50 * mult, k = M.esc / 3;
    E.pontos += pts;
    for (var i = 0; i < 14; i++) particula(e.x + e.w / 2, e.y + e.h / 2, rnd(-300, 300) * k, rnd(-420, -60) * k, rnd(0.35, 0.7), i % 4 ? '#ff4d7e' : '#fff', rnd(3, 6) * k, 1200 * k);
    texto(e.x + e.w / 2, e.y - 4, '+' + pts + (mult > 1 ? ' x' + mult : ''), mult > 1 ? '#fbbf24' : '#f8fafc');
    tremer(5);
  }

  function coletar(e, k){
    e.vivo = false;
    (E.coletados[PAGINA] = E.coletados[PAGINA] || []).push(e.id);   // não reaparece ao voltar pra página
    if (e.tipo === 'moeda') {
      E.moedas++; E.pontos += 10;
      faiscas(e.x, e.y, 6, '#fbbf24', k);
    } else {
      E.skills.push(e.nome); E.pontos += 100;
      faiscas(e.x, e.y, 22, '#7c5cff', k);
      anel(e.x, e.y, 60 * k, '#7c5cff');
      texto(e.x, e.y - 14, '+ ' + e.nome, '#c4b5fd');
    }
  }

  /* ==========================================================
     FASES E FALAS
     ========================================================== */
  function acompanharFase(){
    var f = M.faseDe(p.y + p.h - 2);
    if (f <= E.faseMax) return;
    E.faseMax = f; E.checkpoint = f;
    M.fases[f].el.classList.add('fase-ativa');
    banner(TEXTO.fase + f, M.fases[f].nome.toUpperCase(), 2.2);
  }

  function dizer(txt, dur){ E.dica = { texto: txt, ate: E.t + dur }; }
  function banner(titulo, sub, dur, cor){ E.banner = { titulo: titulo, sub: sub, t: 0, dur: dur, cor: cor || '#22c55e' }; }
  function tremer(q){ if (!semMovimento) E.tremor = Math.max(E.tremor, q); }

  /* ---------- partículas e textos flutuantes ---------- */
  function particula(x, y, vx, vy, vida, cor, tam, grav){
    if (E.parts.length > 500) return;
    E.parts.push({ tipo: 'q', x: x, y: y, vx: vx, vy: vy, vida: vida, max: vida, cor: cor, tam: tam, grav: grav || 0 });
  }
  function anel(x, y, raio, cor, vida, larg){ E.parts.push({ tipo: 'anel', x: x, y: y, raio: raio, vida: vida || 0.35, max: vida || 0.35, cor: cor, larg: larg || 3 }); }
  function poeira(x, y, n, k){ for (var i = 0; i < n; i++) particula(x + rnd(-8, 8) * k, y - 2, rnd(-170, 170) * k, rnd(-140, -20) * k, rnd(0.3, 0.55), '#64748b', rnd(3, 5) * k, 380 * k); }
  function faiscas(x, y, n, cor, k){
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = rnd(110, 330) * k;
      particula(x, y, Math.cos(a) * v, Math.sin(a) * v, rnd(0.35, 0.65), i % 3 ? cor : '#fff', rnd(2, 4) * k, 260 * k);
    }
  }
  function texto(x, y, txt, cor){ E.textos.push({ x: x, y: y, txt: txt, cor: cor, vida: 1.1, max: 1.1 }); }

  function atualizarParticulas(dt){
    for (var i = E.parts.length - 1; i >= 0; i--) {
      var q = E.parts[i];
      q.vida -= dt;
      if (q.vida <= 0) { E.parts.splice(i, 1); continue; }
      if (q.tipo === 'q') { q.vy += q.grav * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 1 - dt * 1.5; }
    }
    for (var j = E.textos.length - 1; j >= 0; j--) {
      E.textos[j].vida -= dt; E.textos[j].y -= 40 * dt;
      if (E.textos[j].vida <= 0) E.textos.splice(j, 1);
    }
  }

  /* letras do título afundam embaixo dos pés */
  var letrasPisadas = new Set();
  function atualizarLetras(){
    var novas = new Set(), pl = p.chao;
    if (pl && pl.letras && !p.oculto) {
      pl.letras.forEach(function(L){ if (L.x1 > p.x - 2 && L.x0 < p.x + p.w + 2) novas.add(L.el); });
    }
    letrasPisadas.forEach(function(el){ if (!novas.has(el)) el.classList.remove('pisada'); });
    novas.forEach(function(el){ el.classList.add('pisada'); });
    letrasPisadas = novas;
  }

  /* ==========================================================
     CÂMERA = ROLAGEM DA PÁGINA
     ========================================================== */
  function alvoCamera(){
    var maxS = Math.max(0, document.documentElement.scrollHeight - H);
    var alvo = p.y + p.h * 0.5 - H * 0.42;
    if (p.vy > 0 && !p.chao) alvo += Math.min(p.vy * 0.25, H * 0.22);   // olha pra baixo ao cair
    return clamp(alvo, 0, maxS);
  }

  function camera(dt){
    if (E.modo === 'chegando') return;
    if (performance.now() < E.manualAte) { E.cam = window.scrollY; return; }
    E.cam += (alvoCamera() - E.cam) * (1 - Math.exp(-dt * 7));
    if (Math.abs(E.cam - window.scrollY) > 0.5) window.scrollTo(0, E.cam);
  }

  /* ==========================================================
     LAÇO PRINCIPAL (física em passo fixo de 1/120 s)
     ========================================================== */
  var PASSO = 1 / 120, acum = 0, antes = performance.now();

  function passo(dt){
    var k = M.esc / 3;
    E.t += dt;
    if (E.modo === 'chegando') return;
    if (E.modo === 'entrando' || E.modo === 'saindo') { animarCano(dt); atualizarEntidades(dt, k); return; }
    if (E.modo === 'jogando' && !p.oculto) { E.crono += dt; controlar(dt, k); }
    if (E.modo === 'morto') { E.mortoT -= dt; if (E.mortoT <= 0) renascer(); }
    else fisica(dt, k);
    if (E.modo === 'jogando') { colisoes(k); acompanharFase(); }
    atualizarEntidades(dt, k);
  }

  function laco(agora){
    requestAnimationFrame(laco);
    var dt = Math.min((agora - antes) / 1000, 0.1);
    antes = agora;
    if (document.hidden) return;
    if (E.modo !== 'pausado') {
      acum += dt;
      var n = 0;
      while (acum >= PASSO && n < 12) { passo(PASSO); acum -= PASSO; n++; }
      if (n === 12) acum = 0;
      atualizarParticulas(dt);
      atualizarLetras();
      if (p.chao && !p.oculto && E.modo !== 'fora') PF.efeitos.peso(p.chao, p.x + p.w / 2);
      PF.efeitos.passo(dt);
      if (E.banner) { E.banner.t += dt; if (E.banner.t > E.banner.dur) E.banner = null; }
      if (E.dica && E.t > E.dica.ate) E.dica = null;
      if (E.tremor > 0) E.tremor = Math.max(0, E.tremor - dt * 45);
      E.tx = E.tremor > 0.4 ? (Math.random() - 0.5) * E.tremor : 0;
      E.ty = E.tremor > 0.4 ? (Math.random() - 0.5) * E.tremor : 0;
    }
    if (emJogo() || E.modo === 'fim') camera(dt);
    desenhar();
  }

  /* ==========================================================
     DESENHO (as plataformas são a própria página; aqui só o que é do jogo)
     ========================================================== */
  function desenhar(){
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    var sy = window.scrollY, jogo = E.modo !== 'menu' && E.modo !== 'fora';
    ctx.save();
    ctx.translate(E.tx, E.ty - sy);                   // mundo em coordenadas do documento
    if (jogo) desenharEntidades(sy - 100, sy + H + 100);
    desenharParticulas();
    desenharJogador();
    desenharTextos();
    desenharBalao();
    ctx.restore();
    if (jogo) desenharHUD();
    var iris = E.modo === 'chegando' ? 0
      : E.modo === 'entrando' ? 1 - clamp((E.canoT - CANO.desce) / CANO.fecha, 0, 1)
      : E.modo === 'saindo' ? clamp(E.canoT / CANO.abre, 0, 1) : 1;
    if (iris < 1) desenharIris(iris);
  }

  /* transição de página: tela preta com um furo redondo em volta do personagem */
  function desenharIris(f){
    var cx = p.x + p.w / 2, cy = (p.cano ? p.cano.y - p.h / 2 : p.y + p.h / 2) - window.scrollY;
    var r = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) * f * f;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    if (r > 0.5) ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill('evenodd');
  }

  function desenharEntidades(topo, base){
    var k = M.esc / 3, t = E.t;
    E.ents.forEach(function(e){
      if (!e.vivo || e.oculto || e.y < topo || e.y > base) return;
      if (e.tipo === 'moeda') {
        var y = e.y + PF.efeitos.deslocamento(e.plat, e.x) + Math.sin(t * 3 + e.i) * 3 * k, larg = Math.abs(Math.cos(t * 3 + e.i * 0.6)) * 7 * k + 2;
        ctx.fillStyle = '#fbbf24'; ctx.fillRect(e.x - larg, y - 9 * k, larg * 2, 18 * k);
        ctx.fillStyle = '#fff7d6'; ctx.fillRect(e.x - larg * 0.3, y - 6 * k, Math.max(2, larg * 0.4), 12 * k);
      } else if (e.tipo === 'skill') {
        var ys = e.y + PF.efeitos.deslocamento(e.plat, e.x) + Math.sin(t * 2) * 5 * k, r = 14 * k;
        ctx.save(); ctx.translate(e.x, ys); ctx.rotate(t * 1.5);
        ctx.fillStyle = '#7c5cff'; ctx.fillRect(-r, -r, r * 2, r * 2);
        ctx.fillStyle = '#c4b5fd'; ctx.fillRect(-r / 2, -r / 2, r, r);
        ctx.restore();
        ctx.font = Math.round(8 * k + 2) + 'px ' + FONTE; ctx.textAlign = 'center';
        ctx.fillStyle = '#c4b5fd'; ctx.fillText(e.nome, e.x, ys - r - 10 * k);
      } else if (e.tipo === 'bug') {
        var spr = S.obter('bug', M.esc), pisca = Math.sin(t * 14 + e.u * 9) > 0 ? 0 : M.esc;
        ctx.save(); ctx.translate(e.x + e.w / 2, e.y + PF.efeitos.deslocamento(e.plat, e.x + e.w / 2)); ctx.scale(e.dir, 1);
        ctx.drawImage(spr, -e.w / 2, pisca * 0.3, e.w, e.h);
        ctx.restore();
      }
    });
  }

  function escolherPose(){
    if (!p.chao) return 'pulo';
    if (Math.abs(p.vx) > 40) return Math.floor(p.animT * 9) % 2 ? 'passo1' : 'passo2';
    return 'parado';
  }

  function desenharJogador(){
    if (p.oculto) return;
    if (p.invuln > 0 && Math.floor(p.invuln * 14) % 2) return;   // pisca invulnerável
    var spr = S.obter(escolherPose(), M.esc);
    var fx = Math.abs(p.faceX) < 0.15 ? 0.15 * Math.sign(p.faceX || 1) : p.faceX;
    ctx.save();
    if (p.cano && (E.modo === 'entrando' || E.modo === 'saindo')) {   // some atrás da boca do cano
      ctx.beginPath(); ctx.rect(0, p.cano.y - 4000, M.W, 4000); ctx.clip();
    }
    var afunda = p.chao ? PF.efeitos.deslocamento(p.chao, p.x + p.w / 2) : 0;   // pés acompanham o bloco balançando
    ctx.translate(p.x + p.w / 2, p.y + p.h + afunda);  // âncora nos pés: squash/stretch não afunda no chão
    ctx.scale(p.sx * fx, p.sy);
    if (p.socando) ctx.rotate(p.socando === 1 ? E.t * 30 : 0);
    ctx.drawImage(spr, -spr.width / 2, -spr.height);
    ctx.restore();
  }

  function desenharParticulas(){
    E.parts.forEach(function(q){
      var a = q.vida / q.max;
      ctx.globalAlpha = Math.min(1, a * 1.5);
      if (q.tipo === 'q') { ctx.fillStyle = q.cor; ctx.fillRect(q.x - q.tam / 2, q.y - q.tam / 2, q.tam, q.tam); }
      else { ctx.strokeStyle = q.cor; ctx.lineWidth = q.larg; ctx.beginPath(); ctx.arc(q.x, q.y, q.raio * (1 - a * a), 0, Math.PI * 2); ctx.stroke(); }
    });
    ctx.globalAlpha = 1;
  }

  function desenharTextos(){
    ctx.font = '12px ' + FONTE; ctx.textAlign = 'center';
    E.textos.forEach(function(t){
      ctx.globalAlpha = Math.min(1, t.vida / t.max * 2);
      ctx.fillStyle = '#000'; ctx.fillText(t.txt, t.x + 2, t.y + 2);
      ctx.fillStyle = t.cor; ctx.fillText(t.txt, t.x, t.y);
    });
    ctx.globalAlpha = 1;
  }

  function desenharBalao(){
    if (!E.dica || p.oculto) return;
    ctx.font = (W < 720 ? 8 : 11) + 'px ' + FONTE;
    var w = ctx.measureText(E.dica.texto).width + 24, x = clamp(p.x + p.w / 2, w / 2 + 8, M.W - w / 2 - 8), y = p.y - 30;
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(x - w / 2, y - 26, w, 30);
    ctx.fillRect(p.x + p.w / 2 - 4, y + 4, 8, 6);
    ctx.fillStyle = '#0b0f1a'; ctx.textAlign = 'center'; ctx.fillText(E.dica.texto, x, y - 6);
  }

  function desenharHUD(){
    var vidas = '', i;
    for (i = 0; i < 3; i++) vidas += i < p.vidas ? '♥' : '♡';
    var linhas = [
      [TEXTO.hud[0], String(E.pontos)],
      [TEXTO.hud[1], E.moedas + '/' + E.moedasTotal],
      [TEXTO.hud[2], String(E.skills.length)],
      [TEXTO.hud[3], vidas]
    ];
    var x = 14, y = 70;
    if (W < 720) {                                    // celular: uma linha só, pra não cobrir o personagem
      var curto = '★' + E.pontos + '  ●' + E.moedas + '/' + E.moedasTotal + '  ◆' + E.skills.length + '  ' + vidas;
      ctx.fillStyle = 'rgba(11,15,26,.85)'; ctx.fillRect(0, 56, W, 26);
      ctx.font = '9px ' + FONTE; ctx.textAlign = 'center'; ctx.fillStyle = '#f8fafc';
      ctx.fillText(curto, W / 2, 74);
    } else {
      ctx.fillStyle = 'rgba(11,15,26,.85)'; ctx.fillRect(x, y, 190, 20 + linhas.length * 18);
      ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2; ctx.strokeRect(x, y, 190, 20 + linhas.length * 18);
      ctx.font = '10px ' + FONTE; ctx.textAlign = 'left';
      linhas.forEach(function(l, j){
        ctx.fillStyle = '#94a3b8'; ctx.fillText(l[0], x + 12, y + 24 + j * 18);
        ctx.fillStyle = j === 3 ? '#ff4d7e' : '#f8fafc'; ctx.textAlign = 'right'; ctx.fillText(l[1], x + 178, y + 24 + j * 18); ctx.textAlign = 'left';
      });
    }
    if (E.banner) {
      var b = E.banner, a = Math.min(1, b.t * 4, (b.dur - b.t) * 3);
      ctx.globalAlpha = Math.max(0, a); ctx.textAlign = 'center';
      ctx.font = '28px ' + FONTE; ctx.fillStyle = '#000'; ctx.fillText(b.titulo, W / 2 + 3, H * 0.3 + 3);
      ctx.fillStyle = b.cor; ctx.fillText(b.titulo, W / 2, H * 0.3);
      ctx.font = '12px ' + FONTE; ctx.fillStyle = '#f8fafc'; ctx.fillText(b.sub, W / 2, H * 0.3 + 32);
      ctx.globalAlpha = 1;
    }
  }

  /* ==========================================================
     ESTADOS
     ========================================================== */
  /* h = estado herdado de outra página (ou null para começar do zero) */
  function novaPartida(h){
    M.fases.forEach(function(f){ f.el.classList.remove('fase-ativa'); });
    E.ents = M.criarEntidades();
    M.posicionar(E.ents);
    E.coletados = (h && h.coletados) || {};
    var jaPegos = E.coletados[PAGINA] || [];
    E.ents.forEach(function(e, i){ e.id = i; if (jaPegos.indexOf(i) >= 0) e.vivo = false; });
    E.moedasTotal = E.ents.filter(function(e){ return e.tipo === 'moeda' && !e.oculto; }).length;
    E.moedas = E.ents.filter(function(e){ return e.tipo === 'moeda' && !e.oculto && !e.vivo; }).length;
    E.pontos = h ? h.pontos : 0; E.skills = h ? h.skills : []; E.bugs = h ? h.bugs : 0; E.crono = h ? h.crono : 0;
    E.combo = 0; E.faseMax = 0; E.checkpoint = 0; E.terminou = false; E.parts = []; E.textos = []; E.batidos = new Set();
    p.vidas = h ? h.vidas : 3; p.invuln = 0; p.socando = 0; p.oculto = false;
    colocarNoPouso(0);
    E.partida = true;
  }

  function entrarJogo(semDica){
    document.documentElement.classList.add('modo-jogo');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    painel.hidden = true;
    E.modo = 'jogando'; E.cam = window.scrollY; E.manualAte = 0;
    limparInput();
    if (!semDica) dizer(temToque ? TEXTO.dicaToque : TEXTO.dicaTeclado, 3.5);
  }

  // sem partida aberta nesta página, continua o progresso salvo (se houver)
  function jogar(){ if (!E.partida || E.terminou) novaPartida(E.terminou ? null : lerEstado()); entrarJogo(); }

  function pausar(){
    if (E.modo !== 'jogando' && E.modo !== 'morto') return;
    E.modoAntes = E.modo; E.modo = 'pausado';
    limparInput();
    abrirPainel(TEXTO.pausa);
  }
  function continuar(){ painel.hidden = true; E.modo = E.modoAntes || 'jogando'; antes = performance.now(); }
  function sair(){
    painel.hidden = true; E.modo = 'fora';
    document.documentElement.classList.remove('modo-jogo');
    limparInput();
  }

  function terminar(){
    E.modo = 'fim'; E.terminou = true;
    limparInput(); p.vx = 0;
    gravarEstado(null);
    var s = Math.floor(E.crono);
    var itens = [E.pontos, E.skills.length, E.bugs, Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2)];
    abrirPainel('<h2>' + TEXTO.fim + '</h2><dl>' + itens.map(function(v, i){
      return '<div><dt>' + TEXTO.fimItens[i] + '</dt><dd>' + v + '</dd></div>';
    }).join('') + '</dl>' + TEXTO.fimBotoes);
  }

  function abrirPainel(html){
    painel.innerHTML = '<div class="painel-caixa">' + html + '</div>';
    painel.hidden = false;
    var b = painel.querySelector('button'); if (b) b.focus();
  }
  painel.addEventListener('click', function(e){
    var a = e.target.dataset && e.target.dataset.p;
    if (a === 'continuar') continuar();
    else if (a === 'sair') sair();
    else if (a === 'reiniciar') { novaPartida(null); entrarJogo(); }
  });

  document.querySelectorAll('[data-acao="jogar"]').forEach(function(b){ b.addEventListener('click', jogar); });

  /* ---------- início ---------- */
  M.preparar();
  window.addEventListener('resize', redimensionar);
  if (window.ResizeObserver) new ResizeObserver(pedirMedida).observe(document.getElementById('mundo'));
  if (document.fonts) document.fonts.ready.then(pedirMedida);   // fontes mudam o layout
  window.addEventListener('load', pedirMedida);
  redimensionar();

  // chegou por um cano: tela preta até as fontes carregarem (o layout só fica certo depois), aí sai do cano
  var herdado = lerEstado();
  if (herdado && herdado.viaCano) {
    herdado.viaCano = false; gravarEstado(herdado);
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    E.modo = 'chegando';
    var chegou = false;
    var chegar = function(){
      if (chegou) return;
      chegou = true;
      remedir();
      novaPartida(herdado);
      entrarJogo(true);
      chegarPeloCano(acharCanoDeVolta(herdado.origem));
    };
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(chegar);
    setTimeout(chegar, 1500);
  }
  requestAnimationFrame(laco);

  PF.jogo = {
    jogar: jogar,
    // para depurar no console: PF.jogo.estado()
    estado: function(){ return { modo: E.modo, x: p.x, y: p.y, w: p.w, h: p.h, noChao: !!p.chao, cano: !!(p.chao && p.chao.cano), pontos: E.pontos, vidas: p.vidas }; }
  };
})();
