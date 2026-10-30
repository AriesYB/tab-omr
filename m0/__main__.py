import argparse
import json
from fractions import Fraction
from pathlib import Path
from jsonschema import Draft202012Validator

SCHEMA = json.loads(Path(__file__).with_name('score.schema.json').read_text())

def validate(score):
    Draft202012Validator(SCHEMA).validate(score)
    ids = set()
    for measure in score['measures']:
        for item in [measure, *measure['events']]:
            if item['id'] in ids:
                raise ValueError('duplicate ID: ' + item['id'])
            ids.add(item['id'])
        previous = None
        for event in measure['events']:
            if event['rest'] == bool(event['notes']):
                raise ValueError('event must contain notes XOR rest')
            if len({n['string'] for n in event['notes']}) != len(event['notes']):
                raise ValueError('multiple frets on the same string')
            if (event['duration'] is None or event['onset'] is None) and not event['unknownReason']:
                raise ValueError('unknown timing requires a reason')
            if event['duration'] is not None and event['duration']['n'] == 0:
                raise ValueError('duration must be positive')
            if event['onset'] is not None:
                now = Fraction(**{'numerator':event['onset']['n'], 'denominator':event['onset']['d']})
                if previous is not None and now < previous:
                    raise ValueError('events must be in reading order')
                previous = now
            box = event['region']
            if box is not None and (box[2] <= box[0] or box[3] <= box[1]):
                raise ValueError('region must be [x0,y0,x1,y1] with positive area')
    return score

def rational(value):
    return None if value is None else str(Fraction(value['n'],value['d']))

def tokens(score):
    result = []
    for measure in score['measures']:
        result.append(('bar',))
        for event in measure['events']:
            notes = tuple(sorted((n['string'],n['fret']) for n in event['notes']))
            result.append(('event', event['rest'], notes, rational(event['onset']), rational(event['duration'])))
    return result

def distance(a,b):
    row = list(range(len(b)+1))
    for i,x in enumerate(a,1):
        nxt = [i]
        for j,y in enumerate(b,1):
            nxt.append(min(nxt[-1]+1,row[j]+1,row[j-1]+(x!=y)))
        row = nxt
    return row[-1]

def evaluate(truth,predictions):
    if not truth:
        raise ValueError('empty truth set is not an evaluation')
    gold={}
    for score in truth:
        validate(score)
        if score['sampleId'] in gold:
            raise ValueError('duplicate truth sampleId')
        gold[score['sampleId']]=score
    pred={}
    for score in predictions:
        sid=score.get('sampleId')
        if not isinstance(sid,str) or sid in pred or sid not in gold:
            raise ValueError('duplicate, missing or unexpected prediction sampleId')
        pred[sid]=score
    rows=[]
    for sid,score in gold.items():
        reference=tokens(score)
        candidate=pred.get(sid)
        error=None
        try:
            if candidate is None:
                raise ValueError('missing prediction')
            validate(candidate)
            hypothesis=tokens(candidate)
        except Exception as exc:
            hypothesis=[]
            error=str(exc)
        edits=distance(reference,hypothesis)
        rows.append(dict(sampleId=sid,valid=error is None,error=error,exact=reference==hypothesis,
                         edits=edits,referenceTokens=len(reference),predictionTokens=len(hypothesis)))
    return dict(samples=len(rows),valid=sum(r['valid'] for r in rows),
                exact=sum(r['exact'] for r in rows),
                tokenErrorRate=sum(r['edits'] for r in rows)/sum(r['referenceTokens'] for r in rows),
                rows=rows)

def load_lines(path):
    return [json.loads(line) for line in Path(path).read_text().splitlines() if line.strip()]

def main():
    parser=argparse.ArgumentParser(description='M0 strict annotation validation and sequence evaluation')
    sub=parser.add_subparsers(dest='command',required=True)
    val=sub.add_parser('validate'); val.add_argument('annotations')
    run=sub.add_parser('evaluate'); run.add_argument('truth'); run.add_argument('predictions'); run.add_argument('--output',required=True)
    args=parser.parse_args()
    if args.command=='validate':
        scores=load_lines(args.annotations)
        if not scores: raise ValueError('empty annotation file')
        for score in scores: validate(score)
        print(json.dumps({'validated':len(scores)}))
    else:
        report=evaluate(load_lines(args.truth),load_lines(args.predictions))
        Path(args.output).parent.mkdir(parents=True,exist_ok=True)
        Path(args.output).write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps({k:v for k,v in report.items() if k!='rows'}))

if __name__=='__main__': main()
