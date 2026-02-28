<script>
  let items = getSomething();
</script>
<list>
  {#each items as item}
    <text>{item.title}</text>
  {/each}
</list>
