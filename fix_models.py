import subprocess, json, re

db = '/var/www/zagbrakes/data/zag.db'

def run(sql):
    r = subprocess.run(['sqlite3', db, sql], capture_output=True, text=True)
    return r.stdout.strip()

# 获取所有models
rows = run("SELECT id, name FROM vehicle_models;").split('\n')
updates = 0

for row in rows:
    if '|' not in row: continue
    mid, nraw = row.split('|', 1)
    try:
        name = json.loads(nraw).get('en', '')
    except:
        continue
    
    original = name
    
    # 清理规则
    # 1. 开头的破折号噪声
    name = re.sub(r'^[—\-_\s]+', '', name)
    # 2. FaR/FAR → F&R
    name = re.sub(r'\bFaR\b', 'F&R', name)
    name = re.sub(r'\bFAR\b', 'F&R', name)
    name = re.sub(r'\bFar\b', 'F&R', name)
    # 3. FLEFT → F(LEFT), FRIGHT → F(RIGHT)
    name = re.sub(r'\bFLEFT\b', 'F(LEFT)', name)
    name = re.sub(r'\bFRIGHT\b', 'F(RIGHT)', name)
    # 4. 多余空格
    name = re.sub(r'\s+', ' ', name).strip()
    # 5. 末尾的标点
    name = re.sub(r'[—\-_\s,;]+$', '', name).strip()
    # 6. 双破折号
    name = name.replace('--', '-')
    # 7. _X → 去掉下划线
    name = name.replace('—_', '').replace('_ ', ' ')
    # 8. 引号噪声
    name = name.replace('"""', '').replace('""', '')
    # 清理后再trim
    name = name.strip()
    
    if name != original and name:
        new_json = json.dumps({"en": name})
        # 转义单引号
        new_json_escaped = new_json.replace("'", "''")
        run(f"UPDATE vehicle_models SET name='{new_json_escaped}' WHERE id='{mid}';")
        updates += 1
        if updates <= 20:  # 只打印前20个看效果
            print(f"  {original!r:50s} → {name!r}")

print(f"\n总共更新: {updates} 个车型名称")
