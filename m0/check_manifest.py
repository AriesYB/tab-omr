"""Check real-data provenance, file hashes, review state and split isolation."""
import argparse
import hashlib
import json
from pathlib import Path
from m0.__main__ import load_lines, validate

def check(path):
    root=Path(path).resolve().parent
    rows=load_lines(path)
    if not rows: raise ValueError('empty manifest')
    ids=set(); groups={}; hashes={}; counts={'dev':0,'test':0}
    for row in rows:
        sid=row['sampleId']; split=row['split']; group=row['group']
        if sid in ids or not sid or not group: raise ValueError('duplicate/empty sample ID or group')
        ids.add(sid)
        if split not in counts: raise ValueError('real evaluation split must be dev or test')
        if row['kind']!='real' or row['reviewStatus']!='reviewed': raise ValueError('requires reviewed real examples')
        for key in ['source','rights','annotator','reviewer']:
            if not row.get(key):raise ValueError('missing '+key)
        if row['annotator']==row['reviewer']:raise ValueError('independent reviewer required')
        if groups.setdefault(group,split)!=split:raise ValueError('group leakage across splits')
        image=(root/row['image']).resolve()
        if not image.is_relative_to(root):raise ValueError('image outside manifest directory')
        digest=hashlib.sha256(image.read_bytes()).hexdigest()
        if digest!=row['sha256']:raise ValueError('image SHA256 mismatch')
        if digest in hashes:raise ValueError('duplicate image content')
        hashes[digest]=sid
        annotation=(root/row['annotation']).resolve()
        if not annotation.is_relative_to(root):raise ValueError('annotation outside manifest directory')
        score=validate(json.loads(annotation.read_text()))
        if score['sampleId']!=sid:raise ValueError('annotation sample ID mismatch')
        counts[split]+=1
    return {'samples':len(rows),'splits':counts,'targetMet':counts=={'dev':20,'test':30}}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('manifest');args=parser.parse_args()
    print(json.dumps(check(args.manifest)))
