import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from clip_magic.stages.highlight_detector import HighlightClip


class TestClipEngineBoundary:
    def test_clip_result_dataclass(self):
        from clip_magic.stages.clip_engine import ClipResult
        r = ClipResult(rank=1, output_path="/tmp/test.mp4",
                       start_ms=0, end_ms=45000, title="Test")
        assert r.rank == 1
        assert r.start_ms == 0
        assert r.end_ms == 45000

    def test_empty_highlights_returns_empty(self):
        from clip_magic.stages.clip_engine import clip_segments
        video = os.path.join(os.path.dirname(__file__), "..", "test_video.mp4")
        if not os.path.exists(video):
            return
        results = clip_segments(video, [])
        assert results == []

    def test_out_of_bounds_clamped(self):
        from clip_magic.stages.audio_extractor import get_video_duration
        video = os.path.join(os.path.dirname(__file__), "..", "test_video.mp4")
        if not os.path.exists(video):
            return
        dur_ms = int(get_video_duration(video) * 1000)
        hl = HighlightClip(rank=1, start_ms=dur_ms + 5000,
                           end_ms=dur_ms + 50000, score=9.0,
                           reason="", title="Test")
        from clip_magic.stages.clip_engine import clip_segments
        results = clip_segments(video, [hl])
        if results:
            assert results[0].end_ms <= dur_ms