<script>
  let count = 0;
  let items = [
    { title: "A" },
  ];
</script>
<list>
  {#each items as item}
    <text>{count}</text>
  {/each}
</list>
