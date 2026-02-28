<script>
  let count = 0;
  function increment() { count++; }
</script>
<text on:select={increment} focusable>{count}</text>
