<script>
  let timestamp = 0
  function updateTime() {
    timestamp = Date.now()
  }
</script>
<text>{timestamp}</text>
<rectangle focusable on:select={updateTime} width="200" height="50" color="#333333">
  <text>Update</text>
</rectangle>
