import sys, pathlib
core = pathlib.Path('_core.css').read_text(); panel = pathlib.Path('_panel.css').read_text()
def tabs(active, dirty=("layout","text")):
    ids=[("layout","배치"),("style","스타일"),("text","텍스트"),("screen","화면"),("modified","수정")]
    out='<div class="ptabs">'
    for i,l in ids:
        on=" on" if i==active else ""
        dot='<s></s>' if (i in dirty and i!=active) else ''
        out+=f'<div class="ptab{on}">{l}{dot}</div>'
    return out+'</div>'
def build(name,w,h,body):
    pathlib.Path(f'{name}.dc.html').write_text(f'''<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gothic+A1:wght@400;500;700;800&family=JetBrains+Mono:wght@400;500&display=swap">
  <style>
{core}{panel}  </style>
</helmet>
<div class="root {{{{themeClass}}}}">
{body}
</div>
</x-dc>
<script data-dc-script data-props='{{"dark":{{"editor":"boolean","default":false}},"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
  renderVals() {{
    return {{ themeClass: this.props.dark ? 'dark' : '' }};
  }}
}}
</script>
</body>
</html>
''')
    print(f'built {name}.dc.html')
