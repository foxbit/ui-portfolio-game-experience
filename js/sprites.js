/* ==========================================================
   SPRITES · pixel art em código
   Cada sprite é um mapa de caracteres (1 caractere = 1 pixel),
   pré-renderizado uma vez num canvas fora da tela.
   Troque os mapas e a paleta para criar o seu personagem.
   ========================================================== */
window.PF = window.PF || {};

PF.sprites = (function(){
  'use strict';

  var COR = {
    K: '#0b0f1a',                 // contorno
    P: '#7c5cff', p: '#5a3fd6',   // gorro
    S: '#f1c27d', E: '#0b0f1a', m: '#b5654d',
    G: '#22c55e', g: '#15803d',   // moletom
    D: '#1e293b', W: '#f8fafc',   // calça, tênis
    R: '#ff4d7e', r: '#ffffff'    // bug
  };

  var CABECA = [
    '...KKKKKK...',
    '..KPPPPPPK..',
    '.KPPPPPPPPK.',
    '.KppppppppK.',
    '.KSSSSSSSSK.',
    '.KSSESSESSK.',
    '.KSSSSSSSSK.',
    '..KSSmmSSK..',
    '...KKKKKK...'
  ];
  var CORPO = [
    '..KGGGGGGK..',
    '.KGGGgGGGGK.',
    '.KGGGgGGGGK.',
    '.KSGGgGGGSK.',
    '..KGGGGGGK..',
    '..KDDDDDDK..'
  ];
  var PERNAS = {
    parado:  ['..KDDKKDDK..', '..KDDKKDDK..', '.KWWWKKWWWK.'],
    passo1:  ['.KDDK..KDDK.', 'KDDK....KDDK', 'KWWWK...KWWK'],
    passo2:  ['...KDDDDK...', '...KDDDDK...', '..KWWWWWWK..'],
    pulo:    ['..KDDKKDDK..', '.KWWK..KWWK.', '............']
  };
  var BUG = [
    '..K....K..',
    '...K..K...',
    '..KRRRRK..',
    '.KRrRRrRK.',
    'KRRRRRRRRK',
    '.KRRRRRRK.',
    '.K.K..K.K.'
  ];

  function pintar(mapa, esc){
    var c = document.createElement('canvas');
    c.width = mapa[0].length * esc; c.height = mapa.length * esc;
    var g = c.getContext('2d');
    mapa.forEach(function(linha, y){
      for (var x = 0; x < linha.length; x++) {
        var cor = COR[linha[x]];
        if (cor) { g.fillStyle = cor; g.fillRect(x * esc, y * esc, esc, esc); }
      }
    });
    return c;
  }

  var cache = {};
  function obter(nome, esc){
    var chave = nome + esc;
    if (cache[chave]) return cache[chave];
    var mapa = nome === 'bug' ? BUG : CABECA.concat(CORPO, PERNAS[nome]);
    return (cache[chave] = pintar(mapa, esc));
  }

  return { obter: obter, LARG: 12, ALT: 18 };
})();
