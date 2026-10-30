import copy
import unittest
from m0.__main__ import evaluate,load_lines,validate

class EvaluationTests(unittest.TestCase):
    def setUp(self): self.score=load_lines('data/examples/truth.jsonl')[0]
    def test_identity(self):
        r=evaluate([self.score],[self.score]); self.assertEqual((r['exact'],r['tokenErrorRate']),(1,0))
    def test_missing_and_invalid_are_failures(self):
        for candidate in [[],[dict(sampleId=self.score['sampleId'])]]:
            r=evaluate([self.score],candidate); self.assertEqual((r['valid'],r['exact'],r['tokenErrorRate']),(0,0,1))
    def test_wrong_fret_counted(self):
        p=copy.deepcopy(self.score); p['measures'][0]['events'][0]['notes'][0]['fret']=9
        self.assertEqual(evaluate([self.score],[p])['rows'][0]['edits'],1)
    def test_reading_order_matters(self):
        p=copy.deepcopy(self.score); p['measures'][0]['events'].reverse()
        self.assertGreater(evaluate([self.score],[p])['tokenErrorRate'],0)
    def test_unknown_rhythm_requires_reason(self):
        self.score['measures'][0]['events'][0]['unknownReason']=None
        with self.assertRaises(ValueError): validate(self.score)
    def test_duplicate_string_rejected(self):
        self.score['measures'][0]['events'][0]['notes'].append(dict(string=1,fret=4))
        with self.assertRaises(ValueError): validate(self.score)
    def test_duplicate_and_empty_datasets_rejected(self):
        for truth,pred in [([],[]),([self.score,self.score],[]),([self.score],[self.score,self.score])]:
            with self.assertRaises(ValueError):evaluate(truth,pred)
    def test_chord_order_and_fraction_normalized(self):
        a=copy.deepcopy(self.score); e=a['measures'][0]['events'][0]
        e['notes'].append(dict(string=2,fret=3)); e['duration']=dict(n=1,d=2)
        b=copy.deepcopy(a); e=b['measures'][0]['events'][0]; e['notes'].reverse(); e['duration']=dict(n=2,d=4)
        self.assertEqual(evaluate([a],[b])['exact'],1)

if __name__=='__main__':unittest.main()
