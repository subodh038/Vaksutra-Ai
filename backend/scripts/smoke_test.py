import sys, logging
from pathlib import Path

# Resolve backend root regardless of working directory
backend_dir = str(Path(__file__).resolve().parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

logging.basicConfig(level=logging.INFO, format='%(levelname)s %(name)s | %(message)s')

print('=== SMOKE 3: duration plumbing — audio-only vs missing duration ===')
from tests.unit.test_impromptu_mode import make_signals
from modes.impromptu import ImpromptuMode
m = ImpromptuMode()

# Same "bad" audio, only difference is whether duration is known
no_dur  = make_signals(duration_ms=0.0, pause_count=30, avg_pause_ms=3000.0)
with_dur = make_signals(duration_ms=120_000, pause_count=30, avg_pause_ms=3000.0,
                        total_pause_time_ms=90_000)
s_no, s_with = m.compute_score(no_dur), m.compute_score(with_dur)
print(f'score(no duration)   = {s_no}   (silence/pause NEUTRALISED)')
print(f'score(75% silence)   = {s_with}   (real penalty applied)')
assert s_with < s_no, 'duration plumbing failed'
print('DURATION OK -> unknown duration no longer hard-zeros silence score')

print()
print('=== SMOKE 4: key_metrics builder + poll grace window ===')
from api.routes.analysis import _build_key_metrics, PROCESSING_GRACE_SECONDS
from models.schemas import AnalysisResponse
resp = AnalysisResponse(
    audio_received_bytes=1, frame_count=10, face_detected_pct=80,
    gaze={'center_pct':72,'left_pct':7,'right_pct':7,'down_pct':7,'away_pct':7},
    emotion={'avg_brow_raise':0.1,'avg_confusion':0,'avg_stress':0,'avg_frown':0,'avg_squint':0,'avg_smile':0.2,'avg_blink_rate':0},
    head_pose={'avg_eye_contact':0.55,'avg_head_pose':0.9,'avg_head_pitch':0,'avg_head_roll':0},
    overall_score=77.0, feedback=[], detected_events=[],
    score_ranges={'eye_contact_min':0,'eye_contact_max':1,'eye_contact_avg':0,'anxiety_min':0,'anxiety_max':0,'anxiety_avg':0,'stress_min':0,'stress_max':0,'stress_avg':0,'smile_min':0,'smile_max':0,'smile_avg':0},
)
km = _build_key_metrics(resp, make_signals())
print('key_metrics:', {k: km[k] for k in ('gaze_center_pct','wpm','pause_count','avg_brow_raise')})
assert km['gaze_center_pct'] == 72, 'gaze_center_pct missing!'
assert 'avg_eye_contact' not in km, 'stale capped metric still present!'
print(f'GRACE WINDOW = {PROCESSING_GRACE_SECONDS}s')
print('METRICS OK -> gaze_center_pct exported, stale metric removed')

print()
print('=== SMOKE 5: app imports, all routers registered ===')
from main import app


def _collect_paths(obj, acc):
    """Recursively collect paths — FastAPI 0.14x+ nests included routers as
    _IncludedRouter(original_router=APIRouter) objects."""
    if hasattr(obj, 'path'):
        acc.add(obj.path)
    child_lists = []
    for attr in ('routes', 'app', 'original_router'):
        child = getattr(obj, attr, None)
        if child is None or child is obj:
            continue
        if isinstance(child, list):
            child_lists.extend(child)
        else:
            child_lists.append(child)
    for c in child_lists:
        _collect_paths(c, acc)


all_paths: set = set()
_collect_paths(app, all_paths)
routes = sorted(all_paths)
for want in ('/analyze', '/analyze/coach/{session_id}', '/auth/login',
             '/uploads/video/upload-url', '/uploads/video/view-url',
             '/topics/generate', '/sessions'):
    status = 'OK ' if any(want == r or r.rstrip('/') == want for r in routes) else 'MISS'
    print(f'  [{status}] {want}')
    assert status == 'OK ', f'route missing: {want}'
print('APP OK ->', len(routes), 'routes registered')

print()
print('ALL SMOKE TESTS PASSED')
