#!/usr/bin/env node
'use strict';

/**
 * Scrape Bulbapedia location images, one folder per game era.
 *
 * Generation and version slugs are auto-detected from PokeAPI.
 * Areas are filtered by region prefix — no per-area encounter calls.
 *
 * Usage:
 *   node scripts/scrape-location-images.js                     # all version groups
 *   node scripts/scrape-location-images.js all                 # same, explicit
 *   node scripts/scrape-location-images.js gen4                # all vgs in gen4
 *   node scripts/scrape-location-images.js heartgold-soulsilver
 *   node scripts/scrape-location-images.js gen4 gen6
 */

const fs   = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────

const USER_AGENT   = 'PokeWorldBot/1.0 (educational; contact: marticigor45@gmail.com)';
const DELAY_MS     = 300;
const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const ARCHIVES_API = 'https://archives.bulbagarden.net/w/api.php';
const OUTPUT_BASE  = path.join(__dirname, '..', 'public', 'images', 'locations');

// Bulbapedia image filename abbreviations per version group.
const VG_ABBREVS = {
  'red-blue':                             ['RBY', 'RGB'],
  'yellow':                               ['Y', 'RBY'],
  'gold-silver':                          ['GS', 'GSC'],
  'crystal':                              ['C', 'GSC'],
  'ruby-sapphire':                        ['RSE', 'RS'],
  'emerald':                              ['E', 'RSE'],
  'firered-leafgreen':                    ['FRLG'],
  'diamond-pearl':                        ['DPPt', 'DP'],
  'platinum':                             ['Pt', 'DPPt'],
  'heartgold-soulsilver':                 ['HGSS', 'HG', 'SS'],
  'black-white':                          ['BW'],
  'black-2-white-2':                      ['B2W2', 'BW2'],
  'x-y':                                  ['XY'],
  'omega-ruby-alpha-sapphire':            ['ORAS', 'OR', 'AS'],
  'sun-moon':                             ['SM'],
  'ultra-sun-ultra-moon':                 ['USUM'],
  'lets-go-pikachu-lets-go-eevee':        ['LGPE', 'PE'],
  'sword-shield':                         ['SwSh'],
  'brilliant-diamond-shining-pearl':      ['BDSP'],
  'legends-arceus':                       ['LA'],
  'scarlet-violet':                       ['SV'],
};

// Override auto-detected folder only where two version groups share a generation
// number but represent a distinct era (Legends: Arceus alongside SwSh/BDSP).
const VG_FOLDER_OVERRIDE = {
  'legends-arceus': 'gen8_5',
};

// Extra regions beyond what PokeAPI version-group lists (PokeAPI only includes
// the primary region; post-game regions must be added here).
const REGIONS_EXTRA = {
  'heartgold-soulsilver': ['kanto'],
};

// All known PokeAPI region name prefixes (lowercase, as they appear in area slugs).
const ALL_REGION_PREFIXES = [
  'kanto', 'johto', 'hoenn', 'sinnoh', 'unova',
  'kalos', 'alola', 'galar', 'hisui', 'paldea',
];

// ── Generic helpers ───────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

function romanToInt(s) {
  const map = { i:1, ii:2, iii:3, iv:4, v:5, vi:6, vii:7, viii:8, ix:9 };
  return map[s.toLowerCase()] ?? 0;
}

function genNameToFolder(genName) {
  const n = romanToInt(genName.replace('generation-', ''));
  return n ? `gen${n}` : genName;
}

// Words that Bulbapedia keeps lowercase in the middle of a title.
const LOWERCASE_WORDS = new Set([
  'of','the','a','an','in','on','at','by','to','for',
  'and','nor','but','or','yet','so','from','with','towards','near',
]);

function slugToTitle(slug) {
  return slug.split('-').map((word, idx) => {
    if (idx > 0 && LOWERCASE_WORDS.has(word)) return word;
    // Capitalize first char; uppercase single letters after digits (1f → 1F).
    return word
      .replace(/^(.)/, c => c.toUpperCase())
      .replace(/(\d)([a-z])/g, (_, d, l) => d + l.toUpperCase());
  }).join(' ');
}

// Returns the name with region prefix stripped if present.
function stripRegion(name) {
  for (const r of ALL_REGION_PREFIXES) {
    const titleR = r.charAt(0).toUpperCase() + r.slice(1) + ' ';
    if (name.startsWith(titleR)) return name.slice(titleR.length);
  }
  return name;
}

// PokeAPI slugs strip accents (pokemon → Pokémon). Try both on Bulbapedia.
function accentVariants(name) {
  const accented = name.replace(/\bPokemon\b/g, 'Pokémon');
  return accented !== name ? [name, accented] : [name];
}

// ── Name truncation queue ─────────────────────────────────────────────────────

function buildNamesQueue(name) {
  const cleaned = name
    .replace(/\b(Sea|Land)\b\s+(?=Route)/gi, '')
    .trim()
    .replace(/\s+/g, ' ');

  const words = cleaned.split(' ');
  const result = [];
  for (let len = words.length; len >= 2; len--) {
    result.push(words.slice(0, len).join(' '));
  }
  return [...new Set(result)];
}

// ── PokeAPI ───────────────────────────────────────────────────────────────────

async function fetchJSON(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

async function getAllLocationAreas() {
  process.stdout.write('Fetching location areas');
  const areas = [];
  let url = `${POKEAPI_BASE}/location-area/?limit=200`;
  while (url) {
    const data = await fetchJSON(url);
    areas.push(...data.results.map(r => r.name));
    url = data.next ?? null;
    process.stdout.write('.');
    await sleep(80);
  }
  console.log(` ${areas.length} found`);
  return areas;
}

// Cache: vgName → { folder, versions[], regions[] }
const vgInfoCache = new Map();

async function getVersionGroupInfo(vgName) {
  if (vgInfoCache.has(vgName)) return vgInfoCache.get(vgName);
  const data    = await fetchJSON(`${POKEAPI_BASE}/version-group/${vgName}/`);
  const folder  = VG_FOLDER_OVERRIDE[vgName] ?? genNameToFolder(data.generation.name);
  const versions = data.versions.map(v => v.name);
  const regions  = (data.regions ?? []).map(r => r.name);
  const info = { folder, versions, regions };
  vgInfoCache.set(vgName, info);
  await sleep(DELAY_MS);
  return info;
}

// Filter areas to those relevant for the given region list.
// Includes areas that:
//  (a) start with one of the wanted regions ("kanto-route-1-area"), OR
//  (b) don't start with ANY known region prefix ("pokemon-tower-1f-area").
// Category (b) lets Bulbapedia abbreviation matching be the final filter.
function filterAreasByRegions(allAreas, regions) {
  const wanted = new Set(regions.map(r => r.toLowerCase()));
  return allAreas.filter(areaName => {
    const slug = areaName.replace(/-area$/, '');
    const matchedRegion = ALL_REGION_PREFIXES.find(r => slug.startsWith(r + '-'));
    if (matchedRegion) return wanted.has(matchedRegion);
    return true; // no region prefix → include, let search results decide
  });
}

// Resolve CLI targets to version group names.
async function resolveTargets(targets) {
  if (!targets.length) return Object.keys(VG_ABBREVS);

  const result = new Set();
  for (const t of targets) {
    if (t === 'all') { Object.keys(VG_ABBREVS).forEach(vg => result.add(vg)); continue; }
    if (VG_ABBREVS[t]) { result.add(t); continue; }
    if (t === 'gen8_5') { result.add('legends-arceus'); continue; }

    const genMatch = t.match(/^gen(\d+)$/i);
    if (genMatch) {
      const targetFolder = `gen${genMatch[1]}`;
      const before = result.size;
      for (const vg of Object.keys(VG_ABBREVS)) {
        try {
          const { folder } = await getVersionGroupInfo(vg);
          if (folder === targetFolder) result.add(vg);
        } catch {
          // Version group not in PokeAPI — skip silently
        }
      }
      if (result.size === before) { console.error(`No version groups found for "${t}"`); process.exit(1); }
      continue;
    }

    console.error(`Unknown target: "${t}". Use a version group (e.g. heartgold-soulsilver), genN (e.g. gen4), gen8_5, or "all".`);
    process.exit(1);
  }
  return [...result];
}

// ── Bulbagarden Archives prefix search ───────────────────────────────────────

const prefixCache = new Map();

async function searchImagesByPrefix(prefix) {
  if (prefixCache.has(prefix)) return prefixCache.get(prefix);
  const results = [];
  let cont = null;
  do {
    const cp  = cont ? `&aicontinue=${encodeURIComponent(cont)}` : '';
    const url = `${ARCHIVES_API}?action=query&list=allimages&aiprefix=${encodeURIComponent(prefix)}&aiprop=url&format=json&origin=*&ailimit=50${cp}`;
    try {
      const data   = await fetchJSON(url);
      const images = data.query?.allimages ?? [];
      results.push(...images.map(img => ({ name: img.name, url: img.url })));
      cont = data.continue?.aicontinue ?? null;
    } catch (e) {
      console.warn(`\n  ⚠ prefix search failed for "${prefix}": ${e.message}`);
      break;
    }
    if (cont) await sleep(DELAY_MS);
  } while (cont);
  prefixCache.set(prefix, results);
  return results;
}

function pickBestImage(images, abbrevPriority) {
  for (const abbrev of abbrevPriority) {
    const pattern = new RegExp(`_${abbrev}[_.]`, 'i');
    const match   = images.find(img => pattern.test(img.name));
    if (match) return { url: match.url, abbrev };
  }
  return null;
}

// ── Download ──────────────────────────────────────────────────────────────────

async function downloadFile(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function processLocation(areaName, abbrevPriority, outputDir) {
  const slug = areaName.replace(/-area$/, '');
  const name = slugToTitle(slug);
  const dest = path.join(outputDir, `${slug}.png`);

  if (fs.existsSync(dest)) return 'skip';

  const names = buildNamesQueue(name);

  // Pass 1: version-specific images (trailing "_" + abbreviation match).
  // Prefix cache means all floors of the same dungeon share one Archives call.
  for (const variant of names) {
    const full   = variant.replace(/ /g, '_');
    const noReg  = stripRegion(variant).replace(/ /g, '_');
    const bases  = [...new Set([full, noReg !== full ? noReg : null].filter(Boolean))];

    for (const base of bases) {
      for (const b of accentVariants(base)) {
        const images = await searchImagesByPrefix(b + '_');
        if (!images.length) { await sleep(DELAY_MS); continue; }
        const best = pickBestImage(images, abbrevPriority);
        if (!best) { await sleep(DELAY_MS); continue; }
        try { await downloadFile(best.url, dest); return `ok:${best.abbrev}`; }
        catch (e) { return `fail:${e.message}`; }
      }
    }
  }

  // Pass 2: generic images without version suffix (e.g. Viridian_Forest.png).
  for (const variant of names.slice(0, 2)) {
    const full   = variant.replace(/ /g, '_');
    const noReg  = stripRegion(variant).replace(/ /g, '_');

    for (const search of [...new Set([full, noReg])]) {
      for (const s of accentVariants(search)) {
        const images = await searchImagesByPrefix(s);
        await sleep(DELAY_MS);
        if (!images.length) continue;

        // Prefer abbreviation match even in this pass.
        const abbrevMatch = pickBestImage(images, abbrevPriority);
        if (abbrevMatch) {
          try { await downloadFile(abbrevMatch.url, dest); return `ok:${abbrevMatch.abbrev}`; }
          catch (e) { return `fail:${e.message}`; }
        }

        // Accept exact-name PNG with no version suffix.
        const exact = images.find(img =>
          img.name.replace(/\.png$/i, '').toLowerCase() === s.toLowerCase()
        );
        if (exact) {
          try { await downloadFile(exact.url, dest); return 'ok:generic'; }
          catch (e) { return `fail:${e.message}`; }
        }
      }
    }
  }

  return 'notfound';
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const vgNames  = await resolveTargets(process.argv.slice(2));
  const allAreas = await getAllLocationAreas();
  // No preloadAreaVersions — region-prefix filtering replaces encounter checking.

  for (const vgName of vgNames) {
    let vgInfo;
    try { vgInfo = await getVersionGroupInfo(vgName); }
    catch (e) { console.warn(`⚠ Skipping "${vgName}": ${e.message}`); continue; }
    const { folder, versions, regions } = vgInfo;

    const allRegions = [...new Set([...regions, ...(REGIONS_EXTRA[vgName] ?? [])])];
    const abbrevs    = VG_ABBREVS[vgName];
    const outputDir  = path.join(OUTPUT_BASE, folder);
    fs.mkdirSync(outputDir, { recursive: true });

    const relevant = filterAreasByRegions(allAreas, allRegions);

    console.log(`\n── ${vgName}  →  ${folder}  (${versions.join(', ')})`);
    console.log(`   abbrevs : ${abbrevs.join(', ')}`);
    console.log(`   regions : ${allRegions.join(', ')} (${relevant.length} areas)\n`);

    let ok = 0, skip = 0, notfound = 0, fail = 0;
    for (let i = 0; i < relevant.length; i++) {
      const area = relevant[i];
      const slug = area.replace(/-area$/, '');
      process.stdout.write(`  [${String(i + 1).padStart(3)}/${relevant.length}] ${slug.padEnd(45)}`);

      const result = await processLocation(area, abbrevs, outputDir);
      if      (result === 'skip')          { skip++;     process.stdout.write('— skip\n'); }
      else if (result.startsWith('ok:'))   { ok++;       process.stdout.write(`✓ ${result.slice(3)}\n`); }
      else if (result === 'notfound')      { notfound++; process.stdout.write('— no image\n'); }
      else                                 { fail++;     process.stdout.write(`✗ ${result}\n`); }
    }

    console.log(`\n   ✓ ${ok} downloaded   ↩ ${skip} skipped   ✗ ${fail} failed   — ${notfound} not found\n`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
