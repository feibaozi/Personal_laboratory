import numpy as np


def brinson_attribution(
    portfolio_weights: dict[str, float],
    portfolio_returns: dict[str, float],
    benchmark_weights: dict[str, float],
    benchmark_returns: dict[str, float],
    sectors: dict[str, str],
) -> dict:
    all_sectors = set(sectors.values())

    port_sector_weights = {}
    port_sector_returns = {}
    for code, w in portfolio_weights.items():
        sec = sectors.get(code, "Unknown")
        port_sector_weights[sec] = port_sector_weights.get(sec, 0) + w
        if sec not in port_sector_returns:
            port_sector_returns[sec] = 0
        port_sector_returns[sec] += w * portfolio_returns.get(code, 0)

    bm_sector_weights = {}
    bm_sector_returns = {}
    for code, w in benchmark_weights.items():
        sec = sectors.get(code, "Unknown")
        bm_sector_weights[sec] = bm_sector_weights.get(sec, 0) + w
        if sec not in bm_sector_returns:
            bm_sector_returns[sec] = 0
        bm_sector_returns[sec] += w * benchmark_returns.get(code, 0)

    for sec in all_sectors:
        if sec not in port_sector_weights:
            port_sector_weights[sec] = 0
            port_sector_returns[sec] = 0
        if sec not in bm_sector_weights:
            bm_sector_weights[sec] = 0
            bm_sector_returns[sec] = 0

    total_allocation = 0.0
    total_selection = 0.0
    total_interaction = 0.0
    sector_details = []

    for sec in sorted(all_sectors):
        pw = port_sector_weights.get(sec, 0)
        bw = bm_sector_weights.get(sec, 0)
        pr = port_sector_returns.get(sec, 0) / pw if pw > 0 else 0
        br = bm_sector_returns.get(sec, 0) / bw if bw > 0 else 0

        allocation = (pw - bw) * br
        selection = bw * (pr - br)
        interaction = (pw - bw) * (pr - br)

        total_allocation += allocation
        total_selection += selection
        total_interaction += interaction

        sector_details.append({
            "sector": sec,
            "portfolio_weight": round(pw, 4),
            "benchmark_weight": round(bw, 4),
            "portfolio_return": round(pr, 4),
            "benchmark_return": round(br, 4),
            "allocation_effect": round(allocation, 6),
            "selection_effect": round(selection, 6),
            "interaction_effect": round(interaction, 6),
            "total_effect": round(allocation + selection + interaction, 6),
        })

    port_total = sum(
        w * portfolio_returns.get(c, 0) for c, w in portfolio_weights.items()
    )
    bm_total = sum(
        w * benchmark_returns.get(c, 0) for c, w in benchmark_weights.items()
    )
    excess = port_total - bm_total

    return {
        "excess_return": round(excess, 6),
        "allocation_effect": round(total_allocation, 6),
        "selection_effect": round(total_selection, 6),
        "interaction_effect": round(total_interaction, 6),
        "attribution_check": round(total_allocation + total_selection + total_interaction, 6),
        "sector_details": sector_details,
    }


def simple_factor_attribution(
    daily_returns: list[float],
    benchmark_returns: list[float],
    factor_returns: dict[str, list[float]] | None = None,
) -> dict:
    pr = np.array(daily_returns)
    br = np.array(benchmark_returns)
    min_len = min(len(pr), len(br))
    if min_len < 20:
        return {"factors": [], "r_squared": 0}

    pr = pr[-min_len:]
    br = br[-min_len:]

    excess = pr - br
    avg_excess = float(np.mean(excess) * 252)

    from scipy import stats as sp_stats
    slope, intercept, r_value, _, _ = sp_stats.linregress(br, pr)
    beta = float(slope)
    alpha = float(intercept * 252)
    residual = pr - (intercept + slope * br)
    idio_vol = float(np.std(residual, ddof=1) * np.sqrt(252))

    factor_results = [
        {
            "factor": "Market",
            "beta": round(beta, 4),
            "contribution": round(float(slope * np.mean(br) * 252), 6),
        },
        {
            "factor": "Alpha",
            "beta": round(alpha, 4),
            "contribution": round(alpha, 6),
        },
    ]

    if factor_returns:
        for fname, fret in factor_returns.items():
            fr = np.array(fret[-min_len:])
            if len(fr) >= min_len:
                s2, i2, _, _, _ = sp_stats.linregress(fr, excess)
                factor_results.append({
                    "factor": fname,
                    "beta": round(float(s2), 4),
                    "contribution": round(float(i2 + s2 * np.mean(fr)) * 252, 6),
                })

    return {
        "excess_return": round(avg_excess, 6),
        "alpha_annual": round(alpha, 6),
        "beta": round(beta, 4),
        "idiosyncratic_vol": round(idio_vol, 4),
        "r_squared": round(float(r_value ** 2), 4),
        "factors": factor_results,
    }
