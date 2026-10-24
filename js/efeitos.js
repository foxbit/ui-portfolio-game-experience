/* ==========================================================
   EFEITOS · os blocos da página reagem ao peso do personagem
   Cada elemento tocado ganha uma mola em 3 eixos:
     ty  afunda (px)
     rz  inclina para o lado dos pés (graus)
     rx  tomba para trás, em perspectiva (graus)
   Desenhado com transform no próprio elemento. A física não muda:
   o mundo.js lê posições com offsetTop, que ignora transform.
   Para os pés acompanharem o bloco, o jogo pergunta deslocamento().
   ========================================================== */
window.PF = window.PF || {};

PF.efeitos = (function(){
  'use strict';
  var desligado = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // quem pediu menos movimento também não recebe os vídeos dos cases tocando sozinhos (fica o poster)
  if (desligado) document.querySelectorAll('video[autoplay]').forEach(function(v){ v.removeAttribute('autoplay'); v.pause(); v.controls = true; });
  var RAD = Math.PI / 180;
  var MOLA = 240, ATRITO = 13;              // mola pouco amortecida: balança um pouco antes de parar
  var EIXOS = ['ty', 'rz', 'rx'];
  var estados = new Map();                   // elemento -> estado da mola

  // títulos já têm as letras afundando, canos ficam firmes, pisos não são elementos
  function apto(pl){ return !desligado && pl && pl.el && !pl.solido && !pl.cano && !pl.letras; }

  function estado(el){
    var s = estados.get(el);
    if (!s) {
      s = { ty: 0, rz: 0, rx: 0, v: { ty: 0, rz: 0, rx: 0 }, alvo: { ty: 0, rz: 0, rx: 0 }, pesoAte: 0 };
      el.style.transformOrigin = '50% 0';    // gira em torno da borda de cima, onde estão os pés
      estados.set(el, s);
    }
    return s;
  }

  /* em pé no bloco (chamado todo quadro); x = posição dos pés no documento.
     Usa a caixa do elemento, não o trecho: num grupo de botões, o grupo inteiro inclina junto */
  function peso(pl, x){
    if (!apto(pl)) return;
    var meia = Math.max(20, pl.el.offsetWidth / 2);
    var s = estado(pl.el), lado = Math.max(-1, Math.min(1, (x - pl.cx) / meia));
    // a ponta do bloco desce no máximo ~8 px, seja ele estreito ou largo
    var maxRz = Math.min(2.5, Math.asin(Math.min(1, 8 / meia)) / RAD);
    s.pesoAte = performance.now() + 90;
    s.alvo.ty = 3; s.alvo.rz = lado * maxRz; s.alvo.rx = 4;
  }

  /* caiu em cima: empurrão proporcional à velocidade da queda (forca ~0 a 1.6) */
  function pouso(pl, fr, forca){
    if (!apto(pl)) return;
    var s = estado(pl.el);
    s.v.ty += 190 * forca; s.v.rx += 130 * forca; s.v.rz += (fr - 0.5) * 110 * forca;
  }

  /* cabeçada por baixo: o bloco pula para cima */
  function cabecada(pl, fr){
    if (!apto(pl)) return;
    var s = estado(pl.el);
    s.v.ty -= 280; s.v.rx -= 150; s.v.rz += (0.5 - fr) * 130;
  }

  /* soco no chão: onda que sacode os blocos em volta, com atraso pela distância */
  function onda(cx, cy, raio, forca){
    if (desligado) return;
    PF.mundo.plats.forEach(function(pl){
      if (!apto(pl)) return;
      var dx = Math.max(0, pl.x - cx, cx - (pl.x + pl.w));
      var dy = Math.max(0, pl.y - cy, cy - pl.base);
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > raio) return;
      var f = forca * (1 - d / raio);
      var acima = (pl.y + pl.base) / 2 < cy ? -1 : 1, esquerda = pl.x + pl.w / 2 < cx ? -1 : 1;
      setTimeout(function(){
        var s = estado(pl.el);
        s.v.ty += 320 * f; s.v.rx += 260 * f * acima; s.v.rz += 100 * f * esquerda;
      }, d * 0.75);
    });
  }

  /* quanto o topo do bloco no ponto x está deslocado agora (para pés, bugs e moedas acompanharem) */
  function deslocamento(pl, x){
    var s = pl && pl.el && estados.get(pl.el);
    if (!s) return 0;
    // o giro é em volta do centro da caixa do elemento, que pode não ser o centro da plataforma
    return s.ty + (x - (pl.cx !== undefined ? pl.cx : pl.x + pl.w / 2)) * Math.sin(s.rz * RAD);
  }

  function passo(dt){
    var agora = performance.now();
    estados.forEach(function(s, el){
      if (agora > s.pesoAte) s.alvo.ty = s.alvo.rz = s.alvo.rx = 0;
      var parado = true;
      EIXOS.forEach(function(k){
        s.v[k] += (-MOLA * (s[k] - s.alvo[k]) - ATRITO * s.v[k]) * dt;
        s[k] += s.v[k] * dt;
        if (Math.abs(s[k]) > 0.02 || Math.abs(s.v[k]) > 0.05) parado = false;
      });
      if (parado) {                          // voltou ao lugar: limpa o transform e esquece o elemento
        el.style.transform = ''; el.style.transformOrigin = '';
        estados.delete(el);
        return;
      }
      el.style.transform = 'perspective(900px) translateY(' + s.ty.toFixed(2) + 'px) rotateX(' +
        (-s.rx).toFixed(2) + 'deg) rotateZ(' + s.rz.toFixed(2) + 'deg)';
    });
  }

  return { peso: peso, pouso: pouso, cabecada: cabecada, onda: onda, deslocamento: deslocamento, passo: passo };
})();
