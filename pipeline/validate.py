# AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed by team AETHER.
"""Step 7 · Cross-validation of the tree cover data and fire attribution, written for the web.

    python -m pipeline.validate

Writes web/public/data/validation.json (snake_case, read by the notebooks/maps) and web/server/data/validation.json
(camelCase, for the web API). Everything here is descriptive (agreement statistics, co-location shares, ranked
hotspots); no trend or significance test is applied, and the r values carry no p-value. Cells = 0.05 degree cells.

Burned area uses ONE rule everywhere: a cell counts as burned in a year when its MCD64A1 burned share is > 0 in at
least one month of that calendar year. Only complete calendar years 2001..2025 are used (2000 and 2026 are partial).

1. agreement      MOD44B tree cover (2000) vs Hansen canopy cover (2000): r, bias, RMSE, by Hansen class
2. change         MOD44B tree cover change (mean 2023-2024 minus mean 2001-2002) vs Hansen loss share
                  2001-2024 (MOD44B 2025 is flagged and not used), by Hansen loss decile
3. fire           share of Hansen loss area located in cells that burned (MCD64A1) the same year or the
                  year before, per year (2001: only 2001 itself, as 2000 is a partial year)
4. hotspots       cells with the largest Hansen loss share 2001-2025 per zone, with the year of peak loss,
                  MOD44B change and burned area
5. yearly         zone mean tree cover per year, MOD44B vs Hansen-derived (2000 cover minus canopy lost)
6. cases          documented places (config.CASES): yearly Hansen and MOD44B cover, loss share, burned months
"""
import json
from datetime import datetime, timezone

import numpy as np
import xarray as xr

from .config import AI_DISCLOSURE, API_CELL_DEG, BBOX, CASES, EXTRA_SOURCES, INTERIM, OUTPUT, ROOT, ZONES
from .tiles import LAT, LON
from .zones import zone_masks

N_HOTSPOTS = 10
SERVER_OUT = ROOT / "web" / "server" / "data"
FIRST_YEAR, LAST_YEAR = 2001, 2025        # complete calendar years of burned area
CASE_LAST_MONTH = "2026-09"               # last month of MCD64A1 downloaded


def mod44b(year):
    with xr.open_dataset(INTERIM / "MOD44B" / f"{year}.nc") as ds:
        return ds.tree_cover.values.astype("float64")


def api_cell_id(lat, lon):
    """Id (r{row}c{col}) of the 1 degree API cell that contains the point, same rule as export_api."""
    row = int(np.floor((lat - BBOX["lat_min"]) / API_CELL_DEG))
    col = int(np.floor((lon - BBOX["lon_min"]) / API_CELL_DEG))
    return f"r{row:02d}c{col:02d}"


def load_burned(case_cells):
    """Burned share per cell and complete calendar year 2001..2025 (sum of monthly shares, capped at 1), plus the
    months with burned share > 0 at each case cell (2001-01 .. CASE_LAST_MONTH)."""
    yearly, case_months = {}, {c["id"]: [] for c in case_cells}
    for f in sorted((INTERIM / "MCD64A1").glob("*.nc")):
        month = f.stem
        if not ("2001-01" <= month <= CASE_LAST_MONTH):
            continue
        with xr.open_dataset(f) as ds:
            b = np.nan_to_num(ds.burned_share.values.astype("float64"))
        y = int(month[:4])
        if y <= LAST_YEAR:
            yearly[y] = b if y not in yearly else yearly[y] + b
        for c in case_cells:
            if b[c["iy"], c["ix"]] > 0:
                case_months[c["id"]].append(month)
    return {y: np.minimum(v, 1) for y, v in yearly.items()}, case_months


def r(a, b):
    ok = np.isfinite(a) & np.isfinite(b)
    return float(np.corrcoef(a[ok], b[ok])[0, 1]), int(ok.sum())


def case_cells():
    return [{**c, "iy": int(np.abs(LAT - c["lat"]).argmin()), "ix": int(np.abs(LON - c["lon"]).argmin())} for c in CASES]


def main():
    with xr.open_dataset(INTERIM / "HANSEN" / "gfc_v1.13.nc") as h:
        h = h.load()
    years = [int(y) for y in h.year.values]
    tc2000 = h.treecover2000.values.astype("float64")
    loss = h.loss_share.values.astype("float64")              # (year, lat, lon)
    loss_total = loss.sum(axis=0)
    loss_window = loss[[i for i, y in enumerate(years) if y <= 2024]].sum(axis=0)   # 2001-2024, same window as the MODIS change
    m2000 = mod44b(2000)
    change = (mod44b(2023) + mod44b(2024)) / 2 - (mod44b(2001) + mod44b(2002)) / 2
    cases = case_cells()
    burned, case_months = load_burned(cases)
    masks = {z: m.values for z, m in zone_masks(LAT, LON).items()}
    km2 = (0.05 * 111.32) ** 2 * np.cos(np.deg2rad(LAT))[:, None] * np.ones_like(tc2000)

    sources = {k: EXTRA_SOURCES[k]["doi"] for k in ("MOD44B", "HANSEN", "MCD64A1")}
    generated = datetime.now(timezone.utc).isoformat(timespec="seconds")
    note = ("Descriptive cross-checks between independent datasets; no significance test (r values have no p-value). "
            "Burned means MCD64A1 burned share > 0 in the cell; only complete calendar years 2001-2025 are used.")
    result = {"meta": {"generated_utc": generated, "sources": sources, "note": note, "ai_disclosure": AI_DISCLOSURE},
              "zones": {}}
    api = {"zones": [], "cases": [], "meta": {"generatedUtc": generated, "sources": sources, "note": note,
                                               "aiDisclosure": AI_DISCLOSURE}}
    burn_def = ("Hansen loss area in cells with MCD64A1 burned area (share > 0) in the same or the previous calendar "
                "year; for 2001 only 2001 itself (2000 is a partial year)")
    change_def = "MOD44B mean(2023,2024) - mean(2001,2002), percentage points; Hansen loss share 2001-2024 (MOD44B 2025 is flagged and not used)"
    for z, m in masks.items():
        zr = {}
        # 1. agreement in 2000
        a, b = m2000[m], tc2000[m]
        rr, n = r(a, b)
        bins = [0, 10, 30, 50, 70, 90, 101]
        by_class = []
        for lo, hi in zip(bins[:-1], bins[1:]):
            sel = (b >= lo) & (b < hi) & np.isfinite(a)
            if sel.sum():
                by_class.append({"hansen_range": [lo, min(hi, 100)], "cells": int(sel.sum()),
                                 "hansen_mean": round(float(b[sel].mean()), 1), "mod44b_mean": round(float(a[sel].mean()), 1)})
        ok = np.isfinite(a) & np.isfinite(b)
        zr["agreement_2000"] = {"r": round(rr, 3), "cells": n, "bias_mod44b_minus_hansen": round(float((a - b)[ok].mean()), 2),
                                "rmse": round(float(np.sqrt(((a - b)[ok] ** 2).mean())), 2), "by_hansen_class": by_class}
        # 2. change vs Hansen loss
        c, lt = change[m], loss_window[m]
        rr, n = r(c, lt)
        okc = np.isfinite(c) & np.isfinite(lt)
        edges = np.quantile(lt[okc], np.linspace(0, 1, 11))
        dec = []
        for i in range(10):
            sel = okc & (lt >= edges[i]) & ((lt < edges[i + 1]) if i < 9 else (lt <= edges[i + 1]))
            if sel.sum():
                dec.append({"decile": i + 1, "hansen_loss_share_mean": round(float(lt[sel].mean()), 4),
                            "mod44b_change_pp_mean": round(float(c[sel].mean()), 2), "cells": int(sel.sum())})
        zr["change_vs_hansen_loss"] = {"r": round(rr, 3), "cells": n, "definition": change_def,
                                       "by_hansen_loss_decile": dec}
        # 3. fire co-location per year (one rule: burned share > 0; complete years 2001..2025; 2001 has no previous year)
        fire = []
        for i, y in enumerate(years):
            if y not in burned:
                continue
            fired = burned[y] > 0
            if y - 1 in burned:
                fired = fired | (burned[y - 1] > 0)
            la = loss[i] * km2
            tot = float(la[m].sum())
            infire = float(la[m & fired].sum())
            fire.append({"year": y, "loss_km2": round(tot, 1), "loss_in_burned_cells_km2": round(infire, 1),
                         "share": round(infire / tot, 3) if tot else None,
                         "zone_share_of_cells_burned": round(float(fired[m].mean()), 3)})
        zr["loss_with_fire"] = {"definition": burn_def, "years": fire}
        # 4. hotspots
        lt_z = np.where(m, np.nan_to_num(loss_total), -1)
        top = np.argsort(lt_z.ravel())[::-1][:N_HOTSPOTS]
        hs = []
        for k in top:
            iy, ix = np.unravel_index(k, lt_z.shape)
            peak = int(np.argmax(loss[:, iy, ix]))
            hs.append({"lat": round(float(LAT[iy]), 3), "lon": round(float(LON[ix]), 3),
                       "api_cell_id": api_cell_id(float(LAT[iy]), float(LON[ix])),
                       "hansen_loss_share_2001_2025": round(float(loss_total[iy, ix]), 3),
                       "peak_loss_year": years[peak], "peak_loss_share": round(float(loss[peak, iy, ix]), 3),
                       "hansen_treecover2000": round(float(tc2000[iy, ix]), 1),
                       "mod44b_change_pp": None if not np.isfinite(change[iy, ix]) else round(float(change[iy, ix]), 1),
                       "burned_years": [y for y, bb in burned.items() if bb[iy, ix] > 0]})
        zr["hotspots"] = hs
        # 5. yearly zone means: MOD44B vs Hansen-derived tree cover (same zone cells)
        if "tree_cover" in h:
            w = np.cos(np.deg2rad(LAT))[:, None] * np.ones_like(tc2000)

            def zmean(a):
                ok = m & np.isfinite(a)
                return round(float((a[ok] * w[ok]).sum() / w[ok].sum()), 2)
            rows = []
            for i, y in enumerate(years):
                f = INTERIM / "MOD44B" / f"{y}.nc"
                if f.exists():
                    rows.append({"year": y, "mod44b": zmean(mod44b(y)), "hansen": zmean(h.tree_cover.values[i].astype("float64"))})
            zr["yearly_zone_means"] = rows
        result["zones"][z] = zr
        ag, ch = zr["agreement_2000"], zr["change_vs_hansen_loss"]
        api["zones"].append({
            "zoneId": z, "label": ZONES[z]["label"],
            "agreement2000": {"r": ag["r"], "cells": ag["cells"], "biasPp": ag["bias_mod44b_minus_hansen"],
                              "rmsePp": ag["rmse"],
                              "byHansenClass": [{"hansenRange": x["hansen_range"], "cells": x["cells"],
                                                 "hansenMean": x["hansen_mean"], "modisMean": x["mod44b_mean"]}
                                                for x in ag["by_hansen_class"]]},
            "changeVsLoss": {"r": ch["r"], "cells": ch["cells"], "definition": change_def,
                             "byLossDecile": [{"decile": x["decile"], "hansenLossShareMean": x["hansen_loss_share_mean"],
                                               "modisChangePpMean": x["mod44b_change_pp_mean"], "cells": x["cells"]}
                                              for x in ch["by_hansen_loss_decile"]]},
            "lossWithFire": {"definition": burn_def,
                             "years": [{"year": x["year"], "lossKm2": x["loss_km2"],
                                        "lossInBurnedCellsKm2": x["loss_in_burned_cells_km2"], "share": x["share"],
                                        "zoneShareOfCellsBurned": x["zone_share_of_cells_burned"]} for x in fire]},
            "hotspots": [{"lat": x["lat"], "lon": x["lon"], "apiCellId": x["api_cell_id"],
                          "hansenLossShare": x["hansen_loss_share_2001_2025"], "peakLossYear": x["peak_loss_year"],
                          "peakLossShare": x["peak_loss_share"], "hansenTreeCover2000": x["hansen_treecover2000"],
                          "modisChangePp": x["mod44b_change_pp"], "burnedYears": x["burned_years"]} for x in hs]})
        print(f"{z}: agreement r={ag['r']}, change r={ch['r']}", flush=True)

    # 6. documented cases (independent of the zones)
    cover_years = list(range(2000, 2026))
    modis_years = {y: mod44b(y) for y in cover_years}

    def rnd(xs, nd):
        return [None if not np.isfinite(v) else round(float(v), nd) for v in xs]

    snake_cases = []
    for c in cases:
        iy, ix = c["iy"], c["ix"]
        hansen_cover = [float(tc2000[iy, ix])] + [float(h.tree_cover.values[i, iy, ix]) for i in range(len(years))]
        modis_cover = [float(modis_years[y][iy, ix]) for y in cover_years]
        lat, lon = round(float(LAT[iy]), 3), round(float(LON[ix]), 3)
        months = case_months[c["id"]]
        base = {"id": c["id"], "label": c["label"], "lat": lat, "lon": lon, "reference": c["reference"]}
        period = f"2001-01..{CASE_LAST_MONTH}"
        snake_cases.append({**base, "api_cell_id": api_cell_id(lat, lon), "years": cover_years,
                            "hansen_tree_cover": rnd(hansen_cover, 1), "mod44b_tree_cover": rnd(modis_cover, 1),
                            "loss_years": years, "hansen_loss_share": rnd(loss[:, iy, ix], 3),
                            "burned_months": len(months), "burned_months_list": months, "burned_period": period})
        api["cases"].append({**base, "apiCellId": api_cell_id(lat, lon), "years": cover_years,
                             "hansenTreeCover": rnd(hansen_cover, 1), "modisTreeCover": rnd(modis_cover, 1),
                             "lossYears": years, "hansenLossShare": rnd(loss[:, iy, ix], 3),
                             "burnedMonths": len(months), "burnedMonthsList": months, "burnedPeriod": period})
        print(f"case {c['id']}: Hansen {hansen_cover[0]:.1f} -> {hansen_cover[-1]:.1f}, "
              f"MOD44B {modis_cover[0]:.1f} -> {modis_cover[-1]:.1f}, burned months {len(months)}", flush=True)
    result["cases"] = snake_cases

    p = OUTPUT / "validation.json"
    p.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    SERVER_OUT.mkdir(parents=True, exist_ok=True)
    q = SERVER_OUT / "validation.json"
    q.write_text(json.dumps(api, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {p} ({p.stat().st_size / 1024:.1f} KB) and {q} ({q.stat().st_size / 1024:.1f} KB)")
    print("Next: run `python -m pipeline.trends` (this step removed or rewrote the trend results)", flush=True)


if __name__ == "__main__":
    main()
