import sys
import os
import tempfile
import wave
import struct

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from clip_magic.stages.highlight_detector import (
    detect_highlights, HighlightClip,
    _compute_density_score, _rough_filter, _fallback_select,
)


class SubtitleSegment:
    def __init__(self, text, start_ms, end_ms, confidence=0.9):
        self.text = text
        self.start_ms = start_ms
        self.end_ms = end_ms
        self.confidence = confidence


def make_seg(text, start_s, end_s, conf=0.9):
    return SubtitleSegment(text, int(start_s * 1000), int(end_s * 1000), conf)


class TestHighlightDetector:
    def test_detect_highlights_empty(self):
        assert detect_highlights([]) == []

    def test_detect_highlights_basic(self):
        segs = [make_seg(f"Sentence number {i}", i * 5, i * 5 + 4) for i in range(10)]
        result = detect_highlights(segs)
        assert len(result) <= 3
        for hl in result:
            assert 1 <= hl.rank <= 3
            assert 0 <= hl.score <= 10
            assert hl.start_ms >= 0
            assert hl.end_ms > hl.start_ms

    def test_detect_highlights_single_segment(self):
        segs = [make_seg("Only one segment", 0, 5)]
        result = detect_highlights(segs)
        assert isinstance(result, list)

    def test_density_score_empty(self):
        s = _compute_density_score("")
        assert s == 0.0

    def test_rough_filter_empty(self):
        assert _rough_filter([], 45000) == []

    def test_fallback_select_empty(self):
        assert _fallback_select([], 45000) == []