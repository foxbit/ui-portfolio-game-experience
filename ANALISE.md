# Análise: portfólio como jogo de plataforma

Referência estudada: https://www.pvwebprojects.com/pedro/ (JavaScript puro, sem engine de jogo).

## A ideia central: a página é a fase

Ninguém desenhou um mapa à parte. O jogo **lê o HTML** e transforma os elementos em plataformas.
O conteúdo continua sendo um site normal (acessível, indexável, legível sem jogar), e o jogo é uma
camada por cima.

| Peça | Como funciona |
|---|---|
| **Plataformas** | Todo elemento com `data-plat` vira uma plataforma. A posição vem de `offsetTop/offsetLeft` (ignora `transform`, então animações CSS não estragam a física). Se o elemento tem caixa visível (fundo, borda, cartão, botão), o chão é a **borda de cima** da caixa. Se não tem (parágrafo, lista, grupo de botões), o chão é a **primeira linha do que aparece**: do começo ao fim do texto/botões, na altura do topo das letras. Assim ninguém fica flutuando sobre espaço vazio. Vãos maiores que 8px (entre botões, entre palavras de um título) dividem a plataforma em **trechos**; bugs e moedas ficam no trecho mais largo, e o personagem (30px) atravessa vãos pequenos andando. `data-caixa` força usar a caixa inteira. |
| **Títulos** | Com `data-letras`, o texto é quebrado em `<span>` por letra. A plataforma fica na altura do topo das maiúsculas (medido com `canvas.measureText`) e cada letra pisada afunda via classe CSS. |
| **Fases** | Cada `<section data-fase>` é uma fase. No fundo dela o jogo cria um **chão sólido** (`div.chao`) com um **buraco** posicionado exatamente acima do `data-pouso` da próxima fase. Para avançar, você cai pelo buraco. |
| **Checkpoint** | O `data-pouso` (geralmente o `h2`) é onde você renasce ao morrer. |
| **Câmera** | A câmera **é a rolagem da página**: a cada quadro, `window.scrollTo()` segue o personagem com suavização exponencial. Se a pessoa rolar com a roda, a câmera solta por 1,4 s. |
| **Desenho** | Um `<canvas>` `position:fixed` cobre a janela com `pointer-events:none`. Ele desenha só o personagem, inimigos, coletáveis, partículas e HUD; as plataformas são o próprio DOM. |
| **Entidades** | Atributos no HTML: `data-moedas="4"`, `data-skill="React"`, `data-bugs="1"`. Elas ficam presas à plataforma do elemento e se reposicionam quando o layout muda. |
| **Responsivo** | `ResizeObserver` + `document.fonts.ready` → mede tudo de novo e reencaixa o personagem na mesma plataforma. No celular a escala do pixel cai de 3 para 2 e toda a física é multiplicada por `k = esc / 3`. |

## A sensação de jogo (o "game feel")

O que deixa o controle gostoso são truques clássicos de plataforma, todos em `js/jogo.js`:

- **Física em passo fixo** (1/120 s) com acumulador: mesmo comportamento em 60 Hz ou 144 Hz.
- **Aceleração e atrito** separados no chão e no ar (`aproximar(vx, alvo, acel*dt)`), em vez de velocidade instantânea.
- **Coyote time** (0,1 s): ainda dá para pular logo depois de sair da borda.
- **Jump buffer** (0,13 s): apertar pulo um pouco antes de tocar o chão ainda conta.
- **Pulo variável**: soltar o botão cedo corta a velocidade para cima (pulo curto).
- **Pulo duplo** no ar.
- **Plataformas de mão única**: só colidem quando os pés cruzam a borda de cima *naquele passo*, caindo. Por isso dá para subir por baixo.
- **↓ no chão** atravessa a plataforma; **↓ no ar** é um soco no chão (para no ar, despenca, mata inimigos em volta, tremor de tela).
- **Cabeçada**: subindo por baixo de um cartão, ele pula (animação CSS) e dá pontos na primeira vez.
- **Squash & stretch**: o sprite estica ao pular e achata ao pousar, ancorado nos pés.
- **Virar em "3D"**: o `scaleX` vai de 1 a -1 suavemente em vez de espelhar de uma vez.
- **Pisar no inimigo** quica (mais alto se segurar o pulo); encostar de lado tira vida e empurra.
- **Combo**: matar vários inimigos sem tocar o chão multiplica os pontos.

## Blocos com peso (js/efeitos.js)

Os parágrafos e cartões reagem ao personagem com uma **mola** em 3 eixos: afundar (`translateY`),
inclinar para o lado dos pés (`rotateZ`) e tombar para trás em perspectiva (`rotateX`), com
`transform-origin` na borda de cima.

- **Pouso:** empurrão proporcional à velocidade da queda. Cair de longe afunda mais e balança mais.
- **Peso:** parado em cima, o bloco fica levemente afundado e inclinado para o lado onde estão os pés.
- **Cabeçada:** por baixo, o bloco pula para cima (cartões também dão pontos na primeira vez).
- **Soco no chão:** uma onda sacode os blocos num raio, com atraso proporcional à distância.
- A física não muda (as posições vêm de `offsetTop`). Só o desenho dos pés, dos bugs e das moedas
  soma `PF.efeitos.deslocamento()` para acompanhar o bloco balançando.
- Ficam de fora: títulos (as letras já afundam), canos (ficam firmes) e os pisos das fases.
- Mola pouco amortecida (`MOLA = 240`, `ATRITO = 13`): suba o atrito para balançar menos.
- Com `prefers-reduced-motion` o efeito é desligado.

## Canos: navegar entre páginas (ideia nova, não existe no original)

Um cano é um link marcado com `data-plat data-cano`:

```html
<article class="cartao projeto" data-plat>
  <a class="cano" href="work/oab-parana.html" data-plat data-cano aria-label="Open case: OAB Paraná">
    <span class="rotulo">Ver projeto</span>
  </a>
  ...
</article>
```

- **No jogo:** o topo do cano é plataforma e os lados são parede sólida (é preciso pular em cima).
  Em cima dele aparece a dica `↓ Abrir Projeto um`; com **↓** o personagem afunda no cano
  (recortado na boca), a tela fecha num círculo e o navegador abre o `href`.
- **Lendo sem jogar:** é um link normal. Clicar abre a página, e passar o mouse mostra o rótulo.
- **Progresso entre páginas:** antes de navegar, o estado (pontos, vidas, skills, tempo e as moedas
  já pegas em cada página) vai para o `sessionStorage` com `viaCano: true`. A página nova lê esse estado,
  começa já em modo jogo com a tela preta, espera as fontes carregarem, e o círculo abre com o personagem
  saindo de um cano.
- **Por qual cano ele sai:** se a página tem cano na primeira fase (cano de entrada das subpáginas),
  sai por ele. Se não tem (index), sai do cano que leva de volta à página de origem, ou seja, do card do projeto.
- **Botão voltar do navegador:** a página volta do cache congelada no meio da entrada; o evento `pageshow`
  faz o personagem sair do mesmo cano.
- O fim de jogo (pisar no último chão) só vale em páginas com `<body data-fim>` (o index). Nas
  subpáginas o último chão é só chão, e a saída é pelos canos do rodapé.

Páginas de case: [work/](work/) (6 cases + [archive.html](work/archive.html)). O rodapé de cada case tem o cano "Home" e o "Next case", em ciclo.
Para criar outra, copie uma delas, troque o conteúdo e aponte um cano de algum card para ela.

### Imagens e vídeos

- `assets/work/<case>/cover.webp`: capa em **pixel art desenhada em código** por [ferramentas/capas.py](ferramentas/capas.py)
  (uma função por cena, grade 80×45 ampliada 16×, paleta do site; o designer de gorro é o personagem do jogo).
  Para mudar uma cena, edite a função e rode `python3 ferramentas/capas.py <case>`.
- As miniaturas do Arquivo (`assets/archive/`) são as ilustrações antigas em versão noturna (grade 160, paleta do site),
  geradas com `python3 ferramentas/capas.py --arquivo` a partir de `ferramentas/originais/archive/`.
  A pasta `ferramentas/` não precisa ir para o servidor.
- As imagens internas de cada case (telas, diagramas) continuam como no site antigo, em WebP: pixelizadas ficariam ilegíveis.
  OAB e Insper não tinham imagens no post: usei recortes dos próprios sites de discovery (capa do relatório,
  linha do tempo, visão geral; card de persona, módulos do MVP), capturados com o Chrome em modo headless.
- `assets/logos/` e `assets/icons/`: logos das empresas (monocromáticos) e ícones de contato em pixel art, desenhados
  por [ferramentas/icones.py](ferramentas/icones.py) com uma fonte pixel própria. Os logos são reinterpretações
  dos nomes/símbolos, não os arquivos oficiais. Para trocar uma empresa, edite `LOGOS` e rode `python3 ferramentas/icones.py`.
- Os GIFs do site antigo viraram **MP4** (`<video autoplay muted loop playsinline>`), com um `-poster.webp`
  extraído do vídeo: 16,5 MB em GIF caíram para 1,4 MB. Com `prefers-reduced-motion`, os vídeos não tocam
  sozinhos (ficam o poster e os controles).
- `assets/archive/`: miniaturas (640×360) dos projetos do Arquivo.
- Toda imagem fica numa moldura `figure.cartao.midia[data-plat]`: por ter borda, a moldura inteira vira
  plataforma. `width`/`height` no `<img>` reservam o espaço antes de carregar, então o layout (e as plataformas)
  não pulam quando a imagem chega.

Depuração: `PF.jogo.estado()` no console mostra modo, posição, pontos e vidas.

## O que o site original tem a mais (não reproduzido neste protótipo)

- Cenas 3D com three.js (peças que surgem ao lado conforme a fase) e efeitos 3D nos cartões.
- Fundo com partículas em paralaxe que viram riscos quando a página desce rápido.
- Sons sintetizados com Web Audio (sem arquivos).
- Morte em "voxels" (cada pixel do personagem vira um cubo voando), troféus, inimigo voador (glitch), tutorial guiado, níveis de qualidade automáticos para aparelhos fracos.

Tudo isso pode entrar depois em cima da mesma base.

## Estrutura do protótipo

```
index.html        conteúdo do portfólio, marcado com data-plat / data-fase / data-pouso / ...
work/*.html       páginas de case e arquivo: cano de entrada no topo, canos de saída no rodapé
css/estilo.css    visual do site + chão/buraco das fases + estados .pisado / .pisada / .cabecada
js/sprites.js     personagem e inimigo em pixel art (mapas de caracteres); troque para o seu
js/mundo.js       lê o DOM e monta plataformas, fases, pisos com buraco e entidades
js/jogo.js        entrada, física, colisões, câmera, partículas, HUD, estados (menu/jogo/pausa/fim)
```

## Como montar uma fase nova

```html
<section class="fase" data-fase data-nome="Blog">
  <h2 data-plat data-pouso data-letras>Blog</h2>          <!-- onde cai ao entrar -->
  <p data-plat data-moedas="3">Texto...</p>                <!-- plataforma com 3 moedas -->
  <article class="cartao" data-plat data-bugs="1">...</article>  <!-- cartão com 1 inimigo -->
</section>
```

Regra de design de fase: o pulo duplo alcança uns **240 px** de altura. Mantenha os elementos
que você quer que sejam "subíveis" a menos que isso um do outro; descer é sempre possível.

## Rodar

```bash
python3 -m http.server 5173
```
e abrir http://localhost:5173.
