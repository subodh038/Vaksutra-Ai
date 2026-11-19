"""Contract check: frontend FrameAnalysisEntry (TS) vs backend (Pydantic)."""
import re
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
repo_dir = backend_dir.parent

ts = (repo_dir / 'frontend' / 'src' / 'lib' / 'videoAnalysis.ts').read_text(encoding='utf-8')
py = (backend_dir / 'models' / 'schemas.py').read_text(encoding='utf-8')

# Extract TS interface block
m = re.search(r'export interface FrameAnalysisEntry \{(.*?)\n\}', ts, re.S)
ts_fields = re.findall(r'^\s{2}(\w+)\??\s*:', m.group(1), re.M)

# Extract Pydantic class block
m2 = re.search(r'class FrameAnalysisEntry\(BaseModel\):(.*?)\n\nclass ', py, re.S)
py_fields = re.findall(r'^\s{4}(\w+)\s*:', m2.group(1), re.M)

print(f'TS  ({len(ts_fields)}):', sorted(ts_fields))
print(f'PY  ({len(py_fields)}):', sorted(py_fields))
only_ts = set(ts_fields) - set(py_fields)
only_py = set(py_fields) - set(ts_fields)
print('\nOnly in TS :', sorted(only_ts) or 'NONE')
print('Only in PY :', sorted(only_py) or 'NONE')

# Check the push() call populates every interface field
push = re.search(r'frameAnalysis\.push\(\{(.*?)\}\);', ts, re.S)
pushed = set(re.findall(r'(\w+):\s', push.group(1)))
missing_in_push = set(ts_fields) - pushed
print('Missing from push():', sorted(missing_in_push) or 'NONE')

# Old-name residue scan
for name in ('anxietyScore', 'avg_anxiety'):
    hits_ts = len(re.findall(name, ts))
    print(f'residue "{name}" in videoAnalysis.ts: {hits_ts}')

# --- consumer reference check ---
fields = {'armsCrossed','blinkScore','browRaiseScore','cheekSquintScore','confusionScore','eyeContactScore','faceDetected','faceWidth','frownScore','gazeXBs','gazeYBs','gazeZone','headPitch','headPoseScore','headRoll','mockingScore','mouthOpenScore','poseDetected','postureScore','smileScore','shoulderLevelDiff','spineAngle','squintScore','stressScore','timestamp'}
bad = []
for rel_path, pat in [
    ('core/visual/event_detection.py', r'"(\w+)"'),
    ('core/visual/emotion.py',         r'avg\("(\w+)"\)'),
    ('core/visual/head_pose.py',       r'_stats\("(\w+)"\)'),
]:
    src = (backend_dir / rel_path).read_text(encoding='utf-8')
    for hit in re.findall(pat, src):
        if hit.endswith('Score') and hit not in fields:
            bad.append((rel_path, hit))

fe = (repo_dir / 'frontend' / 'src' / 'components' / 'DiagnosticComponents.tsx').read_text(encoding='utf-8')
for hit in re.findall(r'avg\("(\w+)"\)', fe):
    if hit not in fields:
        bad.append(('DiagnosticComponents', hit))
print('Invalid frame-key references:', bad or 'NONE')
