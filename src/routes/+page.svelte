<script lang="ts">
	import PostitsGL from '$lib/PostitsGL/index.svelte';

	function seededRand(seed: number) {
		let s = seed;
		return () => {
			s = (Math.imul(s, 1664525) + 1013904223) | 0;
			return (s >>> 0) / 0xffffffff;
		};
	}

	const rand = seededRand(89);
	const zones = 8;
	const topStart = 20, topEnd = 93;
	const zoneH = (topEnd - topStart) / zones;
	const postits = Array.from({ length: 16 }, (_, i) => ({
		left:   i % 2 === 0 ? 20 + rand() * 20 : 60 + rand() * 20,
		top:    topStart + Math.floor(i / 2) * zoneH + rand() * zoneH,
		rotate: -15 + rand() * 30,
	}));
</script>

<template lang="pug">
	main.canvas
		.paper
			PostitsGL(postits!="{postits}")
</template>

<style lang="stylus">
	@import '../lib/styles/main.styl'

	.canvas
		width 100%
		min-height 100vh
		display flex
		justify-content center
		align-items flex-start
		padding var(--page-padding) var(--space-5)

	.paper
		position relative
		height 90vh
		height 90dvh
		width auto
		aspect-ratio 210 / 297
		background-color var(--white)
		box-shadow var(--shadow-paper)
		overflow hidden
</style>
