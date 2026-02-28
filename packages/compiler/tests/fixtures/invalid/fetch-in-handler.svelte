<script>
  let count = 0
  function handler() {
    fetch("/api")
  }
</script>
<text on:select={handler} focusable>{count}</text>
