<script>
  let name = "hello world";
  let upper = "";
  function shout() {
    upper = name.toUpperCase();
  }
  function clean() {
    name = name.trim();
  }
</script>
<text on:select={shout} focusable>{name}</text>
<text>{upper}</text>
