#!/usr/bin/env python3
"""
Builds src/app/components/nuzlocke/boss-teams.ts: the full rosters (species, level, moves) of every gym leader,
trial captain, Elite Four member and champion in nuzlocke-data.ts.

PokeAPI has no trainer data, so the parties are read from Bulbapedia's raw wikitext
(CC BY-NC-SA 2.5, https://bulbapedia.bulbagarden.net) and written as static data. The app never scrapes at runtime.
Run:  python scripts/build-boss-teams.py      (pages are cached in scripts/.wiki-cache)
"""
import json, re, sys, time, urllib.parse, urllib.request, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA_TS = ROOT / 'src/app/components/nuzlocke/nuzlocke-data.ts'
OUT_TS = ROOT / 'src/app/components/nuzlocke/boss-teams.ts'
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
EXCLUDE = re.compile(r'rematch|tournament|world|frontier|tower|arena|battle (?:tent|factory|dome|palace|pike|pyramid|subway|maison|royal|tree|castle|arcade)|gauntlet|link|multi|double|vs\.? seeker|trainer tower|colosseum|masters|pass|catalog', re.I)
PREFER = re.compile(r'league|elite|champion|hall of fame|indigo|plateau|wyndon', re.I)  # E4 / champion fights: skip earlier story battles
FORMS = {'alolan': 'alola', 'galarian': 'galar', 'hisuian': 'hisui', 'paldean': 'paldea'}


def gql(query, variables=None):
    req = urllib.request.Request(GQL, json.dumps({'query': query, 'variables': variables}).encode(), {**UA, 'content-type': 'application/json'})
    return json.load(urllib.request.urlopen(req, timeout=120))['data']


def fetch(title):
    f = CACHE / (re.sub(r'[^A-Za-z0-9]+', '_', title) + '.txt')
    if f.exists():
        return f.read_text(encoding='utf-8')
    url = 'https://bulbapedia.bulbagarden.net/w/index.php?title=' + urllib.parse.quote(title.replace(' ', '_'), safe='()_') + '&action=raw'
    try:
        text = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read().decode('utf-8', 'replace')
    except Exception:
        text = ''
    f.write_text(text, encoding='utf-8')
    time.sleep(0.6)
    return text


def read_games():
    """Milestones come from the generated progression (run build-progression.py first)."""
    prog = json.loads((DATA_TS.parent / 'progression.ts').read_text(encoding='utf-8').split('Milestone[] }> = ', 1)[1].rsplit(';', 1)[0])
    return {gk: [{'name': m['name'], 'role': m['role'], 'level': m['aceLevel'], 'ace': m['acePokemon']} for m in p['milestones']] for gk, p in prog.items()}


# ── which trainer pages make up each milestone ───────────────────────────────
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
TITLE_FIX = {'Blue': 'Blue (game)', 'Lt. Surge': 'Lt. Surge', 'Tate & Liza': 'Tate and Liza', 'Tate and Liza': 'Tate and Liza', 'Juan': 'Juan', 'Steven Stone': 'Steven Stone'}
LABEL = {'Professor Kukui': 'Kukui', 'Steven Stone': 'Steven'}
SV_GYM = re.compile(r'^(\w+) \((\w+)\)$')


def specs(gk, ms):
    name, role = ms['name'], ms['role']
    if role == 'elite4':
        return [{'who': LABEL.get(t, t), 'title': TITLE_FIX.get(t, t), 'variants': t in ('Blue', 'Nemona', 'Hop', 'Marnie', 'Professor Kukui', 'Hau')} for t in E4.get(gk, [])]
    if role == 'boss':
        return []  # trial captains: totem Pokémon only, handled with the ace fallback
    m = SV_GYM.match(name)
    parts = [m.group(1)] if m else [p.strip() for p in name.split('/')]
    if '&' in name:
        parts = ['Tate and Liza']
    return [{'who': p, 'title': TITLE_FIX.get(p, p), 'variants': False, 'either': len(parts) > 1} for p in parts]


# ── parsing ──────────────────────────────────────────────────────────────────
PARTY = re.compile(r'\{\{\s*Party\s*\n(.*?)\n\}\}(.*?)\{\{\s*Party/end\s*\}\}', re.S | re.I)
MON = re.compile(r'\{\{\s*Pok[eé]mon\s*(.*?)\n\}\}', re.S | re.I)
PARAM = re.compile(r'\|\s*([a-z0-9_]+)\s*=\s*([^|\n]*)', re.I)


def params(text):
    # {{tt|49|before X}} -> 49 (done up front: the pipes inside would otherwise cut the parameter value short)
    text = re.sub(r'\{\{\s*tt\s*\|([^|}]*)\|[^}]*\}\}', r'\1', text)
    return {k.lower(): re.sub(r'\{\{.*?\}\}|<[^>]+>|\[\[|\]\]', '', v).strip() for k, v in PARAM.findall(text)}



def blocks(text):
    out = []
    for m in PARTY.finditer(text):
        head = params(m.group(1))
        mons = []
        for mm in MON.finditer(m.group(2)):
            p = params(mm.group(1))
            if re.match(r'\d+', p.get('level', '')) and p.get('ndex'):
                mons.append(p)
        if mons:
            out.append((head, mons))
    return out


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


def code_ok(code, gk):
    return gk in CODES.get(code.strip().lower().replace(' ', ''), [])


def team_of(mons, species_slug, default, all_pokemon):
    team = []
    for p in mons:
        slug = slug_for(p, species_slug, default, all_pokemon)
        if not slug:
            continue
        moves = [p[f'move{i}'] for i in range(1, 5) if p.get(f'move{i}')]
        team.append([slug, int(re.match(r'\d+', p['level']).group(0)), moves])
    return team


def parties_for(title, gk, species_slug, default, all_pokemon, variants, prefer=False):
    text = fetch(title)
    cands = []
    for head, mons in blocks(text):
        if not code_ok(head.get('game', ''), gk):
            continue
        if EXCLUDE.search(head.get('location', '')):
            continue
        cands.append((head, mons))
    if prefer:
        cands = [c for c in cands if PREFER.search(c[0].get('location', '') + ' ' + c[0].get('locationname', ''))] or cands
    if not cands:
        return []
    picked = cands if variants else cands[:1]
    return [(h, team_of(m, species_slug, default, all_pokemon)) for h, m in picked]


def label_variants(parties):
    """Name starter-dependent variants by the Pokémon that only that variant has."""
    if len(parties) < 2:
        return [None] * len(parties)
    sets = [{m[0] for m in t} for _, t in parties]
    out = []
    for i, s in enumerate(sets):
        others = set().union(*[x for j, x in enumerate(sets) if j != i])
        uniq = sorted(s - others)
        last = parties[i][1][-1]
        out.append(' + '.join(u.replace('-', ' ') for u in uniq[:2]) if uniq else f'{last[0].replace("-", " ")} Lv {last[1]}')
    return out


def main():
    games = read_games()
    sp = gql('{ pokemonspecies(order_by:{id:asc}) { id name } pokemon { name pokemon_species_id is_default } }')
    species_slug = {s['id']: s['name'] for s in sp['pokemonspecies']}
    default = {p['pokemon_species_id']: p['name'] for p in sp['pokemon'] if p['is_default']}
    all_pokemon = {p['name'] for p in sp['pokemon']}
    result, report = {}, []
    for gk, milestones in games.items():
        for ms in milestones:
            fights = []
            for spec in specs(gk, ms):
                parties = parties_for(spec['title'], gk, species_slug, default, all_pokemon, spec['variants'], ms['role'] == 'elite4')
                names = label_variants(parties)
                for (head, team), variant in zip(parties, names):
                    if team:
                        fights.append({'who': spec['who'], 'variant': variant, 'either': spec.get('either', False), 'team': team})
            if not fights:  # trials / anything without a page: fall back to the known ace
                fights = [{'who': ms['name'], 'variant': None, 'either': False, 'team': [[ms['ace'], ms['level'], []]]}]
                report.append(f'{gk:22} {ms["name"]:42} ace only')
            result.setdefault(gk, {})[ms['name']] = fights
            n = sum(len(f['team']) for f in fights)
            wanted = len(specs(gk, ms))
            if len(fights) < wanted:
                report.append(f'{gk:22} {ms["name"]:42} {len(fights)}/{wanted} fights parsed')
    print('\n'.join(report) or 'all fights parsed')
    lines = [
        '// GENERATED by scripts/build-boss-teams.py: do not edit by hand.',
        '// Trainer parties read from Bulbapedia (CC BY-NC-SA 2.5, https://bulbapedia.bulbagarden.net).',
        '// team: [pokemon slug, level, moves[]]. "either": the fight is one of several alternatives (version / starter dependent).',
        'export interface BossFight { who: string; variant: string | null; either: boolean; team: [slug: string, level: number, moves: string[]][]; }',
        'export const BOSS_TEAMS: Record<string, Record<string, BossFight[]>> = ' + json.dumps(result, ensure_ascii=False, separators=(',', ':')) + ';',
        '',
    ]
    OUT_TS.write_text('\n'.join(lines), encoding='utf-8')
    print(f'wrote {OUT_TS.relative_to(ROOT)} ({OUT_TS.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    sys.exit(main())
