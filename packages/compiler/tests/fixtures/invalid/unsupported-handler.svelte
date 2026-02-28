<script>
  let count = 0;
  function doSomething() { count = someFunction(count); }
</script>
<text on:select={doSomething} focusable>{count}</text>
