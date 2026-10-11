import subprocess,re,json
from pathlib import Path
objects=subprocess.check_output(['git','rev-list','--objects','--all'],text=True).splitlines()
patterns={'private-key':r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----','github-token':r'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b','aws-key':r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b','credential-literal':r'(?:api[_-]?key|secret|access[_-]?token)\s*[:=]\s*[\x27\"]([A-Za-z0-9_/-]{20,})[\x27\"]'}
findings=[];scanned=0
for line in objects:
    fields=line.split(' ',1)
    if len(fields)!=2:continue
    oid,name=fields
    if not (name.endswith(('.js','.cjs','.mjs','.html','.css','.md','.json','.txt','.toml','.yml','.yaml','.sh')) or '.env' in name):continue
    data=subprocess.check_output(['git','cat-file','-p',oid])
    if b'\0' in data:continue
    text=data.decode('utf-8',errors='replace');scanned+=1
    for kind,pattern in patterns.items():
        for m in re.finditer(pattern,text,re.I if kind=='credential-literal' else 0):
            findings.append({'object':oid,'path':name,'line':text.count('\n',0,m.start())+1,'kind':kind,'value':'REDACTED'})
Path('qa/results/history-scan.json').write_text(json.dumps({'auditedHead':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'scannedTextBlobs':scanned,'scope':'all reachable refs at scan time; structured secret patterns only, no semantic PII audit','findings':findings},ensure_ascii=False,indent=2))
print({'scannedTextBlobs':scanned,'findings':len(findings)})
