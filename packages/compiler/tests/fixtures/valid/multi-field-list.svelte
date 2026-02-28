<script>
  let items = [
    { title: "Movie 1", year: "2024" },
    { title: "Movie 2", year: "2023" },
  ];
</script>
<list itemSize="[1920, 100]">
  {#each items as item}
    <text>{item.title}</text>
    <text>{item.year}</text>
  {/each}
</list>
