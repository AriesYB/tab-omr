"""Original minimal SVG fixtures, not renderer diversity or real evaluation data."""
import json
from pathlib import Path

def main():
    root=Path('data/examples'); root.mkdir(parents=True,exist_ok=True)
    scores=[]
    patterns=[[(1,0),(2,3),(3,2),(1,12)],[(6,0),(5,2),(4,2),(3,0)],[(2,1),(1,0),(2,3),(1,3)],[(3,2),(3,4),(2,3),(1,5)],[(6,3),(5,2),(4,0),(3,0)]]
    for i,notes in enumerate(patterns,1):
        sid=f'synthetic-{i:02d}'
        svg=['<svg xmlns="http://www.w3.org/2000/svg" width="640" height="180" viewBox="0 0 640 180">','<rect width="640" height="180" fill="white"/>']
        for string in range(1,7):
            y=30+20*(string-1)
            svg.append(f'<path d="M20 {y}H620" stroke="black"/>')
        svg.extend(['<path d="M20 30V130M620 30V130" stroke="black"/>'])
        events=[]
        for j,(string,fret) in enumerate(notes):
            x=100+j*130; y=30+20*(string-1)
            box=[x-14,y-12,x+18,y+12]
            svg.append(f'<rect x="{x-14}" y="{y-12}" width="32" height="24" fill="white"/><text x="{x}" y="{y+7}" text-anchor="middle" font-size="20" font-family="monospace">{fret}</text>')
            events.append(dict(id=f'e{j}',notes=[dict(string=string,fret=fret)],rest=False,onset=None,duration=None,unknownReason='No rhythm notation in image',region=box))
        svg.append('</svg>')
        (root/f'{sid}.svg').write_text('\n'.join(svg)+'\n')
        scores.append(dict(schemaVersion='0.1',sampleId=sid,measures=[dict(id='m1',events=events)]))
    (root/'truth.jsonl').write_text(''.join(json.dumps(s)+'\n' for s in scores))
    manifest=[dict(sampleId=s['sampleId'],image=s['sampleId']+'.svg',kind='synthetic',split='fixture',group=s['sampleId'],rights='Original programmatically generated exercise',reviewStatus='generated-unreviewed') for s in scores]
    (root/'manifest.jsonl').write_text(''.join(json.dumps(s)+'\n' for s in manifest))

if __name__=='__main__':main()
