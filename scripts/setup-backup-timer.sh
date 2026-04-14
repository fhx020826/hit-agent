#!/usr/bin/env bash
# Setup daily backup systemd timer on ECS.
# Usage: sudo bash scripts/setup-backup-timer.sh

set -euo pipefail

PROJECT_DIR="/srv/fhx-hit-agent"
CONDA_ENV="/root/miniconda3/envs/fhx-hit-agent"
DATA_DIR="${PROJECT_DIR}/backend/data"

cat > /etc/systemd/system/fhx-hit-agent-backup.timer <<EOF
[Unit]
Description=Daily fhx-hit-agent database backup

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

cat > /etc/systemd/system/fhx-hit-agent-backup.service <<EOF
[Unit]
Description=fhx-hit-agent backup

[Service]
Type=oneshot
Environment=PYTHON_BIN=${CONDA_ENV}/bin/python
Environment=HIT_AGENT_DATA_ROOT=${DATA_DIR}
ExecStart=${CONDA_ENV}/bin/python -c "
import sqlite3, json, tarfile, os
from datetime import datetime, timezone
from pathlib import Path

data = Path('${DATA_DIR}')
db = data / 'app.db'
stamp = datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')
bkup_dir = data / 'backups'
bkup_dir.mkdir(exist_ok=True)

tmp = Path('/tmp/hit-agent-backup')
tmp.mkdir(exist_ok=True)
dst_db = tmp / db.name
src = sqlite3.connect(db)
dst = sqlite3.connect(dst_db)
with dst: src.backup(dst)
dst.close(); src.close()

uploads = tmp / 'uploads'
uploads.mkdir(exist_ok=True)
up_src = data / 'uploads'
if up_src.exists():
    import shutil
    for child in up_src.iterdir():
        t = uploads / child.name
        if child.is_dir(): shutil.copytree(child, t)
        else: shutil.copy2(child, t)

(tmp / 'manifest.json').write_text(json.dumps({'created_at': datetime.now(timezone.utc).isoformat(), 'backup_stamp': stamp}, indent=2))

archive = bkup_dir / f'hit-agent-backup-{stamp}.tar.gz'
with tarfile.open(archive, 'w:gz') as tar: tar.add(tmp, arcname='')

# Retain only last 7 backups
backups = sorted(bkup_dir.glob('hit-agent-backup-*.tar.gz'))
for old in backups[:-7]: old.unlink()

import shutil; shutil.rmtree(tmp)
print(f'Backup done: {archive}')
"
EOF

systemctl daemon-reload
systemctl enable fhx-hit-agent-backup.timer
systemctl start fhx-hit-agent-backup.timer

echo "Backup timer installed. Runs daily at 03:00."
systemctl list-timers fhx-hit-agent-backup.timer --no-pager
