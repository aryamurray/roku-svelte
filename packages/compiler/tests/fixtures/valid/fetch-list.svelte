<script>
  let movies = fetch("/api/movies")
</script>
<list itemSize="[1920, 100]">
  {#each movies as movie}
    <text>{movie.title}</text>
    <text>{movie.year}</text>
  {/each}
</list>
