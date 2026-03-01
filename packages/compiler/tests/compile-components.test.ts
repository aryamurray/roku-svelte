import { describe, it, expect } from 'vitest';
import { compile } from '../src/index.js';

describe('Component Composition', () => {
	it('should import and use child component with static props', async () => {
		const source = `
<script>
import Card from './Card.svelte';
</script>
<Card title="Hello" />
		`.trim();

		const result = await compile(source, 'Test.svelte');

		expect(result.errors).toHaveLength(0);
		expect(result.xml).toContain('<Card');
		expect(result.xml).toContain('title="Hello"');
		expect(result.componentImports).toBeDefined();
		expect(result.componentImports).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: 'Card',
					path: './Card.svelte'
				})
			])
		);
	});

	it('should handle dynamic props', async () => {
		const source = `
<script>
import Card from './Card.svelte';
let msg = "Hi";
</script>
<Card title={msg} />
		`.trim();

		const result = await compile(source, 'Test.svelte');

		expect(result.errors).toHaveLength(0);
		expect(result.brightscript).toContain('title');
		expect(result.componentImports).toBeDefined();
		expect(result.componentImports).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: 'Card',
					path: './Card.svelte'
				})
			])
		);
	});

	it('should handle export let (child component perspective)', async () => {
		const source = `
<script>
export let title = "Default";
export let count = 0;
</script>
<text>{title}</text>
		`.trim();

		const result = await compile(source, 'Child.svelte');

		expect(result.errors).toHaveLength(0);
		expect(result.xml).toContain('<interface>');
		expect(result.xml).toContain('<field id="title"');
		expect(result.xml).toContain('<field id="count"');
		expect(result.brightscript).toContain('m.state.title = m.top.title');
		expect(result.brightscript).toContain('sub onPropChanged()');
	});

	it('should handle export let with boolean type', async () => {
		const source = `
<script>
export let visible = true;
</script>
<rectangle visible={visible} />
		`.trim();

		const result = await compile(source, 'Child.svelte');

		expect(result.errors).toHaveLength(0);
		expect(result.xml).toContain('<interface>');
		expect(result.xml).toContain('type="boolean"');
	});

	it('should handle multiple component uses', async () => {
		const source = `
<script>
import Card from './Card.svelte';
import Badge from './Badge.svelte';
let label = "test";
</script>
<Card title="A" />
<Badge text={label} />
		`.trim();

		const result = await compile(source, 'Test.svelte');

		expect(result.errors).toHaveLength(0);
		expect(result.xml).toContain('Card');
		expect(result.xml).toContain('Badge');
		expect(result.componentImports).toBeDefined();
		expect(result.componentImports).toHaveLength(2);
		expect(result.componentImports).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: 'Card',
					path: './Card.svelte'
				}),
				expect.objectContaining({
					name: 'Badge',
					path: './Badge.svelte'
				})
			])
		);
	});

	it('should warn on unknown component (not imported)', async () => {
		const source = `
<script>
</script>
<Unknown />
		`.trim();

		const result = await compile(source, 'Test.svelte');

		expect(result.warnings.length).toBeGreaterThan(0);
		const unknownWarning = result.warnings.find((w) =>
			w.code === 'UNKNOWN_ELEMENT' || w.message.toLowerCase().includes('unknown')
		);
		expect(unknownWarning).toBeDefined();
	});
});
