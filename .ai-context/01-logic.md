# 1. Logic

## Goal

Challenge *Be An Earth System Trend Detective!* (NASA Space Apps 2026): find long-term trends in Earth system
variables from NASA data, and separate real change from noise. One-off events are out of scope.

## Team decisions

| Date | Decision | Decided by |
|---|---|---|
| 2026-11-14 | **Problem:** where the Amazon forest is losing greenness and warming in a sustained way, and whether that change is statistically significant or just noise | Team (José, Alexis, Kiara) |
| 2026-11-14 | **Region:** the Amazon as one natural region, defined by geography and not by countries or administrative regions | Team |

**Context.** The Amazon spans nine countries and faces deforestation, degradation, fires and recent extreme
droughts. Treating it as one region shows the change wherever it happens, across borders.

**Limits to state openly.** A downward trend in greenness shows *where to look*. It does not prove deforestation,
and it does not establish a cause.

**Candidate variables** (to be confirmed by the data exploration):

- Vegetation greenness: NDVI and EVI (`MOD13C2`).
- Land surface temperature (`MOD11C3`).
- Evapotranspiration and soil moisture (GLDAS).
- Precipitation (GPM IMERG).

## Method

**Not decided yet.** The team chooses the statistical method. Under the Space Apps AI rule, the AI assistant does
not propose how to solve the challenge: this tab only records what the team decides.

When decided, record here: the preprocessing, the statistical tests and their assumptions, how significance is
controlled across many locations, and the invariants the code must keep.
