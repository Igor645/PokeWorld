#!/usr/bin/env python3
"""
Builds src/app/components/nuzlocke/progression.ts: for every game, the order of areas you actually play through and
where each gym / trial / Elite Four falls, plus each boss's badge, type, ace and level.

Sources (both CC BY-NC-SA 2.5, https://bulbapedia.bulbagarden.net):
  * the game's walkthrough index (Walkthrough:Pokémon <Game>): the ordered locations of every walkthrough part,
    including "<Town> Gym" markers, which gives the real progression order;
  * the gym leaders' trainer pages: who leads which gym in which game (location + game code), plus their teams.
Locations are kept when PokeAPI knows them (so encounter data and localised names line up).
Run:  python scripts/build-progression.py      (pages are cached in scripts/.wiki-cache)
"""
import json, re, sys
from wikilib import *

REGION = {
    'red-blue': 'kanto', 'yellow': 'kanto', 'firered-leafgreen': 'kanto', 'gold-silver': 'johto', 'crystal': 'johto',
    'heartgold-soulsilver': 'johto', 'ruby-sapphire': 'hoenn', 'emerald': 'hoenn', 'oras': 'hoenn', 'diamond-pearl': 'sinnoh',
    'platinum': 'sinnoh', 'black-white': 'unova', 'black2-white2': 'unova', 'x-y': 'kalos', 'sun-moon': 'alola', 'usum': 'alola',
    'sword-shield': 'galar', 'scarlet-violet': 'paldea',
}
VERSIONS = {
    'red-blue': ['red', 'blue'], 'yellow': ['yellow'], 'gold-silver': ['gold', 'silver'], 'crystal': ['crystal'],
    'ruby-sapphire': ['ruby', 'sapphire'], 'emerald': ['emerald'], 'firered-leafgreen': ['firered', 'leafgreen'],
    'diamond-pearl': ['diamond', 'pearl'], 'platinum': ['platinum'], 'heartgold-soulsilver': ['heartgold', 'soulsilver'],
    'black-white': ['black', 'white'], 'black2-white2': ['black-2', 'white-2'], 'x-y': ['x', 'y'],
    'oras': ['omega-ruby', 'alpha-sapphire'], 'sun-moon': ['sun', 'moon'], 'usum': ['ultra-sun', 'ultra-moon'],
    'sword-shield': ['sword', 'shield'], 'scarlet-violet': ['scarlet', 'violet'],
}
WALK = {
    'red-blue': 'Pokémon Red and Blue', 'yellow': 'Pokémon Yellow', 'gold-silver': 'Pokémon Gold and Silver', 'crystal': 'Pokémon Crystal',
    'ruby-sapphire': 'Pokémon Ruby and Sapphire', 'emerald': 'Pokémon Emerald', 'firered-leafgreen': 'Pokémon FireRed and LeafGreen',
    'diamond-pearl': 'Pokémon Diamond and Pearl', 'platinum': 'Pokémon Platinum', 'heartgold-soulsilver': 'Pokémon HeartGold and SoulSilver',
    'black-white': 'Pokémon Black and White', 'black2-white2': 'Pokémon Black 2 and White 2', 'x-y': 'Pokémon X and Y',
    'oras': 'Pokémon Omega Ruby and Alpha Sapphire', 'sun-moon': 'Pokémon Sun and Moon', 'usum': 'Pokémon Ultra Sun and Ultra Moon',
    'sword-shield': 'Pokémon Sword and Shield', 'scarlet-violet': 'Pokémon Scarlet and Violet',
}
LEADERS = ['Brock', 'Misty', 'Lt. Surge', 'Erika', 'Koga', 'Sabrina', 'Blaine', 'Giovanni', 'Falkner', 'Bugsy', 'Whitney', 'Morty', 'Chuck',
           'Jasmine', 'Pryce', 'Clair', 'Roxanne', 'Brawly', 'Wattson', 'Flannery', 'Norman', 'Winona', 'Tate and Liza', 'Wallace', 'Juan',
           'Roark', 'Gardenia', 'Fantina', 'Maylene', 'Crasher Wake', 'Byron', 'Candice', 'Volkner', 'Cilan', 'Chili', 'Cress', 'Lenora',
           'Burgh', 'Elesa', 'Clay', 'Skyla', 'Brycen', 'Drayden', 'Iris', 'Cheren', 'Roxie', 'Marlon', 'Viola', 'Grant', 'Korrina', 'Ramos',
           'Clemont', 'Valerie', 'Olympia', 'Wulfric', 'Milo', 'Nessa', 'Kabu', 'Bea', 'Allister', 'Opal', 'Gordie', 'Melony', 'Piers',
           'Raihan', 'Katy', 'Brassius', 'Iono', 'Kofu', 'Larry', 'Ryme', 'Tulip', 'Grusha']
DISPLAY = {'Tate and Liza': 'Tate & Liza'}
DENY = set()   # (game, leader) pairs to ignore if a page ever lists a leader in a game they are not in
TRIALS = {   # captains / totems only have their ace recorded (trial captains have no trainer page)
    'sun-moon': [('Ilima Trial', 'gumshoos', 12, 'normal'), ('Lana Trial', 'wishiwashi', 22, 'water'), ('Kiawe Trial', 'marowak', 22, 'fire'),
                 ('Mallow Trial', 'lurantis', 24, 'grass'), ('Sophocles Trial', 'vikavolt', 29, 'electric'), ('Acerola Trial', 'mimikyu', 33, 'ghost')],
    'usum': [('Ilima Trial', 'gumshoos', 12, 'normal'), ('Lana Trial', 'wishiwashi', 23, 'water'), ('Kiawe Trial', 'marowak', 22, 'fire'),
             ('Mallow Trial', 'lurantis', 26, 'grass'), ('Sophocles Trial', 'vikavolt', 35, 'electric'), ('Acerola Trial', 'mimikyu', 40, 'ghost')],
}
TRIAL_AREA = {'Abandoned Megamart': 'Thrifty Megamart'}
WILD_AREA = {
    'Wild Area I': ['Rolling Fields', 'Dappled Grove', 'Watchtower Ruins', 'East Lake Axewell', 'West Lake Axewell', "Axew's Eye", 'South Lake Miloch', "Giant's Seat"],
    'Wild Area II': ['North Lake Miloch', 'Motostoke Riverbank', 'Bridge Field', 'Stony Wilderness', 'Dusty Bowl', "Giant's Mirror", 'Hammerlocke Hills', "Giant's Cap", 'Lake of Outrage'],
}
# Paldea is open-ended, so this follows the usual recommended order. Each gym town's province area comes from its Bulbapedia page.
PALDEA = {
    'routes': ['Cabo Poco', 'Poco Path', 'South Province Area 1', 'Mesagoza', 'South Province Area 2', 'East Province Area 1', 'East Province Area 2',
               'East Province Area 3', 'West Province Area 1', 'West Province Area 2', 'Asado Desert', 'West Province Area 3', 'Casseroya Lake',
               'North Province Area 1', 'North Province Area 2', 'South Province Area 3', 'South Province Area 4', 'South Province Area 5',
               'South Province Area 6', 'North Province Area 3', 'Great Crater of Paldea'],
    'gyms': [('cortondo', 'South Province Area 2'), ('artazon', 'East Province Area 1'), ('levincia', 'East Province Area 2'),
             ('cascarrafa', 'West Province Area 1'), ('medali', 'West Province Area 3'), ('montenevera', 'North Province Area 2'),
             ('alfornada', 'South Province Area 6'), ('glaseado', 'North Province Area 3')],
}
SV_TYPE = {'Katy': 'Bug', 'Brassius': 'Grass', 'Iono': 'Electric', 'Kofu': 'Water', 'Larry': 'Normal', 'Ryme': 'Ghost', 'Tulip': 'Psychic', 'Grusha': 'Ice'}
NUM_WORD = {'One': 1, 'Two': 2, 'Three': 3, 'Four': 4, 'Five': 5, 'Six': 6}
EXCLUDE = re.compile(r'rematch|tournament|world|frontier|tower|arena|battle (?:tent|factory|dome|palace|pike|pyramid|subway|maison|royal|tree|castle|arcade)|gauntlet|link|multi|double|vs\.? seeker|trainer tower|colosseum|masters|pass|catalog', re.I)
PREFER = re.compile(r'league|elite|champion|hall of fame|indigo|plateau|wyndon', re.I)
CITYISH = re.compile(r'(Town|City|Village|Route \d+|Island|Path|Plateau|Way|Road|Woods|Forest|Cave|Tunnel|Mountain|Mt\.)$|^Route ')


def location_index():
    locs = gql('{ location { id name } }')['location']
    return {l['name']: l['id'] for l in locs}


def key(name):
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]', '-', name.lower())).strip('-')


def resolve(by_slug, region, area):
    slug = key(area)
    if '-area-' in slug:
        for word, n in ((w.lower(), str(i)) for w, i in NUM_WORD.items()):
            slug = re.sub(rf'-{n}$', f'-{word}', slug)
    for c in (f'{region}-{slug}', slug, f'{region}-sea-{slug}'):
        if c in by_slug:
            return by_slug[c]
    hit = next((k for k in by_slug if k.endswith('-' + slug) and k.startswith(region)), None) or next((k for k in by_slug if k.endswith('-' + slug)), None)
    return by_slug.get(hit) if hit else None


def tokens_of(chunk):
    s = re.sub(r'\{\{.*?\}\}', '', chunk)
    s = re.sub(r'<[^>]+>', '', s).replace('&amp;', '&')
    s = re.sub(r'Routes (\d+), (\d+),? and (\d+)', r'Route \1, Route \2, Route \3', s)
    s = re.sub(r'Routes (\d+) and (\d+)', r'Route \1, Route \2', s)
    return [re.sub(r'^and ', '', t.strip()) for t in s.split(',') if t.strip()]


def walkthrough_parts(gk):
    text = fetch(WALK[gk], 'Walkthrough:', 'WT_')
    parts = []
    for row in re.split(r'\n\|-', text):
        m = re.search(r'\[\[Walkthrough:[^|\]]*?/Part (\d+)\|Part \d+\]\]', row)
        if not m or 'Isle of' in row or 'Crown Tundra' in row:
            continue
        t = re.search(r"\|\s*(?:colspan=\d+\s*)?(?:style=\"[^\"]*\"\s*)?\|\s*''(.*?)''", row, re.S)
        if t:
            parts.append(tokens_of(t.group(1)))
    return parts


def classify(tok):
    m = re.match(r'^Trial \d+: (.+)$', tok)
    if m:
        return 'trial', m.group(1).strip()
    if re.search(r'\b(Pokémon League|Indigo Plateau|Elite Four|Hall of Fame)\b', tok):
        return 'e4', None
    if tok.startswith('Wyndon Stadium - Finals'):
        return 'e4', None
    m = re.match(r'^(?:The )?(.+?) (?:Gym|Stadium)$', tok)
    if m:
        if m.group(1).lower().startswith('after'):
            return 'skip', None
        return 'gym', m.group(1).strip()
    if tok in WILD_AREA:
        return 'wild', tok
    m = re.match(r'^(.+?) \(Area (One|Two|Three|Four|Five|Six)\)$', tok)
    if m:
        return 'area', f'{m.group(1)} Area {NUM_WORD[m.group(2)]}'
    base = re.sub(r'\s*\([^)]*\)$', '', tok).strip()
    return 'area', re.sub(r'^The ', '', base)


def main():
    by_slug = location_index()
    species_slug, default, all_pokemon = species_tables()

    # who leads which gym, per game (from the trainers' own pages)
    gym_of = {}
    for name in LEADERS:
        text = fetch(TITLE_FIX.get(name, name))
        badge = (re.search(r'\[\[([A-Z][\w\'’ ]+ Badge)\]\]', text) or [None, ''])[1]
        for head, mons in blocks(text):
            loc = head.get('location', '')
            m = re.match(r'^(.+?) (?:Gym|Stadium)\b', loc)
            if not m or EXCLUDE.search(loc) or 'wyndon' in loc.lower():
                continue
            for gk in CODES.get(head.get('game', '').strip().lower().replace(' ', ''), []):
                if (gk, name) in DENY:
                    continue
                gym_of.setdefault((gk, m.group(1).lower()), {}).setdefault(name, (head, mons, badge))

    result, report = {}, []
    for gk in WALK:
        region = REGION[gk]
        has = {e['locationarea']['location_id'] for e in gql(
            'query($v:[String!]) { encounter(where:{version:{name:{_in:$v}}}) { locationarea { location_id } } }', {'v': VERSIONS[gk]})['encounter']}
        routes, seen, milestones, last_new = [], set(), [], None
        done = False
        for part in walkthrough_parts(gk):
            for tok in part:
                kind, val = classify(tok)
                if kind == 'skip':
                    continue
                if kind == 'wild':
                    for w in WILD_AREA[val]:
                        if w not in seen and resolve(by_slug, region, w):
                            routes.append(w); seen.add(w); last_new = w
                    continue
                if kind == 'trial':
                    val = TRIAL_AREA.get(val, val)
                    if val not in seen and resolve(by_slug, region, val):
                        routes.append(val); seen.add(val); last_new = val
                    milestones.append({'kind': 'trial', 'city': val, 'after': last_new or ''})
                elif kind == 'gym':
                    milestones.append({'kind': 'gym', 'city': val, 'after': last_new or (routes[0] if routes else '')})
                elif kind == 'e4':
                    milestones.append({'kind': 'e4', 'city': None, 'after': last_new or ''})
                    done = True
                    break
                elif kind == 'area':
                    if val in seen or val == 'Introduction' or val == 'Prologue':
                        continue
                    loc = resolve(by_slug, region, val)
                    if loc is not None and (loc in has or CITYISH.search(val)) or (gk == 'scarlet-violet' and loc is not None):
                        routes.append(val); seen.add(val); last_new = val
            if done:
                break

        if gk == 'scarlet-violet':
            routes = list(PALDEA['routes'])
            milestones = [{'kind': 'gym', 'city': c, 'after': a} for c, a in PALDEA['gyms']] + [{'kind': 'e4', 'city': None, 'after': routes[-1]}]
        else:
            # some walkthroughs never mention a gym by name (Emerald has no "Mossdeep Gym"): add it after its town
            have = {m['city'].lower() for m in milestones if m['kind'] == 'gym'}
            for (g2, city), _ in list(gym_of.items()):
                if g2 != gk or city in have:
                    continue
                town = next((r for r in routes if r.lower().startswith(city)), None)
                if town:
                    milestones.append({'kind': 'gym', 'city': city, 'after': town})
                    have.add(city)

        # turn markers into milestones
        out = []
        trial_no = 0
        for mk in milestones:
            if mk['kind'] == 'e4':
                names = E4.get(gk, [])
                label = ' → '.join(LABEL.get(n, n) for n in names)
                champ = names[-1] if names else ''
                best = None
                for head, mons in blocks(fetch(TITLE_FIX.get(champ, champ))):
                    if code_ok(head.get('game', ''), gk) and not EXCLUDE.search(head.get('location', '')):
                        if PREFER.search(head.get('location', '') + ' ' + head.get('locationname', '')) or best is None:
                            best = (head, mons)
                            if PREFER.search(head.get('location', '')):
                                break
                team = team_of(best[1], species_slug, default, all_pokemon) if best else []
                top = max(team, key=lambda t: t[1]) if team else None
                out.append({'name': label, 'role': 'elite4', 'aceLevel': top[1] if top else 60, 'acePokemon': top[0] if top else 'dragonite',
                            'afterRoute': mk['after'], 'type': ''})
            elif mk['kind'] == 'gym':
                leaders = gym_of.get((gk, mk['city'].lower()))
                if not leaders:
                    report.append(f'{gk:22} no leader found for "{mk["city"]} Gym"')
                    continue
                names = list(leaders)
                label = ' / '.join(DISPLAY.get(n, n) for n in names)
                if gk == 'scarlet-violet':
                    label = f'{names[0]} ({SV_TYPE.get(names[0], "")})'
                best, top = None, None
                for n in names:
                    head, mons, badge = leaders[n]
                    team = team_of(mons, species_slug, default, all_pokemon)
                    cand = max(team, key=lambda t: t[1]) if team else None
                    if cand and (top is None or cand[1] > top[1]):
                        top, best = cand, (head, badge)
                head0, _, badge0 = leaders[names[0]]
                typ = head0.get('_type', '')
                entry = {'name': label, 'role': 'gym', 'aceLevel': top[1] if top else 0, 'acePokemon': top[0] if top else '',
                         'afterRoute': mk['after'], 'type': typ if typ in TYPES else ''}
                if badge0:
                    entry['badge'] = badge0
                out.append(entry)
            elif mk['kind'] == 'trial':
                if trial_no < len(TRIALS.get(gk, [])):
                    n, ace, lv, typ = TRIALS[gk][trial_no]
                    out.append({'name': n, 'role': 'boss', 'aceLevel': lv, 'acePokemon': ace, 'afterRoute': mk['after'], 'type': typ})
                trial_no += 1
        result[gk] = {'routes': routes, 'milestones': out}

    lines = [
        '// GENERATED by scripts/build-progression.py: do not edit by hand.',
        '// Area order and boss placement from Bulbapedia walkthroughs and trainer pages (CC BY-NC-SA 2.5, https://bulbapedia.bulbagarden.net).',
        "import type { Milestone } from './nuzlocke-data';",
        'export const PROGRESSION: Record<string, { routes: string[]; milestones: Milestone[] }> = ' + json.dumps(result, ensure_ascii=False, indent=1) + ';',
        '',
    ]
    (NUZ / 'progression.ts').write_text('\n'.join(lines), encoding='utf-8')

    print('\n'.join(report) or 'no warnings')
    for gk, d in result.items():
        after = {}
        for m in d['milestones']:
            after.setdefault(m['afterRoute'], []).append(f"{m['name']} L{m['aceLevel']}")
        print(f"\n## {gk} ({len(d['routes'])} areas)")
        print(' > '.join(r + (' [' + '; '.join(after[r]) + ']' if r in after else '') for r in d['routes']))


if __name__ == '__main__':
    sys.exit(main())
