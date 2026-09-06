a=open("/var/www/zagbrakes/admin.html").read()
old="""  body.auth-passed #productFormWrap {
    display: block;
  }"""
new="""  body.auth-passed #productFormWrap {
    display: block !important;
  }
  body.auth-passed #tab-products {
    display: block !important;
  }
  body.auth-passed #tab-categories {
    display: block !important;
  }"""
a=a.replace(old,new)
open("/var/www/zagbrakes/admin.html","w").write(a)
print("fixed")
