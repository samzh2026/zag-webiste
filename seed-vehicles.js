// Seed vehicle database with common motorcycle makes and models
const store = require("./lib/store");

const makes = [
  { name: { en: "Honda" }, slug: "honda" },
  { name: { en: "Yamaha" }, slug: "yamaha" },
  { name: { en: "Suzuki" }, slug: "suzuki" },
  { name: { en: "Kawasaki" }, slug: "kawasaki" },
  { name: { en: "BMW" }, slug: "bmw" },
  { name: { en: "KTM" }, slug: "ktm" },
  { name: { en: "Ducati" }, slug: "ducati" },
  { name: { en: "Harley-Davidson" }, slug: "harley-davidson" },
  { name: { en: "Triumph" }, slug: "triumph" },
  { name: { en: "Can-Am" }, slug: "can-am" },
  { name: { en: "Polaris" }, slug: "polaris" },
  { name: { en: "CFMOTO" }, slug: "cfmoto" }
];

const modelsByMake = {
  honda: ["PCX125", "PCX150", "CBR600RR", "CBR1000RR", "CB400", "CB650R", "CRF250R", "CRF450R", "FourTrax 400", "Pioneer 1000"],
  yamaha: ["YZF-R1", "YZF-R6", "MT-07", "MT-09", "YZ450F", "YZ250F", "Grizzly 700", "Raptor 700"],
  suzuki: ["GSX-R600", "GSX-R1000", "RM-Z450", "KingQuad 750", "Burgman 400"],
  kawasaki: ["Ninja 400", "Ninja ZX-6R", "KX450", "Brute Force 750"],
  bmw: ["S1000RR", "R1250GS", "F850GS", "G310R"],
  ktm: ["450 SX-F", "890 Adventure", "1290 Super Duke", "350 EXC-F"],
  ducati: ["Panigale V4", "Monster 937", "Multistrada V4", "Scrambler 800"],
  "harley-davidson": ["Street Glide", "Road King", "Sportster S", "Pan America"],
  triumph: ["Street Triple", "Tiger 900", "Bonneville T120", "Scrambler 1200"],
  "can-am": ["Outlander 850", "Renegade 1000", "Maverick X3", "Commander 1000"],
  polaris: ["Sportsman 570", "RZR XP 1000", "Ranger 1000", "Scrambler 850"],
  cfmoto: ["CFORCE 600", "ZFORCE 950", "NK450", "800MT"]
};

console.log("Seeding vehicle makes...");
for (const m of makes) {
  try { store.createMake(m); } catch (e) { /* already exists */ }
}

console.log("Seeding models...");
const allMakes = store.getMakes();
for (const make of allMakes) {
  const parsed = JSON.parse(make.name || "{}");
  const slug = make.slug;
  const models = modelsByMake[slug] || modelsByMake[parsed.en?.toLowerCase()] || [];
  for (const modelName of models) {
    try {
      store.createModel({ makeId: make.id, name: { en: modelName }, slug: modelName.toLowerCase().replace(/[^a-z0-9]+/g, "-") });
    } catch (e) { /* already exists */ }
  }
}

console.log("Seed complete.");
console.log(`Makes: ${store.getMakes().length}`);
const honda = allMakes.find(m => m.slug === "honda");
if (honda) console.log(`Honda models: ${store.getModels(honda.id).length}`);
