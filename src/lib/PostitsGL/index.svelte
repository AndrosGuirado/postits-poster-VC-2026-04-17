<script lang="ts">
	import { onMount } from 'svelte';
	import { createScene, type PostitData } from './scene';

	let { postits }: { postits: PostitData[] } = $props();

	let canvas: HTMLCanvasElement;

	onMount(() => {
		const handle = createScene(canvas, postits);
		return () => handle.destroy();
	});
</script>

<canvas bind:this={canvas}></canvas>

<style lang="stylus">
	canvas
		display block
		width 100%
		height 100%
</style>
