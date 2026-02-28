<script>
  let items = [{ title: "A" }, { title: "B" }, { title: "C" }];
  let count = 0;
  function addItem() {
    items.push({ title: "D" });
    count = items.length;
  }
  function removeItem() {
    items.pop();
  }
</script>
<list itemSize="[1920, 100]">
  {#each items as item}
    <text>{item.title}</text>
  {/each}
</list>
<text on:select={addItem} focusable>{count}</text>
