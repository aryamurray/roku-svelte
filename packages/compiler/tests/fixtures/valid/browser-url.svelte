<script>
  let path = ""
  function getPath() {
    path = window.location.pathname
  }
</script>
<text>{path}</text>
<rectangle focusable on:select={getPath} width="200" height="50" color="#333333">
  <text>Get Path</text>
</rectangle>
