<script>
  let items = [
    { title: "Item A" },
    { title: "Item B" },
  ];
</script>
<list itemSize="[1920, 150]">
  {#each items as item}
    <text>{item.title}</text>
  {/each}
</list>
