import { describe, it, expect } from 'vitest';
import { compile } from '../src/index.js';

describe('Reactive Declarations ($:)', () => {
	it('should compile basic derived state', async () => {
		const source = `
<script>
let count = 1;
$: doubled = count * 2;
</script>
<text>{doubled}</text>
`;

		const result = await compile(source, 'Test.svelte');

		expect(result.errors).toHaveLength(0);
		expect(result.warnings).toHaveLength(0);

		// Should contain derived recomputation
		expect(result.brightscript).toContain('m.state.doubled = (m.state.count * 2)');

		// Should mark derived as dirty
		expect(result.brightscript).toContain('m.state.dirty.doubled = true');

		// Should have initial state with doubled
		expect(result.brightscript).toMatch(/m\.state\s*=\s*\{[\s\S]*doubled[\s\S]*\}/);
	});

	it('should compile multi-dependency derived state', async () => {
		const source = `
<script>
let a = 1;
let b = 2;
$: sum = a + b;
</script>
<text>{sum}</text>
`;

		const result = await compile(source, 'Test.svelte');

		expect(result.errors).toHaveLength(0);
		expect(result.warnings).toHaveLength(0);

		// Should check both dependencies
		expect(result.brightscript).toMatch(/m\.state\.dirty\.a\s+or\s+m\.state\.dirty\.b/);

		// Should contain derived computation
		expect(result.brightscript).toContain('m.state.sum = (m.state.a + m.state.b)');

		// Should mark sum as dirty
		expect(result.brightscript).toContain('m.state.dirty.sum = true');
	});

	it('should bind template to derived state', async () => {
		const source = `
<script>
let count = 5;
$: doubled = count * 2;
</script>
<text>{doubled}</text>
`;

		const result = await compile(source, 'Test.svelte');

		expect(result.errors).toHaveLength(0);
		expect(result.warnings).toHaveLength(0);

		// Should contain binding that updates text with derived value
		expect(result.brightscript).toContain('m.state.doubled');

		// Should have text field binding
		expect(result.xml).toContain('<Label');
		expect(result.xml).toContain('id="label_');
	});

	it('should recompute derived when handler mutates source', async () => {
		const source = `
<script>
let count = 0;
$: doubled = count * 2;
function inc() {
  count = count + 1;
}
</script>
<text>{doubled}</text>
`;

		const result = await compile(source, 'Test.svelte');

		expect(result.errors).toHaveLength(0);
		expect(result.warnings).toHaveLength(0);

		// Handler should exist
		expect(result.brightscript).toContain('function inc()');

		// Handler should mutate count
		expect(result.brightscript).toContain('m.state.count = m.state.count + 1');

		// Should mark count as dirty
		expect(result.brightscript).toContain('m.state.dirty.count = true');

		// Should have derived recomputation
		expect(result.brightscript).toContain('m.state.doubled = (m.state.count * 2)');

		// Should mark doubled as dirty
		expect(result.brightscript).toContain('m.state.dirty.doubled = true');
	});

	it('should compile boolean derived state', async () => {
		const source = `
<script>
let count = 0;
$: isPositive = count > 0;
</script>
<text>{count}</text>
`;

		const result = await compile(source, 'Test.svelte');

		expect(result.errors).toHaveLength(0);
		expect(result.warnings).toHaveLength(0);

		// Should contain boolean expression
		expect(result.brightscript).toContain('m.state.isPositive = (m.state.count > 0)');

		// Should mark as dirty
		expect(result.brightscript).toContain('m.state.dirty.isPositive = true');

		// Should have initial state with isPositive
		expect(result.brightscript).toMatch(/m\.state\s*=\s*\{[\s\S]*isPositive[\s\S]*\}/);
	});
});
