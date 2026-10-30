"""Pinned external research baseline; raw tokens only, not benchmark accuracy."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time

REVISION='3cd36084fda5433bb26cb3a3281f25e9e3ee0476'
MODEL_REVISION='cf0aa64313e981e3c4337e322df6540958a55e1d'
CHECKSUM='833a45752eb99cf525ec2744c20d93175540b487f162caa38e554fc3c7fb0f7e'

def main():
    p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--checkpoint',required=True);p.add_argument('--image',required=True);p.add_argument('--output',required=True);a=p.parse_args()
    source=Path(a.source).resolve(); checkpoint=Path(a.checkpoint)
    revision=subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD'],text=True).strip()
    if revision!=REVISION:raise ValueError('unreviewed source revision')
    if hashlib.file_digest(checkpoint.open('rb'),'sha256').hexdigest()!=CHECKSUM:raise ValueError('checkpoint checksum mismatch')
    sys.path.insert(0,str(source/'scripts'))
    import torch
    from guitar_omr_eval import create_model,greedy_decode,decode_ids
    from guitar_omr_dataset_smoke import load_image_tensor
    from guitar_omr_train import validate_token_structure
    torch.set_num_threads(4)
    started=time.perf_counter()
    saved=torch.load(checkpoint,map_location='cpu',weights_only=True)
    config=dict(saved['config']['args']);config['pretrained_encoder']=False
    # Every parameter is restored below; avoid a redundant pretrained backbone download.
    vocab=saved['vocab'];model=create_model(config,vocab,saved['config']);model.load_state_dict(saved['model'],strict=True);model.eval()
    image=load_image_tensor(Path(a.image),width=config['width'],height=config['height'])
    loaded=time.perf_counter()
    with torch.inference_mode():
        ids,eos=greedy_decode(model,image,vocab['<BOS>'],vocab['<EOS>'],config['max_seq_len'],torch.device('cpu'),{int(v):k for k,v in vocab.items()},None)
    tokens=decode_ids(ids,{int(v):k for k,v in vocab.items()})
    valid,bars=validate_token_structure(tokens)
    result=dict(kind='research-smoke-not-accuracy',sourceRevision=revision,modelRevision=MODEL_REVISION,checkpointSha256=CHECKSUM,imageSha256=hashlib.file_digest(open(a.image,'rb'),'sha256').hexdigest(),device='cpu',threads=4,torchVersion=torch.__version__,loadSeconds=loaded-started,inferenceSeconds=time.perf_counter()-loaded,sawEos=eos,structureValid=valid,bars=bars,tokens=tokens)
    Path(a.output).parent.mkdir(parents=True,exist_ok=True);Path(a.output).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='tokens'}))

if __name__=='__main__':main()
