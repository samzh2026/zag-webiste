import os
BASE = "/var/www/zagbrakes"

# 1. Make cards clickable
with open(f"{BASE}/index.html") as f:
    idx = f.read()

old = '<div class="card">'
new = '<div class="card" onclick="cardClick(this)">'
idx = idx.replace(old, new)

# 2. Add modal HTML before </body>
modal = '''
<div class="modal-overlay" id="productModal" onclick="if(event.target===this)closeModal()">
  <div class="modal-content">
    <button class="modal-close" onclick="closeModal()">X</button>
    <div class="modal-image" id="modalImage">
      <button class="nav-arrow nav-prev" id="modalPrev" onclick="modalPrev()"><</button>
      <img id="modalMainImg" src="" alt="">
      <span class="img-counter" id="modalCounter"></span>
      <button class="nav-arrow nav-next" id="modalNext" onclick="modalNext()">></button>
    </div>
    <div class="modal-details" id="modalDetails"></div>
  </div>
</div>
'''
idx = idx.replace("</body>", modal + "</body>")

# 3. Add CSS before </style>
css = '''
.modal-overlay{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9999;justify-content:center;align-items:center;overflow-y:auto}
.modal-overlay.active{display:flex}
.modal-content{display:flex;flex-wrap:wrap;background:white;max-width:960px;width:95%;margin:40px auto;position:relative;border:3px solid var(--zag-red);animation:modalIn .3s ease-out}
@keyframes modalIn{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
.modal-close{position:absolute;top:10px;right:15px;z-index:10;background:var(--zag-red);color:white;border:none;font-size:24px;width:40px;height:40px;cursor:pointer;font-weight:bold;line-height:1}
.modal-image{flex:1 1 55%;min-width:300px;background:#000;display:flex;align-items:center;justify-content:center;position:relative;min-height:400px}
.modal-image img{max-width:100%;max-height:500px;object-fit:contain}
.modal-image .nav-arrow{position:absolute;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);color:white;border:none;font-size:30px;cursor:pointer;padding:10px 15px;z-index:5}
.modal-image .nav-prev{left:10px}
.modal-image .nav-next{right:10px}
.modal-image .img-counter{position:absolute;bottom:10px;right:15px;color:white;font-size:13px;font-family:Arial,sans-serif;background:rgba(0,0,0,0.6);padding:3px 10px;border-radius:10px}
.modal-details{flex:1 1 40%;min-width:280px;padding:30px;font-family:Arial,sans-serif;overflow-y:auto;max-height:550px}
.modal-details h3{font-family:Arial Black;font-size:20px;margin-bottom:5px}
.modal-details .sku{color:var(--zag-red);font-weight:bold;font-size:14px;margin-bottom:15px}
.modal-details .spec-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}
.modal-details .spec-label{color:#888;font-weight:bold}
.modal-details .spec-value{color:#333}
.modal-details .md{font-family:Arial;margin-top:15px;line-height:1.6;color:#555}
.pagination{display:flex;justify-content:center;align-items:center;gap:8px;margin-top:30px;padding:20px}
.pagination button{padding:8px 16px;border:1px solid #ddd;background:white;cursor:pointer;font-family:Arial;font-size:14px;min-width:40px}
.pagination button:hover{background:#f0f0f0}
.pagination button.active{background:var(--zag-red);color:white;border-color:var(--zag-red)}
.pagination button:disabled{opacity:.4;cursor:not-allowed}
.pagination .pi{font-family:Arial;font-size:13px;color:#888;margin-left:10px}
@media(max-width:768px){.modal-content{flex-direction:column}.modal-image{min-height:250px}.modal-image img{max-height:300px}.modal-details{max-height:none}}
'''
idx = idx.replace("</style>", css + "</style>")

# 4. Add JS before loadProducts();
js = '''
var mdlImgs=[],mdlIdx=0;
function cardClick(el){var pid=el.getAttribute("data-pid");if(pid)openModal(pid)}
function openModal(pid){
 var o=document.getElementById("productModal");o.classList.add("active");
 document.getElementById("modalMainImg").src="";
 document.getElementById("modalDetails").innerHTML='<div class="loading">Loading...</div>';
 document.getElementById("modalPrev").style.display="none";
 document.getElementById("modalNext").style.display="none";
 document.body.style.overflow="hidden";
 fetch("/api/products/"+pid).then(function(r){return r.json()}).then(function(p){
  mdlImgs=p.images||[];mdlIdx=0;updMdlImg();
  if(mdlImgs.length>1){document.getElementById("modalPrev").style.display="block";document.getElementById("modalNext").style.display="block"}
  var h="<h3>"+esc(p.name)+"</h3>";
  if(p.sku)h+='<div class="sku">'+esc(p.sku)+'</div>';
  if(p.brand)h+='<div class="spec-row"><span class="spec-label">Brand</span><span class="spec-value">'+esc(p.brand)+'</span></div>';
  if(p.material)h+='<div class="spec-row"><span class="spec-label">Material</span><span class="spec-value">'+esc(p.material)+'</span></div>';
  if(p.description)h+='<div class="md"><b>Description:</b><br>'+esc(p.description)+'</div>';
  if(p.specifications)h+='<div class="md"><b>Specs:</b><br>'+esc(p.specifications)+'</div>';
  document.getElementById("modalDetails").innerHTML=h
 }).catch(function(){document.getElementById("modalDetails").innerHTML='<div class="empty">Load failed</div>'})
}
function closeModal(){document.getElementById("productModal").classList.remove("active");document.body.style.overflow="";mdlImgs=[];mdlIdx=0}
function updMdlImg(){if(!mdlImgs.length){document.getElementById("modalMainImg").src="";return}document.getElementById("modalMainImg").src=mdlImgs[mdlIdx];document.getElementById("modalCounter").textContent=(mdlIdx+1)+"/"+mdlImgs.length}
function modalNext(){if(mdlImgs.length<=1)return;mdlIdx=(mdlIdx+1)%mdlImgs.length;updMdlImg()}
function modalPrev(){if(mdlImgs.length<=1)return;mdlIdx=(mdlIdx-1+mdlImgs.length)%mdlImgs.length;updMdlImg()}
document.addEventListener("keydown",function(e){if(e.key==="Escape")closeModal();if(e.key==="ArrowRight")modalNext();if(e.key==="ArrowLeft")modalPrev()});
function esc(v){return String(v||"").replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}

var catId=null,catPage=1,catLimit=12;
function showCatPage(cid,pg){
 pg=pg||1;catId=cid;catPage=pg;
 var c=document.getElementById("products-container");
 c.innerHTML='<div class="loading">Loading...</div>';
 fetch("/api/catalog?category="+cid+"&page="+pg+"&limit="+catLimit).then(function(r){return r.json()}).then(function(d){
  var cn=d.categories.find(function(x){return x.id===cid});
  var nm=cn?cn.name:"Products";
  if(!d.products.length){c.innerHTML='<button class="back-btn" onclick="showAllCategories()">Back</button><div class="empty">No products</div>';document.getElementById("pagination-container").innerHTML="";return}
  var h='<button class="back-btn" onclick="showAllCategories()">Back</button><h3>'+esc(nm)+'</h3><div class="grid">';
  d.products.forEach(function(p){h+=renderProductCardPC(p,nm)});
  h+="</div>";c.innerHTML=h;bindCardDots();
  renderPg(d.pagination,cid);
  c.scrollIntoView({behavior:"smooth"})
 }).catch(function(e){c.innerHTML='<div class="empty">Error: '+esc(e.message)+'</div>'})
}
function showCategoryProducts(cid){showCatPage(cid,1)}
function renderPg(pg,cid){
 var c=document.getElementById("pagination-container");
 if(!pg||pg.totalPages<=1){c.innerHTML="";return}
 var h='<div class="pagination">';
 h+='<button '+(pg.page<=1?"disabled":"")+' onclick="showCatPage(catId,'+(pg.page-1)+')">Prev</button>';
 var s=Math.max(1,pg.page-2),e=Math.min(pg.totalPages,pg.page+2);
 if(s>1){h+='<button onclick="showCatPage(catId,1)">1</button>';if(s>2)h+='<span class="pi">...</span>'}
 for(var i=s;i<=e;i++)h+='<button class="'+(i===pg.page?"active":"")+'" onclick="showCatPage(catId,'+i+')">'+i+'</button>';
 if(e<pg.totalPages){if(e<pg.totalPages-1)h+='<span class="pi">...</span>';h+='<button onclick="showCatPage(catId,'+pg.totalPages+')">'+pg.totalPages+'</button>'}
 h+='<button '+(pg.page>=pg.totalPages?"disabled":"")+' onclick="showCatPage(catId,'+(pg.page+1)+')">Next</button>';
 h+='<span class="pi">'+pg.total+' products</span></div>';
 c.innerHTML=h
}
function renderProductCardPC(pr,cn){
 var imgs=pr.images||[],ih="",dh="";
 if(imgs.length){ih=imgs.map(function(s,i){return'<img class="'+(i===0?"active":"inactive")+'" src="'+esc(s)+'" alt="'+esc(pr.name)+'" loading="lazy">'}).join("")}
 else ih='<div class="no-img">No image</div>';
 if(imgs.length>1){dh='<div class="card-dots">'+imgs.map(function(_,i){return'<span class="dot '+(i===0?"active":"")+'" data-dot="'+i+'"></span>'}).join("")+'</div>'}
 return'<div class="card" data-pid="'+esc(pr.id)+'" onclick="cardClick(this)"><div class="card-images">'+ih+dh+'</div><div class="card-header">'+esc(cn||pr.name)+'</div><div class="card-body"><p><strong>'+esc(pr.name)+'</strong></p>'+(pr.sku?'<p class="material">SKU: '+esc(pr.sku)+'</p>':'')+(pr.material?'<p class="material">'+esc(pr.material)+'</p>':'')+'</div></div>'
}
var pc=document.createElement("div");pc.id="pagination-container";document.getElementById("products").appendChild(pc);
'''
idx = idx.replace("loadProducts();", js + "\n  loadProducts();")

# 5. Fix categoryId
idx = idx.replace("p.categoryId === categoryId", "(p.categoryId || p.category_id) === categoryId")

with open(f"{BASE}/index.html", "w") as f:
    f.write(idx)
print("index.html updated OK")
