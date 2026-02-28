<script>
  let items = fetch("/api/items")
</script>
<list>
  {#each items as item}
    <text>{item.name}</text>
  {/each}
</list>
