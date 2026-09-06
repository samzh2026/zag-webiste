import subprocess, json, re

db = '/var/www/zagbrakes/data/zag.db'

def run(sql):
    r = subprocess.run(['sqlite3', db, sql], capture_output=True, text=True)
    return r.stdout.strip()

rows = run("SELECT id, name FROM vehicle_models;").split('\n')
updates = 0

for row in rows:
    if '|' not in row:
        continue
    parts = row.split('|', 1)
    if len(parts) != 2:
        continue
    mid, nraw = parts
    nraw = nraw.strip()
    try:
        name = json.loads(nraw).get('en', '')
    except:
        name = nraw.strip('{}').replace('"en":', '').strip('"').strip()
    if not name:
        continue
    
    original = name
    
    name = re.sub(r'\bcB\b', 'CB', name)
    name = re.sub(r'\bvez\b', 'YZ', name)
    name = name.replace('Ploneer', 'Pioneer')
    name = name.replace('Pioneor', 'Pioneer')
    name = re.sub(r'\s*—[-—_\s]*[A-Za-z]?\s*$', '', name)
    name = re.sub(r'\s*—[-—_\s]+', ' ', name)
    if re.search(r'CB \{', name):
        name = re.sub(r'CB \{.*', 'CB Series', name)
    name = re.sub(r'^HONDA\s+CB\b', 'CB', name)
    name = re.sub(r'[—\-_\s,;.]+$', '', name).strip()
    name = re.sub(r'\s+', ' ', name).strip()
    
    if name != original and name:
        new_json = json.dumps({"en": name})
        escaped = new_json.replace("'", "''")
        run(f"UPDATE vehicle_models SET name='{escaped}' WHERE id='{mid}';")
        updates += 1
        print(f"  {original!r:45s} -> {name!r}")

print(f"\n更新: {updates} 个")
