import { describe, it, expect } from 'vitest';
import { compile } from '../src/index.js';

describe('Control Flow Compilation', () => {
	it('compiles if/else in handler', async () => {
		const source = `
<script>
let count = 0;
function toggle() {
  if (count > 5) {
    count = 0;
  } else {
    count = count + 1;
  }
}
</script>
<text>{count}</text>
`.trim();

		const result = await compile(source, 'Test.svelte');

		expect(result.errors).toEqual([]);
		expect(result.brightscript).toContain('if (m.state.count > 5) then');
		expect(result.brightscript).toContain('else');
		expect(result.brightscript).toContain('end if');
	});

	it('compiles if/else-if/else', async () => {
		const source = `
<script>
let mode = 0;
function cycle() {
  if (mode === 0) {
    mode = 1;
  } else if (mode === 1) {
    mode = 2;
  } else {
    mode = 0;
  }
}
</script>
<text>{mode}</text>
`.trim();

		const result = await compile(source, 'Test.svelte');

		expect(result.errors).toEqual([]);
		expect(result.brightscript).toContain('if (m.state.mode = 0) then');
		expect(result.brightscript).toContain('else if (m.state.mode = 1) then');
		expect(result.brightscript).toContain('else');
		expect(result.brightscript).toContain('end if');
	});

	it('compiles for-of loop', async () => {
		const source = `
<script>
let total = 0;
function sumItems() {
  let sum = 0;
  for (const item of [1, 2, 3]) {
    sum = sum + 1;
  }
  total = sum;
}
</script>
<text>{total}</text>
`.trim();

		const result = await compile(source, 'Test.svelte');

		expect(result.errors).toEqual([]);
		expect(result.brightscript).toContain('for each item in');
		expect(result.brightscript).toContain('end for');
	});

	it('compiles while loop', async () => {
		const source = `
<script>
let count = 10;
function countdown() {
  while (count > 0) {
    count = count - 1;
  }
}
</script>
<text>{count}</text>
`.trim();

		const result = await compile(source, 'Test.svelte');

		expect(result.errors).toEqual([]);
		expect(result.brightscript).toContain('while (m.state.count > 0)');
		expect(result.brightscript).toContain('end while');
	});

	it('compiles return statement', async () => {
		const source = `
<script>
let count = 0;
function inc() {
  if (count > 10) {
    return;
  }
  count = count + 1;
}
</script>
<text>{count}</text>
`.trim();

		const result = await compile(source, 'Test.svelte');

		expect(result.errors).toEqual([]);
		expect(result.brightscript).toContain('return');
		expect(result.brightscript).toContain('if (m.state.count > 10) then');
	});

	it('compiles variable declaration', async () => {
		const source = `
<script>
let result = 0;
function calc() {
  let temp = 5;
  result = temp;
}
</script>
<text>{result}</text>
`.trim();

		const result = await compile(source, 'Test.svelte');

		expect(result.errors).toEqual([]);
		expect(result.brightscript).toContain('temp = 5');
	});
});
