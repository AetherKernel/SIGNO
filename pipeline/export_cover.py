# AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed by team AETHER.
"""Step 6 · Export tree cover, tree cover loss and burned area per API cell to web/server/data/cover.json.

    python -m pipeline.export_cover        (run after pipeline.export_api: it reads trends/ndvi.json)

Uses the same 1 degree API grid as export_api (cells and cellIds are identical to trends/ndvi.json). Every value
is computed from the 0.05 degree sub-cells that are inside the Amazon polygon and inside the API cell:
  hansenTreeCover  % : cos-latitude weighted mean; index 0 = 2000 (treecover2000), then end of 2001..2025
  modisTreeCover   % : cos-latitude weighted mean of MOD44B, 2000..2025
  lossKm2          km2 per year 2001..2025: sum of Hansen loss_share x sub-cell area
  burnedKm2        km2 per calendar year 2001..2025: sum over its 12 months of MCD64A1 burned_share x sub-cell area
No trend or significance test is applied. Sources are cited in the file's definitions and in the README.
"""
import json

import numpy as np
import xarray as xr

from .config import API_CELL_DEG, INTERIM
from .export_api import OUT, Aggregator, api_grid
from .tiles import LAT, LON

YEARS = list(range(2000, 2026))
LOSS_YEARS = list(range(2001, 2026))
BURNED_YEARS = list(range(2001, 2026))

DEFINITIONS = {
    "hansenTreeCover": "Tree cover from the Hansen/UMD Global Forest Change dataset (30 m Landsat): canopy cover in 2000 "
                       "minus the canopy lost since 2001, as a percent of the area. Regrowth is not counted, so it can only go down.",
    "modisTreeCover": "Tree cover from NASA MODIS MOD44B Vegetation Continuous Fields: a yearly estimate at 250 m. It reads "
                      "about 22 points lower than Hansen over dense forest, and its product year runs March to March, so "
                      "compare its change over time, not its level.",
    "lossKm2": "Area (km2) with stand-replacing tree cover loss in the year, from Hansen. It includes fire, logging, mining "
               "and clearing, not only deforestation.",
    "burnedKm2": "Area (km2) burned in the calendar year, summed over its 12 months, from NASA MODIS MCD64A1 burned area.",
}
FLAGS = [{"source": "modis", "year": 2025,
          "note": "MOD44B 2025 drops about 3 points in cells with no Hansen loss; treat as suspect."}]


def km2_grid():
    """Area (km2) of every 0.05 degree sub-cell."""
    return (0.05 * 111.32) ** 2 * np.cos(np.deg2rad(LAT))[:, None] * np.ones((1, LON.size))


def rounded(x, nd):
    return [None if not np.isfinite(v) else round(float(v), nd) for v in x]


def main():
    ny, nx, cells = api_grid()
    ids = {c["cellId"] for c in json.loads((OUT / "trends" / "ndvi.json").read_text(encoding="utf-8"))["cells"]}
    cells = [c for c in cells if c["cellId"] in ids]
    assert len(cells) == len(ids), "API grid does not cover every cellId of trends/ndvi.json"
    keys = np.array([c["key"] for c in cells])
    agg = Aggregator(LAT, LON, nx, ny)
    km2 = km2_grid()
    print(f"{len(cells)} cells", flush=True)

    with xr.open_dataset(INTERIM / "HANSEN" / "gfc_v1.13.nc") as ds:
        h = ds.load()
    hansen = [agg.mean(h.treecover2000.values.astype("float64"))[keys]]
    hansen += [agg.mean(h.tree_cover.values[i].astype("float64"))[keys] for i in range(len(LOSS_YEARS))]
    loss = [agg.total(h.loss_share.values[i].astype("float64") * km2)[keys] for i in range(len(LOSS_YEARS))]
    assert [int(y) for y in h.year.values] == LOSS_YEARS

    modis = []
    for y in YEARS:
        with xr.open_dataset(INTERIM / "MOD44B" / f"{y}.nc") as ds:
            modis.append(agg.mean(ds.tree_cover.values.astype("float64"))[keys])

    burned = []
    for y in BURNED_YEARS:
        acc = np.zeros(len(keys)); seen = np.zeros(len(keys), bool)
        for m in range(1, 13):
            with xr.open_dataset(INTERIM / "MCD64A1" / f"{y}-{m:02d}.nc") as ds:
                t = agg.total(ds.burned_share.values.astype("float64") * km2)[keys]
            seen |= np.isfinite(t); acc += np.nan_to_num(t)
        burned.append(np.where(seen, acc, np.nan))

    out_cells = []
    for i, c in enumerate(cells):
        out_cells.append({"cellId": c["cellId"], "lat": c["lat"], "lon": c["lon"],
                          "hansenTreeCover": rounded([a[i] for a in hansen], 2),
                          "modisTreeCover": rounded([a[i] for a in modis], 2),
                          "lossKm2": rounded([a[i] for a in loss], 1),
                          "burnedKm2": rounded([a[i] for a in burned], 1)})
    result = {"cellSizeDeg": API_CELL_DEG, "years": YEARS, "lossYears": LOSS_YEARS, "burnedYears": BURNED_YEARS,
              "definitions": DEFINITIONS, "flags": FLAGS, "cells": out_cells}
    p = OUT / "cover.json"
    p.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {p} ({p.stat().st_size / 1024:.0f} KB)", flush=True)
    print("Next: run `python -m pipeline.trends` (this step removed or rewrote the trend results)", flush=True)


if __name__ == "__main__":
    main()
