import subprocess, json

db = '/var/www/zagbrakes/data/zag.db'

def run(sql):
    r = subprocess.run(['sqlite3', db, sql], capture_output=True, text=True)
    return r.stdout.strip()

migrations = {
    'vmod_9242b6371ad1': 'HONDA',
    'vmod_e3b4cbe2b444': 'HONDA',
    'vmod_03a84571985e': 'HONDA',
    'vmod_9bbda27396f8': 'HONDA',
    'vmod_fbbef3ef778c': 'KAWASAKI',
    'vmod_ca70bdb68084': 'POLARIS',
    'vmod_7ebdb223c8e0': 'POLARIS',
    'vmod_d7fb2020323f': 'SUZUKI',
    'vmod_11fe580b92d0': 'SUZUKI',
    'vmod_ca02b5d0c408': 'YAMAHA',
    'vmod_f6894a7e8a17': 'YAMAHA',
    'vmod_cca614e68c02': 'YAMAHA',
    'vmod_0c31df2bb186': 'YAMAHA',
    'vmod_ef92a7a69cf2': 'ARCTIC CAT',
    'vmod_1eb138c88872': 'ARCTIC CAT',
    'vmod_b86c1dc73a19': 'KTM',
    'vmod_e83d1c8f1f14': 'APRILIA',
    'vmod_c31fd16ce945': 'HARLEY',
    'vmod_ae1633884f3f': 'POLARIS',
    'vmod_81a3d9c6c6c3': 'HONDA',
    'vmod_40d9f197f028': 'SUZUKI',
    'vmod_c6b7bcc49586': 'SUZUKI',
    'vmod_594b48f18522': 'HONDA',
    'vmod_6b5f363e5e52': 'YAMAHA',
    'vmod_5481a6dd90a1': 'CFMOTO',
    'vmod_599b06d57e04': 'CFMOTO',
    'vmod_4fc1a70f9b43': 'CFMOTO',
    'vmod_e4a09ee37061': 'HARLEY',
    'vmod_e2f09f1e1e6a': 'HARLEY',
    'vmod_5132151ba807': 'HONDA',
    'vmod_ff846365eea8': 'HONDA',
    'vmod_e58e9f9950f4': 'HARLEY',
    'vmod_c4a911442d42': 'ARCTIC CAT',
    'vmod_a8b818ace003': 'HARLEY',
    'vmod_f5dc2d359747': 'JOHN DEERE',
    'vmod_ddba48951141': 'MH',
    'vmod_ecac42af233e': None,
}

# 获取现有makes
makes_raw = run("SELECT id, name FROM vehicle_makes;")
make_name_to_id = {}
for line in makes_raw.split('\n'):
    if '|' not in line: continue
    mid, name_raw = line.split('|', 1)
    try:
        name = json.loads(name_raw).get('en', '').upper()
    except:
        name = name_raw.upper()
    make_name_to_id[name] = mid

# 确保HARLEY存在
if 'HARLEY' not in make_name_to_id and 'HARLEY-DAVIDSON' not in make_name_to_id:
    run("INSERT OR IGNORE INTO vehicle_makes (id,name,slug,sort_order) VALUES ('vmake_harley','{\"en\":\"HARLEY\"}','harley',100);")
    make_name_to_id['HARLEY'] = 'vmake_harley'

# 确保JOHN DEERE存在
if 'JOHN DEERE' not in make_name_to_id:
    run("INSERT OR IGNORE INTO vehicle_makes (id,name,slug,sort_order) VALUES ('vmake_john_deere','{\"en\":\"JOHN DEERE\"}','john-deere',100);")
    make_name_to_id['JOHN DEERE'] = 'vmake_john_deere'

# 确保MH存在
if 'MH' not in make_name_to_id:
    run("INSERT OR IGNORE INTO vehicle_makes (id,name,slug,sort_order) VALUES ('vmake_mh','{\"en\":\"MH\"}','mh',100);")
    make_name_to_id['MH'] = 'vmake_mh'

migrated = 0
skipped = 0
for model_id, target_make in migrations.items():
    if target_make is None:
        skipped += 1
        continue
    target_id = make_name_to_id.get(target_make.upper())
    if not target_id:
        for k, v in make_name_to_id.items():
            if target_make.upper() in k:
                target_id = v
                break
    if not target_id:
        print(f"找不到品牌 {target_make}，跳过 {model_id}")
        skipped += 1
        continue
    run(f"UPDATE vehicle_models SET make_id='{target_id}' WHERE id='{model_id}';")
    migrated += 1
    print(f"迁移 {model_id} → {target_make}")

print(f"\n完成: 迁移{migrated}个, 跳过{skipped}个")

# 删除空品牌
bad_makes = [
    'vmake_cbdfb0cc5dbe','vmake_7c798ba3b886','vmake_331f868d3793',
    'vmake_339208b1ff00','vmake_e90e04ca59fe','vmake_e4786acaa19e',
    'vmake_b40b4a43c253','vmake_414b8f9eb23f','vmake_faf9f800100f',
    'vmake_8eeb0f5ace10','vmake_c7c6f9935c72','vmake_335a914e43fc',
    'vmake_c8de9b765880','vmake_3e851a868968','vmake_a364b5932284',
]
deleted = 0
for mid in bad_makes:
    count = run(f"SELECT COUNT(*) FROM vehicle_models WHERE make_id='{mid}';")
    if count.strip() == '0':
        run(f"DELETE FROM vehicle_makes WHERE id='{mid}';")
        deleted += 1
        print(f"删除空品牌: {mid}")

print(f"删除{deleted}个空品牌")
print("全部完成!")
