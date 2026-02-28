<script>
  let count = 0;
  function doSomething() { for (let i = 0; i < 10; i++) { count++; } }
</script>
<text on:select={doSomething} focusable>{count}</text>
