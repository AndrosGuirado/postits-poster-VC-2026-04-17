<script lang="ts">
	import { onMount } from 'svelte';
	import { createScene, type PostitData } from './scene';

	let { postits }: { postits: PostitData[] } = $props();

	let canvas: HTMLCanvasElement;

	// Detect HTML-in-Canvas support: needs the URL flag and the WebGL API.
	// Enable via ?html-canvas; only activates when texElementImage2D exists
	// (Chrome Canary / Brave with canvas-draw-element flag on).
	function isHtmlCanvasSupported(): boolean {
		if (typeof window === 'undefined') return false;
		if (!new URLSearchParams(window.location.search).has('html-canvas')) return false;
		const testCtx = document.createElement('canvas').getContext('2d');
		return typeof (testCtx as any)?.drawElementImage === 'function';
	}

	// Creates a plain div that Tweakpane mounts into. The div is appended
	// directly to the main WebGL canvas (which carries layoutsubtree) inside
	// createScene so the browser lays it out and fires paint events on the canvas.
	function makePaneDiv(w: number, h: number): HTMLDivElement {
		const div = document.createElement('div');
		div.style.width = w + 'px';
		div.style.height = h + 'px';
		div.style.overflow = 'hidden';
		div.style.backgroundColor = 'hsl(230, 7%, 17%)';
		div.style.padding = '16px';
		div.style.boxSizing = 'border-box';
		return div;
	}

	onMount(() => {
		if (!isHtmlCanvasSupported()) {
			const handle = createScene(canvas, postits);
			return () => handle.destroy();
		}

		// Texture dimensions: 4× the PostIt SVG size (141×60) for crisp text.
		// Aspect ratio 141:60 ≈ 2.35:1.
		const TEX_W = 564;
		const TEX_H = 240;

		const sunEl    = makePaneDiv(TEX_W, TEX_H);
		const shadowEl = makePaneDiv(TEX_W, TEX_H);
		const dragEl   = makePaneDiv(TEX_W, TEX_H);

		// Scatter debug PostIts naturally within the paper — same left/top
		// range as the regular PostIts (20–80% left, 20–93% top).
		const debugPostits: PostitData[] = [
			{ left: 28, top: 32, rotate: -6, htmlElement: sunEl    },
			{ left: 60, top: 54, rotate:  4, htmlElement: shadowEl },
			{ left: 22, top: 74, rotate: -3, htmlElement: dragEl   },
		];

		const handle = createScene(canvas, [...postits, ...debugPostits], {
			htmlCanvasPanes: {
				sun:    sunEl,
				shadow: shadowEl,
				drag:   dragEl,
			},
		});

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
