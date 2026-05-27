"""
Federated Learning Simulation (Flower-based concept, simulated locally).
Demonstrates privacy-preserving cross-hospital model updates.
0 bytes of patient data transferred between nodes.
"""
import copy
import random
from typing import Optional

from pydantic import BaseModel

from backend.utils.logger import get_logger

log = get_logger(__name__)


# ── Simulated model weight state ──────────────────────────────────────────────
_NODE_WEIGHTS: dict[str, list[float]] = {
    "NodeA": [0.1, 0.25, 0.18, 0.32, 0.15],
    "NodeB": [0.12, 0.23, 0.20, 0.30, 0.15],
    "NodeC": [0.09, 0.26, 0.19, 0.31, 0.15],
}

_ROUNDS_COMPLETED = 0
_BYTES_TRANSFERRED = 0  # stays 0 — federated means no raw data leaves nodes


class FederatedRoundResult(BaseModel):
    rounds_completed: int
    nodes_updated: int
    bytes_patient_data_transferred: int
    weights_snapshot: dict[str, list[float]]
    new_pattern_injected_at: str
    status: str


def _federated_average(weights_list: list[list[float]]) -> list[float]:
    """Simple federated averaging (FedAvg) across model weight vectors."""
    n = len(weights_list)
    return [sum(w[i] for w in weights_list) / n for i in range(len(weights_list[0]))]


def _retrain_local(weights: list[float], hospital: str) -> list[float]:
    """
    Simulate local retraining at a hospital node with new complication pattern data.
    In production: actual Flower client.fit() call.
    """
    updated = [w + random.uniform(-0.02, 0.06) for w in weights]  # simulate gradient step
    log.info(f"[Federated] Local retraining simulated at {hospital}")
    return updated


def simulate_federated_round(new_pattern_hospital: str = "NodeA") -> FederatedRoundResult:
    """
    Simulate one federated averaging round across 3 hospital nodes.
    NodeA gets new complication pattern data → retrain locally → FedAvg → broadcast.
    No patient data leaves any node.
    """
    global _ROUNDS_COMPLETED, _BYTES_TRANSFERRED

    current_weights = copy.deepcopy(_NODE_WEIGHTS)

    # Step 1: Inject new pattern at the target node only
    updated_node = _retrain_local(current_weights[new_pattern_hospital], new_pattern_hospital)
    current_weights[new_pattern_hospital] = updated_node

    # Step 2: Federated averaging — only gradient/weight vectors shared, not data
    aggregated = _federated_average(list(current_weights.values()))

    # Step 3: Broadcast aggregated weights to all nodes
    for node in _NODE_WEIGHTS:
        _NODE_WEIGHTS[node] = [round(w, 4) for w in aggregated]

    _ROUNDS_COMPLETED += 1
    # _BYTES_TRANSFERRED stays 0 — federated guarantee

    log.info(
        f"[Federated] Round {_ROUNDS_COMPLETED} complete — "
        f"3 nodes updated — 0 bytes patient data transferred"
    )

    return FederatedRoundResult(
        rounds_completed=_ROUNDS_COMPLETED,
        nodes_updated=3,
        bytes_patient_data_transferred=0,
        weights_snapshot=copy.deepcopy(_NODE_WEIGHTS),
        new_pattern_injected_at=new_pattern_hospital,
        status="success",
    )


def get_network_status() -> dict:
    """Returns current federated network status for dashboard display."""
    return {
        "nodes": [
            {"id": k, "status": "online", "weights": v[:3]}
            for k, v in _NODE_WEIGHTS.items()
        ],
        "rounds_completed": _ROUNDS_COMPLETED,
        "bytes_patient_data_transferred": 0,
        "simulation_mode": True,
    }
