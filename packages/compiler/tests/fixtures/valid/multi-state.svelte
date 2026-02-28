<script>
  let count = 0;
  let label = "hello";
  let visible = true;
  function increment() { count++; }
</script>
<text on:select={increment} focusable>{count}</text>
