"""Logos de empresas e ícones de contato em pixel art.

Logos: reinterpretações em pixel dos nomes/símbolos (não são os arquivos oficiais), monocromáticas
para a faixa "worked with". Ícones: 16x16, uma cor do site cada. Tudo ampliado 4x sem suavização.

    python3 ferramentas/icones.py      # gera assets/logos/*.png e assets/icons/*.png
"""
import os
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ESC = 4

# ---------- fonte pixel de 7 linhas (maiúsculas 5 de largura, minúsculas com altura-x de 5) ----------
FONTE = {
  'A': ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  'B': ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X...X', 'X...X', 'XXXX.'],
  'C': ['.XXX.', 'X...X', 'X....', 'X....', 'X....', 'X...X', '.XXX.'],
  'D': ['XXXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'XXXX.'],
  'E': ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'XXXXX'],
  'F': ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'X....'],
  'G': ['.XXX.', 'X...X', 'X....', 'X.XXX', 'X...X', 'X...X', '.XXX.'],
  'U': ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  'I': ['XXX', '.X.', '.X.', '.X.', '.X.', '.X.', 'XXX'],
  'M': ['X...X', 'XX.XX', 'X.X.X', 'X.X.X', 'X...X', 'X...X', 'X...X'],
  'N': ['X...X', 'XX..X', 'X.X.X', 'X..XX', 'X...X', 'X...X', 'X...X'],
  'O': ['.XXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  'P': ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X....', 'X....', 'X....'],
  'R': ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X.X..', 'X..X.', 'X...X'],
  'S': ['.XXXX', 'X....', 'X....', '.XXX.', '....X', '....X', 'XXXX.'],
  'a': ['....', '....', '.XX.', '...X', '.XXX', 'X..X', '.XXX'],
  'b': ['X...', 'X...', 'XXX.', 'X..X', 'X..X', 'X..X', 'XXX.'],
  'c': ['....', '....', '.XX.', 'X...', 'X...', 'X...', '.XX.'],
  'd': ['...X', '...X', '.XXX', 'X..X', 'X..X', 'X..X', '.XXX'],
  'e': ['....', '....', '.XX.', 'X..X', 'XXXX', 'X...', '.XX.'],
  'f': ['..X', '.X.', 'XXX', '.X.', '.X.', '.X.', '.X.'],
  'i': ['X', '.', 'X', 'X', 'X', 'X', 'X'],
  'l': ['X', 'X', 'X', 'X', 'X', 'X', 'X'],
  'm': ['.....', '.....', 'XX.X.', 'X.X.X', 'X.X.X', 'X.X.X', 'X.X.X'],
  'n': ['....', '....', 'XXX.', 'X..X', 'X..X', 'X..X', 'X..X'],
  'o': ['....', '....', '.XX.', 'X..X', 'X..X', 'X..X', '.XX.'],
  'r': ['...', '...', 'X.X', 'XX.', 'X..', 'X..', 'X..'],
  's': ['....', '....', '.XXX', 'X...', '.XX.', '...X', 'XXX.'],
  't': ['.X.', '.X.', 'XXX', '.X.', '.X.', '.X.', '..X'],
  'u': ['....', '....', 'X..X', 'X..X', 'X..X', 'X..X', '.XXX'],
  'v': ['.....', '.....', 'X...X', 'X...X', 'X...X', '.X.X.', '..X..'],
  ' ': ['..', '..', '..', '..', '..', '..', '..'],
}

def texto(t, negrito=True):
    """devolve as 7 linhas do texto; negrito engrossa cada traço em 1 pixel para a direita"""
    linhas = [''] * 7
    for ch in t:
        g = FONTE[ch]
        for j in range(7): linhas[j] += g[j] + ('..' if negrito else '.')
    linhas = [l[:-2 if negrito else -1] for l in linhas]
    if negrito:
        linhas = [''.join('X' if c == 'X' or (i and l[i - 1] == 'X') else '.' for i, c in enumerate(l + '.')) for l in linhas]
    return linhas

def juntar(*blocos, espaco=3):
    """cola blocos lado a lado, alinhados pela base"""
    alt = max(len(b) for b in blocos)
    out = [''] * alt
    for k, b in enumerate(blocos):
        w = max(len(l) for l in b)
        b = ['.' * w] * (alt - len(b)) + [l.ljust(w, '.') for l in b]
        for j in range(alt): out[j] += b[j] + ('.' * espaco if k < len(blocos) - 1 else '')
    return out

def empilhar(*blocos, espaco=2):
    """um bloco em cima do outro, centralizados"""
    w = max(len(l) for b in blocos for l in b)
    out = []
    for k, b in enumerate(blocos):
        for l in b:
            pad = (w - len(l)) // 2
            out.append(('.' * pad + l).ljust(w, '.'))
        if k < len(blocos) - 1: out += ['.' * w] * espaco
    return out

def salvar(linhas, destino, cores):
    """cores: caractere -> '#rrggbb'; '.' fica transparente"""
    w, h = max(len(l) for l in linhas), len(linhas)
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for j, l in enumerate(linhas):
        for i, c in enumerate(l):
            if c in cores: im.putpixel((i, j), tuple(int(cores[c][k:k + 2], 16) for k in (1, 3, 5)) + (255,))
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    im.resize((w * ESC, h * ESC), Image.NEAREST).save(destino, optimize=True)
    return w, h


# ---------- logos ----------
SIMBOLO_CARREFOUR = [   # duas setas que formam o "C" em negativo
  '...X.....X...', '..XX.....XX..', '.XXX.....XXX.', 'XXXX......XXX', '.XXX.....XXX.', '..XX.....XX..', '...X.....X...']
OAB = juntar(
  ['..XXX..', '.XXXXX.', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..'],      # O: círculo
  ['...X...', '..XXX..', '..XXX..', '.XXXXX.', '.XXXXX.', 'XXXXXXX', 'XXXXXXX'],      # A: triângulo
  ['XXXXX..', 'XXXXXX.', 'XXXXXX.', 'XXXXX..', 'XXXXXX.', 'XXXXXX.', 'XXXXX..'],      # B
  espaco=1)

LOGOS = {
  'carrefour': juntar(SIMBOLO_CARREFOUR, texto('Carrefour')),
  'vivo': texto('vivo'),
  'grupo-dpsp': juntar(texto('GRUPO', negrito=False), texto('DPSP')),
  'insper': juntar(texto('INSPER'), ['..', '..', '..', '..', '..', 'XX', 'XX'], espaco=1),
  'oab-parana': juntar(OAB, texto('PR', negrito=False)),
  'ademicon': texto('ademicon', negrito=False),   # no negrito o m vira um bloco
  'fiema': texto('FIEMA', negrito=False),
  'platform-builders': empilhar(texto('Platform', negrito=False), texto('Builders', negrito=False), espaco=1),
}


# ---------- ícones 16x16 ----------
ICONES = {
  'github': ('W', [
    '.....XXXXXX.....', '...XXXXXXXXXX...', '..XXXXXXXXXXXX..', '.XX..XXXXXX..XX.',
    '.XX...XXXX...XX.', 'XXX..........XXX', 'XXX..........XXX', 'XXX..........XXX',
    'XXX..........XXX', 'XXXX........XXXX', '.XXXX......XXXX.', '.X..XXX..XXXXXX.',
    '..X..XX..XXXXX..', '...XXXX..XXXX...', '.....XX..XX.....', '................']),
  'whatsapp': ('G', [
    '.....XXXXXX.....', '...XX......XX...', '..X..........X..', '.X...XX.......X.',
    '.X...XXX......X.', 'X....XX........X', 'X.....X........X', 'X.....XX.......X',
    'X......XX..XX..X', 'X.......XXXXX..X', '.X.......XXX..X.', '.X...........X..',
    'XX.........XX...', 'XXX.....XXX.....', 'X..XXXXX........', '................']),
  'linkedin': ('B', [
    '.XXXXXXXXXXXXXX.', 'XXXXXXXXXXXXXXXX', 'XXXXXXXXXXXXXXXX', 'XXX..XXXXXXXXXXX',
    'XXX..XXXXXXXXXXX', 'XXXXXXXXXXXXXXXX', 'XXX..XX..X..XXXX', 'XXX..XX......XXX',
    'XXX..XX...XX..XX', 'XXX..XX..XXX..XX', 'XXX..XX..XXX..XX', 'XXX..XX..XXX..XX',
    'XXX..XX..XXX..XX', 'XXXXXXXXXXXXXXXX', '.XXXXXXXXXXXXXX.', '................']),
  'email': ('Y', [
    '................', '................', 'XXXXXXXXXXXXXXXX', 'XX............XX',
    'X.X..........X.X', 'X..X........X..X', 'X...X......X...X', 'X....X....X....X',
    'X.....XXXX.....X', 'X..............X', 'X..............X', 'X..............X',
    'XXXXXXXXXXXXXXXX', '................', '................', '................']),
  'blog': ('P', [
    '...........XX...', '..........X..X..', '.........X..XX..', '........X..X.X..',
    '.......X..X.X...', '......X..X.X....', '.....X..X.X.....', '....X..X.X......',
    '...X..X.X.......', '..X..X.X........', '..XXX.X.........', '..XXXX..........',
    '..XXX...........', '................', 'XXXXXXXXXXXXXXXX', '................']),
}

COR_ICONE = {'W': '#f8fafc', 'G': '#22c55e', 'B': '#3b82f6', 'Y': '#fbbf24', 'P': '#a78bfa'}

if __name__ == '__main__':
    for nome, linhas in LOGOS.items():
        print('logo', nome, salvar(linhas, os.path.join(RAIZ, 'assets', 'logos', nome + '.png'), {'X': '#e2e8f0'}))
    for nome, (cor, linhas) in ICONES.items():
        print('icone', nome, salvar(linhas, os.path.join(RAIZ, 'assets', 'icons', nome + '.png'), {'X': COR_ICONE[cor]}))
