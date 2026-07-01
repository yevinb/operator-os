"""Plan limits — gate premium features by subscription tier."""

PLAN_LIMITS: dict[str, dict] = {
    "starter": {
        "autopilot_modes": ["growth", "sales"],
        "max_integrations": 5,
        "label": "Starter",
    },
    "pro": {
        "autopilot_modes": ["growth", "sales", "ops", "full"],
        "max_integrations": 20,
        "label": "Pro",
    },
    "enterprise": {
        "autopilot_modes": ["growth", "sales", "ops", "full"],
        "max_integrations": 999,
        "label": "Enterprise",
    },
}


def get_plan_limits(plan: str) -> dict:
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["starter"])


def can_run_autopilot_mode(plan: str, mode: str) -> bool:
    return mode in get_plan_limits(plan).get("autopilot_modes", [])
