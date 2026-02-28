<script>
  let count = 0;
  function increment() {
    count++;
    console.log(count);
  }
</script>
<text on:select={increment} focusable>{count}</text>
