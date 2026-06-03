"""Progress tracking and cancellation for backtest runs."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class ProgressState:
    run_id: str
    status: str = "running"  # running | done | error | cancelled
    step: str = ""  # Current step description
    progress: float = 0.0  # 0.0 - 1.0
    total_steps: int = 0
    current_step: int = 0
    started_at: datetime | None = None
    message: str = ""


# P7.3.3: Auto-cleanup timeout in seconds
_CLEANUP_TIMEOUT = 300  # 5 minutes


class ProgressTracker:
    """Global progress tracker for backtest runs.

    P7.3.3: Auto-cleanup after completion to prevent memory leaks.
    """

    _instances: dict[str, ProgressState] = {}
    _cancel_events: dict[str, asyncio.Event] = {}
    _queues: dict[str, asyncio.Queue] = {}
    _cleanup_tasks: dict[str, asyncio.Task] = {}

    @classmethod
    def create(cls, run_id: str) -> asyncio.Event:
        cls._instances[run_id] = ProgressState(
            run_id=run_id,
            status="running",
            started_at=datetime.now(),
        )
        cls._cancel_events[run_id] = asyncio.Event()
        cls._queues[run_id] = asyncio.Queue()
        return cls._cancel_events[run_id]

    @classmethod
    def update(cls, run_id: str, step: str = "", progress: float = -1,
               current_step: int = -1, total_steps: int = -1, message: str = ""):
        state = cls._instances.get(run_id)
        if not state:
            return
        if step:
            state.step = step
        if progress >= 0:
            state.progress = progress
        if current_step >= 0:
            state.current_step = current_step
        if total_steps >= 0:
            state.total_steps = total_steps
        if message:
            state.message = message

        # Push to queue for SSE
        queue = cls._queues.get(run_id)
        if queue:
            try:
                queue.put_nowait(cls._serialize(state))
            except asyncio.QueueFull:
                pass

    @classmethod
    def complete(cls, run_id: str, status: str = "done"):
        state = cls._instances.get(run_id)
        if state:
            state.status = status
            state.progress = 1.0
        queue = cls._queues.get(run_id)
        if queue:
            try:
                queue.put_nowait(cls._serialize(state))
            except asyncio.QueueFull:
                pass

        # P7.3.3: Schedule auto-cleanup after timeout
        cls._schedule_cleanup(run_id)

    @classmethod
    def get_state(cls, run_id: str) -> ProgressState | None:
        return cls._instances.get(run_id)

    @classmethod
    def is_cancelled(cls, run_id: str) -> bool:
        event = cls._cancel_events.get(run_id)
        return event.is_set() if event else False

    @classmethod
    def cancel(cls, run_id: str):
        event = cls._cancel_events.get(run_id)
        if event:
            event.set()
        state = cls._instances.get(run_id)
        if state:
            state.status = "cancelled"

    @classmethod
    def get_queue(cls, run_id: str) -> asyncio.Queue | None:
        return cls._queues.get(run_id)

    @classmethod
    def cleanup(cls, run_id: str):
        cls._instances.pop(run_id, None)
        cls._cancel_events.pop(run_id, None)
        cls._queues.pop(run_id, None)
        # Cancel any pending cleanup task
        task = cls._cleanup_tasks.pop(run_id, None)
        if task and not task.done():
            task.cancel()

    @classmethod
    def _schedule_cleanup(cls, run_id: str):
        """Schedule automatic cleanup after _CLEANUP_TIMEOUT seconds."""
        # Cancel existing cleanup task if any
        existing = cls._cleanup_tasks.pop(run_id, None)
        if existing and not existing.done():
            existing.cancel()

        async def _delayed_cleanup():
            try:
                await asyncio.sleep(_CLEANUP_TIMEOUT)
                cls.cleanup(run_id)
            except asyncio.CancelledError:
                pass

        try:
            loop = asyncio.get_running_loop()
            cls._cleanup_tasks[run_id] = loop.create_task(_delayed_cleanup())
        except RuntimeError:
            # No running loop, cleanup immediately
            cls.cleanup(run_id)

    @staticmethod
    def _serialize(state: ProgressState) -> dict:
        return {
            "run_id": state.run_id,
            "status": state.status,
            "step": state.step,
            "progress": state.progress,
            "total_steps": state.total_steps,
            "current_step": state.current_step,
            "message": state.message,
        }
