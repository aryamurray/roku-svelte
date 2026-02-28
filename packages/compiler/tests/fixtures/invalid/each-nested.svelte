<script>
  let items = [
    { title: "A" },
  ];
  let nested = [
    { name: "B" },
  ];
</script>
<list>
  {#each items as item}
    <list>
      {#each nested as n}
        <text>{n.name}</text>
      {/each}
    </list>
  {/each}
</list>
