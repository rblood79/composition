#!/bin/bash
# $1 = name, $2 = width, $3 = height, body on stdin
name="$1"; w="$2"; h="$3"
{
cat <<HEAD
<!doctype html>
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
HEAD
cat _core.css
cat _panel.css
cat <<HEAD2
  </style>
</helmet>
<div class="root {{themeClass}}">
HEAD2
cat
cat <<FOOT
</div>
</x-dc>
<script data-dc-script data-props='{"dark":{"editor":"boolean","default":false},"\$preview":{"width":$w,"height":$h}}'>
class Component extends DCLogic {
  renderVals() {
    return { themeClass: this.props.dark ? 'dark' : '' };
  }
}
</script>
</body>
</html>
FOOT
} > "$name.dc.html"
echo "built $name.dc.html"
