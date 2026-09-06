# 1. fix server: use req.locale() for vehicle names
s=open("/var/www/zagbrakes/server.js").read()
s=s.replace("{make:v.make_name,model:v.model_name,year:v.year,engine:v.displacement,position:v.position}","{make:req.locale(v.make_name),model:req.locale(v.model_name),year:v.year,engine:v.displacement||'N/A',position:v.position}")
open("/var/www/zagbrakes/server.js","w").write(s)
print("server fixed")

# 2. fix index: add crossRefs to modal
idx=open("/var/www/zagbrakes/index.html").read()
m="if(p.vehicles&&p.vehicles.length){h+='<div class=\"md\"><b>Vehicle Fitment:</b><br>'"
new_code="if(p.crossRefs&&p.crossRefs.length){h+='<div class=\"md\"><b>Cross References:</b><br>';p.crossRefs.forEach(function(cr){h+=esc(cr.ref_type)+': '+esc(cr.ref_number)+(cr.brand?' ('+esc(cr.brand)+')':'')+'<br>'});h+='</div>'};if(p.vehicles&&p.vehicles.length){h+='<div class=\"md\"><b>Vehicle Fitment:</b><br>'"
idx=idx.replace(m,new_code)
open("/var/www/zagbrakes/index.html","w").write(idx)
print("index fixed")

# 3. fix admin: check csvPreview element
a=open("/var/www/zagbrakes/admin.html").read()
if "csvPreview" in a:
    print("admin OK: csvPreview present")
else:
    print("admin FAIL: csvPreview missing")
