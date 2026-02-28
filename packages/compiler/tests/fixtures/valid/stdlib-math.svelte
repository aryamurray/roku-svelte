<script>
  let score = 95.7;
  let rounded = 0;
  function compute() {
    rounded = Math.floor(score);
  }
</script>
<text on:select={compute} focusable>{rounded}</text>
