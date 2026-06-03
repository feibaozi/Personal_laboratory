from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Awaitable


@dataclass
class Factor:
    name: str
    category: str
    description: str
    compute_fn: Callable[..., Awaitable[dict[str, float]]]
    required_data: list[str] = field(default_factory=lambda: ["prices"])
    default_params: dict = field(default_factory=dict)


class FactorRegistry:
    def __init__(self):
        self._factors: dict[str, Factor] = {}

    def register(self, factor: Factor) -> None:
        if factor.name in self._factors:
            raise ValueError(f"Factor '{factor.name}' already registered")
        self._factors[factor.name] = factor

    def get(self, name: str) -> Factor | None:
        return self._factors.get(name)

    def all(self) -> dict[str, Factor]:
        return dict(self._factors)

    def names(self) -> list[str]:
        return list(self._factors.keys())

    def by_category(self, category: str) -> dict[str, Factor]:
        return {n: f for n, f in self._factors.items() if f.category == category}

    def categories(self) -> list[str]:
        seen = []
        for f in self._factors.values():
            if f.category not in seen:
                seen.append(f.category)
        return seen

    def required_data_for(self, names: list[str]) -> set[str]:
        data = set()
        for n in names:
            f = self._factors.get(n)
            if f:
                data.update(f.required_data)
        return data

    def register_parametric(
        self,
        base_name: str,
        category: str,
        description_template: str,
        compute_fn_factory: Callable[[dict], Callable[..., Awaitable[dict[str, float]]]],
        param_name: str,
        param_values: list,
        required_data: list[str] | None = None,
    ) -> None:
        for pv in param_values:
            name = f"{base_name}_{pv}"
            params = {param_name: pv}
            fn = compute_fn_factory(params)
            desc = description_template.format(**{param_name: pv})
            self.register(Factor(
                name=name,
                category=category,
                description=desc,
                compute_fn=fn,
                required_data=required_data or ["prices"],
                default_params=params,
            ))


_global_registry = FactorRegistry()


def get_registry() -> FactorRegistry:
    return _global_registry


def register_factor(
    name: str,
    category: str,
    description: str,
    required_data: list[str] | None = None,
    default_params: dict | None = None,
):
    def decorator(fn: Callable[..., Awaitable[dict[str, float]]]):
        _global_registry.register(Factor(
            name=name,
            category=category,
            description=description,
            compute_fn=fn,
            required_data=required_data or ["prices"],
            default_params=default_params or {},
        ))
        return fn
    return decorator
