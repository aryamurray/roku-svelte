<script>
  let items = [
    { id: "1", title: "A" },
  ];
</script>
<list>
  {#each items as item (item.id)}
    <text>{item.title}</text>
  {/each}
</list>
