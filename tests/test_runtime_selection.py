"""Offline launcher and web runtime-selection regression tests. Run with python3."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

REPO = Path(__file__).resolve().parents[1]
LAUNCHER = 'skrybble' if REPO.name == 'Skrybble' else 'gad4'


class RuntimeSelection(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='pdg selection ')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.app = self.root / REPO.name
        (self.app / 'tools').mkdir(parents=True)
        for file in [LAUNCHER, 'tools/build-web.sh', 'tools/pdg-release.env']:
            shutil.copy2(REPO / file, self.app / file)
        self.devel = self.root / 'pdg-devel'
        self.devel.mkdir()
        self.runtime(self.devel / 'pdg', 'development')
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        (self.bin / 'uname').write_text('#!/bin/sh\ncase "$1" in -s) echo Darwin;; -m) echo arm64;; esac\n')
        (self.bin / 'uname').chmod(0o755)
        self.env = {k: v for k, v in os.environ.items() if not k.startswith('PDG_')}
        self.env['PATH'] = str(self.bin) + os.pathsep + self.env['PATH']
        # Tests never access the network, including on accidental fallback.
        self.runtime(self.bin / 'curl', '', body='echo unexpected-download >&2; exit 90')
        settings = dict(line.split('=', 1) for line in (self.app / 'tools/pdg-release.env').read_text().splitlines() if line.startswith('PDG_'))
        cache = self.app / '.pdg' / settings['PDG_VERSION']
        self.runtime(cache / 'macos-arm64/pdg.app/Contents/MacOS/pdg', 'release')
        wasm = cache / 'emscripten-wasm32'
        self.wasm(wasm, 'release')
        (wasm / '.asset-sha256').write_text(settings['PDG_EMSCRIPTEN_WASM32_SHA256'] + '\n')
        self.wasm(self.devel / 'build/wasm/wasm32/release', 'development')

    def runtime(self, path, label, body=None):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text('#!/bin/bash\n' + (body or f'printf "%s\\n" "{label}" "$@"') + '\n')
        path.chmod(0o755)

    def wasm(self, path, label):
        path.mkdir(parents=True, exist_ok=True)
        for file in ['libpdg.js', 'libpdg.wasm']:
            (path / file).write_text(label)

    def run_script(self, script=None, args=(), **env):
        return subprocess.run([str(self.app / (script or LAUNCHER)), *args], env={**self.env, **env}, text=True, capture_output=True)

    def test_desktop_default_and_devel_forward_arguments(self):
        for env, label in [({}, 'release'), ({'PDG_DEVEL_DIR': str(self.devel)}, 'release'), ({'PDG_SOURCE': 'devel'}, 'development')]:
            result = self.run_script(args=('custom.js', 'argument with spaces', '--flag'), **env)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout.splitlines(), [label, str(self.app / 'custom.js'), 'argument with spaces', '--flag'])

    def test_custom_checkout_and_executable_override(self):
        custom = self.root / 'custom checkout'
        self.devel.rename(custom)
        result = self.run_script(PDG_SOURCE='devel', PDG_DEVEL_DIR=str(custom))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(result.stdout.startswith('development\n'))
        result = self.run_script(PDG_SOURCE='devel', PDG_EXECUTABLE=str(custom / 'pdg'))
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_invalid_missing_and_refresh_fail_without_download(self):
        for script in [LAUNCHER, 'tools/build-web.sh']:
            for env, args in [({'PDG_SOURCE': 'typo'}, ()), ({'PDG_SOURCE': 'devel', 'PDG_DEVEL_DIR': str(self.root / 'missing')}, ()), ({'PDG_SOURCE': 'devel'}, ('--refresh-pdg',))]:
                result = self.run_script(script, args, **env)
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn('unexpected-download', result.stderr)
                self.assertIn('PDG', result.stderr)

    def test_web_default_devel_and_override(self):
        # Minimal app assets exercise the real builder without copying game artwork.
        for file in ['main.js', 'LICENSE', 'ASSET_RIGHTS.md', 'web/index.html', 'web/skrybble-web.js', 'web/galactica-web.js', 'web/favicon.svg', 'vendor/PDG-LICENSE', 'vendor/pdg-defs.js', 'vendor/pdg-mvc-app/index.js', 'src/js/example.js', 'data/example.txt', 'old-art/art-styles/example.txt', 'old-art/original-default/example.txt', 'tools/build-art-gallery.cjs']:
            path = self.app / file
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('')
        output = self.root / 'web output'
        override = self.root / 'custom wasm'
        self.wasm(override, 'override')
        for env, label in [({}, 'release'), ({'PDG_SOURCE': 'devel'}, 'development'), ({'PDG_SOURCE': 'devel', 'PDG_WASM_DIR': str(override)}, 'override')]:
            result = self.run_script('tools/build-web.sh', **env, GALACTICA_WEB_OUTPUT=str(output), SKRYBBLE_WEB_OUTPUT=str(output))
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual((output / 'libpdg.js').read_text(), label)
            self.assertEqual((output / 'libpdg.wasm').read_text(), label)


if __name__ == '__main__':
    unittest.main()
