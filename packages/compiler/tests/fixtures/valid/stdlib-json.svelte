<script>
  let data = "";
  let output = "";
  function parseData() {
    output = JSON.stringify(data);
  }
</script>
<text on:select={parseData} focusable>{output}</text>
