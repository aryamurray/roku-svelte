<script>
  let items = [
    { title: "A" },
  ];
</script>
<group>
  {#each items as item}
    <text>{item.title}</text>
  {/each}
</group>
