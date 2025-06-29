<template>
  <div class="cyber-container">
    <h1 class="cyber-title">ABOUT_ME</h1>
    <div class="cyber-content">
      <p class="cyber-text">>_ 我是谁？</p>
      <p class="cyber-text">>_ 我的背景</p>
      <p class="cyber-text">>_ 我的兴趣</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'About'
}
</script>

<style scoped>
.cyber-container {
  background-color: #0a0a12;
  color: #00ff41;
  min-height: 100vh;
  padding: 2rem;
}
.cyber-title {
  font-family: 'Courier New', monospace;
  text-shadow: 0 0 5px #00ff41;
}
.cyber-text {
  font-family: 'Courier New', monospace;
  margin: 1rem 0;
}
</style>