<script>
  let count = 0;
  function bad() {
    count = Math.hypot(3, 4);
  }
</script>
<text on:select={bad} focusable>{count}</text>
