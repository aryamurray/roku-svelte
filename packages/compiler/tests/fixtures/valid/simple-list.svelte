<script>
  let items = [
    { title: "Movie 1" },
    { title: "Movie 2" },
  ];
</script>
<list>
  {#each items as item}
    <text>{item.title}</text>
  {/each}
</list>
