import { describe, it, expect } from 'vitest';
import { compile } from '../src/index.js';

describe('compile {#if} blocks', () => {
	it('compiles simple {#if}', async () => {
		const source = `
<script>
let show = true;
</script>
{#if show}
  <text>Visible</text>
{/if}
`.trim();

		const result = await compile(source, 'Test.svelte');

		expect(result.errors).toHaveLength(0);

		// XML should contain Group wrapper with if_0_0 id
		expect(result.xml).toContain('<Group id="if_0_0" visible="true">');

		// XML should contain Label inside the group
		expect(result.xml).toContain('<Label');

		// BrightScript should reference state.show for visibility binding
		expect(result.brightscript).toContain('m.state.show');
	});

	it('compiles {#if}/{:else}', async () => {
		const source = `
<script>
let active = true;
</script>
{#if active}
  <text>Yes</text>
{:else}
  <text>No</text>
{/if}
`.trim();

		const result = await compile(source, 'Test.svelte');

		expect(result.errors).toHaveLength(0);

		// XML should have two Groups: if_0_0 (visible=true) and if_0_1 (visible=false)
		expect(result.xml).toContain('<Group id="if_0_0" visible="true">');
		expect(result.xml).toContain('<Group id="if_0_1" visible="false">');

		// BrightScript should bind if_0_0.visible to state and if_0_1.visible to not state
		expect(result.brightscript).toContain('m.if_0_0.visible');
		expect(result.brightscript).toContain('m.if_0_1.visible');
		expect(result.brightscript).toContain('m.state.active');
	});

	it('compiles {#if}/{:else if}/{:else}', async () => {
		const source = `
<script>
let mode = 0;
</script>
{#if mode === 0}
  <text>Off</text>
{:else if mode === 1}
  <text>Low</text>
{:else}
  <text>High</text>
{/if}
`.trim();

		const result = await compile(source, 'Test.svelte');

		expect(result.errors).toHaveLength(0);

		// XML should have three Groups: if_0_0, if_0_1, if_0_2
		expect(result.xml).toContain('<Group id="if_0_0"');
		expect(result.xml).toContain('<Group id="if_0_1"');
		expect(result.xml).toContain('<Group id="if_0_2"');
	});

	it('compiles nested {#if}', async () => {
		const source = `
<script>
let a = true;
let b = true;
</script>
{#if a}
  {#if b}
    <text>Both</text>
  {/if}
{/if}
`.trim();

		const result = await compile(source, 'Test.svelte');

		expect(result.errors).toHaveLength(0);

		// XML should have nested groups (if_0_0 wrapping if_1_0)
		expect(result.xml).toContain('<Group id="if_0_0"');
		expect(result.xml).toContain('<Group id="if_1_0"');

		// The outer group should contain the inner group
		const outerGroupStart = result.xml.indexOf('<Group id="if_0_0"');
		const innerGroupStart = result.xml.indexOf('<Group id="if_1_0"');
		const outerGroupEnd = result.xml.indexOf('</Group>', outerGroupStart);

		expect(innerGroupStart).toBeGreaterThan(outerGroupStart);
		expect(innerGroupStart).toBeLessThan(outerGroupEnd);
	});

	it('compiles multiple independent {#if} blocks', async () => {
		const source = `
<script>
let x = true;
let y = true;
</script>
{#if x}
  <text>X</text>
{/if}
{#if y}
  <text>Y</text>
{/if}
`.trim();

		const result = await compile(source, 'Test.svelte');

		expect(result.errors).toHaveLength(0);

		// XML should have if_0_0 and if_1_0 (two independent blocks)
		expect(result.xml).toContain('<Group id="if_0_0"');
		expect(result.xml).toContain('<Group id="if_1_0"');

		// BrightScript should reference both state.x and state.y
		expect(result.brightscript).toContain('m.state.x');
		expect(result.brightscript).toContain('m.state.y');
	});
});
