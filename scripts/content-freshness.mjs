import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = 'docs/data/freshness.json';
const INDEX = 'docs/data/wiki/index.json';
const hash = text => createHash('sha256').update(text).digest('hex');
const read = (root, path) => readFileSync(resolve(root, path), 'utf8');
const json = (root, path) => JSON.parse(read(root, path));
const save = (root, path, data) => writeFileSync(resolve(root, path), JSON.stringify(data, null, 2) + '\n');

export function catalog(root = ROOT) {
  const index = json(root, INDEX);
  const docs = readdirSync(resolve(root, 'docs/data/wiki')).filter(p => p.endsWith('.json') && p !== 'index.json')
    .map(p => json(root, 'docs/data/wiki/' + p));
  return { index, docs };
}

export function syncIndex(root = ROOT) {
  const { index, docs } = catalog(root);
  const byId = new Map(docs.map(d => [d.id, d]));
  // Preserve index-only aliases (legacy URLs/search vocabulary) without promoting them to titles.
  index.documents = index.documents.map(entry => {
    const doc = byId.get(entry.id);
    if (!doc) throw new Error('Missing article: ' + entry.id);
    byId.delete(entry.id);
    return { ...entry, title: doc.title, category: doc.category, summary: doc.summary,
      aliases: [...new Set([...entry.aliases, ...doc.aliases])] };
  });
  for (const doc of byId.values()) index.documents.push(Object.fromEntries(
    ['id', 'title', 'category', 'summary', 'aliases'].map(key => [key, doc[key]])));
  save(root, INDEX, index);
}

function moduleSources(root, entry, visited = new Set()) {
  if (visited.has(entry)) return visited;
  visited.add(entry);
  if (!/\.(?:js|mjs)$/.test(entry)) return visited;
  for (const match of read(root, entry).matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
    const path = relative(root, resolve(root, dirname(entry), match[1].split('?')[0]));
    moduleSources(root, path, visited);
  }
  return visited;
}

export function collectPages(root = ROOT) {
  const { index, docs } = catalog(root);
  const project = json(root, 'docs/data/project.json');
  const pages = {};
  const common = ['docs/index.html', 'docs/styles.css', 'docs/typography-scale.css', 'docs/freshness.js'];
  const add = (id, title, own, refs = []) => {
    const ownSources = [...new Set(own.flatMap(p => [...moduleSources(root, p)]).concat(common))].sort();
    pages[id] = { title, ownSources, sources: [...new Set([...ownSources, ...refs])].sort() };
  };
  const data = names => names.map(n => 'docs/data/' + n + '.json');
  for (const [id, names] of Object.entries({overview:['project'], story:['project','wiki/index'],
    systems:['project','relationships','stats','projections'], character:['project','stats','classes'],
    attributes:['project','projections','projection-views'], projections:['projections','projection-views','project'],
    questions:['project'], archive:['project']})) {
    add(id, id, [...data(names), 'docs/app.js']);
  }
  for (const element of [...project.elements, {id:'rules', name:'개시 규칙'}]) {
    add('attributes/wiki/' + element.id, element.name,
      [...data(['project','projections','projection-views']), 'docs/attributes-view.js']);
  }
  // Direct references plus actual term mentions also catch documents without a curated related[] link.
  // shortcut: implicit conceptual links still need human review; this is not a semantic consistency proof.
  for (const doc of docs) {
    const text = JSON.stringify(doc.sections) + JSON.stringify(doc.flow || {});
    const refs = new Set(doc.related || []);
    for (const entry of index.documents) {
      if (entry.id !== doc.id && ([entry.title, ...entry.aliases].some(term => term.length > 1 && text.includes(term))
        || text.includes('"' + entry.id + '"') || text.includes('#story/wiki/' + entry.id))) refs.add(entry.id);
    }
    const sources = [...refs].map(id => 'docs/data/wiki/' + id + '.json');
    // Cross-domain glossary data can be referenced in narrative prose too.
    if (project.elements.some(e => text.includes(e.name))) sources.push('docs/data/project.json', 'docs/data/projections.json');
    add('story/wiki/' + doc.id, doc.title,
      ['docs/data/wiki/' + doc.id + '.json', 'docs/story-world.js'], sources);
  }
  // Story index previews and open questions must be reconsidered when narrative sources change.
  const wikiSources = docs.map(d => 'docs/data/wiki/' + d.id + '.json');
  for (const id of ['story', 'questions']) pages[id].sources = [...new Set([...pages[id].sources, ...wikiSources])].sort();
  return pages;
}

export function snapshot(root = ROOT) {
  const pages = collectPages(root);
  const sources = Object.fromEntries([...new Set(Object.values(pages).flatMap(p => p.sources))].sort()
    .map(path => [path, hash(read(root, path))]));
  for (const page of Object.values(pages)) {
    page.fingerprint = hash(JSON.stringify(page.sources.map(path => [path, sources[path]])));
  }
  return { schemaVersion: 1, sources, pages };
}

export function pending(current, saved) {
  return Object.entries(current.pages).filter(([id, page]) => saved?.pages?.[id]?.fingerprint !== page.fingerprint)
    .map(([id, page]) => ({ id, title:page.title, changed: page.sources.filter(path => saved?.sources?.[path] !== current.sources[path]),
      previousReview: saved?.pages?.[id]?.reviewedAt || null }));
}

function sourceTime(root, paths) {
  const times = paths.map(path => {
    const dirty = execFileSync('git', ['status','--porcelain','--',path], {cwd:root, encoding:'utf8'}).trim();
    if (dirty) return new Date().toISOString();
    return execFileSync('git', ['log','-1','--format=%cI','--',path], {cwd:root, encoding:'utf8'}).trim();
  }).filter(Boolean).map(s => new Date(s).toISOString());
  return times.sort().at(-1) || null;
}

export function validate(root = ROOT) {
  const { index, docs } = catalog(root);
  const errors = [];
  for (const doc of docs) {
    const entry = index.documents.find(d => d.id === doc.id);
    for (const key of ['title','summary','category']) if (entry?.[key] !== doc[key]) errors.push(`${doc.id}: index ${key} drift`);
    for (const alias of doc.aliases) if (!entry?.aliases.includes(alias)) errors.push(`${doc.id}: missing alias ${alias}`);
  }
  const saved = json(root, MANIFEST);
  const current = snapshot(root);
  for (const item of pending(current, saved)) errors.push(`${item.id}: review required (${item.changed.join(', ') || 'reference set changed'})`);
  for (const id of Object.keys(saved.pages)) if (!current.pages[id]) errors.push(`${id}: removed page still in manifest`);
  for (const [id, page] of Object.entries(saved.pages)) {
    if (!page.updatedAt || !Number.isFinite(Date.parse(page.updatedAt))) errors.push(`${id}: invalid updatedAt`);
    if (page.reviewedAt !== null && (!Number.isFinite(Date.parse(page.reviewedAt)) || !page.reviewNote?.trim())) errors.push(`${id}: invalid review receipt`);
  }
  return errors;
}

function main() {
  const [command = '--check', ...args] = process.argv.slice(2);
  if (command === '--sync-index') return syncIndex();
  const current = snapshot();
  const saved = existsSync(resolve(ROOT, MANIFEST)) ? json(ROOT, MANIFEST) : null;
  if (command === '--init') {
    if (saved) throw new Error('Baseline already exists. Use --status and --review; never reset review history.');
    for (const page of Object.values(current.pages)) Object.assign(page, {updatedAt:sourceTime(ROOT,page.ownSources), reviewedAt:null, reviewNote:null});
    save(ROOT, MANIFEST, current);
  } else if (command === '--status') {
    for (const item of pending(current,saved)) console.log(JSON.stringify(item));
    console.log(`${pending(current,saved).length} page(s) require review. Existing null reviewedAt means historical review is unrecorded.`);
  } else if (command === '--review') {
    const [id, note] = args;
    if (!saved || !current.pages[id] || !note?.trim()) throw new Error('--review PAGE_ID "review outcome and reason" required');
    const page = current.pages[id];
    const old = saved.pages[id];
    const ownChanged = !old || page.ownSources.some(p => saved.sources[p] !== current.sources[p]);
    saved.pages[id] = {...page, updatedAt:ownChanged ? sourceTime(ROOT,page.ownSources) : old.updatedAt,
      reviewedAt:new Date().toISOString(), reviewNote:note};
    // Preserve old source hashes until all affected pages are reviewed, so --status keeps explaining the changes.
    if (!pending(current,saved).length) saved.sources = current.sources;
    for (const key of Object.keys(saved.pages)) if (!current.pages[key]) delete saved.pages[key];
    save(ROOT,MANIFEST,saved);
  } else if (command === '--check') {
    const errors = validate();
    if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
    else console.log('Content freshness and index checks passed.');
  } else throw new Error('Use --status, --sync-index, --review PAGE_ID "note", or --check');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
