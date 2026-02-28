<script>
  let count = 0;
  function increment() { count++; }
</script>
<text on:select={increment} focusable autofocus>{count}</text>
