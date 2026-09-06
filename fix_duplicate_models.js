"use strict";
const Database = require("better-sqlite3");
const path = require("path");
const db = new Database(path.join(__dirname, "data", "zag.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = OFF");  // 临时关闭，方便合并

// 找所有重复的model（同一make下，slug相似）
const models = db.prepare("SELECT * FROM vehicle_models").all();

// 按make_id分组，找slug相近的重复项
// 例如 pcx-125 和 pcx125 是同一个车型
function normalizeSlug(s) {
  return s.replace(/-/g, "").toLowerCase();
}

const makeGroups = {};
for (const m of models) {
  if (!makeGroups[m.make_id]) makeGroups[m.make_id] = [];
  makeGroups[m.make_id].push(m);
}

let merged = 0, fixed = 0;

const updateYears  = db.prepare("UPDATE vehicle_years SET model_id=? WHERE model_id=?");
const deleteModel  = db.prepare("DELETE FROM vehicle_models WHERE id=?");

const run = db.transaction(() => {
  for (const [makeId, mods] of Object.entries(makeGroups)) {
    // 按normalized slug分组
    const normGroups = {};
    for (const m of mods) {
      const key = normalizeSlug(m.slug);
      if (!normGroups[key]) normGroups[key] = [];
      normGroups[key].push(m);
    }

    for (const [key, dups] of Object.entries(normGroups)) {
      if (dups.length < 2) continue;

      // 保留有产品关联的那个（或最旧的）
      // 先找哪个model有product_vehicles关联
      let keeper = null;
      for (const m of dups) {
        const hasProducts = db.prepare(`
          SELECT COUNT(*) as c FROM vehicle_years vy
          JOIN vehicle_engine_sizes ves ON ves.year_id=vy.id
          JOIN product_vehicles pv ON pv.engine_size_id=ves.id
          WHERE vy.model_id=?
        `).get(m.id).c;
        if (hasProducts > 0) { keeper = m; break; }
      }
      // 如果没有有产品的，保留第一个
      if (!keeper) keeper = dups[0];

      // 把其他model的years指向keeper，然后删除重复model
      for (const m of dups) {
        if (m.id === keeper.id) continue;
        const yearsCount = updateYears.run(keeper.id, m.id).changes;
        deleteModel.run(m.id);
        console.log(`合并: "${m.name}" (${m.id}) → "${keeper.name}" (${keeper.id}), 迁移${yearsCount}个年份`);
        merged++;
      }
      fixed++;
    }
  }
});

run();
db.pragma("foreign_keys = ON");

const counts = {
  models: db.prepare("SELECT COUNT(*) AS c FROM vehicle_models").get().c,
  pv:     db.prepare("SELECT COUNT(*) AS c FROM product_vehicles").get().c,
};
console.log(`\n完成! 合并了${merged}个重复model，影响${fixed}个车型`);
console.log(`  vehicle_models: ${counts.models}`);
console.log(`  product_vehicles: ${counts.pv}`);

// 验证PCX125现在有没有产品
const pcxCheck = db.prepare(`
  SELECT p.sku FROM vehicle_models vm
  JOIN vehicle_years vy ON vy.model_id=vm.id
  JOIN vehicle_engine_sizes ves ON ves.year_id=vy.id
  JOIN product_vehicles pv ON pv.engine_size_id=ves.id
  JOIN products p ON p.id=pv.product_id
  WHERE vm.slug IN ('pcx125','pcx-125') 
  LIMIT 5
`).all();
console.log(`\nPCX125产品验证: ${pcxCheck.map(p=>p.sku).join(', ') || '还是没有关联'}`);

db.close();
