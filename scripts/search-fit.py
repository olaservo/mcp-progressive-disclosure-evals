# Compares a local BM25 with what the Messages API's tool search returned, and prints the figures in docs/results.md
# section "How the search splits and ranks, 2026-11-26". No model is called.
# The local BM25 splits text on whitespace, strips punctuation at the ends of each word, lowercases, drops English stop
# words and stems with Snowball. A tool's text is its name, its description, and every property name and string value in
# its input schema, including $defs, enum values, titles and defaults. k1 1.2, b 0.75.
# Needs Python 3.11 with bm25s and PyStemmer (pip install bm25s PyStemmer). The catalog comes from
#   npx tsx scripts/search-mechanics.ts --dump catalog.json
# Usage: python scripts/search-fit.py catalog.json results/2026-11-25-search-probe.jsonl results/2026-11-26-search-mechanics.jsonl
import json, math, re, sys
from collections import Counter
import Stemmer
from bm25s.stopwords import STOPWORDS_EN

catalog_file, probe_file, mechanics_file = sys.argv[1:4]
tools = json.load(open(catalog_file, encoding='utf8'))
names = [tool['name'] for tool in tools]
stem = Stemmer.Stemmer('english')
STOP = set(STOPWORDS_EN)


def text(tool):
    out = [tool['name'], tool.get('description', '')]

    def walk(node):
        if isinstance(node, dict):
            for key, value in node.items():
                if key == 'properties' and isinstance(value, dict):
                    for name, sub in value.items():
                        out.append(name)
                        walk(sub)
                elif key == 'enum' and isinstance(value, list):
                    out.extend(str(item) for item in value)
                elif key == 'default' and isinstance(value, (str, int, float)):
                    out.append(str(value))
                elif isinstance(value, str) and key != '$ref':
                    out.append(value)
                else:
                    walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(tool['inputSchema'])
    return ' '.join(out)


def words(value):
    out = []
    for word in value.lower().split():
        word = re.sub(r'^[^\w]+|[^\w]+$', '', word)
        if word and word not in STOP:
            out.append(stem.stemWord(word))
    return out


docs = [words(text(tool)) for tool in tools]
df = Counter(word for doc in docs for word in set(doc))
avg = sum(map(len, docs)) / len(docs)
tfs = [Counter(doc) for doc in docs]
K1, B = 1.2, 0.75


def search(query, top=5):
    terms = list(dict.fromkeys(words(query)))
    scored = []
    for at, doc in enumerate(docs):
        score = 0.0
        for word in terms:
            f = tfs[at].get(word)
            if f:
                score += math.log(1 + (len(docs) - df[word] + 0.5) / (df[word] + 0.5)) * f * (K1 + 1) / (f + K1 * (1 - B + B * len(doc) / avg))
        if score > 0:
            scored.append((-score, at))
    scored.sort()
    return [names[at] for _, at in scored[:top]]


# Every request on the full catalog in served order whose query is not a tool name.
rows = []
for line in open(probe_file, encoding='utf8').read().splitlines()[1:]:
    row = json.loads(line)
    rows.append((row['query'], row['returned'][0]))
for line in open(mechanics_file, encoding='utf8').read().splitlines()[1:]:
    row = json.loads(line)
    if row['catalog'] == 'served' and row.get('returned'):
        rows.append((row['query'], row['returned'][0]))
rows = [(query, api) for query, api in rows if '_' not in query]

shared = same = 0
print('| Query | Shared with the API | Same set |')
print('| :-- | --: | :-- |')
for query, api in rows:
    local = search(query)
    count = len(set(local) & set(api))
    shared += count
    same += set(local) == set(api)
    print(f"| {query} | {count} of {len(api)} | {'yes' if set(local) == set(api) else ''} |")
print(f"\n{len(rows)} requests, {len({query for query, _ in rows})} distinct queries. The local top 5 holds {shared} of the {sum(len(api) for _, api in rows)} tools the API returned, and the same set in {same} requests.")

by_name = {tool['name']: tool for tool in tools}
print('\nQuery words in each tool, as the local BM25 splits them:')
for name, query in [('emailSending_subdomains_list', 'list email sending subdomains'), ('emailSending_subdomains_delete', 'list email sending subdomains'),
                    ('alerting_policies_list', 'list notification policies alerting'), ('alerting_policies_test', 'list notification policies alerting')]:
    doc = words(text(by_name[name]))
    print(f"{name}: {len(doc)} words, " + ', '.join(f'{word} {doc.count(word)}' for word in dict.fromkeys(words(query))))

print('\nAdding one word at a time to "zones list account get":')
for query in ['zones list account get', 'zones list account get zone', 'zones list account get id', 'zones list account get name']:
    print(f'{query}: {search(query)}')

# The lengths catalog: which (k1, b) put the tools in the order the API returned for "gadget". A tool's length is its
# gadgets and padding plus `extra` words, and each filler tool is 5 to 12 words, as the words above would count them.
mechanics = [json.loads(line) for line in open(mechanics_file, encoding='utf8').read().splitlines()[1:]]
api = next(row for row in mechanics if row['id'] == 'len-lengths')['returned'][0]
sizes = {'len_1x_pad0': (1, 0), 'len_1x_pad40': (1, 40), 'len_2x_pad40': (2, 40), 'len_4x_pad40': (4, 40), 'len_8x_pad40': (8, 40),
         'len_4x_pad200': (4, 200), 'len_8x_pad200': (8, 200), 'len_16x_pad200': (16, 200)}
print(f'\n"gadget" on the lengths catalog, API order: {api}')
for extra, filler in [(0, 5), (1, 6), (3, 9), (5, 12)]:
    lengths = {name: gadgets + pad + extra for name, (gadgets, pad) in sizes.items()}
    mean = (sum(lengths.values()) + 8 * filler) / 16
    fits = []
    for k1 in [step / 10 for step in range(1, 101)]:
        for b in [step / 100 for step in range(101)]:
            score = {name: f * (k1 + 1) / (f + k1 * (1 - b + b * lengths[name] / mean)) for name, (f, _) in sizes.items()}
            if sorted(score, key=lambda name: -score[name])[:5] == api:
                fits.append((k1, b))
    bs = sorted({b for _, b in fits})
    print(f'extra {extra}, filler {filler}: {len(fits)} of 10,100 (k1, b) pairs give that order, b from {bs[0]} to {bs[-1]}, (1.2, 0.75) among them: {(1.2, 0.75) in fits}')
