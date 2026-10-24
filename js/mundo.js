/* ==========================================================
   MUNDO · lê o HTML e transforma a página em fase
   - [data-plat]    vira plataforma: a borda de cima, se o elemento tem caixa visível
                    (fundo/borda); senão a primeira linha do que aparece (texto, botões)
   - [data-caixa]   força usar a caixa inteira do elemento
                    vãos maiores que 8 px (entre botões, entre palavras) dividem a plataforma em trechos
   - [data-pouso]   plataforma de chegada (checkpoint) da fase
   - [data-letras]  título: letras viram spans e afundam ao pisar
   - [data-fase]    seção; o fundo dela é um chão sólido com um
                    buraco em cima do pouso da próxima fase
   - [data-moedas="n"], [data-skill="Nome"]  coletáveis
   - [data-bugs="n"]                         inimigos
   - a[data-cano]   cano: plataforma com paredes; ↓ em cima abre o href
   Tudo em coordenadas do documento (px a partir do topo da página).
   ========================================================== */
window.PF = window.PF || {};

PF.mundo = (function(){
  'use strict';

  var M = { plats: [], paredes: [], porEl: new Map(), trechos: new Map(), fases: [], pisos: [], W: 0, H: 0, esc: 3 };

  /* posição no documento ignorando transform: animações CSS não mexem na física */
  function posDoc(el){
    var x = 0, y = 0, n = el;
    while (n) {
      x += n.offsetLeft; y += n.offsetTop;
      var pai = n.offsetParent;
      if (pai) { x += pai.clientLeft; y += pai.clientTop; }
      n = pai;
    }
    return { x: x, y: y };
  }

  /* distância do topo da caixa de linha até o topo das maiúsculas (os pés pousam nas letras) */
  var medidor = document.createElement('canvas').getContext('2d');
  function topoDasLetras(el){
    var cs = getComputedStyle(el), fs = parseFloat(cs.fontSize);
    medidor.font = cs.fontWeight + ' ' + fs + 'px ' + cs.fontFamily;
    var m = medidor.measureText('H');
    var sobe = m.fontBoundingBoxAscent, desce = m.fontBoundingBoxDescent, cap = m.actualBoundingBoxAscent;
    if (!(sobe > 0) || !(cap > 0)) return 0.14 * fs;
    var lh = cs.lineHeight === 'normal' ? sobe + desce : parseFloat(cs.lineHeight);
    return (lh - (sobe + desce)) / 2 + sobe - cap;
  }

  /* folga entre o topo da caixa de um texto e o topo das maiúsculas, para aquela fonte */
  var folgas = {};
  function folgaDoTexto(el){
    var cs = getComputedStyle(el), fonte = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    if (folgas[fonte] === undefined) {
      medidor.font = fonte;
      var m = medidor.measureText('H');
      folgas[fonte] = m.fontBoundingBoxAscent > 0 ? m.fontBoundingBoxAscent - m.actualBoundingBoxAscent : 0;
    }
    return folgas[fonte];
  }

  /* o elemento desenha uma caixa visível (fundo, borda ou é um controle)? então a caixa toda é o chão */
  var TEM_CAIXA = /^(BUTTON|IMG|SVG|CANVAS|VIDEO|INPUT|SELECT|TEXTAREA)$/;
  function temCaixa(el){
    if (TEM_CAIXA.test(el.tagName.toUpperCase())) return true;
    var cs = getComputedStyle(el);
    return cs.backgroundImage !== 'none' || parseFloat(cs.borderTopWidth) > 0 ||
      !/rgba\(.*,\s*0\)|transparent/.test(cs.backgroundColor);
  }

  /* retângulos do que aparece de fato: linhas de texto e filhos com caixa (em coordenadas da tela) */
  var faixa = document.createRange();
  function visiveis(el, out){
    Array.prototype.forEach.call(el.childNodes, function(n){
      if (n.nodeType === 3) {
        if (!n.textContent.trim()) return;
        faixa.selectNodeContents(n);
        var folga = folgaDoTexto(n.parentElement);
        Array.prototype.forEach.call(faixa.getClientRects(), function(r){
          if (r.width > 1) out.push({ l: r.left, r: r.right, t: r.top + folga, b: r.bottom });
        });
      } else if (n.nodeType === 1 && n.getClientRects().length) {
        if (temCaixa(n)) { var r = n.getBoundingClientRect(); out.push({ l: r.left, r: r.right, t: r.top, b: r.bottom }); }
        else visiveis(n, out);
      }
    });
    return out;
  }

  /* a plataforma de um elemento sem caixa visível é a primeira "linha" do seu conteúdo,
     na altura do topo das letras (ou dos botões); devolve os trechos [x0, x1] em coordenadas do documento */
  function trechosDoConteudo(el, plat){
    // canos desenham o visual em ::before/::after; data-caixa força a caixa inteira em qualquer elemento
    if (el.hasAttribute('data-cano') || el.hasAttribute('data-caixa') || temCaixa(el)) return null;
    var rs = visiveis(el, []);
    if (!rs.length) return null;
    var primeiro = rs.reduce(function(a, r){ return r.t < a.t ? r : a; });
    // medido relativo à caixa do próprio elemento, assim um transform da mola no meio não atrapalha
    var caixa = el.getBoundingClientRect(), dx = plat.x - caixa.left;
    plat.y = Math.round(plat.y + primeiro.t - caixa.top);
    return rs.filter(function(r){ return r.t < primeiro.b - 2; })   // só a faixa vertical da primeira linha
      .map(function(r){ return [r.l + dx, r.r + dx]; });
  }

  /* junta trechos encostados; um vão maior que VAO (entre botões, entre palavras do título) separa a plataforma */
  var VAO = 8;
  function juntarTrechos(ts){
    ts.sort(function(a, b){ return a[0] - b[0]; });
    var out = [];
    ts.forEach(function(t){
      var ult = out[out.length - 1];
      if (ult && t[0] - ult[1] <= VAO) ult[1] = Math.max(ult[1], t[1]);
      else out.push([t[0], t[1]]);
    });
    return out;
  }

  function separarLetras(el){
    if (el.querySelector('.l')) return;
    var texto = el.textContent.replace(/\s+/g, ' ').trim();
    el.setAttribute('aria-label', texto);
    el.textContent = '';
    var caixa = document.createElement('span');
    caixa.setAttribute('aria-hidden', 'true');
    texto.split(' ').forEach(function(palavra, i){
      if (i) caixa.appendChild(document.createTextNode(' '));
      var p = document.createElement('span');
      p.className = 'pal';
      Array.prototype.forEach.call(palavra, function(ch){
        var l = document.createElement('span');
        l.className = 'l'; l.textContent = ch;
        p.appendChild(l);
      });
      caixa.appendChild(p);
    });
    el.appendChild(caixa);
  }

  /* o chão de cada fase existe de verdade na página (div .chao); o jogo só lê onde ele está */
  var ALTURA_CHAO = 10;
  function montarChao(f, buraco){
    var el = f.el._chao;
    if (!el) {
      el = document.createElement('div');
      el.className = 'chao' + (buraco ? '' : ' fim');
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = buraco ? '<i></i><i></i><b class="buraco"></b>' : '<i></i>';
      f.el.appendChild(el);
      f.el._chao = el;
    }
    if (!buraco) return;
    var x0 = buraco.x0 - f.x, x1 = buraco.x1 - f.x, partes = el.children;
    partes[0].style.cssText = 'left:0;width:' + x0 + 'px';
    partes[1].style.cssText = 'left:' + x1 + 'px;right:0';
    partes[2].style.cssText = 'left:' + x0 + 'px;width:' + (x1 - x0) + 'px';
  }

  M.preparar = function(){
    document.querySelectorAll('[data-letras]').forEach(separarLetras);
  };

  M.medir = function(){
    var raiz = document.documentElement;
    M.W = raiz.clientWidth;
    M.H = raiz.scrollHeight;
    M.esc = M.W < 720 ? 2 : 3;
    M.plats = [];
    M.paredes = [];
    M.porEl = new Map();          // elemento -> seu trecho mais largo (onde ficam bugs e moedas)
    M.trechos = new Map();        // elemento -> todos os seus trechos

    document.querySelectorAll('[data-plat]').forEach(function(el){
      var w = el.offsetWidth;
      if (!el.offsetParent || w < 16) return;
      var p = posDoc(el);
      var plat = {
        x: p.x, y: p.y, w: w, el: el, solido: false, letras: null,
        cx: p.x + w / 2,                       // centro da caixa (origem do transform da mola)
        cartao: el.classList.contains('cartao'),
        base: p.y + el.offsetHeight            // borda de baixo, para a cabeçada
      };
      if (el.hasAttribute('data-letras')) {
        plat.y = Math.round(p.y + topoDasLetras(el));
        // a plataforma é só a primeira linha de letras, do tamanho exato do texto
        var ls = el.querySelectorAll('.l');
        if (ls.length) {
          var topo = posDoc(ls[0]).y;
          plat.letras = [];
          for (var i = 0; i < ls.length; i++) {
            var q = posDoc(ls[i]);
            if (Math.abs(q.y - topo) > 6) break;
            plat.letras.push({ x0: q.x, x1: q.x + ls[i].offsetWidth, el: ls[i] });
          }
        }
      }
      var ts = plat.letras ? plat.letras.map(function(L){ return [L.x0, L.x1]; }) : trechosDoConteudo(el, plat);
      ts = ts ? juntarTrechos(ts) : [[plat.x, plat.x + plat.w]];
      // cano: o topo é plataforma, os lados são parede, e ↓ em cima leva para o href
      if (el.hasAttribute('data-cano')) {
        plat.cano = el.href;
        plat.nomeCano = el.getAttribute('aria-label') || 'another page';
      }
      var lista = [], maior = null;
      ts.forEach(function(t){
        var w = Math.round(t[1] - t[0]);
        if (w < 16) return;
        var tr = Object.assign({}, plat, { x: Math.round(t[0]), w: w, seg: lista.length });
        lista.push(tr);
        M.plats.push(tr);
        if (tr.cano) M.paredes.push(tr);
        if (!maior || w > maior.w) maior = tr;
      });
      if (!maior) return;
      M.porEl.set(el, maior);
      M.trechos.set(el, lista);
    });

    M.fases = Array.prototype.map.call(document.querySelectorAll('[data-fase]'), function(el, i){
      var p = posDoc(el), pouso = el.querySelector('[data-pouso]');
      return {
        el: el, i: i, nome: el.dataset.nome || ('Stage ' + i),
        x: p.x, top: p.y, bottom: p.y + el.offsetHeight,
        pouso: pouso ? M.porEl.get(pouso) : null
      };
    });

    // pisos: o fundo de cada fase é sólido, com um buraco em cima do pouso da próxima
    M.pisos = [];
    var gw = Math.round(Math.max(100, 40 * M.esc));
    M.fases.forEach(function(f, i){
      var y = f.bottom - ALTURA_CHAO, prox = M.fases[i + 1];
      if (!prox) {
        M.plats.push({ x: 0, y: y, w: M.W, solido: true, piso: i, final: true });
        M.pisos.push({ fase: i, y: y, final: true });
        montarChao(f, null);
        return;
      }
      var cx = prox.pouso ? prox.pouso.x + prox.pouso.w / 2 : M.W / 2;
      cx = Math.max(gw / 2 + 12, Math.min(M.W - gw / 2 - 12, cx));
      var x0 = Math.round(cx - gw / 2), x1 = Math.round(cx + gw / 2);
      M.plats.push({ x: 0, y: y, w: x0, solido: true, piso: i });
      M.plats.push({ x: x1, y: y, w: M.W - x1, solido: true, piso: i });
      M.pisos.push({ fase: i, y: y, x0: x0, x1: x1, cx: cx });
      montarChao(f, { x0: x0, x1: x1 });
    });

    M.plats.sort(function(a, b){ return a.y - b.y; });
  };

  M.faseDe = function(y){
    for (var i = M.fases.length - 1; i >= 0; i--) if (y >= M.fases[i].top) return i;
    return 0;
  };

  /* ---------- entidades presas aos elementos ---------- */
  M.criarEntidades = function(){
    var ents = [];
    document.querySelectorAll('[data-moedas]').forEach(function(el){
      var n = +el.dataset.moedas || 0;
      for (var i = 0; i < n; i++) ents.push({ tipo: 'moeda', el: el, i: i, n: n, vivo: true });
    });
    document.querySelectorAll('[data-skill]').forEach(function(el){
      ents.push({ tipo: 'skill', el: el, nome: el.dataset.skill, vivo: true });
    });
    document.querySelectorAll('[data-bugs]').forEach(function(el){
      var n = +el.dataset.bugs || 0;
      for (var i = 0; i < n; i++) ents.push({ tipo: 'bug', el: el, u: (i + 0.5) / n, dir: i % 2 ? -1 : 1, vivo: true, vel: 50 + Math.random() * 30 });
    });
    return ents;
  };

  /* recalcula a posição-base de cada entidade (sempre depois de medir) */
  M.posicionar = function(ents){
    var k = M.esc / 3;
    ents.forEach(function(e){
      var pl = M.porEl.get(e.el);
      e.oculto = !pl;
      if (!pl) return;
      e.plat = pl;
      if (e.tipo === 'moeda') {
        var t = e.n > 1 ? e.i / (e.n - 1) : 0.5;
        var span = Math.min(pl.w * 0.7, e.n * 46 * k);
        var cx = pl.x + pl.w / 2;
        e.x = cx - span / 2 + span * t;
        e.y = pl.y - 30 * k - Math.sin(Math.PI * t) * 24 * k;
      } else if (e.tipo === 'skill') {
        e.x = pl.x + pl.w * 0.8; e.y = pl.y - 56 * k;
      } else if (e.tipo === 'bug') {
        e.w = 10 * M.esc; e.h = 7 * M.esc;
      }
    });
  };

  M.posDoc = posDoc;
  return M;
})();
