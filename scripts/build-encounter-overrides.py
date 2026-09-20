#!/usr/bin/env python3
"""
Builds src/app/components/nuzlocke/encounter-overrides.ts.

PokeAPI has no wild-encounter rows for some games / areas (all of Scarlet & Violet, several Sword & Shield and
Omega Ruby / Alpha Sapphire routes). This script finds those gaps, reads the encounter tables from Bulbapedia's raw
wikitext (CC BY-NC-SA 2.5, https://bulbapedia.bulbagarden.net) and writes them as static data, so the app itself
never scrapes anything at runtime. Re-run it after editing nuzlocke-data.ts:  python scripts/build-encounter-overrides.py
"""
import json, re, sys, time, urllib.parse, urllib.request, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA_TS = ROOT / 'src/app/components/nuzlocke/nuzlocke-data.ts'
OUT_TS = ROOT / 'src/app/components/nuzlocke/encounter-overrides.ts'
CACHE = pathlib.Path(__file__).resolve().parent / '.wiki-cache'
CACHE.mkdir(exist_ok=True)
UA = {'User-Agent': 'PokeWorldDataBuild/1.0 (personal hobby project; one-off build script)'}
GQL = 'https://graphql.pokeapi.co/v1beta2'

VERSIONS = {
    'red-blue': ['red', 'blue'], 'yellow': ['yellow'], 'gold-silver': ['gold', 'silver'], 'crystal': ['crystal'],
    'ruby-sapphire': ['ruby', 'sapphire'], 'emerald': ['emerald'], 'firered-leafgreen': ['firered', 'leafgreen'],
    'diamond-pearl': ['diamond', 'pearl'], 'platinum': ['platinum'], 'heartgold-soulsilver': ['heartgold', 'soulsilver'],
    'black-white': ['black', 'white'], 'black2-white2': ['black-2', 'white-2'], 'x-y': ['x', 'y'],
    'oras': ['omega-ruby', 'alpha-sapphire'], 'sun-moon': ['sun', 'moon'], 'usum': ['ultra-sun', 'ultra-moon'],
    'sword-shield': ['sword', 'shield'], 'scarlet-violet': ['scarlet', 'violet'],
}
# Only generations whose wiki tables this script can read. Others keep PokeAPI data as is.
SUPPORTED = {'scarlet-violet', 'sword-shield', 'oras'}
NUM = {1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six'}


def gql(query, variables=None):
    req = urllib.request.Request(GQL, json.dumps({'query': query, 'variables': variables}).encode(),
                                 {**UA, 'content-type': 'application/json'})
    return json.load(urllib.request.urlopen(req, timeout=120))['data']


def key(name):
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]', '-', name.lower())).strip('-')


REGION = {
    'red-blue': 'kanto', 'yellow': 'kanto', 'firered-leafgreen': 'kanto', 'gold-silver': 'johto', 'crystal': 'johto',
    'heartgold-soulsilver': 'johto', 'ruby-sapphire': 'hoenn', 'emerald': 'hoenn', 'oras': 'hoenn', 'diamond-pearl': 'sinnoh',
    'platinum': 'sinnoh', 'black-white': 'unova', 'black2-white2': 'unova', 'x-y': 'kalos', 'sun-moon': 'alola', 'usum': 'alola',
    'sword-shield': 'galar', 'scarlet-violet': 'paldea',
}


def read_games():
    """Area lists come from the generated progression (run build-progression.py first)."""
    prog = json.loads((DATA_TS.parent / 'progression.ts').read_text(encoding='utf-8').split('Milestone[] }> = ', 1)[1].rsplit(';', 1)[0])
    return {gk: {'region': REGION[gk], 'routes': p['routes']} for gk, p in prog.items()}


def load_pokeapi():
    locs = gql('{ location { id name } }')['location']
    by_slug = {l['name']: l['id'] for l in locs}
    species = gql('{ pokemonspecies(order_by:{id:asc}) { id name } pokemon { name pokemon_species_id is_default } }')
    slug_of_species = {s['id']: s['name'] for s in species['pokemonspecies']}
    default = {p['pokemon_species_id']: p['name'] for p in species['pokemon'] if p['is_default']}
    all_pokemon = {p['name'] for p in species['pokemon']}
    return by_slug, slug_of_species, default, all_pokemon


def resolve_location(by_slug, region, area):
    slug = key(area)
    if '-area-' in slug:
        for word, n in ((v.lower(), k) for k, v in NUM.items()):
            slug = re.sub(rf'-{n}$', f'-{word}', slug)
    keys = list(by_slug)
    for c in [f'{region}-{slug}' if region else '', slug, f'{region}-sea-{slug}' if region else '']:
        if c and c in by_slug:
            return by_slug[c]
    hit = next((k for k in keys if k.endswith('-' + slug) and (not region or k.startswith(region))), None) \
        or next((k for k in keys if k.endswith('-' + slug)), None)
    return by_slug.get(hit) if hit else None


def wiki_titles(game, area):
    if game == 'scarlet-violet':
        m = re.match(r'(South|West|North|East) Province Area (\d)', area)
        if m:
            return [f'{m[1]} Province (Area {NUM[int(m[2])]})']
        if area == 'Great Crater of Paldea':
            return ['Area Zero', area]
        return [area, f'{area} (Paldea)']
    m = re.match(r'Route (\d+)$', area)
    if game == 'sword-shield':
        return [f'Galar Route {m[1]}'] if m else ([] if area.startswith('Wild Area') else [area])
    if game == 'oras':
        return [f'Hoenn Route {m[1]}'] if m else [area]
    return [area]


def fetch_wikitext(title):
    f = CACHE / (re.sub(r'[^A-Za-z0-9]+', '_', title) + '.txt')
    if f.exists():
        return f.read_text(encoding='utf-8')
    url = 'https://bulbapedia.bulbagarden.net/w/index.php?title=' + urllib.parse.quote(title.replace(' ', '_'), safe='()_') + '&action=raw'
    try:
        text = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read().decode('utf-8', 'replace')
    except Exception:
        text = ''
    f.write_text(text, encoding='utf-8')
    time.sleep(0.6)  # be polite
    return text


ENTRY = re.compile(r'\{\{\s*catch/(entry9|entry9/special|entry8|entryoras)\|(.*?)\}\}\s*$', re.I | re.M)


def section(text, game):
    if game == 'oras':
        m = re.search(r'====\s*Generation VI\s*====(.*?)(?=\n===[^=]|\n==[^=]|\Z)', text, re.S)
        return m.group(1) if m else ''
    return text


def parse(game, text, slug_of_species, default, all_pokemon):
    """Returns {slug: [min, max, set(methods), version_tag]}."""
    out = {}
    for m in ENTRY.finditer(section(text, game)):
        kind, body = m.group(1).lower(), m.group(2)
        while '{{' in body:
            body = re.sub(r'\{\{[^{}]*\}\}', '', body)
        parts = [p.strip() for p in body.split('|')]
        if len(parts) < 4:
            continue
        dm = re.match(r'(\d+)(?:-([A-Za-z0-9\-]+))?', parts[0])
        if not dm:
            continue
        sid, form = int(dm[1]), dm[2]
        base = slug_of_species.get(sid)
        if not base:
            continue
        cand = f'{base}-{form.lower()}' if form else None
        slug = cand if cand in all_pokemon else default.get(sid, base)
        flags = [p for p in parts[2:] if p.lower() in ('yes', 'no')][:2]
        if 'yes' not in [f.lower() for f in flags]:
            continue
        ver = None
        if len(flags) == 2 and flags[0].lower() != flags[1].lower():
            first = flags[0].lower() == 'yes'
            ver = {'scarlet-violet': ('scarlet', 'violet'), 'sword-shield': ('sword', 'shield'), 'oras': ('omega ruby', 'alpha sapphire')}[game][0 if first else 1]
        levels, methods = [], set()
        for p in parts[2:]:
            pl = p.lower()
            if pl in ('yes', 'no') or '=' in p and not re.match(r'^(land|overland|sky|watersurface|underwater|surf)\s*=', pl):
                continue
            if re.fullmatch(r'\d+(?:\s*[-,]\s*\d+)*', p):
                if not levels:  # the first number is the level range; later ones are spawn rates
                    levels = [int(n) for n in re.findall(r'\d+', p)]
            elif re.match(r'^(land|overland|sky|watersurface|underwater)\s*=\s*yes', pl):
                methods.add({'land': 'walk', 'overland': 'walk', 'sky': 'flying', 'watersurface': 'surf', 'underwater': 'underwater'}[pl.split('=')[0].strip()])
            elif kind == 'entry9/special' and levels == [] and not re.search(r'%|respawn', pl) and len(p) > 2:
                methods.add('static')
            elif kind in ('entry8', 'entryoras') and not levels and not re.search(r'%', p):
                methods.add(re.sub(r'\s+', ' ', pl))
        if not levels:
            continue
        if kind == 'entry9/special':
            methods = {'static'}
        cur = out.setdefault(slug, [999, 0, set(), ver])
        cur[0], cur[1] = min(cur[0], min(levels)), max(cur[1], max(levels))
        cur[2] |= methods or {'walk'}
        if cur[3] != ver:
            cur[3] = None
    return out


def main():
    games = read_games()
    by_slug, slug_of_species, default, all_pokemon = load_pokeapi()
    result = {}
    for gk, g in games.items():
        if gk not in SUPPORTED:
            continue
        have = {e['locationarea']['location_id'] for e in gql(
            'query($v:[String!]) { encounter(where:{version:{name:{_in:$v}}}) { locationarea { location_id } } }',
            {'v': VERSIONS[gk]})['encounter']}
        for area in g['routes']:
            loc = resolve_location(by_slug, g['region'], area)
            if loc and loc in have:
                continue
            mons = {}
            for title in wiki_titles(gk, area):
                text = fetch_wikitext(title)
                if text:
                    mons = parse(gk, text, slug_of_species, default, all_pokemon)
                if mons:
                    break
            print(f'{gk:16} {area:28} {"-> " + str(len(mons)) + " Pokémon" if mons else "(nothing found)"}')
            if mons:
                result.setdefault(gk, {})[area] = sorted(
                    ([s, v[0], v[1], ' · '.join(sorted(v[2])), v[3] or ''] for s, v in mons.items()),
                    key=lambda r: r[0])

    lines = [
        '// GENERATED by scripts/build-encounter-overrides.py: do not edit by hand.',
        '// Wild-encounter tables PokeAPI is missing, read from Bulbapedia (CC BY-NC-SA 2.5, https://bulbapedia.bulbagarden.net).',
        '// Row: [pokemon slug, min level, max level, methods, version-exclusive ("" when in both versions)]',
        'export type OverrideRow = [slug: string, min: number, max: number, methods: string, version: string];',
        'export const ENCOUNTER_OVERRIDES: Record<string, Record<string, OverrideRow[]>> = ' + json.dumps(result, ensure_ascii=False, indent=1) + ';',
        '',
    ]
    OUT_TS.write_text('\n'.join(lines), encoding='utf-8')
    print(f'wrote {OUT_TS.relative_to(ROOT)} ({sum(len(v) for v in result.values())} areas)')


if __name__ == '__main__':
    sys.exit(main())
