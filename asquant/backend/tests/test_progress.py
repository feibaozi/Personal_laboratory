"""Unit tests for ProgressTracker."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.engine.progress_tracker import ProgressTracker, ProgressState


def test_create_and_get_state():
    """Create a tracker and verify initial state."""
    run_id = "test_run_1"
    ProgressTracker.create(run_id)

    state = ProgressTracker.get_state(run_id)
    assert state is not None
    assert state.run_id == run_id
    assert state.status == "running"
    assert state.progress == 0.0

    ProgressTracker.cleanup(run_id)


def test_update_progress():
    """Update progress and verify state changes."""
    run_id = "test_run_2"
    ProgressTracker.create(run_id)

    ProgressTracker.update(run_id, step="loading", progress=0.3, current_step=1, total_steps=10)
    state = ProgressTracker.get_state(run_id)
    assert state.step == "loading"
    assert state.progress == 0.3
    assert state.current_step == 1
    assert state.total_steps == 10

    ProgressTracker.cleanup(run_id)


def test_cancel():
    """Cancel a run and verify state."""
    run_id = "test_run_3"
    ProgressTracker.create(run_id)

    assert not ProgressTracker.is_cancelled(run_id)

    ProgressTracker.cancel(run_id)
    assert ProgressTracker.is_cancelled(run_id)

    state = ProgressTracker.get_state(run_id)
    assert state.status == "cancelled"

    ProgressTracker.cleanup(run_id)


def test_complete():
    """Complete a run and verify progress=1.0."""
    run_id = "test_run_4"
    ProgressTracker.create(run_id)

    ProgressTracker.complete(run_id, "done")
    state = ProgressTracker.get_state(run_id)
    assert state.status == "done"
    assert state.progress == 1.0

    ProgressTracker.cleanup(run_id)


def test_queue_push():
    """Verify that updates are pushed to the queue."""
    run_id = "test_run_5"
    ProgressTracker.create(run_id)

    ProgressTracker.update(run_id, step="step1", progress=0.5)

    queue = ProgressTracker.get_queue(run_id)
    assert queue is not None
    assert not queue.empty()

    data = queue.get_nowait()
    assert data["run_id"] == run_id
    assert data["progress"] == 0.5
    assert data["step"] == "step1"

    ProgressTracker.cleanup(run_id)


def test_cleanup():
    """After cleanup, state should be None."""
    run_id = "test_run_6"
    ProgressTracker.create(run_id)
    ProgressTracker.cleanup(run_id)

    assert ProgressTracker.get_state(run_id) is None
    assert ProgressTracker.get_queue(run_id) is None
    assert not ProgressTracker.is_cancelled(run_id)


def test_multiple_runs_independent():
    """Two runs should have independent states."""
    ProgressTracker.create("run_a")
    ProgressTracker.create("run_b")

    ProgressTracker.update("run_a", progress=0.4)
    ProgressTracker.update("run_b", progress=0.8)

    assert ProgressTracker.get_state("run_a").progress == 0.4
    assert ProgressTracker.get_state("run_b").progress == 0.8

    ProgressTracker.cancel("run_a")
    assert ProgressTracker.is_cancelled("run_a")
    assert not ProgressTracker.is_cancelled("run_b")

    ProgressTracker.cleanup("run_a")
    ProgressTracker.cleanup("run_b")


print("All ProgressTracker tests passed!")