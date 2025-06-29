<template>
  <div class="cyber-container">
    <h1 class="cyber-title">MY_PROJECTS</h1>
    <div class="cyber-grid">
      <div class="cyber-card" v-for="project in projects" :key="project.id">
        <h3 class="cyber-card-title">{{ project.name }}</h3>
        <p class="cyber-card-desc">{{ project.description }}</p>
        <div class="cyber-card-tech">
          <span v-for="tech in project.tech" :key="tech">{{ tech }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Projects',
  data() {
    return {
      projects: [
        { id: 1, name: 'PROJECT_01', description: '>_ 项目描述', tech: ['Vue', 'Node'] },
        { id: 2, name: 'PROJECT_02', description: '>_ 项目描述', tech: ['React', 'MongoDB'] }
      ]
    }
  }
}
</script>

<style scoped>
.cyber-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 2rem;
}
.cyber-card {
  border: 1px solid #00ff41;
  padding: 1.5rem;
  transition: all 0.3s;
}
.cyber-card:hover {
  box-shadow: 0 0 10px #00ff41;
}
.cyber-card-title {
  color: #00ff41;
  margin-bottom: 1rem;
}
.cyber-card-desc {
  color: #00ff88;
  margin-bottom: 1rem;
}
.cyber-card-tech span {
  display: inline-block;
  margin-right: 0.5rem;
  padding: 0.2rem 0.5rem;
  background-color: #003300;
  color: #00ff41;
}
</style>