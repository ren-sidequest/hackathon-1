"""Package the committed frontend and its matching backend reference, never local state."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    commit = git('rev-parse', 'HEAD').decode().strip()
    prefix = 'EvidenceBridge-frontend-api2/'
    source = zipfile.ZipFile(io.BytesIO(git('archive', '--format=zip', commit)))
    forbidden = {'node_modules', '.git', '.codex', '.gitnexus', '.ci-results', 'dist', 'test-results', 'var'}
    hashes = {}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.output, 'w', zipfile.ZIP_DEFLATED) as output:
        for item in source.infolist():
            path = Path(item.filename)
            if item.is_dir():
                continue
            if forbidden.intersection(path.parts) or (path.name.startswith('.env') and not path.name.endswith('.example')) or path.suffix in {'.sqlite', '.log', '.key', '.pem'}:
                raise ValueError(f'Unexpected local-state file in committed source: {item.filename}')
            content = source.read(item)
            hashes[item.filename] = hashlib.sha256(content).hexdigest()
            output.writestr(prefix + item.filename, content)
        manifest = {'commit': commit, 'contents': 'Complete frontend source, shared UI/API layer, locked dependencies, tests and docs. app/backend is the unchanged matching API 2.0 reference for local integration.', 'sha256': hashes}
        output.writestr(prefix + 'DELIVERY.json', json.dumps(manifest, ensure_ascii=False, indent=2))
    with zipfile.ZipFile(args.output) as check:
        assert check.testzip() is None
        for name, digest in hashes.items():
            assert hashlib.sha256(check.read(prefix + name)).hexdigest() == digest
    print(json.dumps({'zip': str(args.output.resolve()), 'commit': commit, 'files': len(hashes), 'bytes': args.output.stat().st_size, 'sha256': hashlib.sha256(args.output.read_bytes()).hexdigest()}))


if __name__ == '__main__':
    main()
