# AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed by team AETHER.
"""Read one downloaded (global) file of each NASA product and return it clipped and cleaned.

Every reader returns an xarray.Dataset with dims (time=1, lat, lon), lat and lon ascending, physical units,
fill values as NaN, and the quality layers kept next to the data. Nothing is filtered by quality here,
except values outside the product's documented valid range.
"""
import calendar
import re
from datetime import date, timedelta
from pathlib import Path

import h5py
import numpy as np
import xarray as xr
from netCDF4 import Dataset as NCDataset
from pyhdf.SD import SD, SDC

from .config import BBOX

CMG_RES = 0.05  # MODIS Climate Modeling Grid: 3600 x 7200, row 0 at 90N, col 0 at 180W


def _month_start(year: int, doy: int) -> np.datetime64:
    d = date(year, 1, 1) + timedelta(days=doy - 1)
    return np.datetime64(f"{d.year:04d}-{d.month:02d}-01")


def _days_in_month(t: np.datetime64) -> int:
    y, m = int(str(t)[:4]), int(str(t)[5:7])
    return calendar.monthrange(y, m)[1]


def _cmg_window():
    """Row/col slices of the global CMG grid covering BBOX, and the pixel-center coordinates."""
    r0 = int(np.floor((90 - BBOX["lat_max"]) / CMG_RES))
    r1 = int(np.ceil((90 - BBOX["lat_min"]) / CMG_RES))
    c0 = int(np.floor((BBOX["lon_min"] + 180) / CMG_RES))
    c1 = int(np.ceil((BBOX["lon_max"] + 180) / CMG_RES))
    lat = 90 - CMG_RES / 2 - CMG_RES * np.arange(r0, r1)
    lon = -180 + CMG_RES / 2 + CMG_RES * np.arange(c0, c1)
    return slice(r0, r1), slice(c0, c1), lat, lon


def _modis_time(path: Path) -> np.datetime64:
    m = re.search(r"\.A(\d{4})(\d{3})\.", path.name)
    return _month_start(int(m.group(1)), int(m.group(2)))


def _scaled(sd, name, rs, cs, divide=False):
    """Read an HDF4 layer window, mask fill and out-of-range values, apply the scale factor."""
    sds = sd.select(name)
    att = sds.attributes()
    raw = sds[rs, cs].astype("float64")
    bad = raw == att["_FillValue"]
    lo, hi = att.get("valid_range", (-np.inf, np.inf))
    bad |= (raw < lo) | (raw > hi)
    sf = att.get("scale_factor", 1.0)
    # MOD13 stores scale_factor as the divisor (10000); MOD11 stores it as a multiplier (0.02).
    val = raw / sf if divide else raw * sf
    val = val + att.get("add_offset", 0.0)
    val[bad] = np.nan
    return val.astype("float32")


def _finish(ds: xr.Dataset) -> xr.Dataset:
    return ds.sortby("lat").sortby("lon")


def read_mod13c2(path: Path) -> xr.Dataset:
    sd = SD(str(path), SDC.READ)
    rs, cs, lat, lon = _cmg_window()
    pre = "CMG 0.05 Deg Monthly "
    ds = xr.Dataset(
        {
            "ndvi": (("lat", "lon"), _scaled(sd, pre + "NDVI", rs, cs, divide=True)),
            "evi": (("lat", "lon"), _scaled(sd, pre + "EVI", rs, cs, divide=True)),
            "reliability": (("lat", "lon"), sd.select(pre + "pixel reliability")[rs, cs].astype("int8")),
            "n_1km_obs": (("lat", "lon"), sd.select(pre + "#1km pix used")[rs, cs].astype("uint8")),
        },
        coords={"lat": lat, "lon": lon},
    )
    sd.end()
    ds["ndvi"].attrs = {"units": "1", "long_name": "NDVI"}
    ds["evi"].attrs = {"units": "1", "long_name": "EVI"}
    ds["reliability"].attrs = {"long_name": "pixel reliability: 0 good, 1 marginal, 2 snow/ice, 3 cloudy, "
                                            "4 estimated, -1 fill"}
    ds["n_1km_obs"].attrs = {"long_name": "number of 1 km pixels used (0-36, 255 fill)"}
    return _finish(ds.expand_dims(time=[_modis_time(path)]))


def read_mod11c3(path: Path) -> xr.Dataset:
    sd = SD(str(path), SDC.READ)
    rs, cs, lat, lon = _cmg_window()
    out = {}
    for part in ("Day", "Night"):
        out[f"lst_{part.lower()}"] = (("lat", "lon"), _scaled(sd, f"LST_{part}_CMG", rs, cs) - np.float32(273.15))
        bits = sd.select(f"Clear_sky_{part.lower()}s")[rs, cs].astype("uint32")
        out[f"clear_{part.lower()}s"] = (("lat", "lon"), np.bitwise_count(bits).astype("uint8"))
    utc = _scaled(sd, "Day_view_time", rs, cs)  # hours UTC
    out["day_local_time"] = (("lat", "lon"), ((utc + lon[None, :] / 15.0) % 24).astype("float32"))
    out["land_percent"] = (("lat", "lon"), sd.select("Percent_land_in_grid")[rs, cs].astype("uint8"))
    sd.end()
    ds = xr.Dataset(out, coords={"lat": lat, "lon": lon})
    ds["lst_day"].attrs = {"units": "degC", "long_name": "daytime land surface temperature"}
    ds["lst_night"].attrs = {"units": "degC", "long_name": "nighttime land surface temperature"}
    ds["clear_days"].attrs = {"long_name": "clear-sky days with valid daytime LST in the month"}
    ds["clear_nights"].attrs = {"long_name": "clear-sky nights with valid nighttime LST in the month"}
    ds["day_local_time"].attrs = {"units": "h", "long_name": "mean daytime observation time, local solar"}
    ds["land_percent"].attrs = {"units": "%", "long_name": "percentage of land in the grid cell"}
    return _finish(ds.expand_dims(time=[_modis_time(path)]))


def read_gldas(path: Path) -> xr.Dataset:
    nc = NCDataset(str(path))
    lat = np.round(nc["lat"][:].data.astype("float64"), 3)
    lon = np.round(nc["lon"][:].data.astype("float64"), 3)
    iy = np.where((lat >= BBOX["lat_min"]) & (lat <= BBOX["lat_max"]))[0]
    ix = np.where((lon >= BBOX["lon_min"]) & (lon <= BBOX["lon_max"]))[0]
    m = re.search(r"\.A(\d{4})(\d{2})\.", path.name)
    t = np.datetime64(f"{m.group(1)}-{m.group(2)}-01")
    sec = 86400 * _days_in_month(t)

    def get(var):
        a = nc[var][0, iy[0]:iy[-1] + 1, ix[0]:ix[-1] + 1]  # netCDF4 masks fill values
        return np.ma.filled(a.astype("float64"), np.nan)

    ds = xr.Dataset(
        {
            "et": (("lat", "lon"), (get("Evap_tavg") * sec).astype("float32")),
            "soil_moisture_0_10cm": (("lat", "lon"), get("SoilMoi0_10cm_inst").astype("float32")),
            "rain_gldas": (("lat", "lon"), (get("Rainf_f_tavg") * sec).astype("float32")),
        },
        coords={"lat": lat[iy], "lon": lon[ix]},
    )
    nc.close()
    ds["et"].attrs = {"units": "mm/month", "long_name": "evapotranspiration (Evap_tavg x seconds in month)"}
    ds["soil_moisture_0_10cm"].attrs = {"units": "mm", "long_name": "soil moisture 0-10 cm (kg m-2)"}
    ds["rain_gldas"].attrs = {"units": "mm/month", "long_name": "GLDAS rainfall forcing (cross-check only)"}
    return _finish(ds.expand_dims(time=[t]))


def read_imerg(path: Path) -> xr.Dataset:
    m = re.search(r"\.(\d{4})(\d{2})01-S", path.name)
    t = np.datetime64(f"{m.group(1)}-{m.group(2)}-01")
    with h5py.File(path, "r") as h:
        g = h["Grid"]
        # coordinates are stored as float32 (0.0999985 steps); round to the nominal 0.1 degree grid
        lat, lon = np.round(g["lat"][:].astype("float64"), 3), np.round(g["lon"][:].astype("float64"), 3)
        iy = np.where((lat >= BBOX["lat_min"]) & (lat <= BBOX["lat_max"]))[0]
        ix = np.where((lon >= BBOX["lon_min"]) & (lon <= BBOX["lon_max"]))[0]

        def get(var):
            d = g[var]
            a = d[0, ix[0]:ix[-1] + 1, iy[0]:iy[-1] + 1].astype("float64").T  # stored (time, lon, lat)
            fill = d.attrs.get("_FillValue")
            if fill is not None:
                a[np.isclose(a, float(np.ravel(fill)[0]))] = np.nan
            return a

        hours = 24 * _days_in_month(t)
        ds = xr.Dataset(
            {
                "precip": (("lat", "lon"), (get("precipitation") * hours).astype("float32")),
                "precip_quality": (("lat", "lon"), get("precipitationQualityIndex").astype("float32")),
            },
            coords={"lat": lat[iy], "lon": lon[ix]},
        )
    ds["precip"].attrs = {"units": "mm/month", "long_name": "IMERG Final precipitation (mm/hr x hours in month)"}
    ds["precip_quality"].attrs = {"long_name": "precipitationQualityIndex (equivalent gauges per 2.5 deg box)"}
    return _finish(ds.expand_dims(time=[t]))


READERS = {
    "MOD13C2": read_mod13c2,
    "MOD11C3": read_mod11c3,
    "GLDAS_NOAH025_M": read_gldas,
    "GPM_3IMERGM": read_imerg,
}
