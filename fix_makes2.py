import subprocess, json

db = '/var/www/zagbrakes/data/zag.db'

def run(sql):
    r = subprocess.run(['sqlite3', db, sql], capture_output=True, text=True)
    return r.stdout.strip()

# 获取所有makes
makes_raw = run("SELECT id, name FROM vehicle_makes;")
make_map = {}
for line in makes_raw.split('\n'):
    if '|' not in line: continue
    mid, nraw = line.split('|', 1)
    try: name = json.loads(nraw).get('en','')
    except: name = nraw
    make_map[mid] = name

# 正确品牌ID
HONDA    = 'vmake_afa7e8403e3b'
YAMAHA   = 'vmake_8e474a79baa3'
SUZUKI   = 'vmake_6950264d89de'
KAWASAKI = 'vmake_15f1525b72ee'
HARLEY   = 'vmake_c4f6d35773c1'
POLARIS  = 'vmake_5ad2e788f013'
BMW      = 'vmake_a3fbd16f0878'
CFMOTO   = 'vmake_138c11536b35'

# 找Can-Am ID
canam_id = None
for mid, name in make_map.items():
    if name in ['Can-Am', 'CAN-AM', 'Can Am']:
        canam_id = mid
        break
print(f"Can-Am ID: {canam_id}")
print(f"总品牌数: {len(make_map)}")

merged = 0
deleted = 0

for mid, name in list(make_map.items()):
    name_up = name.upper().strip()
    target = None

    # HARLEY变体
    if any(x in name_up for x in ['HARLEY','DARLEY','BARLEY','DAVIDSON','DAVIDGON','DRARLEY']):
        if mid != HARLEY: target = HARLEY

    # HONDA变体
    elif name_up in ['HONPA']:
        target = HONDA

    # BMW变体
    elif name_up == 'BMV':
        target = BMW

    # CF_MOTO → CFMOTO
    elif name_up == 'CF_MOTO':
        target = CFMOTO

    # CAN-AM变体
    elif name_up in ['CAN', 'CANAM'] and canam_id and mid != canam_id:
        target = canam_id

    # 无法识别的乱码直接删（无产品关联的）
    elif name_up in ["'SRAETERYARET", ')', 'CHORE)', 'CHARLES,', 'ANGRIC',
                     'ENEON', 'ERENS,', 'DEERE', 'DEFY', 'DORSODURO',
                     'AIP', 'HUSEV', 'CES', 'CPL', 'COR']:
        pcount = int(run(f"""SELECT COUNT(*) FROM vehicle_models vm
            JOIN vehicle_years vy ON vy.model_id=vm.id
            JOIN vehicle_engine_sizes ves ON ves.year_id=vy.id
            JOIN product_vehicles pv ON pv.engine_size_id=ves.id
            WHERE vm.make_id='{mid}';""") or 0)
        if pcount == 0:
            run(f"DELETE FROM vehicle_makes WHERE id='{mid}';")
            print(f"删除无产品乱码: {name}")
            deleted += 1
        else:
            print(f"乱码有{pcount}个产品，跳过: {name}")
        continue

    if target and mid != target:
        run(f"UPDATE vehicle_models SET make_id='{target}' WHERE make_id='{mid}';")
        remaining = int(run(f"SELECT COUNT(*) FROM vehicle_models WHERE make_id='{mid}';") or 0)
        if remaining == 0:
            run(f"DELETE FROM vehicle_makes WHERE id='{mid}';")
            print(f"合并删除: {name} → {target}")
            deleted += 1
        merged += 1

print(f"\n完成: 合并{merged}个, 删除{deleted}个")
print(f"剩余品牌数: {run('SELECT COUNT(*) FROM vehicle_makes;')}")
