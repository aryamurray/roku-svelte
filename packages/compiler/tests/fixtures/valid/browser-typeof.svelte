<script>
  let count = 0
  function check() {
    count = typeof window !== "undefined" ? 1 : 0
  }
</script>
<text>{count}</text>
<rectangle focusable on:select={check} width="200" height="50" color="#333333">
  <text>Check</text>
</rectangle>
