<script>
  let items = [
    { title: "A" },
  ];
</script>
<list>
  {#each items as item, i}
    <text>{item.title}</text>
  {/each}
</list>
