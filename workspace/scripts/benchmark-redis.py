"""Compare public Transport endpoints with Redis on and off through local YARP."""

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import http.client
import json
import math
import os
from pathlib import Path
import random
import subprocess
import threading
import time
from urllib.parse import urlencode
import uuid
from zoneinfo import ZoneInfo

VIETNAM = ZoneInfo("Asia/Ho_Chi_Minh")


def docker(*args, env=None):
    return subprocess.check_output(["docker", *args], text=True, env=env).strip()


def inspect(name):
    return json.loads(docker("inspect", name))[0]


def payload(path, port):
    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    try:
        connection.request("GET", path)
        response = connection.getresponse()
        if response.status != 200:
            raise RuntimeError(f"{path} returned HTTP {response.status}")
        return json.loads(response.read())
    finally:
        connection.close()


def wait_for_transport(port):
    until = time.monotonic() + 30
    while time.monotonic() < until:
        try:
            payload("/api/v1/trips?passengerCount=1&size=1", port)
            return
        except (OSError, RuntimeError):
            time.sleep(0.5)
    raise RuntimeError(f"Temporary Gateway on port {port} did not reach Transport")


def search(**filters):
    return "/api/v1/trips?" + urlencode({"passengerCount": 1, **filters})


def workloads(port):
    catalogue = payload(search(size=100, sort="DEPARTURE_ASC"), port)["items"]
    pairs = list(dict.fromkeys(
        (trip["origin"], trip["destination"],
         datetime.fromisoformat(trip["departureAt"]).astimezone(VIETNAM).date().isoformat())
        for trip in catalogue
    ))
    if len(pairs) < 4:
        raise RuntimeError("Expected at least four real route/date filters")
    explore = "/api/v1/explore/routes"
    hot = [search(origin=a, destination=b, departureDate=day, size=20)
           for a, b, day in pairs[:6]]
    hot.extend([search(size=20), search(size=50), explore, explore])
    varied = list(dict.fromkeys(
        search(origin=a, destination=b, departureDate=day, size=size, sort=sort, page=page)
        for a, b, day in pairs
        for size in (10, 20)
        for sort in ("DEPARTURE_ASC", "PRICE_ASC", "DURATION_ASC")
        for page in (0, 1)
    ))
    return {"repeated": hot, "mixed": varied + [explore] * max(1, len(varied) // 9)}


def redis_hits(name):
    # The isolated cache has no writes to the generation key. Its lookups miss,
    # so keyspace_hits counts only successful cache entry reads.
    generation = docker("exec", name, "redis-cli", "EXISTS", "blue:transport:public:v1:generation")
    if generation != "0":
        raise RuntimeError("Unexpected invalidation during the read-only benchmark")
    lines = docker("exec", name, "redis-cli", "INFO", "stats").splitlines()
    return int(next(line.split(":")[1] for line in lines if line.startswith("keyspace_hits:")))


def exercise(port, paths, rate, seconds):
    state = threading.local()
    slots = threading.BoundedSemaphore(16)
    connections = []

    def request(path, scheduled):
        started = time.perf_counter()
        try:
            if not hasattr(state, "connection"):
                state.connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
                connections.append(state.connection)
            state.connection.request("GET", path)
            response = state.connection.getresponse()
            response.read()
            return round((time.perf_counter() - started) * 1000, 3), response.status, (started - scheduled) * 1000
        except (OSError, http.client.HTTPException):
            if hasattr(state, "connection"):
                state.connection.close()
            return 0, 0, (started - scheduled) * 1000
        finally:
            slots.release()

    count = rate * seconds
    dropped = 0
    with ThreadPoolExecutor(max_workers=16) as pool:
        start = time.perf_counter()
        pending = []
        for i in range(count):
            due = start + i / rate
            remaining = due - time.perf_counter()
            if remaining > 0:
                time.sleep(remaining)
            if slots.acquire(blocking=False):
                pending.append(pool.submit(request, paths[i % len(paths)], due))
            else:
                dropped += 1
        values = [future.result() for future in pending]
    for connection in connections:
        connection.close()
    duration = max(seconds, time.perf_counter() - start)
    return values, count, dropped, duration


def percentile(values, fraction):
    if not values:
        return None
    return round(values[max(0, math.ceil(len(values) * fraction) - 1)], 2)


def summarize(values, count, dropped, duration, hits):
    latency = sorted(ms for ms, status, _ in values if status == 200)
    lag = sorted(lag for _, _, lag in values)
    return {
        "scheduled": count,
        "successful": len(latency),
        "errors": len(values) - len(latency),
        "dropped": dropped,
        "successful_rps": round(len(latency) / duration, 2),
        "p50_ms": percentile(latency, 0.5),
        "p95_ms": percentile(latency, 0.95),
        "p99_ms": percentile(latency, 0.99),
        "generator_p95_lag_ms": percentile(lag, 0.95),
        "cache_hits": hits,
        "cache_hit_pct": round(hits / count * 100, 2),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rate", type=int, default=25, help="Offered requests per second")
    parser.add_argument("--seconds", type=int, default=15, help="Measured seconds per round")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if args.rate < 1 or args.seconds < 1:
        parser.error("Rate and measured seconds must be positive")
    transport = inspect("pbl6-local-transport-1")
    gateway = inspect("pbl6-local-gateway-1")
    network, = gateway["NetworkSettings"]["Networks"]
    if network not in transport["NetworkSettings"]["Networks"]:
        raise RuntimeError("Gateway and Transport must share the local Docker network")
    env = os.environ.copy()
    env["ConnectionStrings__Transport"] = next(
        value.split("=", 1)[1] for value in transport["Config"]["Env"]
        if value.startswith("ConnectionStrings__Transport=")
    )
    prefix = "pbl6-redis-bench-" + uuid.uuid4().hex[:8]
    containers = []

    def start(name, *params, env=None):
        name = f"{prefix}-{name}"
        # Assign before launch so a failed start can still be cleaned up.
        containers.append(name)
        docker("run", "-d", "--name", name, "--network", network, *params, env=env)
        return name

    modes = ("postgres", "redis")
    try:
        redis = start("cache", "redis:7-alpine", "redis-server", "--maxmemory", "64mb",
                      "--maxmemory-policy", "volatile-lru")
        ports = {}
        for mode in modes:
            api = start(
                f"api-{mode}", "-e", "ConnectionStrings__Transport", "-e",
                "ConnectionStrings__Redis=" + (f"{redis}:6379" if mode == "redis" else ""),
                "-e", "Logging__LogLevel__Default=Warning", "-e", "Messaging__AmqpUri=",
                transport["Image"], "BusTicketPlatform.Transport.Api.dll", env=env,
            )
            proxy = start(
                f"gateway-{mode}", "-p", "127.0.0.1::8080", "-e", "Logging__LogLevel__Default=Warning",
                "-e", f"ReverseProxy__Clusters__transport__Destinations__transport-local__Address=http://{api}:8080/",
                gateway["Image"], "BusTicketPlatform.Gateway.dll",
            )
            ports[mode] = int(docker("port", proxy, "8080/tcp").rsplit(":", 1)[1])
            wait_for_transport(ports[mode])

        mixes = workloads(ports["postgres"])
        report = {
            "measured_at_vietnam": datetime.now(VIETNAM).isoformat(),
            "transport_image": transport["Image"],
            "gateway_image": gateway["Image"],
            "offered_rps": args.rate,
            "seconds_per_round": args.seconds,
            "max_concurrency": 16,
            "corpus_size": {mix: len(set(paths)) for mix, paths in mixes.items()},
            "rounds": [],
            "combined": {},
        }
        for mix, paths in mixes.items():
            for sample in paths[:3] + ["/api/v1/explore/routes"]:
                left, right = (payload(sample, ports[mode]) for mode in modes)
                for result in (left, right):
                    if isinstance(result, dict):
                        for item in result["items"]:
                            item.pop("availabilityAsOf", None)
                if left != right:
                    raise RuntimeError(f"Responses differ for {sample}")
            phases = {mode: [] for mode in modes}
            for round_number, order in enumerate((modes, modes[::-1]), 1):
                sequence = paths.copy()
                random.Random(round_number).shuffle(sequence)
                for mode in order:
                    exercise(ports[mode], sequence, args.rate, 4)
                    before = redis_hits(redis) if mode == "redis" else 0
                    measured = exercise(ports[mode], sequence, args.rate, args.seconds)
                    hits = redis_hits(redis) - before if mode == "redis" else 0
                    stats = summarize(*measured, hits)
                    phases[mode].append((*measured, hits))
                    row = {"workload": mix, "round": round_number, "mode": mode, **stats}
                    report["rounds"].append(row)
                    print(json.dumps(row), flush=True)
            report["combined"][mix] = {
                mode: summarize(
                    [value for values, *_ in phase for value in values],
                    *(sum(part[column] for part in phase) for column in range(1, 5)),
                )
                for mode, phase in phases.items()
            }
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    finally:
        for name in reversed(containers):
            subprocess.run(["docker", "rm", "-f", name], capture_output=True)


if __name__ == "__main__":
    main()
