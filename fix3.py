# Fix server.js: convert image objects to URL strings
c = open("/var/www/zagbrakes/server.js").read()
old = "  res.json(p);\n});"
new = "  p.images = (product.images || []).map(function(i) { return i.url; });\n  p.vehicles = (product.vehicles || []).map(function(v) { return {make:v.make_name,model:v.model_name,year:v.year,engine:v.displacement,position:v.position}; });\n  res.json(p);\n});"
c = c.replace(old, new, 1)
open("/var/www/zagbrakes/server.js", "w").write(c)

# Fix index.html: add vehicle info to modal
idx = open("/var/www/zagbrakes/index.html").read()
marker = "document.getElementById('modalDetails').innerHTML=h"
vehicle_code = "var vh='';if(p.vehicles&&p.vehicles.length){vh='<div class=md><b>Vehicle Fitment:</b><br>';p.vehicles.forEach(function(v){vh+=esc(v.make)+' '+esc(v.model)+' ('+esc(v.year)+') '+esc(v.engine)+' '+esc(v.position)+'<br>'});vh+='</div>';h+=vh};"
idx = idx.replace(marker, vehicle_code + marker)
open("/var/www/zagbrakes/index.html", "w").write(idx)

print("OK")

