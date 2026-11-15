# AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15, implementing the trend test decided by team AETHER (see docs/plan-tests-tendencia.md). Reviewed by team AETHER.
"""Step 9 · Country borders for the map: web/public/data/borders.json.

    python -m pipeline.export_borders

Natural Earth 10m admin-0 countries (public domain, already in data/raw/boundaries), clipped to the clip box and
simplified (about 0.02 degrees) so the file stays small. GeoJSON FeatureCollection with properties {name, iso3}.
"""
import json

import shapely
from shapely.geometry import box, mapping, shape

from .config import BBOX, BOUNDARY_FILES, OUTPUT
from .zones import _find, _read_zip_shapefile

TOLERANCE_DEG = 0.02
DECIMALS = 3


def main():
    reader = _read_zip_shapefile(_find(BOUNDARY_FILES["countries"]), encoding="utf-8")
    clip = box(BBOX["lon_min"], BBOX["lat_min"], BBOX["lon_max"], BBOX["lat_max"])
    features = []
    for rec, sh in zip(reader.records(), reader.shapes()):
        geom = shapely.make_valid(shape(sh.__geo_interface__)).intersection(clip)
        if geom.is_empty:
            continue
        geom = geom.simplify(TOLERANCE_DEG, preserve_topology=True)
        if geom.is_empty:
            continue
        feat = mapping(geom)
        feat = json.loads(json.dumps(feat), parse_float=lambda s: round(float(s), DECIMALS))
        features.append({"type": "Feature", "properties": {"name": rec["ADMIN"], "iso3": rec["ADM0_A3"]}, "geometry": feat})
    features.sort(key=lambda f: f["properties"]["iso3"])
    out = {"type": "FeatureCollection",
           "name": "Country borders, Natural Earth 10m admin-0 (public domain), clipped to the SIGNO box and simplified",
           "features": features}
    path = OUTPUT / "borders.json"
    path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(features)} countries, {path.stat().st_size / 1024:.0f} KB -> {path}")
    assert path.stat().st_size < 400 * 1024, "borders.json is larger than 400 KB"


if __name__ == "__main__":
    main()
