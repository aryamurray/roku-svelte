<script>
  let active = true;
  function toggle() { active = !active; }
</script>
<rectangle visible={active} on:select={toggle} focusable width="100" height="50" />
