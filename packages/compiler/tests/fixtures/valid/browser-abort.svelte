<script>
  let count = 0
  function doSomething() {
    count++
  }
</script>
<text>{count}</text>
<rectangle focusable on:select={doSomething} width="200" height="50" color="#333333">
  <text>Go</text>
</rectangle>
