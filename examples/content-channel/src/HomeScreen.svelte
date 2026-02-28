<script>
  let items = fetch('https://api.example.com/content');

  function onSelect() {
    localStorage.setItem('lastViewed', 'selected');
  }
</script>

<screen>
  <roku>
    <list itemSize="[1920,120]">
      {#each items as item}
        <label text={item.title} on:select={onSelect} />
      {/each}
    </list>
  </roku>

  <web>
    <p>Content Channel - Web Preview</p>
  </web>
</screen>
