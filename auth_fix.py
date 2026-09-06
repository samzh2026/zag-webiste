"""
Admin login security fix - Two-step approach:
1. CSS: Default-lock all admin panels with !important
2. JS: Only unlock when showAdmin() successfully runs
"""
import os
BASE = "/var/www/zagbrakes"

with open(f"{BASE}/admin.html", "r", encoding="utf-8") as f:
    content = f.read()

# Step 1: Inject security CSS
security_css = """
  /* ZAG Security: default-lock all admin areas */
  #adminTabs, #tab-products, #productFormWrap, #tab-categories {
    display: none !important;
  }
  /* Only unlock when auth-passed */
  body.auth-passed #adminTabs {
    display: block !important;
  }
  body.auth-passed .tab-panel.active {
    display: block !important;
  }
  body.auth-passed #productFormWrap {
    display: block;
  }
"""

if "auth-passed" not in content:
    content = content.replace("</style>", security_css + "\n</style>", 1)
    print("CSS lock injected")
else:
    print("CSS lock already exists")

# Step 2: Modify showAdmin() - add auth-passed class, hide loginPanel via style
content = content.replace(
    "function showAdmin() {\n    loginPanel.classList.add(\"hidden\");",
    "function showAdmin() {\n    document.body.classList.add(\"auth-passed\");\n    document.getElementById(\"loginPanel\").style.display = \"none\";"
)

# Step 3: Modify showLogin() - remove auth-passed class, show loginPanel via style
content = content.replace(
    "function showLogin() {\n    loginPanel.classList.remove(\"hidden\");",
    "function showLogin() {\n    document.body.classList.remove(\"auth-passed\");\n    document.getElementById(\"loginPanel\").style.display = \"block\";"
)

# Step 4: Ensure csvPreview element exists
if '<div id="csvPreview"' not in content:
    content = content.replace("</body>", '<div id="csvPreview" style="display:none"><table id="csvPreviewTable"></table></div>\n</body>')

# Step 5: At page load, default to locked state (remove any stale auth-passed)
init_code = '\n  document.body.classList.remove("auth-passed");\n  document.getElementById("loginPanel").style.display = "block";'
content = content.replace(
    "var tokenKey = \"zagAdminToken\";",
    "var tokenKey = \"zagAdminToken\";" + init_code
)

with open(f"{BASE}/admin.html", "w", encoding="utf-8") as f:
    f.write(content)

print("All done! Admin security fixed.")
