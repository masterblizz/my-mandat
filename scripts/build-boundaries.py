"""Build public/data/boundaries/{dun,parlimen}.json from DOSM open data.

Source: Department of Statistics Malaysia (DOSM), data-open
  datasets/geodata/electoral_1_dun.geojson, electoral_0_parlimen.geojson
  licence CC BY 4.0 — https://github.com/dosm-malaysia/data-open
Run:  python3 scripts/build-boundaries.py <dun.geojson> <parlimen.geojson>
Output: public/data/boundaries/<dun|parlimen>/<game state id>.json, keyed
by the seat name in lower case; values are
lists of rings of [lon, lat] rounded to 3 decimals (~100 m), simplified.
"""
import json, os, sys

STATES = {
    "Johor": "johor", "Kedah": "kedah", "Kelantan": "kelantan", "Melaka": "melaka",
    "Negeri Sembilan": "ns", "Pahang": "pahang", "Perak": "perak", "Perlis": "perlis",
    "Pulau Pinang": "penang", "Sabah": "sabah", "Sarawak": "sarawak", "Selangor": "selangor",
    "Terengganu": "terengganu", "W.P. Kuala Lumpur": "wp", "W.P. Labuan": "wp", "W.P. Putrajaya": "wp",
}

def perp(p, a, b):
    (x, y), (x1, y1), (x2, y2) = p, a, b
    dx, dy = x2 - x1, y2 - y1
    if dx == dy == 0:
        return ((x - x1) ** 2 + (y - y1) ** 2) ** 0.5
    return abs(dy * x - dx * y + x2 * y1 - y2 * x1) / (dx * dx + dy * dy) ** 0.5

def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    i, d = max(((i, perp(pts[i], pts[0], pts[-1])) for i in range(1, len(pts) - 1)), key=lambda t: t[1])
    if d > eps:
        return rdp(pts[: i + 1], eps)[:-1] + rdp(pts[i:], eps)
    return [pts[0], pts[-1]]

def build(path, name_field):
    out = {}
    for f in json.load(open(path))["features"]:
        p = f["properties"]
        state = STATES[p["state"]]
        name = p[name_field].split(" ", 1)[1].strip().lower()
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        rings = []
        for poly in polys:
            ring = rdp([tuple(c[:2]) for c in poly[0]], 0.0015)
            ring = [[round(x, 3), round(y, 3)] for x, y in ring]
            ring = [c for i, c in enumerate(ring) if i == 0 or c != ring[i - 1]]
            if len(ring) >= 4:
                rings.append(ring)
        if rings:
            out.setdefault(state, {})[name] = rings
    return out

if __name__ == "__main__":
    dst = os.path.join(os.path.dirname(__file__), "..", "public", "data", "boundaries")
    os.makedirs(dst, exist_ok=True)
    for src, field in [(sys.argv[1], "dun"), (sys.argv[2], "parlimen")]:
        os.makedirs(os.path.join(dst, field), exist_ok=True)
        for state, seats in build(src, field).items():
            path = os.path.join(dst, field, state + ".json")
            with open(path, "w") as fh:
                json.dump(seats, fh, separators=(",", ":"))
            print(field, state, len(seats), os.path.getsize(path))
