"""
Pharmacokinetic Pain Correction (PCPS).
One-compartment PK model applied to raw pain scores.
Higher PCPS = more concerning (patient in pain despite high drug efficacy).
"""
import math
from typing import Optional

from backend.utils.logger import get_logger

log = get_logger(__name__)

# Drug PK profiles: tmax_h=time to peak, t_half_h=half-life, bioavailability
DRUG_PK_PROFILES: dict[str, dict] = {
    "tramadol":    {"tmax_h": 2.0,  "t_half_h": 5.5,  "bioavailability": 0.75},
    "ibuprofen":   {"tmax_h": 1.5,  "t_half_h": 2.0,  "bioavailability": 0.80},
    "paracetamol": {"tmax_h": 0.75, "t_half_h": 2.5,  "bioavailability": 0.90},
    "morphine":    {"tmax_h": 1.0,  "t_half_h": 3.0,  "bioavailability": 0.35},
    "codeine":     {"tmax_h": 1.5,  "t_half_h": 3.5,  "bioavailability": 0.70},
    "naproxen":    {"tmax_h": 2.5,  "t_half_h": 14.0, "bioavailability": 0.95},
    "celecoxib":   {"tmax_h": 3.0,  "t_half_h": 11.0, "bioavailability": 0.73},
}


def _pk_concentration_ratio(hours: float, profile: dict) -> float:
    """
    Estimate fractional plasma concentration relative to peak using
    a simplified one-compartment absorption-elimination model.
    Returns 0–1 (1.0 = at peak, 0.0 = fully eliminated).
    """
    tmax = profile["tmax_h"]
    t_half = profile["t_half_h"]
    ke = math.log(2) / t_half      # elimination rate constant
    ka = math.log(2) / (tmax / 2)  # absorption approximation

    if hours <= 0:
        return 0.0  # just took it — absorption not started

    concentration = (ka / (ka - ke)) * (math.exp(-ke * hours) - math.exp(-ka * hours))
    peak = (ka / (ka - ke)) * (math.exp(-ke * tmax) - math.exp(-ka * tmax))

    ratio = concentration / peak if peak > 0 else 0.0
    return max(0.0, min(1.0, ratio))


def compute_pcps(
    raw_pain_score: float,
    drug: str,
    hours_since_dose: float,
) -> tuple[float, bool]:
    """
    Returns (pcps, pk_corrected).
    pcps is pharmacokinetically-corrected pain severity (0–10).
    pk_corrected=False means the drug was not in the library — raw score returned.
    """
    drug_key = drug.lower().strip()
    profile = DRUG_PK_PROFILES.get(drug_key)

    if not profile:
        log.warning(f"Drug '{drug}' not in PK library — returning raw score uncorrected")
        return round(float(raw_pain_score), 2), False

    concentration_ratio = _pk_concentration_ratio(hours_since_dose, profile)

    # At peak efficacy (ratio→1.0), raw pain is most meaningful.
    # At trough (ratio→0), raw pain is expected to be higher — correct downward.
    # A high score at peak is a crisis; a high score at trough is expected.
    correction_factor = 1.0 + (1.0 - concentration_ratio) * 0.4
    pcps = raw_pain_score / correction_factor

    log.debug(
        f"PCPS: drug={drug} hours={hours_since_dose:.1f} "
        f"conc_ratio={concentration_ratio:.2f} raw={raw_pain_score} pcps={pcps:.2f}"
    )
    return round(pcps, 2), True
