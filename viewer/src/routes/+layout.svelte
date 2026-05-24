<script>
  import '../app.css'
  let { children } = $props()
</script>

<main class="min-h-screen bg-zinc-950 text-zinc-100">
  {@render children()}
</main>
