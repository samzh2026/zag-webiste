idx = open("/var/www/zagbrakes/index.html").read()

# Use a unique marker from the modal code
marker = 'document.getElementById("modalDetails").innerHTML=h'
new_code = """var vh='';if(p.vehicles&&p.vehicles.length){vh+='<div class=md><b>Vehicle Fitment:</b><br>';for(var i=0;i<p.vehicles.length;i++){var v=p.vehicles[i];vh+=esc(v.make)+' '+esc(v.model)+' ('+esc(v.year)+') '+esc(v.engine)+' '+esc(v.position)+'<br>'};vh+='</div>'};h+=vh;var ch='';if(p.crossRefs&&p.crossRefs.length){ch+='<div class=md><b>Cross References:</b><br>';for(var i=0;i<p.crossRefs.length;i++){var cr=p.crossRefs[i];ch+=esc(cr.ref_type)+': '+esc(cr.ref_number)+(cr.brand?' ('+esc(cr.brand)+')':'')+'<br>'};ch+='</div>'};h+=ch;"""
idx = idx.replace(marker, marker + new_code)
open("/var/www/zagbrakes/index.html", "w").write(idx)
print("OK")

