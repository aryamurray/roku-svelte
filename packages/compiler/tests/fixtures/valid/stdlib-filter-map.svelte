<script>
  let items = [{ title: "A", active: true }, { title: "B", active: false }, { title: "C", active: true }];
  function filterActive() {
    items = items.filter(x => x.active);
  }
</script>
<list itemSize="[1920, 100]">
  {#each items as item}
    <text>{item.title}</text>
  {/each}
</list>
<text on:select={filterActive} focusable>Filter</text>
