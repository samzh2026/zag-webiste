"use strict";
const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const DB_PATH   = path.join(__dirname, "data", "zag.db");
const JSON_PATH = path.join(__dirname, "products_upload.json");

const KNOWN_MAKES = new Set([
  "HONDA","YAMAHA","SUZUKI","KAWASAKI","KYMCO","BETTER","POLARIS","SYM",
  "TRIUMPH","DUCATI","KTM","BMW","APRILIA","PIAGGIO","VESPA","CPI",
  "LONCIN","LIFAN","ZONGSHEN","BAJAJ","KEEWAY","BENELLI","CAN-AM",
  "ARCTIC","DERBI","GILERA","PEUGEOT","CF","HAOJUE","JIALING","DAYUN",
]);

function genId(p) { return p+"_"+uuidv4().replace(/-/g,"").slice(0,12); }
function slugify(s) {
  return String(s||"").trim().toLowerCase()
    .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80);
}

function parseLine(raw) {
  const line = raw.trim();
  if (!line || line.length < 3) return null;
  let yearStart=null, yearEnd=null, rest=line;
  const ym = line.match(/[\s,;]+(\d{2,4})-(\d{2,4})\s*[,;.]*\s*$/);
  if (ym) {
    let y1=parseInt(ym[1]), y2=parseInt(ym[2]);
    if(y1<100) y1+=y1>=50?1900:2000;
    if(y2<100) y2+=y2>=50?1900:2000;
    yearStart=y1; yearEnd=y2;
    rest=line.slice(0,ym.index).trim();
  }
  let position="F";
  const pm = rest.match(/\s+(F(?:\([^)]*\))?|R(?:\([^)]*\))?|F&R|F\/R)\s*$/i);
  if (pm) {
    const p=pm[1].toUpperCase();
    if(p.startsWith("R")) position="R";
    else if(p.includes("&")||p.includes("/")) position="F&R";
    rest=rest.slice(0,pm.index).trim();
  }
  rest=rest.replace(/[,;.\-]+$/,"").trim();
  if(!rest) return null;
  const words=rest.split(/\s+/);
  let make=null, modelParts=[];
  for(let n=Math.min(2,words.length);n>=1;n--) {
    const c=words.slice(0,n).join(" ").toUpperCase();
    if(KNOWN_MAKES.has(c)){make=c;modelParts=words.slice(n);break;}
  }
  if(!make){make=words[0].toUpperCase();modelParts=words.slice(1);}
  return {make, model:modelParts.join(" ").trim()||"Unknown", position, yearStart, yearEnd};
}

// 安全的 upsert：先查再插，确保返回真实ID
function getOrCreate(db, table, whereClause, whereParams, insertStmt, insertParams) {
  let row = db.prepare("SELECT id FROM "+table+" WHERE "+whereClause).get(...whereParams);
  if (!row) {
    insertStmt.run(...insertParams);
    row = db.prepare("SELECT id FROM "+table+" WHERE "+whereClause).get(...whereParams);
  }
  return row ? row.id : null;
}

function main() {
  const products = JSON.parse(fs.readFileSync(JSON_PATH,"utf8"));
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const skuToId = new Map();
  db.prepare("SELECT id,sku FROM products").all()
    .forEach(p=>{ if(p.sku) skuToId.set(p.sku.toUpperCase(),p.id); });
  console.log("产品数: "+skuToId.size);

  const iMake  = db.prepare("INSERT OR IGNORE INTO vehicle_makes (id,name,slug,sort_order) VALUES (?,?,?,100)");
  const iModel = db.prepare("INSERT OR IGNORE INTO vehicle_models (id,make_id,name,slug,sort_order) VALUES (?,?,?,?,100)");
  const iYear  = db.prepare("INSERT OR IGNORE INTO vehicle_years (id,model_id,year) VALUES (?,?,?)");
  const iES    = db.prepare("INSERT OR IGNORE INTO vehicle_engine_sizes (id,year_id,displacement,engine_type) VALUES (?,?,'standard','')");
  const iPV    = db.prepare("INSERT OR IGNORE INTO product_vehicles (product_id,engine_size_id,position,notes) VALUES (?,?,?,?)");

  let stats={products:0,lines:0,parsed:0,skipped:0,linked:0,noProduct:0,errors:0};

  const run = db.transaction(()=>{
    for (const prod of products) {
      stats.products++;
      const productId = skuToId.get((prod.sku||"").toUpperCase());
      if (!productId) { stats.noProduct++; continue; }

      let lines=[];
      if (Array.isArray(prod.features)&&prod.features.length>0) lines=prod.features;
      else if (prod.vehicleModels)
        lines=prod.vehicleModels.split(/[;|]+/).map(s=>s.trim()).filter(Boolean);

      for (const rawLine of lines) {
        stats.lines++;
        const p=parseLine(rawLine);
        if(!p){stats.skipped++;continue;}
        stats.parsed++;

        try {
          // Make
          const makeId = getOrCreate(db,
            "vehicle_makes", "slug=?", [slugify(p.make)],
            iMake, [genId("vmake"), JSON.stringify({en:p.make}), slugify(p.make)]
          );
          if (!makeId) { stats.errors++; continue; }

          // Model
          const modelSlug = slugify(p.model);
          const modelId = getOrCreate(db,
            "vehicle_models", "make_id=? AND slug=?", [makeId, modelSlug],
            iModel, [genId("vmod"), makeId, JSON.stringify({en:p.model}), modelSlug]
          );
          if (!modelId) { stats.errors++; continue; }

          // Years
          const years=[];
          if(p.yearStart&&p.yearEnd){ for(let y=p.yearStart;y<=p.yearEnd;y++) years.push(y); }
          else if(p.yearStart) years.push(p.yearStart);
          else years.push(0);

          for (const yr of years) {
            const yearId = getOrCreate(db,
              "vehicle_years", "model_id=? AND year=?", [modelId, yr],
              iYear, [genId("vyr"), modelId, yr]
            );
            if (!yearId) { stats.errors++; continue; }

            const esId = getOrCreate(db,
              "vehicle_engine_sizes", "year_id=? AND displacement=?", [yearId,"standard"],
              iES, [genId("ves"), yearId]
            );
            if (!esId) { stats.errors++; continue; }

            iPV.run(productId, esId, p.position, rawLine.trim());
            stats.linked++;
          }
        } catch(e) {
          stats.errors++;
          console.error("错误: "+rawLine+" -> "+e.message);
        }
      }
    }
  });

  console.log("导入中...");
  run();

  console.log("\n完成!");
  console.log("  处理产品:   "+stats.products);
  console.log("  解析行:     "+stats.lines);
  console.log("  成功解析:   "+stats.parsed);
  console.log("  跳过:       "+stats.skipped);
  console.log("  无对应产品: "+stats.noProduct);
  console.log("  新增关联:   "+stats.linked);
  console.log("  错误:       "+stats.errors);

  const c={
    makes:  db.prepare("SELECT COUNT(*) AS c FROM vehicle_makes").get().c,
    models: db.prepare("SELECT COUNT(*) AS c FROM vehicle_models").get().c,
    years:  db.prepare("SELECT COUNT(*) AS c FROM vehicle_years").get().c,
    pv:     db.prepare("SELECT COUNT(*) AS c FROM product_vehicles").get().c,
  };
  console.log("\n数据库:");
  console.log("  makes:    "+c.makes);
  console.log("  models:   "+c.models);
  console.log("  years:    "+c.years);
  console.log("  product_vehicles: "+c.pv);
  db.close();
}

main();
