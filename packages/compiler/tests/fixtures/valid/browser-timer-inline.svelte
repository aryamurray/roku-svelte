<script>
  let count = 0
  function startTimer() {
    setTimeout(() => { count++ }, 1000)
  }
</script>
<text>{count}</text>
<rectangle focusable on:select={startTimer} width="200" height="50" color="#333333">
  <text>Start</text>
</rectangle>
