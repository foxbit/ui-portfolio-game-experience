"""Capas dos cases em pixel art, desenhadas em código.

Cada cena é uma grade de 80x45 pixels ampliada 16x (1280x720) sem suavização: no card do
site isso dá a mesma escala de pixel do personagem do jogo. Paleta do site e do jogo.

    python3 ferramentas/capas.py              # gera todas em assets/work/<case>/cover.webp
    python3 ferramentas/capas.py insper       # só uma
    python3 ferramentas/capas.py --arquivo    # miniaturas do Arquivo (versão noturna das ilustrações antigas)
"""
import os, sys
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H, ESC = 80, 45, 16

COR = {
  'K': '#0b0f1a', 'f': '#111827', 'b': '#1f2a3d', 'h': '#2f4a6b',          # contorno, parede, superfícies
  'G': '#22c55e', 'g': '#15803d', 'P': '#7c5cff', 'p': '#3b2a99',          # verde, roxo
  'Y': '#fbbf24', 'y': '#c2861a', 'W': '#f8fafc', 'w': '#e2e8f0', 's': '#94a3b8', 'c': '#475569',
  'S': '#f1c27d', 'd': '#d49877', 'T': '#8d5524', 't': '#6b3e1a',          # peles
  'H': '#3b2414', 'O': '#e07a3a', 'E': '#0b0f1a', 'm': '#b5654d',          # cabelos, olho, boca
  'B': '#2563eb', 'n': '#1e40af', 'R': '#ff4d7e', 'r': '#c2265a', 'D': '#1e293b',
}

class Tela:
    def __init__(self, fundo='f'):
        self.im = Image.new('RGB', (W, H), self.rgb(fundo))
        self.px = self.im.load()

    @staticmethod
    def rgb(c): h = COR[c]; return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

    def ponto(self, x, y, c):
        if 0 <= x < W and 0 <= y < H and c in COR: self.px[x, y] = self.rgb(c)

    def ret(self, x, y, w, h, c):
        for j in range(h):
            for i in range(w): self.ponto(x + i, y + j, c)

    def caixa(self, x, y, w, h, c, borda='K'):
        self.ret(x, y, w, h, borda); self.ret(x + 1, y + 1, w - 2, h - 2, c)

    def mapa(self, x, y, linhas, troca=None, espelho=False):
        troca = troca or {}
        for j, l in enumerate(linhas):
            if espelho: l = l[::-1]
            for i, c in enumerate(l): self.ponto(x + i, y + j, troca.get(c, c))

    def linha(self, x0, y0, x1, y1, c, passo=1):
        # Bresenham; passo > 1 desenha pontilhado
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err, n = dx + dy, 0
        while True:
            if n % passo == 0: self.ponto(x0, y0, c)
            if x0 == x1 and y0 == y1: break
            e2 = 2 * err
            if e2 >= dy: err += dy; x0 += sx
            if e2 <= dx: err += dx; y0 += sy
            n += 1

    def brilho(self, x, y):
        self.ponto(x, y, 'Y')
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)): self.ponto(x + dx, y + dy, 'y')

    def balao(self, x, y, w, h, cauda_x, dentro=None):
        """balão de fala com a ponta para baixo em cauda_x; dentro(x, y) desenha o conteúdo"""
        self.caixa(x, y, w, h, 'W')
        self.ponto(cauda_x, y + h, 'K'); self.ponto(cauda_x + 1, y + h, 'W'); self.ponto(cauda_x + 2, y + h, 'K')
        self.ponto(cauda_x + 1, y + h + 1, 'K')
        if dentro: dentro(x + 2, y + 2)

    def chao(self, y=38):
        self.ret(0, y, W, 1, 'h'); self.ret(0, y + 1, W, H - y - 1, 'b')

    def salvar(self, destino):
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        self.im.resize((W * ESC, H * ESC), Image.NEAREST).save(destino, quality=92)


# ---------- gente: as mesmas proporções do personagem do jogo (12x18) ----------
CABECAS = {
  'gorro': ['...KKKKKK...', '..KPPPPPPK..', '.KPPPPPPPPK.', '.KppppppppK.', '.KSSSSSSSSK.',
            '.KSSESSESSK.', '.KSSSSSSSSK.', '..KSSmmSSK..', '...KKKKKK...'],
  'curto': ['...KKKKKK...', '..KHHHHHHK..', '.KHHHHHHHHK.', '.KHSSSSSSHK.', '.KSSSSSSSSK.',
            '.KSSESSESSK.', '.KSSSSSSSSK.', '..KSSmmSSK..', '...KKKKKK...'],
  'longo': ['...KKKKKK...', '..KHHHHHHK..', '.KHHHHHHHHK.', 'KHHSSSSSSHHK', 'KHSSSSSSSSHK',
            'KHSSESSESSHK', 'KHSSSSSSSSHK', 'KHHKSmmSKHHK', '.KK.KKKK.KK.'],
  'coque': ['....KKKK....', '...KHHHHK...', '..KKHHHHKK..', '.KHHHHHHHHK.', '.KHSSSSSSHK.',
            '.KSSESSESSK.', '.KSSSSSSSSK.', '..KSSmmSSK..', '...KKKKKK...'],
}
CORPO = ['..KRRRRRRK..', '.KRRRrRRRRK.', '.KRRRrRRRRK.', '.KSRRrRRRSK.', '..KRRRRRRK..', '..KDDDDDDK..']
PERNAS = ['..KDDKKDDK..', '..KDDKKDDK..', '.KWWWKKWWWK.']
# braço levantado, saindo do ombro na diagonal (desenhado por cima do corpo)
BRACO = ['...KS', '..KRK', '.KRK.', 'KRK..']
# glifos de 3x5 para os balões
INTERROGACAO = ['YYY', '..Y', '.YY', '...', '.Y.']

def pessoa(t, x, y, cabeca='curto', roupa='G', sombra='g', cabelo='H', pele='S', calca='D', virado=False, aponta=False):
    """desenha uma pessoa de 12x18 com os pés em y + 18; virado = olhando para a esquerda"""
    troca = {'H': cabelo, 'S': pele, 'R': roupa, 'r': sombra, 'D': calca}
    if pele == 'T': troca['m'] = 'd'                                 # boca clara na pele escura (escura parecia barba)
    t.mapa(x, y, CABECAS[cabeca] + CORPO + PERNAS, troca, espelho=virado)
    if aponta: t.mapa(x - 2 if virado else x + 9, y + 6, BRACO, troca, espelho=virado)

def designer(t, x, y, **kw):
    pessoa(t, x, y, cabeca='gorro', roupa='G', sombra='g', **kw)


# ======================================================================
# CENAS
# ======================================================================
def oab_parana(t):
    """discovery numa instituição centenária: o prédio antigo, a entrevista e o mural de achados"""
    t.chao()
    # prédio institucional com colunas
    for j in range(6):                                               # frontão
        t.ret(14 - j * 2, 3 + j, 1 + j * 4, 1, 's')
    t.ponto(14, 5, 'Y')
    t.ret(3, 9, 23, 7, 'w'); t.ret(3, 16, 23, 1, 's')                # arquitrave com o nome
    for i, letra in enumerate((['DDD', 'D.D', 'D.D', 'D.D', 'DDD'], ['.D.', 'D.D', 'DDD', 'D.D', 'D.D'],
                               ['DD.', 'D.D', 'DD.', 'D.D', 'DD.'])):
        t.mapa(9 + i * 4, 10, letra)
    t.ret(4, 17, 21, 18, 'b')
    for x in (4, 10, 16, 22):
        t.ret(x, 17, 3, 18, 'w'); t.ret(x + 2, 17, 1, 18, 's')
    t.ret(2, 35, 25, 1, 'w'); t.ret(1, 36, 27, 2, 's')
    # a entrevista
    pessoa(t, 31, 20, cabeca='longo', roupa='c', sombra='D', cabelo='H', pele='T')    # advogada
    designer(t, 45, 20, virado=True)
    t.balao(28, 7, 13, 9, 34, lambda x, y: [t.ret(x, y + k * 2, w, 1, 's') for k, w in enumerate((9, 6, 8))])
    t.balao(44, 8, 9, 9, 48, lambda x, y: t.mapa(x + 1, y, INTERROGACAO))
    # mural de achados: 36 entrevistas viram notas
    t.caixa(58, 4, 20, 31, 'b', 'h')
    cores = 'YGPRwYGPRw'
    for k in range(20):
        cx, cy = 60 + (k % 4) * 4, 6 + (k // 4) * 5
        t.ret(cx, cy, 3, 3, cores[k % len(cores)]); t.ponto(cx + 1, cy, 'K')
    t.ret(60, 32, 16, 1, 'G')                                        # roadmap
    t.brilho(42, 4); t.brilho(55, 18)


def insper(t):
    """planilhas espalhadas viram uma plataforma única de cursos, salas e recursos"""
    t.chao()
    # pilha de planilhas
    for k, (x, y) in enumerate(((3, 22), (5, 19), (2, 16))):
        t.caixa(x, y, 14, 16, 'W')
        for j in range(2, 15, 3): t.ret(x + 1, y + j, 12, 1, 'G')
        for i in range(4, 13, 4): t.ret(x + i, y + 1, 1, 14, 'g')
        t.ponto(x + 6, y + 5, 'R'); t.ponto(x + 10, y + 11, 'R')
    for x, y in ((14, 6), (6, 9)):                                   # folhas voando
        t.caixa(x, y, 5, 4, 'W'); t.ret(x + 1, y + 2, 3, 1, 'G')
    # seta da bagunça para a plataforma
    t.ret(19, 14, 9, 1, 'Y'); t.mapa(27, 12, ['Y..', 'YY.', 'YYY', 'YY.', 'Y..'])
    # a plataforma: calendário de salas x horários
    t.caixa(33, 3, 45, 28, 'b')
    t.ret(34, 4, 43, 3, 'P'); t.ret(35, 5, 6, 1, 'W')
    t.ret(34, 7, 6, 23, 'D')
    for k in range(5): t.ret(35, 9 + k * 4, 4, 1, 's')
    blocos = ['G.Y.P', 'PG..Y', '.YGP.', 'Y..GP', 'GP.Y.']
    for j, linha in enumerate(blocos):
        for i, c in enumerate(linha):
            t.ret(42 + i * 7, 9 + j * 4, 6, 3, 'h' if c == '.' else c)
    t.ret(52, 31, 6, 2, 'h'); t.ret(48, 33, 14, 1, 's')              # pé do monitor
    designer(t, 20, 20, aponta=True)
    t.brilho(31, 8); t.brilho(76, 36)


def carrefour_sva(t):
    """o vendedor mostra a comparação de três produtos lado a lado para a cliente"""
    for yb in (10, 21):                                              # prateleiras de eletrônicos
        t.ret(0, yb, W, 1, 'h'); t.ret(0, yb + 1, W, 1, 'b')
    for x, tela, brilho in ((2, 'p', 'P'), (40, 'g', 'G'), (52, 'p', 'P'), (66, 'g', 'G')):
        t.caixa(x, 3, 11, 7, tela)
        t.ponto(x + 2, 4, brilho); t.ponto(x + 3, 4, brilho); t.ponto(x + 2, 5, brilho)
    for x, c in ((3, 'Y'), (9, 's'), (44, 'Y'), (50, 'y')):
        t.caixa(x, 15, 5, 6, c)
    for x in (62, 70):                                               # fones de ouvido
        t.mapa(x, 14, ['.ssss.', 's....s', 's....s', 'ss..ss', 'Ws..sW', 'ss..ss'])
    t.ret(56, 17, 4, 4, 'K'); t.ret(57, 18, 2, 2, 's')
    t.ret(0, 33, W, 1, 'h'); t.ret(0, 34, W, 11, 'b')                # balcão
    for x in range(4, W, 12): t.ret(x, 36, 1, 9, 'f')
    for x, c in ((63, 'G'), (71, 'P')):
        t.caixa(x, 27, 5, 6, c); t.ret(x - 1, 32, 7, 1, 's')
    # vendedor de camisa azul com crachá
    t.mapa(48, 14, CABECAS['curto'] + [
        '.KBBBYYBBBK.', 'KBBBBYBBBBBK', 'KBBBBYBBBBBK', 'KBBBWWBBBBBK', 'KBBBWWBBBBBK',
        'KBBBBBBBBBBK', 'KBBBBBBBBBBK', 'KBBBBBBBBBBK', 'KBBBBBBBBBBK', 'KBBBBBBBBBBK'])
    t.ret(37, 25, 12, 1, 'K'); t.ret(37, 28, 12, 1, 'K')            # braço estendido
    t.ret(44, 26, 4, 2, 'n'); t.ret(38, 26, 6, 2, 'S'); t.ret(37, 26, 1, 2, 'K')
    # o celular com a comparação
    t.ret(19, 4, 19, 27, 'K'); t.ret(20, 5, 17, 25, 'b')
    t.ret(21, 7, 15, 21, 'W'); t.ret(26, 5, 5, 1, 'K'); t.ret(21, 7, 15, 2, 'B')
    for i, c in enumerate(('P', 'G', 'Y')):
        x = 21 + i * 5
        t.caixa(x + 1, 10, 3, 5, c)
        for k, larg in enumerate((3, 2, 3, 1, 2)): t.ret(x + 1, 16 + k * 2, larg, 1, 's')
        if i < 2: t.ret(x + 4, 10, 1, 17, 'w')
    t.ret(22, 26, 13, 2, 'G')
    t.mapa(32, 9, ['..G', '.G.', 'G..'])
    # cliente de costas, em primeiro plano
    t.mapa(3, 30, ['....KKKKKK....', '...KHHHHHHK...', '..KHHHHHHHHK..', '..KHHHHHHHHK..', '..KHHHHHHHHK..',
                   '...KHHHHHHK...', '....KddddK....', '..KKPPPPPPKK..', '.KPPPPPPPPPPK.', 'KPPPPPPPPPPPPK',
                   'KPPPpPPPPpPPPK', 'KPPPpPPPPpPPPK', 'KPPPPPPPPPPPPK', 'KPPPPPPPPPPPPK', 'KPPPPPPPPPPPPK'])
    for x, y in ((16, 7), (41, 2), (40, 19)): t.brilho(x, y)


def dpsp_health(t):
    """da farmácia para o celular: agendar vacina e exame online, em plena pandemia"""
    t.chao()
    # fachada da farmácia com a cruz
    t.caixa(2, 2, 15, 13, 'W'); t.ret(8, 4, 3, 9, 'R'); t.ret(5, 7, 9, 3, 'R')
    t.ret(1, 16, 30, 1, 'h'); t.ret(1, 23, 30, 1, 'h'); t.ret(1, 30, 30, 1, 'h')
    for k, c in enumerate('RwGPYwRGPw'):                             # caixas de remédio
        x = 2 + (k % 5) * 6
        t.caixa(x, 18 + (k // 5) * 7, 5, 5, c)
    t.ret(1, 31, 30, 7, 'b'); t.ret(1, 31, 30, 1, 's')               # balcão da farmácia
    # o portal no celular: calendário com o horário escolhido
    t.ret(36, 2, 21, 35, 'K'); t.ret(37, 3, 19, 33, 'b'); t.ret(38, 5, 17, 29, 'W')
    t.ret(44, 3, 5, 1, 'K'); t.ret(38, 5, 17, 3, 'G'); t.ret(39, 6, 7, 1, 'W')
    for j in range(4):
        for i in range(5):
            t.ret(39 + i * 3, 10 + j * 3, 2, 2, 'G' if (i, j) == (3, 1) else 'w')
    for k, (icone, larg) in enumerate((('P', 9), ('R', 7))):          # vacina, exame
        y = 23 + k * 4
        t.ret(39, y, 3, 3, icone); t.ret(43, y, larg, 1, 's'); t.ret(43, y + 2, larg - 3, 1, 'w')
    t.ret(39, 31, 15, 2, 'G'); t.mapa(45, 31, ['..W', 'WW.'])         # confirmar
    # seringa e linha de batimento
    t.mapa(19, 6, ['s.ssssssss....', 'sssPPPPPWWssss', 's.ssssssss....'])
    t.linha(59, 9, 62, 9, 'R'); t.linha(62, 9, 64, 4, 'R'); t.linha(64, 4, 66, 13, 'R')
    t.linha(66, 13, 68, 9, 'R'); t.linha(68, 9, 77, 9, 'R')
    # a cliente conferindo o agendamento
    pessoa(t, 64, 20, cabeca='longo', roupa='P', sombra='p', cabelo='O', virado=True)
    t.caixa(62, 28, 3, 4, 'G')
    t.brilho(33, 14); t.brilho(58, 30)


def synthetic_personas(t):
    """três personas sintéticas avaliam um wireframe, alimentadas por uma base vetorial"""
    t.chao()
    # o wireframe em avaliação
    t.caixa(27, 3, 27, 20, 'W')
    t.ret(28, 4, 25, 2, 's'); t.ret(29, 8, 10, 7, 'w'); t.linha(29, 8, 38, 14, 's'); t.linha(38, 8, 29, 14, 's')
    for k, w in enumerate((11, 8, 10)): t.ret(41, 8 + k * 3, w, 1, 's')
    t.ret(29, 17, 9, 3, 'G'); t.ret(41, 17, 11, 3, 'w')
    # a base vetorial que dá memória às personas
    t.mapa(34, 26, ['..PPPPPPPPP..', '.PPPPPPPPPPP.', 'pPPPPPPPPPPPp', 'ppPPPPPPPPPpp', 'ppppppppppppp',
                    'pPPPPPPPPPPPp', 'ppppppppppppp', 'pPPPPPPPPPPPp', 'ppppppppppppp', '.ppppppppppp.'])
    t.linha(33, 33, 14, 37, 'P', 2); t.linha(47, 33, 62, 37, 'P', 2)
    # as três personas e o que cada uma acha da tela
    pessoa(t, 2, 20, cabeca='coque', roupa='B', sombra='n', cabelo='H')                       # Mariana
    pessoa(t, 14, 20, cabeca='curto', roupa='Y', sombra='y', cabelo='H', pele='T')           # Rafael
    pessoa(t, 56, 20, cabeca='longo', roupa='R', sombra='r', cabelo='O', virado=True)         # Camila
    t.balao(1, 9, 9, 7, 4, lambda x, y: t.mapa(x + 1, y, ['....G', '...G.', 'G.G..', '.G...']))
    t.balao(14, 5, 9, 9, 17, lambda x, y: t.mapa(x + 1, y, INTERROGACAO))
    t.balao(56, 9, 9, 7, 60, lambda x, y: t.mapa(x + 2, y, ['R', 'R', '.', 'R']))
    designer(t, 67, 20, virado=True)
    t.brilho(25, 25); t.brilho(76, 6)


BRASIL = [
  '..........XXXX................', '......XXXXXXXXX..XXX..........', '....XXXXXXXXXXXXXXXXX.........',
  '..XXXXXXXXXXXXXXXXXXXXX.......', '.XXXXXXXXXXXXXXXXXXXXXXXXXX...', 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXX.',
  'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', '.XXXXXXXXXXXXXXXXXXXXXXXXXXXX.', '..XXXXXXXXXXXXXXXXXXXXXXXXXXX.',
  '....XXXXXXXXXXXXXXXXXXXXXXXX..', '.......XXXXXXXXXXXXXXXXXXXXX..', '........XXXXXXXXXXXXXXXXXXX...',
  '........XXXXXXXXXXXXXXXXXXX...', '.........XXXXXXXXXXXXXXXXX....', '.........XXXXXXXXXXXXXXXX.....',
  '..........XXXXXXXXXXXXXX......', '..........XXXXXXXXXXXX........', '...........XXXXXXXXXX.........',
  '...........XXXXXXXX...........', '............XXXXXX............', '............XXXXX.............',
  '.............XXX..............',
]

def ademicon_orbita(t):
    """a rede inteira num mapa vivo: unidades conectadas, indicadores e alertas antes do incidente"""
    t.chao()
    t.caixa(3, 2, 53, 33, 'D', 'K'); t.ret(4, 3, 51, 2, 'h')
    # mapa do Brasil por regiões (norte, nordeste, centro-oeste, sudeste, sul)
    ox, oy = 6, 8
    for j, linha in enumerate(BRASIL):
        for i, c in enumerate(linha):
            if c != 'X': continue
            if j >= 17: cor = 'P'                                     # sul
            elif i >= 20 and j <= 10: cor = 'B'                       # nordeste
            elif i >= 17 and j >= 11: cor = 'R'                       # sudeste
            elif j >= 8: cor = 'Y'                                    # centro-oeste
            else: cor = 'G'                                           # norte
            t.ponto(ox + i, oy + j, cor)
    # unidades da rede como pontos (linhas e pinos com contorno pareciam dentes e olhos sobre o mapa)
    for x, y in ((14, 11), (31, 12), (21, 18), (28, 21), (22, 26), (35, 15), (10, 14)):
        t.ret(x, y, 2, 2, 'W')
    # indicadores e alerta
    for k, (alt, c) in enumerate(((10, 'G'), (14, 'G'), (7, 'Y'), (12, 'G'))):
        t.ret(38 + k * 4, 29 - alt, 3, alt, c)
    t.ret(37, 30, 16, 1, 's')
    t.mapa(45, 6, ['..KK..', '.KYYK.', '.KYYK.', 'KYYYYK', 'KKKKKK', '..KK..'])   # sino
    t.ret(50, 5, 3, 3, 'R')
    # o logotipo da Orbita: planeta com anel
    t.mapa(62, 3, ['.....KKKK.....', '....KPPPPK....', 'YYYKPPPPPPKYYY', '..YYYYYYYYYY..',
                   '....KPPPPK....', '.....KKKK.....'])
    designer(t, 62, 20, virado=True, aponta=True)
    t.brilho(58, 12); t.brilho(76, 14)


CENAS = {
  'oab-parana': oab_parana, 'insper': insper, 'carrefour-sva': carrefour_sva,
  'dpsp-health': dpsp_health, 'synthetic-personas': synthetic_personas, 'ademicon-orbita': ademicon_orbita,
}


# ---------- Arquivo: versão noturna das ilustrações antigas (originais em ferramentas/originais/archive) ----------
NOTURNO_ORIGEM = ['#000000', '#3a3a1a', '#ffffff', '#b8b8b0', '#e6e600', '#9a9a00']
NOTURNO_DESTINO = ['#0b0f1a', '#18233a', '#3a5a82', '#2a3d5c', '#fbbf24', '#c2861a']

def noturno(origem, destino, largura=160):
    im = Image.open(origem).convert('RGB')
    altura = round(largura * im.height / im.width)
    pequeno = im.resize((largura, altura), Image.BOX)
    def paleta(cores):
        v = [int(h[i:i + 2], 16) for h in cores for i in (1, 3, 5)]
        return v + v[:3] * (256 - len(cores))
    pal = Image.new('P', (1, 1)); pal.putpalette(paleta(NOTURNO_ORIGEM))
    q = pequeno.quantize(palette=pal, dither=Image.Dither.NONE)
    q.putpalette(paleta(NOTURNO_DESTINO))
    esc = 640 // largura
    q.convert('RGB').resize((largura * esc, altura * esc), Image.NEAREST).save(destino, quality=90)


if __name__ == '__main__':
    args = sys.argv[1:]
    if args == ['--arquivo']:
        pasta = os.path.join(RAIZ, 'ferramentas', 'originais', 'archive')
        for nome in sorted(os.listdir(pasta)):
            noturno(os.path.join(pasta, nome), os.path.join(RAIZ, 'assets', 'archive', nome))
            print('arquivo', nome)
        sys.exit()
    for slug in (args or CENAS):
        tela = Tela()
        CENAS[slug](tela)
        tela.salvar(os.path.join(RAIZ, 'assets', 'work', slug, 'cover.webp'))
        print('capa', slug)
