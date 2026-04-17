<script lang="ts">
	import PostitSvg from './postit.svg?raw';
</script>

<template lang="pug">
	.postit {@html PostitSvg}
</template>

<style lang="stylus">
	@import '../styles/main.styl'

	.postit
		display inline-block
		width 100%
		aspect-ratio 140 / 60
		color var(--yellow)
</style>

