<script>
  let result = ""
  function encode() {
    result = btoa("hello")
  }
</script>
<text>{result}</text>
<rectangle focusable on:select={encode} width="200" height="50" color="#333333">
  <text>Encode</text>
</rectangle>
