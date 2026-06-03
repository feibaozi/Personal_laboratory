import asyncio
import itertools
import logging
import numpy as np
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from .vectorized_engine import VectorizedBacktester

logger = logging.getLogger(__name__)


class Optimizer:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def grid_search(
        self,
        base_config: dict,
        param_grid: dict[str, list],
        objective: str = "sharpe_ratio",
        max_trials: int = 30,
        max_concurrency: int = 4,
    ) -> dict:
        param_names = list(param_grid.keys())
        values = list(param_grid.values())
        all_combinations = list(itertools.product(*values))[:max_trials]

        semaphore = asyncio.Semaphore(max_concurrency)

        async def run_trial(idx: int, combo: tuple) -> dict | None:
            async with semaphore:
                trial_config = dict(base_config)
                for name, val in zip(param_names, combo):
                    trial_config[name] = val

                try:
                    engine = VectorizedBacktester(self.db)
                    result = await engine.run(trial_config)
                    if "error" in result:
                        logger.warning(f"Trial {idx} failed: {result['error']}")
                        return None

                    metrics = result.get("summary", {})
                    score = self._extract_objective(metrics, objective)

                    return {
                        "trial": idx,
                        "params": dict(zip(param_names, combo)),
                        "score": round(score, 4),
                        "metrics": {
                            "sharpe_ratio": round(metrics.get("sharpe", 0), 4),
                            "annual_return": round(metrics.get("annual_return", 0), 4),
                            "max_drawdown": round(metrics.get("max_drawdown", 0), 4),
                            "win_rate": round(metrics.get("win_rate", 0), 4),
                            "total_return": round(metrics.get("total_return", 0), 4),
                        },
                    }
                except Exception as e:
                    logger.warning(f"Trial {idx} error: {e}")
                    return None

        trial_results = await asyncio.gather(*[
            run_trial(i + 1, combo) for i, combo in enumerate(all_combinations)
        ])

        results = [r for r in trial_results if r is not None]
        best_trial = max(results, key=lambda r: r["score"]) if results else None

        return {
            "param_grid": param_grid,
            "objective": objective,
            "n_trials": len(results),
            "best": best_trial,
            "results": results,
        }

    async def walk_forward_analysis(
        self,
        base_config: dict,
        train_window: int = 252,
        test_window: int = 63,
        objective: str = "sharpe_ratio",
        param_grid: dict[str, list] | None = None,
        anchored: bool = False,
        max_trials_per_window: int = 20,
    ) -> dict:
        start = date.fromisoformat(base_config["start_date"])
        end = date.fromisoformat(base_config["end_date"])
        total_days = (end - start).days
        if total_days < train_window + test_window:
            return {"error": "Insufficient data range for WFA", "windows": []}

        windows = []
        test_results = []
        all_best_params = []
        window_start = start
        anchored_start = start

        while window_start + timedelta(days=train_window + test_window) <= end:
            if anchored:
                train_start = anchored_start
            else:
                train_start = window_start
            train_end = window_start + timedelta(days=train_window)
            test_end = train_end + timedelta(days=test_window)

            train_config = dict(base_config)
            train_config["start_date"] = train_start.isoformat()
            train_config["end_date"] = train_end.isoformat()

            best_params = None
            best_score = -float("inf")

            if param_grid:
                try:
                    gs_result = await self.grid_search(
                        train_config, param_grid, objective, max_trials_per_window
                    )
                    if gs_result.get("best") and gs_result["best"].get("params"):
                        best_params = gs_result["best"]["params"]
                        best_score = gs_result["best"]["score"]
                except Exception as e:
                    logger.warning(f"WFA grid_search error: {e}")
            else:
                try:
                    engine = VectorizedBacktester(self.db)
                    train_result = await engine.run(train_config)
                    train_metrics = train_result.get("summary", {})
                    best_score = self._extract_objective(train_metrics, objective)
                except Exception as e:
                    logger.warning(f"WFA train error: {e}")

            test_config = dict(base_config)
            if best_params:
                for k, v in best_params.items():
                    test_config[k] = v
            test_config["start_date"] = train_end.isoformat()
            test_config["end_date"] = test_end.isoformat()

            try:
                engine = VectorizedBacktester(self.db)
                test_result = await engine.run(test_config)
                test_metrics = test_result.get("summary", {})

                test_results.append({
                    "train_period": f"{train_start.isoformat()} ~ {train_end.isoformat()}",
                    "test_period": f"{train_end.isoformat()} ~ {test_end.isoformat()}",
                    "train_score": round(best_score, 4),
                    "test_sharpe": round(test_metrics.get("sharpe", 0), 4),
                    "test_return": round(test_metrics.get("annual_return", 0), 4),
                    "test_drawdown": round(test_metrics.get("max_drawdown", 0), 4),
                    "best_params": best_params,
                })

                if best_params:
                    all_best_params.append(best_params)

                windows.append({
                    "train_start": train_start.isoformat(),
                    "train_end": train_end.isoformat(),
                    "test_start": train_end.isoformat(),
                    "test_end": test_end.isoformat(),
                    "best_params": best_params,
                })
            except Exception as e:
                logger.warning(f"WFA test error: {e}")

            window_start += timedelta(days=test_window)

        if not test_results:
            return {"error": "No valid WFA windows", "windows": []}

        test_sharpes = [w["test_sharpe"] for w in test_results]
        test_returns = [w["test_return"] for w in test_results]
        train_scores = [w["train_score"] for w in test_results]

        param_stability = self._compute_param_stability(all_best_params)

        oos_sharpes = [s for s in test_sharpes if not np.isnan(s)]
        is_sharpes = [s for s in train_scores if not np.isnan(s)]
        overfit_ratio = 0.0
        if oos_sharpes and is_sharpes:
            avg_is = float(np.mean(is_sharpes))
            avg_oos = float(np.mean(oos_sharpes))
            if avg_is != 0:
                overfit_ratio = round(avg_oos / avg_is, 4)

        return {
            "train_window": train_window,
            "test_window": test_window,
            "objective": objective,
            "anchored": anchored,
            "n_windows": len(windows),
            "windows": windows,
            "results": test_results,
            "summary": {
                "avg_test_sharpe": round(float(np.mean(test_sharpes)), 4) if test_sharpes else 0,
                "std_test_sharpe": round(float(np.std(test_sharpes, ddof=1)), 4) if len(test_sharpes) > 1 else 0,
                "avg_test_return": round(float(np.mean(test_returns)), 4) if test_returns else 0,
                "std_test_return": round(float(np.std(test_returns, ddof=1)), 4) if len(test_returns) > 1 else 0,
                "positive_windows": sum(1 for s in test_sharpes if s > 0),
                "win_rate": round(sum(1 for s in test_sharpes if s > 0) / len(test_sharpes), 4) if test_sharpes else 0,
                "overfit_ratio": overfit_ratio,
                "param_stability": param_stability,
            },
        }

    def _compute_param_stability(self, all_best_params: list[dict]) -> dict:
        if not all_best_params:
            return {}

        param_keys = set()
        for p in all_best_params:
            param_keys.update(p.keys())

        stability = {}
        for key in param_keys:
            values = [p[key] for p in all_best_params if key in p]
            if not values:
                continue
            unique = set(str(v) for v in values)
            stability[key] = {
                "values": [str(v) for v in values],
                "unique_count": len(unique),
                "consistency": round(1 - (len(unique) - 1) / max(len(values), 1), 4),
                "most_frequent": max(unique, key=lambda x: sum(1 for v in values if str(v) == x)),
            }
        return stability

    def _extract_objective(self, metrics: dict, objective: str) -> float:
        mapping = {
            "sharpe_ratio": metrics.get("sharpe", 0),
            "sortino_ratio": metrics.get("sortino", 0),
            "annual_return": metrics.get("annual_return", 0),
            "total_return": metrics.get("total_return", 0),
            "calmar_ratio": metrics.get("calmar", 0),
            "return_over_drawdown": -abs(metrics.get("max_drawdown", 0)) if metrics.get("annual_return", 0) != 0 else 0,
        }
        return float(mapping.get(objective, metrics.get("sharpe", 0)))
