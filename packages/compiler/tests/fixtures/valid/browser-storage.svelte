<script>
  let name = ""
  function saveName() {
    localStorage.setItem("name", name)
  }
  function loadName() {
    name = localStorage.getItem("name")
  }
</script>
<text>{name}</text>
<rectangle focusable on:select={saveName} width="200" height="50" color="#333333">
  <text>Save</text>
</rectangle>
