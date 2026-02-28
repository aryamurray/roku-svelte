<script>
  let count = 0
  let movies = fetch("/api/movies")
</script>
<text>{count}</text>
<list itemSize="[1920, 100]">
  {#each movies as movie}
    <text>{movie.title}</text>
  {/each}
</list>
