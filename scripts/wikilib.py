"""Shared helpers for the Bulbapedia / PokeAPI data generators (CC BY-NC-SA 2.5 source, see build-*.py)."""
import json, pathlib, re, time, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
NUZ = ROOT / 'src/app/components/nuzlocke'
CACHE = pathlib.Path(__file__).resolve().parent / '.wiki-cache'
CACHE.mkdir(exist_ok=True)
UA = {'User-Agent': 'PokeWorldDataBuild/1.0 (personal hobby project; one-off build script)'}
GQL = 'https://graphql.pokeapi.co/v1beta2'

# Bulbapedia `game =` codes -> our game keys
CODES = {
    'rgb': ['red-blue'], 'rgby': ['red-blue', 'yellow'], 'y': ['yellow'],
    'gs': ['gold-silver'], 'gsc': ['gold-silver', 'crystal'], 'c': ['crystal'],
    'rs': ['ruby-sapphire'], 'rse': ['ruby-sapphire', 'emerald'], 'e': ['emerald'],
    'frlg': ['firered-leafgreen'], 'dp': ['diamond-pearl'], 'dppt': ['diamond-pearl', 'platinum'], 'pt': ['platinum'],
    'hgss': ['heartgold-soulsilver'], 'bw': ['black-white'], 'b2w2': ['black2-white2'],
    'xy': ['x-y'], 'oras': ['oras'], 'sm': ['sun-moon'], 'usum': ['usum'], 'sm/usum': ['sun-moon', 'usum'],
    'swsh': ['sword-shield'], 'sw': ['sword-shield'], 'sh': ['sword-shield'], 'bl': ['black-white'], 'w': ['black-white'], 'sv': ['scarlet-violet'],
}
E4 = {
    'red-blue': ['Lorelei', 'Bruno', 'Agatha', 'Lance', 'Blue'], 'yellow': ['Lorelei', 'Bruno', 'Agatha', 'Lance', 'Blue'],
    'firered-leafgreen': ['Lorelei', 'Bruno', 'Agatha', 'Lance', 'Blue'],
    'gold-silver': ['Will', 'Koga', 'Bruno', 'Karen', 'Lance'], 'crystal': ['Will', 'Koga', 'Bruno', 'Karen', 'Lance'],
    'heartgold-soulsilver': ['Will', 'Koga', 'Bruno', 'Karen', 'Lance'],
    'ruby-sapphire': ['Sidney', 'Phoebe', 'Glacia', 'Drake', 'Steven Stone'], 'emerald': ['Sidney', 'Phoebe', 'Glacia', 'Drake', 'Wallace'],
    'oras': ['Sidney', 'Phoebe', 'Glacia', 'Drake', 'Steven Stone'],
    'diamond-pearl': ['Aaron', 'Bertha', 'Flint', 'Lucian', 'Cynthia'], 'platinum': ['Aaron', 'Bertha', 'Flint', 'Lucian', 'Cynthia'],
    'black-white': ['Shauntal', 'Grimsley', 'Caitlin', 'Marshal', 'N', 'Ghetsis'],
    'black2-white2': ['Shauntal', 'Marshal', 'Grimsley', 'Caitlin', 'Iris'],
    'x-y': ['Malva', 'Siebold', 'Wikstrom', 'Drasna', 'Diantha'],
    'sun-moon': ['Hala', 'Olivia', 'Acerola', 'Kahili', 'Professor Kukui'],
    'usum': ['Molayne', 'Olivia', 'Acerola', 'Kahili', 'Professor Kukui'],
    'sword-shield': ['Leon'], 'scarlet-violet': ['Geeta'],
}
TITLE_FIX = {'Blue': 'Blue (game)', 'Tate & Liza': 'Tate and Liza'}
LABEL = {'Professor Kukui': 'Kukui', 'Steven Stone': 'Steven'}
VARIANT_FIGHTS = ('Blue', 'Professor Kukui', 'Hau')   # champion fights whose team depends on your starter


def gql(query, variables=None):
    req = urllib.request.Request(GQL, json.dumps({'query': query, 'variables': variables}).encode(), {**UA, 'content-type': 'application/json'})
    return json.load(urllib.request.urlopen(req, timeout=120))['data']


def fetch(title, prefix='', tag=''):
    f = CACHE / (tag + re.sub(r'[^A-Za-z0-9]+', '_', prefix + title) + '.txt')
    if f.exists():
        return f.read_text(encoding='utf-8')
    url = 'https://bulbapedia.bulbagarden.net/w/index.php?title=' + urllib.parse.quote((prefix + title).replace(' ', '_'), safe=':_()') + '&action=raw'
    try:
        text = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read().decode('utf-8', 'replace')
    except Exception:
        text = ''
    f.write_text(text, encoding='utf-8')
    time.sleep(0.6)
    return text


def read_ts_json(path, marker):
    s = pathlib.Path(path).read_text(encoding='utf-8')
    i = s.index(marker) + len(marker)
    return json.loads(s[i:s.rindex(';')])


# ── trainer parties ──────────────────────────────────────────────────────────
PARTY = re.compile(r'\{\{\s*Party\s*\n(.*?)\n\}\}(.*?)\{\{\s*Party/end\s*\}\}', re.S | re.I)
MON = re.compile(r'\{\{\s*Pok[eé]mon\s*(.*?)\n\}\}', re.S | re.I)
PARAM = re.compile(r'\|\s*([a-z0-9_]+)\s*=\s*([^|\n]*)', re.I)
FORMS = {'alolan': 'alola', 'galarian': 'galar', 'hisuian': 'hisui', 'paldean': 'paldea'}
TYPES = {'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'}


def params(text):
    text = re.sub(r'\{\{\s*tt\s*\|([^|}]*)\|[^}]*\}\}', r'\1', text)   # {{tt|49|before X}} -> 49
    return {k.lower(): re.sub(r'\{\{.*?\}\}|<[^>]+>|\[\[|\]\]', '', v).strip() for k, v in PARAM.findall(text)}


def blocks(text):
    out = []
    for m in PARTY.finditer(text):
        head = params(m.group(1))
        head['_type'] = (re.search(r'\{\{\s*(\w+) color', m.group(1)) or [None, ''])[1].lower()
        mons = []
        for mm in MON.finditer(m.group(2)):
            p = params(mm.group(1))
            if re.match(r'\d+', p.get('level', '')) and p.get('ndex'):
                mons.append(p)
        if mons:
            out.append((head, mons))
    return out


def code_ok(code, gk):
    return gk in CODES.get(code.strip().lower().replace(' ', ''), [])


def slug_for(p, species_slug, default, all_pokemon):
    sid = int(re.match(r'\d+', p['ndex']).group(0))
    base = species_slug.get(sid)
    if not base:
        return None
    form = p.get('form', '').lower()
    for k, suffix in FORMS.items():
        if k in form and f'{base}-{suffix}' in all_pokemon:
            return f'{base}-{suffix}'
    return default.get(sid, base)


def team_of(mons, species_slug, default, all_pokemon):
    team = []
    for p in mons:
        slug = slug_for(p, species_slug, default, all_pokemon)
        if slug:
            team.append([slug, int(re.match(r'\d+', p['level']).group(0)), [p[f'move{i}'] for i in range(1, 5) if p.get(f'move{i}')]])
    return team


def species_tables():
    sp = gql('{ pokemonspecies(order_by:{id:asc}) { id name } pokemon { name pokemon_species_id is_default } }')
    return ({s['id']: s['name'] for s in sp['pokemonspecies']},
            {p['pokemon_species_id']: p['name'] for p in sp['pokemon'] if p['is_default']},
            {p['name'] for p in sp['pokemon']})
