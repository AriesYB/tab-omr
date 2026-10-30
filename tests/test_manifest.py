import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from m0.check_manifest import check
from m0.__main__ import load_lines

class ManifestTests(unittest.TestCase):
    def test_hash_review_and_leakage(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); image=root/'image.png'; image.write_bytes(b'fixture bytes, not an image decoder test')
            score=load_lines('data/examples/truth.jsonl')[0]
            (root/'score.json').write_text(json.dumps(score))
            row=dict(sampleId=score['sampleId'],image='image.png',annotation='score.json',sha256=hashlib.sha256(image.read_bytes()).hexdigest(),kind='real',split='dev',group='song-A',source='test',rights='test',reviewStatus='reviewed',annotator='A',reviewer='B')
            manifest=root/'manifest.jsonl'
            manifest.write_text(json.dumps(row)+'\n')
            self.assertEqual(check(manifest)['splits'],{'dev':1,'test':0})
            for change in [dict(sha256='wrong'),dict(reviewer='A'),dict(reviewStatus='unreviewed')]:
                manifest.write_text(json.dumps(row|change)+'\n')
                with self.assertRaises(ValueError):check(manifest)
            manifest.write_text(json.dumps(row)+'\n'+json.dumps(row|dict(sampleId='another',split='test'))+'\n')
            with self.assertRaisesRegex(ValueError,'leakage'):check(manifest)
