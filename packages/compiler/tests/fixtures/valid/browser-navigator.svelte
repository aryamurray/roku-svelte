<script>
  let agent = ""
  function detect() {
    agent = navigator.userAgent
  }
</script>
<text>{agent}</text>
<rectangle focusable on:select={detect} width="200" height="50" color="#333333">
  <text>Detect</text>
</rectangle>
