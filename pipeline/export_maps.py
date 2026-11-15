# AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed by team AETHER.
"""Step 4 · Map layers for the web as 8-bit grayscale PNG data images on the 0.05 degree grid.

    python -m pipeline.export_maps

Writes web/public/data/maps/ and maps/index.json (grid geometry, encodings, file lists, sources).
Each PNG pixel is one 0.05 degree cell (row 0 = north edge). Pixel values are DATA, not colors: the web app
decodes them and chooses the color scale. 255 = no data.

  tree_cover/<year>.png       MOD44B tree cover, value = percent (0-100)
  hansen/treecover2000.png    Hansen canopy cover in 2000, value = percent (0-100)
  hansen/loss_<year>.png      Hansen loss share of the cell, value = round(100 * sqrt(share))
  hansen/tree_cover_<year>.png  Hansen tree cover at the end of the year (2000 cover minus canopy lost since
                              2001, regrowth not counted), value = percent (0-100)
  burned/<YYYY>-<H1|H2>.png   MCD64A1 burned share of the cell in the six-month period (sum of monthly
                              shares, capped at 1; re-burns count twice), value = round(100 * sqrt(share))

The square-root encoding keeps small shares visible (0.01 % of a cell -> 1) and is decoded as (value/100)^2.
Maps cover the whole clip box and are NOT cut to the Amazon polygon: the RAISG boundary may not be
redistributed (see data/README.md). Zone numbers in the JSON series do use the polygon.
"""
import json

import numpy as np
import xarray as xr
from PIL import Image

from .config import AI_DISCLOSURE, ANALYSIS_START, BBOX, EXTRA_SOURCES, INTERIM, OUTPUT, SEMESTERS

MAPS = OUTPUT / "maps"
NODATA = 255


def save_png(arr_lat_ascending, path, encode):
    a = np.flipud(arr_lat_ascending)                # row 0 = north
    out = np.full(a.shape, NODATA, np.uint8)
    ok = np.isfinite(a)
    out[ok] = np.clip(np.rint(encode(a[ok])), 0, 254).astype(np.uint8)
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(out, mode="L").save(path, optimize=True)
    return path.relative_to(MAPS).as_posix()


def pct(a):
    return a


def sqrt_share(a):
    return 100 * np.sqrt(np.clip(a, 0, 1))


def main():
    index = {
        "grid": {"lat_min": BBOX["lat_min"], "lat_max": BBOX["lat_max"], "lon_min": BBOX["lon_min"],
                 "lon_max": BBOX["lon_max"], "step_deg": 0.05, "row0": "north", "col0": "west", "nodata": NODATA},
        "encodings": {"percent": "value = percent (0-100)",
                      "sqrt_share": "share = (value / 100)^2, share of the cell area (0-1)"},
        "note": "Maps are not cut to the Amazon polygon (license of the RAISG boundary); zone statistics are.",
        "ai_disclosure": AI_DISCLOSURE,
        "layers": {},
    }
    shape = None

    files = sorted((INTERIM / "MOD44B").glob("*.nc"))
    if files:
        layer = {"source": "MOD44B", "doi": EXTRA_SOURCES["MOD44B"]["doi"], "encoding": "percent",
                 "period": "MOD44B year Y = early March Y to early March Y+1", "files": {}}
        for f in files:
            with xr.open_dataset(f) as ds:
                shape = ds.tree_cover.shape
                layer["files"][f.stem] = save_png(ds.tree_cover.values, MAPS / "tree_cover" / f"{f.stem}.png", pct)
        index["layers"]["tree_cover"] = layer

    hf = INTERIM / "HANSEN" / "gfc_v1.13.nc"
    if hf.exists():
        with xr.open_dataset(hf) as h:
            index["layers"]["hansen_treecover2000"] = {
                "source": "HANSEN", "doi": EXTRA_SOURCES["HANSEN"]["doi"], "encoding": "percent",
                "files": {"2000": save_png(h.treecover2000.values, MAPS / "hansen" / "treecover2000.png", pct)}}
            index["layers"]["hansen_loss"] = {
                "source": "HANSEN", "doi": EXTRA_SOURCES["HANSEN"]["doi"], "encoding": "sqrt_share",
                "period": "calendar year of stand-replacing loss",
                "files": {str(int(y)): save_png(h.loss_share.values[i], MAPS / "hansen" / f"loss_{int(y)}.png",
                                                 sqrt_share) for i, y in enumerate(h.year.values)}}
            if "tree_cover" in h:
                index["layers"]["hansen_tree_cover"] = {
                    "source": "HANSEN", "doi": EXTRA_SOURCES["HANSEN"]["doi"], "encoding": "percent",
                    "period": "end of calendar year; treecover2000 minus cumulative canopy loss, regrowth not counted",
                    "files": {str(int(y)): save_png(h.tree_cover.values[i], MAPS / "hansen" / f"tree_cover_{int(y)}.png",
                                                     pct) for i, y in enumerate(h.year.values)}}

    months = [f for f in sorted((INTERIM / "MCD64A1").glob("*.nc")) if f.stem >= ANALYSIS_START]
    if months:
        groups = {}
        for f in months:
            y, m = int(f.stem[:4]), int(f.stem[5:7])
            h_ = next(k for k, (a, b) in SEMESTERS.items() if a <= m <= b)
            groups.setdefault(f"{y}-{h_}", []).append(f)
        layer = {"source": "MCD64A1", "doi": EXTRA_SOURCES["MCD64A1"]["doi"], "encoding": "sqrt_share",
                 "period": "six-month period, sum of monthly burned shares capped at 1", "files": {}, "n_months": {}}
        for sem, fs in sorted(groups.items()):
            total = None
            for f in fs:
                with xr.open_dataset(f) as ds:
                    b = ds.burned_share.values.astype("float64")
                total = b if total is None else np.where(np.isnan(total), b, np.where(np.isnan(b), total, total + b))
            layer["files"][sem] = save_png(np.minimum(total, 1), MAPS / "burned" / f"{sem}.png", sqrt_share)
            layer["n_months"][sem] = len(fs)
        index["layers"]["burned"] = layer

    if shape:
        index["grid"]["rows"], index["grid"]["cols"] = int(shape[0]), int(shape[1])
    (MAPS / "index.json").write_text(json.dumps(index, indent=1), encoding="utf-8")
    size = sum(p.stat().st_size for p in MAPS.rglob("*.png")) / 1e6
    print(f"wrote {sum(len(l['files']) for l in index['layers'].values())} PNG layers ({size:.1f} MB) + maps/index.json")


if __name__ == "__main__":
    main()
