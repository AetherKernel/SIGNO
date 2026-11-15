# AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed by team AETHER.
"""Zone masks: which grid cells belong to each zone (whole Amazon, Brazilian Amazon, Peruvian Amazon).

A cell belongs to a zone when its center falls inside the zone polygon. Masks are built once per grid
(0.05, 0.1 and 0.25 degrees) and cached in data/interim/masks/.
"""
import io
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
import shapefile  # pyshp
import shapely
import xarray as xr
from shapely.geometry import shape

from .config import AMAZON_BOUNDARY, BOUNDARY_FILES, INTERIM, NATURAL_EARTH_URL, RAW, ZONES


def _find(name: str) -> Path:
    hits = sorted(RAW.rglob(name))
    if not hits:
        raise FileNotFoundError(f"{name} not found under {RAW}. See data/README.md for the download link.")
    return hits[0]


def _read_zip_shapefile(path: Path, encoding: str):
    zf = zipfile.ZipFile(path)
    shp = next(n for n in zf.namelist() if n.lower().endswith(".shp"))
    base = shp[:-4]
    return shapefile.Reader(
        shp=io.BytesIO(zf.read(shp)),
        shx=io.BytesIO(zf.read(base + ".shx")),
        dbf=io.BytesIO(zf.read(base + ".dbf")),
        encoding=encoding,
    )


def amazon_polygon():
    if AMAZON_BOUNDARY == "raisg_biome":
        r = _read_zip_shapefile(_find(BOUNDARY_FILES["raisg_biome"]), encoding="latin-1")
        idx = [i for i, rec in enumerate(r.records()) if rec["id_bioma"] == 1]  # "Amazonía"
    elif AMAZON_BOUNDARY == "hydrobasins_basin":
        r = _read_zip_shapefile(_find(BOUNDARY_FILES["hydrobasins_basin"]), encoding="utf-8")
        idx = [i for i, rec in enumerate(r.records()) if rec["PFAF_ID"] == 622]
    else:
        raise ValueError(f"Unknown AMAZON_BOUNDARY: {AMAZON_BOUNDARY}")
    if len(idx) != 1:
        raise ValueError(f"Expected one Amazon record in {AMAZON_BOUNDARY}, found {len(idx)}")
    return shapely.make_valid(shape(r.shape(idx[0]).__geo_interface__))


def country_polygon(iso3: str):
    try:
        path = _find(BOUNDARY_FILES["countries"])
    except FileNotFoundError:
        path = RAW / "boundaries" / BOUNDARY_FILES["countries"]
        path.parent.mkdir(parents=True, exist_ok=True)
        print(f"Downloading Natural Earth countries (public domain) to {path}")
        urllib.request.urlretrieve(NATURAL_EARTH_URL, path)
    r = _read_zip_shapefile(path, encoding="utf-8")
    idx = [i for i, rec in enumerate(r.records()) if rec["ADM0_A3"] == iso3]
    if len(idx) != 1:
        raise ValueError(f"Expected one country {iso3}, found {len(idx)}")
    return shapely.make_valid(shape(r.shape(idx[0]).__geo_interface__))


def _mask_for(geom, lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
    shapely.prepare(geom)
    lon2, lat2 = np.meshgrid(lon, lat)
    return shapely.contains_xy(geom, lon2.ravel(), lat2.ravel()).reshape(lat2.shape)


def grid_key(lat: np.ndarray) -> str:
    return f"{abs(float(lat[1] - lat[0])):.3f}deg"


def zone_masks(lat: np.ndarray, lon: np.ndarray) -> xr.Dataset:
    """Boolean mask per zone on this grid, cached on disk by grid resolution and boundary choice."""
    cache = INTERIM / "masks" / f"{AMAZON_BOUNDARY}_{grid_key(lat)}_{lat.size}x{lon.size}.nc"
    if cache.exists():
        with xr.open_dataset(cache) as ds:
            return ds.load().astype(bool)
    amazon = amazon_polygon()
    base = _mask_for(amazon, lat, lon)
    data = {}
    for zid, z in ZONES.items():
        m = base if z["country"] is None else base & _mask_for(country_polygon(z["country"]), lat, lon)
        data[zid] = (("lat", "lon"), m)
    ds = xr.Dataset(data, coords={"lat": lat, "lon": lon})
    cache.parent.mkdir(parents=True, exist_ok=True)
    ds.astype("uint8").to_netcdf(cache)
    return ds
