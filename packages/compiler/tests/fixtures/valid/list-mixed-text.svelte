<script>
  let items = [
    { title: "Movie 1" },
    { title: "Movie 2" },
  ];
</script>
<list itemSize="[1920, 80]">
  {#each items as item}
    <text>Title: {item.title}</text>
  {/each}
</list>
