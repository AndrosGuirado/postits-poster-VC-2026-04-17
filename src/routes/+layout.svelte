<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '$lib/styles/main.styl';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<style lang="stylus">
	:global(*)
		margin 0
		padding 0
		box-sizing border-box

	:global(html, body)
		width 100%
		height 100%
		background-color var(--bg)
</style>
