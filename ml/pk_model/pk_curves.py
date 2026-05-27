"""Pharmacokinetic curve library — drug profiles for PK model."""

DRUG_PK_PROFILES = {
    "tramadol":    {"tmax_h": 2.0,  "t_half_h": 5.5,  "bioavailability": 0.75},
    "ibuprofen":   {"tmax_h": 1.5,  "t_half_h": 2.0,  "bioavailability": 0.80},
    "paracetamol": {"tmax_h": 0.75, "t_half_h": 2.5,  "bioavailability": 0.90},
    "morphine":    {"tmax_h": 1.0,  "t_half_h": 3.0,  "bioavailability": 0.35},
    "codeine":     {"tmax_h": 1.5,  "t_half_h": 3.5,  "bioavailability": 0.70},
    "naproxen":    {"tmax_h": 2.5,  "t_half_h": 14.0, "bioavailability": 0.95},
    "celecoxib":   {"tmax_h": 3.0,  "t_half_h": 11.0, "bioavailability": 0.73},
}
