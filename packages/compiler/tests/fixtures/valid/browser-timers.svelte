<script>
  let count = 0
  function startTimer() {
    setTimeout(increment, 1000)
  }
  function increment() {
    count++
  }
  function startInterval() {
    setInterval(increment, 500)
  }
</script>
<text>{count}</text>
<rectangle focusable on:select={startTimer} width="200" height="50" color="#333333">
  <text>Start</text>
</rectangle>
